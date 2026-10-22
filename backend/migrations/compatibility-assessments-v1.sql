CREATE TABLE IF NOT EXISTS product_compatibility_assessments_v1(
 fixture_id uuid PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
 fingerprint char(64) NOT NULL CHECK(fingerprint ~ '^[0-9a-f]{64}$'),result jsonb NOT NULL,
 assessed_by uuid NOT NULL, assessed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS product_compatibility_audit_v1(
 id bigserial PRIMARY KEY,fixture_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL,fingerprint char(64) NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
