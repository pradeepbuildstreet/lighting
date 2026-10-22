CREATE INDEX IF NOT EXISTS wishlist_items_enquiry_product_idx ON wishlist_items(product_id,wishlist_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS wishlists_submitted_enquiry_idx ON wishlists(id) WHERE submitted_at IS NOT NULL;
