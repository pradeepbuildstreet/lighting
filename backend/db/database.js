const { Pool } = require("pg");
const dotenv = require("dotenv");

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function query(text, params) {
  const result = await pool.query(text, params);
  return result;
}

async function bulkInsertProducts(products) {
  if (!products || products.length === 0) return [];

  const columns = [
    "sku",
    "name",
    "description",
    "price",
    "category_id",
    "wattage",
    "lumens",
    "color_temperature",
    "material",
    "style",
    "optional_attributes",
    "image_url",
    "image_repo_path",
    "status",
  ];

  const values = [];
  const placeholders = [];

  products.forEach((product, i) => {
    const base = i * columns.length;

    values.push(
      product.sku,
      product.name,
      product.description ?? "",
      product.price,
      product.category_id,
      product.wattage,
      product.lumens,
      product.color_temperature,
      product.material,
      product.style,
      JSON.stringify(product.optional_attributes ?? {}),
      product.image_url ?? null,
      product.image_repo_path ?? null,
      product.status ?? "active"
    );

    const rowPlaceholders = columns.map((_, j) => `$${base + j + 1}`);
    placeholders.push(`(${rowPlaceholders.join(", ")})`);
  });

  const sql = `
    INSERT INTO products (${columns.join(", ")})
    VALUES ${placeholders.join(", ")}
    ON CONFLICT (sku) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      price = EXCLUDED.price,
      category_id = EXCLUDED.category_id,
      wattage = EXCLUDED.wattage,
      lumens = EXCLUDED.lumens,
      color_temperature = EXCLUDED.color_temperature,
      material = EXCLUDED.material,
      style = EXCLUDED.style,
      optional_attributes = EXCLUDED.optional_attributes,
      image_url = EXCLUDED.image_url,
      image_repo_path = EXCLUDED.image_repo_path,
      status = EXCLUDED.status,
      updated_at = NOW()
    RETURNING id, sku
  `;

  const result = await pool.query(sql, values);
  return result.rows;
}

module.exports = {
  pool,
  query,
  bulkInsertProducts,
};