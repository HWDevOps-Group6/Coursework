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

## Environment

- `PORT` - default 3001
- `MONGODB_URI` - MongoDB connection
- `JWT_SECRET` - Must match main API and other services
- `GOOGLE_*` - For Google OAuth

## Other services

Use the same `JWT_SECRET` and verify tokens either:
- **Locally**: `jwt.verify(token, process.env.JWT_SECRET)` 
- **Via API**: `POST /api/auth/verify` with `Authorization: Bearer <token>`
