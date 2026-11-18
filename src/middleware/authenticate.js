const jwt = require('jsonwebtoken');
const { UnauthorizedError } = require('../errors/AppError');
function authenticate(jwtSecret) {
  return (req, res, next) => {
    const header = req.get('Authorization');
    const match = header?.match(/^Bearer ([^\s]+)$/i);
    if (!match) return next(new UnauthorizedError('Bearer token required'));
    try {
      const payload = jwt.verify(match[1], jwtSecret, { algorithms: ['HS256'] });
      if (typeof payload !== 'object' || typeof payload.sub !== 'string' ||
          !/^[1-9]\d*$/.test(payload.sub) || Number(payload.sub) > 2147483647 ||
          !['USER', 'ADMIN'].includes(payload.role) ||
          !Number.isInteger(payload.iat) || !Number.isInteger(payload.exp)) {
        throw new Error('Invalid claims');
      }
      req.user = { id: Number(payload.sub), role: payload.role };
      next();
    } catch (error) {
      next(new UnauthorizedError(error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token'));
    }
  };
}
module.exports = { authenticate };
