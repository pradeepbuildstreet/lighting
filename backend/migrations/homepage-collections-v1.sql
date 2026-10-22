BEGIN;
SELECT pg_advisory_xact_lock(71420515);
CREATE TABLE IF NOT EXISTS homepage_feature_versions(version integer PRIMARY KEY,installed_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS homepage_collections(
 id uuid PRIMARY KEY,title varchar(120) NOT NULL CHECK(length(trim(title))>0),
 slug varchar(100) NOT NULL UNIQUE CHECK(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 description varchar(2000) NOT NULL DEFAULT '',is_active boolean NOT NULL DEFAULT false,
 sort_order integer NOT NULL DEFAULT 0 CHECK(sort_order BETWEEN 0 AND 100000),
 cover_product_id uuid REFERENCES products(id) ON DELETE SET NULL,
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS homepage_collection_products(
 collection_id uuid NOT NULL REFERENCES homepage_collections(id) ON DELETE CASCADE,
 product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
 sort_order integer NOT NULL CHECK(sort_order BETWEEN 0 AND 100000),
 PRIMARY KEY(collection_id,product_id),UNIQUE(collection_id,sort_order));
CREATE INDEX IF NOT EXISTS homepage_collection_products_product_idx ON homepage_collection_products(product_id);
CREATE TABLE IF NOT EXISTS homepage_collection_audit(
 id bigserial PRIMARY KEY,collection_id uuid NOT NULL REFERENCES homepage_collections(id),actor_id uuid NOT NULL,
 action text NOT NULL CHECK(action IN ('create','update')),before_state jsonb,after_state jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
INSERT INTO homepage_feature_versions(version) VALUES(1) ON CONFLICT DO NOTHING;
COMMIT;
