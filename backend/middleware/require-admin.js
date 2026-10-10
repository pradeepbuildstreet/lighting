const jwt = require("jsonwebtoken");
const { query } = require("../db/database");

const COOKIE_NAME = "lighting_admin_session";

function allowedOrigins() {
  return (process.env.FRONTEND_ORIGIN || "http://localhost:3001")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function checkOrigin(req, res, next) {
  const origin = req.get("origin");
  if (origin && !allowedOrigins().includes(origin)) {
    return res.status(403).json({ error: "Request origin is not allowed." });
  }
  next();
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    ...(process.env.AUTH_COOKIE_DOMAIN ? { domain: process.env.AUTH_COOKIE_DOMAIN } : {}),
  };
}

async function requireAdmin(req, res, next) {
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
    return res.status(503).json({ error: "Admin authentication is not configured." });
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    if (origin && !allowedOrigins().includes(origin)) {
      return res.status(403).json({ error: "Request origin is not allowed." });
    }
  }

  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: "Admin sign-in required." });

    const claims = jwt.verify(token, process.env.AUTH_SECRET, { algorithms: ["HS256"] });
    if (typeof claims === "string" || !claims.sub) {
      return res.status(401).json({ error: "Admin sign-in required." });
    }

    const result = await query(
      "SELECT id, email FROM app_users WHERE id = $1 AND role = 'admin' AND is_active = TRUE",
      [claims.sub]
    );
    if (!result.rows.length) return res.status(403).json({ error: "Admin access required." });

    req.admin = result.rows[0];
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Admin sign-in required." });
    }
    next(error);
  }
}

module.exports = { COOKIE_NAME, checkOrigin, requireAdmin, sessionCookieOptions };