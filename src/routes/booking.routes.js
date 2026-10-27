const express = require("express");
const { z } = require("zod");
const { authenticate, authorize } = require("../middleware/auth");
const { createBooking } = require("../services/booking.service");

const router = express.Router();

const bookingSchema = z.object({
  slotId: z.coerce.number().int().positive(),
  reason: z.string().trim().max(1000).optional(),
});

router.post("/", authenticate, authorize("patient"), async (req, res, next) => {
  try {
    const parsed = bookingSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid booking data",
        },
      });
    }

    const result = await createBooking({
      patientId: req.user.id,
      slotId: parsed.data.slotId,
      reason: parsed.data.reason,
      idempotencyKey: req.get("Idempotency-Key"),
    });

    res.set("Idempotency-Replayed", String(result.replayed));
    return res.status(result.status).json(result.body);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
