# Healthcare Management System

Healthcare Management System with microservice architecture: Auth service (port 3001) + Main API (port 3000 or 3002). Optional **API Gateway** (port 3000) provides a single entry point.

## Architecture

**With API Gateway (recommended):**

```
                    ┌─────────────────────────────────────┐
                    │         API Gateway (3000)           │
                    │  /api/auth → Auth  /api → Main API   │
                    └──────────────┬──────────────┬────────┘
                                   │              │
         ┌────────────────────────┘              └────────────────────────┐
         ▼                                                                 ▼
┌──────────────────┐     ┌─────────┐                            ┌─────────────────┐
│  Auth Service    │────▶│ MongoDB │                            │   Main API      │
│  (port 3001)     │     │ (Users) │                            │  (port 3002)    │
└──────────────────┘     └─────────┘                            └─────────────────┘
         │                                                                  │
         │  Issues JWT                                            Verifies JWT
         └──────────────────────────┬───────────────────────────────────────┘
                                    │
                            ┌───────┴───────┐
                            │    Client     │  Single origin: http://localhost:3000
                            └───────────────┘
```

**Without gateway** (direct access): Auth on 3001, Main API on 3000.

## Project Structure

```
├── src/                    # Main API + API Gateway
│   ├── gateway.js          # API Gateway (proxies /api/auth → auth, /api → main)
│   ├── middleware/
│   │   └── verifyToken.js  # JWT verification for protected routes
│   └── server.js           # Main API
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
├── docker-compose.yml      # Run all services
└── Dockerfile              # Main API
```

## API Gateway (when using `npm run dev:all`)

Single base URL: **http://localhost:3000**

| Path | Proxied to | Description |
|------|------------|-------------|
| `GET /health` | Gateway | Aggregated health (auth + main status) |
| `/api/auth/*` | Auth service (3001) | Register, login, me, verify |
| `GET /api/auth/web/*` | Auth service (3001) | Google OAuth |
| `GET /api/*` | Main API (3002) | e.g. `/api/me`, future patients/admissions |

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

AuthService --> IssueJwt["Issue JWT to client"]
IssueJwt --> Client
Client --> SendBearer["Authorization: Bearer token"]
SendBearer --> Gateway
```

## Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| POST | …/api/auth/register | Register, returns JWT |
| POST | …/api/auth/login | Login, returns JWT |
| GET | …/api/auth/me | Current user (Bearer token) |
| POST | …/api/auth/verify | Validate token |
| GET | …/health | Health check (gateway: aggregated; main: single service) |
| GET | …/api/me | Validate token (Bearer) |

## Authentication Flow

1. **Register or login** via Auth: `POST …/api/auth/register` or `/login` (same origin when using gateway).
2. **Copy JWT** from response `data.token`.
3. **Call protected routes** with header: `Authorization: Bearer <token>`.
4. Main API verifies JWT using shared `JWT_SECRET` (no call to Auth service).

## Microservice Design Notes

- Gateway is only a routing edge and does not contain business logic.
- Auth service owns identity concerns (credentials, JWT issuing, token verification endpoint).
- Main API owns domain endpoints and validates JWT locally to avoid runtime coupling to auth-service availability.

## Environment Variables

**Auth service** (`services/auth-service/.env`):
- `PORT` (default 3001)
- `MONGODB_URI`
- `JWT_SECRET` (must match main API)

**Main API** (`.env`):
- `PORT` (default 3000 standalone; use 3002 when behind gateway)
- `JWT_SECRET` (must match auth-service)
- `ALLOWED_ORIGINS`

**Gateway** (`.env`, optional):
- `GATEWAY_PORT` or `PORT` (default 3000)
- `AUTH_SERVICE_URL` (default http://localhost:3001)
- `MAIN_SERVICE_URL` (default http://localhost:3002)
