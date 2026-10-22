# Historical tool: inspect-wishlist-schema.cjs

Archived from `backend/inspect-wishlist-schema.cjs`. Reference only; not supported setup or an executable upgrade step. Do not copy/run without a separate data-operation review. Original source follows.

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
  try {
    const database = await pool.query(
      "SELECT current_database() AS database"
    );

    const columns = await pool.query(`
      SELECT
        table_schema,
        table_name,
        column_name,
        data_type,
        udt_name,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name IN ('wishlists', 'wishlist_items')
        AND table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name, ordinal_position
    `);

    const indexes = await pool.query(`
      SELECT
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename IN ('wishlists', 'wishlist_items')
      ORDER BY schemaname, tablename, indexname
    `);

    console.log(JSON.stringify({
      database: database.rows[0].database,
      columns: columns.rows,
      indexes: indexes.rows,
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      event: "wishlist_schema_inspection_failed",
      code: error.code,
      message: error.message,
    }));

    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
```
