const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { AppError } = require('./errorHandler');

function getTokenFromHeader(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.replace('Bearer ', '').trim();
}

async function authenticate(req, res, next) {
  try {
    const token = getTokenFromHeader(req);
    if (!token) {
      throw new AppError(401, 'AUTH_REQUIRED', 'Authentication token is required.');
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET || 'development-secret');
    const user = await prisma.user.findUnique({
      where: { id: payload.id }
    });

    if (!user || !user.isActive) {
      throw new AppError(401, 'INVALID_TOKEN', 'User is not active or no longer exists.');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new AppError(401, 'INVALID_TOKEN', 'Invalid or expired token.'));
    }
    next(error);
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError(401, 'AUTH_REQUIRED', 'Authentication required.'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'You do not have permission to access this resource.'));
    }

    next();
  };
}

function ownCustomerScope(req, res, next) {
  if (req.user?.role === 'CUSTOMER') {
    req.query = req.query || {};
    req.query.customerId = req.user.customerId;
  }

  next();
}

module.exports = {
  authenticate,
  authorize,
  ownCustomerScope
};
