-- Apply after the base readiness migration and its no-op safeguard, in one transaction.
CREATE TABLE public.catalogue_pipeline_configuration (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), enabled boolean NOT NULL DEFAULT false
);
INSERT INTO public.catalogue_pipeline_configuration(singleton,enabled) VALUES(true,false);
CREATE TABLE public.catalogue_duplicate_jobs (
 product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
 product_revision bigint NOT NULL, actor_id uuid REFERENCES public.app_users(id),
 generation bigint NOT NULL DEFAULT 1, attempts integer NOT NULL DEFAULT 0,
 status text NOT NULL CHECK(status IN ('pending','processing','awaiting_review','held','actor_required','failed')),
 run_after timestamptz NOT NULL DEFAULT now(),lease_until timestamptz,lease_token uuid,
 audit_id uuid REFERENCES public.product_duplicate_audits(id) ON DELETE SET NULL,
 last_error text,updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.catalogue_pipeline_configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogue_duplicate_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.catalogue_pipeline_configuration,public.catalogue_duplicate_jobs FROM PUBLIC,anon,authenticated;
CREATE INDEX catalogue_duplicate_jobs_due ON public.catalogue_duplicate_jobs(run_after) WHERE status IN ('pending','processing');
CREATE FUNCTION public.catalogue_enqueue_duplicate(pid uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE p public.products%ROWTYPE; a public.product_duplicate_audits%ROWTYPE; actor uuid;
BEGIN
 SELECT * INTO p FROM public.products WHERE id=pid;
 IF NOT FOUND OR p.sku IS NULL OR p.review_status IN ('duplicate','rejected','archived') THEN RETURN; END IF;
 SELECT * INTO a FROM public.product_duplicate_audits WHERE product_id=pid ORDER BY created_at DESC,id DESC LIMIT 1;
 IF a.status='completed' AND a.product_revision=p.revision AND a.algorithm_version='tags-evidence-v2' AND a.corpus_digest IS NOT NULL THEN RETURN; END IF;
 BEGIN actor=nullif(current_setting('app.catalogue_actor_id',true),'')::uuid;
 EXCEPTION WHEN invalid_text_representation THEN actor=NULL; END;
 INSERT INTO public.catalogue_duplicate_jobs(product_id,product_revision,actor_id,status)
 VALUES(pid,p.revision,actor,CASE WHEN actor IS NULL THEN 'actor_required' ELSE 'pending' END)
 ON CONFLICT(product_id) DO UPDATE SET product_revision=EXCLUDED.product_revision,actor_id=EXCLUDED.actor_id,
 generation=catalogue_duplicate_jobs.generation+1,attempts=0,status=EXCLUDED.status,run_after=clock_timestamp(),last_error=NULL,audit_id=NULL,updated_at=clock_timestamp();
END;$$;
CREATE FUNCTION public.catalogue_readiness_enqueue_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN PERFORM public.catalogue_enqueue_duplicate(NEW.product_id); RETURN NULL; END;$$;
CREATE TRIGGER readiness_enqueue_audit AFTER INSERT OR UPDATE ON public.catalogue_product_readiness
FOR EACH ROW EXECUTE FUNCTION public.catalogue_readiness_enqueue_audit();
REVOKE ALL ON FUNCTION public.catalogue_enqueue_duplicate(uuid),public.catalogue_readiness_enqueue_audit() FROM PUBLIC,anon,authenticated;
-- Deliberately no initial backfill and no worker enablement here.
