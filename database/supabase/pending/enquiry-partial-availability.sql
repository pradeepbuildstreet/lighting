-- Pending: apply only with the availability API and quote UI/PDF integration deployed.
-- Original requested quantities and existing quote item quantities are not changed.
BEGIN;
ALTER TABLE public.wishlist_items ADD COLUMN IF NOT EXISTS available_quantity integer;
ALTER TABLE public.wishlist_items ADD COLUMN IF NOT EXISTS availability_note text NOT NULL DEFAULT '';
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.wishlist_items'::regclass AND conname='wishlist_items_available_quantity_check') THEN
  ALTER TABLE public.wishlist_items ADD CONSTRAINT wishlist_items_available_quantity_check CHECK(available_quantity IS NULL OR (available_quantity>=0 AND available_quantity<=add_count));
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.wishlist_items'::regclass AND conname='wishlist_items_availability_note_length') THEN
  ALTER TABLE public.wishlist_items ADD CONSTRAINT wishlist_items_availability_note_length CHECK(char_length(availability_note)<=1000);
 END IF;
END;$$;
ALTER TABLE public.wishlist_offers ADD COLUMN IF NOT EXISTS availability_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb;
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.wishlist_offers'::regclass AND conname='wishlist_offers_availability_snapshot_array') THEN
  ALTER TABLE public.wishlist_offers ADD CONSTRAINT wishlist_offers_availability_snapshot_array CHECK(jsonb_typeof(availability_snapshot)='array');
 END IF;
END;$$;
COMMIT;
