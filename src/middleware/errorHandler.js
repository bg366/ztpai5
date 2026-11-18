const { AppError, NotFoundError } = require("../errors/AppError");

function notFoundHandler(req, res, next) {
  next(new NotFoundError("ROUTE_NOT_FOUND", `Route ${req.method} ${req.path} not found`));
}

function errorHandler(logger) {
  // Express rozpoznaje middleware błędów po czterech parametrach.
  return (err, req, res, next) => {
    let status = 500;
    let error = { code: "INTERNAL_ERROR", message: "Internal server error" };

    if (err instanceof AppError) {
      status = err.status;
      error = { code: err.code, message: err.message, details: err.details };
    } else if (err.code === '23505') {
      status = 409;
      error = err.constraint === 'users_email_unique'
        ? { code: 'EMAIL_TAKEN', message: 'Email already registered' }
        : { code: 'DUPLICATE_RESOURCE', message: 'Resource with this name already exists' };
    } else if (err.code === '23P01') {
      status = 409; error = { code: 'ROOM_ALREADY_BOOKED', message: 'Room is already booked' };
    } else if (err.code === '23503') {
      status = 409; error = { code: 'REFERENCE_CONFLICT', message: 'Related resource is missing or still in use' };
    } else if (['23514', '23502', '22003'].includes(err.code)) {
      status = 400; error = { code: 'INVALID_DATA', message: 'Data violates a database constraint' };
    } else if (err.type === 'entity.too.large') {
      status = 413; error = { code: 'BODY_TOO_LARGE', message: 'Request body is too large' };
    } else if (err.type === "entity.parse.failed") {
      status = 400;
      error = { code: "INVALID_JSON", message: "Request body is not valid JSON" };
    } else {
      // Stack trace trafia tylko do logów, nigdy do klienta.
      logger.error(`[${req.requestId}] ${err.stack}`);
    }

    if (status === 401) res.set('WWW-Authenticate', 'Bearer');
    res.status(status).json({ error: { ...error, details: error.details ?? [], requestId: req.requestId } });
  };
}

module.exports = { notFoundHandler, errorHandler };
