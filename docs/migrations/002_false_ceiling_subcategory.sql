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