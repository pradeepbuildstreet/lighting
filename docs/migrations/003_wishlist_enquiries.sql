BEGIN;

CREATE TABLE IF NOT EXISTS wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_hash CHAR(64) NOT NULL UNIQUE,
  share_token VARCHAR(64) NOT NULL UNIQUE,
  customer_name VARCHAR(160),
  mobile_number VARCHAR(20),
  email VARCHAR(254),
  pin_code CHAR(6),
  requirements TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'contacted', 'closed')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMP,
  CONSTRAINT wishlist_customer_details_complete CHECK (
    status = 'draft' OR (
      customer_name IS NOT NULL AND
      mobile_number IS NOT NULL AND
      pin_code IS NOT NULL AND
      submitted_at IS NOT NULL
    )
  )
);

CREATE TABLE IF NOT EXISTS wishlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wishlist_id UUID NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
  sku VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  image_url VARCHAR(500),
  category_slug VARCHAR(100),
  add_count INTEGER NOT NULL DEFAULT 1 CHECK (add_count > 0),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (wishlist_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_wishlists_status_updated
  ON wishlists (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_wishlists_submitted
  ON wishlists (submitted_at DESC)
  WHERE submitted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wishlist_items_wishlist
  ON wishlist_items (wishlist_id, created_at);

COMMIT;