export class ValidationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export class PayloadTooLargeError extends ValidationError {
  constructor(message = "Payload too large") {
    super(message, 413);
  }
}

export class UnauthorizedError extends ValidationError {
  constructor(message = "unauthorized") {
    super(message, 401);
  }
}

export class TooManyRequestsError extends ValidationError {
  retryAfter?: number;
  constructor(message = "Too many requests", retryAfter?: number) {
    super(message, 429);
    this.retryAfter = retryAfter;
  }
}
