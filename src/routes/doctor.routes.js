const express = require("express");
const { z } = require("zod");
const pool = require("../config/db");

const router = express.Router();

const searchSchema = z.object({
  specialization: z.string().trim().max(100).optional(),
  date: z.string().date().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get("/", async (req, res, next) => {
  try {
    const parsed = searchSchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid doctor search parameters",
        },
      });
    }

    const { specialization, date, limit, offset } = parsed.data;

    const result = await pool.query(
      `SELECT
         d.id AS doctor_id,
         u.id AS user_id,
         p.full_name,
         d.specialization,
         d.qualifications,
         d.experience_years,
         d.consultation_fee,
         d.bio
       FROM doctors d
       JOIN users u ON u.id = d.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE d.is_verified = TRUE
         AND u.is_active = TRUE
         AND ($1::text IS NULL OR d.specialization ILIKE '%' || $1 || '%')
         AND (
           $2::date IS NULL OR EXISTS (
             SELECT 1
             FROM availability_slots s
             WHERE s.doctor_id = d.id
               AND s.status = 'available'
               AND s.starts_at >= $2::date
               AND s.starts_at < $2::date + INTERVAL '1 day'
               AND s.starts_at > NOW()
           )
         )
       ORDER BY d.experience_years DESC, d.id
       LIMIT $3 OFFSET $4`,
      [specialization || null, date || null, limit, offset],
    );

    return res.json({
      data: result.rows,
      pagination: { limit, offset, count: result.rowCount },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:doctorId/slots", async (req, res, next) => {
  try {
    const id = z.coerce
      .number()
      .int()
      .positive()
      .safeParse(req.params.doctorId);

    if (!id.success) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Invalid doctor ID" },
      });
    }

    const result = await pool.query(
      `SELECT s.id, s.starts_at, s.ends_at
       FROM availability_slots s
       JOIN doctors d ON d.id = s.doctor_id
       JOIN users u ON u.id = d.user_id
       WHERE s.doctor_id = $1
         AND d.is_verified = TRUE
         AND u.is_active = TRUE
         AND s.status = 'available'
         AND s.starts_at > NOW()
       ORDER BY s.starts_at
       LIMIT 100`,
      [id.data],
    );

    return res.json({ data: result.rows });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
