const crypto = require("crypto");
const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const PDFDocument = require("pdfkit");
const { pool, query } = require("../db/database");
const { requireAdmin } = require("../middleware/require-admin");

const router = express.Router();
const TERM_FIELDS = ["gst", "payment_terms", "payment_details", "other_terms"];

function normalizeTerms(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const terms = {};
  for (const field of TERM_FIELDS) {
    const text = typeof value[field] === "string" ? value[field].trim() : "";
    if (text.length > 2000) return null;
    terms[field] = text;
  }

  const rawDays = value.delivery_days;
  if (rawDays === null || rawDays === undefined || rawDays === "") {
    terms.delivery_days = null;
  } else {
    const days = Number(rawDays);
    if (!Number.isInteger(days) || days < 1 || days > 365) return null;
    terms.delivery_days = days;
  }
  return terms;
}

function getTotals(items) {
  const listTotal = items.reduce((sum, item) => sum + Math.round(Number(item.list_price) * 100) * item.quantity, 0);
  const offerTotal = items.reduce((sum, item) => sum + Math.round(Number(item.offer_price) * 100) * item.quantity, 0);
  const savings = listTotal - offerTotal;
  return {
    list_total: listTotal / 100,
    offer_total: offerTotal / 100,
    savings: savings / 100,
    discount_percent: listTotal ? Math.round((savings / listTotal) * 10000) / 100 : 0,
  };
}

async function getOfferByToken(token) {
  const result = await query(
    `SELECT offer.id, offer.offer_token, offer.version, offer.status, offer.terms,
            offer.expires_at, offer.created_at, wishlist.customer_name
     FROM wishlist_offers offer
     JOIN wishlists wishlist ON wishlist.id = offer.wishlist_id
     WHERE offer.offer_token = $1`,
    [token]
  );
  if (!result.rows.length) return null;

  const offer = result.rows[0];
  const itemResult = await query(
    `SELECT sku, name, quantity, list_price, offer_price, image_url, category_slug
     FROM wishlist_offer_items WHERE offer_id = $1 ORDER BY name, sku`,
    [offer.id]
  );
  const items = itemResult.rows.map((item) => ({
    ...item,
    quantity: Number(item.quantity),
    list_price: Number(item.list_price),
    offer_price: Number(item.offer_price),
  }));
  return {
    ...offer,
    items: items.map((item) => ({
      ...item,
      discount_percent: item.list_price
        ? Math.round(((item.list_price - item.offer_price) / item.list_price) * 10000) / 100
        : 0,
    })),
    ...getTotals(items),
  };
}

function formatMoney(value) {
  return `INR ${Number(value).toFixed(2)}`;
}

function getAllowedImageOrigins() {
  return [process.env.IMAGE_REPO_URL, ...(process.env.FRONTEND_ORIGIN || "").split(",")]
    .filter(Boolean)
    .flatMap((value) => {
      try {
        return [new URL(value).origin];
      } catch {
        return [];
      }
    });
}

async function loadProductImage(imageUrl, document) {
  if (!imageUrl) return null;
  let source;
  try {
    source = new URL(imageUrl, "http://localhost");
  } catch {
    return null;
  }

  let imageBuffer;
  const publicRoot = path.resolve(__dirname, "../../frontend/public");
  const publicPath = decodeURIComponent(source.pathname).replace(/^\/+/, "");
  const localCandidates = [path.resolve(publicRoot, publicPath)];
  if (source.origin !== "http://localhost") {
    localCandidates.push(path.resolve(publicRoot, "uploads", path.basename(publicPath)));
  }
  if (publicPath.startsWith("uploads/") || source.origin === "http://localhost") {
    try {
      for (const localPath of localCandidates) {
        if (!localPath.startsWith(`${publicRoot}${path.sep}`)) continue;
        try {
          const details = await fs.stat(localPath);
          if (details.size > 4_000_000) continue;
          imageBuffer = await fs.readFile(localPath);
          break;
        } catch {
          continue;
        }
      }
    } catch {
      return null;
    }
    if (!imageBuffer && source.origin === "http://localhost") return null;
  }

  if (!imageBuffer && source.origin !== "http://localhost") {
    if (!getAllowedImageOrigins().includes(source.origin)) return null;
    if (source.protocol !== "https:" && source.hostname !== "localhost") return null;
    try {
      const response = await fetch(source, {
        redirect: "error",
        signal: AbortSignal.timeout(4000),
      });
      const contentType = response.headers.get("content-type") || "";
      const contentLength = Number(response.headers.get("content-length") || 0);
      if (!response.ok || !contentType.startsWith("image/") || contentLength > 4_000_000) return null;
      imageBuffer = Buffer.from(await response.arrayBuffer());
      if (imageBuffer.length > 4_000_000) return null;
    } catch {
      return null;
    }
  }

  try {
    document.openImage(imageBuffer);
    return imageBuffer;
  } catch {
    return null;
  }
}

function addPdfTableHeader(document) {
  document.font("Helvetica-Bold").fontSize(9).fillColor("#18382e");
  const headerY = document.y;
  document.text("Product", 98, headerY, { width: 105 });
  document.text("Qty", 211, headerY, { width: 28, align: "right" });
  document.text("List price", 246, headerY, { width: 75, align: "right" });
  document.text("Discount", 328, headerY, { width: 55, align: "right" });
  document.text("Offer price", 390, headerY, { width: 74, align: "right" });
  document.text("Line total", 471, headerY, { width: 82, align: "right" });
  document.y = headerY + 14;
  document.moveDown(0.7);
  document.moveTo(42, document.y).lineTo(553, document.y).strokeColor("#cbd4ca").stroke();
  document.moveDown(0.6);
}

async function createOfferPdf(offer, response) {
  const document = new PDFDocument({ size: "A4", margin: 42, bufferPages: true });
  response.setHeader("Content-Type", "application/pdf");
  response.setHeader("Content-Disposition", "attachment; filename=\"Luminoza-Price-Offer.pdf\"");
  response.setHeader("Cache-Control", "private, no-store");
  document.pipe(response);

  document.save().fillColor("#dda629").rect(52, 44, 36, 11).rect(75, 44, 13, 31).rect(75, 75, 32, 11).fill();
  document.fillColor("#c76542").rect(55, 44, 2, 17).moveTo(47, 61).lineTo(62, 61).lineTo(68, 71).lineTo(42, 71).closePath().fill();
  document.restore();
  document.font("Helvetica-Bold").fontSize(22).fillColor("#20252c").text("UMINOZA", 113, 42);
  document.font("Helvetica").fontSize(10).fillColor("#30343a").text("Beautiful lighting! Exuberant living!", 114, 68);
  document.font("Helvetica-Bold").fontSize(15).fillColor("#18382e").text("Personalized price offer", 42, 104);
  document.font("Helvetica").fontSize(10).fillColor("#333333");
  document.text(`Prepared for: ${offer.customer_name || "Customer"}`, 42, 128, { width: 511 });
  document.text(`Offer reference: ${offer.offer_token.slice(0, 12).toUpperCase()}`);
  document.text(`Created: ${new Date(offer.created_at).toLocaleDateString("en-IN")}`);
  if (offer.expires_at) document.text(`Valid until: ${new Date(offer.expires_at).toLocaleDateString("en-IN", { timeZone: "UTC" })}`);
  document.text("9600096298  |  8124969000  |  pradeep33.tcs@gmail.com");
  document.moveDown(1);
  addPdfTableHeader(document);

  for (const item of offer.items) {
    const productText = `${item.name}\nSKU: ${item.sku}`;
    const rowHeight = Math.max(54, document.heightOfString(productText, { width: 105 }) + 8);
    if (document.y + rowHeight > document.page.height - 60) {
      document.addPage();
      addPdfTableHeader(document);
    }
    const y = document.y;
    document.font("Helvetica").fontSize(9).fillColor("#222222");
    const imageBuffer = await loadProductImage(item.image_url, document);
    if (imageBuffer) document.image(imageBuffer, 42, y, { fit: [48, 48], align: "center", valign: "center" });
    else document.rect(42, y, 48, 48).strokeColor("#d9ded5").stroke();
    document.text(productText, 98, y, { width: 105 });
    document.text(String(item.quantity), 211, y, { width: 28, align: "right" });
    document.text(formatMoney(item.list_price), 246, y, { width: 75, align: "right" });
    document.text(`${item.discount_percent}%`, 328, y, { width: 55, align: "right" });
    document.text(formatMoney(item.offer_price), 390, y, { width: 74, align: "right" });
    document.text(formatMoney(item.offer_price * item.quantity), 471, y, { width: 82, align: "right" });
    document.y = y + rowHeight;
    document.moveTo(42, document.y).lineTo(553, document.y).strokeColor("#e1e6df").stroke();
    document.moveDown(0.5);
  }

  if (document.y > document.page.height - 160) document.addPage();
  document.moveDown(0.5);
  document.x = 42;
  document.font("Helvetica").fontSize(10).fillColor("#333333");
  const addSummaryLine = (label, value, emphasized = false) => {
    const y = document.y;
    document.font(emphasized ? "Helvetica-Bold" : "Helvetica").fillColor(emphasized ? "#18382e" : "#333333");
    document.text(label, 42, y, { width: 350 });
    document.text(value, 392, y, { width: 161, align: "right" });
    document.y = y + 17;
  };
  addSummaryLine("Subtotal at list prices", formatMoney(offer.list_total));
  addSummaryLine(`Discount offered (${offer.discount_percent}%)`, `- ${formatMoney(offer.savings)}`);
  addSummaryLine("Offer total", formatMoney(offer.offer_total), true);
  document.moveDown(1.2);
  document.x = 42;

  const terms = offer.terms || {};
  const termLines = [
    ["GST / tax", terms.gst],
    ["Payment terms", terms.payment_terms],
    ["Account / payment details", terms.payment_details],
    ["Estimated delivery", terms.delivery_days ? `${terms.delivery_days} days` : ""],
    ["Additional terms", terms.other_terms],
  ].filter(([, value]) => value);
  if (termLines.length) {
    document.x = 42;
    document.font("Helvetica-Bold").fontSize(12).fillColor("#18382e").text("Terms and conditions", 42, document.y, { width: 511 });
    document.moveDown(0.4);
    for (const [label, value] of termLines) {
      if (document.y > document.page.height - 55) document.addPage();
      document.x = 42;
      document.font("Helvetica-Bold").fontSize(9).fillColor("#333333").text(`${label}:`, 42, document.y, { width: 511 });
      document.x = 42;
      document.font("Helvetica").fontSize(9).fillColor("#333333").text(String(value), 42, document.y, { width: 511 });
      document.moveDown(0.3);
    }
  }

  document.moveDown(0.8);
  if (document.y > document.page.height - 105) document.addPage();
  document.x = 42;
  document.font("Helvetica-Bold").fontSize(11).fillColor("#18382e").text("Visit our showrooms", 42, document.y, { width: 511 });
  document.moveDown(0.4);
  document.font("Helvetica").fontSize(9).fillColor("#333333");
  document.text("LED Zone - No 10, Ratan Bazaar, Evening Bazaar, Tamil Nadu", 42, document.y, {
    width: 511,
    link: "https://maps.app.goo.gl/t5Sg3MG2oLgyoBX26",
    underline: true,
  });
  document.text("HomeStory - 1/348, East Coast Rd, Anna Enclave, Injambakkam, Chennai, Tamil Nadu 600115", 42, document.y, {
    width: 511,
    link: "https://share.google/jrM4UJC2TDh3p9sga",
    underline: true,
  });

  document.end();
}

router.get("/enquiry/:shareToken", requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT offer.id, offer.offer_token, offer.version, offer.status, offer.terms,
              offer.expires_at, offer.created_at
       FROM wishlist_offers offer
       JOIN wishlists wishlist ON wishlist.id = offer.wishlist_id
       WHERE wishlist.share_token = $1
       ORDER BY offer.version DESC`,
      [req.params.shareToken]
    );
    res.set("Cache-Control", "no-store").json({ offers: result.rows });
  } catch (error) {
    res.status(500).json({ error: "Could not load offers." });
  }
});

router.post("/enquiry/:shareToken", requireAdmin, async (req, res) => {
  const terms = normalizeTerms(req.body.terms);
  if (!terms) return res.status(400).json({ error: "Check the offer terms and delivery days." });
  if (!Array.isArray(req.body.items) || !req.body.items.length || req.body.items.length > 100) {
    return res.status(400).json({ error: "Offer prices are required for the enquiry items." });
  }

  let expiresAt = null;
  if (req.body.expires_at) {
    const expiryValue = String(req.body.expires_at);
    expiresAt = /^\d{4}-\d{2}-\d{2}$/.test(expiryValue)
      ? new Date(`${expiryValue}T23:59:59.999Z`)
      : new Date(expiryValue);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      return res.status(400).json({ error: "Offer expiry must be a future date." });
    }
  }

  const prices = new Map();
  for (const item of req.body.items) {
    const sku = typeof item.sku === "string" ? item.sku.trim() : "";
    const price = Number(item.offer_price);
    if (!sku || prices.has(sku) || !Number.isFinite(price) || price < 0) {
      return res.status(400).json({ error: "Each product needs one valid non-negative offer price." });
    }
    prices.set(sku, Math.round(price * 100) / 100);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const enquiryResult = await client.query(
      "SELECT id FROM wishlists WHERE share_token = $1 AND status <> 'draft' FOR UPDATE",
      [req.params.shareToken]
    );
    if (!enquiryResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Submitted enquiry not found." });
    }

    const wishlistId = enquiryResult.rows[0].id;
    const itemResult = await client.query(
      `SELECT sku, name, price, image_url, category_slug, add_count
       FROM wishlist_items WHERE wishlist_id = $1 ORDER BY created_at, name`,
      [wishlistId]
    );
    if (itemResult.rows.length !== prices.size || itemResult.rows.some((item) => !prices.has(item.sku))) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "An offer price is required for every enquiry item." });
    }
    for (const item of itemResult.rows) {
      if (prices.get(item.sku) > Number(item.price)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: `Offer price for ${item.sku} cannot exceed its enquiry price.` });
      }
    }

    const versionResult = await client.query(
      "SELECT COALESCE(MAX(version), 0)::integer + 1 AS version FROM wishlist_offers WHERE wishlist_id = $1",
      [wishlistId]
    );
    const version = versionResult.rows[0].version;
    const offerToken = crypto.randomBytes(32).toString("hex");
    const offerResult = await client.query(
      `INSERT INTO wishlist_offers (wishlist_id, offer_token, version, terms, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, offer_token, version, status, terms, expires_at, created_at`,
      [wishlistId, offerToken, version, JSON.stringify(terms), expiresAt, req.admin.id]
    );
    const offer = offerResult.rows[0];

    for (const item of itemResult.rows) {
      await client.query(
        `INSERT INTO wishlist_offer_items
         (offer_id, sku, name, quantity, list_price, offer_price, image_url, category_slug)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [offer.id, item.sku, item.name, Number(item.add_count), item.price, prices.get(item.sku), item.image_url, item.category_slug]
      );
    }
    await client.query("COMMIT");
    res.status(201).json({ offer });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Could not create offer." });
  } finally {
    client.release();
  }
});

router.get("/:token/pdf", async (req, res) => {
  try {
    const offer = await getOfferByToken(req.params.token);
    if (!offer) return res.status(404).json({ error: "Offer not found." });
    await createOfferPdf(offer, res);
  } catch (error) {
    res.status(500).json({ error: "Could not generate offer PDF." });
  }
});

router.get("/:token", async (req, res) => {
  try {
    const offer = await getOfferByToken(req.params.token);
    if (!offer) return res.status(404).json({ error: "Offer not found." });
    res.set("Cache-Control", "private, no-store").json({ offer });
  } catch (error) {
    res.status(500).json({ error: "Could not load offer." });
  }
});

module.exports = router;