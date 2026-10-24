-- Publication prerequisite only. Does not install activation version 3.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SELECT pg_advisory_xact_lock(8102401);
SELECT pg_advisory_xact_lock(8102403);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.catalogue_taxonomy_versions WHERE version=1)
 OR NOT EXISTS(SELECT 1 FROM public.catalogue_taxonomy_versions WHERE version=2) THEN
  RAISE EXCEPTION 'Tag reference and product storage prerequisites are required';
 END IF;
 IF EXISTS(SELECT 1 FROM public.catalogue_taxonomy_versions WHERE version=3) THEN
  RAISE EXCEPTION 'Activation is already installed; review this prerequisite manually';
 END IF;
END $$;

CREATE FUNCTION public.catalogue_product_model_ready(pid uuid,kind text)
RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $model$
WITH RECURSIVE active_tree AS (
 SELECT id,ARRAY[id] AS path FROM public.categories WHERE is_active AND parent_id IS NULL
 UNION ALL
 SELECT c.id,t.path||c.id FROM public.categories c JOIN active_tree t ON c.parent_id=t.id
 WHERE c.is_active AND NOT c.id=ANY(t.path)
)
SELECT coalesce(
CASE WHEN EXISTS(SELECT 1 FROM public.product_attributes WHERE product_id=pid)
 OR EXISTS(SELECT 1 FROM public.product_tags WHERE product_id=pid) THEN
 EXISTS(SELECT 1 FROM public.catalogue_taxonomy_versions WHERE version=3)
 AND EXISTS(
  SELECT 1 FROM public.product_attributes a JOIN public.product_kinds k ON k.id=a.product_kind_id
  WHERE a.product_id=pid AND k.code=kind AND k.is_active
   AND (a.length_mm IS NULL OR a.length_mm>0 AND a.length_mm<=999999999.999)
   AND (a.breadth_mm IS NULL OR a.breadth_mm>0 AND a.breadth_mm<=999999999.999)
   AND (a.height_mm IS NULL OR a.height_mm>0 AND a.height_mm<=999999999.999)
   AND (a.wattage IS NULL OR a.wattage>0 AND a.wattage<=999999999.999)
   AND (a.lumens IS NULL OR a.lumens>=0)
   AND ((k.entry_profile='fixture' AND a.light_source_mode IN ('replaceable','hybrid') AND a.wattage IS NULL AND a.lumens IS NULL)
    OR (k.entry_profile='light_source' AND a.light_source_mode IS NOT DISTINCT FROM k.fixed_source_mode)
    OR (k.entry_profile='general' AND a.light_source_mode IS NULL AND k.fixed_source_mode IS NULL AND a.wattage IS NULL AND a.lumens IS NULL)))
 AND NOT EXISTS(SELECT 1 FROM public.product_tags pt JOIN public.tags t ON t.id=pt.tag_id JOIN public.tag_groups g ON g.id=t.tag_group_id WHERE pt.product_id=pid AND (NOT t.is_active OR NOT g.is_active))
 AND EXISTS(SELECT 1 FROM public.product_categories pc JOIN active_tree ct ON ct.id=pc.category_id WHERE pc.product_id=pid AND pc.is_primary)
 AND NOT EXISTS(SELECT 1 FROM public.product_categories pc JOIN public.categories c ON c.id=pc.category_id WHERE pc.product_id=pid AND (NOT c.allow_direct_products OR NOT EXISTS(SELECT 1 FROM active_tree ct WHERE ct.id=c.id)))
 ELSE (kind='fixture' AND EXISTS(SELECT 1 FROM public.fixture_specs s JOIN public.fixture_types t ON t.id=s.fixture_type_id WHERE s.product_id=pid AND t.is_active))
 OR (kind='light' AND EXISTS(SELECT 1 FROM public.light_specs s JOIN public.light_types t ON t.id=s.light_type_id WHERE s.product_id=pid AND t.is_active)) END,false);
$model$;
REVOKE ALL ON FUNCTION public.catalogue_product_model_ready(uuid,text) FROM PUBLIC,anon,authenticated,authenticator;
GRANT EXECUTE ON FUNCTION public.catalogue_product_model_ready(uuid,text) TO service_role;

CREATE FUNCTION public.guard_catalogue_product_kind()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $kind$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.product_kind IS NOT DISTINCT FROM OLD.product_kind THEN RETURN NEW; END IF;
 END IF;
 IF NEW.product_kind NOT IN ('fixture','light') AND NOT EXISTS(
  SELECT 1 FROM public.product_kinds k WHERE k.code=NEW.product_kind AND k.is_active
 ) THEN RAISE EXCEPTION 'Active reference product kind required' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$kind$;
REVOKE ALL ON FUNCTION public.guard_catalogue_product_kind() FROM PUBLIC,anon,authenticated,authenticator;
GRANT EXECUTE ON FUNCTION public.guard_catalogue_product_kind() TO service_role;
ALTER TABLE public.products DROP CONSTRAINT products_product_kind_check;
ALTER TABLE public.products ADD CONSTRAINT products_product_kind_check
 CHECK (char_length(product_kind)<=64 AND product_kind ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
CREATE TRIGGER catalogue_product_kind_reference BEFORE INSERT OR UPDATE OF product_kind ON public.products
 FOR EACH ROW EXECUTE FUNCTION public.guard_catalogue_product_kind();

CREATE OR REPLACE FUNCTION public.current_duplicate_approval(pid uuid,rev bigint,reviewer uuid,kind text)
RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $approval$
SELECT EXISTS(
 SELECT 1 FROM public.products p
 JOIN LATERAL(SELECT * FROM public.product_duplicate_audits WHERE product_id=p.id ORDER BY created_at DESC,id DESC LIMIT 1) a ON true
 JOIN LATERAL(SELECT * FROM public.product_duplicate_reviews WHERE audit_id=a.id ORDER BY created_at DESC,id DESC LIMIT 1) r ON true
 WHERE p.id=pid AND p.product_kind=kind AND p.revision=rev
 AND p.review_status='approved' AND p.approved_revision=rev AND p.approved_by=reviewer
 AND p.duplicate_of_product_id IS NULL AND a.status='completed' AND a.product_revision=rev
 AND a.corpus_digest IS NOT NULL AND r.decision='approve_distinct' AND r.reviewer_id=reviewer
 AND (NOT (EXISTS(SELECT 1 FROM public.product_attributes WHERE product_id=p.id)
  OR EXISTS(SELECT 1 FROM public.product_tags WHERE product_id=p.id)) OR a.algorithm_version='tags-evidence-v2')
);
$approval$;

CREATE OR REPLACE FUNCTION public.check_publish()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $publish$
BEGIN
 IF NEW.published THEN
  IF NOT NEW.is_active OR NEW.review_status<>'approved' OR NEW.approved_revision IS DISTINCT FROM NEW.revision
   OR NEW.approved_by IS NULL OR NEW.selling_price IS NULL OR NEW.selling_price<0 OR NEW.duplicate_of_product_id IS NOT NULL THEN
   RAISE EXCEPTION 'Current active distinct approval and price required' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.product_categories pc JOIN public.categories c ON c.id=pc.category_id WHERE pc.product_id=NEW.id AND pc.is_primary AND c.is_active) THEN
   RAISE EXCEPTION 'Active primary category required' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.product_media WHERE product_id=NEW.id AND is_primary AND media_type='image') THEN
   RAISE EXCEPTION 'Primary image required' USING ERRCODE='23514';
  END IF;
  IF NOT public.catalogue_product_model_ready(NEW.id,NEW.product_kind) THEN
   RAISE EXCEPTION 'Valid active product model and applicable categories required; tag activation may be pending' USING ERRCODE='23514';
  END IF;
  IF NOT public.current_duplicate_approval(NEW.id,NEW.revision,NEW.approved_by,NEW.product_kind) THEN
   RAISE EXCEPTION 'Latest audit/review evidence required' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END;
$publish$;

CREATE OR REPLACE VIEW public.public_products AS
SELECT id,sku,name,product_kind,brand,model_number,description,selling_price,currency,
 is_active,published,review_status,revision,approved_revision,approved_by,approved_at,
 duplicate_of_product_id,created_at,updated_at
FROM public.products p
WHERE is_active AND published AND review_status='approved' AND approved_revision=revision
 AND duplicate_of_product_id IS NULL AND selling_price IS NOT NULL AND selling_price>=0
 AND public.current_duplicate_approval(id,revision,approved_by,product_kind)
 AND EXISTS(SELECT 1 FROM public.product_categories pc JOIN public.categories c ON c.id=pc.category_id WHERE pc.product_id=p.id AND pc.is_primary AND c.is_active)
 AND EXISTS(SELECT 1 FROM public.product_media m WHERE m.product_id=p.id AND m.is_primary AND m.media_type='image')
 AND public.catalogue_product_model_ready(id,product_kind);
-- Existing view grants/options and function privileges are preserved by replacement.
-- Existing guard_tag_model_publication, RLS, media and revision triggers remain in place.
-- No readiness marker is inserted: activation is a separately reviewed checkpoint.
COMMIT;
