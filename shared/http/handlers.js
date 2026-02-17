const { sendError } = require('./responses');

const notFoundHandler = (req, res) => sendError(res, 404, 'NOT_FOUND', 'Route not found');

const globalErrorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  return sendError(
    res,
    err.status || 500,
    'INTERNAL_SERVER_ERROR',
    process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  );
};

module.exports = { notFoundHandler, globalErrorHandler };
