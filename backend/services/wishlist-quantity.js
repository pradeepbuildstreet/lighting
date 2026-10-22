"use strict";
const MAX_QUANTITY = 9999;
function fail(status, message) { const error = new Error(message); error.status = status; throw error; }
function quantity(value) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > MAX_QUANTITY) {
    fail(400, `Quantity must be a whole number from 1 to ${MAX_QUANTITY}.`);
  }
  return value;
}
function storedQuantity(value) {
  const result = Number(value);
  if (!Number.isInteger(result) || result < 1 || result > 2147483647) {
    fail(409, "The saved item quantity is invalid. Review the enquiry before creating an offer.");
  }
  return result;
}
async function updateQuantity(db, validateUuid, sessionHash, productId, value) {
  const identity = validateUuid(productId);
  const next = quantity(value);
  return db.withTransaction(async client => {
    const found = await client.query("SELECT * FROM wishlists WHERE session_hash = $1 FOR UPDATE", [sessionHash]);
    const wishlist = found.rows[0];
    if (!wishlist) fail(404, "Wishlist not found.");
    if (wishlist.status !== "draft") fail(409, "Submitted wishlists cannot be changed.");
    // Existing storage column retained; quantity is the explicit API contract, not an event counter.
    const changed = await client.query(`UPDATE wishlist_items SET add_count = $3, updated_at = NOW()
      WHERE wishlist_id = $1 AND product_id = $2 RETURNING id`, [wishlist.id, identity, next]);
    if (!changed.rows.length) fail(404, "Product not found in this wishlist.");
    const updated = await client.query("UPDATE wishlists SET updated_at = NOW() WHERE id = $1 RETURNING *", [wishlist.id]);
    return updated.rows[0];
  });
}
module.exports = { MAX_QUANTITY, quantity, storedQuantity, updateQuantity };
