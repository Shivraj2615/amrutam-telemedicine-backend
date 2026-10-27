require("dotenv").config({ path: ".env.test" });

const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../src/app");
const pool = require("../src/config/db");

describe("Admin Analytics API", () => {
  let patientToken;
  let adminToken;
  let patientId;
  let adminId;

  const password = "TestPassword123!";
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const patientEmail = `analytics-patient-${suffix}@example.com`;
  const adminEmail = `analytics-admin-${suffix}@example.com`;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash(password, 4);

    const patient = await pool.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, 'patient')
       RETURNING id`,
      [patientEmail, passwordHash],
    );
    patientId = patient.rows[0].id;

    await pool.query(
      `INSERT INTO profiles (user_id, full_name)
       VALUES ($1, 'Analytics Test Patient')`,
      [patientId],
    );

    const admin = await pool.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, 'admin')
       RETURNING id`,
      [adminEmail, passwordHash],
    );
    adminId = admin.rows[0].id;

    const patientLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: patientEmail, password });

    expect(patientLogin.statusCode).toBe(200);
    patientToken = patientLogin.body.token;

    const adminLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: adminEmail, password });

    expect(adminLogin.statusCode).toBe(200);
    adminToken = adminLogin.body.token;
  });

  afterAll(async () => {
    if (patientId && adminId) {
      await pool.query(
        "DELETE FROM profiles WHERE user_id = ANY($1::bigint[])",
        [[patientId, adminId]],
      );

      await pool.query("DELETE FROM users WHERE id = ANY($1::bigint[])", [
        [patientId, adminId],
      ]);
    }

    await pool.end();
  });

  test("rejects requests without authentication", async () => {
    const response = await request(app).get("/api/v1/admin/analytics");
    expect(response.statusCode).toBe(401);
  });

  test("denies analytics access to patients", async () => {
    const response = await request(app)
      .get("/api/v1/admin/analytics")
      .set("Authorization", `Bearer ${patientToken}`);

    expect(response.statusCode).toBe(403);
  });

  test("allows admins to view aggregate analytics", async () => {
    const response = await request(app)
      .get("/api/v1/admin/analytics")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("data.totalPatients");
    expect(response.body).toHaveProperty("data.totalDoctors");
    expect(response.body).toHaveProperty("data.totalConsultations");
    expect(response.body).toHaveProperty("data.consultationsByStatus");
    expect(response.body).toHaveProperty("data.slots.available");

    expect(typeof response.body.data.totalPatients).toBe("number");
    expect(typeof response.body.data.totalDoctors).toBe("number");
    expect(typeof response.body.data.totalConsultations).toBe("number");
  });
});
