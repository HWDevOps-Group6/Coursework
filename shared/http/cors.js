const defaultOrigins = ['http://localhost:3000', 'http://localhost:5173'];

const parseAllowedOrigins = () => {
  if (!process.env.ALLOWED_ORIGINS) return defaultOrigins;

  const origins = process.env.ALLOWED_ORIGINS
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : defaultOrigins;
};

const buildCorsOptions = () => ({
  origin: parseAllowedOrigins(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

module.exports = { buildCorsOptions };
