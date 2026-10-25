BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(8102401);
SELECT pg_advisory_xact_lock(8102403);
DO $migration$
DECLARE existing text;
BEGIN
 SELECT pg_get_constraintdef(oid) INTO existing FROM pg_constraint WHERE conrelid='public.products'::regclass AND conname='products_check1';
 IF existing IS NULL THEN RAISE EXCEPTION 'Expected products_check1 constraint is missing; inspect before migration'; END IF;
 IF existing = 'CHECK (((NOT published) OR ((review_status = ''approved''::text) AND (approved_revision IS NOT NULL) AND (approved_revision = revision) AND (approved_by IS NOT NULL) AND (selling_price IS NOT NULL))))' THEN RETURN; END IF;
 IF existing <> 'CHECK (((NOT published) OR (is_active AND (review_status = ''approved''::text) AND (approved_revision IS NOT NULL) AND (approved_revision = revision) AND (approved_by IS NOT NULL) AND (selling_price IS NOT NULL))))' THEN
  RAISE EXCEPTION 'Unexpected products_check1 definition; refusing to remove safeguards: %',existing;
 END IF;
 ALTER TABLE public.products DROP CONSTRAINT products_check1;
 ALTER TABLE public.products ADD CONSTRAINT products_check1 CHECK (NOT published OR (review_status='approved' AND approved_revision IS NOT NULL AND approved_revision=revision AND approved_by IS NOT NULL AND selling_price IS NOT NULL));
END;
$migration$;
COMMENT ON CONSTRAINT products_check1 ON public.products IS 'Publication retains approved revision, approver and price requirements independently of active availability. Public visibility separately requires is_active AND published.';
COMMIT;
