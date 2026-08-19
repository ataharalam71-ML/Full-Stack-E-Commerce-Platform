/**
 * Wraps async route handlers so thrown errors/rejections reach the error handler
 * instead of crashing the process or hanging the request.
 */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/**
 * Custom error with an HTTP status code attached.
 */
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Must be registered LAST, after all routes.
function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;

  if (process.env.NODE_ENV !== 'test') {
    console.error(`[${req.method} ${req.originalUrl}]`, err.message);
    if (statusCode === 500) console.error(err.stack);
  }

  // SQLite constraint violations are the caller's fault, not a server fault.
  if (/UNIQUE constraint failed/i.test(err.message)) {
    return res.status(409).json({ error: 'That item already exists' });
  }
  if (/constraint failed/i.test(err.message)) {
    return res.status(400).json({ error: 'Some field values are not allowed' });
  }

  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal server error' : err.message,
  });
}

function notFound(req, res) {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
}

module.exports = { asyncHandler, ApiError, errorHandler, notFound };
