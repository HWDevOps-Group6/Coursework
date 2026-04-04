# Environment Variables Setup

Create a `.env` file in the root directory of the project with the following variables:

## Variable Descriptions

### PORT

- **Description**: Port number for the Express server
- **Default**: `3000`
- **Example**: `PORT=3000`
- **Required**: No (has default)

### NODE_ENV

- **Description**: Environment mode (development, production, test)
- **Default**: `development`
- **Example**: `NODE_ENV=development`
- **Required**: No (has default)
- **Note**: Affects error message verbosity (production hides detailed errors)

### MONGODB_URI

- **Description**: MongoDB connection string used by local development services
- **Example**: `MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/healthcare_db?retryWrites=true&w=majority`
- **Required**: Yes for local development and tests that hit MongoDB

### JWT_SECRET

- **Description**: Secret key used to sign and verify JWT tokens
- **Default**: None
- **Example**: `JWT_SECRET=your-super-secret-jwt-key-change-this-in-production`
- **Required**: **Yes**
- **Security Note**:
  - Use a strong, random string (at least 32 characters)
  - Never commit this to version control
  - Use different secrets for development and production
  - Generate with: `openssl rand -base64 32`

### PATIENT_ID_HASH_SALT

- **Description**: Salt used when hashing patient Emirates IDs before storage and duplicate checks
- **Default**: None
- **Example**: `PATIENT_ID_HASH_SALT=your-random-patient-id-salt`
- **Required**: **Yes** for patient registration service deployments
- **Security Note**:
  - Use a strong, random string (at least 32 characters)
  - Keep it stable for the same environment
  - Never commit the real value to version control
  - If you change it later, existing patient hashes will no longer match
  - Generate with: `openssl rand -base64 32`

### JWT_EXPIRES_IN

- **Description**: JWT token expiration time
- **Default**: `24h`
- **Example**: `JWT_EXPIRES_IN=24h`
- **Required**: No (has default)
- **Format**:
  - Time format: `24h`, `7d`, `30m`
  - Examples: `1h`, `2d`, `30m`, `3600` (seconds)

### GOOGLE_CLIENT_ID

- **Description**: Google OAuth 2.0 Client ID (from Google Cloud Console)
- **Example**: `GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com`
- **Required**: Yes (for Google sign-in)
- **Note**: Create credentials at <https://console.cloud.google.com/apis/credentials>

### GOOGLE_CLIENT_SECRET

- **Description**: Google OAuth 2.0 Client Secret
- **Example**: `GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxx`
- **Required**: Yes (for Google sign-in)

### GOOGLE_CALLBACK_URL

- **Description**: Full URL for OAuth callback (must match Google Console exactly)
- **Default**: `http://localhost:3001/api/auth/web/google/callback`
- **Example**: `GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/web/google/callback`
- **Required**: No (uses default for localhost)

### GOOGLE_REDIRECT_AFTER_LOGIN

- **Description**: URL to redirect users after successful Google sign-in (JWT sent as ?token=xxx)
- **Default**: `http://localhost:5173`
- **Example**: `GOOGLE_REDIRECT_AFTER_LOGIN=http://localhost:5173/auth/callback`
- **Required**: No

### ALLOWED_ORIGINS

- **Description**: Comma-separated list of allowed CORS origins
- **Default**: `['http://localhost:3000']`
- **Example**: `ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,https://yourdomain.com`
- **Required**: No (has default)
- **Note**:
  - Separate multiple origins with commas (no spaces)
  - Include all frontend URLs that will access the API
  - For production, use your actual domain

### PATIENT_REG_SERVICE_URL

- **Description**: Gateway target URL for patient registration service
- **Default**: `http://localhost:3003`
- **Example**: `PATIENT_REG_SERVICE_URL=http://localhost:3003`
- **Required**: No (has default in gateway)

### DIAGNOSTICS_VITALS_SERVICE_URL

- **Description**: Gateway target URL for diagnostics and vitals service
- **Default**: `http://localhost:3004`
- **Example**: `DIAGNOSTICS_VITALS_SERVICE_URL=http://localhost:3004`
- **Required**: No (has default in gateway)

### PATIENT_REG_SERVICE_PORT

- **Description**: Port for patient registration service when running standalone
- **Default**: `3003`
- **Example**: `PATIENT_REG_SERVICE_PORT=3003`
- **Required**: No (has default)

## Example .env File

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# MongoDB Configuration
# Local MongoDB
MONGODB_URI=mongodb://localhost:27017/healthcare_db

# Or MongoDB Atlas (cloud)
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/healthcare_db?retryWrites=true&w=majority

# JWT Configuration
# Generate a secure secret: openssl rand -base64 32
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-minimum-32-characters
JWT_EXPIRES_IN=24h

# Patient ID hashing
# Generate a secure salt: openssl rand -base64 32
PATIENT_ID_HASH_SALT=your-random-patient-id-salt

# CORS Configuration
# Add all frontend URLs that need to access the API
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:8080

# Gateway routing targets
PATIENT_REG_SERVICE_URL=http://localhost:3003
DIAGNOSTICS_VITALS_SERVICE_URL=http://localhost:3004

# Patient registration service
PATIENT_REG_SERVICE_PORT=3003

# Diagnostics & vitals service
DIAGNOSTICS_VITALS_SERVICE_PORT=3004

# Google OAuth (for "Sign in with Google")
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/web/google/callback
GOOGLE_REDIRECT_AFTER_LOGIN=http://localhost:5173
```

## Quick Setup

1. Copy the example above into a new `.env` file
2. Update `MONGODB_URI` with your MongoDB connection string
3. Generate a secure `JWT_SECRET`:
   ```bash
   openssl rand -base64 32
   ```
4. Generate a stable `PATIENT_ID_HASH_SALT` for the patient registration service:
  ```bash
  openssl rand -base64 32
  ```
5. Update `ALLOWED_ORIGINS` with your frontend URLs
6. Save the file

## Security Best Practices

1. **Never commit `.env` to version control** - It's already in `.gitignore`
2. **Use different secrets for different environments** - Development vs Production
3. **Use strong JWT secrets** - At least 32 random characters
4. **Keep `PATIENT_ID_HASH_SALT` stable** - Rotating it breaks matching against existing patient hashes
5. **Restrict CORS origins in production** - Only allow your actual domains
6. **Use environment-specific MongoDB URIs** - Separate databases for dev/prod

## Troubleshooting

### MongoDB Connection Issues

- Ensure MongoDB is running: `mongod` or check MongoDB service
- Verify connection string format
- Check network/firewall settings for remote MongoDB

### JWT Errors

- Ensure `JWT_SECRET` is set and not empty
- Use the same secret for token generation and verification
- Check token expiration time format

### CORS Errors

- Add your frontend URL to `ALLOWED_ORIGINS`
- Ensure no spaces in comma-separated list
- Include protocol (http:// or https://)

## Kubernetes rollout notes

The first Kubernetes implementation now lives under [k8s/README.md](k8s/README.md).

For cluster deployment:

- the gateway is the only externally exposed application entry point
- internal services stay on cluster-internal `Service` objects
- MongoDB is expected to stay external in MongoDB Atlas for this rollout
- Jenkins creates the runtime Kubernetes secret from Jenkins credentials during deployment
