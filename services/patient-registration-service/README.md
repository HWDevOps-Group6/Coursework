# Patient Registration Service (Microservice)

Patient domain microservice for registration, records, visit updates, prescriptions, nursing notes, and appointment scheduling.

## Endpoints

### Patient Records

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/patients/register | Register a new patient |
| GET | /api/patients/records | List all patient records |
| GET | /api/patients/records/:id | Get a single patient record |
| PATCH | /api/patients/records/:id/visits | Append visit history |
| PATCH | /api/patients/records/:id/prescriptions | Append prescription details |
| PATCH | /api/patients/records/:id/nursing-notes | Append nursing notes |

### Scheduling & Appointments

| Method | Path | Description |
|--------|------|-------------|
| PUT | /api/patients/doctors/:doctorId/schedule | Create/update doctor schedule |
| GET | /api/patients/doctors/:doctorId/schedule | Get doctor schedule |
| GET | /api/patients/doctors/:doctorId/availability | Get doctor availability for a date |
| POST | /api/patients/records/:id/appointments | Book an appointment for a patient |
| GET | /api/patients/records/:id/appointments | List patient appointments |

### Health

| Method | Path |
|--------|------|
| GET | /health |

## Run locally

```bash
cd services/patient-registration-service
npm install
PORT=3003 npm run dev
```

From project root (recommended for full system):

```bash
npm run dev:patient-reg
```

## Run as Docker image

Build image from project root:

```bash
docker build -f services/patient-registration-service/Dockerfile -t patient-registration-service:latest .
```

Run container:

```bash
docker run --name patient-registration-service \
	--env-file .env \
	-p 3003:3003 \
	patient-registration-service:latest
```

## Other services

- Exposed through the API Gateway at `/api/patients/*`.
- Uses JWT-based auth and role checks for protected routes.
- Should share the same `JWT_SECRET` as auth-service.
