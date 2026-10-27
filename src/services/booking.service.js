const crypto = require("crypto");
const pool = require("../config/db");

class BookingError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function createBooking({ patientId, slotId, reason, idempotencyKey }) {
  if (!idempotencyKey || idempotencyKey.length > 200) {
    throw new BookingError(
      400,
      "INVALID_IDEMPOTENCY_KEY",
      "A valid Idempotency-Key header is required",
    );
  }

  const requestHash = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        patientId: String(patientId),
        slotId: Number(slotId),
        reason: reason || null,
      }),
    )
    .digest("hex");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Serialize requests using the same patient's idempotency key.
    const lockKey = `${patientId}:${idempotencyKey}`;

    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [lockKey],
    );

    // If this exact request has already succeeded, return its saved response.
    const previous = await client.query(
      `SELECT request_hash, response_status, response_body
       FROM idempotency_keys
       WHERE user_id = $1 AND key = $2
       FOR UPDATE`,
      [patientId, idempotencyKey],
    );

    if (previous.rowCount) {
      const saved = previous.rows[0];

      if (saved.request_hash !== requestHash) {
        throw new BookingError(
          409,
          "IDEMPOTENCY_KEY_REUSED",
          "This idempotency key was used for a different request",
        );
      }

      if (saved.response_status && saved.response_body) {
        await client.query("COMMIT");
        return {
          status: saved.response_status,
          body: saved.response_body,
          replayed: true,
        };
      }
    } else {
      await client.query(
        `INSERT INTO idempotency_keys (user_id, key, request_hash)
         VALUES ($1, $2, $3)`,
        [patientId, idempotencyKey, requestHash],
      );
    }

    // Serialize competing bookings for the same slot.
    const slotResult = await client.query(
      `SELECT s.id, s.doctor_id, s.starts_at, s.ends_at, s.status,
              d.is_verified
       FROM availability_slots s
       JOIN doctors d ON d.id = s.doctor_id
       WHERE s.id = $1
       FOR UPDATE OF s`,
      [slotId],
    );

    if (!slotResult.rowCount) {
      throw new BookingError(
        404,
        "SLOT_NOT_FOUND",
        "Availability slot not found",
      );
    }

    const slot = slotResult.rows[0];

    if (!slot.is_verified) {
      throw new BookingError(
        409,
        "DOCTOR_NOT_VERIFIED",
        "Doctor is not verified",
      );
    }

    if (slot.status !== "available" || new Date(slot.starts_at) <= new Date()) {
      throw new BookingError(
        409,
        "SLOT_UNAVAILABLE",
        "This slot is no longer available",
      );
    }

    const consultationResult = await client.query(
      `INSERT INTO consultations
         (patient_id, doctor_id, slot_id, status, reason, idempotency_key)
       VALUES ($1, $2, $3, 'booked', $4, $5)
       RETURNING id, patient_id, doctor_id, slot_id, status, reason, created_at`,
      [patientId, slot.doctor_id, slot.id, reason || null, idempotencyKey],
    );

    const consultation = consultationResult.rows[0];

    await client.query(
      `UPDATE availability_slots
       SET status = 'booked'
       WHERE id = $1`,
      [slot.id],
    );

    await client.query(
      `INSERT INTO audit_logs
         (actor_user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, 'CONSULTATION_BOOKED', 'consultation', $2, $3::jsonb)`,
      [
        patientId,
        String(consultation.id),
        JSON.stringify({ slotId: slot.id, doctorId: slot.doctor_id }),
      ],
    );

    await client.query(
      `INSERT INTO outbox_events
         (event_type, aggregate_type, aggregate_id, payload)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [
        "consultation.booked",
        "consultation",
        String(consultation.id),
        JSON.stringify({ consultationId: consultation.id }),
      ],
    );

    const responseBody = { consultation };

    await client.query(
      `UPDATE idempotency_keys
       SET response_status = 201, response_body = $3::jsonb
       WHERE user_id = $1 AND key = $2`,
      [patientId, idempotencyKey, JSON.stringify(responseBody)],
    );

    await client.query("COMMIT");

    return { status: 201, body: responseBody, replayed: false };
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      throw new BookingError(
        409,
        "BOOKING_CONFLICT",
        "This slot or idempotency key has already been used",
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

module.exports = { createBooking, BookingError };
