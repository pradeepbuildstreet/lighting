const express = require("express");
const { query } = require("../db/database");

const router = express.Router();
const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "http://localhost:3000";

function escapeXml(value) {
  return String(value).replace(/[<>&"']/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
  })[character]);
}

// Get SEO data for all products
router.get("/products", async (req, res) => {
  try {
    const result = await query(
      `SELECT sku, name, description, price, style, material, 
              color_temperature, wattage, lumens
       FROM products
       WHERE status = 'active'`
    );

    const seoData = result.rows.map((product) => ({
      sku: product.sku,
      title: `${product.name} - ${product.price}₹ | Decorative Lighting`,
      description: `${product.description || ""} | Wattage: ${product.wattage}W, Lumens: ${product.lumens}, Color: ${product.color_temperature}K, Material: ${product.material}`,
      keywords: `${product.name}, ${product.style} light, ${product.material} lighting, ${product.color_temperature}K LED`,
      openGraph: {
        title: product.name,
        description: product.description,
        type: "product"
      }
    }));

    res.json({ seoData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate sitemap
router.get("/sitemap", async (req, res) => {
  try {
    const products = await query(
      `SELECT p.sku, c.slug AS category_slug
       FROM products p
       JOIN categories c ON p.category_id = c.id
       WHERE p.status = 'active'`
    );

    const categories = await query(
      `SELECT path FROM categories`
    );

    const absoluteUrl = (route) => new URL(route, siteOrigin).toString();
    const urls = [absoluteUrl("/"), absoluteUrl("/products")];
    categories.rows.forEach((category) => {
      const segments = String(category.path).split("/").filter(Boolean);
      const slugs = segments[0] === "products" ? segments.slice(1) : segments;
      if (slugs.length) urls.push(absoluteUrl(`/categories/${slugs.map(encodeURIComponent).join("/")}`));
    });
    products.rows.forEach((product) => {
      urls.push(absoluteUrl(`/products/${encodeURIComponent(product.category_slug)}/${encodeURIComponent(product.sku)}`));
    });

    const lastModified = new Date().toISOString();
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `\n  <url><loc>${escapeXml(url)}</loc><lastmod>${lastModified}</lastmod></url>`).join("")}\n</urlset>`;

    res.type("application/xml").send(sitemap);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
