# Amrutam Telemedicine Backend

A REST API for a telemedicine platform supporting authentication, doctor discovery, appointment booking, consultation lifecycle management, and prescriptions.

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** PostgreSQL
- **Authentication:** JWT and bcrypt
- **Validation:** Zod
- **Security:** Helmet, CORS configuration, rate limiting, parameterized SQL queries
- **Observability:** Pino HTTP logging and Prometheus metrics
- **Testing:** Jest and Supertest
- **API style:** REST

## Core Features

- Patient registration and login
- Role-based access for patients, doctors, and administrators
- Doctor discovery with specialization, date filters, and pagination
- Doctor availability slot listing
- Transactional appointment booking with idempotency support
- Consultation listing and controlled lifecycle transitions
- Prescription creation and access control
- Audit logging and outbox event recording
- HTTP request metrics and structured logging
- Health endpoint and centralized error handling

## Prerequisites

- Node.js and npm
- PostgreSQL
- Git

Docker is optional for local development if PostgreSQL is installed separately.

## Local Setup

1. Clone the repository.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the project root:

   ```env
   PORT=3000
   NODE_ENV=development
   DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/amrutam
   JWT_SECRET=replace_with_a_long_random_secret
   CORS_ORIGIN=http://localhost:3000
   METRICS_TOKEN=replace_with_a_random_secret
   ```

4. Create the PostgreSQL database and apply the project's schema/migrations.
5. Start the server:

   ```bash
   npm run dev
   ```

The server listens on the configured port.

## Testing

Configure `.env.test` to point to a dedicated test database, such as `amrutam_test`. Never point the test suite at a production database.

Run:

```bash
npm test
```

The integration tests exercise health checks, database configuration, doctor endpoints, booking idempotency, consultation lifecycle rules, and metrics. Tests that create data should only run against the dedicated test database.

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health/live` | Liveness check |
| GET | `/metrics` | Prometheus metrics |
| POST | `/api/v1/auth/register` | Register a patient |
| POST | `/api/v1/auth/login` | Log in |
| GET | `/api/v1/doctors` | Search and list doctors |
| GET | `/api/v1/doctors/:doctorId/slots` | List available slots |
| POST | `/api/v1/bookings` | Book a consultation |
| GET | `/api/v1/consultations` | List consultations visible to the caller |
| PATCH | `/api/v1/consultations/:consultationId/status` | Update consultation status |
| POST | `/api/v1/consultations/:consultationId/prescriptions` | Create a prescription |
| GET | `/api/v1/consultations/:consultationId/prescriptions` | Read a prescription |

Protected endpoints require a valid bearer token:

```http
Authorization: Bearer YOUR_JWT
```

Booking requests require an `Idempotency-Key` header to support safe retries.

## Booking Reliability

Booking uses a PostgreSQL transaction to coordinate consultation creation and slot reservation. Row-level locking helps prevent two concurrent requests from booking the same slot. Idempotency handling allows clients to retry a request without creating a duplicate booking, while rejecting reuse of the same key with a different request payload.

## Security Considerations

- Passwords are hashed before storage.
- JWTs have configured issuer, audience, algorithm, and expiry.
- Request bodies are size-limited and validated.
- SQL queries use parameters.
- Role and resource ownership checks protect sensitive operations.
- Audit records capture important actions.
- Secrets belong in environment variables, not source control.
- Production deployments should use HTTPS, restricted database access, secret management, backups, and controlled access to monitoring endpoints.

## Observability

- `GET /health/live` provides a basic liveness response.
- Pino HTTP records request metadata.
- `GET /metrics` exposes Prometheus-formatted application and Node.js metrics.
- HTTP request totals and durations are recorded by method, matched route, and response status.

The metrics endpoint should be restricted to trusted monitoring systems in production.

## Architecture and Limitations

The application uses a modular Express architecture with routes, middleware, services, and PostgreSQL queries. Booking and consultation operations use transactions where needed to maintain consistency.

Performance objectives, including p95 latency targets and support for 100,000 daily consultations, require representative load testing and production-like infrastructure validation. High availability and the stated availability objective require deployment, monitoring, backup, and recovery evidence; they should not be considered achieved from local tests alone.

## License

Add the license specified by the project owner or assignment requirements.
