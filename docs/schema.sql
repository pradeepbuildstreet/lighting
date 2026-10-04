-- Decorative Lighting E-commerce Database Schema
-- PostgreSQL 14+


CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Create tables
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  parent_id UUID REFERENCES categories(id),
  path TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories (parent_id);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(12,2) NOT NULL,
  category_id UUID REFERENCES categories(id),
  status VARCHAR(20) DEFAULT 'active',

  -- Compulsory attributes
  wattage DECIMAL(10,2) NOT NULL,
  lumens INTEGER NOT NULL,
  color_temperature INTEGER NOT NULL,
  material VARCHAR(100) NOT NULL,
  style VARCHAR(100) NOT NULL,

  -- Optional attributes (JSONB)
  optional_attributes JSONB DEFAULT '{}',

  -- Images & files
  image_url VARCHAR(500),
  image_repo_path VARCHAR(500),
  document_urls TEXT[],
  video_urls TEXT[],

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_products_sku ON products (sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_price ON products (price);
CREATE INDEX IF NOT EXISTS idx_products_status ON products (status);
CREATE INDEX IF NOT EXISTS idx_products_style ON products (style);
CREATE INDEX IF NOT EXISTS idx_products_material ON products (material);
CREATE INDEX IF NOT EXISTS idx_products_color_temp ON products (color_temperature);
CREATE INDEX IF NOT EXISTS idx_products_optional_attrs ON products USING GIN (optional_attributes);

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

CREATE INDEX IF NOT EXISTS idx_wishlists_status_updated ON wishlists (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_wishlists_submitted ON wishlists (submitted_at DESC) WHERE submitted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wishlist_items_wishlist ON wishlist_items (wishlist_id, created_at);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_sku_wishlist ON wishlist_items (sku, wishlist_id);

-- Seed departments and preserve the existing leaf slugs and product assignments.
INSERT INTO categories (name, slug, parent_id, path, description, sort_order) VALUES
  ('Decorative Lighting', 'decorative-lighting', NULL, '/products/decorative-lighting', 'Decorative lighting for every room and outdoor space', 1),
  ('False Ceiling Lights', 'false-ceiling-lights', NULL, '/products/false-ceiling-lights', 'Lighting for false ceiling installations', 2),
  ('Solar Lights', 'solar-lights', NULL, '/products/solar-lights', 'Solar-powered lighting', 3),
  ('Wardrobe Lights', 'wardrobe-lights', NULL, '/products/wardrobe-lights', 'Lighting for wardrobes and storage', 4)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  parent_id = EXCLUDED.parent_id,
  path = EXCLUDED.path,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

INSERT INTO categories (name, slug, parent_id, path, description, sort_order)
SELECT
  'Ceiling Lights',
  'false-ceiling-ceiling-lights',
  parent.id,
  parent.path || '/false-ceiling-ceiling-lights',
  'Ceiling lights for false ceiling installations',
  1
FROM categories parent
WHERE parent.slug = 'false-ceiling-lights'
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  parent_id = EXCLUDED.parent_id,
  path = EXCLUDED.path,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

INSERT INTO categories (name, slug, parent_id, path, description, sort_order)
SELECT seed.name, seed.slug, parent.id, parent.path || '/' || seed.slug, seed.description, seed.sort_order
FROM (VALUES
  ('Ceiling Lights', 'ceiling', 'Ceiling-mounted lighting fixtures', 1),
  ('Pendant Lights', 'pendant', 'Hanging pendant lights', 2),
  ('Wall Sconces', 'wall', 'Wall-mounted lighting', 3),
  ('Table Lamps', 'table', 'Table and desk lamps', 4),
  ('Floor Lamps', 'floor', 'Standing floor lamps', 5),
  ('Outdoor Lights', 'outdoor', 'Outdoor and garden lighting', 6)
) AS seed(name, slug, description, sort_order)
CROSS JOIN categories parent
WHERE parent.slug = 'decorative-lighting'
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  parent_id = EXCLUDED.parent_id,
  path = EXCLUDED.path,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- Insert sample product
INSERT INTO products (
  sku, name, description, price, category_id,
  wattage, lumens, color_temperature, material, style,
  optional_attributes, image_url, image_repo_path, status
) VALUES (
  'DL-001',
  'Modern Pendant Light',
  'Elegant modern pendant light with brass finish, perfect for dining rooms',
  2999,
  (SELECT id FROM categories WHERE slug = 'pendant'),
  12, 1200, 3000, 'brass', 'modern',
  '{"brand": "LuxLight", "ip_rating": 20, "voltage": 220, "beam_angle": 90, "mounting_type": "pendant", "smart_compatible": true, "warranty": "2 years"}',
  '/uploads/dl001.jpg',
  'uploads/dl001.jpg',
  'active'
)
ON CONFLICT (sku) DO NOTHING;


-- Create function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();