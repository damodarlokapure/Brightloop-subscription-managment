class AppError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.message = message;
    this.details = details;
  }
}

const formatZodError = (error) => {
  const issues = error?.issues ?? [];

  return issues.map((issue) => ({
    path: issue.path.join('.') || 'root',
    message: issue.message
  }));
};

const errorHandler = (err, req, res, next) => {
  const isOperational = err instanceof AppError;

  if (err?.name === 'ZodError' || err?.issues) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
        details: formatZodError(err)
      }
    });
  }

  if (isOperational) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    });
  }

  console.error(err);

  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong on the server.',
      details: null
    }
  });
};

module.exports = { AppError, errorHandler };
