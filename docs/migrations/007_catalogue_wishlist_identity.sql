-- Run only on DATABASE_URL (application/authentication database).
ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS product_id uuid,
 ADD COLUMN IF NOT EXISTS currency varchar(3) NOT NULL DEFAULT 'INR',
 ADD COLUMN IF NOT EXISTS media jsonb NOT NULL DEFAULT '[]'::jsonb,
 ADD COLUMN IF NOT EXISTS product_href text,
 ADD COLUMN IF NOT EXISTS catalogue_revision text;
ALTER TABLE wishlist_offer_items ADD COLUMN IF NOT EXISTS product_id uuid,
 ADD COLUMN IF NOT EXISTS currency varchar(3) NOT NULL DEFAULT 'INR',
 ADD COLUMN IF NOT EXISTS media jsonb NOT NULL DEFAULT '[]'::jsonb,
 ADD COLUMN IF NOT EXISTS product_href text,
 ADD COLUMN IF NOT EXISTS catalogue_revision text;
-- No cross-database foreign key. UUIDs originate from CATALOG_DATABASE_URL.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT conname,conrelid::regclass AS rel FROM pg_constraint
 WHERE contype='u' AND conrelid IN ('wishlist_items'::regclass,'wishlist_offer_items'::regclass)
 AND pg_get_constraintdef(oid) IN ('UNIQUE (wishlist_id, sku)','UNIQUE (offer_id, sku)')
 LOOP EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',r.rel,r.conname); END LOOP;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS wishlist_items_catalogue_identity ON wishlist_items(wishlist_id,product_id) WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS wishlist_items_legacy_identity ON wishlist_items(wishlist_id,sku) WHERE product_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS offer_items_catalogue_identity ON wishlist_offer_items(offer_id,product_id) WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS offer_items_legacy_identity ON wishlist_offer_items(offer_id,sku) WHERE product_id IS NULL;
CREATE TABLE IF NOT EXISTS catalogue_identity_migrations(version integer PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now(),report jsonb NOT NULL);
