CREATE TABLE public.draft_import_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 created_by uuid NOT NULL REFERENCES public.app_users(id),
 request_key uuid NOT NULL,
 digest text NOT NULL CHECK (digest ~ '^[a-f0-9]{64}$'),
 preview_token text NOT NULL CHECK (preview_token ~ '^[a-f0-9]{64}$'),
 reference_hash text NOT NULL CHECK (reference_hash ~ '^[a-f0-9]{64}$'),
 rows jsonb NOT NULL CHECK (jsonb_typeof(rows)='array' AND jsonb_array_length(rows) BETWEEN 1 AND 100),
 manifest jsonb NOT NULL CHECK (jsonb_typeof(manifest)='array' AND jsonb_array_length(manifest)<=200),
 manifest_bytes bigint NOT NULL CHECK (manifest_bytes BETWEEN 0 AND 262144000),
 status text NOT NULL DEFAULT 'preview' CHECK (status IN ('preview','committed','cancelled')),
 results jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(results)='array'),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '2 hours',
 committed_at timestamptz,
 UNIQUE(created_by,request_key),
 CHECK (status<>'committed' OR (committed_at IS NOT NULL AND jsonb_array_length(results)=jsonb_array_length(rows)))
);
CREATE UNIQUE INDEX draft_import_committed_digest ON public.draft_import_jobs(created_by,digest) WHERE status='committed';
CREATE INDEX draft_import_owner_previews ON public.draft_import_jobs(created_by,expires_at) WHERE status='preview';
CREATE TABLE public.draft_import_files (
 job_id uuid NOT NULL REFERENCES public.draft_import_jobs(id) ON DELETE RESTRICT,
 relative_path text NOT NULL CHECK (length(relative_path) BETWEEN 1 AND 1000),
 storage_key text NOT NULL UNIQUE CHECK (storage_key ~ '^[0-9a-f-]{36}\.(jpg|png|webp)$'),
 sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
 file_size_bytes bigint NOT NULL CHECK (file_size_bytes BETWEEN 1 AND 26214400),
 mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(job_id,relative_path)
);
ALTER TABLE public.draft_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_import_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.draft_import_jobs,public.draft_import_files FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.guard_draft_import_job() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'pg_catalog','public' AS $f$
BEGIN
 IF (to_jsonb(NEW)-'status'-'results'-'committed_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'results'-'committed_at') THEN
  RAISE EXCEPTION 'Preview identity and manifest are immutable' USING ERRCODE='23514';
 END IF;
 IF OLD.status<>'preview' AND NEW IS DISTINCT FROM OLD THEN
  RAISE EXCEPTION 'Closed import jobs are immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;$f$;
CREATE TRIGGER draft_import_job_immutable BEFORE UPDATE ON public.draft_import_jobs FOR EACH ROW EXECUTE FUNCTION public.guard_draft_import_job();
