# Healthcare Management System

Healthcare Management System with NodeJS REST API, MongoDB, and JWT-based authentication.

## Architecture

This system follows a service-based architecture with:
- **Node.js** and **Express.js** for the REST API
- **MongoDB** for data storage
- **JWT** for stateless authentication
- **bcrypt** for password hashing
- **Joi** for input validation
- **Passport.js** with Google OAuth 2.0 (Sign in with Google)

## Project Structure

```
├── src/
│   ├── config/
│   │   ├── database.js          # MongoDB connection
│   │   └── passport.js          # Google OAuth strategy
│   ├── middleware/
│   │   ├── auth.js              # JWT authentication middleware
│   │   └── validation.js        # Request validation middleware
│   ├── models/
│   │   └── User.js              # User MongoDB model
│   ├── routes/
│   │   └── authRoutes.js        # Authentication routes
│   ├── services/
│   │   └── authService.js       # Authentication business logic
│   ├── utils/
│   │   └── jwt.js               # JWT utilities
│   └── server.js                # Express app entry point
├── docs/
│   └── Drafts/                  # Architecture documentation
├── package.json
└── README.md
```

## Setup

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (running locally or connection string)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory:
```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/healthcare_db
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

3. Start the server:
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

## Authentication Workflow

### Registration

**Endpoint:** `POST /api/auth/register`

**Request Body:**
```json
{
  "email": "doctor@hospital.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "role": "doctor",
  "phoneNumber": "+1234567890",
  "department": "cardiology"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "...",
      "email": "doctor@hospital.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "doctor",
      "department": "cardiology"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "User registered successfully"
}
```

### Login

**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "doctor@hospital.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "...",
      "email": "doctor@hospital.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "doctor"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "Login successful"
}
```

### Sign in with Google

**Endpoint:** `GET /api/auth/google`

Redirects to Google sign-in. After successful authentication, redirects to `GOOGLE_REDIRECT_AFTER_LOGIN` with JWT in query: `?token=<JWT>`.

**Setup:**
1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Google+ API (or People API)
3. Create OAuth 2.0 credentials (Web application)
4. Add authorized redirect URI: `http://localhost:3000/api/auth/google/callback`
5. Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` to `.env`

See `ENV_SETUP.md` for full configuration.

### Get Current User

**Endpoint:** `GET /api/auth/me`

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "...",
      "email": "doctor@hospital.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "doctor"
    }
  },
  "message": "User retrieved successfully"
}
```

## User Roles

The system supports four roles:
- **clerk**: Administrative staff
- **doctor**: Full patient access, medical records
- **nurse**: Patient care updates, monitoring
- **paramedic**: Patient intake, emergency admissions

## Security Features

- JWT-based stateless authentication
- Password hashing with bcrypt (12 salt rounds)
- Input validation with Joi
- Rate limiting (5 requests/15min for auth, 100 requests/15min for general API)
- CORS protection
- Security headers with Helmet
- Password requirements: min 8 chars, uppercase, lowercase, number, special character

## API Flow

1. **Registration/Login**: User credentials → Auth Service → JWT token generated
2. **Protected Routes**: Request with JWT → Auth Middleware validates → RBAC checks permissions → Service executes

## Error Responses

All errors follow this format:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": [] // Optional, for validation errors
  }
}
```

## Development

### Environment Variables

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT signing
- `JWT_EXPIRES_IN`: Token expiration time (default: 24h)
- `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Google OAuth credentials
- `GOOGLE_CALLBACK_URL`: OAuth callback URL (must match Google Console)
- `GOOGLE_REDIRECT_AFTER_LOGIN`: Where to redirect after sign-in (JWT in ?token=)

## Documentation

See `docs/Drafts/` for detailed architecture documentation:
- `architecture-overview.md` - System architecture
- `workflows.md` - API flow diagrams
- `security.md` - Security design
- `mongodb-schema.md` - Database schema
- `justification.md` - Architecture justifications
