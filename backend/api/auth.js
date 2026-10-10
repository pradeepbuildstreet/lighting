const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { query } = require("../db/database");
const { COOKIE_NAME, checkOrigin, requireAdmin, sessionCookieOptions } = require("../middleware/require-admin");

const router = express.Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Try again later." },
});

router.post("/login", checkOrigin, loginLimiter, async (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";

  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
    return res.status(503).json({ error: "Admin authentication is not configured." });
  }
  if (!email || !password) return res.status(400).json({ error: "Email and password are required." });

  try {
    const result = await query(
      "SELECT id, email, password_hash FROM app_users WHERE email = $1 AND role = 'admin' AND is_active = TRUE",
      [email]
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Email or password is incorrect." });
    }

    const token = jwt.sign({ email: user.email, role: "admin" }, process.env.AUTH_SECRET, {
      algorithm: "HS256",
      subject: user.id,
      expiresIn: "8h",
    });
    res.cookie(COOKIE_NAME, token, { ...sessionCookieOptions(), maxAge: 8 * 60 * 60 * 1000 });
    res.set("Cache-Control", "no-store").json({ user: { email: user.email, role: "admin" } });
  } catch (error) {
    res.status(500).json({ error: "Could not sign in." });
  }
});

router.post("/logout", checkOrigin, (_req, res) => {
  res.clearCookie(COOKIE_NAME, sessionCookieOptions()).status(204).end();
});

router.get("/me", requireAdmin, (req, res) => {
  res.set("Cache-Control", "no-store").json({ user: { email: req.admin.email, role: "admin" } });
});

router.get("/admins", requireAdmin, async (_req, res) => {
  try {
    const result = await query(
      `SELECT id, email, is_active, created_at
       FROM app_users WHERE role = 'admin' ORDER BY created_at, email`
    );
    res.set("Cache-Control", "no-store").json({ admins: result.rows });
  } catch (error) {
    res.status(500).json({ error: "Could not load admin accounts." });
  }
});

router.post("/admins", requireAdmin, async (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO app_users (email, password_hash, role, is_active)
       VALUES ($1, $2, 'admin', TRUE)
       RETURNING id, email, is_active, created_at`,
      [email, passwordHash]
    );
    res.status(201).json({ admin: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "An account with that email already exists." });
    res.status(500).json({ error: "Could not create admin account." });
  }
});

router.patch("/admins/:id", requireAdmin, async (req, res) => {
  if (typeof req.body.is_active !== "boolean") {
    return res.status(400).json({ error: "is_active must be true or false." });
  }

  try {
    if (!req.body.is_active) {
      const activeCount = await query(
        "SELECT COUNT(*)::integer AS count FROM app_users WHERE role = 'admin' AND is_active = TRUE"
      );
      if (activeCount.rows[0].count <= 1) {
        return res.status(409).json({ error: "The last active admin cannot be disabled." });
      }
    }
    const result = await query(
      `UPDATE app_users SET is_active = $2, updated_at = NOW()
       WHERE id = $1 AND role = 'admin'
       RETURNING id, email, is_active, created_at`,
      [req.params.id, req.body.is_active]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Admin account not found." });
    res.json({ admin: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: "Could not update admin account." });
  }
});

module.exports = router;