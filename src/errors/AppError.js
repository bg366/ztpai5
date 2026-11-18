class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

class ValidationError extends AppError {
  constructor(details, message = "Validation failed") {
    super(400, "VALIDATION_ERROR", message, details);
  }
}

// Błąd 400 wynikający z reguły biznesowej, a nie z kształtu danych.
class BusinessRuleError extends AppError {
  constructor(code, message) {
    super(400, code, message);
  }
}

class NotFoundError extends AppError {
  constructor(code, message) {
    super(404, code, message);
  }
}

class ConflictError extends AppError {
  constructor(code, message) {
    super(409, code, message);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') { super(401, 'UNAUTHORIZED', message); }
}
class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') { super(403, 'FORBIDDEN', message); }
}
module.exports = { AppError, ValidationError, BusinessRuleError, NotFoundError, ConflictError, UnauthorizedError, ForbiddenError };
