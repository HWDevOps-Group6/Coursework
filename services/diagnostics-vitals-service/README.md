# Diagnostics & Vitals Service (Microservice)

Diagnostics and vitals microservice for importing diagnostic results, querying reports, verifying records, and recording patient vitals.

## Endpoints

### Vitals

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/vitals/:patientId | Record patient vitals |
| GET | /api/vitals/:patientId | Retrieve recent patient vitals |

### Diagnostics

| Method | Path | Description |
|--------|------|-------------|
| POST | /import/:machineType | Import diagnostic results from a machine type |
| POST | /import-all | Import from all configured machine sources |
| GET | /stats | Get diagnostic statistics |
| GET | /critical | Get critical diagnostic results |
| GET | / | List diagnostics with query filters |
| GET | /machine/:machineType | Get diagnostics by machine type |
| GET | /patient/:patientId | Get diagnostics by patient |
| GET | /:id | Get diagnostic result by id |
| PATCH | /:id/verify | Verify a diagnostic result |
| DELETE | /:id | Archive/delete a diagnostic result |

### Health

| Method | Path |
|--------|------|
| GET | /health |

## Run locally

This service uses dependencies installed at project root.

From project root:

```bash
npm install
npm run dev:diagnostics-vitals
```

Or run directly:

```bash
node services/diagnostics-vitals-service/server.js
```

## Run as Docker image

Build image from project root:

```bash
docker build -f services/diagnostics-vitals-service/Dockerfile -t diagnostics-vitals-service:latest .
```

Run container:

```bash
docker run --name diagnostics-vitals-service \
  --env-file .env \
  -p 3004:3004 \
  diagnostics-vitals-service:latest
```

## Other services

- Exposed through the API Gateway at `/api/diagnostics/*` and `/api/vitals/*`.
- Uses JWT-based auth and role checks for protected routes.
- Should share the same `JWT_SECRET` as auth-service.