const pool = require("../config/db");

async function createPrescription({ consultationId, user, details, notes }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT c.id, c.status, c.doctor_id, c.patient_id,
              d.user_id AS doctor_user_id
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

    if (
      user.role !== "doctor" ||
      String(consultation.doctor_user_id) !== String(user.id)
    ) {
      const error = new Error(
        "Only the assigned doctor can create this prescription",
      );
      error.status = 403;
      throw error;
    }

    if (!["in_progress", "completed"].includes(consultation.status)) {
      const error = new Error(
        "Prescriptions can only be created for in-progress or completed consultations",
      );
      error.status = 409;
      throw error;
    }

    // Avoid duplicate prescriptions for the same consultation.
    const existing = await client.query(
      "SELECT id FROM prescriptions WHERE consultation_id = $1",
      [consultationId],
    );

    if (existing.rowCount) {
      const error = new Error(
        "A prescription already exists for this consultation",
      );
      error.status = 409;
      throw error;
    }

    const inserted = await client.query(
      `INSERT INTO prescriptions
       (consultation_id, doctor_id, details, notes)
       VALUES ($1, $2, $3::jsonb, $4)
       RETURNING *`,
      [
        consultationId,
        consultation.doctor_id,
        JSON.stringify(details),
        notes ?? null,
      ],
    );

    await client.query(
      `INSERT INTO audit_logs
       (actor_user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, 'prescription.created', 'prescription', $2, $3::jsonb)`,
      [
        user.id,
        String(inserted.rows[0].id),
        JSON.stringify({ consultationId }),
      ],
    );

    await client.query("COMMIT");
    return inserted.rows[0];
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
      // Preserve the original error.
    }
    throw error;
  } finally {
    client.release();
  }
}

async function getPrescription({ consultationId, user }) {
  const result = await pool.query(
    `SELECT p.*
     FROM prescriptions p
     JOIN consultations c ON c.id = p.consultation_id
     JOIN doctors d ON d.id = c.doctor_id
     WHERE p.consultation_id = $1
       AND (
         c.patient_id = $2
         OR d.user_id = $2
         OR $3 = 'admin'
       )`,
    [consultationId, user.id, user.role],
  );

  if (!result.rowCount) {
    // Return the same response for missing and inaccessible records
    // to avoid disclosing whether another patient's prescription exists.
    const error = new Error("Prescription not found");
    error.status = 404;
    throw error;
  }

  return result.rows[0];
}

module.exports = {
  createPrescription,
  getPrescription,
};
