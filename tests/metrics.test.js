require("dotenv").config({ path: ".env.test" });

const request = require("supertest");
const app = require("../src/app");

function getMetrics() {
  const req = request(app).get("/metrics");
  const token = process.env.METRICS_TOKEN;

  if (token) {
    req.set("Authorization", `Bearer ${token}`);
  }

  return req;
}

describe("Prometheus metrics", () => {
  test("GET /metrics returns Prometheus-formatted metrics", async () => {
    const response = await getMetrics();

    expect(response.status).toBe(200);
    expect(response.text).toContain("amrutam_http_requests_total");
    expect(response.text).toContain("amrutam_http_request_duration_seconds");
  });

  test("request metrics include the health endpoint", async () => {
    await request(app).get("/health/live");

    const response = await getMetrics();

    expect(response.status).toBe(200);
    expect(response.text).toContain('route="/health/live"');
  });
});
