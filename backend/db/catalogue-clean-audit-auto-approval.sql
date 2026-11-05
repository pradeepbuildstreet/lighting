-- Apply transactionally before enabling automatic clean-audit approval.
-- No product backfill, publication bypass, activation, or worker enablement.
BEGIN;
ALTER TABLE public.catalogue_pipeline_configuration
 ADD COLUMN auto_approve_clean_audits boolean NOT NULL DEFAULT false;
ALTER TABLE public.catalogue_duplicate_jobs
 DROP CONSTRAINT catalogue_duplicate_jobs_status_check;
ALTER TABLE public.catalogue_duplicate_jobs
 ADD CONSTRAINT catalogue_duplicate_jobs_status_check
 CHECK(status IN ('pending','processing','awaiting_review','completed','held','actor_required','failed'));
COMMENT ON COLUMN public.catalogue_pipeline_configuration.auto_approve_clean_audits IS
 'Opt-in: completed current full-catalogue audits with zero candidates may receive an audited automated distinct approval. Potential duplicates remain manual. Existing publication constraints are unchanged.';
COMMIT;
-- Enable only after deploying the matching worker and testing the database gates:
-- UPDATE public.catalogue_pipeline_configuration SET auto_approve_clean_audits=true WHERE singleton;
-- The existing enabled flag must also be true. This script does not change it.
