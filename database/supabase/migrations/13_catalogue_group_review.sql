-- Group-review persistence and retained-primary evidence. Does not enable the group UI/API.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(8102401);
SELECT pg_advisory_xact_lock(8102403);

CREATE TABLE public.product_duplicate_groups (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 reviewer_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
 request_key uuid NOT NULL,
 request_digest text NOT NULL CHECK (request_digest ~ '^[a-f0-9]{64}$'),
 notes text NOT NULL CHECK (length(btrim(notes)) BETWEEN 1 AND 5000),
 member_count integer NOT NULL CHECK (member_count BETWEEN 2 AND 1000),
 algorithm_version text NOT NULL CHECK (algorithm_version='tags-evidence-v2'),
 corpus_digest text NOT NULL CHECK (corpus_digest ~ '^[a-f0-9]{64}$'),
 evidence_snapshot jsonb NOT NULL CHECK (jsonb_typeof(evidence_snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(reviewer_id,request_key)
);
ALTER TABLE public.product_duplicate_reviews
 ADD COLUMN group_resolution_id uuid REFERENCES public.product_duplicate_groups(id) ON DELETE RESTRICT;
ALTER TABLE public.product_duplicate_reviews DROP CONSTRAINT product_duplicate_reviews_decision_check;
ALTER TABLE public.product_duplicate_reviews ADD CONSTRAINT product_duplicate_reviews_decision_check
 CHECK (decision IN ('approve_distinct','confirm_duplicate','request_correction','reject','retain_primary'));
ALTER TABLE public.product_duplicate_reviews ADD CONSTRAINT retained_primary_requires_group
 CHECK (decision<>'retain_primary' OR (group_resolution_id IS NOT NULL AND duplicate_of_product_id IS NULL));

CREATE TABLE public.product_duplicate_group_items (
 group_id uuid NOT NULL REFERENCES public.product_duplicate_groups(id) ON DELETE RESTRICT,
 product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
 reviewed_revision bigint NOT NULL CHECK (reviewed_revision>0),
 audit_id uuid NOT NULL REFERENCES public.product_duplicate_audits(id) ON DELETE RESTRICT,
 review_id uuid NOT NULL UNIQUE REFERENCES public.product_duplicate_reviews(id) ON DELETE RESTRICT,
 decision text NOT NULL CHECK (decision IN ('approve_distinct','retain_primary','confirm_duplicate')),
 duplicate_of_product_id uuid,
 product_snapshot jsonb NOT NULL CHECK (jsonb_typeof(product_snapshot)='object'
  AND product_snapshot ?& ARRAY['id','revision','is_active']
  AND jsonb_typeof(product_snapshot->'is_active')='boolean'
  AND product_snapshot->>'id'=product_id::text
  AND product_snapshot->>'revision'=reviewed_revision::text),
 PRIMARY KEY(group_id,product_id),
 CHECK ((decision='confirm_duplicate')=(duplicate_of_product_id IS NOT NULL)),
 CHECK (duplicate_of_product_id IS NULL OR duplicate_of_product_id<>product_id),
 FOREIGN KEY(group_id,duplicate_of_product_id)
  REFERENCES public.product_duplicate_group_items(group_id,product_id)
  ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX product_duplicate_group_product_history
 ON public.product_duplicate_group_items(product_id,group_id);
CREATE INDEX product_duplicate_group_targets
 ON public.product_duplicate_group_items(group_id,duplicate_of_product_id)
 WHERE duplicate_of_product_id IS NOT NULL;
ALTER TABLE public.product_duplicate_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_duplicate_group_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_duplicate_groups,public.product_duplicate_group_items FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.guard_duplicate_group_history() RETURNS trigger
 LANGUAGE plpgsql SET search_path TO 'pg_catalog','public' AS $guard$
BEGIN
 RAISE EXCEPTION 'Group review history is immutable; record an explicit audited reversal instead' USING ERRCODE='23514';
END;
$guard$;
CREATE TRIGGER duplicate_group_immutable BEFORE UPDATE OR DELETE ON public.product_duplicate_groups
 FOR EACH ROW EXECUTE FUNCTION public.guard_duplicate_group_history();
CREATE TRIGGER duplicate_group_item_immutable BEFORE UPDATE OR DELETE ON public.product_duplicate_group_items
 FOR EACH ROW EXECUTE FUNCTION public.guard_duplicate_group_history();
CREATE TRIGGER duplicate_group_review_immutable BEFORE UPDATE OR DELETE ON public.product_duplicate_reviews
 FOR EACH ROW WHEN (OLD.group_resolution_id IS NOT NULL)
 EXECUTE FUNCTION public.guard_duplicate_group_history();

CREATE FUNCTION public.validate_duplicate_group_resolution() RETURNS trigger
 LANGUAGE plpgsql SET search_path TO 'pg_catalog','public' AS $validate$
DECLARE gid uuid; g public.product_duplicate_groups%ROWTYPE; actor_id uuid; actual_count bigint;
BEGIN
 IF TG_TABLE_NAME='product_duplicate_groups' THEN gid:=NEW.id;
 ELSIF TG_TABLE_NAME='product_duplicate_reviews' THEN gid:=NEW.group_resolution_id;
 ELSE gid:=NEW.group_id; END IF;
 IF gid IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO STRICT g FROM public.product_duplicate_groups WHERE id=gid;
 actor_id:=nullif(current_setting('app.catalogue_actor_id',true),'')::uuid;
 IF actor_id IS DISTINCT FROM g.reviewer_id THEN
  RAISE EXCEPTION 'Group resolution requires its originating administrator' USING ERRCODE='42501';
 END IF;
 PERFORM 1 FROM public.app_users WHERE id=g.reviewer_id AND role='admin' AND is_active FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active administrator required' USING ERRCODE='42501'; END IF;
 SELECT count(*) INTO actual_count FROM public.product_duplicate_group_items WHERE group_id=gid;
 IF actual_count<>g.member_count THEN
  RAISE EXCEPTION 'Every group product requires exactly one recorded decision' USING ERRCODE='23514';
 END IF;
 IF (SELECT count(*) FROM public.product_duplicate_reviews WHERE group_resolution_id=gid)<>g.member_count THEN
  RAISE EXCEPTION 'Group and individual review records must agree' USING ERRCODE='23514';
 END IF;
 IF EXISTS (
  SELECT 1 FROM public.product_duplicate_group_items i
  JOIN public.product_duplicate_audits a ON a.id=i.audit_id
  JOIN public.product_duplicate_reviews r ON r.id=i.review_id
  JOIN public.products p ON p.id=i.product_id
  WHERE i.group_id=gid AND (
   p.revision<>i.reviewed_revision
   OR (i.decision='confirm_duplicate' AND (p.review_status<>'duplicate' OR p.is_active OR p.published
    OR p.duplicate_of_product_id IS DISTINCT FROM i.duplicate_of_product_id))
   OR (i.decision<>'confirm_duplicate' AND (p.review_status<>'approved'
    OR p.approved_revision IS DISTINCT FROM i.reviewed_revision
    OR p.approved_by IS DISTINCT FROM g.reviewer_id OR p.duplicate_of_product_id IS NOT NULL
    OR p.is_active IS DISTINCT FROM (i.product_snapshot->>'is_active')::boolean))
   OR
   a.product_id<>i.product_id OR a.product_revision<>i.reviewed_revision OR a.status<>'completed'
   OR a.algorithm_version<>g.algorithm_version OR a.corpus_digest IS DISTINCT FROM g.corpus_digest
   OR r.audit_id<>a.id OR r.group_resolution_id IS DISTINCT FROM gid
   OR r.reviewer_id<>g.reviewer_id OR r.decision<>i.decision
   OR r.duplicate_of_product_id IS DISTINCT FROM i.duplicate_of_product_id)
 ) THEN RAISE EXCEPTION 'Group evidence and individual reviews disagree' USING ERRCODE='23514'; END IF;
 IF EXISTS (SELECT 1 FROM public.product_duplicate_group_items i
  JOIN public.products child ON child.duplicate_of_product_id=i.product_id
  WHERE i.group_id=gid AND i.decision='confirm_duplicate') THEN
  RAISE EXCEPTION 'Reassign existing incoming duplicate links explicitly before replacing their primary' USING ERRCODE='23514';
 END IF;
 IF EXISTS (
  SELECT 1 FROM public.product_duplicate_group_items i
  LEFT JOIN public.product_duplicate_group_items target
   ON target.group_id=i.group_id AND target.product_id=i.duplicate_of_product_id
  WHERE i.group_id=gid AND i.decision='confirm_duplicate'
   AND (target.product_id IS NULL OR target.decision<>'retain_primary')
 ) THEN RAISE EXCEPTION 'Duplicates must point directly to a retained primary in this group' USING ERRCODE='23514'; END IF;
 IF EXISTS (
  SELECT 1 FROM public.product_duplicate_group_items i WHERE i.group_id=gid
   AND (i.decision='retain_primary') IS DISTINCT FROM EXISTS(
    SELECT 1 FROM public.product_duplicate_group_items d WHERE d.group_id=gid
     AND d.decision='confirm_duplicate' AND d.duplicate_of_product_id=i.product_id)
 ) THEN RAISE EXCEPTION 'Retained-primary decisions must match duplicate targets' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END;
$validate$;
CREATE CONSTRAINT TRIGGER duplicate_group_complete AFTER INSERT ON public.product_duplicate_groups
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_duplicate_group_resolution();
CREATE CONSTRAINT TRIGGER duplicate_group_item_complete AFTER INSERT ON public.product_duplicate_group_items
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_duplicate_group_resolution();
CREATE CONSTRAINT TRIGGER duplicate_group_review_complete AFTER INSERT ON public.product_duplicate_reviews
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.group_resolution_id IS NOT NULL)
 EXECUTE FUNCTION public.validate_duplicate_group_resolution();
REVOKE ALL ON FUNCTION public.guard_duplicate_group_history(),public.validate_duplicate_group_resolution()
 FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.current_duplicate_approval(pid uuid,rev bigint,reviewer uuid,kind text)
 RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'pg_catalog','public' AS $approval$
 -- duplicate-approval-policy: subject-revision-and-group-v2
 SELECT EXISTS(
  SELECT 1 FROM public.products p
  JOIN LATERAL(SELECT * FROM public.product_duplicate_audits WHERE product_id=p.id
   ORDER BY created_at DESC,id DESC LIMIT 1)a ON true
  JOIN LATERAL(SELECT * FROM public.product_duplicate_reviews WHERE audit_id=a.id
   ORDER BY created_at DESC,id DESC LIMIT 1)r ON true
  WHERE p.id=pid AND p.product_kind=kind AND p.revision=rev
   AND p.review_status='approved' AND p.approved_revision=rev
   AND p.approved_by=reviewer AND p.duplicate_of_product_id IS NULL
   AND a.status='completed' AND a.product_revision=rev AND a.corpus_digest IS NOT NULL
   AND r.reviewer_id=reviewer AND (
    r.decision='approve_distinct' OR (r.decision='retain_primary' AND EXISTS(
     SELECT 1 FROM public.product_duplicate_group_items i
     JOIN public.product_duplicate_groups g ON g.id=i.group_id
     WHERE i.group_id=r.group_resolution_id AND i.product_id=p.id
      AND i.audit_id=a.id AND i.review_id=r.id AND i.reviewed_revision=rev
      AND i.decision='retain_primary' AND g.reviewer_id=reviewer
      AND a.algorithm_version=g.algorithm_version AND a.corpus_digest=g.corpus_digest
      AND EXISTS(SELECT 1 FROM public.product_duplicate_group_items d
       WHERE d.group_id=g.id AND d.decision='confirm_duplicate' AND d.duplicate_of_product_id=p.id)
    ))
   )
 );
$approval$;
COMMIT;
