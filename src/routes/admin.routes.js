const express = require("express");
const { authenticate, authorize } = require("../middleware/auth");
const { getAdminAnalytics } = require("../services/admin-analytics.service");

const router = express.Router();

router.get(
  "/analytics",
  authenticate,
  authorize("admin"),
  async (req, res, next) => {
    try {
      const analytics = await getAdminAnalytics();

      res.status(200).json({
        data: analytics,
      });
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
