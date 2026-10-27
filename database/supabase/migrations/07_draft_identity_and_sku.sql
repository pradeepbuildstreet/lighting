-- Apply with a transactional migration runner after application compatibility is verified.
ALTER TABLE public.product_kinds ADD COLUMN sku_prefix text;
ALTER TABLE public.product_kinds ADD CONSTRAINT product_kinds_sku_prefix_format CHECK (sku_prefix ~ '^[A-Z]{1,8}$');
ALTER TABLE public.product_kinds ADD CONSTRAINT product_kinds_sku_prefix_unique UNIQUE (sku_prefix);
UPDATE public.product_kinds SET sku_prefix=CASE code
 WHEN 'fixture' THEN 'F' WHEN 'integrated-light' THEN 'IL'
 WHEN 'replaceable-bulb' THEN 'RB' WHEN 'led-strip-module' THEN 'LSM'
 WHEN 'driver-power-supply' THEN 'DPS' WHEN 'control-accessory' THEN 'CA' END
WHERE code IN ('fixture','integrated-light','replaceable-bulb','led-strip-module','driver-power-supply','control-accessory');
CREATE SEQUENCE public.catalogue_sku_sequence AS bigint START WITH 100001 MINVALUE 100001 MAXVALUE 999999 NO CYCLE;
REVOKE ALL ON SEQUENCE public.catalogue_sku_sequence FROM PUBLIC;
ALTER TABLE public.products ALTER COLUMN sku DROP NOT NULL;
ALTER TABLE public.products ALTER COLUMN name DROP NOT NULL;
ALTER TABLE public.products ADD CONSTRAINT products_published_identity_required CHECK (
 NOT published OR (sku IS NOT NULL AND name IS NOT NULL AND length(btrim(name))>0)
);
CREATE FUNCTION public.guard_catalogue_sku_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'pg_catalog','public' AS $function$
BEGIN
 IF OLD.sku IS NOT NULL AND NEW.sku IS DISTINCT FROM OLD.sku THEN
  RAISE EXCEPTION 'Assigned SKU cannot be changed or cleared' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$function$;
CREATE TRIGGER catalogue_sku_immutable BEFORE UPDATE OF sku ON public.products
FOR EACH ROW EXECUTE FUNCTION public.guard_catalogue_sku_immutable();
CREATE FUNCTION public.guard_catalogue_sku_prefix_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'pg_catalog','public' AS $function$
BEGIN
 IF OLD.sku_prefix IS NOT NULL AND NEW.sku_prefix IS DISTINCT FROM OLD.sku_prefix THEN
  RAISE EXCEPTION 'Assigned product-kind SKU initials are fixed' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$function$;
CREATE TRIGGER catalogue_sku_prefix_immutable BEFORE UPDATE OF sku_prefix ON public.product_kinds
FOR EACH ROW EXECUTE FUNCTION public.guard_catalogue_sku_prefix_immutable();
CREATE FUNCTION public.assign_catalogue_product_sku(p_product_id uuid,p_expected_revision bigint)
RETURNS public.products LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO 'pg_catalog','public' AS $function$
DECLARE current_product public.products; prefix text; candidate text; attempt integer;
BEGIN
 PERFORM pg_advisory_xact_lock(8102401);
 PERFORM pg_advisory_xact_lock(8102403);
 SELECT * INTO current_product FROM public.products WHERE id=p_product_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Product not found' USING ERRCODE='P0002'; END IF;
 -- Assignment-only retries return the existing identifier without modifying product content.
 IF current_product.sku IS NOT NULL THEN RETURN current_product; END IF;
 IF p_expected_revision IS NULL OR p_expected_revision<=0 OR current_product.revision IS DISTINCT FROM p_expected_revision THEN
  RAISE EXCEPTION 'Product changed; reload before assigning SKU' USING ERRCODE='40001';
 END IF;
 SELECT k.sku_prefix INTO prefix FROM public.product_kinds k
 WHERE k.code=current_product.product_kind AND k.is_active FOR SHARE;
 IF prefix IS NULL THEN RAISE EXCEPTION 'Active product kind with fixed SKU initials required' USING ERRCODE='23514'; END IF;
 FOR attempt IN 1..100 LOOP
  candidate:=prefix||nextval('public.catalogue_sku_sequence'::regclass)::text;
  IF NOT EXISTS(SELECT 1 FROM public.products WHERE sku=candidate) THEN
   UPDATE public.products SET sku=candidate WHERE id=p_product_id RETURNING * INTO current_product;
   RETURN current_product;
  END IF;
 END LOOP;
 RAISE EXCEPTION 'SKU allocation collided repeatedly; inspect existing SKU range' USING ERRCODE='23505';
END;
$function$;
REVOKE ALL ON FUNCTION public.assign_catalogue_product_sku(uuid,bigint) FROM PUBLIC;
COMMENT ON FUNCTION public.assign_catalogue_product_sku(uuid,bigint) IS 'Backend-only assignment primitive. Caller must authenticate admin, set audit actor and record assignment in the same transaction. Does not generate names or publish products.';
