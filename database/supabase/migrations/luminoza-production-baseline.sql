-- Luminoza fresh application database baseline; generated from the working schema.
-- NO products, customers, collections, passwords or application users are exported as table data.
-- Required technical version records only. Create the first administrator separately.
-- Requires PostgreSQL and psql major >= 18.
-- Do not replay historical migrations after this already-current baseline.
BEGIN;
SELECT pg_advisory_xact_lock(71420599);
DO $$ BEGIN
 IF current_setting('server_version_num')::integer/10000 < 18 THEN
  RAISE EXCEPTION 'Target PostgreSQL version is older than the generated baseline requires';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')) THEN
  RAISE EXCEPTION 'Target public schema is not empty. Refusing migration; no existing app data will be replaced';
 END IF;
END $$;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

--
-- PostgreSQL database dump
--

\restrict 9CKAcoMJgrqZrRinoqVdW2i8nE15AC6c70sPy3CyiJ7iO4vnZA785KN6IhYZTqN

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: catalogue_corpus_digest(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.catalogue_corpus_digest(kind text) RETURNS text
    LANGUAGE sql STABLE
    SET search_path TO 'pg_catalog', 'public'
    AS $$
 SELECT encode(public.digest(convert_to('['||coalesce(string_agg(
 '['||to_json(p.id::text)::text||','||to_json(p.revision::text)::text||','||
 CASE WHEN p.is_active THEN 'true' ELSE 'false' END||']',',' ORDER BY p.id),'')||']','UTF8'),'sha256'),'hex')
 FROM public.products p WHERE p.product_kind=kind;
$$;


--
-- Name: check_publish(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_publish() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
 IF NEW.published THEN
  IF NOT NEW.is_active OR NEW.review_status<>'approved' OR NEW.approved_revision IS DISTINCT FROM NEW.revision
   OR NEW.approved_by IS NULL OR NEW.selling_price IS NULL OR NEW.selling_price<0 OR NEW.duplicate_of_product_id IS NOT NULL
  THEN RAISE EXCEPTION 'Current active distinct approval and price required' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.product_categories pc JOIN public.categories c ON c.id=pc.category_id WHERE pc.product_id=NEW.id AND pc.is_primary AND c.is_active)
  THEN RAISE EXCEPTION 'Active primary category required' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.product_media WHERE product_id=NEW.id AND is_primary AND media_type='image')
  THEN RAISE EXCEPTION 'Primary image required' USING ERRCODE='23514'; END IF;
  IF NEW.product_kind='fixture' AND NOT EXISTS(SELECT 1 FROM public.fixture_specs s JOIN public.fixture_types t ON t.id=s.fixture_type_id WHERE s.product_id=NEW.id AND t.is_active)
  THEN RAISE EXCEPTION 'Active fixture specifications required' USING ERRCODE='23514'; END IF;
  IF NEW.product_kind='light' AND NOT EXISTS(SELECT 1 FROM public.light_specs s JOIN public.light_types t ON t.id=s.light_type_id WHERE s.product_id=NEW.id AND t.is_active)
  THEN RAISE EXCEPTION 'Active light specifications required' USING ERRCODE='23514'; END IF;
  IF NOT public.current_duplicate_approval(NEW.id,NEW.revision,NEW.approved_by,NEW.product_kind)
  THEN RAISE EXCEPTION 'Latest audit/review evidence required' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;


--
-- Name: current_duplicate_approval(uuid, bigint, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_duplicate_approval(pid uuid, rev bigint, reviewer uuid, kind text) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'pg_catalog', 'public'
    AS $$
 -- duplicate-approval-policy: subject-revision-v1
 SELECT EXISTS(
   SELECT 1
   FROM public.products p
   JOIN LATERAL (
     SELECT * FROM public.product_duplicate_audits
     WHERE product_id=p.id ORDER BY created_at DESC,id DESC LIMIT 1
   ) a ON true
   JOIN LATERAL (
     SELECT * FROM public.product_duplicate_reviews
     WHERE audit_id=a.id ORDER BY created_at DESC,id DESC LIMIT 1
   ) r ON true
   WHERE p.id=pid AND p.product_kind=kind AND p.revision=rev
     AND p.review_status='approved' AND p.approved_revision=rev
     AND p.approved_by=reviewer AND p.duplicate_of_product_id IS NULL
     AND a.status='completed' AND a.product_revision=rev
     AND a.corpus_digest IS NOT NULL
     AND r.decision='approve_distinct' AND r.reviewer_id=reviewer
 );
$$;


--
-- Name: guard_category_cycle(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_category_cycle() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF NEW.parent_id IS NOT NULL AND EXISTS(
 WITH RECURSIVE ancestors AS(SELECT id,parent_id FROM categories WHERE id=NEW.parent_id UNION SELECT c.id,c.parent_id FROM categories c JOIN ancestors a ON c.id=a.parent_id)
 SELECT 1 FROM ancestors WHERE id=NEW.id) THEN RAISE EXCEPTION 'Category cycle not allowed';END IF;
 RETURN NEW;
END $$;


--
-- Name: invalidate_fixture_configuration(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.invalidate_fixture_configuration() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ DECLARE a uuid;b uuid;BEGIN
 IF TG_TABLE_NAME='fixture_socket_groups' THEN
 IF TG_OP<>'INSERT' THEN a=OLD.fixture_product_id;END IF;IF TG_OP<>'DELETE' THEN b=NEW.fixture_product_id;END IF;
 ELSE
 IF TG_OP<>'INSERT' THEN SELECT fixture_product_id INTO a FROM fixture_socket_groups WHERE id=OLD.socket_group_id;END IF;
 IF TG_OP<>'DELETE' THEN SELECT fixture_product_id INTO b FROM fixture_socket_groups WHERE id=NEW.socket_group_id;END IF;
 END IF;
 IF a IS NOT NULL THEN PERFORM invalidate_product(a);END IF;IF b IS NOT NULL AND b IS DISTINCT FROM a THEN PERFORM invalidate_product(b);END IF;RETURN NULL;
END $$;


--
-- Name: invalidate_media_metadata(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.invalidate_media_metadata() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
 IF TG_OP='INSERT' THEN PERFORM invalidate_product(NEW.product_id);
 ELSIF TG_OP='DELETE' THEN PERFORM invalidate_product(OLD.product_id);
 ELSIF ROW(NEW.product_id,NEW.storage_key,NEW.external_url,NEW.media_type,NEW.is_primary,NEW.alt_text,NEW.caption,NEW.sort_order,NEW.poster_media_id,NEW.mime_type,NEW.file_size_bytes,NEW.sha256) IS DISTINCT FROM ROW(OLD.product_id,OLD.storage_key,OLD.external_url,OLD.media_type,OLD.is_primary,OLD.alt_text,OLD.caption,OLD.sort_order,OLD.poster_media_id,OLD.mime_type,OLD.file_size_bytes,OLD.sha256) THEN
 PERFORM invalidate_product(OLD.product_id);IF NEW.product_id IS DISTINCT FROM OLD.product_id THEN PERFORM invalidate_product(NEW.product_id);END IF;END IF;RETURN NULL;
END $$;


--
-- Name: invalidate_product(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.invalidate_product(pid uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN UPDATE products SET revision=revision+1,approved_revision=NULL,approved_by=NULL,approved_at=NULL,published=false,
 review_status=CASE WHEN review_status IN ('duplicate','rejected','archived') THEN review_status ELSE 'draft' END,updated_at=now() WHERE id=pid;END $$;


--
-- Name: invalidate_product_relation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.invalidate_product_relation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE a uuid;b uuid;
BEGIN
 IF TG_OP<>'INSERT' THEN a=OLD.product_id;END IF;IF TG_OP<>'DELETE' THEN b=NEW.product_id;END IF;
 IF a IS NOT NULL THEN PERFORM invalidate_product(a);END IF;
 IF b IS NOT NULL AND b IS DISTINCT FROM a THEN PERFORM invalidate_product(b);END IF;RETURN NULL;
END $$;


--
-- Name: product_identity_changed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.product_identity_changed() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF ROW(NEW.sku,NEW.name,NEW.product_kind,NEW.brand,NEW.model_number,NEW.description) IS DISTINCT FROM ROW(OLD.sku,OLD.name,OLD.product_kind,OLD.brand,OLD.model_number,OLD.description)
 THEN NEW.revision=OLD.revision+1;NEW.approved_revision=NULL;NEW.approved_by=NULL;NEW.approved_at=NULL;NEW.published=false;NEW.review_status='draft';END IF;
 NEW.updated_at=now();RETURN NEW;
END $$;


--
-- Name: touch_search_metadata(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_search_metadata() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN NEW.updated_at=now();RETURN NEW;END $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_audit_log (
    id bigint NOT NULL,
    actor_id uuid,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    before_data jsonb,
    after_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.admin_audit_log ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.admin_audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: app_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    role text DEFAULT 'admin'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT app_users_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'editor'::text, 'reviewer'::text])))
);


--
-- Name: background_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.background_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_type text NOT NULL,
    payload jsonb NOT NULL,
    state text DEFAULT 'queued'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    run_after timestamp with time zone DEFAULT now() NOT NULL,
    locked_at timestamp with time zone,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT background_jobs_attempts_check CHECK ((attempts >= 0)),
    CONSTRAINT background_jobs_state_check CHECK ((state = ANY (ARRAY['queued'::text, 'running'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    parent_id uuid,
    description text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT categories_check CHECK (((parent_id IS NULL) OR (parent_id <> id))),
    CONSTRAINT categories_slug_check CHECK ((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text)),
    CONSTRAINT categories_sort_order_check CHECK ((sort_order >= 0))
);


--
-- Name: dealer_prices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dealer_prices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dealer_product_id uuid NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    list_price numeric(14,2) NOT NULL,
    discount_percent numeric(5,2) DEFAULT 0 NOT NULL,
    net_price numeric(14,2) GENERATED ALWAYS AS (round((list_price * ((1)::numeric - (discount_percent / 100.0))), 2)) STORED,
    price_basis text NOT NULL,
    tax_percent numeric(5,2),
    valid_from timestamp with time zone NOT NULL,
    valid_to timestamp with time zone,
    CONSTRAINT dealer_prices_check CHECK (((valid_to IS NULL) OR (valid_to > valid_from))),
    CONSTRAINT dealer_prices_currency_check CHECK ((currency ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT dealer_prices_discount_percent_check CHECK (((discount_percent >= (0)::numeric) AND (discount_percent <= (100)::numeric))),
    CONSTRAINT dealer_prices_list_price_check CHECK ((list_price >= (0)::numeric)),
    CONSTRAINT dealer_prices_price_basis_check CHECK ((price_basis = ANY (ARRAY['tax_inclusive'::text, 'tax_exclusive'::text]))),
    CONSTRAINT dealer_prices_tax_percent_check CHECK (((tax_percent >= (0)::numeric) AND (tax_percent <= (100)::numeric)))
);


--
-- Name: dealer_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dealer_products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dealer_id uuid NOT NULL,
    product_id uuid NOT NULL,
    dealer_sku text,
    minimum_order_qty integer DEFAULT 1 NOT NULL,
    lead_time_days integer,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT dealer_products_lead_time_days_check CHECK ((lead_time_days >= 0)),
    CONSTRAINT dealer_products_minimum_order_qty_check CHECK ((minimum_order_qty > 0))
);


--
-- Name: dealers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dealers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dealer_code text NOT NULL,
    name text NOT NULL,
    contact_person text,
    phone text,
    email text,
    gstin text,
    address jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: fixture_light_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fixture_light_overrides (
    socket_group_id uuid NOT NULL,
    light_product_id uuid NOT NULL,
    decision text NOT NULL,
    reason text NOT NULL,
    reviewed_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fixture_light_overrides_decision_check CHECK ((decision = ANY (ARRAY['approve'::text, 'reject'::text]))),
    CONSTRAINT fixture_light_overrides_reason_check CHECK ((length(TRIM(BOTH FROM reason)) > 0))
);


--
-- Name: fixture_light_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fixture_light_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    socket_group_id uuid NOT NULL,
    light_type_id uuid NOT NULL,
    max_wattage numeric(10,2),
    supply_voltage_min numeric(10,2),
    supply_voltage_max numeric(10,2),
    max_diameter_mm numeric(10,2),
    max_length_mm numeric(10,2),
    requires_dimmable boolean DEFAULT false NOT NULL,
    notes text,
    CONSTRAINT fixture_light_rules_check CHECK (((supply_voltage_min IS NULL) = (supply_voltage_max IS NULL))),
    CONSTRAINT fixture_light_rules_check1 CHECK (((supply_voltage_min IS NULL) OR (supply_voltage_min <= supply_voltage_max))),
    CONSTRAINT fixture_light_rules_max_diameter_mm_check CHECK ((max_diameter_mm > (0)::numeric)),
    CONSTRAINT fixture_light_rules_max_length_mm_check CHECK ((max_length_mm > (0)::numeric)),
    CONSTRAINT fixture_light_rules_max_wattage_check CHECK ((max_wattage > (0)::numeric)),
    CONSTRAINT fixture_light_rules_supply_voltage_max_check CHECK ((supply_voltage_max > (0)::numeric)),
    CONSTRAINT fixture_light_rules_supply_voltage_min_check CHECK ((supply_voltage_min > (0)::numeric))
);


--
-- Name: fixture_socket_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fixture_socket_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fixture_product_id uuid NOT NULL,
    group_code text NOT NULL,
    socket_count integer NOT NULL,
    CONSTRAINT fixture_socket_groups_socket_count_check CHECK ((socket_count > 0))
);


--
-- Name: fixture_specs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fixture_specs (
    product_id uuid NOT NULL,
    product_kind text DEFAULT 'fixture'::text NOT NULL,
    fixture_type_id uuid NOT NULL,
    material text,
    style text,
    mounting_type text,
    width_mm numeric(10,2),
    depth_mm numeric(10,2),
    height_mm numeric(10,2),
    light_source_mode text NOT NULL,
    inbuilt_specs jsonb DEFAULT '{}'::jsonb NOT NULL,
    other_specs jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT fixture_specs_depth_mm_check CHECK ((depth_mm > (0)::numeric)),
    CONSTRAINT fixture_specs_height_mm_check CHECK ((height_mm > (0)::numeric)),
    CONSTRAINT fixture_specs_light_source_mode_check CHECK ((light_source_mode = ANY (ARRAY['replaceable'::text, 'integrated'::text, 'hybrid'::text]))),
    CONSTRAINT fixture_specs_product_kind_check CHECK ((product_kind = 'fixture'::text)),
    CONSTRAINT fixture_specs_width_mm_check CHECK ((width_mm > (0)::numeric))
);


--
-- Name: fixture_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fixture_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: homepage_collection_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.homepage_collection_audit (
    id bigint NOT NULL,
    collection_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    action text NOT NULL,
    before_state jsonb,
    after_state jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT homepage_collection_audit_action_check CHECK ((action = ANY (ARRAY['create'::text, 'update'::text])))
);


--
-- Name: homepage_collection_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.homepage_collection_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: homepage_collection_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.homepage_collection_audit_id_seq OWNED BY public.homepage_collection_audit.id;


--
-- Name: homepage_collection_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.homepage_collection_products (
    collection_id uuid NOT NULL,
    product_id uuid NOT NULL,
    sort_order integer NOT NULL,
    CONSTRAINT homepage_collection_products_sort_order_check CHECK (((sort_order >= 0) AND (sort_order <= 100000)))
);


--
-- Name: homepage_collections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.homepage_collections (
    id uuid NOT NULL,
    title character varying(120) NOT NULL,
    slug character varying(100) NOT NULL,
    description character varying(2000) DEFAULT ''::character varying NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    cover_product_id uuid,
    revision integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT homepage_collections_revision_check CHECK ((revision > 0)),
    CONSTRAINT homepage_collections_slug_check CHECK (((slug)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text)),
    CONSTRAINT homepage_collections_sort_order_check CHECK (((sort_order >= 0) AND (sort_order <= 100000))),
    CONSTRAINT homepage_collections_title_check CHECK ((length(TRIM(BOTH FROM title)) > 0))
);


--
-- Name: homepage_feature_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.homepage_feature_versions (
    version integer NOT NULL,
    installed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: import_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.import_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_by uuid NOT NULL,
    status text NOT NULL,
    mode text NOT NULL,
    workbook_sha256 text NOT NULL,
    preview_revision text,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    committed_at timestamp with time zone,
    CONSTRAINT import_jobs_mode_check CHECK ((mode = ANY (ARRAY['create'::text, 'update'::text, 'upsert'::text]))),
    CONSTRAINT import_jobs_status_check CHECK ((status = ANY (ARRAY['uploaded'::text, 'validating'::text, 'preview'::text, 'committing'::text, 'committed'::text, 'failed'::text, 'expired'::text])))
);


--
-- Name: import_row_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.import_row_results (
    id bigint NOT NULL,
    job_id uuid NOT NULL,
    sheet text NOT NULL,
    row_number integer NOT NULL,
    record_key text,
    action text,
    staged_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    errors jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT import_row_results_action_check CHECK ((action = ANY (ARRAY['insert'::text, 'update'::text, 'unchanged'::text, 'error'::text]))),
    CONSTRAINT import_row_results_row_number_check CHECK ((row_number >= 2))
);


--
-- Name: import_row_results_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.import_row_results ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.import_row_results_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: light_specs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.light_specs (
    product_id uuid NOT NULL,
    product_kind text DEFAULT 'light'::text NOT NULL,
    light_type_id uuid NOT NULL,
    wattage numeric(10,2),
    lumens integer,
    color_temperature_k integer,
    voltage_min numeric(10,2),
    voltage_max numeric(10,2),
    diameter_mm numeric(10,2),
    length_mm numeric(10,2),
    dimmable boolean,
    other_specs jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT light_specs_check CHECK (((voltage_min IS NULL) OR (voltage_max IS NULL) OR (voltage_min <= voltage_max))),
    CONSTRAINT light_specs_color_temperature_k_check CHECK ((color_temperature_k > 0)),
    CONSTRAINT light_specs_diameter_mm_check CHECK ((diameter_mm > (0)::numeric)),
    CONSTRAINT light_specs_length_mm_check CHECK ((length_mm > (0)::numeric)),
    CONSTRAINT light_specs_lumens_check CHECK ((lumens >= 0)),
    CONSTRAINT light_specs_product_kind_check CHECK ((product_kind = 'light'::text)),
    CONSTRAINT light_specs_voltage_max_check CHECK ((voltage_max > (0)::numeric)),
    CONSTRAINT light_specs_voltage_min_check CHECK ((voltage_min > (0)::numeric)),
    CONSTRAINT light_specs_wattage_check CHECK ((wattage > (0)::numeric))
);


--
-- Name: light_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.light_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    base_type text,
    technology text,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: media_embeddings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_embeddings (
    media_id uuid NOT NULL,
    model_version text NOT NULL,
    dimensions integer NOT NULL,
    embedding real[] NOT NULL,
    CONSTRAINT media_embeddings_check CHECK ((cardinality(embedding) = dimensions)),
    CONSTRAINT media_embeddings_dimensions_check CHECK ((dimensions > 0))
);


--
-- Name: product_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_categories (
    product_id uuid NOT NULL,
    category_id uuid NOT NULL,
    is_primary boolean DEFAULT false NOT NULL
);


--
-- Name: product_compatibility_assessments_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_compatibility_assessments_v1 (
    fixture_id uuid NOT NULL,
    fingerprint character(64) NOT NULL,
    result jsonb NOT NULL,
    assessed_by uuid NOT NULL,
    assessed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_compatibility_assessments_v1_fingerprint_check CHECK ((fingerprint ~ '^[0-9a-f]{64}$'::text))
);


--
-- Name: product_compatibility_audit_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_compatibility_audit_v1 (
    id bigint NOT NULL,
    fixture_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    fingerprint character(64) NOT NULL,
    result jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: product_compatibility_audit_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_compatibility_audit_v1_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_compatibility_audit_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_compatibility_audit_v1_id_seq OWNED BY public.product_compatibility_audit_v1.id;


--
-- Name: product_duplicate_audits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_duplicate_audits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    product_revision bigint NOT NULL,
    status text NOT NULL,
    algorithm_version text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    error_message text,
    corpus_digest text,
    scanned_count integer,
    CONSTRAINT product_duplicate_audits_scanned_count_check CHECK ((scanned_count >= 0)),
    CONSTRAINT product_duplicate_audits_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: product_duplicate_candidates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_duplicate_candidates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    audit_id uuid NOT NULL,
    product_id uuid NOT NULL,
    candidate_product_id uuid NOT NULL,
    overall_score numeric(6,3) NOT NULL,
    spec_score numeric(6,3),
    image_score numeric(6,3),
    evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT product_duplicate_candidates_check CHECK ((product_id <> candidate_product_id)),
    CONSTRAINT product_duplicate_candidates_image_score_check CHECK (((image_score >= (0)::numeric) AND (image_score <= (100)::numeric))),
    CONSTRAINT product_duplicate_candidates_overall_score_check CHECK (((overall_score >= (0)::numeric) AND (overall_score <= (100)::numeric))),
    CONSTRAINT product_duplicate_candidates_spec_score_check CHECK (((spec_score >= (0)::numeric) AND (spec_score <= (100)::numeric)))
);


--
-- Name: product_duplicate_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_duplicate_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    audit_id uuid NOT NULL,
    decision text NOT NULL,
    duplicate_of_product_id uuid,
    reviewer_id uuid NOT NULL,
    notes text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_duplicate_reviews_check CHECK (((decision <> 'confirm_duplicate'::text) OR (duplicate_of_product_id IS NOT NULL))),
    CONSTRAINT product_duplicate_reviews_decision_check CHECK ((decision = ANY (ARRAY['approve_distinct'::text, 'confirm_duplicate'::text, 'request_correction'::text, 'reject'::text])))
);


--
-- Name: product_media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    media_type text NOT NULL,
    storage_key text,
    external_url text,
    mime_type text,
    file_size_bytes bigint,
    alt_text text,
    caption text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    poster_media_id uuid,
    sha256 text,
    perceptual_hash text,
    processing_status text DEFAULT 'pending'::text NOT NULL,
    processing_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_media_check CHECK (((storage_key IS NOT NULL) <> (external_url IS NOT NULL))),
    CONSTRAINT product_media_check1 CHECK (((NOT is_primary) OR (media_type = 'image'::text))),
    CONSTRAINT product_media_check2 CHECK (((poster_media_id IS NULL) OR (poster_media_id <> id))),
    CONSTRAINT product_media_external_url_check CHECK (((external_url IS NULL) OR (external_url ~ '^https://'::text))),
    CONSTRAINT product_media_file_size_bytes_check CHECK ((file_size_bytes >= 0)),
    CONSTRAINT product_media_media_type_check CHECK ((media_type = ANY (ARRAY['image'::text, 'video'::text]))),
    CONSTRAINT product_media_processing_status_check CHECK ((processing_status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'not_applicable'::text]))),
    CONSTRAINT product_media_storage_key_check CHECK (((storage_key IS NULL) OR ((length(storage_key) > 0) AND (storage_key !~ '(^/|(^|/)\.\.(/|$)|\\)'::text))))
);


--
-- Name: product_search_metadata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_search_metadata (
    product_id uuid NOT NULL,
    slug text,
    seo_title text,
    meta_description text,
    gtin text,
    mpn text,
    merchant_product_type text,
    google_product_category text,
    condition text DEFAULT 'new'::text NOT NULL,
    availability text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_search_metadata_availability_check CHECK (((availability IS NULL) OR (availability = ANY (ARRAY['in_stock'::text, 'out_of_stock'::text, 'preorder'::text, 'backorder'::text])))),
    CONSTRAINT product_search_metadata_condition_check CHECK ((condition = ANY (ARRAY['new'::text, 'used'::text, 'refurbished'::text]))),
    CONSTRAINT product_search_metadata_gtin_check CHECK (((gtin IS NULL) OR (gtin ~ '^([0-9]{8}|[0-9]{12}|[0-9]{13}|[0-9]{14})$'::text))),
    CONSTRAINT product_search_metadata_meta_description_check CHECK ((char_length(meta_description) <= 1000)),
    CONSTRAINT product_search_metadata_seo_title_check CHECK ((char_length(seo_title) <= 255)),
    CONSTRAINT product_search_metadata_slug_check CHECK (((slug IS NULL) OR (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text)))
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sku text NOT NULL,
    name text NOT NULL,
    product_kind text NOT NULL,
    brand text,
    model_number text,
    description text,
    selling_price numeric(14,2),
    currency text DEFAULT 'INR'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    published boolean DEFAULT false NOT NULL,
    review_status text DEFAULT 'draft'::text NOT NULL,
    revision bigint DEFAULT 1 NOT NULL,
    approved_revision bigint,
    approved_by uuid,
    approved_at timestamp with time zone,
    duplicate_of_product_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT products_check CHECK (((duplicate_of_product_id IS NULL) OR (duplicate_of_product_id <> id))),
    CONSTRAINT products_check1 CHECK (((NOT published) OR (is_active AND (review_status = 'approved'::text) AND (approved_revision IS NOT NULL) AND (approved_revision = revision) AND (approved_by IS NOT NULL) AND (selling_price IS NOT NULL)))),
    CONSTRAINT products_check2 CHECK (((review_status <> 'duplicate'::text) OR (duplicate_of_product_id IS NOT NULL))),
    CONSTRAINT products_currency_check CHECK ((currency ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT products_product_kind_check CHECK ((product_kind = ANY (ARRAY['fixture'::text, 'light'::text]))),
    CONSTRAINT products_review_status_check CHECK ((review_status = ANY (ARRAY['draft'::text, 'pending_audit'::text, 'pending_review'::text, 'approved'::text, 'duplicate'::text, 'rejected'::text, 'archived'::text]))),
    CONSTRAINT products_revision_check CHECK ((revision > 0)),
    CONSTRAINT products_selling_price_check CHECK ((selling_price >= (0)::numeric)),
    CONSTRAINT products_sku_check CHECK (((sku = upper(TRIM(BOTH FROM sku))) AND (length(sku) > 0)))
);


--
-- Name: public_products; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.public_products AS
 SELECT id,
    sku,
    name,
    product_kind,
    brand,
    model_number,
    description,
    selling_price,
    currency,
    is_active,
    published,
    review_status,
    revision,
    approved_revision,
    approved_by,
    approved_at,
    duplicate_of_product_id,
    created_at,
    updated_at
   FROM public.products p
  WHERE (is_active AND published AND (review_status = 'approved'::text) AND (approved_revision = revision) AND (duplicate_of_product_id IS NULL) AND (selling_price IS NOT NULL) AND (selling_price >= (0)::numeric) AND public.current_duplicate_approval(id, revision, approved_by, product_kind) AND (EXISTS ( SELECT 1
           FROM (public.product_categories pc
             JOIN public.categories c ON ((c.id = pc.category_id)))
          WHERE ((pc.product_id = p.id) AND pc.is_primary AND c.is_active))) AND (EXISTS ( SELECT 1
           FROM public.product_media m
          WHERE ((m.product_id = p.id) AND m.is_primary AND (m.media_type = 'image'::text)))) AND (((product_kind = 'fixture'::text) AND (EXISTS ( SELECT 1
           FROM (public.fixture_specs s
             JOIN public.fixture_types t ON ((t.id = s.fixture_type_id)))
          WHERE ((s.product_id = p.id) AND t.is_active)))) OR ((product_kind = 'light'::text) AND (EXISTS ( SELECT 1
           FROM (public.light_specs s
             JOIN public.light_types t ON ((t.id = s.light_type_id)))
          WHERE ((s.product_id = p.id) AND t.is_active))))));


--
-- Name: schema_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_versions (
    version integer NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: wishlist_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wishlist_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    wishlist_id uuid NOT NULL,
    sku character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    price numeric(12,2) NOT NULL,
    image_url character varying(500),
    category_slug character varying(100),
    add_count integer DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    product_id uuid,
    currency character varying(3),
    media jsonb,
    product_href text,
    catalogue_revision text,
    CONSTRAINT wishlist_items_add_count_check CHECK ((add_count > 0)),
    CONSTRAINT wishlist_items_catalogue_uuid_required_v1 CHECK ((product_id IS NOT NULL))
);


--
-- Name: wishlist_offer_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wishlist_offer_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    offer_id uuid NOT NULL,
    sku character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    quantity integer NOT NULL,
    list_price numeric(12,2) NOT NULL,
    offer_price numeric(12,2) NOT NULL,
    image_url character varying(500),
    category_slug character varying(100),
    product_id uuid,
    currency character varying(3),
    media jsonb,
    product_href text,
    catalogue_revision text,
    CONSTRAINT wishlist_offer_items_catalogue_uuid_required_v1 CHECK ((product_id IS NOT NULL)),
    CONSTRAINT wishlist_offer_items_check CHECK (((offer_price >= (0)::numeric) AND (offer_price <= list_price))),
    CONSTRAINT wishlist_offer_items_list_price_check CHECK ((list_price >= (0)::numeric)),
    CONSTRAINT wishlist_offer_items_quantity_check CHECK ((quantity > 0))
);


--
-- Name: wishlist_offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wishlist_offers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    wishlist_id uuid NOT NULL,
    offer_token character varying(64) NOT NULL,
    version integer NOT NULL,
    status character varying(20) DEFAULT 'ready'::character varying NOT NULL,
    terms jsonb DEFAULT '{}'::jsonb NOT NULL,
    expires_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT wishlist_offers_status_check CHECK (((status)::text = ANY ((ARRAY['ready'::character varying, 'accepted'::character varying, 'declined'::character varying, 'expired'::character varying])::text[]))),
    CONSTRAINT wishlist_offers_version_check CHECK ((version > 0))
);


--
-- Name: wishlists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wishlists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_hash character(64) NOT NULL,
    share_token character varying(64) NOT NULL,
    customer_name character varying(160),
    mobile_number character varying(20),
    email character varying(254),
    pin_code character(6),
    requirements text,
    communication_channel character varying(20),
    whatsapp_opened_at timestamp with time zone,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    submitted_at timestamp without time zone,
    CONSTRAINT wishlist_customer_details_complete CHECK ((((status)::text = 'draft'::text) OR ((customer_name IS NOT NULL) AND (mobile_number IS NOT NULL) AND (pin_code IS NOT NULL) AND (submitted_at IS NOT NULL)))),
    CONSTRAINT wishlists_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'submitted'::character varying, 'contacted'::character varying, 'closed'::character varying])::text[])))
);


--
-- Name: homepage_collection_audit id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homepage_collection_audit ALTER COLUMN id SET DEFAULT nextval('public.homepage_collection_audit_id_seq'::regclass);


--
-- Name: product_compatibility_audit_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_compatibility_audit_v1 ALTER COLUMN id SET DEFAULT nextval('public.product_compatibility_audit_v1_id_seq'::regclass);


--
-- Name: admin_audit_log admin_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id);


--
-- Name: app_users app_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_pkey PRIMARY KEY (id);


--
-- Name: background_jobs background_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.background_jobs
    ADD CONSTRAINT background_jobs_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_slug_key UNIQUE (slug);


--
-- Name: dealer_prices dealer_prices_dealer_product_id_currency_tstzrange_excl; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dealer_prices
    ADD CONSTRAINT dealer_prices_dealer_product_id_currency_tstzrange_excl EXCLUDE USING gist (dealer_product_id WITH =, currency WITH =, tstzrange(valid_from, valid_to, '[)'::text) WITH &&);


--
-- Name: dealer_prices dealer_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dealer_prices
    ADD CONSTRAINT dealer_prices_pkey PRIMARY KEY (id);


--
-- Name: dealer_products dealer_products_dealer_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dealer_products
    ADD CONSTRAINT dealer_products_dealer_id_product_id_key UNIQUE (dealer_id, product_id);


--
-- Name: dealer_products dealer_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dealer_products
    ADD CONSTRAINT dealer_products_pkey PRIMARY KEY (id);


--
-- Name: dealers dealers_dealer_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dealers
    ADD CONSTRAINT dealers_dealer_code_key UNIQUE (dealer_code);


--
-- Name: dealers dealers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dealers
    ADD CONSTRAINT dealers_pkey PRIMARY KEY (id);


--
-- Name: fixture_light_overrides fixture_light_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixture_light_overrides
    ADD CONSTRAINT fixture_light_overrides_pkey PRIMARY KEY (socket_group_id, light_product_id);


--
-- Name: fixture_light_rules fixture_light_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixture_light_rules
    ADD CONSTRAINT fixture_light_rules_pkey PRIMARY KEY (id);


--
-- Name: fixture_light_rules fixture_light_rules_socket_group_id_light_type_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixture_light_rules
    ADD CONSTRAINT fixture_light_rules_socket_group_id_light_type_id_key UNIQUE (socket_group_id, light_type_id);


--
-- Name: fixture_socket_groups fixture_socket_groups_fixture_product_id_group_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixture_socket_groups
    ADD CONSTRAINT fixture_socket_groups_fixture_product_id_group_code_key UNIQUE (fixture_product_id, group_code);


--
-- Name: fixture_socket_groups fixture_socket_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixture_socket_groups
    ADD CONSTRAINT fixture_socket_groups_pkey PRIMARY KEY (id);


--
-- Name: fixture_specs fixture_specs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixture_specs
    ADD CONSTRAINT fixture_specs_pkey PRIMARY KEY (product_id);


--
-- Name: fixture_types fixture_types_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixture_types
    ADD CONSTRAINT fixture_types_code_key UNIQUE (code);


--
-- Name: fixture_types fixture_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixture_types
    ADD CONSTRAINT fixture_types_pkey PRIMARY KEY (id);


--
-- Name: homepage_collection_audit homepage_collection_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homepage_collection_audit
    ADD CONSTRAINT homepage_collection_audit_pkey PRIMARY KEY (id);


--
-- Name: homepage_collection_products homepage_collection_products_collection_id_sort_order_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homepage_collection_products
    ADD CONSTRAINT homepage_collection_products_collection_id_sort_order_key UNIQUE (collection_id, sort_order);


--
-- Name: homepage_collection_products homepage_collection_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homepage_collection_products
    ADD CONSTRAINT homepage_collection_products_pkey PRIMARY KEY (collection_id, product_id);


--
-- Name: homepage_collections homepage_collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homepage_collections
    ADD CONSTRAINT homepage_collections_pkey PRIMARY KEY (id);


--
-- Name: homepage_collections homepage_collections_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homepage_collections
    ADD CONSTRAINT homepage_collections_slug_key UNIQUE (slug);


--
-- Name: homepage_feature_versions homepage_feature_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homepage_feature_versions
    ADD CONSTRAINT homepage_feature_versions_pkey PRIMARY KEY (version);


--
-- Name: import_jobs import_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_jobs
    ADD CONSTRAINT import_jobs_pkey PRIMARY KEY (id);


--
-- Name: import_row_results import_row_results_job_id_sheet_row_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_row_results
    ADD CONSTRAINT import_row_results_job_id_sheet_row_number_key UNIQUE (job_id, sheet, row_number);


--
-- Name: import_row_results import_row_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_row_results
    ADD CONSTRAINT import_row_results_pkey PRIMARY KEY (id);


--
-- Name: light_specs light_specs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.light_specs
    ADD CONSTRAINT light_specs_pkey PRIMARY KEY (product_id);


--
-- Name: light_types light_types_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.light_types
    ADD CONSTRAINT light_types_code_key UNIQUE (code);


--
-- Name: light_types light_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.light_types
    ADD CONSTRAINT light_types_pkey PRIMARY KEY (id);


--
-- Name: media_embeddings media_embeddings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_embeddings
    ADD CONSTRAINT media_embeddings_pkey PRIMARY KEY (media_id, model_version);


--
-- Name: product_categories product_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_categories
    ADD CONSTRAINT product_categories_pkey PRIMARY KEY (product_id, category_id);


--
-- Name: product_compatibility_assessments_v1 product_compatibility_assessments_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_compatibility_assessments_v1
    ADD CONSTRAINT product_compatibility_assessments_v1_pkey PRIMARY KEY (fixture_id);


--
-- Name: product_compatibility_audit_v1 product_compatibility_audit_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_compatibility_audit_v1
    ADD CONSTRAINT product_compatibility_audit_v1_pkey PRIMARY KEY (id);


--
-- Name: product_duplicate_audits product_duplicate_audits_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_duplicate_audits
    ADD CONSTRAINT product_duplicate_audits_id_product_id_key UNIQUE (id, product_id);


--
-- Name: product_duplicate_audits product_duplicate_audits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_duplicate_audits
    ADD CONSTRAINT product_duplicate_audits_pkey PRIMARY KEY (id);


--
-- Name: product_duplicate_candidates product_duplicate_candidates_audit_id_candidate_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_duplicate_candidates
    ADD CONSTRAINT product_duplicate_candidates_audit_id_candidate_product_id_key UNIQUE (audit_id, candidate_product_id);


--
-- Name: product_duplicate_candidates product_duplicate_candidates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_duplicate_candidates
    ADD CONSTRAINT product_duplicate_candidates_pkey PRIMARY KEY (id);


--
-- Name: product_duplicate_reviews product_duplicate_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_duplicate_reviews
    ADD CONSTRAINT product_duplicate_reviews_pkey PRIMARY KEY (id);


--
-- Name: product_media product_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_media
    ADD CONSTRAINT product_media_pkey PRIMARY KEY (id);


--
-- Name: product_search_metadata product_search_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_search_metadata
    ADD CONSTRAINT product_search_metadata_pkey PRIMARY KEY (product_id);


--
-- Name: product_search_metadata product_search_metadata_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_search_metadata
    ADD CONSTRAINT product_search_metadata_slug_key UNIQUE (slug);


--
-- Name: products products_id_product_kind_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_id_product_kind_key UNIQUE (id, product_kind);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_sku_key UNIQUE (sku);


--
-- Name: schema_versions schema_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_versions
    ADD CONSTRAINT schema_versions_pkey PRIMARY KEY (version);


--
-- Name: wishlist_items wishlist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_pkey PRIMARY KEY (id);


--
-- Name: wishlist_items wishlist_items_wishlist_id_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_wishlist_id_sku_key UNIQUE (wishlist_id, sku);


--
-- Name: wishlist_offer_items wishlist_offer_items_offer_id_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_offer_items
    ADD CONSTRAINT wishlist_offer_items_offer_id_sku_key UNIQUE (offer_id, sku);


--
-- Name: wishlist_offer_items wishlist_offer_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_offer_items
    ADD CONSTRAINT wishlist_offer_items_pkey PRIMARY KEY (id);


--
-- Name: wishlist_offers wishlist_offers_offer_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_offers
    ADD CONSTRAINT wishlist_offers_offer_token_key UNIQUE (offer_token);


--
-- Name: wishlist_offers wishlist_offers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_offers
    ADD CONSTRAINT wishlist_offers_pkey PRIMARY KEY (id);


--
-- Name: wishlist_offers wishlist_offers_wishlist_id_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_offers
    ADD CONSTRAINT wishlist_offers_wishlist_id_version_key UNIQUE (wishlist_id, version);


--
-- Name: wishlists wishlists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlists
    ADD CONSTRAINT wishlists_pkey PRIMARY KEY (id);


--
-- Name: wishlists wishlists_session_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlists
    ADD CONSTRAINT wishlists_session_hash_key UNIQUE (session_hash);


--
-- Name: wishlists wishlists_share_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlists
    ADD CONSTRAINT wishlists_share_token_key UNIQUE (share_token);


--
-- Name: categories_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX categories_parent ON public.categories USING btree (parent_id);


--
-- Name: dealer_products_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dealer_products_product ON public.dealer_products USING btree (product_id);


--
-- Name: homepage_collection_products_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX homepage_collection_products_product_idx ON public.homepage_collection_products USING btree (product_id);


--
-- Name: idx_wishlist_items_sku_wishlist; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wishlist_items_sku_wishlist ON public.wishlist_items USING btree (sku, wishlist_id);


--
-- Name: idx_wishlist_items_wishlist; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wishlist_items_wishlist ON public.wishlist_items USING btree (wishlist_id, created_at);


--
-- Name: idx_wishlist_offer_items_offer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wishlist_offer_items_offer ON public.wishlist_offer_items USING btree (offer_id);


--
-- Name: idx_wishlist_offers_wishlist_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wishlist_offers_wishlist_created ON public.wishlist_offers USING btree (wishlist_id, created_at DESC);


--
-- Name: idx_wishlists_status_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wishlists_status_updated ON public.wishlists USING btree (status, updated_at DESC);


--
-- Name: idx_wishlists_submitted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wishlists_submitted ON public.wishlists USING btree (submitted_at DESC) WHERE (submitted_at IS NOT NULL);


--
-- Name: jobs_queue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX jobs_queue ON public.background_jobs USING btree (run_after) WHERE (state = 'queued'::text);


--
-- Name: lights_by_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lights_by_type ON public.light_specs USING btree (light_type_id);


--
-- Name: media_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX media_product ON public.product_media USING btree (product_id, sort_order);


--
-- Name: primary_category_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX primary_category_unique ON public.product_categories USING btree (product_id) WHERE is_primary;


--
-- Name: primary_image_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX primary_image_unique ON public.product_media USING btree (product_id) WHERE is_primary;


--
-- Name: product_category_reverse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_category_reverse ON public.product_categories USING btree (category_id, product_id);


--
-- Name: users_email_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_unique ON public.app_users USING btree (lower(email));


--
-- Name: wishlist_items_enquiry_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wishlist_items_enquiry_product_idx ON public.wishlist_items USING btree (product_id, wishlist_id) WHERE (product_id IS NOT NULL);


--
-- Name: wishlist_items_wishlist_product_uuid_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX wishlist_items_wishlist_product_uuid_uq ON public.wishlist_items USING btree (wishlist_id, product_id) WHERE (product_id IS NOT NULL);


--
-- Name: wishlists_submitted_enquiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wishlists_submitted_enquiry_idx ON public.wishlists USING btree (id) WHERE (submitted_at IS NOT NULL);


--
-- Name: product_categories category_assignment_changed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER category_assignment_changed AFTER INSERT OR DELETE OR UPDATE ON public.product_categories FOR EACH ROW EXECUTE FUNCTION public.invalidate_product_relation();


--
-- Name: categories category_cycle; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER category_cycle BEFORE INSERT OR UPDATE OF parent_id ON public.categories FOR EACH ROW EXECUTE FUNCTION public.guard_category_cycle();


--
-- Name: fixture_light_overrides compatibility_overrides_changed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER compatibility_overrides_changed AFTER INSERT OR DELETE OR UPDATE ON public.fixture_light_overrides FOR EACH ROW EXECUTE FUNCTION public.invalidate_fixture_configuration();


--
-- Name: fixture_light_rules compatibility_rules_changed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER compatibility_rules_changed AFTER INSERT OR DELETE OR UPDATE ON public.fixture_light_rules FOR EACH ROW EXECUTE FUNCTION public.invalidate_fixture_configuration();


--
-- Name: fixture_specs fixture_changed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER fixture_changed AFTER INSERT OR DELETE OR UPDATE ON public.fixture_specs FOR EACH ROW EXECUTE FUNCTION public.invalidate_product_relation();


--
-- Name: products identity_changed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER identity_changed BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.product_identity_changed();


--
-- Name: light_specs light_changed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER light_changed AFTER INSERT OR DELETE OR UPDATE ON public.light_specs FOR EACH ROW EXECUTE FUNCTION public.invalidate_product_relation();


--
-- Name: product_media media_changed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER media_changed AFTER INSERT OR DELETE OR UPDATE ON public.product_media FOR EACH ROW EXECUTE FUNCTION public.invalidate_media_metadata();


--
-- Name: products publish_gate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER publish_gate BEFORE INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.check_publish();


--
-- Name: product_search_metadata search_metadata_changed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER search_metadata_changed AFTER INSERT OR DELETE OR UPDATE ON public.product_search_metadata FOR EACH ROW EXECUTE FUNCTION public.invalidate_product_relation();


--
-- Name: product_search_metadata search_metadata_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER search_metadata_updated_at BEFORE UPDATE ON public.product_search_metadata FOR EACH ROW EXECUTE FUNCTION public.touch_search_metadata();


--
-- Name: fixture_socket_groups socket_groups_changed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER socket_groups_changed AFTER INSERT OR DELETE OR UPDATE ON public.fixture_socket_groups FOR EACH ROW EXECUTE FUNCTION public.invalidate_fixture_configuration();


--
-- Name: admin_audit_log admin_audit_log_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.app_users(id);


--
-- Name: categories categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categories(id);


--
-- Name: dealer_prices dealer_prices_dealer_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dealer_prices
    ADD CONSTRAINT dealer_prices_dealer_product_id_fkey FOREIGN KEY (dealer_product_id) REFERENCES public.dealer_products(id);


--
-- Name: dealer_products dealer_products_dealer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dealer_products
    ADD CONSTRAINT dealer_products_dealer_id_fkey FOREIGN KEY (dealer_id) REFERENCES public.dealers(id);


--
-- Name: dealer_products dealer_products_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dealer_products
    ADD CONSTRAINT dealer_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: fixture_light_overrides fixture_light_overrides_light_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixture_light_overrides
    ADD CONSTRAINT fixture_light_overrides_light_product_id_fkey FOREIGN KEY (light_product_id) REFERENCES public.light_specs(product_id);


--
-- Name: fixture_light_overrides fixture_light_overrides_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixture_light_overrides
    ADD CONSTRAINT fixture_light_overrides_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.app_users(id);


--
-- Name: fixture_light_overrides fixture_light_overrides_socket_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixture_light_overrides
    ADD CONSTRAINT fixture_light_overrides_socket_group_id_fkey FOREIGN KEY (socket_group_id) REFERENCES public.fixture_socket_groups(id) ON DELETE CASCADE;


--
-- Name: fixture_light_rules fixture_light_rules_light_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixture_light_rules
    ADD CONSTRAINT fixture_light_rules_light_type_id_fkey FOREIGN KEY (light_type_id) REFERENCES public.light_types(id);


--
-- Name: fixture_light_rules fixture_light_rules_socket_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixture_light_rules
    ADD CONSTRAINT fixture_light_rules_socket_group_id_fkey FOREIGN KEY (socket_group_id) REFERENCES public.fixture_socket_groups(id) ON DELETE CASCADE;


--
-- Name: fixture_socket_groups fixture_socket_groups_fixture_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixture_socket_groups
    ADD CONSTRAINT fixture_socket_groups_fixture_product_id_fkey FOREIGN KEY (fixture_product_id) REFERENCES public.fixture_specs(product_id) ON DELETE CASCADE;


--
-- Name: fixture_specs fixture_specs_fixture_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixture_specs
    ADD CONSTRAINT fixture_specs_fixture_type_id_fkey FOREIGN KEY (fixture_type_id) REFERENCES public.fixture_types(id);


--
-- Name: fixture_specs fixture_specs_product_id_product_kind_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixture_specs
    ADD CONSTRAINT fixture_specs_product_id_product_kind_fkey FOREIGN KEY (product_id, product_kind) REFERENCES public.products(id, product_kind) ON DELETE CASCADE;


--
-- Name: homepage_collection_audit homepage_collection_audit_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homepage_collection_audit
    ADD CONSTRAINT homepage_collection_audit_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.homepage_collections(id);


--
-- Name: homepage_collection_products homepage_collection_products_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homepage_collection_products
    ADD CONSTRAINT homepage_collection_products_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.homepage_collections(id) ON DELETE CASCADE;


--
-- Name: homepage_collection_products homepage_collection_products_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homepage_collection_products
    ADD CONSTRAINT homepage_collection_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: homepage_collections homepage_collections_cover_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homepage_collections
    ADD CONSTRAINT homepage_collections_cover_product_id_fkey FOREIGN KEY (cover_product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: import_jobs import_jobs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_jobs
    ADD CONSTRAINT import_jobs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.app_users(id);


--
-- Name: import_row_results import_row_results_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_row_results
    ADD CONSTRAINT import_row_results_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.import_jobs(id) ON DELETE CASCADE;


--
-- Name: light_specs light_specs_light_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.light_specs
    ADD CONSTRAINT light_specs_light_type_id_fkey FOREIGN KEY (light_type_id) REFERENCES public.light_types(id);


--
-- Name: light_specs light_specs_product_id_product_kind_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.light_specs
    ADD CONSTRAINT light_specs_product_id_product_kind_fkey FOREIGN KEY (product_id, product_kind) REFERENCES public.products(id, product_kind) ON DELETE CASCADE;


--
-- Name: media_embeddings media_embeddings_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_embeddings
    ADD CONSTRAINT media_embeddings_media_id_fkey FOREIGN KEY (media_id) REFERENCES public.product_media(id) ON DELETE CASCADE;


--
-- Name: product_categories product_categories_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_categories
    ADD CONSTRAINT product_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: product_categories product_categories_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_categories
    ADD CONSTRAINT product_categories_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_compatibility_assessments_v1 product_compatibility_assessments_v1_fixture_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_compatibility_assessments_v1
    ADD CONSTRAINT product_compatibility_assessments_v1_fixture_id_fkey FOREIGN KEY (fixture_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_compatibility_audit_v1 product_compatibility_audit_v1_fixture_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_compatibility_audit_v1
    ADD CONSTRAINT product_compatibility_audit_v1_fixture_id_fkey FOREIGN KEY (fixture_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_duplicate_audits product_duplicate_audits_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_duplicate_audits
    ADD CONSTRAINT product_duplicate_audits_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.app_users(id);


--
-- Name: product_duplicate_audits product_duplicate_audits_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_duplicate_audits
    ADD CONSTRAINT product_duplicate_audits_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: product_duplicate_candidates product_duplicate_candidates_audit_id_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_duplicate_candidates
    ADD CONSTRAINT product_duplicate_candidates_audit_id_product_id_fkey FOREIGN KEY (audit_id, product_id) REFERENCES public.product_duplicate_audits(id, product_id);


--
-- Name: product_duplicate_candidates product_duplicate_candidates_candidate_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_duplicate_candidates
    ADD CONSTRAINT product_duplicate_candidates_candidate_product_id_fkey FOREIGN KEY (candidate_product_id) REFERENCES public.products(id);


--
-- Name: product_duplicate_reviews product_duplicate_reviews_audit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_duplicate_reviews
    ADD CONSTRAINT product_duplicate_reviews_audit_id_fkey FOREIGN KEY (audit_id) REFERENCES public.product_duplicate_audits(id);


--
-- Name: product_duplicate_reviews product_duplicate_reviews_duplicate_of_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_duplicate_reviews
    ADD CONSTRAINT product_duplicate_reviews_duplicate_of_product_id_fkey FOREIGN KEY (duplicate_of_product_id) REFERENCES public.products(id);


--
-- Name: product_duplicate_reviews product_duplicate_reviews_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_duplicate_reviews
    ADD CONSTRAINT product_duplicate_reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.app_users(id);


--
-- Name: product_media product_media_poster_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_media
    ADD CONSTRAINT product_media_poster_media_id_fkey FOREIGN KEY (poster_media_id) REFERENCES public.product_media(id);


--
-- Name: product_media product_media_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_media
    ADD CONSTRAINT product_media_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_search_metadata product_search_metadata_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_search_metadata
    ADD CONSTRAINT product_search_metadata_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: products products_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.app_users(id);


--
-- Name: products products_duplicate_of_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_duplicate_of_product_id_fkey FOREIGN KEY (duplicate_of_product_id) REFERENCES public.products(id);


--
-- Name: wishlist_items wishlist_items_wishlist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_wishlist_id_fkey FOREIGN KEY (wishlist_id) REFERENCES public.wishlists(id) ON DELETE CASCADE;


--
-- Name: wishlist_offer_items wishlist_offer_items_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_offer_items
    ADD CONSTRAINT wishlist_offer_items_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.wishlist_offers(id) ON DELETE CASCADE;


--
-- Name: wishlist_offers wishlist_offers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_offers
    ADD CONSTRAINT wishlist_offers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.app_users(id) ON DELETE SET NULL;


--
-- Name: wishlist_offers wishlist_offers_wishlist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_offers
    ADD CONSTRAINT wishlist_offers_wishlist_id_fkey FOREIGN KEY (wishlist_id) REFERENCES public.wishlists(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 9CKAcoMJgrqZrRinoqVdW2i8nE15AC6c70sPy3CyiJ7iO4vnZA785KN6IhYZTqN


-- Technical version seed, not business data.
--
-- PostgreSQL database dump
--

\restrict AqWGbs2lqMOJ8WF67ZV4pnaWPfVnjg9Y5QIueVhveTWeziuEdjZolB7EoCtgqPJ

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: homepage_feature_versions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.homepage_feature_versions (version, installed_at) VALUES (1, '2026-10-16 12:00:40.243193+05:30');


--
-- Data for Name: schema_versions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.schema_versions (version, applied_at) VALUES (1, '2026-10-12 16:34:31.465329+05:30');
INSERT INTO public.schema_versions (version, applied_at) VALUES (2, '2026-10-12 20:07:42.772231+05:30');
INSERT INTO public.schema_versions (version, applied_at) VALUES (3, '2026-10-13 12:25:36.370867+05:30');


--
-- PostgreSQL database dump complete
--

\unrestrict AqWGbs2lqMOJ8WF67ZV4pnaWPfVnjg9Y5QIueVhveTWeziuEdjZolB7EoCtgqPJ


SET search_path = public, extensions, pg_catalog;
SET LOCAL statement_timeout='15s';
DO $$ BEGIN
 IF COALESCE((SELECT max(version) FROM public.schema_versions),0)<3 THEN
  RAISE EXCEPTION 'Catalogue schema version is below the current application requirement';
 END IF;
 IF position('current_duplicate_approval' IN pg_get_viewdef('public.public_products'::regclass,true))=0 THEN
  RAISE EXCEPTION 'Current duplicate-approval publication view is missing';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.homepage_feature_versions WHERE version=1) THEN
  RAISE EXCEPTION 'Homepage feature version is missing';
 END IF;
END $$;

SELECT id,email,password_hash,role,is_active FROM app_users LIMIT 0;
SELECT id,session_hash,share_token,status,customer_name,mobile_number,email,pin_code,requirements,submitted_at FROM wishlists LIMIT 0;
SELECT wishlist_id,product_id,sku,name,price,currency,media,product_href,catalogue_revision,add_count FROM wishlist_items LIMIT 0;
SELECT id,wishlist_id,offer_token,version,status,terms,expires_at,created_by FROM wishlist_offers LIMIT 0;
SELECT offer_id,product_id,sku,name,quantity,list_price,offer_price,currency,media,product_href,catalogue_revision FROM wishlist_offer_items LIMIT 0;
SELECT id,sku,product_kind,revision,approved_revision,approved_by,review_status,published FROM products LIMIT 0;
SELECT id,sku,product_kind,revision FROM public_products LIMIT 0;
SELECT product_id,category_id,is_primary FROM product_categories LIMIT 0;
SELECT id,parent_id,slug,is_active FROM categories LIMIT 0;
SELECT product_id,is_primary,media_type,processing_status,storage_key FROM product_media LIMIT 0;
SELECT product_id,fixture_type_id FROM fixture_specs LIMIT 0;
SELECT product_id,light_type_id FROM light_specs LIMIT 0;
SELECT id,is_active FROM fixture_types LIMIT 0;
SELECT id,is_active FROM light_types LIMIT 0;
SELECT product_id,product_revision,status,corpus_digest FROM product_duplicate_audits LIMIT 0;
SELECT audit_id,decision,reviewer_id FROM product_duplicate_reviews LIMIT 0;
SELECT product_id,slug,seo_title,meta_description FROM public.product_search_metadata LIMIT 0;
SELECT corpus_digest,scanned_count FROM public.product_duplicate_audits LIMIT 0;
SELECT version FROM public.homepage_feature_versions WHERE version=1;
SELECT id,title,slug,cover_product_id,revision FROM public.homepage_collections LIMIT 0;
SELECT collection_id,product_id,sort_order FROM public.homepage_collection_products LIMIT 0;
SELECT collection_id,actor_id,action,before_state,after_state FROM public.homepage_collection_audit LIMIT 0;
SELECT fixture_id,fingerprint,result,assessed_by FROM public.product_compatibility_assessments_v1 LIMIT 0;
SELECT fixture_id,actor_id,fingerprint,result FROM public.product_compatibility_audit_v1 LIMIT 0;
SELECT public.current_duplicate_approval(p.id,p.revision,p.approved_by,p.product_kind) FROM public.products p LIMIT 0;

-- This application uses server-side PostgreSQL connections, not browser Data API access.
-- The target public schema was required to be empty before this baseline.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM %I',role_name);
   EXECUTE format('REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM %I',role_name);
   EXECUTE format('REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM %I',role_name);
   EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I',role_name);
   EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I',role_name);
   EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I',role_name);
  END IF;
 END LOOP;
END $$;

DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.products) OR EXISTS(SELECT 1 FROM public.categories) OR EXISTS(SELECT 1 FROM public.app_users) OR EXISTS(SELECT 1 FROM public.wishlists) OR EXISTS(SELECT 1 FROM public.wishlist_items) OR EXISTS(SELECT 1 FROM public.wishlist_offers) OR EXISTS(SELECT 1 FROM public.wishlist_offer_items) OR EXISTS(SELECT 1 FROM public.homepage_collections) THEN
  RAISE EXCEPTION 'Unexpected business seed rows; transaction will not commit';
 END IF;
END $$;
COMMIT;
