const crypto = require("crypto");
const express = require("express");
const { query } = require("../db/database");
const { requireAdmin } = require("../middleware/require-admin");

const router = express.Router();
const SESSION_HEADER = "x-wishlist-session";
const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getSessionHash(req, res) {
  const sessionId = req.get(SESSION_HEADER);
  if (!sessionId || !SESSION_ID_PATTERN.test(sessionId)) {
    res.status(400).json({ error: "A valid wishlist session is required." });
    return null;
  }
  return crypto.createHash("sha256").update(sessionId).digest("hex");
}

async function getWishlist(sessionHash, create = false) {
  if (create) {
    const shareToken = crypto.randomBytes(24).toString("hex");
    const result = await query(
      `INSERT INTO wishlists (session_hash, share_token)
       VALUES ($1, $2)
       ON CONFLICT (session_hash) DO UPDATE SET updated_at = NOW()
       RETURNING id, share_token, status, updated_at, customer_name, mobile_number, email, pin_code, requirements, submitted_at`,
      [sessionHash, shareToken]
    );
    return result.rows[0];
  }

  const result = await query(
    `SELECT id, share_token, status, updated_at, customer_name, mobile_number,
            email, pin_code, requirements, submitted_at
     FROM wishlists WHERE session_hash = $1`,
    [sessionHash]
  );
  return result.rows[0] || null;
}

async function getItems(wishlistId) {
  const result = await query(
    `SELECT sku, name, price, image_url, category_slug, add_count, created_at, updated_at
     FROM wishlist_items WHERE wishlist_id = $1 ORDER BY created_at, name`,
    [wishlistId]
  );
  return result.rows;
}

async function getWishlistResponse(wishlist) {
  if (!wishlist) return null;
  return { ...wishlist, items: await getItems(wishlist.id) };
}

function normalizeIndianMobile(value) {
  const digits = String(value || "").replace(/\D/g, "");
  const localNumber = digits.startsWith("91") && digits.length === 12
    ? digits.slice(2)
    : digits.startsWith("0") && digits.length === 11
      ? digits.slice(1)
      : digits;
  if (!/^[6-9]\d{9}$/.test(localNumber)) return null;
  return `+91${localNumber}`;
}

router.get("/session", async (req, res) => {
  const sessionHash = getSessionHash(req, res);
  if (!sessionHash) return;

  try {
    res.json({ wishlist: await getWishlistResponse(await getWishlist(sessionHash)) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/session/items", async (req, res) => {
  const sessionHash = getSessionHash(req, res);
  if (!sessionHash) return;
  const sku = String(req.body.sku || "").trim();
  if (!sku) return res.status(400).json({ error: "A product SKU is required." });

  try {
    const productResult = await query(
      `SELECT p.sku, p.name, p.price, p.image_url, c.slug AS category_slug
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.sku = $1 AND p.status = 'active'
       LIMIT 1`,
      [sku]
    );
    if (!productResult.rows.length) return res.status(404).json({ error: "Product not found." });

    const wishlist = await getWishlist(sessionHash, true);
    if (wishlist.status !== "draft") {
      return res.status(409).json({ error: "This wishlist has already been submitted." });
    }

    const itemCount = await query(
      "SELECT COUNT(*) AS count FROM wishlist_items WHERE wishlist_id = $1",
      [wishlist.id]
    );
    const alreadyInWishlist = await query(
      "SELECT 1 FROM wishlist_items WHERE wishlist_id = $1 AND sku = $2",
      [wishlist.id, sku]
    );
    if (!alreadyInWishlist.rows.length && Number(itemCount.rows[0].count) >= 100) {
      return res.status(409).json({ error: "A wishlist can contain up to 100 different products." });
    }

    const product = productResult.rows[0];
    await query(
      `INSERT INTO wishlist_items (wishlist_id, sku, name, price, image_url, category_slug)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (wishlist_id, sku) DO UPDATE SET
        add_count = 1,
         name = EXCLUDED.name,
         price = EXCLUDED.price,
         image_url = EXCLUDED.image_url,
         category_slug = EXCLUDED.category_slug,
         updated_at = NOW()`,
      [wishlist.id, product.sku, product.name, product.price, product.image_url, product.category_slug]
    );
    await query("UPDATE wishlists SET updated_at = NOW() WHERE id = $1", [wishlist.id]);

    res.status(200).json({ wishlist: await getWishlistResponse(wishlist) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/session/items/:sku", async (req, res) => {
  const sessionHash = getSessionHash(req, res);
  if (!sessionHash) return;

  try {
    const wishlist = await getWishlist(sessionHash);
    if (!wishlist) return res.status(404).json({ error: "Wishlist not found." });
    if (wishlist.status !== "draft") return res.status(409).json({ error: "Submitted wishlists cannot be changed." });

    await query("DELETE FROM wishlist_items WHERE wishlist_id = $1 AND sku = $2", [wishlist.id, req.params.sku]);
    await query("UPDATE wishlists SET updated_at = NOW() WHERE id = $1", [wishlist.id]);
    res.json({ wishlist: await getWishlistResponse(wishlist) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/session/submit", async (req, res) => {
  const sessionHash = getSessionHash(req, res);
  if (!sessionHash) return;

  const name = String(req.body.name || "").trim();
  const mobileNumber = normalizeIndianMobile(req.body.mobile_number);
  const email = String(req.body.email || "").trim().toLowerCase() || null;
  const pinCode = String(req.body.pin_code || "").trim();
  const requirements = String(req.body.requirements || "").trim();

  if (name.length < 2 || name.length > 160) return res.status(400).json({ error: "Enter your name (2 to 160 characters)." });
  if (!mobileNumber) return res.status(400).json({ error: "Enter a valid 10-digit Indian mobile number." });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (!/^[1-9][0-9]{5}$/.test(pinCode)) return res.status(400).json({ error: "Enter a valid 6-digit Indian PIN code." });
  if (requirements.length > 5000) return res.status(400).json({ error: "Requirements must be 5000 characters or fewer." });

  try {
    const wishlist = await getWishlist(sessionHash);
    if (!wishlist) return res.status(404).json({ error: "Add a product before submitting an enquiry." });
    if (wishlist.status !== "draft") return res.status(409).json({ error: "This wishlist has already been submitted." });

    const items = await getItems(wishlist.id);
    if (!items.length) return res.status(400).json({ error: "Add at least one product before submitting." });

    const result = await query(
      `UPDATE wishlists
       SET customer_name = $2, mobile_number = $3, email = $4, pin_code = $5,
           requirements = $6, status = 'submitted', submitted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'draft'
       RETURNING id, share_token, status, updated_at, customer_name, mobile_number,
                 email, pin_code, requirements, submitted_at`,
      [wishlist.id, name, mobileNumber, email, pinCode, requirements]
    );
    if (!result.rows.length) return res.status(409).json({ error: "This wishlist has already been submitted." });

    res.json({ wishlist: await getWishlistResponse(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/session/whatsapp-opened", async (req, res) => {
  const sessionHash = getSessionHash(req, res);
  if (!sessionHash) return;

  try {
    const result = await query(
      `UPDATE wishlists
       SET communication_channel = 'whatsapp', whatsapp_opened_at = NOW(), updated_at = NOW()
       WHERE session_hash = $1 AND status <> 'draft'
       RETURNING share_token, communication_channel, whatsapp_opened_at`,
      [sessionHash]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Submitted enquiry not found." });
    res.json({ enquiry: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/admin", requireAdmin, async (_req, res) => {
  try {
    const result = await query(
            `SELECT w.id, w.share_token, w.customer_name, w.mobile_number, w.email,
              w.pin_code, w.status, w.communication_channel, w.whatsapp_opened_at,
              w.updated_at, w.submitted_at,
              COUNT(i.id)::integer AS item_count
       FROM wishlists w
       LEFT JOIN wishlist_items i ON i.wishlist_id = w.id
       WHERE w.status <> 'draft'
       GROUP BY w.id
       ORDER BY w.updated_at DESC`
    );
    res.set("Cache-Control", "no-store").json({ enquiries: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/admin/analytics", requireAdmin, async (_req, res) => {
  try {
    const result = await query(
      `SELECT p.sku, p.name, p.price, p.image_url, c.slug AS category_slug,
              COUNT(DISTINCT item.wishlist_id)::integer AS wishlist_count,
              COUNT(DISTINCT wishlist.id)::integer AS wishlist_sessions,
              COUNT(DISTINCT wishlist.id) FILTER (WHERE wishlist.submitted_at IS NOT NULL)::integer AS submitted_enquiries,
              MAX(item.updated_at) AS last_wishlisted_at
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN wishlist_items item ON item.sku = p.sku
       LEFT JOIN wishlists wishlist ON wishlist.id = item.wishlist_id
       WHERE p.status = 'active'
       GROUP BY p.id, c.slug
       ORDER BY wishlist_count DESC, submitted_enquiries DESC, p.name ASC`
    );
    res.set("Cache-Control", "no-store").json({ products: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/admin/:token", requireAdmin, async (req, res) => {
  try {
    const result = await query(
            `SELECT id, share_token, status, customer_name, mobile_number, email,
              pin_code, requirements, communication_channel, whatsapp_opened_at,
              created_at, updated_at, submitted_at
       FROM wishlists WHERE share_token = $1 AND status <> 'draft'`,
      [req.params.token]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Enquiry not found." });
    res.set("Cache-Control", "no-store").json({ enquiry: await getWishlistResponse(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/admin/:token/status", requireAdmin, async (req, res) => {
  const status = String(req.body.status || "");
  if (!["contacted", "closed"].includes(status)) {
    return res.status(400).json({ error: "Status must be contacted or closed." });
  }

  try {
    const result = await query(
      `UPDATE wishlists SET status = $2, updated_at = NOW()
       WHERE share_token = $1 AND status <> 'draft'
       RETURNING id, share_token, status, updated_at, customer_name, mobile_number,
                 email, pin_code, requirements, submitted_at`,
      [req.params.token, status]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Enquiry not found." });
    res.json({ enquiry: await getWishlistResponse(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;