require("dotenv").config({ path: ".env.test" });

const request = require("supertest");
const bcrypt = require("bcryptjs");
const pool = require("../src/config/db");
const app = require("../src/app");

describe("Booking API integration tests", () => {
  let patientToken;
  let patientId;
  let slotId;

  const idempotencyKey = "booking-integration-test-001";

  beforeAll(async () => {
    // Clean up test data from any previous run.
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

    const passwordHash = await bcrypt.hash("TestPassword123!", 4);

    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ('patient-test@example.com', $1, 'patient')
       RETURNING id`,
      [passwordHash],
    );

    patientId = userResult.rows[0].id;

    await pool.query(
      `INSERT INTO profiles (user_id, full_name)
       VALUES ($1, 'Test Patient')`,
      [patientId],
    );

    const doctorUser = await pool.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ('doctor-test@example.com', $1, 'doctor')
       RETURNING id`,
      [passwordHash],
    );

    const doctor = await pool.query(
      `INSERT INTO doctors
         (user_id, specialization, qualifications, experience_years,
          consultation_fee, is_verified)
       VALUES ($1, 'General Physician', 'MBBS', 5, 500, TRUE)
       RETURNING id`,
      [doctorUser.rows[0].id],
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

    // Log in through the actual authentication endpoint.
    const login = await request(app).post("/api/v1/auth/login").send({
      email: "patient-test@example.com",
      password: "TestPassword123!",
    });

    expect(login.statusCode).toBe(200);
    patientToken = login.body.token;
  });

  afterAll(async () => {
    await pool.end();
  });

  test("creates a booking and returns the same consultation on retry", async () => {
    const payload = {
      slotId: Number(slotId),
      reason: "Integration test consultation",
    };

    const first = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${patientToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send(payload);

    expect(first.statusCode).toBe(201);
    expect(first.body.consultation).toBeDefined();

    const second = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${patientToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send(payload);

    expect(second.statusCode).toBe(201);
    expect(second.body.consultation.id).toBe(first.body.consultation.id);

    const count = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM consultations
       WHERE slot_id = $1`,
      [slotId],
    );

    expect(count.rows[0].count).toBe(1);
  });

  test("rejects a different request using the same idempotency key", async () => {
    const response = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${patientToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send({
        slotId: Number(slotId),
        reason: "A different reason",
      });

    expect(response.statusCode).toBe(409);
  });

  test("rejects another booking for an already-booked slot", async () => {
    const response = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${patientToken}`)
      .set("Idempotency-Key", "booking-integration-test-002")
      .send({
        slotId: Number(slotId),
        reason: "Second booking attempt",
      });

    expect(response.statusCode).toBe(409);
  });
});
