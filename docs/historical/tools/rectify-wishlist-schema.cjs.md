# Historical tool: rectify-wishlist-schema.cjs

Archived from `backend/rectify-wishlist-schema.cjs`. Reference only; not supported setup or an executable upgrade step. Do not copy/run without a separate data-operation review. Original source follows.

```javascript
"use strict";

const path = require("node:path");

require("dotenv").config({
  path: path.join(__dirname, ".env"),
});

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});

async function main() {
  let client;
  let transactionStarted = false;

  try {
    client = await pool.connect();

    const databaseResult = await client.query(
      "SELECT current_database() AS database"
    );

    const database = databaseResult.rows[0].database;

    if (database !== "lighting_recreation_test") {
      throw new Error(
        `Refusing migration: connected to ${database}, not lighting_recreation_test`
      );
    }

    await client.query("BEGIN");
    transactionStarted = true;

    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");

    await client.query(`
      ALTER TABLE public.wishlist_items
        ADD COLUMN IF NOT EXISTS product_id uuid,
        ADD COLUMN IF NOT EXISTS currency varchar(3),
        ADD COLUMN IF NOT EXISTS media jsonb,
        ADD COLUMN IF NOT EXISTS product_href text,
        ADD COLUMN IF NOT EXISTS catalogue_revision text
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS
        wishlist_items_wishlist_product_uuid_uq
      ON public.wishlist_items (wishlist_id, product_id)
      WHERE product_id IS NOT NULL
    `);

    const columns = await client.query(`
      SELECT
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'wishlist_items'
        AND column_name IN (
          'product_id',
          'currency',
          'media',
          'product_href',
          'catalogue_revision'
        )
      ORDER BY column_name
    `);

    await client.query("COMMIT");
    transactionStarted = false;

    console.log(JSON.stringify({
      event: "wishlist_schema_rectified",
      database,
      columns: columns.rows,
      index: "wishlist_items_wishlist_product_uuid_uq",
    }, null, 2));
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {
        // Preserve the original migration error.
      }
    }

    console.error(JSON.stringify({
      event: "wishlist_schema_rectification_failed",
      code: error.code || "ERROR",
      message: error.message,
    }));

    process.exitCode = 1;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

main();
```
