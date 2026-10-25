"use strict";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function fail(status,message){const e=new Error(message);e.status=status;throw e;}
function uuid(x){if(typeof x!=='string'||!UUID.test(x))fail(400,'Invalid product UUID');return x.toLowerCase();}
function options(input={}){
 const text=(key,max=200)=>{if(input[key]===undefined)return '';if(typeof input[key]!=='string')fail(400,'Invalid '+key);const s=input[key].trim();if(s.length>max)fail(400,key+' is too long');return s;};
 const integer=(key,def,max)=>{const s=text(key)||String(def);if(!/^\d+$/.test(s)||Number(s)<1||Number(s)>max)fail(400,'Invalid '+key);return Number(s);};
 const q=text('q'),category=text('category'),kind=text('kind'),brand=text('brand'),currency=text('currency',3),sort=text('sort')||'name';
 if(category&&!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(category))fail(400,'Invalid category');if(kind&&(kind.length>64||!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(kind)))fail(400,'Invalid kind');if(currency&&!/^[A-Z]{3}$/.test(currency))fail(400,'Invalid currency');
 const sorts={name:'p.name ASC,p.id ASC',newest:'p.created_at DESC,p.id ASC',price_asc:'p.selling_price ASC,p.id ASC',price_desc:'p.selling_price DESC,p.id ASC'};
 if(!sorts[sort])fail(400,'Invalid sort');
 const price=key=>{const s=text(key,15);if(!s)return null;if(!/^(0|[1-9]\d{0,11})(\.\d{1,2})?$/.test(s))fail(400,'Invalid '+key);return s;};
 const min=price('min_price'),max=price('max_price');if((min!==null||max!==null||sort.startsWith('price_'))&&!currency)fail(400,'Currency is required for price filters or sorting');if(min!==null&&max!==null&&Number(min)>Number(max))fail(400,'Minimum price exceeds maximum');
 return {q,category,kind,brand,currency,sort,order:sorts[sort],min,max,page:integer('page',1,10000),limit:integer('limit',20,100)};
}
function https(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch(_){return null;}}
function storageKey(value){return typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|mp4)$/i.test(value);}
function mediaDTO(m){const url=https(m.external_url)||(storageKey(m.storage_key)&&UUID.test(m.id)?'/api/catalogue/media/'+m.id:null);if(!url||!['image','video'].includes(m.media_type))return null;return {id:m.id,type:m.media_type,url,primary:!!m.is_primary,alt:m.alt_text||null,caption:m.caption||null,order:m.sort_order,poster_id:m.poster_media_id||null};}
function scalar(x){return typeof x==='string'||typeof x==='boolean'||typeof x==='number'&&Number.isFinite(x)?x:null;}
function specsDTO(kind,row){const keys=row?.tag_model===true?['light_source_mode','length_mm','breadth_mm','height_mm','wattage','lumens']:kind==='fixture'?['material','style','mounting_type','width_mm','depth_mm','height_mm','light_source_mode']:['wattage','lumens','color_temperature_k','voltage_min','voltage_max','diameter_mm','length_mm','dimmable'];const out={};for(const k of keys){const v=scalar(row?.[k]);if(v!==null)out[k]=v;}if(!row?.tag_model&&kind==='fixture'&&row?.inbuilt_specs){const v=specsDTO('light',row.inbuilt_specs);if(Object.keys(v).length)out.integrated=v;}return out;}
function productDTO(p,media=[],categories=[],spec=null){const publicMedia=media.map(mediaDTO).filter(Boolean);const imageIds=new Set(publicMedia.filter(m=>m.type==='image').map(m=>m.id));for(const m of publicMedia)if(!imageIds.has(m.poster_id))m.poster_id=null;return {...(spec?.tag_model===true?{tag_model:true,kind_name:spec.kind_name,entry_profile:spec.entry_profile,tags_loaded:Array.isArray(spec.tags),tags:spec.tags||[]}:{}),source:'catalogue',id:p.id,sku:p.sku,name:p.name,kind:p.product_kind,revision:String(p.revision),brand:p.brand||null,model:p.model_number||null,description:p.description||null,price:String(p.selling_price),currency:p.currency,media:publicMedia,categories:categories.map(c=>({id:c.id,slug:c.slug,name:c.name,path:c.slugs.join('/'),primary:!!c.is_primary})),specifications:specsDTO(p.product_kind,spec),seo:{slug:p.slug||null,title:p.seo_title||null,description:p.meta_description||null}};}
function categoryTree(rows){const map=new Map(rows.map(r=>[r.id,{id:r.id,parent_id:r.parent_id,slug:r.slug,name:r.name,path:r.slugs.join('/'),description:r.description||null,sort_order:r.sort_order,product_count:Number(r.product_count),children:[]}]));const roots=[];for(const r of rows){const n=map.get(r.id);if(r.parent_id){const parent=map.get(r.parent_id);if(parent)parent.children.push(n);}else roots.push(n);}return roots;}
function positive(x){if(x===null||x===undefined||typeof x==='boolean'||typeof x==='string'&&!x.trim())return null;const n=Number(x);return Number.isFinite(n)&&n>0?n:null;}
function compatibility(rules,light,override){
 const reasons=[],missing=[];const rule=rules.find(r=>r.light_type_id===light.light_type_id);
 if(!light.light_type_id)missing.push('light_type_unknown');else if(!rule)reasons.push('light_type_not_accepted');
 if(rule){for(const [max,key] of [['max_wattage','wattage'],['max_diameter_mm','diameter_mm'],['max_length_mm','length_mm']]){if(rule[max]!=null){const value=positive(light[key]);if(value===null)missing.push(key+'_unknown');else if(value>Number(rule[max]))reasons.push(key+'_exceeds_limit');}}
 if(rule.supply_voltage_min!=null){const lo=positive(light.voltage_min),hi=positive(light.voltage_max);if(lo===null||hi===null)missing.push('voltage_range_unknown');else if(lo>Number(rule.supply_voltage_min)||hi<Number(rule.supply_voltage_max))reasons.push('voltage_range_not_covering_supply');}
 if(rule.requires_dimmable){if(typeof light.dimmable!=='boolean')missing.push('dimming_unknown');else if(!light.dimmable)reasons.push('dimmable_required');}}
 const technical=reasons.length?'incompatible':missing.length?'unverified':'compatible';return {status:override?(override.decision==='approve'?'exception_approved':'exception_rejected'):technical,technical_status:technical,reasons,missing,scope:'configured_rules_only',exception:override?{decision:override.decision,revision_bound:false,warning:'Manual exception requires reconfirmation when technical data changes.'}:null};
}
const TREE=`WITH RECURSIVE active_tree AS (
 SELECT id,parent_id,slug,name,description,sort_order,ARRAY[id] AS ids,ARRAY[slug] AS slugs FROM categories WHERE is_active AND parent_id IS NULL
 UNION ALL SELECT c.id,c.parent_id,c.slug,c.name,c.description,c.sort_order,t.ids||c.id,t.slugs||c.slug FROM categories c JOIN active_tree t ON c.parent_id=t.id WHERE c.is_active AND NOT c.id=ANY(t.ids)
)`;
const ELIGIBLE=`EXISTS(SELECT 1 FROM product_categories primary_pc JOIN active_tree primary_ct ON primary_ct.id=primary_pc.category_id WHERE primary_pc.product_id=p.id AND primary_pc.is_primary)`;
const SELECT='p.id,p.sku,p.name,p.product_kind,p.revision,p.brand,p.model_number,p.description,p.selling_price,p.currency,s.slug,s.seo_title,s.meta_description';
const WHERE=`WHERE ${ELIGIBLE}
 AND ($1='' OR position(lower($1) in lower(p.name))>0 OR position(lower($1) in lower(p.sku))>0 OR position(lower($1) in lower(coalesce(p.brand,'')))>0)
 AND ($2='' OR p.product_kind=$2)
 AND ($3='' OR EXISTS(SELECT 1 FROM product_categories pc JOIN active_tree child ON child.id=pc.category_id JOIN active_tree target ON target.id=ANY(child.ids) WHERE pc.product_id=p.id AND target.slug=$3))
 AND ($4='' OR p.brand=$4) AND ($5='' OR p.currency=$5)
 AND ($6::numeric IS NULL OR p.selling_price>=$6::numeric) AND ($7::numeric IS NULL OR p.selling_price<=$7::numeric)`;
function createService(db){
 async function ready(){const r=(await db.query("SELECT (SELECT max(version) FROM schema_versions) AS version,pg_get_viewdef('public.public_products'::regclass,true) AS definition")).rows[0];if(!r||Number(r.version)<3||!r.definition.includes('current_duplicate_approval'))fail(503,'Current catalogue publication gate is required');}
 async function read(fn){return db.transaction(async c=>{await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');await c.query("SET LOCAL statement_timeout='5s'");return fn(c);});}
 async function hydrate(c,products,detail=false){if(!products.length)return [];const ids=products.map(p=>p.id);
 const media=(await c.query(`SELECT m.id,m.product_id,m.media_type,m.external_url,m.storage_key,m.alt_text,m.caption,m.sort_order,m.is_primary,m.poster_media_id FROM product_media m JOIN public_products p ON p.id=m.product_id WHERE m.product_id=ANY($1::uuid[]) AND m.processing_status IN ('completed','not_applicable') ${detail?'':"AND m.is_primary AND m.media_type='image'"} ORDER BY m.sort_order,m.id`,[ids])).rows;
 const categories=(await c.query(TREE+' SELECT ct.id,ct.slug,ct.name,ct.slugs,pc.product_id,pc.is_primary FROM product_categories pc JOIN active_tree ct ON ct.id=pc.category_id WHERE pc.product_id=ANY($1::uuid[]) ORDER BY pc.is_primary DESC,ct.sort_order,ct.name',[ids])).rows;
 const attributes=(await c.query('SELECT a.*,k.code AS kind_code,k.name AS kind_name,k.entry_profile FROM product_attributes a JOIN product_kinds k ON k.id=a.product_kind_id JOIN public_products p ON p.id=a.product_id WHERE a.product_id=ANY($1::uuid[])',[ids])).rows;
 const tags=detail?(await c.query('SELECT pt.product_id,t.id,t.name,t.tag_group_id AS group_id,g.name AS group_name,EXISTS(SELECT 1 FROM product_categories pc JOIN category_tag_groups cg ON cg.category_id=pc.category_id WHERE pc.product_id=pt.product_id AND cg.tag_group_id=g.id) AS filter_attribute FROM product_tags pt JOIN tags t ON t.id=pt.tag_id AND t.is_active JOIN tag_groups g ON g.id=t.tag_group_id AND g.is_active JOIN public_products p ON p.id=pt.product_id WHERE pt.product_id=ANY($1::uuid[]) ORDER BY g.sort_order,g.id,t.sort_order,t.id',[ids])).rows:[];
 const result=[];for(const p of products){const a=attributes.find(a=>a.product_id===p.id);if(!a)fail(503,'Tag-product attributes unavailable');if(a.kind_code!==p.product_kind)fail(503,'Invalid public product-kind reference');const spec={...a,tag_model:true,...(detail?{tags:tags.filter(t=>t.product_id===p.id).map(({product_id,...t})=>t)}:{})};result.push(productDTO(p,media.filter(m=>m.product_id===p.id),categories.filter(cat=>cat.product_id===p.id),spec));}return result;
 }
 async function list(input={}){const o=options(input),args=[o.q,o.kind,o.category,o.brand,o.currency,o.min,o.max];return read(async c=>{const total=Number((await c.query(TREE+' SELECT count(*) AS total FROM public_products p '+WHERE,args)).rows[0].total);const rows=(await c.query(TREE+' SELECT '+SELECT+' FROM public_products p LEFT JOIN product_search_metadata s ON s.product_id=p.id '+WHERE+' ORDER BY '+o.order+' LIMIT $8 OFFSET $9',[...args,o.limit,(o.page-1)*o.limit])).rows;return {source:'catalogue',products:await hydrate(c,rows),pagination:{page:o.page,limit:o.limit,total,pages:Math.ceil(total/o.limit)}};});}
 async function detail(key,byId=false){if(byId)key=uuid(key);else{if(typeof key!=='string'||!/^\S{1,100}$/.test(key))fail(404,'Product not found');key=key.toUpperCase();}return read(async c=>{const p=(await c.query(TREE+' SELECT '+SELECT+' FROM public_products p LEFT JOIN product_search_metadata s ON s.product_id=p.id WHERE '+ELIGIBLE+' AND '+(byId?'p.id':'p.sku')+'=$1',[key])).rows[0];if(!p)fail(404,'Product not found');return {source:'catalogue',product:(await hydrate(c,[p],true))[0]};});}
 async function categories(){return read(async c=>{const rows=(await c.query(TREE+` SELECT root.id,root.parent_id,root.slug,root.name,root.description,root.sort_order,root.slugs,count(DISTINCT p.id)::integer AS product_count FROM active_tree root LEFT JOIN active_tree child ON root.id=ANY(child.ids) LEFT JOIN product_categories pc ON pc.category_id=child.id LEFT JOIN public_products p ON p.id=pc.product_id AND ${ELIGIBLE} GROUP BY root.id,root.parent_id,root.slug,root.name,root.description,root.sort_order,root.slugs ORDER BY root.sort_order,root.name,root.id`)).rows;return {source:'catalogue',categories:categoryTree(rows)};});}
 async function filters(){return read(async c=>({source:'catalogue',facets:(await c.query(TREE+` SELECT p.product_kind AS kind,p.brand,p.currency,min(p.selling_price)::text AS min_price,max(p.selling_price)::text AS max_price,count(*)::integer AS product_count FROM public_products p WHERE ${ELIGIBLE} GROUP BY p.product_kind,p.brand,p.currency ORDER BY p.product_kind,p.brand,p.currency`)).rows}));}
 async function media(id){id=uuid(id);return read(async c=>{const m=(await c.query(TREE+` SELECT m.id,m.storage_key,m.media_type FROM product_media m JOIN public_products p ON p.id=m.product_id WHERE m.id=$1 AND ${ELIGIBLE} AND m.storage_key IS NOT NULL AND m.processing_status IN ('completed','not_applicable')`,[id])).rows[0];if(!m||!storageKey(m.storage_key))fail(404,'Media not found');return m;});}
 async function compatible(id,input={}){uuid(id);fail(410,'Compatibility is unavailable pending the tag-model rebuild');}
 async function byIds(ids,input={}){
  if(!Array.isArray(ids)||ids.length>500)fail(400,'At most 500 product UUIDs');ids=[...new Set(ids.map(uuid))];
  const limit=input.limit??ids.length,page=input.page??1;if(!Number.isInteger(limit)||limit<0||limit>500||!Number.isInteger(page)||page<1)fail(400,'Invalid product page');
  return read(async c=>{const rows=(await c.query(TREE+` SELECT ${SELECT} FROM public_products p LEFT JOIN product_search_metadata s ON s.product_id=p.id WHERE p.id=ANY($1::uuid[]) AND ${ELIGIBLE} ORDER BY array_position($1::uuid[],p.id)`,[ids])).rows;
   return {products:await hydrate(c,rows.slice((page-1)*limit,page*limit)),total:rows.length};
  });
 }
 async function collectionTiles(){return read(async c=>{
  const rows=(await c.query(TREE+` SELECT * FROM (
   SELECT ${SELECT},c.title AS collection_title,c.slug AS collection_slug,c.description AS collection_description,c.sort_order AS collection_order,c.id AS collection_id,
    count(*) OVER(PARTITION BY c.id)::integer AS product_count,
    row_number() OVER(PARTITION BY c.id ORDER BY (p.id=c.cover_product_id) DESC NULLS LAST,cp.sort_order,p.id) AS cover_rank
   FROM homepage_collections c JOIN homepage_collection_products cp ON cp.collection_id=c.id JOIN public_products p ON p.id=cp.product_id LEFT JOIN product_search_metadata s ON s.product_id=p.id WHERE c.is_active AND ${ELIGIBLE}
  ) ranked WHERE cover_rank=1 ORDER BY collection_order,collection_title,collection_id LIMIT 24`)).rows;
  const covers=await hydrate(c,[...new Map(rows.map(r=>[r.id,r])).values()]),map=new Map(covers.map(p=>[p.id,p]));return rows.map(r=>({title:r.collection_title,slug:r.collection_slug,description:r.collection_description,product_count:r.product_count,cover:map.get(r.id)}));
 });}
 return {ready,list,detail,categories,filters,media,compatible,byIds,collectionTiles};
}
module.exports={options,uuid,https,storageKey,mediaDTO,specsDTO,productDTO,categoryTree,compatibility,createService};
