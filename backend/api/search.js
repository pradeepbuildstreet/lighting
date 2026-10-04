const express = require("express");
const { query } = require("../db/database");

const router = express.Router();

router.get("/products", async (req, res) => {
  try {
    const {
      category,
      brand,
      style,
      material,
      color_temperature,
      price_min,
      price_max,
      smart_compatible,
      search,
      page = 1,
      limit = 24
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClauses = ["p.status = 'active'"];
    const params = [];
    let paramIndex = 1;

    const searchTerm = String(search || "").trim();
    if (searchTerm) {
      whereClauses.push(
        `(p.name ILIKE $${paramIndex} OR p.sku ILIKE $${paramIndex} OR COALESCE(p.description, '') ILIKE $${paramIndex})`
      );
      params.push(`%${searchTerm}%`);
      paramIndex++;
    }

    if (category) {
      whereClauses.push(`c.id IN (
        WITH RECURSIVE category_descendants AS (
          SELECT id FROM categories WHERE slug = $${paramIndex}
          UNION ALL
          SELECT child.id
          FROM categories child
          JOIN category_descendants parent ON child.parent_id = parent.id
        )
        SELECT id FROM category_descendants
      )`);
      params.push(category);
      paramIndex++;
    }

    if (price_min) {
      whereClauses.push(`p.price >= $${paramIndex}`);
      params.push(parseFloat(price_min));
      paramIndex++;
    }

    if (price_max) {
      whereClauses.push(`p.price <= $${paramIndex}`);
      params.push(parseFloat(price_max));
      paramIndex++;
    }

    if (style) {
      whereClauses.push(`p.style = $${paramIndex}`);
      params.push(style);
      paramIndex++;
    }

    if (material) {
      whereClauses.push(`p.material = $${paramIndex}`);
      params.push(material);
      paramIndex++;
    }

    if (color_temperature) {
      whereClauses.push(`p.color_temperature = $${paramIndex}`);
      params.push(parseInt(color_temperature));
      paramIndex++;
    }

    if (brand) {
      whereClauses.push(`p.optional_attributes->>'brand' = $${paramIndex}`);
      params.push(brand);
      paramIndex++;
    }

    if (smart_compatible !== undefined) {
      whereClauses.push(`(p.optional_attributes->>'smart_compatible')::boolean = $${paramIndex}`);
      params.push(smart_compatible === "true");
      paramIndex++;
    }

    const whereSQL = whereClauses.join(" AND ");

    const productsQuery = `
      SELECT 
        p.id, p.sku, p.name, p.description, p.price,
        p.wattage, p.lumens, c.slug as category, p.color_temperature, p.material, p.style,
        p.image_url, p.optional_attributes,
        c.path as breadcrumb_path,
        c.name as category_name,
        COALESCE(wishlist_totals.wishlist_count, 0)::integer AS wishlist_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN (
        SELECT sku, COUNT(DISTINCT wishlist_id)::integer AS wishlist_count
        FROM wishlist_items
        GROUP BY sku
      ) wishlist_totals ON wishlist_totals.sku = p.sku
      WHERE ${whereSQL}
      ORDER BY p.price ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const productsResult = await query(productsQuery, [...params, parseInt(limit), offset]);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${whereSQL}
    `;

    const countResult = await query(countQuery, params);

    res.json({
      products: productsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(parseInt(countResult.rows[0].total) / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/filters/options", async (req, res) => {
  try {
    const { attribute, category } = req.query;

    if (!attribute) {
      return res.status(400).json({ error: "attribute parameter required" });
    }

    let sql;
    const categoryScope = category
      ? `AND p.category_id IN (
          WITH RECURSIVE category_descendants AS (
            SELECT id FROM categories WHERE slug = $1
            UNION ALL
            SELECT child.id
            FROM categories child
            JOIN category_descendants parent ON child.parent_id = parent.id
          )
          SELECT id FROM category_descendants
        )`
      : "";

    switch (attribute) {
      case "category":
      sql = `
        SELECT DISTINCT c.slug AS value
        FROM categories c
        WHERE c.slug IS NOT NULL
          AND COALESCE(TRIM(c.slug), '') <> ''
        ORDER BY c.slug ASC
      `;
      break;

      case "style":
        sql = `
          SELECT DISTINCT TRIM(p.style) AS value
          FROM products p
          WHERE p.status = 'active'
            AND COALESCE(TRIM(p.style), '') <> ''
            ${categoryScope}
          ORDER BY value ASC
        `;
        break;

      case "material":
        sql = `
          SELECT DISTINCT TRIM(p.material) AS value
          FROM products p
          WHERE p.status = 'active'
            AND COALESCE(TRIM(p.material), '') <> ''
            ${categoryScope}
          ORDER BY value ASC
        `;
        break;

      case "brand":
        sql = `
          SELECT DISTINCT TRIM(p.optional_attributes->>'brand') AS value
          FROM products p
          WHERE p.status = 'active'
            AND COALESCE(TRIM(p.optional_attributes->>'brand'), '') <> ''
            ${categoryScope}
          ORDER BY value ASC
        `;
        break;

      case "color_temperature":
        sql = `
          SELECT DISTINCT p.color_temperature AS value
          FROM products p
          WHERE p.status = 'active' AND p.color_temperature IS NOT NULL
            ${categoryScope}
          ORDER BY p.color_temperature ASC
        `;
        break;

      case "wattage":
        sql = `
          SELECT DISTINCT p.wattage AS value
          FROM products p
          WHERE p.status = 'active' AND p.wattage IS NOT NULL
            ${categoryScope}
          ORDER BY p.wattage ASC
        `;
        break;

      default:
        return res.status(400).json({ error: "invalid attribute" });
    }

    const result = await query(sql, attribute === "category" || !category ? [] : [category]);

    res.json({
      options: result.rows.map((row) => row.value).filter(Boolean),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/product/:sku", async (req, res) => {
  try {
    const { sku } = req.params;

    const result = await query(
      `WITH RECURSIVE category_ancestors AS (
        SELECT category.id, category.parent_id, category.name, category.slug, 0 AS depth
        FROM products product
        JOIN categories category ON product.category_id = category.id
        WHERE product.sku = $1 AND product.status = 'active'
        UNION ALL
        SELECT parent.id, parent.parent_id, parent.name, parent.slug, child.depth + 1
        FROM categories parent
        JOIN category_ancestors child ON child.parent_id = parent.id
      )
      SELECT
        p.id, p.sku, p.name, p.description, p.price,
        p.wattage, p.lumens, p.color_temperature, p.material, p.style,
        p.image_url, p.optional_attributes,
        c.slug AS category,
        c.name AS category_name,
        COALESCE(
          (SELECT COUNT(DISTINCT item.wishlist_id)::integer FROM wishlist_items item WHERE item.sku = p.sku),
          0
        ) AS wishlist_count,
        COALESCE(
          (SELECT json_agg(json_build_object('slug', ancestor.slug, 'name', ancestor.name) ORDER BY ancestor.depth DESC)
           FROM category_ancestors ancestor),
          '[]'::json
        ) AS category_path
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.sku = $1 AND p.status = 'active'
      LIMIT 1
      `,
      [sku]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ product: null });
    }

    res.json({ product: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/categories-with-count", async (req, res) => {
  console.log("Fetching categories with product counts...");
  try {
    const result = await query(`
      WITH RECURSIVE descendants AS (
        SELECT id AS ancestor_id, id AS descendant_id
        FROM categories
        UNION ALL
        SELECT descendants.ancestor_id, child.id
        FROM descendants
        JOIN categories child ON child.parent_id = descendants.descendant_id
      )
      SELECT
        c.name,
        c.slug,
        c.parent_id,
        c.path,
        c.sort_order,
        COUNT(p.id) FILTER (WHERE p.status = 'active') AS count
      FROM categories c
      LEFT JOIN descendants ON descendants.ancestor_id = c.id
      LEFT JOIN products p
        ON p.category_id = descendants.descendant_id
      GROUP BY c.id
      ORDER BY c.sort_order, c.name
    `);

    res.json({ categories: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
module.exports = router;