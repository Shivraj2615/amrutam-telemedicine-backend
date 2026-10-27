const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const pinoHttp = require("pino-http");
const { metricsMiddleware, register } = require("./middleware/metrics");

const authRoutes = require("./routes/auth.routes");
const bookingRoutes = require("./routes/booking.routes");
const doctorRoutes = require("./routes/doctor.routes");
const consultationRoutes = require("./routes/consultation.routes");
const prescriptionRoutes = require("./routes/prescription.routes");
const docsRoutes = require("./routes/docs.routes");
const adminRoutes = require("./routes/admin.routes");

const app = express();

app.use(
  pinoHttp({
    redact: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['x-api-key']",
    ],
    // Avoid logging request bodies or query strings.
    serializers: {
      req(req) {
        return {
          method: req.method,
          url: req.url.split("?")[0],
          remoteAddress: req.remoteAddress,
        };
      },
    },
  }),
);

app.use(metricsMiddleware);

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",")
      : false,
  }),
);
app.use(express.json({ limit: "100kb" }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 200,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get("/health/live", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/metrics", async (req, res, next) => {
  try {
    // In production, require a configured secret.
    const token = process.env.METRICS_TOKEN;

    if (process.env.NODE_ENV === "production" && !token) {
      return res.status(503).send("Metrics endpoint not configured");
    }

    if (token && req.get("Authorization") !== `Bearer ${token}`) {
      return res.status(403).send("Forbidden");
    }

    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    next(error);
  }
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/bookings", bookingRoutes);
app.use("/api/v1/doctors", doctorRoutes);
app.use("/api/v1/consultations", consultationRoutes);
app.use("/api/v1/consultations", prescriptionRoutes);
app.use("/api-docs", docsRoutes);
app.use("/api/v1/admin", adminRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: "Route not found" },
  });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  const status = err.status || 500;

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({
    error: {
      code: err.code || "INTERNAL_ERROR",
      message: status >= 500 ? "An unexpected error occurred" : err.message,
    },
  });
});

module.exports = app;
