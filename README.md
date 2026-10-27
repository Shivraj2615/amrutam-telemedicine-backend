# Amrutam Telemedicine Backend

A backend for a telemedicine platform supporting patient authentication, doctor discovery, appointment booking, consultation lifecycle management, and prescriptions. The application uses Node.js, Express.js, and PostgreSQL, with a focus on secure access, booking consistency, automated testing, and observability.

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Core Features](#core-features)
- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [API Endpoints](#api-endpoints)
- [Authentication and Authorization](#authentication-and-authorization)
- [Booking Reliability](#booking-reliability)
- [Security](#security)
- [Observability and Health Checks](#observability-and-health-checks)
- [Testing](#testing)
- [Continuous Integration](#continuous-integration)
- [Docker](#docker)
- [Scalability and Limitations](#scalability-and-limitations)

## Overview

The Amrutam Telemedicine Backend provides APIs for managing the main workflows of a telemedicine platform.

Patients can register, log in, discover doctors, view available appointment slots, and book consultations. Authorized users can access consultations and manage their lifecycle. Assigned doctors can create prescriptions according to the implemented consultation rules.

The backend uses PostgreSQL transactions, access control, idempotency handling, audit logging, automated tests, and application metrics to support data consistency and operational visibility.

## Tech Stack

| Category | Technology |
|---|---|
| Runtime | Node.js |
| Backend framework | Express.js |
| Database | PostgreSQL |
| Authentication | JSON Web Tokens (JWT) |
| Password hashing | bcrypt |
| Input validation | Zod |
| Security middleware | Helmet, CORS, express-rate-limit |
| Logging | Pino, pino-http |
| Metrics | Prometheus client (`prom-client`) |
| API documentation | OpenAPI, Swagger UI |
| Testing | Jest, Supertest |
| Version control | Git and GitHub |
| CI | GitHub Actions |
| Containerization | Docker and Docker Compose configuration |

## Architecture

The application follows a modular Express.js architecture.

```text
Client
  |
  v
Express Application
  |
  +-- Security and Logging Middleware
  |
  +-- Authentication and Authorization
  |
  +-- API Routes
  |     |
  |     +-- Authentication
  |     +-- Doctors and Availability
  |     +-- Bookings
  |     +-- Consultations
  |     +-- Prescriptions
  |
  +-- Services and Business Rules
  |
  +-- PostgreSQL Connection Pool
        |
        +-- Users and Profiles
        +-- Doctors and Availability Slots
        +-- Consultations and Prescriptions
        +-- Audit Logs
        +-- Idempotency Records
        +-- Outbox Events
```

Routes handle HTTP requests, middleware handles cross-cutting concerns, services implement business logic, and PostgreSQL stores application data.

## Core Features

### Authentication and Access Control

- Patient registration and login.
- Password hashing with bcrypt.
- JWT-based authentication.
- Role-based access control for patients, doctors, and administrators.
- Resource ownership and assigned-doctor checks on protected operations.

### Doctor Discovery

- List and search doctors.
- Filter by specialization and date where supported.
- Paginate doctor results.
- Retrieve available appointment slots for a doctor.

### Appointment Booking

- Authenticated patient booking.
- Doctor and availability-slot validation.
- PostgreSQL transactions for booking operations.
- Slot locking to reduce conflicting concurrent bookings.
- Idempotency keys to support safe request retries.
- Audit logging and outbox event recording for relevant booking operations.

### Consultation Lifecycle

- List consultations visible to the authenticated user.
- Validate consultation status transitions.
- Restrict status updates based on user role and business rules.
- Record relevant lifecycle changes in audit logs.

### Prescriptions

- Create prescriptions subject to doctor assignment and consultation-state rules.
- Restrict prescription access to authorized users.
- Enforce a database uniqueness constraint to prevent multiple prescriptions for the same consultation.

### Observability

- HTTP request logging with Pino.
- Prometheus-format application metrics.
- Liveness endpoint.
- Centralized error handling.

## Prerequisites

Install the following before running the application locally:

- Node.js 22 or a compatible version supported by the project.
- npm.
- PostgreSQL.
- Git.

Docker is optional for local development if PostgreSQL is installed separately.

## Local Setup

### 1. Clone the repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd amrutam-telemedicine-backend
```

Replace the placeholder with the actual URL of your GitHub repository.

### 2. Install dependencies

If `package-lock.json` is present, use:

```bash
npm ci
```

Alternatively, use `npm install` when setting up or updating dependencies.

### 3. Create the database

Create a PostgreSQL database named `amrutam` using your PostgreSQL client.

For example, when connected as a database administrator:

```sql
CREATE DATABASE amrutam;
```

Apply the schema from the project root:

```bash
psql -d amrutam -f database/schema.sql
```

If PostgreSQL requires a specific host, username, or password, configure your connection accordingly.

**Important:** The schema file is intended to initialize the required tables and indexes. Apply it to the intended development database, and do not run test setup against a production database.

### 4. Configure environment variables

Create a `.env` file in the project root:

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/amrutam
JWT_SECRET=replace_with_a_long_random_secret
CORS_ORIGIN=http://localhost:3000
METRICS_TOKEN=replace_with_a_separate_random_secret
```

### 5. Start the development server

```bash
npm run dev
```

The API should be available at:

`http://localhost:3000`


## Environment Variables

| Variable | Purpose |
|---|---|
| `PORT` | HTTP server port |
| `NODE_ENV` | Runtime environment |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing and verification secret |
| `CORS_ORIGIN` | Allowed frontend origin |
| `METRICS_TOKEN` | Optional/configured bearer token for metrics access |


## Running the Application

Start the development server:

```bash
npm run dev
```

Run the automated tests:

```bash
npm test
```

The exact commands depend on the scripts defined in `package.json`.

## API Documentation

Open Swagger UI after starting the server:

`http://localhost:3000/api-docs`

The OpenAPI specification is maintained in `openapi.yaml`.

Swagger UI provides an interactive interface for exploring the API operations documented in that specification. Confirm that the specification reflects the current implementation before relying on it as a complete API contract.

## API Endpoints

The following table summarizes the main application endpoints.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health/live` | Application liveness check |
| `GET` | `/metrics` | Prometheus metrics |
| `POST` | `/api/v1/auth/register` | Register a patient |
| `POST` | `/api/v1/auth/login` | Authenticate a user |
| `GET` | `/api/v1/doctors` | Search and list doctors |
| `GET` | `/api/v1/doctors/:doctorId/slots` | List available slots for a doctor |
| `POST` | `/api/v1/bookings` | Book a consultation |
| `GET` | `/api/v1/consultations` | List consultations visible to the caller |
| `PATCH` | `/api/v1/consultations/:consultationId/status` | Update consultation status |
| `POST` | `/api/v1/consultations/:consultationId/prescriptions` | Create a prescription |
| `GET` | `/api/v1/consultations/:consultationId/prescriptions` | Retrieve a prescription |

Protected application endpoints require a valid bearer token unless the endpoint is explicitly public.

## Authentication and Authorization

After successful login, send the JWT in the `Authorization` header for protected requests:

```http
Authorization: Bearer YOUR_JWT
```

The application verifies the JWT signature and configured token properties, including the permitted algorithm, issuer, audience, and expiry.

Authorization checks restrict protected operations according to user roles and resource ownership. For example, prescription access is restricted to authorized users under the implemented access rules.

## Booking Reliability

Booking operations use a PostgreSQL transaction to coordinate consultation creation, availability-slot reservation, and related records.

The implementation uses:

- Slot locking to reduce the risk of concurrent requests reserving the same slot.
- Transactional database operations to keep related changes consistent.
- Idempotency records to recognize retried requests.
- Request-payload comparison to reject reuse of an idempotency key with a different payload.
- Audit logging and outbox event recording for relevant operations.

Clients should send an `Idempotency-Key` header when creating a booking.

Example:

```http
POST /api/v1/bookings
Authorization: Bearer YOUR_JWT
Idempotency-Key: unique-client-generated-key
Content-Type: application/json
```

Idempotency improves retry safety but does not eliminate the need for database constraints, error handling, and concurrency testing.

## Security

The application includes several security controls:

- Password hashing with bcrypt.
- JWT authentication and role-based authorization.
- Helmet security headers.
- Configurable CORS.
- Express rate limiting.
- Request body-size limits.
- Zod validation where implemented.
- Parameterized PostgreSQL queries where implemented.
- Resource ownership checks on protected operations.
- Redaction of selected sensitive HTTP headers from request logs.
- Audit records for relevant business actions.
- Configurable protection for the metrics endpoint.

### Production Security Recommendations

Before handling real patient data, review and verify the following:

- Enforce HTTPS.
- Use strong, separate secrets for JWT signing and metrics access.
- Restrict database access and production credentials.
- Configure CORS to allow only trusted frontend origins.
- Apply stricter rate limits to authentication endpoints.
- Confirm that logs never contain passwords, tokens, or sensitive medical information.
- Validate authorization and ownership checks across every protected route.
- Configure automated database backups and test restoration.
- Run dependency vulnerability checks and security testing.
- Define appropriate data-retention and privacy practices.
- Review applicable healthcare and privacy regulations before production use.

See [`SECURITY.md`](SECURITY.md) for the threat model, security checklist, and additional verification requirements.

## Observability and Health Checks

### Liveness

`GET /health/live`

Provides a basic indication that the application process is responding. It should not be interpreted as proof that the database or every dependency is healthy.

### Metrics

`GET /metrics`

Exposes Prometheus-formatted metrics, including:

- Default Node.js/process metrics.
- HTTP request totals.
- HTTP request duration observations.
- Labels for HTTP method, matched route, and response status.

Restrict access to this endpoint in production to trusted monitoring systems.

### Logging

Pino HTTP provides structured request logs. Selected sensitive request headers are redacted, and query strings are excluded from the serialized request URL.

Production deployments should additionally review log retention, access controls, error reporting, and sensitive-data handling.

## Testing

The project uses Jest and Supertest for automated tests.

Run the test suite:

```bash
npm test
```

Configure `.env.test` to use a dedicated test database, for example `amrutam_test`.

Never point the automated test suite at a production database. The integration tests may create and delete test records, so the database must be isolated for testing.

The test suite covers areas including:

- Health checks.
- Database configuration.
- Doctor endpoints.
- Booking behavior and idempotency.
- Consultation lifecycle rules.
- Metrics endpoint behavior.

The exact coverage is determined by the tests present in the repository.

## Continuous Integration

GitHub Actions runs the automated test suite on pushes to `main` and pull requests targeting `main`.

The CI workflow:

1. Checks out the repository.
2. Sets up Node.js.
3. Starts a PostgreSQL service for testing.
4. Installs dependencies.
5. Initializes the test database schema.
6. Runs the automated tests.

A passing CI workflow confirms that the tests covered by the suite pass in that environment. It does not replace load testing, penetration testing, or production infrastructure validation.

## Docker

The repository includes a Dockerfile and Docker Compose configuration for containerized execution.

Docker support has not been locally verified if Docker Desktop is unavailable in the development environment.

Before relying on the configuration, verify:

- The API container builds successfully.
- PostgreSQL becomes healthy before the API depends on it.
- Environment variables and secrets are configured correctly.
- The schema is initialized as intended.
- The API can connect to PostgreSQL from within the Compose network.
- Persistent database storage works as expected.
- Container startup, shutdown, and recovery behave correctly.

Do not remove existing database volumes or data when testing the configuration.

## Scalability and Limitations

The implementation includes foundational practices for a reliable backend, such as connection pooling, transactions, booking idempotency, rate limiting, and request metrics.

However, these features alone do not demonstrate that the system can sustain 100,000 daily consultations, meet a p95 read latency below 200 ms, meet a p95 write latency below 500 ms, or achieve 99.95% availability.

Those objectives require representative load testing, query and index analysis, production-like infrastructure, monitoring, backup and recovery validation, and appropriate deployment architecture.

The current project should be treated as an implementation of the requested backend workflows with automated test coverage, not as proof of a fully production-validated telemedicine service.
