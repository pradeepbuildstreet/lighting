-- Apply only after explicit approval: this deactivates/unpublishes existing dealerless products.
BEGIN;
SELECT pg_advisory_xact_lock(8102401);
SELECT pg_advisory_xact_lock(8102403);
ALTER TABLE public.products ALTER COLUMN is_active SET DEFAULT false;
CREATE OR REPLACE FUNCTION public.luminoza_dealer_eligibility_lock() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(8102401);
 PERFORM pg_advisory_xact_lock(8102403);
 RETURN NULL;
END;$$;
CREATE OR REPLACE FUNCTION public.luminoza_reconcile_dealer_eligibility() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 WITH invalid AS MATERIALIZED (
  SELECT p.id,p.is_active,p.published FROM public.products p
  WHERE (p.is_active OR p.published) AND NOT EXISTS(SELECT 1 FROM public.dealer_products dp JOIN public.dealers d ON d.id=dp.dealer_id WHERE dp.product_id=p.id AND dp.is_active AND d.is_active) FOR UPDATE OF p
 ), changed AS (
  UPDATE public.products p SET is_active=false,published=false,updated_at=now() FROM invalid i WHERE p.id=i.id
  RETURNING p.id,i.is_active AS was_active,i.published AS was_published
 )
 INSERT INTO public.admin_audit_log(actor_id,action,entity_type,entity_id,before_data,after_data)
 SELECT NULL,'enforce_active_dealer','products',id,jsonb_build_object('is_active',was_active,'published',was_published),jsonb_build_object('is_active',false,'published',false,'reason','No active dealer and active product-dealer link') FROM changed;
 RETURN NULL;
END;$$;
CREATE OR REPLACE FUNCTION public.luminoza_require_active_dealer() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF (NEW.is_active OR NEW.published) AND NOT EXISTS(SELECT 1 FROM public.dealer_products dp JOIN public.dealers d ON d.id=dp.dealer_id WHERE dp.product_id=NEW.id AND dp.is_active AND d.is_active) THEN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='No active dealer is assigned. Attach an active product listing to an active dealer before activating or publishing this product.';
 END IF;
 RETURN NEW;
END;$$;
DO $$DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['products','dealers','dealer_products'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS luminoza_dealer_eligibility_lock ON public.%I',t);
  EXECUTE format('CREATE TRIGGER luminoza_dealer_eligibility_lock BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.luminoza_dealer_eligibility_lock()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['dealers','dealer_products'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS luminoza_reconcile_dealer_eligibility ON public.%I',t);
  EXECUTE format('CREATE TRIGGER luminoza_reconcile_dealer_eligibility AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.luminoza_reconcile_dealer_eligibility()',t);
 END LOOP;
END;$$;
-- Fire reconciliation once for pre-existing invalid products, without changing dealer data.
UPDATE public.dealers SET is_active=is_active WHERE false;
DROP TRIGGER IF EXISTS luminoza_require_active_dealer ON public.products;
CREATE TRIGGER luminoza_require_active_dealer BEFORE INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.luminoza_require_active_dealer();
DO $$DECLARE definition text;BEGIN
 SELECT pg_get_viewdef('public.public_products'::regclass,true) INTO definition;
 IF position('dealer_eligibility_gate' IN definition)=0 THEN
  definition:=regexp_replace(btrim(definition),';\s*$','');
  EXECUTE 'CREATE OR REPLACE VIEW public.public_products AS SELECT dealer_eligibility_gate.* FROM ('||definition||') AS dealer_eligibility_gate WHERE EXISTS (SELECT 1 FROM public.dealer_products dp JOIN public.dealers d ON d.id=dp.dealer_id WHERE dp.product_id=dealer_eligibility_gate.id AND dp.is_active AND d.is_active)';
 END IF;
END;$$;
COMMIT;
