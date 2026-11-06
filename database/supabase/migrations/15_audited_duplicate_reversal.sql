-- Source migration only. Production installation requires separate approval. Do not replay 13/14.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SELECT pg_advisory_xact_lock(8102401);
SELECT pg_advisory_xact_lock(8102403);
DO $$BEGIN
 IF to_regprocedure('public.guard_confirmed_duplicate_state()') IS NULL OR to_regclass('public.product_duplicate_group_items') IS NULL OR to_regclass('public.catalogue_duplicate_jobs') IS NULL THEN
  RAISE EXCEPTION 'Group review and terminal duplicate protections are required';
 END IF;
END$$;
CREATE TABLE public.product_duplicate_reversals(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
 former_target_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
 request_key uuid NOT NULL,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 5000),
 expected_revision bigint NOT NULL CHECK(expected_revision>0),
 result_revision bigint NOT NULL CHECK(result_revision=expected_revision+1),
 review_id uuid NOT NULL UNIQUE REFERENCES public.product_duplicate_reviews(id) ON DELETE RESTRICT,
 audit_id uuid NOT NULL REFERENCES public.product_duplicate_audits(id) ON DELETE RESTRICT,
 group_resolution_id uuid REFERENCES public.product_duplicate_groups(id) ON DELETE RESTRICT,
 before_data jsonb NOT NULL,after_data jsonb NOT NULL,
 originating_review jsonb NOT NULL,originating_audit jsonb NOT NULL,
 primary_before jsonb,primary_after jsonb,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(actor_id,request_key)
);
CREATE INDEX product_duplicate_reversal_history ON public.product_duplicate_reversals(product_id,created_at DESC,id DESC);
-- Private one-use capability. No session flag or application role may write it.
CREATE TABLE public.catalogue_duplicate_reversal_context(
 product_id uuid PRIMARY KEY,actor_id uuid NOT NULL,transaction_id xid8 NOT NULL,before_data jsonb NOT NULL
);
ALTER TABLE public.product_duplicate_reversals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogue_duplicate_reversal_context ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_duplicate_reversals,public.catalogue_duplicate_reversal_context FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.product_duplicate_reversals TO service_role;
CREATE TRIGGER duplicate_reversal_immutable BEFORE UPDATE OR DELETE ON public.product_duplicate_reversals FOR EACH ROW EXECUTE FUNCTION public.guard_duplicate_group_history();
CREATE TRIGGER duplicate_reversal_no_truncate BEFORE TRUNCATE ON public.product_duplicate_reversals FOR EACH STATEMENT EXECUTE FUNCTION public.guard_duplicate_group_history();

CREATE OR REPLACE FUNCTION public.guard_confirmed_duplicate_state() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public' AS $guard$
DECLARE authorized uuid;
BEGIN
 IF TG_OP='UPDATE' AND (OLD.review_status='duplicate' OR OLD.duplicate_of_product_id IS NOT NULL) THEN
  IF NEW.review_status IS DISTINCT FROM 'duplicate' OR NEW.duplicate_of_product_id IS DISTINCT FROM OLD.duplicate_of_product_id THEN
   IF NEW.review_status IS DISTINCT FROM 'draft' OR NEW.duplicate_of_product_id IS NOT NULL
    OR NEW.revision IS DISTINCT FROM OLD.revision+1 OR NEW.is_active OR NEW.published
    OR NEW.approved_revision IS NOT NULL OR NEW.approved_by IS NOT NULL OR NEW.approved_at IS NOT NULL
    OR (to_jsonb(NEW)-ARRAY['revision','review_status','duplicate_of_product_id','is_active','published','approved_revision','approved_by','approved_at','updated_at'])
     IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['revision','review_status','duplicate_of_product_id','is_active','published','approved_revision','approved_by','approved_at','updated_at']) THEN
    RAISE EXCEPTION 'Only an audited inactive draft reversal is permitted' USING ERRCODE='23514';
   END IF;
   DELETE FROM public.catalogue_duplicate_reversal_context
    WHERE product_id=OLD.id AND transaction_id=pg_current_xact_id() AND before_data=to_jsonb(OLD)
     AND actor_id=nullif(current_setting('app.catalogue_actor_id',true),'')::uuid RETURNING actor_id INTO authorized;
   IF authorized IS NULL THEN
    RAISE EXCEPTION 'Confirmed duplicates require an explicit audited reversal' USING ERRCODE='23514';
   END IF;
   RETURN NEW;
  END IF;
 END IF;
 IF NEW.review_status='duplicate' OR NEW.duplicate_of_product_id IS NOT NULL THEN
  IF NEW.review_status IS DISTINCT FROM 'duplicate' THEN RAISE EXCEPTION 'A duplicate link requires duplicate review status' USING ERRCODE='23514'; END IF;
  NEW.is_active:=false;NEW.published:=false;NEW.approved_revision:=NULL;NEW.approved_by:=NULL;NEW.approved_at:=NULL;
 END IF;
 RETURN NEW;
END;$guard$;

CREATE FUNCTION public.reverse_confirmed_duplicate(_product uuid,_revision bigint,_review uuid,_group uuid,_target uuid,_request uuid,_reason text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public' AS $reverse$
DECLARE actor uuid;p public.products%ROWTYPE;t public.products%ROWTYPE;
 a public.product_duplicate_audits%ROWTYPE;r public.product_duplicate_reviews%ROWTYPE;e public.product_duplicate_reversals%ROWTYPE;
 before_product jsonb;after_product jsonb;primary_before jsonb;primary_after jsonb;invalidate_primary boolean=false;
BEGIN
 PERFORM pg_advisory_xact_lock(8102401);PERFORM pg_advisory_xact_lock(8102403);
 actor:=nullif(current_setting('app.catalogue_actor_id',true),'')::uuid;
 PERFORM 1 FROM public.app_users WHERE id=actor AND role='admin' AND is_active FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active originating administrator required' USING ERRCODE='42501'; END IF;
 IF _product IS NULL OR _review IS NULL OR _target IS NULL OR _request IS NULL OR _revision IS NULL
  OR _revision<1 OR _revision>=9223372036854775807 OR _reason IS NULL OR length(btrim(_reason)) NOT BETWEEN 1 AND 5000 THEN
  RAISE EXCEPTION 'Complete reversal expectations and a reason are required' USING ERRCODE='22023';
 END IF;
 _reason:=btrim(_reason);
 SELECT * INTO e FROM public.product_duplicate_reversals WHERE actor_id=actor AND request_key=_request;
 IF FOUND THEN
  IF e.product_id IS DISTINCT FROM _product OR e.expected_revision IS DISTINCT FROM _revision OR e.review_id IS DISTINCT FROM _review
   OR e.group_resolution_id IS DISTINCT FROM _group OR e.former_target_id IS DISTINCT FROM _target OR e.reason IS DISTINCT FROM _reason THEN
   RAISE EXCEPTION 'Request key already used for a different reversal' USING ERRCODE='40001';
  END IF;
  RETURN jsonb_build_object('reversal',to_jsonb(e),'replayed',true);
 END IF;
 PERFORM 1 FROM public.products WHERE id IN (_product,_target) ORDER BY id FOR UPDATE;
 SELECT * INTO p FROM public.products WHERE id=_product;
 IF NOT FOUND THEN RAISE EXCEPTION 'Product not found' USING ERRCODE='P0002'; END IF;
 IF p.revision IS DISTINCT FROM _revision OR p.review_status IS DISTINCT FROM 'duplicate' OR p.duplicate_of_product_id IS DISTINCT FROM _target THEN
  RAISE EXCEPTION 'Product resolution changed; reload before reversal' USING ERRCODE='40001';
 END IF;
 IF EXISTS(SELECT 1 FROM public.products WHERE duplicate_of_product_id=_product) THEN
  RAISE EXCEPTION 'Reverse incoming duplicate links individually before replacing their primary' USING ERRCODE='40001';
 END IF;
 SELECT * INTO a FROM public.product_duplicate_audits WHERE product_id=_product ORDER BY created_at DESC,id DESC LIMIT 1;
 SELECT * INTO r FROM public.product_duplicate_reviews WHERE audit_id=a.id ORDER BY created_at DESC,id DESC LIMIT 1;
 IF a.status IS DISTINCT FROM 'completed' OR r.id IS DISTINCT FROM _review OR r.decision IS DISTINCT FROM 'confirm_duplicate'
  OR r.group_resolution_id IS DISTINCT FROM _group OR r.duplicate_of_product_id IS DISTINCT FROM _target THEN
  RAISE EXCEPTION 'Originating audit or review changed; reload before reversal' USING ERRCODE='40001';
 END IF;
 SELECT * INTO t FROM public.products WHERE id=_target;
 IF NOT FOUND THEN RAISE EXCEPTION 'Retained target no longer exists' USING ERRCODE='40001'; END IF;
 -- Invalidate only the still-current retained-primary approval from this exact group.
 invalidate_primary:=_group IS NOT NULL AND t.review_status='approved' AND EXISTS(
  SELECT 1 FROM public.product_duplicate_group_items i WHERE i.group_id=_group AND i.product_id=_target
   AND i.decision='retain_primary' AND i.reviewed_revision=t.revision
   AND i.audit_id=(SELECT id FROM public.product_duplicate_audits WHERE product_id=_target ORDER BY created_at DESC,id DESC LIMIT 1)
   AND i.review_id=(SELECT id FROM public.product_duplicate_reviews WHERE audit_id=i.audit_id ORDER BY created_at DESC,id DESC LIMIT 1)
 ) AND public.current_duplicate_approval(t.id,t.revision,t.approved_by,t.product_kind);
 before_product:=to_jsonb(p);
 INSERT INTO public.catalogue_duplicate_reversal_context(product_id,actor_id,transaction_id,before_data)
 VALUES(_product,actor,pg_current_xact_id(),before_product);
 UPDATE public.products SET revision=revision+1,review_status='draft',duplicate_of_product_id=NULL,is_active=false,published=false,
  approved_revision=NULL,approved_by=NULL,approved_at=NULL WHERE id=_product RETURNING to_jsonb(products.*) INTO after_product;
 IF EXISTS(SELECT 1 FROM public.catalogue_duplicate_reversal_context WHERE product_id=_product) THEN
  RAISE EXCEPTION 'Reversal authorization was not consumed' USING ERRCODE='23514';
 END IF;
 IF invalidate_primary THEN
  primary_before:=to_jsonb(t);
  UPDATE public.products SET revision=revision+1,review_status='draft',published=false,approved_revision=NULL,approved_by=NULL,approved_at=NULL
   WHERE id=_target RETURNING to_jsonb(products.*) INTO primary_after;
 END IF;
 INSERT INTO public.catalogue_duplicate_jobs(product_id,product_revision,actor_id,status,last_error)
 SELECT id,revision,actor,'held','Audited duplicate reversal: explicit fresh review required' FROM public.products
 WHERE id=_product OR (invalidate_primary AND id=_target) ORDER BY id
 ON CONFLICT(product_id) DO UPDATE SET product_revision=EXCLUDED.product_revision,actor_id=EXCLUDED.actor_id,
  generation=catalogue_duplicate_jobs.generation+1,attempts=0,status='held',audit_id=NULL,lease_until=NULL,lease_token=NULL,
  last_error=EXCLUDED.last_error,updated_at=clock_timestamp();
 INSERT INTO public.product_duplicate_reversals(product_id,former_target_id,actor_id,request_key,reason,expected_revision,result_revision,review_id,audit_id,
  group_resolution_id,before_data,after_data,originating_review,originating_audit,primary_before,primary_after)
 VALUES(_product,_target,actor,_request,_reason,_revision,_revision+1,r.id,a.id,r.group_resolution_id,before_product,after_product,to_jsonb(r),to_jsonb(a),primary_before,primary_after) RETURNING * INTO e;
 INSERT INTO public.admin_audit_log(actor_id,action,entity_type,entity_id,before_data,after_data)
 VALUES(actor,'duplicate_reversal','products',_product,before_product,jsonb_build_object('reversal_id',e.id,'reason',_reason,'product',after_product,'primary_before',primary_before,'primary_after',primary_after));
 RETURN jsonb_build_object('reversal',to_jsonb(e),'replayed',false);
END;$reverse$;

CREATE FUNCTION public.validate_duplicate_reversal() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public' AS $validate$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.products p JOIN public.catalogue_duplicate_jobs j ON j.product_id=p.id
  WHERE p.id=NEW.product_id AND p.revision=NEW.result_revision AND p.review_status='draft' AND p.duplicate_of_product_id IS NULL
   AND NOT p.is_active AND NOT p.published AND p.approved_revision IS NULL AND p.approved_by IS NULL AND p.approved_at IS NULL
   AND j.product_revision=p.revision AND j.status='held' AND j.audit_id IS NULL AND j.lease_token IS NULL AND j.lease_until IS NULL)
  OR EXISTS(SELECT 1 FROM public.catalogue_duplicate_reversal_context WHERE product_id=NEW.product_id) THEN
  RAISE EXCEPTION 'Reversal state or job invalidation is incomplete' USING ERRCODE='23514';
 END IF;
 IF NEW.primary_after IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.products p JOIN public.catalogue_duplicate_jobs j ON j.product_id=p.id
  WHERE p.id=(NEW.primary_after->>'id')::uuid AND p.revision=(NEW.primary_after->>'revision')::bigint
   AND p.review_status='draft' AND NOT p.published AND p.approved_revision IS NULL AND p.approved_by IS NULL AND p.approved_at IS NULL
   AND p.is_active IS NOT DISTINCT FROM (NEW.primary_before->>'is_active')::boolean
   AND j.product_revision=p.revision AND j.status='held' AND j.audit_id IS NULL AND j.lease_token IS NULL AND j.lease_until IS NULL) THEN
  RAISE EXCEPTION 'Retained-primary invalidation is incomplete' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END;$validate$;
CREATE CONSTRAINT TRIGGER duplicate_reversal_complete AFTER INSERT ON public.product_duplicate_reversals
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_duplicate_reversal();
REVOKE ALL ON FUNCTION public.guard_confirmed_duplicate_state(),public.validate_duplicate_reversal(),
 public.reverse_confirmed_duplicate(uuid,bigint,uuid,uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.reverse_confirmed_duplicate(uuid,bigint,uuid,uuid,uuid,uuid,text) TO service_role;
COMMIT;
