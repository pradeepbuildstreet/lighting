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
  communication_channel VARCHAR(20),
  whatsapp_opened_at TIMESTAMPTZ,
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

CREATE INDEX IF NOT EXISTS idx_wishlists_status_updated ON wishlists (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_wishlists_submitted ON wishlists (submitted_at DESC) WHERE submitted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wishlist_items_wishlist ON wishlist_items (wishlist_id, created_at);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_sku_wishlist ON wishlist_items (sku, wishlist_id);


CREATE TABLE IF NOT EXISTS wishlist_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wishlist_id UUID NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
  offer_token VARCHAR(64) NOT NULL UNIQUE,
  version INTEGER NOT NULL CHECK (version > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'ready'
    CHECK (status IN ('ready', 'accepted', 'declined', 'expired')),
  terms JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wishlist_id, version)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_offers_wishlist_created
  ON wishlist_offers (wishlist_id, created_at DESC);

CREATE TABLE IF NOT EXISTS wishlist_offer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES wishlist_offers(id) ON DELETE CASCADE,
  sku VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  list_price DECIMAL(12,2) NOT NULL CHECK (list_price >= 0),
  offer_price DECIMAL(12,2) NOT NULL CHECK (offer_price >= 0 AND offer_price <= list_price),
  image_url VARCHAR(500),
  category_slug VARCHAR(100),
  UNIQUE (offer_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_offer_items_offer ON wishlist_offer_items (offer_id);
COMMIT;
