-- Preserve all publication requirements except product activation.
CREATE OR REPLACE FUNCTION public.check_publish()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'pg_catalog','public' AS $function$
BEGIN
 IF TG_OP = 'UPDATE' THEN
  IF OLD.published AND NEW.published AND NOT NEW.is_active
   AND (to_jsonb(NEW) - 'is_active' - 'updated_at') IS NOT DISTINCT FROM (to_jsonb(OLD) - 'is_active' - 'updated_at') THEN
   RETURN NEW;
  END IF;
 END IF;
 IF NEW.published THEN
  IF NEW.review_status<>'approved' OR NEW.approved_revision IS DISTINCT FROM NEW.revision
   OR NEW.approved_by IS NULL OR NEW.selling_price IS NULL OR NEW.selling_price<0 OR NEW.duplicate_of_product_id IS NOT NULL THEN
   RAISE EXCEPTION 'Current distinct approval and price required' USING ERRCODE='23514';
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
$function$;
