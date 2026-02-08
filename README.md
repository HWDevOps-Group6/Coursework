# Healthcare Management System

Healthcare Management System with microservice architecture: Auth service (port 3001) + Main API (port 3000).

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────┐
│   Client    │────▶│  Auth Service    │────▶│ MongoDB │
│             │     │  (port 3001)     │     │ (Users) │
└─────────────┘     └──────────────────┘     └─────────┘
       │                        │
       │  JWT in header         │  Issues JWT
       ▼                        │
┌─────────────┐                 │
│  Main API   │◀────────────────┘
│ (port 3000) │   Verifies JWT locally
└─────────────┘
```

## Project Structure

```
├── src/                    # Main API (patients, admissions, etc.)
│   ├── middleware/
│   │   └── verifyToken.js  # JWT verification for protected routes
│   └── server.js
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

## Quick Start

### Option 1: Run locally

**Single command** (auth + API):
```bash
npm install
npm run dev:all
```

**Or separate terminals:**
```bash
# Terminal 1
npm run dev:auth

# Terminal 2
npm run dev
```

**Or manual:**
```bash
# Auth service
cd services/auth-service && cp .env.example .env && npm install && PORT=3001 npm run dev

# Main API (other terminal)
cp .env.example .env && npm install && npm run dev
```

**MongoDB** must be running (local or Atlas). Auth service needs `MONGODB_URI` in `services/auth-service/.env`.

### Option 2: Docker Compose

```bash
# Create .env with JWT_SECRET (and optional GOOGLE_* vars)
echo "JWT_SECRET=your-secret" > .env
docker-compose up
```

- Auth: <http://localhost:3001>
- API: <http://localhost:3000>
- MongoDB: localhost:27017

## Auth Service Endpoints

### Headless (default)

| Method | URL | Description |
|--------|-----|-------------|
| POST | http://localhost:3001/api/auth/register | Register, returns JWT |
| POST | http://localhost:3001/api/auth/login | Login, returns JWT |
| GET | http://localhost:3001/api/auth/me | Current user (Bearer token) |
| POST | http://localhost:3001/api/auth/verify | Validate token |

### Web / Google OAuth (optional)

Only when `GOOGLE_*` env vars are set:

| Method | URL |
|--------|-----|
| GET | http://localhost:3001/api/auth/web/google |

## Main API

| Method | URL | Description |
|--------|-----|-------------|
| GET | http://localhost:3000/health | Health check |
| GET | http://localhost:3000/api/me | Validate token (Bearer) |

## Authentication Flow

1. **Register or login** via Auth service: `POST http://localhost:3001/api/auth/register` or `/login`
2. **Copy JWT** from response `data.token`
3. **Call protected routes** with header: `Authorization: Bearer <token>`
4. Main API verifies JWT using shared `JWT_SECRET` (no call to Auth service)

## Environment Variables

**Auth service** (`services/auth-service/.env`):
- `PORT` (default 3001)
- `MONGODB_URI`
- `JWT_SECRET` (must match main API)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (optional)

**Main API** (`.env`):
- `PORT` (default 3000)
- `JWT_SECRET` (must match auth-service)
- `ALLOWED_ORIGINS`

## Documentation

- `ENV_SETUP.md` – Environment configuration
- `services/auth-service/README.md` – Auth service details
- `docs/` – Architecture documentation
