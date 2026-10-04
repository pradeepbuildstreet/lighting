CREATE INDEX IF NOT EXISTS idx_wishlist_items_sku_wishlist
  ON wishlist_items (sku, wishlist_id);