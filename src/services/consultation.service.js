const pool = require("../config/db");

const ALLOWED_TRANSITIONS = {
  booked: ["confirmed", "cancelled"],
  confirmed: ["in_progress", "cancelled", "no_show"],
  in_progress: ["completed"],
};

async function getConsultations(user) {
  let query;
  let values;

  if (user.role === "patient") {
    query = `
      SELECT c.*, d.specialization, p.full_name AS doctor_name
      FROM consultations c
      JOIN doctors d ON d.id = c.doctor_id
      LEFT JOIN profiles p ON p.user_id = d.user_id
      WHERE c.patient_id = (
        SELECT id FROM users WHERE id = $1
      )
      ORDER BY c.created_at DESC
    `;
    values = [user.id];
  } else if (user.role === "doctor") {
    query = `
      SELECT c.*, p.full_name AS patient_name
      FROM consultations c
      JOIN doctors d ON d.id = c.doctor_id
      LEFT JOIN profiles p ON p.user_id = c.patient_id
      WHERE d.user_id = $1
      ORDER BY c.created_at DESC
    `;
    values = [user.id];
  } else if (user.role === "admin") {
    query = `
      SELECT c.*
      FROM consultations c
      ORDER BY c.created_at DESC
    `;
    values = [];
  } else {
    const error = new Error("Forbidden");
    error.status = 403;
    throw error;
  }

  const result = await pool.query(query, values);
  return result.rows;
}

async function updateConsultationStatus({ consultationId, user, status }) {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    const result = await client.query(
      `SELECT c.*, d.user_id AS doctor_user_id
       FROM consultations c
       JOIN doctors d ON d.id = c.doctor_id
       WHERE c.id = $1
       FOR UPDATE OF c`,
      [consultationId],
    );

    if (!result.rowCount) {
      const error = new Error("Consultation not found");
      error.status = 404;
      throw error;
    }

    const consultation = result.rows[0];

    // Check role and ownership.
    if (!["patient", "doctor", "admin"].includes(user.role)) {
      const error = new Error("Forbidden");
      error.status = 403;
      throw error;
    }

    if (
      user.role === "patient" &&
      String(consultation.patient_id) !== String(user.id)
    ) {
      const error = new Error("You cannot modify this consultation");
      error.status = 403;
      throw error;
    }

    if (
      user.role === "doctor" &&
      String(consultation.doctor_user_id) !== String(user.id)
    ) {
      const error = new Error("This consultation is not assigned to you");
      error.status = 403;
      throw error;
    }

    // Patients may only cancel their own consultation.
    if (user.role === "patient" && status !== "cancelled") {
      const error = new Error("Patients can only cancel consultations");
      error.status = 403;
      throw error;
    }

    // Admins may only cancel consultations in this implementation.
    if (user.role === "admin" && status !== "cancelled") {
      const error = new Error("Admins can only cancel consultations");
      error.status = 403;
      throw error;
    }

    // Validate the state transition.
    if (!ALLOWED_TRANSITIONS[consultation.status]?.includes(status)) {
      const error = new Error(
        `Cannot change consultation status from ${consultation.status} to ${status}`,
      );
      error.status = 409;
      throw error;
    }

    // Release the slot before completing cancellation.
    // Both operations are part of the same transaction.
    if (status === "cancelled") {
      const slotUpdate = await client.query(
        `UPDATE availability_slots
         SET status = 'available'
         WHERE id = $1
           AND status = 'booked'
         RETURNING id`,
        [consultation.slot_id],
      );

      if (slotUpdate.rowCount !== 1) {
        const error = new Error("Could not release the consultation slot");
        error.status = 409;
        throw error;
      }
    }

    const updated = await client.query(
      `UPDATE consultations
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, consultationId],
    );

    await client.query(
      `INSERT INTO audit_logs
       (actor_user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, $2, 'consultation', $3, $4::jsonb)`,
      [
        user.id,
        `consultation.${status}`,
        String(consultationId),
        JSON.stringify({
          previousStatus: consultation.status,
          newStatus: status,
        }),
      ],
    );

    await client.query("COMMIT");
    transactionStarted = false;

    return updated.rows[0];
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        // Preserve the original error.
      }
    }
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getConsultations,
  updateConsultationStatus,
};
