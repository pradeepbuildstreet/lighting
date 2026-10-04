const express = require("express");
const { query, getProductBySku } = require("../db/database");

const router = express.Router();

// Get all products
router.get("/", async (req, res) => {
  try {
    const result = await query(
      `SELECT p.id, p.sku, p.name, p.price, p.wattage, p.lumens, c.slug AS category,
              p.color_temperature, p.material, p.style, p.image_url
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.status = 'active'
       ORDER BY p.created_at DESC
       LIMIT 50`
    );
    res.json({ products: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get product by SKU
router.get("/:sku", async (req, res) => {
  try {
    const product = await getProductBySku(req.params.sku);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({ product });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
