BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Existing selling_price and enquiry price remain the original, pre-discount unit prices.
ALTER TABLE public.products
  ADD COLUMN default_discount_percent numeric(5,2) NOT NULL DEFAULT 0
  CHECK (default_discount_percent BETWEEN 0 AND 100);

-- Historical enquiries retain their original prices with a zero default discount.
ALTER TABLE public.wishlist_items
  ADD COLUMN default_discount_percent numeric(5,2) NOT NULL DEFAULT 0
  CHECK (default_discount_percent BETWEEN 0 AND 100),
  ADD COLUMN discounted_price numeric(12,2) GENERATED ALWAYS AS
    (round(price * (1 - default_discount_percent / 100), 2)) STORED;

-- Each quote version preserves the captured minimum discount independently.
ALTER TABLE public.wishlist_offer_items
  ADD COLUMN default_discount_percent numeric(5,2) NOT NULL DEFAULT 0
  CHECK (default_discount_percent BETWEEN 0 AND 100),
  ADD CONSTRAINT wishlist_offer_items_default_discount_ceiling
  CHECK (offer_price <= round(list_price * (1 - default_discount_percent / 100), 2));

COMMENT ON COLUMN public.products.default_discount_percent IS
  'Customer-facing catalogue discount percentage; selling_price is the original price. Independent of dealer purchase discounts.';
COMMENT ON COLUMN public.wishlist_items.default_discount_percent IS
  'Server-captured product default discount. Preserve after enquiry submission; do not recalculate from the current catalogue.';
COMMENT ON COLUMN public.wishlist_items.discounted_price IS
  'Discounted unit price and quote ceiling, calculated from the enquiry original price and captured default discount.';
COMMENT ON COLUMN public.wishlist_offer_items.default_discount_percent IS
  'Minimum discount captured for this quote version. The application must copy it from the authoritative enquiry snapshot.';

COMMIT;
