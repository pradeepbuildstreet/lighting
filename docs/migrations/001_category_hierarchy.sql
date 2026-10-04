BEGIN;

ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories (parent_id);

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

COMMIT;