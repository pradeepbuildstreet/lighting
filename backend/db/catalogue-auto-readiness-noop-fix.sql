-- Required companion to catalogue-auto-readiness.sql.
-- Apply both sources in one database transaction before accepting writes.
-- This source is not an authorization to execute either migration.
DO $$ BEGIN
 IF to_regclass('public.catalogue_product_readiness') IS NULL THEN
  RAISE EXCEPTION 'Base readiness migration must precede this safeguard in the same rollout';
 END IF;
END;$$;
CREATE OR REPLACE FUNCTION public.catalogue_reassess_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE oldrow jsonb='{}'; newrow jsonb='{}'; pid uuid;
BEGIN
 IF TG_OP<>'INSERT' THEN oldrow=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN newrow=to_jsonb(NEW); END IF;
 IF TG_TABLE_NAME='products' THEN
  IF TG_OP='DELETE' THEN RETURN NULL; END IF;
  -- Publication withdrawal must be reassessed, including equal numeric prices.
  -- Skip only otherwise unchanged updates that end with publication enabled.
  IF TG_OP='UPDATE'
   AND (oldrow-'published'-'is_active'-'updated_at') IS NOT DISTINCT FROM (newrow-'published'-'is_active'-'updated_at')
   AND (newrow->>'published')::boolean IS TRUE THEN RETURN NULL; END IF;
  IF newrow->>'sku' IS NOT NULL THEN PERFORM public.catalogue_reassess_product((newrow->>'id')::uuid); END IF;
 ELSIF TG_TABLE_NAME IN ('product_attributes','product_tags','product_categories','product_media','dealer_products','product_duplicate_audits') THEN
  FOR pid IN SELECT DISTINCT value::uuid FROM (VALUES(oldrow->>'product_id'),(newrow->>'product_id')) x(value) WHERE value IS NOT NULL LOOP
   IF EXISTS(SELECT 1 FROM public.products WHERE id=pid AND sku IS NOT NULL) THEN PERFORM public.catalogue_reassess_product(pid); END IF;
  END LOOP;
 ELSIF TG_TABLE_NAME='dealer_prices' THEN
  FOR pid IN SELECT DISTINCT dp.product_id FROM public.dealer_products dp WHERE dp.id IN ((oldrow->>'dealer_product_id')::uuid,(newrow->>'dealer_product_id')::uuid) LOOP PERFORM public.catalogue_reassess_product(pid); END LOOP;
 ELSIF TG_TABLE_NAME='product_duplicate_reviews' THEN
  FOR pid IN SELECT DISTINCT a.product_id FROM public.product_duplicate_audits a WHERE a.id IN ((oldrow->>'audit_id')::uuid,(newrow->>'audit_id')::uuid) LOOP PERFORM public.catalogue_reassess_product(pid); END LOOP;
 ELSE
  FOR pid IN SELECT id FROM public.products WHERE sku IS NOT NULL ORDER BY id LOOP PERFORM public.catalogue_reassess_product(pid); END LOOP;
 END IF;
 RETURN NULL;
END;$$;
REVOKE ALL ON FUNCTION public.catalogue_reassess_changed() FROM PUBLIC,anon,authenticated;
