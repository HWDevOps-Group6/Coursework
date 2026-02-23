# Auth Service (Microservice)

Authentication microservice - register, login, JWT issuance.

## Endpoints

### Headless

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Register user, returns JWT |
| POST | /api/auth/login | Login, returns JWT |
| GET | /api/auth/me | Current user (requires Bearer token) |
| POST | /api/auth/verify | Validate token (for other services) |

### Health

| Method | Path |
|--------|------|
| GET | /health |

## Run locally

```bash
cd services/auth-service
cp .env.example .env   # Edit with your values
npm install
PORT=3001 npm run dev
```

## Run as Docker image

Build image:

```bash
cd services/auth-service
docker build -t auth-service:latest .
```

Run container:

```bash
docker run --name auth-service \
  --env-file .env \
  -p 3001:3001 \
  auth-service:latest
```

## Other services

Use the same `JWT_SECRET` and verify tokens either:
- **Locally**: `jwt.verify(token, process.env.JWT_SECRET)` 
- **Via API**: `POST /api/auth/verify` with `Authorization: Bearer <token>`
