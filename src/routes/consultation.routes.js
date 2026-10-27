const express = require("express");
const { z } = require("zod");
const { authenticate, authorize } = require("../middleware/auth");
const {
  getConsultations,
  updateConsultationStatus,
} = require("../services/consultation.service");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorize("patient", "doctor", "admin"),
  async (req, res, next) => {
    try {
      const data = await getConsultations(req.user);
      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/:consultationId/status",
  authenticate,
  authorize("patient", "doctor", "admin"),
  async (req, res, next) => {
    try {
      const id = z.coerce
        .number()
        .int()
        .positive()
        .safeParse(req.params.consultationId);
      const body = z
        .object({
          status: z.enum([
            "confirmed",
            "in_progress",
            "completed",
            "cancelled",
            "no_show",
          ]),
        })
        .safeParse(req.body);

      if (!id.success || !body.success) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid consultation ID or status",
          },
        });
      }

      const data = await updateConsultationStatus({
        consultationId: id.data,
        user: req.user,
        status: body.data.status,
      });

      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
