// A deliberate, expected error (e.g. "not found", "bad input") — as opposed to
// an unexpected bug/crash. Controllers throw this; the central error handler
// (middleware/errorHandler.js) knows it's safe to send `message` straight to
// the client because *we* wrote it, on purpose, with a client-safe status code.
export class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}
