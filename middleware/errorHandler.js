// Centralized error handler. Express recognizes this as error-handling
// middleware specifically because it takes FOUR arguments (err, req, res,
// next) — that's not a style choice, Express inspects the function's arity.
// It must be registered with app.use() AFTER every route/router.
export function errorHandler(err, req, res, next) {
  // Full detail goes to the server log only — never to the client.
  console.error(err);

  // Errors we threw on purpose (AppError) already know their status code
  // and carry a message that's safe to show a client.
  if (err.isOperational) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  // Mongoose duplicate-key error (e.g. registering an email that already exists)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    return res.status(409).json({ message: `${field} already exists` });
  }

  // Mongoose schema validation failure
  if (err.name === "ValidationError") {
    return res.status(400).json({ message: "Invalid input data" });
  }

  // Malformed ObjectId etc.
  if (err.name === "CastError") {
    return res.status(400).json({ message: "Invalid identifier format" });
  }

  // Anything else is a genuine bug/unexpected failure — never leak stack
  // traces, connection strings, or raw driver errors to the client.
  return res.status(500).json({ message: "Internal server error" });
}
