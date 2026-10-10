ALTER TABLE wishlists
  ADD COLUMN IF NOT EXISTS communication_channel VARCHAR(20),
  ADD COLUMN IF NOT EXISTS whatsapp_opened_at TIMESTAMPTZ;

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

CREATE INDEX IF NOT EXISTS idx_wishlist_offer_items_offer
  ON wishlist_offer_items (offer_id);