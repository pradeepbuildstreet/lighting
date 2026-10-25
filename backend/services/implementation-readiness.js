"use strict";
const APP_QUERIES = [
 'SELECT id,email,password_hash,role,is_active FROM app_users LIMIT 0',
 'SELECT id,session_hash,share_token,status,customer_name,mobile_number,email,pin_code,requirements,submitted_at FROM wishlists LIMIT 0',
 'SELECT wishlist_id,product_id,sku,name,price,currency,media,product_href,catalogue_revision,add_count FROM wishlist_items LIMIT 0',
 'SELECT id,wishlist_id,offer_token,version,status,terms,expires_at,created_by FROM wishlist_offers LIMIT 0',
 'SELECT offer_id,product_id,sku,name,quantity,list_price,offer_price,currency,media,product_href,catalogue_revision FROM wishlist_offer_items LIMIT 0'
];
const CATALOGUE_QUERIES = [
 'SELECT id,sku,product_kind,revision,approved_revision,approved_by,review_status,published FROM products LIMIT 0',
 'SELECT id,sku,product_kind,revision FROM public_products LIMIT 0',
 'SELECT product_id,category_id,is_primary FROM product_categories LIMIT 0',
 'SELECT id,parent_id,slug,is_active,allow_direct_products FROM categories LIMIT 0',
 'SELECT product_id,is_primary,media_type,processing_status,storage_key FROM product_media LIMIT 0',
 'SELECT product_id,product_kind_id,light_source_mode,length_mm,breadth_mm,height_mm,wattage,lumens FROM product_attributes LIMIT 0',
 'SELECT id,code,entry_profile,fixed_source_mode,is_active FROM product_kinds LIMIT 0',
 'SELECT id,tag_group_id,code,is_active FROM tags LIMIT 0',
 'SELECT id,code,is_active FROM tag_groups LIMIT 0',
 'SELECT product_id,tag_id FROM product_tags LIMIT 0',
 'SELECT category_id,tag_group_id,sort_order FROM category_tag_groups LIMIT 0',
 'SELECT tag_group_id,sort_order FROM catalogue_filter_tag_groups LIMIT 0',
 'SELECT version FROM catalogue_taxonomy_versions LIMIT 0',
 'SELECT product_id,product_revision,status,corpus_digest FROM product_duplicate_audits LIMIT 0',
 'SELECT audit_id,decision,reviewer_id FROM product_duplicate_reviews LIMIT 0'
];
async function checkImplementationReadiness(application, catalogue) {
 try {
  for (const sql of APP_QUERIES) await application.query(sql);
 } catch (error) { error.connectionCheck='application'; throw error; }
 try {
  for (const sql of CATALOGUE_QUERIES) await catalogue.query(sql);
  const result=await catalogue.query("SELECT (SELECT max(version) FROM schema_versions) AS version, pg_get_viewdef('public.public_products'::regclass,true) AS definition, to_regprocedure('public.catalogue_product_model_ready(uuid,text)') IS NOT NULL AS tag_prerequisite, EXISTS(SELECT 1 FROM catalogue_taxonomy_versions WHERE version=3) AS tag_activated");
  const state=result.rows[0];
  if(!state || Number(state.version)<3 || !state.definition?.includes('current_duplicate_approval')) {
   const error=new Error('Current catalogue publication schema is required');error.code='CATALOGUE_SCHEMA_NOT_READY';throw error;
  }
  if(state.tag_prerequisite!==true||state.tag_activated!==true){const error=new Error('Activated tag-model publication schema is required');error.code='TAG_MODEL_SCHEMA_NOT_READY';throw error;}
  await catalogue.query('SELECT public.current_duplicate_approval(p.id,p.revision,p.approved_by,p.product_kind) FROM public.products p LIMIT 0');
  await catalogue.query('SELECT public.catalogue_product_model_ready(p.id,p.product_kind) FROM public.products p LIMIT 0');
 } catch (error) { error.connectionCheck='catalogue'; throw error; }
 return {ready:true};
}
module.exports={APP_QUERIES,CATALOGUE_QUERIES,checkImplementationReadiness};
