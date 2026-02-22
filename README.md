# Healthcare Management System

Healthcare Management System with microservice architecture: Auth service, business logic in main service, API gateway to loosely connect services

## Project Structure

```
├── src/                    # Main API + API Gateway
│   ├── gateway.js          # API Gateway (proxies /api/auth → auth, /api → main)
│   ├── middleware/
│   │   └── verifyToken.js  # JWT verification for protected routes
│   └── server.js           # Main API (patient records endpoints)
├── services/
│   └── auth-service/       # Auth microservice
│       ├── src/
│       │   ├── config/
│       │   ├── middleware/
│       │   ├── models/
│       │   ├── routes/
│       │   ├── services/
│       │   ├── utils/
│       │   └── server.js
│       ├── package.json
│       └── README.md
│   └── patient-registration-service/
│       ├── src/
│       │   ├── config/
│       │   ├── middleware/
│       │   ├── models/
│       │   └── server.js
│       └── package.json
└── shared/
```

## Auth Service Endpoints

```mermaid
flowchart TD
Client[Client_App] --> Gateway["Gateway :3000"]

Gateway --> GWHealth["GET /health"]
Gateway --> GWAuthRegister["POST /api/auth/register"]
Gateway --> GWAuthLogin["POST /api/auth/login"]
Gateway --> GWAuthMe["GET /api/auth/me (Bearer token)"]
Gateway --> GWAuthVerify["POST /api/auth/verify"]
Gateway --> GWMainMe["GET /api/me (Bearer token)"]

GWAuthRegister --> AuthService["Auth_Service :3001"]
GWAuthLogin --> AuthService
GWAuthMe --> AuthService
GWAuthVerify --> AuthService

GWMainMe --> MainService["Main_API :3002"]
Gateway --> GWPatientReg["POST /api/patients/register"]
Gateway --> GWPatientRecords["GET/PATCH /api/patients/records/*"]
GWPatientReg --> PatientRegService["Patient_Registration_Service :3003"]
GWPatientRecords --> PatientRegService["Patient_Registration_Service :3003"]

AuthService --> IssueJwt["Issue JWT to client"]
IssueJwt --> Client
Client --> SendBearer["Authorization: Bearer token"]
SendBearer --> Gateway
```

| Method | URL | Description |
|--------|-----|-------------|
| POST | …/api/auth/register | Register, returns JWT |
| POST | …/api/auth/login | Login, returns JWT |
| GET | …/api/auth/me | Current user (Bearer token) |
| POST | …/api/auth/verify | Validate token |
| GET | …/health | Health check (gateway: aggregated; main: single service) |
| GET | …/api/me | Validate token (Bearer) |
| POST | …/api/patients/register | Register patient at service point (clerk role only) |
| GET | …/api/patients/records | Retrieve patient records (doctor, nurse, paramedic) |
| GET | …/api/patients/records/:id | Retrieve a single patient record (doctor, nurse, paramedic) |
| PATCH | …/api/patients/records/:id/visits | Append visit history with diseases/referral details (doctor, nurse, paramedic) |
| PATCH | …/api/patients/records/:id/nursing-notes | Append nursing chart details (nurse write; doctor, nurse, paramedic read via records endpoints) |

## Authentication Flow

1. **Register or login** via Auth: `POST …/api/auth/register` or `/login` (same origin when using gateway).
2. **Copy JWT** from response `data.token`.
3. **Call protected routes** with header: `Authorization: Bearer <token>`.
4. Main API verifies JWT using shared `JWT_SECRET` (no call to Auth service).
5. `POST …/api/patients/register` requires role `clerk` and accepts only:
   - Identity and basic details: `emiratesId`, `firstName`, `lastName`, `dateOfBirth`, `gender`, `phoneNumber`, `address`, `entryRoute`, `servicePoint`
   - Clinical intake notes: `knownDiseases` (string array), `complaints` (string array)
   - `entryRoute` is required and must be one of: `OPD`, `A&E`
6. `GET …/api/patients/records`, `GET …/api/patients/records/:id`, and `PATCH …/api/patients/records/:id/visits` require role `doctor`, `nurse`, or `paramedic`.
7. `PATCH …/api/patients/records/:id/nursing-notes` requires role `nurse` and appends `{ medicines[], treatmentDetails, intakeOutput, recordedAt }`.
8. Nursing notes are append-only and returned as `nursingNotes` in patient record responses for doctor/nurse/paramedic.
9. Patient registrations are persisted by the patient registration service in the MongoDB `patients` collection (separate from auth `users`).
10. Duplicate prevention uses a SHA-256 hash of normalized `emiratesId`; only the hash is stored and it is unique per patient.
11. Patient `id` values are assigned sequentially by the patient registration service (`"1"`, `"2"`, `"3"`, ...).
12. Visit updates are append-only via `visitHistory` entries and preserve prior entries for auditability.

## Microservice Design Notes

- Gateway is only a routing edge and does not contain business logic.
- Auth service owns identity concerns (credentials, JWT issuing, token verification endpoint).
- Patient registration service owns `POST /api/patients/register` and all `/api/patients/records*` endpoints.
- Main API remains focused on non-registration domain endpoints and validates JWT locally to avoid runtime coupling to auth-service availability.

## Environment Variables

**Auth service** (`services/auth-service/.env`):
- `PORT` (default 3001)
- `MONGODB_URI`
- `JWT_SECRET` (must match main API)

**Main API** (`.env`):
- `PORT` (default 3000 standalone; use 3002 when behind gateway)
- `MONGODB_URI` (MongoDB connection string for patient/domain data)
- `JWT_SECRET` (must match auth-service)
- `PATIENT_ID_HASH_SALT` (optional salt for hashing `emiratesId`)
- `ALLOWED_ORIGINS`

**Gateway** (`.env`, optional):
- `GATEWAY_PORT` or `PORT` (default 3000)
- `AUTH_SERVICE_URL` (default http://localhost:3001)
- `MAIN_SERVICE_URL` (default http://localhost:3002)
- `PATIENT_REG_SERVICE_URL` (default http://localhost:3003)

**Patient Registration Service** (`.env`):
- `PATIENT_REG_SERVICE_PORT` or `PORT` (default 3003)
- `MONGODB_URI` (MongoDB connection string for patient data)
- `JWT_SECRET` (must match auth-service)
- `PATIENT_ID_HASH_SALT` (optional salt for hashing `emiratesId`)
- `ALLOWED_ORIGINS`
