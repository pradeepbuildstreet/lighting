-- Run only in an isolated test database with migrations 01-07 installed.
-- ROLLBACK removes test rows, but sequence allocations are NOT rolled back.
BEGIN;
DO $test$
DECLARE first_product public.products; second_product public.products; assigned public.products; replay public.products;
BEGIN
 INSERT INTO public.products(sku,name,product_kind,is_active,published)
 VALUES(NULL,NULL,'fixture',false,false) RETURNING * INTO first_product;
 INSERT INTO public.products(sku,name,product_kind,is_active,published)
 VALUES(NULL,NULL,'fixture',false,false) RETURNING * INTO second_product;
 IF first_product.id=second_product.id THEN RAISE EXCEPTION 'Draft UUIDs must differ'; END IF;
 SELECT * INTO assigned FROM public.assign_catalogue_product_sku(first_product.id,first_product.revision);
 IF assigned.sku !~ '^F[1-9][0-9]{5}$' OR substring(assigned.sku FROM 2)::bigint<100001 THEN
  RAISE EXCEPTION 'Unexpected assigned SKU: %',assigned.sku;
 END IF;
 IF assigned.id<>first_product.id OR assigned.published THEN RAISE EXCEPTION 'Assignment must preserve UUID and remain unpublished'; END IF;
 SELECT * INTO replay FROM public.assign_catalogue_product_sku(first_product.id,first_product.revision);
 IF replay.sku<>assigned.sku OR replay.revision<>assigned.revision THEN RAISE EXCEPTION 'Assignment retry must not allocate or update again'; END IF;
 BEGIN
  UPDATE public.products SET sku='CHANGED' WHERE id=first_product.id;
  RAISE EXCEPTION 'Expected assigned-SKU replacement rejection';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  UPDATE public.products SET sku=NULL WHERE id=first_product.id;
  RAISE EXCEPTION 'Expected assigned-SKU clearing rejection';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  PERFORM public.assign_catalogue_product_sku(second_product.id,second_product.revision+1);
  RAISE EXCEPTION 'Expected stale revision rejection';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 UPDATE public.products SET name='Edited display name' WHERE id=first_product.id;
 IF (SELECT sku FROM public.products WHERE id=first_product.id)<>assigned.sku THEN RAISE EXCEPTION 'Name edit changed SKU'; END IF;
 BEGIN
  UPDATE public.product_kinds SET sku_prefix='CHANGED' WHERE code='fixture';
  RAISE EXCEPTION 'Expected fixed initials rejection';
 EXCEPTION WHEN check_violation THEN NULL; END;
END;
$test$;
ROLLBACK;
