-- Apply explicitly to the catalogue database; never execute during application startup.
-- SEO integration intentionally deferred. Existing products and quotations are unchanged.
BEGIN;
CREATE TABLE public.interior_projects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name varchar(200) NOT NULL CHECK (length(btrim(name)) > 0),
 slug varchar(200) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 developer_name varchar(200) NOT NULL DEFAULT '',
 locality varchar(200) NOT NULL DEFAULT '',
 city varchar(120) NOT NULL DEFAULT '',
 description text NOT NULL DEFAULT '' CHECK (length(description) <= 20000),
 relationship text NOT NULL DEFAULT 'independent' CHECK (relationship IN ('independent','authorized')),
 published boolean NOT NULL DEFAULT false,
 sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
 revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.interior_layouts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL REFERENCES public.interior_projects(id) ON DELETE RESTRICT,
 name varchar(200) NOT NULL CHECK (length(btrim(name)) > 0),
 slug varchar(200) NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 property_type text NOT NULL CHECK (property_type IN ('2bhk','3bhk','villa')),
 area_sqft numeric(12,2) CHECK (area_sqft > 0 AND area_sqft <> 'NaN'::numeric),
 notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 10000),
 floor_plan_public boolean NOT NULL DEFAULT false,
 published boolean NOT NULL DEFAULT false,
 sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
 revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(project_id,slug)
);
CREATE TABLE public.interior_designs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 layout_id uuid NOT NULL REFERENCES public.interior_layouts(id) ON DELETE RESTRICT,
 name varchar(200) NOT NULL CHECK (length(btrim(name)) > 0),
 slug varchar(200) NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 description text NOT NULL DEFAULT '' CHECK (length(description) <= 20000),
 published boolean NOT NULL DEFAULT false,
 sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
 revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(layout_id,slug)
);
-- One product row per design. Quantity is the total across rooms, not per render.
CREATE TABLE public.interior_design_products (
 design_id uuid NOT NULL REFERENCES public.interior_designs(id) ON DELETE RESTRICT,
 product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
 quantity integer NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 10000),
 room_labels text[] NOT NULL DEFAULT '{}' CHECK (cardinality(room_labels) <= 50),
 selected_by_default boolean NOT NULL DEFAULT true,
 sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
 PRIMARY KEY(design_id,product_id)
);
-- Binary uploads follow the existing category-image pattern; no untrusted external URLs.
CREATE TABLE public.interior_images (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 layout_id uuid REFERENCES public.interior_layouts(id) ON DELETE RESTRICT,
 design_id uuid REFERENCES public.interior_designs(id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK (kind IN ('floor_plan','render')),
 content_type text NOT NULL CHECK (content_type IN ('image/jpeg','image/png','image/webp')),
 image_data bytea NOT NULL CHECK (octet_length(image_data) BETWEEN 1 AND 10485760),
 caption varchar(1000) NOT NULL DEFAULT '',
 room_label varchar(120) NOT NULL DEFAULT '',
 is_cover boolean NOT NULL DEFAULT false,
 sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
 revision uuid NOT NULL DEFAULT gen_random_uuid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((kind='floor_plan' AND layout_id IS NOT NULL AND design_id IS NULL AND NOT is_cover)
     OR (kind='render' AND design_id IS NOT NULL AND layout_id IS NULL)),
 UNIQUE(id,design_id)
);
CREATE UNIQUE INDEX interior_design_one_cover ON public.interior_images(design_id) WHERE is_cover;
CREATE UNIQUE INDEX interior_layout_one_floor_plan ON public.interior_images(layout_id) WHERE kind='floor_plan';
CREATE TABLE public.interior_image_products (
 image_id uuid NOT NULL,
 design_id uuid NOT NULL,
 product_id uuid NOT NULL,
 PRIMARY KEY(image_id,product_id),
 FOREIGN KEY(image_id,design_id) REFERENCES public.interior_images(id,design_id) ON DELETE CASCADE,
 FOREIGN KEY(design_id,product_id) REFERENCES public.interior_design_products(design_id,product_id) ON DELETE CASCADE
);
CREATE TABLE public.interior_admin_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
 action varchar(100) NOT NULL,
 entity_type varchar(100) NOT NULL,
 entity_id uuid NOT NULL,
 before_state jsonb,
 after_state jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX interior_layouts_project_idx ON public.interior_layouts(project_id);
CREATE INDEX interior_designs_layout_idx ON public.interior_designs(layout_id);
CREATE INDEX interior_images_design_idx ON public.interior_images(design_id);
CREATE INDEX interior_design_products_product_idx ON public.interior_design_products(product_id);
CREATE INDEX interior_image_products_design_product_idx ON public.interior_image_products(design_id,product_id);
CREATE INDEX interior_admin_audit_entity_idx ON public.interior_admin_audit(entity_type,entity_id,created_at);
-- Backend-only access. No direct browser or Supabase client access to drafts/images/audit.
ALTER TABLE public.interior_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_design_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_image_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_admin_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.interior_projects, public.interior_layouts, public.interior_designs,
 public.interior_design_products, public.interior_images, public.interior_image_products,
 public.interior_admin_audit FROM anon, authenticated;
COMMIT;
