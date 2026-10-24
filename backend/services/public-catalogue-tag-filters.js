"use strict";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function fail(message,status=400){const e=new Error(message);e.status=status;throw e;}
function uuid(v){if(typeof v!=='string'||!UUID.test(v))fail('Invalid tag filter reference');return v.toLowerCase();}
function selections(value){if(value===undefined||value==='')return [];if(typeof value!=='string'||value.length>16000)fail('Invalid tag_filters');let input;try{input=JSON.parse(value);}catch(_){fail('tag_filters must be JSON');}if(!Array.isArray(input)||input.length>20)fail('At most 20 tag groups may be selected');const groups=new Set();let count=0;return input.map(s=>{if(!s||typeof s!=='object'||Array.isArray(s)||Object.keys(s).some(k=>!['group_id','tag_ids','unclassified'].includes(k)))fail('Invalid tag group selection');const group_id=uuid(s.group_id);if(groups.has(group_id))fail('Duplicate tag group selection');groups.add(group_id);if(!Array.isArray(s.tag_ids)||s.tag_ids.length>100||s.unclassified!==undefined&&typeof s.unclassified!=='boolean')fail('Invalid tag selection');const tag_ids=[...new Set(s.tag_ids.map(uuid))].sort();count+=tag_ids.length;if(count>200)fail('At most 200 tags may be selected');return {group_id,tag_ids,unclassified:s.unclassified===true};}).filter(s=>s.tag_ids.length||s.unclassified).sort((a,b)=>a.group_id.localeCompare(b.group_id));}
const TREE=`WITH RECURSIVE active_tree AS (
 SELECT id,parent_id,slug,name,sort_order,ARRAY[id] AS ids,ARRAY[slug] AS slugs FROM categories WHERE is_active AND parent_id IS NULL
 UNION ALL SELECT c.id,c.parent_id,c.slug,c.name,c.sort_order,t.ids||c.id,t.slugs||c.slug FROM categories c JOIN active_tree t ON c.parent_id=t.id WHERE c.is_active AND NOT c.id=ANY(t.ids)
)`;
const WITH=TREE+`,scope_nodes AS (
 SELECT c.id FROM active_tree c JOIN categories policy ON policy.id=c.id
 WHERE policy.allow_direct_products AND ($3::text='' OR EXISTS(SELECT 1 FROM active_tree target WHERE target.slug=$3::text AND target.id=ANY(c.ids)))
),configured_groups AS (
 SELECT g.id,g.code,g.name,CASE WHEN $3::text='' THEN gf.sort_order ELSE g.sort_order END AS sort_order
 FROM tag_groups g LEFT JOIN catalogue_filter_tag_groups gf ON gf.tag_group_id=g.id
 WHERE g.is_active AND (($3::text='' AND gf.tag_group_id IS NOT NULL) OR ($3::text<>'' AND EXISTS(SELECT 1 FROM category_tag_groups cg JOIN scope_nodes n ON n.id=cg.category_id WHERE cg.tag_group_id=g.id)))
),base AS (
 SELECT p.* FROM public_products p
 WHERE EXISTS(SELECT 1 FROM product_categories pc JOIN active_tree c ON c.id=pc.category_id WHERE pc.product_id=p.id AND pc.is_primary)
 AND ($1::text='' OR position(lower($1::text) in lower(p.name))>0 OR position(lower($1::text) in lower(p.sku))>0 OR position(lower($1::text) in lower(coalesce(p.brand,'')))>0)
 AND ($2::text='' OR p.product_kind=$2::text)
 AND ($3::text='' OR EXISTS(SELECT 1 FROM product_categories pc JOIN active_tree child ON child.id=pc.category_id JOIN active_tree target ON target.id=ANY(child.ids) WHERE pc.product_id=p.id AND target.slug=$3::text))
 AND ($4::text='' OR p.brand=$4::text) AND ($5::text='' OR p.currency=$5::text)
 AND ($6::numeric IS NULL OR p.selling_price>=$6::numeric) AND ($7::numeric IS NULL OR p.selling_price<=$7::numeric)
),selections AS (
 SELECT * FROM jsonb_to_recordset($8::jsonb) AS s(group_id uuid,tag_ids uuid[],unclassified boolean)
),applicable AS (
 SELECT DISTINCT b.id AS product_id,g.id AS group_id FROM base b JOIN product_categories pc ON pc.product_id=b.id
 JOIN scope_nodes n ON n.id=pc.category_id JOIN category_tag_groups cg ON cg.category_id=n.id JOIN configured_groups g ON g.id=cg.tag_group_id
),tagged AS (
 SELECT DISTINCT a.product_id,a.group_id,t.id AS tag_id FROM applicable a JOIN product_tags pt ON pt.product_id=a.product_id JOIN tags t ON t.id=pt.tag_id AND t.tag_group_id=a.group_id AND t.is_active
),matches AS (
 SELECT a.product_id,a.group_id FROM applicable a JOIN selections s ON s.group_id=a.group_id
 WHERE EXISTS(SELECT 1 FROM tagged t WHERE t.product_id=a.product_id AND t.group_id=a.group_id AND t.tag_id=ANY(s.tag_ids))
 OR (s.unclassified AND NOT EXISTS(SELECT 1 FROM tagged t WHERE t.product_id=a.product_id AND t.group_id=a.group_id))
),survivors AS (
 SELECT b.* FROM base b WHERE NOT EXISTS(SELECT 1 FROM selections s WHERE NOT EXISTS(SELECT 1 FROM matches m WHERE m.product_id=b.id AND m.group_id=s.group_id))
),context AS (
 SELECT a.product_id,a.group_id FROM applicable a WHERE NOT EXISTS(SELECT 1 FROM selections s WHERE s.group_id<>a.group_id AND NOT EXISTS(SELECT 1 FROM matches m WHERE m.product_id=a.product_id AND m.group_id=s.group_id))
)`;
const SQL={
 inventory:WITH+' SELECT id FROM configured_groups ORDER BY sort_order,name,id LIMIT 201',
 count:WITH+' SELECT count(*)::integer AS total FROM survivors',
 metadata:WITH+` SELECT g.id,g.code,g.name,g.sort_order,count(c.product_id)::integer AS eligible_count,
 count(c.product_id) FILTER(WHERE EXISTS(SELECT 1 FROM tagged t WHERE t.product_id=c.product_id AND t.group_id=g.id))::integer AS classified_count
 FROM configured_groups g LEFT JOIN context c ON c.group_id=g.id GROUP BY g.id,g.code,g.name,g.sort_order ORDER BY g.sort_order,g.name,g.id`,
 labels:WITH+` SELECT g.id AS group_id,g.name AS group_name,t.id AS tag_id,t.name AS tag_name FROM selections s JOIN configured_groups g ON g.id=s.group_id LEFT JOIN tags t ON t.tag_group_id=g.id AND t.id=ANY(s.tag_ids) AND t.is_active ORDER BY g.id,t.id`,
 options:WITH+`,option_counts AS (
 SELECT t.id,t.code,t.name,t.sort_order,count(DISTINCT c.product_id)::integer AS product_count FROM tags t JOIN configured_groups g ON g.id=t.tag_group_id
 LEFT JOIN tagged hit ON hit.tag_id=t.id AND hit.group_id=g.id LEFT JOIN context c ON c.product_id=hit.product_id AND c.group_id=g.id
 WHERE g.id=$9::uuid AND t.is_active AND lower(t.name) LIKE $10::text ESCAPE chr(92)
 GROUP BY t.id,t.code,t.name,t.sort_order HAVING count(DISTINCT c.product_id)>0 OR t.id=ANY($13::uuid[])
 ) SELECT jsonb_build_object('total',(SELECT count(*) FROM option_counts),'items',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,code,name,product_count FROM option_counts ORDER BY sort_order,name,id LIMIT $11::integer OFFSET $12::integer) x),'[]'::jsonb)) AS result`
};
function createTagListingService(db,domain=require('./public-catalogue-v1')){
 function input(query){const o=domain.options(query),selected=selections(query.tag_filters);return {o,selected,args:[o.q,o.kind,o.category,o.brand,o.currency,o.min,o.max,JSON.stringify(selected)]};}
 async function read(work){return db.transaction(async c=>{await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');await c.query("SET LOCAL statement_timeout='5s'");if(!(await c.query('SELECT version FROM catalogue_taxonomy_versions WHERE version=2')).rows.length)fail('Tag product storage required',503);return work(c);});}
 async function inventory(c,args){if((await c.query(SQL.inventory,args)).rows.length>200)fail('Tag filter scope exceeds the synchronous limit; narrow the category',503);}
 async function hydrate(c,rows){if(!rows.length)return [];const ids=rows.map(p=>p.id),media=(await c.query("SELECT m.id,m.product_id,m.media_type,m.external_url,m.storage_key,m.alt_text,m.caption,m.sort_order,m.is_primary,m.poster_media_id FROM product_media m JOIN public_products p ON p.id=m.product_id WHERE m.product_id=ANY($1::uuid[]) AND m.processing_status IN ('completed','not_applicable') AND m.is_primary AND m.media_type='image' ORDER BY m.sort_order,m.id",[ids])).rows,categories=(await c.query(TREE+' SELECT ct.id,ct.slug,ct.name,ct.slugs,pc.product_id,pc.is_primary FROM product_categories pc JOIN active_tree ct ON ct.id=pc.category_id WHERE pc.product_id=ANY($1::uuid[]) ORDER BY pc.is_primary DESC,ct.sort_order,ct.name',[ids])).rows;return rows.map(p=>domain.productDTO(p,media.filter(m=>m.product_id===p.id),categories.filter(cat=>cat.product_id===p.id)));}
 async function list(query={}){const {o,args}=input(query);return read(async c=>{await inventory(c,args);const total=Number((await c.query(SQL.count,args)).rows[0].total),rows=(await c.query(WITH+' SELECT p.*,s.slug,s.seo_title,s.meta_description FROM survivors p LEFT JOIN product_search_metadata s ON s.product_id=p.id ORDER BY '+o.order+' LIMIT $9::integer OFFSET $10::integer',[...args,o.limit,(o.page-1)*o.limit])).rows;return {source:'catalogue',products:await hydrate(c,rows),pagination:{page:o.page,limit:o.limit,total,pages:Math.ceil(total/o.limit)}};});}
 async function facets(query={}){const {args,selected}=input(query),group=query.tag_group===undefined?'':uuid(query.tag_group),q=query.tag_q??'';if(typeof q!=='string'||q.length>80)fail('Invalid tag option search');const integer=(v,d,max)=>{if(v===undefined)return d;if(typeof v!=='string'||!/^\d+$/.test(v)||Number(v)<1||Number(v)>max)fail('Invalid tag option page');return Number(v);},limit=integer(query.tag_limit,50,100),page=integer(query.tag_page,1,10000),prefix=q.trim().toLowerCase().replace(/[\%_]/g,x=>String.fromCharCode(92)+x)+'%';return read(async c=>{await inventory(c,args);const all=(await c.query(SQL.metadata,args)).rows.map(g=>({...g,not_classified_count:Number(g.eligible_count)-Number(g.classified_count)})),labels=selected.length?(await c.query(SQL.labels,args)).rows:[],selection=selected.map(s=>({...s,group_name:labels.find(l=>l.group_id===s.group_id)?.group_name||null,tags:s.tag_ids.map(id=>({id,name:labels.find(l=>l.group_id===s.group_id&&l.tag_id===id)?.tag_name||null}))}));let options=null;if(group){const result=(await c.query(SQL.options,[...args,group,prefix,limit,(page-1)*limit,selected.find(s=>s.group_id===group)?.tag_ids||[]])).rows[0].result;options={group_id:group,items:result.items,pagination:{page,limit,total:Number(result.total)},not_classified_count:all.find(g=>g.id===group)?.not_classified_count||0};}return {source:'catalogue',groups:all.filter(g=>Number(g.classified_count)>0),selected:selection,options};});}
 return {list,facets};
}
module.exports={selections,SQL,TREE,WITH,createTagListingService};
