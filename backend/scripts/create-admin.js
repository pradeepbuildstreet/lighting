const bcrypt = require("bcryptjs");
const { pool, query } = require("../db/database");

async function createAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error("Set ADMIN_EMAIL to a valid email address.");
  }
  if (!password || password.length < 8) {
    throw new Error("Set ADMIN_PASSWORD to a password with at least 8 characters.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await query(
    `INSERT INTO app_users (email, password_hash, role, is_active)
     VALUES ($1, $2, 'admin', TRUE)`,
    [email, passwordHash]
  )
  console.log(`Admin account created for ${email}.`);
}

createAdmin()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());