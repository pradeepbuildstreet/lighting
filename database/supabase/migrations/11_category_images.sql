CREATE TABLE public.category_images (
 category_id uuid PRIMARY KEY REFERENCES public.categories(id) ON DELETE CASCADE,
 content_type text NOT NULL CHECK (content_type IN ('image/jpeg','image/png')),
 image_data bytea NOT NULL CHECK (octet_length(image_data) BETWEEN 1 AND 5242880),
 revision uuid NOT NULL DEFAULT gen_random_uuid(),
 updated_by uuid REFERENCES public.app_users(id),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.category_images ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.category_images FROM PUBLIC,anon,authenticated;
COMMENT ON TABLE public.category_images IS 'Admin-managed category/subcategory tile images. Public delivery is through the catalogue API and respects public category eligibility. Maximum image size is 5 MiB.';
