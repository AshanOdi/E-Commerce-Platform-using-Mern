import jwt from "jsonwebtoken";

// ---------------------------------------------------------------------------
// AUTHENTICATION vs AUTHORIZATION
//
// Authentication = "Who are you?"          -> authenticateUser
// Authorization  = "Are you allowed to..?" -> requireAuth / requireAdmin
//
// authenticateUser runs globally, on every request. It never blocks a
// request just for being anonymous — lots of routes (browsing products) are
// public. It only rejects a request that carries a token that is actually
// broken (invalid signature or expired), because presenting a bad token is
// different from presenting no token at all.
// ---------------------------------------------------------------------------

export function authenticateUser(req, res, next) {
  const authHeader = req.header("Authorization");

  if (!authHeader) {
    req.user = null; // anonymous — let the route/controller decide if that's OK
    return next();
  }

  const token = authHeader.replace("Bearer ", "");

  jwt.verify(token, process.env.JWT_KEY, (err, decoded) => {
    if (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Session expired. Please log in again." });
      }
      return res.status(401).json({ message: "Invalid token" });
    }
    req.user = decoded;
    next();
  });
}

// Authorization: must be logged in (any role). Use on routes like "place an
// order" where anonymous access makes no sense.
export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Please log in to continue" });
  }
  next();
}

// Authorization: must be logged in AND an admin. 401 vs 403 matters here:
// 401 = "we don't know who you are", 403 = "we know who you are, and the
// answer is no".
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Please log in to continue" });
  }
  if (!isAdmin(req.user)) {
    return res.status(403).json({ message: "You are not authorized to perform this action" });
  }
  next();
}

// Plain helper (no req/res) reused by controllers that need a *soft* check
// rather than a hard block — e.g. getProduct shows more fields to admins but
// still works for everyone else.
export function isAdmin(user) {
  return user != null && user.role === "admin";
}
