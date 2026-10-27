const client = require("prom-client");

const register = new client.Registry();

client.collectDefaultMetrics({
  register,
  prefix: "amrutam_",
});

const httpRequestsTotal = new client.Counter({
  name: "amrutam_http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

const httpRequestDuration = new client.Histogram({
  name: "amrutam_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
  registers: [register],
});

function metricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    // Use Express's matched route, not arbitrary user-supplied URLs.
    const route = req.route
      ? `${req.baseUrl || ""}${req.route.path}`
      : "unmatched";

    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };

    httpRequestsTotal.inc(labels);

    const elapsedSeconds = Number(process.hrtime.bigint() - start) / 1e9;

    httpRequestDuration.observe(labels, elapsedSeconds);
  });

  next();
}

module.exports = {
  metricsMiddleware,
  register,
};
