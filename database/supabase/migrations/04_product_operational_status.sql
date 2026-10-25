-- Separate availability from publication without resetting product evidence.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(8102401);
SELECT pg_advisory_xact_lock(8102403);
DO $migration$
DECLARE definition text; gate text; function_name text;
BEGIN
 gate := E'BEGIN\n -- catalogue_operational_deactivation_v1: hiding an unchanged product never resets evidence.\n IF TG_OP = ''UPDATE'' THEN\n  IF OLD.published AND NEW.published AND NOT NEW.is_active\n   AND (to_jsonb(NEW) - ''is_active'' - ''updated_at'') IS NOT DISTINCT FROM (to_jsonb(OLD) - ''is_active'' - ''updated_at'') THEN\n   RETURN NEW;\n  END IF;\n END IF;\n';
 FOREACH function_name IN ARRAY ARRAY['check_publish','guard_tag_model_publication'] LOOP
  SELECT pg_get_functiondef(to_regprocedure('public.' || function_name || '()')) INTO definition;
  IF definition IS NULL THEN RAISE EXCEPTION 'Missing required publication function: %',function_name; END IF;
  IF position('catalogue_operational_deactivation_v1' IN definition)=0 THEN
   IF definition !~ 'BEGIN[[:space:]]' THEN RAISE EXCEPTION 'Unexpected publication function body: %',function_name; END IF;
   definition := regexp_replace(definition,'BEGIN[[:space:]]*',gate);
   EXECUTE definition;
  END IF;
 END LOOP;
END;
$migration$;
-- Only an unchanged published product may bypass checks when being hidden.
-- Reactivation, publication, price changes and content writes retain all existing checks.
-- Public visibility still requires is_active AND published and all eligibility rules.
-- No product, audit, review or approval rows are rewritten by this migration.
COMMIT;
