-- Requires separately installed migration 15. Execute only after exact-action approval.
-- Synthetic rows only; the enclosing transaction always rolls back. Not the full group/concurrency suite.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(8102401);
SELECT pg_advisory_xact_lock(8102403);
DO $test$
DECLARE actor uuid:=gen_random_uuid();subject uuid:=gen_random_uuid();target uuid:=gen_random_uuid();
 audit uuid;review uuid;request uuid:=gen_random_uuid();kind text;rev bigint;result jsonb;again jsonb;
BEGIN
 SELECT code INTO kind FROM public.product_kinds WHERE is_active ORDER BY id LIMIT 1;
 IF kind IS NULL THEN RAISE EXCEPTION 'An active technical product-kind reference is required'; END IF;
 INSERT INTO public.app_users(id,email,password_hash,role,is_active) VALUES(actor,'reversal-rollback-'||actor||'@example.invalid','disabled-synthetic-fixture','admin',true);
 PERFORM set_config('app.catalogue_actor_id',actor::text,true);
 INSERT INTO public.products(id,name,product_kind,is_active,published) VALUES(subject,'Synthetic reversal subject',kind,false,false),(target,'Synthetic reversal target',kind,false,false);
 SELECT revision INTO rev FROM public.products WHERE id=subject;
 INSERT INTO public.product_duplicate_audits(product_id,product_revision,status,algorithm_version,created_by,corpus_digest,scanned_count,completed_at)
 VALUES(subject,rev,'completed','tags-evidence-v2',actor,repeat('a',64),1,clock_timestamp()) RETURNING id INTO audit;
 INSERT INTO public.product_duplicate_reviews(audit_id,decision,duplicate_of_product_id,reviewer_id,notes)
 VALUES(audit,'confirm_duplicate',target,actor,'Synthetic rollback-only decision') RETURNING id INTO review;
 UPDATE public.products SET review_status='duplicate',duplicate_of_product_id=target WHERE id=subject;
 BEGIN
  UPDATE public.products SET review_status='draft',duplicate_of_product_id=NULL WHERE id=subject;
  RAISE EXCEPTION 'Ordinary reopening unexpectedly succeeded';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  UPDATE public.products SET duplicate_of_product_id=gen_random_uuid() WHERE id=subject;
  RAISE EXCEPTION 'Ordinary retargeting unexpectedly succeeded';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  PERFORM public.reverse_confirmed_duplicate(subject,rev+1,review,NULL,target,request,'Synthetic reversal');
  RAISE EXCEPTION 'Stale revision unexpectedly accepted';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN
  PERFORM public.reverse_confirmed_duplicate(subject,rev,gen_random_uuid(),NULL,target,request,'Synthetic reversal');
  RAISE EXCEPTION 'Changed review identity unexpectedly accepted';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 PERFORM set_config('app.catalogue_actor_id','',true);
 BEGIN
  PERFORM public.reverse_confirmed_duplicate(subject,rev,review,NULL,target,request,'Synthetic reversal');
  RAISE EXCEPTION 'Missing actor unexpectedly accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('app.catalogue_actor_id',actor::text,true);
 result:=public.reverse_confirmed_duplicate(subject,rev,review,NULL,target,request,'Synthetic reversal');
 IF result->>'replayed'<>'false' THEN RAISE EXCEPTION 'Initial reversal receipt invalid'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.products WHERE id=subject AND revision=rev+1 AND review_status='draft' AND duplicate_of_product_id IS NULL AND NOT is_active AND NOT published AND approved_revision IS NULL AND approved_by IS NULL AND approved_at IS NULL) THEN RAISE EXCEPTION 'Reversal did not preserve terminal safety'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.product_duplicate_reviews WHERE id=review AND decision='confirm_duplicate' AND duplicate_of_product_id=target) THEN RAISE EXCEPTION 'Original review was changed'; END IF;
 IF EXISTS(SELECT 1 FROM public.catalogue_duplicate_reversal_context WHERE product_id=subject) THEN RAISE EXCEPTION 'Capability leaked'; END IF;
 again:=public.reverse_confirmed_duplicate(subject,rev,review,NULL,target,request,'Synthetic reversal');
 IF again->>'replayed'<>'true' OR again->'reversal'->>'id' IS DISTINCT FROM result->'reversal'->>'id' THEN RAISE EXCEPTION 'Replay created another event'; END IF;
 BEGIN
  PERFORM public.reverse_confirmed_duplicate(subject,rev,review,NULL,target,request,'Different reason');
  RAISE EXCEPTION 'Changed request key reuse unexpectedly accepted';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN
  UPDATE public.product_duplicate_reversals SET reason='Changed history' WHERE id=(result->'reversal'->>'id')::uuid;
  RAISE EXCEPTION 'Historical event mutation unexpectedly accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 IF has_table_privilege('service_role','public.catalogue_duplicate_reversal_context','INSERT') OR has_table_privilege('service_role','public.product_duplicate_reversals','INSERT') THEN RAISE EXCEPTION 'Application role can forge reversal capability or history'; END IF;
 SET CONSTRAINTS ALL IMMEDIATE;
END;$test$;
SELECT 'Synthetic reversal checks completed; all fixture changes will roll back' AS result;
ROLLBACK;
