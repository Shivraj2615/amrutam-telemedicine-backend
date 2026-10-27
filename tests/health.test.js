require("dotenv").config({ path: ".env.test" });

const request = require("supertest");
const app = require("../src/app");

describe("Health endpoint", () => {
  test("GET /health/live returns 200 and status ok", async () => {
    const response = await request(app).get("/health/live");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});
