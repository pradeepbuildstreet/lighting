CREATE TABLE public.catalogue_category_naming_rules(
 category_id uuid PRIMARY KEY REFERENCES public.categories(id),
 enabled boolean NOT NULL DEFAULT true,
 rule jsonb NOT NULL CHECK(jsonb_typeof(rule)='object'),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 updated_by uuid REFERENCES public.app_users(id),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.catalogue_category_naming_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.catalogue_category_naming_rules FROM PUBLIC,anon,authenticated;
COMMENT ON TABLE public.catalogue_category_naming_rules IS 'Primary-category-only naming overrides. Global fallback is the null-product-kind row in catalogue_naming_rules. Legacy kind overrides are retained but not used by category naming.';
