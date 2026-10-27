require("dotenv").config({ path: ".env.test" });

const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../src/app");
const pool = require("../src/config/db");

describe("Consultation API", () => {
  let patientToken;
  let patientId;
  let doctorUserId;
  let slotId;
  let consultationId;

  const password = "TestPassword123!";

  beforeAll(async () => {
    await pool.query(`
      DELETE FROM outbox_events;
      DELETE FROM audit_logs;
      DELETE FROM prescriptions;
      DELETE FROM payments;
      DELETE FROM consultations;
      DELETE FROM idempotency_keys;
      DELETE FROM availability_slots;
      DELETE FROM doctors;
      DELETE FROM profiles;
      DELETE FROM users;
    `);

    const passwordHash = await bcrypt.hash(password, 4);

    const patient = await pool.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ('consultation-patient@example.com', $1, 'patient')
       RETURNING id`,
      [passwordHash],
    );

    patientId = patient.rows[0].id;

    await pool.query(
      `INSERT INTO profiles (user_id, full_name)
       VALUES ($1, 'Consultation Test Patient')`,
      [patientId],
    );

    const doctorUser = await pool.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ('consultation-doctor@example.com', $1, 'doctor')
       RETURNING id`,
      [passwordHash],
    );

    doctorUserId = doctorUser.rows[0].id;

    const doctor = await pool.query(
      `INSERT INTO doctors
        (user_id, specialization, qualifications, experience_years,
         consultation_fee, is_verified)
       VALUES ($1, 'General Physician', 'MBBS', 5, 500, TRUE)
       RETURNING id`,
      [doctorUserId],
    );

    const slot = await pool.query(
      `INSERT INTO availability_slots
        (doctor_id, starts_at, ends_at, status)
       VALUES ($1, NOW() + INTERVAL '2 days',
               NOW() + INTERVAL '2 days 30 minutes', 'available')
       RETURNING id`,
      [doctor.rows[0].id],
    );

    slotId = slot.rows[0].id;

    const login = await request(app).post("/api/v1/auth/login").send({
      email: "consultation-patient@example.com",
      password,
    });

    expect(login.statusCode).toBe(200);
    patientToken = login.body.token;

    const booking = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${patientToken}`)
      .set("Idempotency-Key", "consultation-lifecycle-test")
      .send({ slotId, reason: "Consultation lifecycle test" });

    expect(booking.statusCode).toBe(201);
    consultationId = booking.body.consultation.id;
  });

  afterAll(async () => {
    await pool.end();
  });

  test("patient can view their own consultations", async () => {
    const response = await request(app)
      .get("/api/v1/consultations")
      .set("Authorization", `Bearer ${patientToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.data.some((item) => item.id === consultationId)).toBe(
      true,
    );
  });

  test("patient cannot mark a consultation completed", async () => {
    const response = await request(app)
      .patch(`/api/v1/consultations/${consultationId}/status`)
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ status: "completed" });

    expect(response.statusCode).toBe(403);
  });

  test("patient can cancel their own booked consultation", async () => {
    const response = await request(app)
      .patch(`/api/v1/consultations/${consultationId}/status`)
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ status: "cancelled" });

    expect(response.statusCode).toBe(200);
    expect(response.body.data.status).toBe("cancelled");

    const slot = await pool.query(
      "SELECT status FROM availability_slots WHERE id = $1",
      [slotId],
    );

    expect(slot.rows[0].status).toBe("available");
  });

  test("cannot transition a cancelled consultation to completed", async () => {
    const response = await request(app)
      .patch(`/api/v1/consultations/${consultationId}/status`)
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ status: "completed" });

    expect(response.statusCode).toBe(403);
  });
});
