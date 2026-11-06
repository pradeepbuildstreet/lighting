-- Schema-informed duplicate protections; requires migration 13. No product backfill.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(8102401);
SELECT pg_advisory_xact_lock(8102403);
DO $prerequisite$
BEGIN
 IF to_regclass('public.product_duplicate_groups') IS NULL
  OR to_regclass('public.product_duplicate_group_items') IS NULL
  OR to_regclass('public.catalogue_duplicate_jobs') IS NULL
  OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
   AND table_name='product_duplicate_reviews' AND column_name='group_resolution_id')
  OR coalesce(position('subject-revision-and-group-v2' IN pg_get_functiondef(
   to_regprocedure('public.current_duplicate_approval(uuid,bigint,uuid,text)'))),0)=0 THEN
  RAISE EXCEPTION 'Group-review migration 13 and the catalogue pipeline must be installed first';
 END IF;
END;
$prerequisite$;

-- Preserve installed function attributes and all unrelated validation logic.
-- Fail closed if the inspected clauses have changed or occur more than once.
DO $patch$
DECLARE definition text; old_clause text; new_clause text;
BEGIN
 definition:=pg_get_functiondef(to_regprocedure('public.product_identity_changed()'));
 old_clause:=$old$NEW.published=false;NEW.review_status='draft';$old$;
 new_clause:=$new$NEW.published=false;NEW.review_status=CASE WHEN OLD.review_status='duplicate' OR OLD.duplicate_of_product_id IS NOT NULL THEN 'duplicate' ELSE 'draft' END;$new$;
 IF definition IS NULL OR length(definition)-length(replace(definition,old_clause,''))<>length(old_clause) THEN
  RAISE EXCEPTION 'Unexpected identity invalidation definition; review the migration before applying';
 END IF;
 EXECUTE replace(definition,old_clause,new_clause);

 definition:=pg_get_functiondef(to_regprocedure('public.catalogue_enqueue_duplicate(uuid)'));
 old_clause:=$old$IF NOT FOUND OR p.sku IS NULL OR p.review_status IN ('duplicate','rejected','archived') THEN RETURN; END IF;$old$;
 new_clause:=$new$IF NOT FOUND OR p.sku IS NULL OR p.duplicate_of_product_id IS NOT NULL OR p.review_status IN ('duplicate','rejected','archived') THEN RETURN; END IF;$new$;
 IF definition IS NULL OR length(definition)-length(replace(definition,old_clause,''))<>length(old_clause) THEN
  RAISE EXCEPTION 'Unexpected duplicate scheduler definition; review the migration before applying';
 END IF;
 EXECUTE replace(definition,old_clause,new_clause);

 definition:=pg_get_functiondef(to_regprocedure('public.catalogue_reassess_product(uuid)'));
 old_clause:=$old$IF r.id IS NULL OR r.decision<>'approve_distinct' OR r.reviewer_id IS DISTINCT FROM p.approved_by THEN problems=array_append(problems,'Current audit requires explicit distinct approval'); END IF;$old$;
 new_clause:=$new$-- group-review retained-primary reassessment v1
  IF r.id IS NULL OR r.reviewer_id IS DISTINCT FROM p.approved_by OR NOT (
   r.decision='approve_distinct' OR (r.decision='retain_primary' AND r.group_resolution_id IS NOT NULL
    AND public.current_duplicate_approval(pid,p.revision,p.approved_by,p.product_kind))
  ) THEN problems=array_append(problems,'Current audit requires validated distinct or retained-primary approval'); END IF;$new$;
 IF definition IS NULL OR length(definition)-length(replace(definition,old_clause,''))<>length(old_clause) THEN
  RAISE EXCEPTION 'Unexpected publication reassessment definition; review the migration before applying';
 END IF;
 EXECUTE replace(definition,old_clause,new_clause);
END;
$patch$;

CREATE FUNCTION public.guard_confirmed_duplicate_state() RETURNS trigger
 LANGUAGE plpgsql SET search_path TO 'pg_catalog','public' AS $guard$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF OLD.review_status='duplicate' OR OLD.duplicate_of_product_id IS NOT NULL THEN
   IF NEW.review_status IS DISTINCT FROM 'duplicate'
    OR NEW.duplicate_of_product_id IS DISTINCT FROM OLD.duplicate_of_product_id THEN
    RAISE EXCEPTION 'Confirmed duplicates cannot be reopened or retargeted by ordinary writes; an explicit audited reversal is required' USING ERRCODE='23514';
   END IF;
  END IF;
 END IF;
 IF NEW.review_status='duplicate' OR NEW.duplicate_of_product_id IS NOT NULL THEN
  IF NEW.review_status IS DISTINCT FROM 'duplicate' THEN
   RAISE EXCEPTION 'A duplicate link requires duplicate review status' USING ERRCODE='23514';
  END IF;
  NEW.is_active:=false;NEW.published:=false;
  NEW.approved_revision:=NULL;NEW.approved_by:=NULL;NEW.approved_at:=NULL;
 END IF;
 RETURN NEW;
END;
$guard$;
-- This name orders the guard after all BEFORE ROW product triggers inspected on 2026-11-06.
CREATE TRIGGER zzzz_confirmed_duplicate_terminal BEFORE INSERT OR UPDATE ON public.products
 FOR EACH ROW EXECUTE FUNCTION public.guard_confirmed_duplicate_state();

CREATE FUNCTION public.guard_confirmed_duplicate_job() RETURNS trigger
 LANGUAGE plpgsql SET search_path TO 'pg_catalog','public' AS $job$
BEGIN
 -- No product row lock here: product writers lock products before jobs.
 IF EXISTS(SELECT 1 FROM public.products p WHERE p.id=NEW.product_id
  AND (p.review_status='duplicate' OR p.duplicate_of_product_id IS NOT NULL)) THEN
  NEW.status:='held';NEW.lease_until:=NULL;NEW.lease_token:=NULL;
  NEW.last_error:='Confirmed duplicate excluded from review cycles';
  IF TG_OP='UPDATE' THEN NEW.generation:=GREATEST(NEW.generation,OLD.generation+1); END IF;
 END IF;
 RETURN NEW;
END;
$job$;
CREATE TRIGGER confirmed_duplicate_job_guard BEFORE INSERT OR UPDATE ON public.catalogue_duplicate_jobs
 FOR EACH ROW EXECUTE FUNCTION public.guard_confirmed_duplicate_job();
REVOKE ALL ON FUNCTION public.guard_confirmed_duplicate_state(),public.guard_confirmed_duplicate_job()
 FROM PUBLIC,anon,authenticated;
COMMIT;
