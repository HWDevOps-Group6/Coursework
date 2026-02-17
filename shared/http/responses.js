const sendError = (res, status, code, message, details) => {
  const payload = {
    success: false,
    error: { code, message },
  };

  if (details !== undefined) {
    payload.error.details = details;
  }

  return res.status(status).json(payload);
};

const sendSuccess = (res, status, data, message) => {
  const payload = { success: true };

  if (data !== undefined) {
    payload.data = data;
  }

  if (message !== undefined) {
    payload.message = message;
  }

  return res.status(status).json(payload);
};

module.exports = { sendError, sendSuccess };
