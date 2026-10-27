require("dotenv").config({ path: ".env.test" });

const request = require("supertest");
const app = require("../src/app");
const pool = require("../src/config/db");

describe("Doctor API", () => {
  afterAll(async () => {
    await pool.end();
  });

  test("GET /api/v1/doctors returns a list of doctors", async () => {
    const response = await request(app).get("/api/v1/doctors");

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body).toHaveProperty("pagination");
  });

  test("GET /api/v1/doctors rejects an invalid date", async () => {
    const response = await request(app)
      .get("/api/v1/doctors")
      .query({ date: "not-a-date" });

    expect(response.statusCode).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("GET /api/v1/doctors rejects an invalid doctor ID", async () => {
    const response = await request(app).get("/api/v1/doctors/abc/slots");

    expect(response.statusCode).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
