const express = require("express");
const { pool, query } = require("../db/database");

const router = express.Router();

function normalizeCategory(row) {
  return {
    ...row,
    product_count: Number(row.product_count),
    sort_order: Number(row.sort_order),
    children: [],
  };
}

function buildTree(rows) {
  const nodes = new Map(rows.map((row) => [row.id, normalizeCategory(row)]));
  const roots = [];

  nodes.forEach((node) => {
    if (node.parent_id && nodes.has(node.parent_id)) {
      nodes.get(node.parent_id).children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function validateCategory({ name, slug, sort_order }) {
  if (typeof name !== "string" || !name.trim()) return "Name is required.";
  if (typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return "Slug must contain lowercase letters, numbers, and single hyphens only.";
  }
  if (!Number.isInteger(Number(sort_order)) || Number(sort_order) < 0) {
    return "Sort order must be a non-negative integer.";
  }
  return null;
}

router.get("/", async (_req, res) => {
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
        category.id,
        category.name,
        category.slug,
        category.parent_id,
        category.path,
        category.description,
        category.sort_order,
        COUNT(product.id) FILTER (WHERE product.status = 'active') AS product_count
      FROM categories category
      LEFT JOIN descendants ON descendants.ancestor_id = category.id
      LEFT JOIN products product ON product.category_id = descendants.descendant_id
      GROUP BY category.id
      ORDER BY category.sort_order, category.name
    `);

    res.json({ categories: buildTree(result.rows) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/", async (req, res) => {
  const { name, slug, parent_id = null, description = "", sort_order = 0 } = req.body;
  const validationError = validateCategory({ name, slug, sort_order });
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    let parentPath = "/products";
    if (parent_id) {
      const parent = await query("SELECT path FROM categories WHERE id = $1", [parent_id]);
      if (!parent.rows.length) return res.status(400).json({ error: "Parent category not found." });
      parentPath = parent.rows[0].path;
    }

    const result = await query(
      `INSERT INTO categories (name, slug, parent_id, path, description, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, slug, parent_id, path, description, sort_order`,
      [name.trim(), slug, parent_id, `${parentPath}/${slug}`, String(description).trim(), Number(sort_order)]
    );
    res.status(201).json({ category: { ...result.rows[0], product_count: 0 } });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "That category slug is already in use." });
    res.status(500).json({ error: error.message });
  }
});

router.put("/:id", async (req, res) => {
  const { name, slug, parent_id, description = "", sort_order = 0 } = req.body;
  const validationError = validateCategory({ name, slug, sort_order });
  if (validationError) return res.status(400).json({ error: validationError });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT id, parent_id FROM categories WHERE id = $1", [req.params.id]);
    if (!existing.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Category not found." });
    }

    const nextParentId = parent_id === undefined ? existing.rows[0].parent_id : parent_id;
    let parentPath = "/products";
    if (nextParentId) {
      const parent = await client.query("SELECT path FROM categories WHERE id = $1", [nextParentId]);
      if (!parent.rows.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Parent category not found." });
      }
      const descendant = await client.query(
        `WITH RECURSIVE descendants AS (
           SELECT id FROM categories WHERE id = $1
           UNION ALL
           SELECT child.id FROM categories child
           JOIN descendants ON child.parent_id = descendants.id
         )
         SELECT id FROM descendants WHERE id = $2`,
        [req.params.id, nextParentId]
      );
      if (descendant.rows.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "A category cannot be moved beneath itself or one of its subcategories." });
      }
      parentPath = parent.rows[0].path;
    }

    await client.query(
      `UPDATE categories
       SET name = $2, slug = $3, parent_id = $4, description = $5, sort_order = $6
       WHERE id = $1`,
      [req.params.id, name.trim(), slug, nextParentId, String(description).trim(), Number(sort_order)]
    );
    await client.query(
      `WITH RECURSIVE category_paths AS (
         SELECT id, parent_id, slug, $2::text || '/' || slug AS path
         FROM categories WHERE id = $1
         UNION ALL
         SELECT child.id, child.parent_id, child.slug, category_paths.path || '/' || child.slug
         FROM categories child
         JOIN category_paths ON child.parent_id = category_paths.id
       )
       UPDATE categories category
       SET path = category_paths.path
       FROM category_paths
       WHERE category.id = category_paths.id`,
      [req.params.id, parentPath]
    );
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") return res.status(409).json({ error: "That category slug is already in use." });
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

router.patch("/reorder", async (req, res) => {
  const { category_id, direction } = req.body;
  if (!category_id || !["up", "down"].includes(direction)) {
    return res.status(400).json({ error: "Category and reorder direction are required." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const selected = await client.query("SELECT id, parent_id FROM categories WHERE id = $1", [category_id]);
    if (!selected.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Category not found." });
    }

    const siblings = await client.query(
      `SELECT id FROM categories
       WHERE parent_id IS NOT DISTINCT FROM $1
       ORDER BY sort_order, name`,
      [selected.rows[0].parent_id]
    );
    const reordered = siblings.rows.map((row) => row.id);
    const currentIndex = reordered.indexOf(category_id);
    const neighborIndex = currentIndex + (direction === "up" ? -1 : 1);
    if (neighborIndex >= 0 && neighborIndex < reordered.length) {
      [reordered[currentIndex], reordered[neighborIndex]] = [reordered[neighborIndex], reordered[currentIndex]];
    }

    const cases = [];
    const values = [];
    reordered.forEach((id, index) => {
      values.push(id, index * 10);
      cases.push(`WHEN $${values.length - 1} THEN $${values.length}`);
    });
    const ids = reordered.map((id) => {
      values.push(id);
      return `$${values.length}`;
    });
    await client.query(
      `UPDATE categories
       SET sort_order = CASE id ${cases.join(" ")} ELSE sort_order END
       WHERE id IN (${ids.join(", ")})`,
      values
    );
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

router.delete("/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const usage = await client.query(
      `SELECT
         EXISTS (SELECT 1 FROM categories WHERE parent_id = $1) AS has_children,
         EXISTS (SELECT 1 FROM products WHERE category_id = $1) AS has_products`,
      [req.params.id]
    );
    if (!usage.rows.length || (!usage.rows[0].has_children && !usage.rows[0].has_products)) {
      const result = await client.query("DELETE FROM categories WHERE id = $1 RETURNING id", [req.params.id]);
      if (!result.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Category not found." });
      }
      await client.query("COMMIT");
      return res.json({ success: true });
    }

    await client.query("ROLLBACK");
    const reason = usage.rows[0].has_children
      ? "Move or delete its subcategories first."
      : "Reassign its products first.";
    res.status(409).json({ error: `This category cannot be deleted. ${reason}` });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;