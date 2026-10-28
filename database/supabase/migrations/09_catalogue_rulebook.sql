ALTER TABLE public.tag_groups ADD COLUMN selection_mode text NOT NULL DEFAULT 'multi' CHECK(selection_mode IN ('single','multi'));
ALTER TABLE public.tag_groups ADD COLUMN selection_revision bigint NOT NULL DEFAULT 1 CHECK(selection_revision>0);
ALTER TABLE public.product_tags ADD COLUMN single_group_id uuid REFERENCES public.tag_groups(id);
CREATE UNIQUE INDEX product_tags_single_group ON public.product_tags(product_id,single_group_id);
CREATE FUNCTION public.catalogue_tag_selection_slot() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'pg_catalog','public' AS $f$
DECLARE group_id uuid; mode text;
BEGIN
 SELECT g.id,g.selection_mode INTO group_id,mode FROM public.tags t JOIN public.tag_groups g ON g.id=t.tag_group_id WHERE t.id=NEW.tag_id FOR SHARE OF t,g;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tag group not found' USING ERRCODE='23503'; END IF;
 NEW.single_group_id=CASE WHEN mode='single' THEN group_id ELSE NULL END;
 RETURN NEW;
END;$f$;
CREATE TRIGGER catalogue_tag_selection_slot BEFORE INSERT OR UPDATE OF tag_id,single_group_id ON public.product_tags FOR EACH ROW EXECUTE FUNCTION public.catalogue_tag_selection_slot();
CREATE FUNCTION public.catalogue_tag_group_fixed() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'pg_catalog','public' AS $f$
BEGIN
 IF NEW.tag_group_id IS DISTINCT FROM OLD.tag_group_id THEN RAISE EXCEPTION 'Tags cannot move between groups' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;$f$;
CREATE TRIGGER catalogue_tag_group_fixed BEFORE UPDATE OF tag_group_id ON public.tags FOR EACH ROW EXECUTE FUNCTION public.catalogue_tag_group_fixed();
CREATE FUNCTION public.catalogue_group_selection_changed() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'pg_catalog','public' AS $f$
BEGIN
 UPDATE public.product_tags pt SET single_group_id=CASE WHEN NEW.selection_mode='single' THEN NEW.id ELSE NULL END FROM public.tags t WHERE pt.tag_id=t.id AND t.tag_group_id=NEW.id;
 RETURN NEW;
END;$f$;
CREATE TRIGGER catalogue_group_selection_changed AFTER UPDATE OF selection_mode ON public.tag_groups FOR EACH ROW WHEN (OLD.selection_mode IS DISTINCT FROM NEW.selection_mode) EXECUTE FUNCTION public.catalogue_group_selection_changed();
CREATE TABLE public.catalogue_naming_rules(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 product_kind_id uuid REFERENCES public.product_kinds(id),
 rule jsonb NOT NULL CHECK(jsonb_typeof(rule)='object'),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 updated_by uuid REFERENCES public.app_users(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE NULLS NOT DISTINCT(product_kind_id)
);
INSERT INTO public.catalogue_naming_rules(product_kind_id,rule) VALUES(NULL,'{"groups":["style","finish","material"],"maxPerGroup":2,"separator":" & ","maxLength":255,"includeBrand":true}'::jsonb);
ALTER TABLE public.catalogue_naming_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.catalogue_naming_rules FROM PUBLIC,anon,authenticated;
