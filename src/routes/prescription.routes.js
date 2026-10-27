const express = require("express");
const { z } = require("zod");
const { authenticate, authorize } = require("../middleware/auth");
const {
  createPrescription,
  getPrescription,
} = require("../services/prescription.service");

const router = express.Router();

const prescriptionSchema = z.object({
  details: z.record(z.string(), z.unknown()),
  notes: z.string().trim().max(5000).optional(),
});

router.post(
  "/:consultationId/prescriptions",
  authenticate,
  authorize("doctor"),
  async (req, res, next) => {
    try {
      const id = z.coerce
        .number()
        .int()
        .positive()
        .safeParse(req.params.consultationId);
      const body = prescriptionSchema.safeParse(req.body);

      if (!id.success || !body.success) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid consultation ID or prescription details",
          },
        });
      }

      const prescription = await createPrescription({
        consultationId: id.data,
        user: req.user,
        details: body.data.details,
        notes: body.data.notes,
      });

      return res.status(201).json({ data: prescription });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/:consultationId/prescriptions",
  authenticate,
  authorize("patient", "doctor", "admin"),
  async (req, res, next) => {
    try {
      const id = z.coerce
        .number()
        .int()
        .positive()
        .safeParse(req.params.consultationId);

      if (!id.success) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid consultation ID",
          },
        });
      }

      const prescription = await getPrescription({
        consultationId: id.data,
        user: req.user,
      });

      return res.json({ data: prescription });
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
