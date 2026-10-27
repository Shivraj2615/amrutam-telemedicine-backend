const pool = require("../config/db");

async function getAdminAnalytics() {
  const result = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int
       FROM users
       WHERE role = 'patient' AND is_active = TRUE) AS total_patients,

      (SELECT COUNT(*)::int
       FROM doctors) AS total_doctors,

      (SELECT COUNT(*)::int
       FROM consultations) AS total_consultations,

      (SELECT COUNT(*)::int
       FROM availability_slots
       WHERE status = 'available') AS available_slots,

      (SELECT COUNT(*)::int
       FROM availability_slots
       WHERE status = 'booked') AS booked_slots,

      (SELECT COUNT(*)::int
       FROM availability_slots
       WHERE status = 'blocked') AS blocked_slots
  `);

  const statusResult = await pool.query(`
    SELECT status, COUNT(*)::int AS count
    FROM consultations
    GROUP BY status
    ORDER BY status
  `);

  const consultationsByStatus = Object.fromEntries(
    statusResult.rows.map((row) => [row.status, row.count]),
  );

  return {
    totalPatients: result.rows[0].total_patients,
    totalDoctors: result.rows[0].total_doctors,
    totalConsultations: result.rows[0].total_consultations,
    consultationsByStatus,
    slots: {
      available: result.rows[0].available_slots,
      booked: result.rows[0].booked_slots,
      blocked: result.rows[0].blocked_slots,
    },
  };
}

module.exports = { getAdminAnalytics };
