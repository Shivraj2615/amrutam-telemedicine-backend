# Security Checklist and Threat Model

## 1. Security Objectives

The Amrutam Telemedicine Backend handles user accounts, doctor availability, consultation bookings, prescriptions, and potentially sensitive medical information.

The primary security objectives are:

- **Confidentiality:** Only authorized users can access protected information.
- **Integrity:** Unauthorized users cannot modify consultations, prescriptions, or booking records.
- **Availability:** Rate limiting, database connection limits, and operational monitoring help reduce service disruption.
- **Accountability:** Audit logs record important business actions for traceability.

## 2. Threat Model

| Threat | Potential impact | Mitigation |
|---|---|---|
| Unauthorized API access | Exposure of patient or doctor information | JWT authentication and role-based authorization |
| Password theft | Account compromise | Password hashing with bcrypt |
| Token manipulation | Unauthorized access | JWT signature verification with restricted algorithm, issuer, and audience |
| Brute-force login attempts | Account compromise or service abuse | Express rate limiting; consider stricter limits on authentication endpoints |
| SQL injection | Unauthorized database access or modification | Parameterized PostgreSQL queries |
| Unauthorized booking | Invalid or fraudulent consultations | Authenticated patient access, doctor validation, slot locking, and transactional booking |
| Duplicate booking requests | Duplicate consultations or inconsistent slot state | Idempotency keys and database transactions |
| Unauthorized prescription access | Exposure of medical information | Ownership and assigned-doctor authorization checks |
| Accidental disclosure through logs | Exposure of tokens or sensitive data | Redaction of authorization and cookie headers; avoid logging medical payloads |
| Denial of service | API degradation or unavailability | Rate limiting, request-size limits, and database connection limits |
| Database or application failure | Interrupted service or data loss | Database backups, recovery procedures, health monitoring, and operational alerts |
| Compromised secrets | Unauthorized access to application or database | Environment variables, restricted secret access, and secret rotation |

## 3. Security Controls Implemented

The application includes the following controls:

- Passwords are hashed before storage using bcrypt.
- Protected endpoints use JWT authentication.
- Role-based authorization restricts access to permitted operations.
- JWT verification checks the signing algorithm, issuer, and audience.
- Helmet applies HTTP security headers.
- CORS is configured through application settings.
- Express rate limiting restricts excessive requests.
- JSON request bodies have a size limit.
- Database operations use PostgreSQL parameterized queries where implemented.
- Booking operations use transactions and locking to reduce race conditions.
- Idempotency keys help prevent duplicate booking operations when requests are retried.
- Important booking and consultation changes are recorded in audit logs.
- The metrics endpoint can require a separate bearer token.
- Environment files are excluded from Git using `.gitignore`.

## 4. Security Controls Requiring Verification or Further Work

The following items must be reviewed or tested before production deployment:

- Enforce HTTPS at the deployment edge.
- Use a strong, randomly generated JWT secret and separate metrics token.
- Keep production secrets in a secret manager or the hosting platform's protected environment settings.
- Apply stricter rate limits to login and registration endpoints.
- Verify that every patient, doctor, and administrator endpoint enforces the correct ownership and role checks.
- Confirm that logs never include passwords, authorization tokens, prescription contents, or other sensitive medical data.
- Validate and constrain all user-supplied input.
- Restrict CORS to trusted frontend origins in production.
- Configure automated database backups and test restoration.
- Add alerting for elevated error rates, database failures, and unusual traffic.
- Run dependency vulnerability checks and address relevant findings.
- Test authorization failures, booking concurrency, and idempotency behavior.
- Establish a data-retention and deletion policy appropriate for applicable legal requirements.
- Review privacy and healthcare regulatory obligations before handling real patient data.

## 5. Secrets Management

The application uses environment variables for configuration and credentials.

Security requirements:

1. Never commit `.env`, `.env.test`, database passwords, or production tokens.
2. Keep `.env.example` limited to placeholder values.
3. Use different credentials for local development, testing, and production.
4. Rotate any secret that has been exposed.
5. Restrict access to production credentials to authorized personnel.

## 6. Privacy and Auditability

Audit logs should capture relevant business events, such as booking creation and consultation status changes, without unnecessarily copying medical details.

Access to audit logs must be restricted. Production deployments should also define retention, backup, and review procedures.

## 7. Availability and Recovery

Rate limiting and database connection limits provide basic protection against excessive load. They do not independently guarantee high availability.

A production deployment should include:

- Database backups and tested restoration procedures.
- Application and database health checks.
- Error-rate and latency monitoring.
- Appropriate database and infrastructure capacity.
- A recovery plan for application, database, and infrastructure failures.
- Load testing against the stated performance targets.

## 8. Verification Status and Limitations

Automated tests and GitHub Actions CI validate the behaviors covered by the test suite. They do not constitute a complete security audit or penetration test.

Docker deployment, production infrastructure, backup restoration, load testing, and high-availability behavior must be verified separately before claiming they have been tested.

No claim of regulatory compliance or a specific production availability level is made by this document.

## 9. Responsible Use

Use synthetic data during development and testing. Do not expose real patient information, production credentials, or confidential medical records in source control, test fixtures, screenshots, or public logs.
