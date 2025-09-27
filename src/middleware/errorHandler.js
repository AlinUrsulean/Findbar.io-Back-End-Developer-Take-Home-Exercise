const { logger } = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Default error response
  let status = 500;
  let message = 'Internal Server Error';
  let details = null;

  // Handle specific error types
  if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation Error';
    details = err.details || err.message;
  } else if (err.name === 'ResponseError' && err.meta?.statusCode) {
    // Elasticsearch errors
    status = err.meta.statusCode === 404 ? 404 : 500;
    message = err.meta.statusCode === 404 ? 'Resource not found' : 'Search service error';
    details = process.env.NODE_ENV === 'development' ? err.message : null;
  } else if (err.statusCode) {
    status = err.statusCode;
    message = err.message;
  }

  // Don't leak error details in production
  const response = {
    error: message,
    timestamp: new Date().toISOString(),
    path: req.path
  };

  if (process.env.NODE_ENV === 'development' && details) {
    response.details = details;
  }

  res.status(status).json(response);
}

module.exports = { errorHandler };

