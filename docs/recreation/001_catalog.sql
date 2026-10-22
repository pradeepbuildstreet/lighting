BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE schema_versions(version integer PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE app_users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),email text NOT NULL,password_hash text NOT NULL,role text NOT NULL DEFAULT 'admin' CHECK(role IN ('admin','editor','reviewer')),is_active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX users_email_unique ON app_users(lower(email));
CREATE TABLE categories(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),slug text NOT NULL UNIQUE CHECK(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),name text NOT NULL,parent_id uuid REFERENCES categories(id),description text,sort_order integer NOT NULL DEFAULT 0 CHECK(sort_order>=0),is_active boolean NOT NULL DEFAULT true,CHECK(parent_id IS NULL OR parent_id<>id));
CREATE INDEX categories_parent ON categories(parent_id);
CREATE TABLE products(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),sku text NOT NULL UNIQUE CHECK(sku=upper(trim(sku)) AND length(sku)>0),name text NOT NULL,
 product_kind text NOT NULL CHECK(product_kind IN ('fixture','light')),brand text,model_number text,description text,
 selling_price numeric(14,2) CHECK(selling_price>=0),currency text NOT NULL DEFAULT 'INR' CHECK(currency ~ '^[A-Z]{3}$'),
 is_active boolean NOT NULL DEFAULT true,published boolean NOT NULL DEFAULT false,
 review_status text NOT NULL DEFAULT 'draft' CHECK(review_status IN ('draft','pending_audit','pending_review','approved','duplicate','rejected','archived')),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),approved_revision bigint,approved_by uuid REFERENCES app_users(id),approved_at timestamptz,
 duplicate_of_product_id uuid REFERENCES products(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,product_kind),CHECK(duplicate_of_product_id IS NULL OR duplicate_of_product_id<>id),
 CHECK(NOT published OR (is_active AND review_status='approved' AND approved_revision IS NOT NULL AND approved_revision=revision AND approved_by IS NOT NULL AND selling_price IS NOT NULL)),
 CHECK(review_status<>'duplicate' OR duplicate_of_product_id IS NOT NULL)
);
CREATE TABLE product_categories(product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,category_id uuid NOT NULL REFERENCES categories(id),is_primary boolean NOT NULL DEFAULT false,PRIMARY KEY(product_id,category_id));
CREATE UNIQUE INDEX primary_category_unique ON product_categories(product_id) WHERE is_primary;
CREATE INDEX product_category_reverse ON product_categories(category_id,product_id);
CREATE TABLE fixture_types(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),code text NOT NULL UNIQUE,name text NOT NULL,is_active boolean NOT NULL DEFAULT true);
CREATE TABLE light_types(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),code text NOT NULL UNIQUE,name text NOT NULL,base_type text,technology text,is_active boolean NOT NULL DEFAULT true);
CREATE TABLE fixture_specs(
 product_id uuid PRIMARY KEY,product_kind text NOT NULL DEFAULT 'fixture' CHECK(product_kind='fixture'),fixture_type_id uuid NOT NULL REFERENCES fixture_types(id),
 material text,style text,mounting_type text,width_mm numeric(10,2) CHECK(width_mm>0),depth_mm numeric(10,2) CHECK(depth_mm>0),height_mm numeric(10,2) CHECK(height_mm>0),
 light_source_mode text NOT NULL CHECK(light_source_mode IN ('replaceable','integrated','hybrid')),inbuilt_specs jsonb NOT NULL DEFAULT '{}',other_specs jsonb NOT NULL DEFAULT '{}',
 FOREIGN KEY(product_id,product_kind) REFERENCES products(id,product_kind) ON DELETE CASCADE
);
CREATE TABLE light_specs(
 product_id uuid PRIMARY KEY,product_kind text NOT NULL DEFAULT 'light' CHECK(product_kind='light'),light_type_id uuid NOT NULL REFERENCES light_types(id),
 wattage numeric(10,2) CHECK(wattage>0),lumens integer CHECK(lumens>=0),color_temperature_k integer CHECK(color_temperature_k>0),
 voltage_min numeric(10,2) CHECK(voltage_min>0),voltage_max numeric(10,2) CHECK(voltage_max>0),diameter_mm numeric(10,2) CHECK(diameter_mm>0),length_mm numeric(10,2) CHECK(length_mm>0),
 dimmable boolean,other_specs jsonb NOT NULL DEFAULT '{}',CHECK(voltage_min IS NULL OR voltage_max IS NULL OR voltage_min<=voltage_max),
 FOREIGN KEY(product_id,product_kind) REFERENCES products(id,product_kind) ON DELETE CASCADE
);
CREATE INDEX lights_by_type ON light_specs(light_type_id);
CREATE TABLE fixture_socket_groups(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),fixture_product_id uuid NOT NULL REFERENCES fixture_specs(product_id) ON DELETE CASCADE,group_code text NOT NULL,socket_count integer NOT NULL CHECK(socket_count>0),UNIQUE(fixture_product_id,group_code));
CREATE TABLE fixture_light_rules(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),socket_group_id uuid NOT NULL REFERENCES fixture_socket_groups(id) ON DELETE CASCADE,light_type_id uuid NOT NULL REFERENCES light_types(id),
 max_wattage numeric(10,2) CHECK(max_wattage>0),supply_voltage_min numeric(10,2) CHECK(supply_voltage_min>0),supply_voltage_max numeric(10,2) CHECK(supply_voltage_max>0),
 max_diameter_mm numeric(10,2) CHECK(max_diameter_mm>0),max_length_mm numeric(10,2) CHECK(max_length_mm>0),requires_dimmable boolean NOT NULL DEFAULT false,notes text,
 CHECK((supply_voltage_min IS NULL)=(supply_voltage_max IS NULL)),CHECK(supply_voltage_min IS NULL OR supply_voltage_min<=supply_voltage_max),UNIQUE(socket_group_id,light_type_id)
);
CREATE TABLE fixture_light_overrides(socket_group_id uuid NOT NULL REFERENCES fixture_socket_groups(id) ON DELETE CASCADE,light_product_id uuid NOT NULL REFERENCES light_specs(product_id),decision text NOT NULL CHECK(decision IN ('approve','reject')),reason text NOT NULL CHECK(length(trim(reason))>0),reviewed_by uuid NOT NULL REFERENCES app_users(id),created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(socket_group_id,light_product_id));
CREATE TABLE dealers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),dealer_code text NOT NULL UNIQUE,name text NOT NULL,contact_person text,phone text,email text,gstin text,address jsonb NOT NULL DEFAULT '{}',is_active boolean NOT NULL DEFAULT true);
CREATE TABLE dealer_products(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),dealer_id uuid NOT NULL REFERENCES dealers(id),product_id uuid NOT NULL REFERENCES products(id),dealer_sku text,minimum_order_qty integer NOT NULL DEFAULT 1 CHECK(minimum_order_qty>0),lead_time_days integer CHECK(lead_time_days>=0),is_active boolean NOT NULL DEFAULT true,UNIQUE(dealer_id,product_id));
CREATE INDEX dealer_products_product ON dealer_products(product_id);
CREATE TABLE dealer_prices(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),dealer_product_id uuid NOT NULL REFERENCES dealer_products(id),currency text NOT NULL DEFAULT 'INR' CHECK(currency ~ '^[A-Z]{3}$'),
 list_price numeric(14,2) NOT NULL CHECK(list_price>=0),discount_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK(discount_percent BETWEEN 0 AND 100),
 net_price numeric(14,2) GENERATED ALWAYS AS(round(list_price*(1-discount_percent/100.0),2)) STORED,
 price_basis text NOT NULL CHECK(price_basis IN ('tax_inclusive','tax_exclusive')),tax_percent numeric(5,2) CHECK(tax_percent BETWEEN 0 AND 100),
 valid_from timestamptz NOT NULL,valid_to timestamptz,CHECK(valid_to IS NULL OR valid_to>valid_from),
 EXCLUDE USING gist(dealer_product_id WITH =,currency WITH =,tstzrange(valid_from,valid_to,'[)') WITH &&)
);
CREATE TABLE product_media(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,media_type text NOT NULL CHECK(media_type IN ('image','video')),
 storage_key text,external_url text,mime_type text,file_size_bytes bigint CHECK(file_size_bytes>=0),alt_text text,caption text,sort_order integer NOT NULL DEFAULT 0,
 is_primary boolean NOT NULL DEFAULT false,poster_media_id uuid REFERENCES product_media(id),sha256 text,perceptual_hash text,
 processing_status text NOT NULL DEFAULT 'pending' CHECK(processing_status IN ('pending','processing','completed','failed','not_applicable')),processing_error text,created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((storage_key IS NOT NULL)<>(external_url IS NOT NULL)),CHECK(NOT is_primary OR media_type='image'),CHECK(poster_media_id IS NULL OR poster_media_id<>id),
 CHECK(external_url IS NULL OR external_url ~ '^https://'),CHECK(storage_key IS NULL OR (length(storage_key)>0 AND storage_key !~ '(^/|(^|/)\.\.(/|$)|\\)'))
);
CREATE UNIQUE INDEX primary_image_unique ON product_media(product_id) WHERE is_primary;
CREATE INDEX media_product ON product_media(product_id,sort_order);
CREATE TABLE media_embeddings(media_id uuid NOT NULL REFERENCES product_media(id) ON DELETE CASCADE,model_version text NOT NULL,dimensions integer NOT NULL CHECK(dimensions>0),embedding real[] NOT NULL,PRIMARY KEY(media_id,model_version),CHECK(cardinality(embedding)=dimensions));
CREATE TABLE product_duplicate_audits(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),product_id uuid NOT NULL REFERENCES products(id),product_revision bigint NOT NULL,status text NOT NULL CHECK(status IN ('queued','running','completed','failed')),algorithm_version text NOT NULL,created_by uuid REFERENCES app_users(id),created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,error_message text,UNIQUE(id,product_id));
CREATE TABLE product_duplicate_candidates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),audit_id uuid NOT NULL,product_id uuid NOT NULL,candidate_product_id uuid NOT NULL REFERENCES products(id),overall_score numeric(6,3) NOT NULL CHECK(overall_score BETWEEN 0 AND 100),spec_score numeric(6,3) CHECK(spec_score BETWEEN 0 AND 100),image_score numeric(6,3) CHECK(image_score BETWEEN 0 AND 100),evidence jsonb NOT NULL DEFAULT '{}',CHECK(product_id<>candidate_product_id),UNIQUE(audit_id,candidate_product_id),FOREIGN KEY(audit_id,product_id) REFERENCES product_duplicate_audits(id,product_id));
CREATE TABLE product_duplicate_reviews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),audit_id uuid NOT NULL REFERENCES product_duplicate_audits(id),decision text NOT NULL CHECK(decision IN ('approve_distinct','confirm_duplicate','request_correction','reject')),duplicate_of_product_id uuid REFERENCES products(id),reviewer_id uuid NOT NULL REFERENCES app_users(id),notes text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),CHECK(decision<>'confirm_duplicate' OR duplicate_of_product_id IS NOT NULL));
CREATE TABLE import_jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),created_by uuid NOT NULL REFERENCES app_users(id),status text NOT NULL CHECK(status IN ('uploaded','validating','preview','committing','committed','failed','expired')),mode text NOT NULL CHECK(mode IN ('create','update','upsert')),workbook_sha256 text NOT NULL,preview_revision text,expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),committed_at timestamptz);
CREATE TABLE import_row_results(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,job_id uuid NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,sheet text NOT NULL,row_number integer NOT NULL CHECK(row_number>=2),record_key text,action text CHECK(action IN ('insert','update','unchanged','error')),staged_data jsonb NOT NULL DEFAULT '{}',errors jsonb NOT NULL DEFAULT '[]',UNIQUE(job_id,sheet,row_number));
CREATE TABLE admin_audit_log(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,actor_id uuid REFERENCES app_users(id),action text NOT NULL,entity_type text NOT NULL,entity_id uuid,before_data jsonb,after_data jsonb,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE background_jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),job_type text NOT NULL,payload jsonb NOT NULL,state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','completed','failed')),attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),run_after timestamptz NOT NULL DEFAULT now(),locked_at timestamptz,last_error text,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX jobs_queue ON background_jobs(run_after) WHERE state='queued';
CREATE FUNCTION guard_category_cycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.parent_id IS NOT NULL AND EXISTS(
 WITH RECURSIVE ancestors AS(SELECT id,parent_id FROM categories WHERE id=NEW.parent_id UNION SELECT c.id,c.parent_id FROM categories c JOIN ancestors a ON c.id=a.parent_id)
 SELECT 1 FROM ancestors WHERE id=NEW.id) THEN RAISE EXCEPTION 'Category cycle not allowed';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER category_cycle BEFORE INSERT OR UPDATE OF parent_id ON categories FOR EACH ROW EXECUTE FUNCTION guard_category_cycle();
CREATE FUNCTION invalidate_product(pid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN UPDATE products SET revision=revision+1,approved_revision=NULL,approved_by=NULL,approved_at=NULL,published=false,
 review_status=CASE WHEN review_status IN ('duplicate','rejected','archived') THEN review_status ELSE 'draft' END,updated_at=now() WHERE id=pid;END $$;
CREATE FUNCTION invalidate_product_relation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a uuid;b uuid;
BEGIN
 IF TG_OP<>'INSERT' THEN a=OLD.product_id;END IF;IF TG_OP<>'DELETE' THEN b=NEW.product_id;END IF;
 IF a IS NOT NULL THEN PERFORM invalidate_product(a);END IF;
 IF b IS NOT NULL AND b IS DISTINCT FROM a THEN PERFORM invalidate_product(b);END IF;RETURN NULL;
END $$;
CREATE TRIGGER category_assignment_changed AFTER INSERT OR UPDATE OR DELETE ON product_categories FOR EACH ROW EXECUTE FUNCTION invalidate_product_relation();
CREATE TRIGGER fixture_changed AFTER INSERT OR UPDATE OR DELETE ON fixture_specs FOR EACH ROW EXECUTE FUNCTION invalidate_product_relation();
CREATE TRIGGER light_changed AFTER INSERT OR UPDATE OR DELETE ON light_specs FOR EACH ROW EXECUTE FUNCTION invalidate_product_relation();
CREATE TRIGGER media_changed AFTER INSERT OR UPDATE OF storage_key,external_url,is_primary,media_type OR DELETE ON product_media FOR EACH ROW EXECUTE FUNCTION invalidate_product_relation();
CREATE FUNCTION product_identity_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.sku,NEW.name,NEW.product_kind,NEW.brand,NEW.model_number,NEW.description) IS DISTINCT FROM ROW(OLD.sku,OLD.name,OLD.product_kind,OLD.brand,OLD.model_number,OLD.description)
 THEN NEW.revision=OLD.revision+1;NEW.approved_revision=NULL;NEW.approved_by=NULL;NEW.approved_at=NULL;NEW.published=false;NEW.review_status='draft';END IF;
 NEW.updated_at=now();RETURN NEW;
END $$;
CREATE TRIGGER identity_changed BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION product_identity_changed();
CREATE FUNCTION check_publish() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.published THEN
 IF NOT EXISTS(SELECT 1 FROM product_categories pc JOIN categories c ON c.id=pc.category_id WHERE pc.product_id=NEW.id AND pc.is_primary AND c.is_active) THEN RAISE EXCEPTION 'Active primary category required';END IF;
 IF NOT EXISTS(SELECT 1 FROM product_media WHERE product_id=NEW.id AND is_primary AND media_type='image') THEN RAISE EXCEPTION 'Primary image required';END IF;
 IF NEW.product_kind='fixture' AND NOT EXISTS(SELECT 1 FROM fixture_specs WHERE product_id=NEW.id) THEN RAISE EXCEPTION 'Fixture specs required';END IF;
 IF NEW.product_kind='light' AND NOT EXISTS(SELECT 1 FROM light_specs WHERE product_id=NEW.id) THEN RAISE EXCEPTION 'Light specs required';END IF;
 IF NOT EXISTS(SELECT 1 FROM product_duplicate_audits a JOIN product_duplicate_reviews r ON r.audit_id=a.id WHERE a.product_id=NEW.id AND a.product_revision=NEW.revision AND a.status='completed' AND r.decision='approve_distinct' AND r.reviewer_id=NEW.approved_by) THEN RAISE EXCEPTION 'Current audit and approval required';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER publish_gate BEFORE INSERT OR UPDATE OF published,review_status,approved_revision ON products FOR EACH ROW EXECUTE FUNCTION check_publish();
CREATE VIEW public_products AS SELECT p.* FROM products p
 WHERE p.is_active AND p.published AND p.review_status='approved' AND p.approved_revision=p.revision
 AND EXISTS(SELECT 1 FROM product_categories pc JOIN categories c ON c.id=pc.category_id WHERE pc.product_id=p.id AND pc.is_primary AND c.is_active)
 AND EXISTS(SELECT 1 FROM product_media m WHERE m.product_id=p.id AND m.is_primary);
INSERT INTO schema_versions(version) VALUES(1);
COMMIT;
