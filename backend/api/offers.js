"use strict";

const crypto = require("crypto");
const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const {roundOfferRupees}=require("../services/offer-pricing");
const {createOfferImageLoader}=require("../services/offer-image-cache");
const {readSiteLogo,renderSiteLogo}=require("../services/offer-logo");
const PDFDocument = require("pdfkit");

const { pool, query } = require("../db/database");
const { requireAdmin } = require("../middleware/require-admin");
const {
  uuid,
  storageKey,
} = require("../services/public-catalogue-v1");
const { money } = require("../services/wishlist-catalogue");
const catalogueDb = require("../db/catalogue");
const { storedQuantity } = require("../services/wishlist-quantity");

const router = express.Router();

router.use((_req, res, next) => {
  res.set({
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow",
  });
  next();
});

const TERM_FIELDS = [
  "gst",
  "payment_terms",
  "payment_details",
  "other_terms",
];

function normalizeTerms(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const terms = {};

  for (const field of TERM_FIELDS) {
    const text =
      typeof value[field] === "string" ? value[field].trim() : "";

    if (text.length > 2000) return null;
    terms[field] = text;
  }

  const rawDays = value.delivery_days;

  if (rawDays === null || rawDays === undefined || rawDays === "") {
    terms.delivery_days = null;
  } else {
    const days = Number(rawDays);

    if (!Number.isInteger(days) || days < 1 || days > 365) {
      return null;
    }

    terms.delivery_days = days;
  }

  return terms;
}

function getTotals(items) {
  const listTotal = items.reduce(
    (sum, item) =>
      sum +
      Math.round(Number(item.list_price) * 100) * item.quantity,
    0
  );

  const offerTotal = items.reduce(
    (sum, item) =>
      sum +
      Math.round(Number(item.offer_price) * 100) * item.quantity,
    0
  );

  const savings = listTotal - offerTotal;

  return {
    list_total: listTotal / 100,
    offer_total: offerTotal / 100,
    savings: savings / 100,
    discount_percent: listTotal
      ? Math.round((savings / listTotal) * 10000) / 100
      : 0,
  };
}

function offerMediaUrl(token, url) {
  if (
    typeof url === "string" &&
    /^\/api\/catalogue\/media\/[0-9a-f-]{36}$/i.test(url)
  ) {
    return (
      "/api/offers/" +
      encodeURIComponent(token) +
      "/media/" +
      url.split("/").pop()
    );
  }

  return url;
}

async function getOfferByToken(token) {
  const result = await query(
    `
      SELECT
        offer.id,
        offer.offer_token,
        offer.version,
        offer.status,
        offer.terms,
        offer.expires_at,
        offer.created_at,
        wishlist.customer_name
      FROM wishlist_offers offer
      JOIN wishlists wishlist
        ON wishlist.id = offer.wishlist_id
      WHERE offer.offer_token = $1
    `,
    [token]
  );

  if (!result.rows.length) return null;

  const offer = result.rows[0];

  const itemResult = await query(
    `
      SELECT
        product_id,
        currency,
        media,
        product_href,
        catalogue_revision,
        sku,
        name,
        quantity,
        list_price,
        offer_price,
        image_url,
        category_slug
      FROM wishlist_offer_items
      WHERE offer_id = $1
      ORDER BY name, sku
    `,
    [offer.id]
  );

  const items = itemResult.rows.map((item) => ({
    ...item,
    image_url: offerMediaUrl(token, item.image_url),
    media: (item.media || []).map((media) => ({
      ...media,
      url: offerMediaUrl(token, media.url),
    })),
    quantity: Number(item.quantity),
    list_price: Number(item.list_price),
    offer_price: Number(item.offer_price),
  }));

  return {
    ...offer,
    items: items.map((item) => ({
      ...item,
      discount_percent: item.list_price
        ? Math.round(
            ((item.list_price - item.offer_price) /
              item.list_price) *
              10000
          ) / 100
        : 0,
    })),
    ...getTotals(items),
  };
}

async function offerMediaFile(token, id) {
  uuid(id);

  const result = await query(
    `
      SELECT i.product_id, i.media
      FROM wishlist_offer_items i
      JOIN wishlist_offers o ON o.id = i.offer_id
      WHERE o.offer_token = $1
    `,
    [token]
  );

  const item = result.rows.find((row) =>
    (row.media || []).some(
      (media) =>
        media.id === id &&
        media.url === "/api/catalogue/media/" + id
    )
  );

  if (!item) {
    const error = new Error("Media not found");
    error.status = 404;
    throw error;
  }

  const mediaResult = await catalogueDb.query(
    `
      SELECT storage_key, media_type
      FROM product_media
      WHERE id = $1 AND product_id = $2
    `,
    [id, item.product_id]
  );

  const media = mediaResult.rows[0];

  if (!media || !storageKey(media.storage_key)) {
    const error = new Error("Media not found");
    error.status = 404;
    throw error;
  }

  const root = await fs.realpath(
    require("../services/media-storage").getMediaRoot()
  );

  const file = await fs.realpath(
    path.join(root, media.storage_key)
  );

  if (!file.startsWith(root + path.sep)) {
    const error = new Error("Media not found");
    error.status = 404;
    throw error;
  }

  const stat = await fs.stat(file);

  if (!stat.isFile()) {
    const error = new Error("Media not found");
    error.status = 404;
    throw error;
  }

  return {
    file,
    size: stat.size,
    ext: path.extname(file).toLowerCase(),
  };
}

function formatMoney(value) {
  return `INR ${Number(value).toFixed(Number.isInteger(Number(value)) ? 0 : 2)}`;
}

function getAllowedImageOrigins() {
  const values = [
    process.env.IMAGE_REPO_URL,
    ...(process.env.FRONTEND_ORIGIN || "").split(","),
  ];

  const origins = new Set();

  for (const rawValue of values) {
    const value = (rawValue || "").trim();
    if (!value) continue;

    try {
      const url = new URL(value);

      if (url.protocol === "http:" || url.protocol === "https:") {
        origins.add(url.origin);
      }
    } catch {
      console.warn(
        "[offer-pdf] Invalid image origin configuration:",
        value
      );
    }
  }

  return [...origins];
}

async function loadProductImage(imageUrl, document) {
  if (
    typeof imageUrl === "string" &&
    /^\/api\/offers\/[0-9a-f]{64}\/media\/[0-9a-f-]{36}$/i.test(
      imageUrl
    )
  ) {
    try {
      const parts = imageUrl.split("/");
      const media = await offerMediaFile(parts[3], parts[5]);

      if (
        media.size > 4_000_000 ||
        ![".png", ".jpg"].includes(media.ext)
      ) {
        return null;
      }

      const buffer = await fs.readFile(media.file);
      document.openImage(buffer);
      return buffer;
    } catch (_) {
      return null;
    }
  }

  const MAX_IMAGE_BYTES = 4_000_000;
  const DOWNLOAD_TIMEOUT_MS = 10_000;

  const logFailure = (reason, details = {}) => {
    console.warn("[offer-pdf] Image skipped:", {
      reason,
      ...details,
    });
  };

  if (typeof imageUrl !== "string" || !imageUrl.trim()) {
    return null;
  }

  let source;
  let publicPath;
  let imageRepoBase;

  try {
    const configuredBase = (
      process.env.IMAGE_REPO_URL || ""
    ).trim();

    if (!configuredBase) {
      logFailure("IMAGE_REPO_URL is missing");
      return null;
    }

    imageRepoBase = new URL(configuredBase);

    if (!["http:", "https:"].includes(imageRepoBase.protocol)) {
      logFailure("IMAGE_REPO_URL must use HTTP or HTTPS");
      return null;
    }

    source = new URL(imageUrl.trim(), imageRepoBase);

    if (!["http:", "https:"].includes(source.protocol)) {
      logFailure("Unsupported URL protocol", {
        protocol: source.protocol,
      });
      return null;
    }

    if (source.username || source.password) {
      logFailure("Image URL must not contain credentials");
      return null;
    }

    publicPath = decodeURIComponent(source.pathname).replace(
      /^\/+/,
      ""
    );

    if (!publicPath || publicPath.includes("\0")) {
      logFailure("Invalid image pathname");
      return null;
    }
  } catch (error) {
    logFailure("Invalid image URL or pathname", {
      message: error.message,
    });
    return null;
  }

  // Do not log query parameters that may contain signed tokens.
  const imageDetails = {
    origin: source.origin,
    pathname: source.pathname,
  };

  if (!getAllowedImageOrigins().includes(source.origin)) {
    logFailure("Image origin is not allowed", imageDetails);
    return null;
  }

  const publicRoot = process.env.IMAGE_PUBLIC_ROOT
    ? path.resolve(process.env.IMAGE_PUBLIC_ROOT)
    : path.resolve(__dirname, "../../frontend/public");

  const localCandidates = [
    path.resolve(publicRoot, publicPath),
  ];

  if (publicPath.startsWith("uploads/")) {
    localCandidates.push(
      path.resolve(
        publicRoot,
        "uploads",
        path.basename(publicPath)
      )
    );
  }

  for (const localPath of new Set(localCandidates)) {
    const relativePath = path.relative(publicRoot, localPath);

    if (
      !relativePath ||
      relativePath === ".." ||
      relativePath.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativePath)
    ) {
      continue;
    }

    try {
      const realRoot = await fs.realpath(publicRoot);
      const realPath = await fs.realpath(localPath);
      const realRelative = path.relative(realRoot, realPath);

      if (
        !realRelative ||
        realRelative === ".." ||
        realRelative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(realRelative)
      ) {
        continue;
      }

      const details = await fs.stat(realPath);

      if (
        !details.isFile() ||
        details.size > MAX_IMAGE_BYTES
      ) {
        continue;
      }

      const buffer = await fs.readFile(realPath);

      if (
        !buffer.length ||
        buffer.length > MAX_IMAGE_BYTES
      ) {
        continue;
      }

      document.openImage(buffer);
      return buffer;
    } catch (error) {
      if (error.code !== "ENOENT") {
        logFailure("Local image read or decode failed", {
          localPath,
          message: error.message,
        });
      }
    }
  }

  const isLoopback = [
    "localhost",
    "127.0.0.1",
    "[::1]",
  ].includes(source.hostname);

  if (source.protocol !== "https:" && !isLoopback) {
    logFailure("Remote image requires HTTPS", imageDetails);
    return null;
  }

  try {
    const response = await fetch(source, {
      redirect: "error",
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      headers: {
        Accept: "image/png, image/jpeg",
      },
    });

    const contentType = (
      response.headers.get("content-type") || ""
    ).toLowerCase();

    const contentLength = Number(
      response.headers.get("content-length") || 0
    );

    if (
      !response.ok ||
      !contentType.startsWith("image/") ||
      contentLength > MAX_IMAGE_BYTES ||
      !response.body
    ) {
      if (response.body) {
        await response.body.cancel();
      }

      logFailure("Image HTTP response rejected", {
        ...imageDetails,
        status: response.status,
        contentType,
        contentLength,
      });

      return null;
    }

    const reader = response.body.getReader();
    const chunks = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        totalBytes += value.byteLength;

        if (totalBytes > MAX_IMAGE_BYTES) {
          await reader.cancel();
          logFailure("Image exceeds 4 MB", imageDetails);
          return null;
        }

        chunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }

    if (!totalBytes) {
      logFailure("Image response is empty", imageDetails);
      return null;
    }

    const imageBuffer = Buffer.concat(chunks, totalBytes);

    try {
      document.openImage(imageBuffer);
    } catch (error) {
      logFailure(
        "PDFKit could not decode image; use JPEG or PNG",
        {
          ...imageDetails,
          contentType,
          message: error.message,
        }
      );

      return null;
    }

    return imageBuffer;
  } catch (error) {
    logFailure("Remote image download failed", {
      ...imageDetails,
      message: error.message,
      cause: error.cause?.message,
      code: error.cause?.code || error.code,
    });

    return null;
  }
}

function addPdfTableHeader(document) {
  document
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor("#18382e");

  const headerY = document.y;

  document.text("Product", 98, headerY, { width: 105 });
  document.text("Qty", 211, headerY, {
    width: 28,
    align: "right",
  });
  document.text("List price", 246, headerY, {
    width: 75,
    align: "right",
  });
  document.text("Discount", 328, headerY, {
    width: 55,
    align: "right",
  });
  document.text("Offer price", 390, headerY, {
    width: 74,
    align: "right",
  });
  document.text("Line total", 471, headerY, {
    width: 82,
    align: "right",
  });

  document.y = headerY + 14;
  document.moveDown(0.7);
  document
    .moveTo(42, document.y)
    .lineTo(553, document.y)
    .strokeColor("#cbd4ca")
    .stroke();
  document.moveDown(0.6);
}

async function createOfferPdf(offer, response) {
  const logoSvg = await readSiteLogo();
  const document = new PDFDocument({
    size: "A4",
    margin: 42,
    bufferPages: true,
  });
  const loadOfferImage = createOfferImageLoader((imageUrl) => loadProductImage(imageUrl, document));

  response.setHeader("Content-Type", "application/pdf");
  response.setHeader(
    "Content-Disposition",
    'attachment; filename="Luminoza-Price-Offer.pdf"'
  );
  response.setHeader("Cache-Control", "private, no-store");

  document.on("error", (error) => response.destroy(error));

  response.on("close", () => {
    if (!response.writableEnded) document.destroy();
  });

  document.pipe(response);

  renderSiteLogo(document, logoSvg);

  document
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#30343a")
    .text(
      "Beautiful lighting! Exuberant living!",
      42,
      88
    );

  document
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor("#18382e")
    .text("Personalized price offer", 42, 104);

  document
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#333333");

  document.text(
    `Prepared for: ${offer.customer_name || "Customer"}`,
    42,
    128,
    { width: 511 }
  );

  document.text(
    `Offer reference: ${offer.offer_token
      .slice(0, 12)
      .toUpperCase()}`
  );

  document.text(
    `Created: ${new Date(
      offer.created_at
    ).toLocaleDateString("en-IN")}`
  );

  if (offer.expires_at) {
    document.text(
      `Valid until: ${new Date(
        offer.expires_at
      ).toLocaleDateString("en-IN", {
        timeZone: "UTC",
      })}`
    );
  }

  document.text(
    "9600096298  |  8124969000  |  pradeep33.tcs@gmail.com"
  );

  document.moveDown(1);
  addPdfTableHeader(document);

  for (const item of offer.items) {
    const productText = `${item.name}\nSKU: ${item.sku}`;

    const rowHeight = Math.max(
      54,
      document.heightOfString(productText, {
        width: 105,
      }) + 8
    );

    if (
      document.y + rowHeight >
      document.page.height - 60
    ) {
      document.addPage();
      addPdfTableHeader(document);
    }

    const y = document.y;

    document
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#222222");

    const imageBuffer = await loadOfferImage(item.image_url);

    if (imageBuffer) {
      document.image(imageBuffer, 42, y, {
        fit: [48, 48],
        align: "center",
        valign: "center",
      });
    } else {
      document
        .rect(42, y, 48, 48)
        .strokeColor("#d9ded5")
        .stroke();
    }

    document.text(productText, 98, y, {
      width: 105,
    });
    document.text(String(item.quantity), 211, y, {
      width: 28,
      align: "right",
    });
    document.text(formatMoney(item.list_price), 246, y, {
      width: 75,
      align: "right",
    });
    document.text(`${item.discount_percent}%`, 328, y, {
      width: 55,
      align: "right",
    });
    document.text(formatMoney(item.offer_price), 390, y, {
      width: 74,
      align: "right",
    });
    document.text(
      formatMoney(item.offer_price * item.quantity),
      471,
      y,
      {
        width: 82,
        align: "right",
      }
    );

    document.y = y + rowHeight;

    document
      .moveTo(42, document.y)
      .lineTo(553, document.y)
      .strokeColor("#e1e6df")
      .stroke();

    document.moveDown(0.5);
  }

  if (document.y > document.page.height - 160) {
    document.addPage();
  }

  document.moveDown(0.5);
  document.x = 42;

  document
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#333333");

  const addSummaryLine = (
    label,
    value,
    emphasized = false
  ) => {
    const y = document.y;

    document
      .font(
        emphasized ? "Helvetica-Bold" : "Helvetica"
      )
      .fillColor(
        emphasized ? "#18382e" : "#333333"
      );

    document.text(label, 42, y, { width: 350 });
    document.text(value, 392, y, {
      width: 161,
      align: "right",
    });

    document.y = y + 17;
  };

  addSummaryLine(
    "Subtotal at list prices",
    formatMoney(offer.list_total)
  );
  addSummaryLine(
    `Discount offered (${offer.discount_percent}%)`,
    `- ${formatMoney(offer.savings)}`
  );
  addSummaryLine(
    "Offer total",
    formatMoney(offer.offer_total),
    true
  );

  document.moveDown(1.2);
  document.x = 42;

  const terms = offer.terms || {};

  const termLines = [
    ["GST / tax", terms.gst],
    ["Payment terms", terms.payment_terms],
    ["Account / payment details", terms.payment_details],
    [
      "Estimated delivery",
      terms.delivery_days
        ? `${terms.delivery_days} days`
        : "",
    ],
    ["Additional terms", terms.other_terms],
  ].filter(([, value]) => value);

  if (termLines.length) {
    document.x = 42;

    document
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#18382e")
      .text(
        "Terms and conditions",
        42,
        document.y,
        { width: 511 }
      );

    document.moveDown(0.4);

    for (const [label, value] of termLines) {
      if (document.y > document.page.height - 55) {
        document.addPage();
      }

      document.x = 42;

      document
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor("#333333")
        .text(`${label}:`, 42, document.y, {
          width: 511,
        });

      document.x = 42;

      document
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#333333")
        .text(String(value), 42, document.y, {
          width: 511,
        });

      document.moveDown(0.3);
    }
  }

  document.moveDown(0.8);

  if (document.y > document.page.height - 105) {
    document.addPage();
  }

  document.x = 42;

  document
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#18382e")
    .text(
      "Visit our showrooms",
      42,
      document.y,
      { width: 511 }
    );

  document.moveDown(0.4);

  document
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#333333");

  document.text(
    "LED Zone - No 10, Ratan Bazaar, Evening Bazaar, Tamil Nadu",
    42,
    document.y,
    {
      width: 511,
      link: "https://maps.app.goo.gl/t5Sg3MG2oLgyoBX26",
      underline: true,
    }
  );

  document.text(
    "HomeStory - 1/348, East Coast Rd, Anna Enclave, Injambakkam, Chennai, Tamil Nadu 600115",
    42,
    document.y,
    {
      width: 511,
      link: "https://share.google/jrM4UJC2TDh3p9sga",
      underline: true,
    }
  );

  document.end();
}

router.get(
  "/enquiry/:shareToken",
  requireAdmin,
  async (req, res) => {
    try {
      const result = await query(
        `
          SELECT
            offer.id,
            offer.offer_token,
            offer.version,
            offer.status,
            offer.terms,
            offer.expires_at,
            offer.created_at
          FROM wishlist_offers offer
          JOIN wishlists wishlist
            ON wishlist.id = offer.wishlist_id
          WHERE wishlist.share_token = $1
          ORDER BY offer.version DESC
        `,
        [req.params.shareToken]
      );

      res.set("Cache-Control", "no-store").json({
        offers: result.rows,
      });
    } catch (error) {
      res.status(500).json({
        error: "Could not load offers.",
      });
    }
  }
);

router.post(
  "/enquiry/:shareToken",
  requireAdmin,
  async (req, res) => {
    const terms = normalizeTerms(req.body.terms);

    if (!terms) {
      return res.status(400).json({
        error: "Check the offer terms and delivery days.",
      });
    }

    if (
      !Array.isArray(req.body.items) ||
      !req.body.items.length ||
      req.body.items.length > 100
    ) {
      return res.status(400).json({
        error:
          "Offer prices are required for the enquiry items.",
      });
    }

    let expiresAt = null;

    if (req.body.expires_at) {
      const expiryValue = String(req.body.expires_at);

      expiresAt = /^\d{4}-\d{2}-\d{2}$/.test(expiryValue)
        ? new Date(`${expiryValue}T23:59:59.999Z`)
        : new Date(expiryValue);

      if (
        Number.isNaN(expiresAt.getTime()) ||
        expiresAt.getTime() <= Date.now()
      ) {
        return res.status(400).json({
          error: "Offer expiry must be a future date.",
        });
      }
    }

    const prices = new Map();

    for (const item of req.body.items) {
      let productId;
      let price;

      try {
        productId = uuid(item.product_id);
        price = roundOfferRupees(money(item.offer_price));
      } catch (_) {
        return res.status(400).json({
          error:
            "A catalogue UUID and valid price are required for each item.",
        });
      }

      if (
        !productId ||
        prices.has(productId) ||
        !Number.isFinite(price) ||
        price < 0
      ) {
        return res.status(400).json({
          error:
            "Each product needs one valid non-negative offer price.",
        });
      }

      prices.set(
        productId,
        Math.round(price * 100) / 100
      );
    }

    let client;

    try {
      client = await pool.connect();
      await client.query("BEGIN");

      const enquiryResult = await client.query(
        `
          SELECT id
          FROM wishlists
          WHERE share_token = $1
            AND status <> 'draft'
          FOR UPDATE
        `,
        [req.params.shareToken]
      );

      if (!enquiryResult.rows.length) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error: "Submitted enquiry not found.",
        });
      }

      const wishlistId = enquiryResult.rows[0].id;

      const itemResult = await client.query(
        `
          SELECT
            product_id,
            currency,
            media,
            product_href,
            catalogue_revision,
            sku,
            name,
            price,
            image_url,
            category_slug,
            add_count AS quantity
          FROM wishlist_items
          WHERE wishlist_id = $1
          ORDER BY created_at, name
        `,
        [wishlistId]
      );

      if (
        itemResult.rows.length !== prices.size ||
        itemResult.rows.some(
          (item) => !prices.has(item.product_id)
        )
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error:
            "An offer price is required for every enquiry item.",
        });
      }

      for (const item of itemResult.rows) {
        storedQuantity(item.quantity);
        if (item.currency !== "INR") {
          await client.query("ROLLBACK");

          return res.status(409).json({
            error: "Only INR enquiries are supported.",
          });
        }

        if (
          prices.get(item.product_id) >
          Number(item.price)
        ) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            error:
              `Offer price for ${item.sku} ` +
              "after rounding cannot exceed its enquiry price.",
          });
        }
      }

      const versionResult = await client.query(
        `
          SELECT
            COALESCE(MAX(version), 0)::integer + 1 AS version
          FROM wishlist_offers
          WHERE wishlist_id = $1
        `,
        [wishlistId]
      );

      const version = versionResult.rows[0].version;
      const offerToken = crypto
        .randomBytes(32)
        .toString("hex");

      const offerResult = await client.query(
        `
          INSERT INTO wishlist_offers (
            wishlist_id,
            offer_token,
            version,
            terms,
            expires_at,
            created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING
            id,
            offer_token,
            version,
            status,
            terms,
            expires_at,
            created_at
        `,
        [
          wishlistId,
          offerToken,
          version,
          JSON.stringify(terms),
          expiresAt,
          req.admin.id,
        ]
      );

      const offer = offerResult.rows[0];

      for (const item of itemResult.rows) {
        await client.query(
          `
            INSERT INTO wishlist_offer_items (
              offer_id,
              sku,
              name,
              quantity,
              list_price,
              offer_price,
              image_url,
              category_slug,
              product_id,
              currency,
              media,
              product_href,
              catalogue_revision
            )
            VALUES (
              $1, $2, $3, $4, $5,
              $6, $7, $8, $9, $10,
              $11, $12, $13
            )
          `,
          [
            offer.id,
            item.sku,
            item.name,
            storedQuantity(item.quantity),
            item.price,
            prices.get(item.product_id),
            item.image_url,
            item.category_slug,
            item.product_id,
            item.currency,
            JSON.stringify(item.media || []),
            item.product_href,
            item.catalogue_revision,
          ]
        );
      }

      await client.query("COMMIT");

      res.status(201).json({ offer });
    } catch (error) {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch (_) {
          // Preserve the original error.
        }
      }

      console.error(
        JSON.stringify({
          event: "offer_create_failed",
          code: error.code || "ERROR",
          message: error.message,
          schema: error.schema,
          table: error.table,
          column: error.column,
          constraint: error.constraint,
          position: error.position,
        })
      );

      res.status(error.status === 409 ? 409 : 500).json({
        error: error.status === 409 ? error.message : "Could not create offer.",
      });
    } finally {
      if (client) client.release();
    }
  }
);

router.get("/:token/media/:id", async (req, res) => {
  try {
    const media = await offerMediaFile(
      req.params.token,
      req.params.id
    );

    const types = {
      ".jpg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".mp4": "video/mp4",
    };

    if (!types[media.ext]) {
      return res.status(404).end();
    }

    res.set({
      "Content-Type": types[media.ext],
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'none'; sandbox",
    });

    res.sendFile(
      media.file,
      {
        cacheControl: false,
        lastModified: false,
      },
      (error) => {
        if (error && !res.headersSent) {
          res.status(404).end();
        }
      }
    );
  } catch (_) {
    res.status(404).json({
      error: "Media not found",
    });
  }
});

router.get("/:token/pdf", async (req, res) => {
  try {
    const offer = await getOfferByToken(
      req.params.token
    );

    if (!offer) {
      return res.status(404).json({
        error: "Offer not found.",
      });
    }

    await createOfferPdf(offer, res);
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({
        error: "Could not generate offer PDF.",
      });
    } else {
      res.destroy(error);
    }
  }
});

router.get("/:token", async (req, res) => {
  try {
    const offer = await getOfferByToken(
      req.params.token
    );

    if (!offer) {
      return res.status(404).json({
        error: "Offer not found.",
      });
    }

    res.set("Cache-Control", "private, no-store").json({
      offer,
    });
  } catch (error) {
    res.status(500).json({
      error: "Could not load offer.",
    });
  }
});

module.exports = router;