"use strict";

const crypto = require("crypto");
const express = require("express");

const { query, withTransaction } = require("../db/database");
const { requireAdmin } = require("../middleware/require-admin");
const { uuid } = require("../services/public-catalogue-v1");
const { lookup, fail } = require("../services/wishlist-catalogue");

const { updateQuantity, storedQuantity } = require("../services/wishlist-quantity");

const router = express.Router();

router.use((_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});

const SESSION_HEADER = "x-wishlist-session";

const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getSessionHash(req, res) {
  const sessionId = req.get(SESSION_HEADER);

  if (!sessionId || !SESSION_ID_PATTERN.test(sessionId)) {
    res.status(400).json({
      error: "A valid wishlist session is required.",
    });
    return null;
  }

  return crypto
    .createHash("sha256")
    .update(sessionId)
    .digest("hex");
}

async function getWishlist(sessionHash) {
  const result = await query(
    "SELECT * FROM wishlists WHERE session_hash = $1",
    [sessionHash]
  );

  return result.rows[0] || null;
}

async function getItems(wishlistId) {
  const result = await query(
    `
      SELECT
        product_id,
        sku,
        name,
        price,
        currency,
        image_url,
        media,
        product_href,
        catalogue_revision,
        category_slug,
        add_count,
        add_count AS quantity,
        created_at,
        updated_at
      FROM wishlist_items
      WHERE wishlist_id = $1
      ORDER BY created_at, name
    `,
    [wishlistId]
  );

  return result.rows;
}

async function getWishlistResponse(wishlist) {
  if (!wishlist) return null;

  const { session_hash, ...publicWishlist } = wishlist;

  return {
    ...publicWishlist,
    items: await getItems(wishlist.id),
  };
}

function normalizeIndianMobile(value) {
  const digits = String(value || "").replace(/\D/g, "");

  const localNumber =
    digits.startsWith("91") && digits.length === 12
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
    res.json({
      wishlist: await getWishlistResponse(
        await getWishlist(sessionHash)
      ),
    });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.status
        ? error.message
        : "Could not process wishlist request.",
    });
  }
});

router.post("/session/items", async (req, res) => {
  const hash = getSessionHash(req, res);
  if (!hash) return;

  try {
    const product = await lookup(req.body.product_id);

    const result = await withTransaction(async (client) => {
      await client.query(
        `
          INSERT INTO wishlists (
            session_hash,
            share_token
          )
          VALUES ($1, $2)
          ON CONFLICT (session_hash) DO NOTHING
        `,
        [
          hash,
          crypto.randomBytes(24).toString("hex"),
        ]
      );

      const wishlistResult = await client.query(
        `
          SELECT *
          FROM wishlists
          WHERE session_hash = $1
          FOR UPDATE
        `,
        [hash]
      );

      const wishlist = wishlistResult.rows[0];

      if (wishlist.status !== "draft") {
        fail(409, "This wishlist has already been submitted.");
      }

      const countResult = await client.query(
        `
          SELECT count(*) AS count
          FROM wishlist_items
          WHERE wishlist_id = $1
        `,
        [wishlist.id]
      );

      const count = Number(countResult.rows[0].count);

      const existingResult = await client.query(
        `
          SELECT id
          FROM wishlist_items
          WHERE wishlist_id = $1
            AND product_id = $2
        `,
        [wishlist.id, product.product_id]
      );

      const exists = existingResult.rows.length > 0;

      if (!exists && count >= 100) {
        fail(409, "A wishlist can contain up to 100 products.");
      }

      await client.query(
        `
          INSERT INTO wishlist_items (
            wishlist_id,
            product_id,
            sku,
            name,
            price,
            currency,
            image_url,
            media,
            product_href,
            catalogue_revision
          )
          VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10
          )
          ON CONFLICT (wishlist_id, product_id)
          WHERE product_id IS NOT NULL
          DO UPDATE SET
            sku = EXCLUDED.sku,
            name = EXCLUDED.name,
            price = EXCLUDED.price,
            currency = EXCLUDED.currency,
            image_url = EXCLUDED.image_url,
            media = EXCLUDED.media,
            product_href = EXCLUDED.product_href,
            catalogue_revision = EXCLUDED.catalogue_revision,
            updated_at = NOW()
        `,
        [
          wishlist.id,
          product.product_id,
          product.sku,
          product.name,
          product.price,
          product.currency,
          product.image_url,
          JSON.stringify(product.media),
          product.product_href,
          product.catalogue_revision,
        ]
      );

      await client.query(
        `
          UPDATE wishlists
          SET updated_at = NOW()
          WHERE id = $1
        `,
        [wishlist.id]
      );

      return wishlist;
    });

    res.json({
      wishlist: await getWishlistResponse(result),
    });
  } catch (error) {
       console.error(
      JSON.stringify({
        event: "wishlist_add_failed",
        code: error.code || "ERROR",
        status: error.status || 503,
        message: error.message,
        schema: error.schema,
        table: error.table,
        column: error.column,
        position: error.position,
      })
    );

    res.status(error.status || 503).json({
      error: error.status
        ? error.message
        : "Wishlist temporarily unavailable.",
    });
  }
});

router.patch("/session/items/:id", async (req, res) => {
  const hash = getSessionHash(req, res);
  if (!hash) return;
  try {
    const wishlist = await updateQuantity({ withTransaction }, uuid, hash, req.params.id, req.body?.quantity);
    res.json({ wishlist: await getWishlistResponse(wishlist) });
  } catch (error) {
    res.status(error.status || 503).json({
      error: error.status ? error.message : "Wishlist quantity could not be saved. Retry before submitting.",
    });
  }
});

router.delete("/session/items/:id", async (req, res) => {
  const hash = getSessionHash(req, res);
  if (!hash) return;

  try {
    const identity = uuid(String(req.params.id));

    const wishlist = await withTransaction(async (client) => {
      const result = await client.query(
        `
          SELECT *
          FROM wishlists
          WHERE session_hash = $1
          FOR UPDATE
        `,
        [hash]
      );

      const row = result.rows[0];

      if (!row) {
        fail(404, "Wishlist not found.");
      }

      if (row.status !== "draft") {
        fail(409, "Submitted wishlists cannot be changed.");
      }

      await client.query(
        `DELETE FROM wishlist_items WHERE wishlist_id = $1 AND product_id = $2`,
        [row.id, identity]
      );

      await client.query(
        `
          UPDATE wishlists
          SET updated_at = NOW()
          WHERE id = $1
        `,
        [row.id]
      );

      return row;
    });

    res.json({
      wishlist: await getWishlistResponse(wishlist),
    });
  } catch (error) {
    res.status(error.status || 503).json({
      error: error.status
        ? error.message
        : "Wishlist temporarily unavailable.",
    });
  }
});

router.post("/session/submit", async (req, res) => {
  const sessionHash = getSessionHash(req, res);
  if (!sessionHash) return;

  const name = String(req.body.name || "").trim();
  const mobileNumber = normalizeIndianMobile(
    req.body.mobile_number
  );
  const email =
    String(req.body.email || "").trim().toLowerCase() || null;
  const pinCode = String(req.body.pin_code || "").trim();
  const requirements = String(
    req.body.requirements || ""
  ).trim();

  if (name.length < 2 || name.length > 160) {
    return res.status(400).json({
      error: "Enter your name (2 to 160 characters).",
    });
  }

  if (!mobileNumber) {
    return res.status(400).json({
      error: "Enter a valid 10-digit Indian mobile number.",
    });
  }

  if (
    email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return res.status(400).json({
      error: "Enter a valid email address.",
    });
  }

  if (!/^[1-9][0-9]{5}$/.test(pinCode)) {
    return res.status(400).json({
      error: "Enter a valid 6-digit Indian PIN code.",
    });
  }

  if (requirements.length > 5000) {
    return res.status(400).json({
      error: "Requirements must be 5000 characters or fewer.",
    });
  }

  try {
    const result = await withTransaction(async (client) => {
      const wishlistResult = await client.query(
        `
          SELECT *
          FROM wishlists
          WHERE session_hash = $1
          FOR UPDATE
        `,
        [sessionHash]
      );

      const wishlist = wishlistResult.rows[0];

      if (!wishlist) {
        fail(404, "Add a product before submitting an enquiry.");
      }

      if (wishlist.status !== "draft") {
        fail(409, "This wishlist has already been submitted.");
      }

      const itemsResult = await client.query(
        `
          SELECT *
          FROM wishlist_items
          WHERE wishlist_id = $1
          ORDER BY id
        `,
        [wishlist.id]
      );

      const items = itemsResult.rows;

      if (!items.length) {
        fail(400, "Add at least one product before submitting.");
      }

      for (const item of items) {
        storedQuantity(item.add_count);
        if (!item.product_id) {
          fail(
            409,
            "Catalogue identity integrity check failed. Please contact the administrator; no SKU fallback is available."
          );
        }

        const product = await lookup(item.product_id);

        await client.query(
          `
            UPDATE wishlist_items
            SET
              sku = $2,
              name = $3,
              price = $4,
              currency = $5,
              image_url = $6,
              media = $7,
              product_href = $8,
              catalogue_revision = $9,
              updated_at = NOW()
            WHERE id = $1
          `,
          [
            item.id,
            product.sku,
            product.name,
            product.price,
            product.currency,
            product.image_url,
            JSON.stringify(product.media),
            product.product_href,
            product.catalogue_revision,
          ]
        );
      }

      return client.query(
        `
          UPDATE wishlists
          SET
            customer_name = $2,
            mobile_number = $3,
            email = $4,
            pin_code = $5,
            requirements = $6,
            status = 'submitted',
            submitted_at = NOW(),
            updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `,
        [
          wishlist.id,
          name,
          mobileNumber,
          email,
          pinCode,
          requirements,
        ]
      );
    });

    res.json({
      wishlist: await getWishlistResponse(result.rows[0]),
    });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.status
        ? error.message
        : "Could not process wishlist request.",
    });
  }
});

router.post("/session/whatsapp-opened", async (req, res) => {
  const sessionHash = getSessionHash(req, res);
  if (!sessionHash) return;

  try {
    const result = await query(
      `
        UPDATE wishlists
        SET
          communication_channel = 'whatsapp',
          whatsapp_opened_at = NOW(),
          updated_at = NOW()
        WHERE session_hash = $1
          AND status <> 'draft'
        RETURNING
          share_token,
          communication_channel,
          whatsapp_opened_at
      `,
      [sessionHash]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: "Submitted enquiry not found.",
      });
    }

    res.json({
      enquiry: result.rows[0],
    });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.status
        ? error.message
        : "Could not process wishlist request.",
    });
  }
});

router.get("/admin", requireAdmin, async (_req, res) => {
  try {
    const result = await query(
      `
        SELECT
          w.id,
          w.share_token,
          w.customer_name,
          w.mobile_number,
          w.email,
          w.pin_code,
          w.status,
          w.communication_channel,
          w.whatsapp_opened_at,
          w.updated_at,
          w.submitted_at,
          COUNT(i.id)::integer AS item_count,
          COALESCE(SUM(i.add_count), 0)::bigint AS total_quantity
        FROM wishlists w
        LEFT JOIN wishlist_items i
          ON i.wishlist_id = w.id
        WHERE w.status <> 'draft'
        GROUP BY w.id
        ORDER BY w.updated_at DESC
      `
    );

    res.set("Cache-Control", "no-store").json({
      enquiries: result.rows,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.status
        ? error.message
        : "Could not process wishlist request.",
    });
  }
});

router.get(
  "/admin/analytics",
  requireAdmin,
  async (_req, res) => {
    try {
      const { analytics } = require(
        "../services/wishlist-analytics-ui"
      );

      res.set("Cache-Control", "private, no-store").json({
        products: await analytics(query),
      });
    } catch (_) {
      res.status(500).json({
        error: "Could not load wishlist analytics.",
      });
    }
  }
);

router.get("/admin/:token", requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `
        SELECT
          id,
          share_token,
          status,
          customer_name,
          mobile_number,
          email,
          pin_code,
          requirements,
          communication_channel,
          whatsapp_opened_at,
          created_at,
          updated_at,
          submitted_at
        FROM wishlists
        WHERE share_token = $1
          AND status <> 'draft'
      `,
      [req.params.token]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: "Enquiry not found.",
      });
    }

    res.set("Cache-Control", "no-store").json({
      enquiry: await getWishlistResponse(result.rows[0]),
    });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.status
        ? error.message
        : "Could not process wishlist request.",
    });
  }
});

router.patch(
  "/admin/:token/status",
  requireAdmin,
  async (req, res) => {
    const status = String(req.body.status || "");

    if (!["contacted", "closed"].includes(status)) {
      return res.status(400).json({
        error: "Status must be contacted or closed.",
      });
    }

    try {
      const result = await query(
        `
          UPDATE wishlists
          SET
            status = $2,
            updated_at = NOW()
          WHERE share_token = $1
            AND status <> 'draft'
          RETURNING
            id,
            share_token,
            status,
            updated_at,
            customer_name,
            mobile_number,
            email,
            pin_code,
            requirements,
            submitted_at
        `,
        [req.params.token, status]
      );

      if (!result.rows.length) {
        return res.status(404).json({
          error: "Enquiry not found.",
        });
      }

      res.json({
        enquiry: await getWishlistResponse(result.rows[0]),
      });
    } catch (error) {
      res.status(error.status || 500).json({
        error: error.status
          ? error.message
          : "Could not process wishlist request.",
      });
    }
  }
);

module.exports = router;