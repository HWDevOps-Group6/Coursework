# Environment Variables Setup

Create a `.env` file in the root directory of the project with the following variables:

## Required Environment Variables

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/healthcare_db

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

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
- **Description**: MongoDB connection string
- **Default**: None
- **Example**: `MONGODB_URI=mongodb://localhost:27017/healthcare_db`
- **Required**: **Yes**
- **Note**: 
  - For local MongoDB: `mongodb://localhost:27017/healthcare_db`
  - For MongoDB Atlas: `mongodb+srv://username:password@cluster.mongodb.net/healthcare_db`
  - For Docker: `mongodb://mongo:27017/healthcare_db`

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

### JWT_EXPIRES_IN
- **Description**: JWT token expiration time
- **Default**: `24h`
- **Example**: `JWT_EXPIRES_IN=24h`
- **Required**: No (has default)
- **Format**: 
  - Time format: `24h`, `7d`, `30m`
  - Examples: `1h`, `2d`, `30m`, `3600` (seconds)

### ALLOWED_ORIGINS
- **Description**: Comma-separated list of allowed CORS origins
- **Default**: `['http://localhost:3000']`
- **Example**: `ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,https://yourdomain.com`
- **Required**: No (has default)
- **Note**: 
  - Separate multiple origins with commas (no spaces)
  - Include all frontend URLs that will access the API
  - For production, use your actual domain

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

# CORS Configuration
# Add all frontend URLs that need to access the API
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:8080
```

## Quick Setup

1. Copy the example above into a new `.env` file
2. Update `MONGODB_URI` with your MongoDB connection string
3. Generate a secure `JWT_SECRET`:
   ```bash
   openssl rand -base64 32
   ```
4. Update `ALLOWED_ORIGINS` with your frontend URLs
5. Save the file

## Security Best Practices

1. **Never commit `.env` to version control** - It's already in `.gitignore`
2. **Use different secrets for different environments** - Development vs Production
3. **Use strong JWT secrets** - At least 32 random characters
4. **Restrict CORS origins in production** - Only allow your actual domains
5. **Use environment-specific MongoDB URIs** - Separate databases for dev/prod

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
