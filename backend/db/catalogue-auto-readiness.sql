-- Review and test before applying. Does not backfill or republish existing products.
-- Duplicate audits/reviews remain explicit prerequisites; no automatic distinct approval.
CREATE TABLE public.catalogue_product_readiness (
 product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
 assessed_revision bigint NOT NULL, ready boolean NOT NULL,
 reasons text[] NOT NULL DEFAULT '{}', assessed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.catalogue_product_readiness ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.catalogue_product_readiness FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.catalogue_saleability_ready(pid uuid,expected_currency text DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.products p
 JOIN public.dealer_products dp ON dp.product_id=p.id AND dp.is_active
 JOIN public.dealers d ON d.id=dp.dealer_id AND d.is_active
 JOIN public.dealer_prices q ON q.dealer_product_id=dp.id
 WHERE p.id=pid AND q.currency=COALESCE(expected_currency,p.currency)
 AND q.valid_from<=statement_timestamp() AND (q.valid_to IS NULL OR q.valid_to>statement_timestamp())
 AND q.net_price IS NOT NULL AND q.net_price>=0
 AND q.net_price::text NOT IN ('NaN','Infinity','-Infinity')
 AND q.price_basis IN ('tax_inclusive','tax_exclusive'));
$$;

CREATE OR REPLACE FUNCTION public.luminoza_require_active_dealer()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE activating boolean;
BEGIN
 activating=NEW.is_active;
 IF TG_OP='UPDATE' THEN
  activating=NEW.is_active AND NOT OLD.is_active;
  IF OLD.is_active AND NOT NEW.is_active AND
   (to_jsonb(NEW)-'is_active'-'updated_at') IS NOT DISTINCT FROM (to_jsonb(OLD)-'is_active'-'updated_at') THEN RETURN NEW; END IF;
 END IF;
 IF activating AND NOT NEW.published THEN
  RAISE EXCEPTION 'Activation requires current publication readiness' USING ERRCODE='23514';
 END IF;
 IF (NEW.published OR activating) AND NOT EXISTS(SELECT 1 FROM public.dealer_products dp
 JOIN public.dealers d ON d.id=dp.dealer_id WHERE dp.product_id=NEW.id AND dp.is_active AND d.is_active) THEN
  RAISE EXCEPTION 'An active dealer attachment is required' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;$$;

CREATE OR REPLACE FUNCTION public.luminoza_reconcile_dealer_eligibility()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 WITH changed AS (UPDATE public.products p SET published=false,updated_at=now()
 WHERE p.published AND NOT EXISTS(SELECT 1 FROM public.dealer_products dp
 JOIN public.dealers d ON d.id=dp.dealer_id WHERE dp.product_id=p.id AND dp.is_active AND d.is_active)
 RETURNING p.id,p.is_active)
 INSERT INTO public.admin_audit_log(actor_id,action,entity_type,entity_id,before_data,after_data)
 SELECT NULL,'withdraw_dealer_ineligible_publication','products',id,
 jsonb_build_object('published',true,'is_active',is_active),
 jsonb_build_object('published',false,'is_active',is_active,'reason','No active dealer attachment; manual activation retained') FROM changed;
 RETURN NULL;
END;$$;

CREATE FUNCTION public.catalogue_saleability_publication_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF OLD.is_active AND NOT NEW.is_active AND
   (to_jsonb(NEW)-'is_active'-'updated_at') IS NOT DISTINCT FROM (to_jsonb(OLD)-'is_active'-'updated_at') THEN RETURN NEW; END IF;
 END IF;
 IF NEW.published AND NOT public.catalogue_saleability_ready(NEW.id,NEW.currency) THEN
  RAISE EXCEPTION 'A current valid dealer price in the product currency is required' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER pipeline_saleability_gate BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.catalogue_saleability_publication_guard();
CREATE TRIGGER pipeline_price_write_lock BEFORE INSERT OR UPDATE OR DELETE ON public.dealer_prices
FOR EACH STATEMENT EXECUTE FUNCTION public.luminoza_dealer_eligibility_lock();

CREATE FUNCTION public.catalogue_reassess_product(pid uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE p public.products%ROWTYPE; a public.product_duplicate_audits%ROWTYPE;
 r public.product_duplicate_reviews%ROWTYPE; problems text[]='{}'; eligible boolean=false; was_published boolean;
BEGIN
 PERFORM pg_advisory_xact_lock(8102401); PERFORM pg_advisory_xact_lock(8102403);
 SELECT * INTO p FROM public.products WHERE id=pid FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 was_published=p.published;
 IF p.sku IS NULL THEN problems=array_append(problems,'SKU assignment required'); END IF;
 IF p.name IS NULL OR length(btrim(p.name))=0 THEN problems=array_append(problems,'Product name required'); END IF;
 IF p.review_status IN ('duplicate','rejected','archived') THEN problems=array_append(problems,'Product review state prevents publication: '||p.review_status); END IF;
 IF p.duplicate_of_product_id IS NOT NULL THEN problems=array_append(problems,'Confirmed duplicate cannot be published'); END IF;
 IF p.selling_price IS NULL OR p.selling_price<0 OR p.selling_price::text IN ('NaN','Infinity','-Infinity') THEN problems=array_append(problems,'Valid selling price required'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.dealer_products dp JOIN public.dealers d ON d.id=dp.dealer_id WHERE dp.product_id=pid AND dp.is_active AND d.is_active) THEN
  problems=array_append(problems,'Active dealer attachment required');
 END IF;
 IF NOT public.catalogue_saleability_ready(pid,p.currency) THEN problems=array_append(problems,'Current valid dealer pricing in the product currency required'); END IF;
 IF NOT EXISTS(WITH RECURSIVE tree AS (SELECT id FROM public.categories WHERE is_active AND parent_id IS NULL
 UNION SELECT c.id FROM public.categories c JOIN tree t ON c.parent_id=t.id WHERE c.is_active)
 SELECT 1 FROM public.product_categories pc JOIN tree t ON t.id=pc.category_id WHERE pc.product_id=pid AND pc.is_primary) THEN
  problems=array_append(problems,'Primary category must belong to an active category hierarchy');
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.product_media WHERE product_id=pid AND is_primary AND media_type='image') THEN problems=array_append(problems,'Primary image required'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.product_attributes x JOIN public.product_kinds k ON k.id=x.product_kind_id WHERE x.product_id=pid AND k.code=p.product_kind) THEN problems=array_append(problems,'Matching tag-model product attributes required'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.catalogue_taxonomy_versions WHERE version=3) THEN problems=array_append(problems,'Integrated tag-product cutover is not activated'); END IF;
 IF to_regprocedure('public.catalogue_product_model_ready(uuid,text)') IS NULL THEN
  problems=array_append(problems,'Product-model publication prerequisite is missing');
 ELSE
  EXECUTE 'SELECT public.catalogue_product_model_ready($1,$2)' INTO eligible USING pid,p.product_kind;
  IF eligible IS NOT TRUE THEN problems=array_append(problems,'Product model, active references or applicable categories are not eligible'); END IF;
 END IF;
 SELECT * INTO a FROM public.product_duplicate_audits WHERE product_id=pid ORDER BY created_at DESC,id DESC LIMIT 1;
 IF a.id IS NULL THEN problems=array_append(problems,'Initiate duplicate audit');
 ELSIF a.status<>'completed' OR a.product_revision<>p.revision OR a.algorithm_version<>'tags-evidence-v2' OR a.corpus_digest IS NULL THEN
  problems=array_append(problems,'Complete a current tags-evidence-v2 duplicate audit');
 ELSE
  SELECT * INTO r FROM public.product_duplicate_reviews WHERE audit_id=a.id ORDER BY created_at DESC,id DESC LIMIT 1;
  IF r.id IS NULL OR r.decision<>'approve_distinct' OR r.reviewer_id IS DISTINCT FROM p.approved_by THEN problems=array_append(problems,'Current audit requires explicit distinct approval'); END IF;
 END IF;
 IF p.review_status<>'approved' OR p.approved_revision IS DISTINCT FROM p.revision OR p.approved_by IS NULL THEN problems=array_append(problems,'Approval must match the current product revision'); END IF;
 IF NOT public.current_duplicate_approval(pid,p.revision,p.approved_by,p.product_kind) THEN problems=array_append(problems,'Current duplicate-approval evidence required'); END IF;
 IF cardinality(problems)=0 THEN
  BEGIN
   IF NOT p.published THEN UPDATE public.products SET published=true,updated_at=now() WHERE id=pid; END IF;
  EXCEPTION WHEN check_violation OR raise_exception THEN
   problems=array_append(problems,'Publication validation rejected: '||SQLERRM);
  END;
 END IF;
 IF cardinality(problems)>0 AND p.published THEN UPDATE public.products SET published=false,updated_at=now() WHERE id=pid; END IF;
 INSERT INTO public.catalogue_product_readiness(product_id,assessed_revision,ready,reasons,assessed_at)
 VALUES(pid,p.revision,cardinality(problems)=0,problems,clock_timestamp())
 ON CONFLICT(product_id) DO UPDATE SET assessed_revision=EXCLUDED.assessed_revision,ready=EXCLUDED.ready,reasons=EXCLUDED.reasons,assessed_at=EXCLUDED.assessed_at;
 IF was_published IS DISTINCT FROM (cardinality(problems)=0) THEN
  INSERT INTO public.admin_audit_log(actor_id,action,entity_type,entity_id,before_data,after_data)
  VALUES(NULL,'automatic_publication_assessment','products',pid,jsonb_build_object('published',was_published,'is_active',p.is_active),
  jsonb_build_object('published',cardinality(problems)=0,'is_active',p.is_active,'reasons',problems));
 END IF;
END;$$;
REVOKE ALL ON FUNCTION public.catalogue_reassess_product(uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.catalogue_reassess_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE oldrow jsonb='{}'; newrow jsonb='{}'; pid uuid;
BEGIN
 IF TG_OP<>'INSERT' THEN oldrow=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN newrow=to_jsonb(NEW); END IF;
 IF TG_TABLE_NAME='products' THEN
  IF TG_OP='DELETE' THEN RETURN NULL; END IF;
  IF TG_OP='UPDATE' AND (oldrow-'published'-'is_active'-'updated_at') IS NOT DISTINCT FROM (newrow-'published'-'is_active'-'updated_at') THEN RETURN NULL; END IF;
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
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['products','product_attributes','product_tags','product_categories','product_media','dealer_products','dealer_prices','product_duplicate_audits','product_duplicate_reviews','dealers','categories','product_kinds','tags','tag_groups'] LOOP
  EXECUTE format('CREATE CONSTRAINT TRIGGER pipeline_reassess AFTER INSERT OR UPDATE OR DELETE ON public.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalogue_reassess_changed()',tab);
 END LOOP;
END;$$;

-- Retain every existing public-view restriction, then add live saleability and stored readiness.
DO $$ DECLARE definition text; BEGIN
 SELECT pg_get_viewdef('public.public_products'::regclass,true) INTO definition;
 definition=rtrim(rtrim(definition),';');
 EXECUTE 'CREATE OR REPLACE VIEW public.public_products AS SELECT existing.* FROM ('||definition||') existing WHERE public.catalogue_saleability_ready(existing.id,existing.currency) AND NOT EXISTS(SELECT 1 FROM public.catalogue_product_readiness s WHERE s.product_id=existing.id AND (NOT s.ready OR s.assessed_revision<>existing.revision))';
END;$$;

CREATE VIEW public.catalogue_pipeline_status WITH (security_invoker=true) AS
SELECT p.id,p.sku,p.name,p.revision,p.is_active,p.published,s.assessed_at,s.assessed_revision,
 EXISTS(SELECT 1 FROM public.public_products v WHERE v.id=p.id) AS customer_visible,
 COALESCE(s.reasons,'{}'::text[])
 || CASE WHEN NOT p.is_active THEN ARRAY['Manually inactive'] ELSE '{}'::text[] END
 || CASE WHEN NOT p.published THEN ARRAY['Publication is not enabled'] ELSE '{}'::text[] END
 || CASE WHEN NOT public.catalogue_saleability_ready(p.id,p.currency) THEN ARRAY['No current eligible dealer price'] ELSE '{}'::text[] END
 || CASE WHEN s.product_id IS NULL THEN ARRAY['Pipeline assessment has not been recorded'] ELSE '{}'::text[] END AS reasons
FROM public.products p LEFT JOIN public.catalogue_product_readiness s ON s.product_id=p.id;
REVOKE ALL ON public.catalogue_pipeline_status FROM PUBLIC,anon,authenticated;
