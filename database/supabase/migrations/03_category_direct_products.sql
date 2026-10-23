BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(8102401);
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS allow_direct_products boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.categories.allow_direct_products IS 'Whether products may be assigned directly; false categories remain navigation groups.';
-- Reuse existing product_category_reverse(category_id, product_id).
CREATE OR REPLACE FUNCTION public.enforce_category_direct_products_setting()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(8102401);
 IF NEW.allow_direct_products IS NOT TRUE AND EXISTS (
  SELECT 1 FROM public.product_categories pc WHERE pc.category_id=NEW.id
 ) THEN
  RAISE EXCEPTION 'Move directly assigned products before disabling direct products'
   USING ERRCODE='23514',CONSTRAINT='category_direct_products_setting';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_category_direct_products_setting() FROM PUBLIC;
CREATE TRIGGER category_direct_products_setting_guard
 BEFORE UPDATE OF allow_direct_products ON public.categories
 FOR EACH ROW EXECUTE FUNCTION public.enforce_category_direct_products_setting();
CREATE OR REPLACE FUNCTION public.enforce_product_category_direct_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(8102401);
 IF NOT EXISTS (
  SELECT 1 FROM public.categories c
  WHERE c.id=NEW.category_id AND c.is_active AND c.allow_direct_products
 ) THEN
  RAISE EXCEPTION 'Products require an active category that allows direct products'
   USING ERRCODE='23514',CONSTRAINT='product_category_direct_assignment';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_product_category_direct_assignment() FROM PUBLIC;
CREATE TRIGGER product_category_direct_assignment_guard
 BEFORE INSERT OR UPDATE ON public.product_categories
 FOR EACH ROW EXECUTE FUNCTION public.enforce_product_category_direct_assignment();
COMMIT;
