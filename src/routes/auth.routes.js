const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const pool = require("../config/db");

const router = express.Router();

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(12).max(72),
  fullName: z.string().trim().min(2).max(150),
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(72),
});

router.post("/register", async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid registration data",
        },
      });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const fullName = parsed.data.fullName;
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `INSERT INTO users (email, password_hash, role)
         VALUES ($1, $2, 'patient')
         RETURNING id, email, role`,
        [email, passwordHash],
      );

      const user = result.rows[0];

      await client.query(
        `INSERT INTO profiles (user_id, full_name)
         VALUES ($1, $2)`,
        [user.id, fullName],
      );

      await client.query("COMMIT");

      return res.status(201).json({
        message: "Registration successful",
        user,
      });
    } catch (error) {
      await client.query("ROLLBACK");

      if (error.code === "23505") {
        return res.status(409).json({
          error: {
            code: "EMAIL_EXISTS",
            message: "An account with this email already exists",
          },
        });
      }

      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid login data",
        },
      });
    }

    const email = parsed.data.email.trim().toLowerCase();

    const result = await pool.query(
      `SELECT id, email, password_hash, role, is_active
       FROM users
       WHERE email = $1`,
      [email],
    );

    const user = result.rows[0];

    const passwordMatches = await bcrypt.compare(
      parsed.data.password,
      user ? user.password_hash : "$2b$12$invalidhash",
    );

    if (!user || !passwordMatches || !user.is_active) {
      return res.status(401).json({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password",
        },
      });
    }

    const token = jwt.sign({ role: user.role }, process.env.JWT_SECRET, {
      subject: String(user.id),
      expiresIn: process.env.JWT_EXPIRES_IN || "15m",
      issuer: "amrutam-api",
      audience: "amrutam-clients",
      algorithm: "HS256",
    });

    return res.json({
      token,
      tokenType: "Bearer",
      expiresIn: process.env.JWT_EXPIRES_IN || "15m",
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
