# Auth Service (Microservice)

Authentication microservice - register, login, Google OAuth, JWT issuance.

## Endpoints

### Headless (API-only, no browser)

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Register user, returns JWT |
| POST | /api/auth/login | Login, returns JWT |
| GET | /api/auth/me | Current user (requires Bearer token) |
| POST | /api/auth/verify | Validate token (for other services) |

### Web (browser redirect flow, optional)

Only available when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set:

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/auth/web/google | Start Google OAuth (redirects to Google) |
| GET | /api/auth/web/google/callback | OAuth callback |
| GET | /api/auth/web/google/failure | OAuth failure handler |

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

Notes:
- If MongoDB runs on your host machine, set `MONGODB_URI=mongodb://host.docker.internal:27017/healthcare_db`.
- If MongoDB runs in another container, use the Mongo container/service name in `MONGODB_URI`.
- Health endpoint remains available at `http://localhost:3001/health`.

## Environment

- `PORT` - default 3001
- `MONGODB_URI` - MongoDB connection
- `JWT_SECRET` - Must match main API and other services
- `GOOGLE_*` - For Google OAuth

## Other services

Use the same `JWT_SECRET` and verify tokens either:
- **Locally**: `jwt.verify(token, process.env.JWT_SECRET)` 
- **Via API**: `POST /api/auth/verify` with `Authorization: Bearer <token>`
