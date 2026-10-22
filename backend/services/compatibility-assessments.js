"use strict";
const crypto=require('node:crypto');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function fail(status,message){throw Object.assign(Error(message),{status});}
function id(value){if(typeof value!=='string'||!UUID.test(value))fail(400,'Valid UUID required');return value.toLowerCase();}
function stable(value){if(value instanceof Date)return value.toISOString();if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));return value;}
function fingerprint(snapshot){return crypto.createHash('sha256').update(JSON.stringify(stable({policy:1,snapshot}))).digest('hex');}
const TREE="WITH RECURSIVE active_tree AS (\n SELECT id,parent_id,slug,name,description,sort_order,ARRAY[id] AS ids,ARRAY[slug] AS slugs FROM categories WHERE is_active AND parent_id IS NULL\n UNION ALL SELECT c.id,c.parent_id,c.slug,c.name,c.description,c.sort_order,t.ids||c.id,t.slugs||c.slug FROM categories c JOIN active_tree t ON c.parent_id=t.id WHERE c.is_active AND NOT c.id=ANY(t.ids)\n)";
const ELIGIBLE="EXISTS(SELECT 1 FROM product_categories primary_pc JOIN active_tree primary_ct ON primary_ct.id=primary_pc.category_id WHERE primary_pc.product_id=p.id AND primary_pc.is_primary)";
async function snapshot(c,fixtureId){
 const fixture=(await c.query('SELECT p.id,p.name,p.sku,p.revision::text AS revision,f.* FROM products p JOIN fixture_specs f ON f.product_id=p.id WHERE p.id=$1',[fixtureId])).rows[0];if(!fixture)fail(404,'Fixture not found');
 if(fixture.light_source_mode==='integrated')return {fixture,groups:[],rules:[],overrides:[],lights:[]};
 const groups=(await c.query('SELECT * FROM fixture_socket_groups WHERE fixture_product_id=$1 ORDER BY id LIMIT 51',[fixtureId])).rows;if(groups.length>50)fail(422,'Assessment limit: at most 50 socket groups');
 const gids=groups.map(g=>g.id);
 const rules=gids.length?(await c.query('SELECT r.*,t.is_active AS light_type_active FROM fixture_light_rules r JOIN light_types t ON t.id=r.light_type_id WHERE r.socket_group_id=ANY($1::uuid[]) ORDER BY r.socket_group_id,r.light_type_id',[gids])).rows:[];
 const overrides=gids.length?(await c.query('SELECT * FROM fixture_light_overrides WHERE socket_group_id=ANY($1::uuid[]) ORDER BY socket_group_id,light_product_id',[gids])).rows:[];
 const lights=(await c.query(TREE+` SELECT p.id,p.name,p.sku,p.revision::text AS revision,l.* FROM public_products p JOIN light_specs l ON l.product_id=p.id WHERE ${ELIGIBLE} ORDER BY p.id LIMIT 2001`)).rows;
 if(lights.length>2000||groups.length*lights.length>50000)fail(422,'Assessment is too large; limit is 2000 public lights and 50000 group/light comparisons');
 return {fixture,groups,rules,overrides,lights};
}
function assess(data,evaluator){
 evaluator=evaluator||require('./compatibility').evaluate;
 if(data.fixture.light_source_mode==='integrated')return {mode:'integrated',groups:[],warnings:[],policy:1};
 const groups=data.groups.map(group=>{const entries=data.lights.map(light=>{
  const rule=data.rules.find(r=>r.socket_group_id===group.id&&r.light_type_id===light.light_type_id&&r.light_type_active!==false);
  const technical=rule?evaluator(rule,light,null):{state:light.light_type_id?'incompatible':'unverified',reasons:[light.light_type_id?'No active configured rule for this light type':'Light type missing']};
  const override=data.overrides.find(o=>o.socket_group_id===group.id&&o.light_product_id===light.id);
  // A manual rejection blocks a match. An approval never converts missing/failed technical data into a public match.
  const eligible=technical.state==='compatible'&&override?.decision!=='reject';
  return {product_id:light.id,sku:light.sku,name:light.name,eligible,technical:technical.state,reasons:technical.reasons,manual_decision:override?.decision||null};
 });return {id:group.id,code:group.group_code,socket_count:group.socket_count,entries,eligible_count:entries.filter(e=>e.eligible).length};});
 const warnings=[];if(!groups.length)warnings.push('No socket groups configured; no compatible lights can be displayed.');for(const group of groups)if(!group.eligible_count)warnings.push('No compatible public lights available for '+group.code+'. The fixture stays public; the empty customer section is hidden.');
 return {mode:data.fixture.light_source_mode,groups,warnings,policy:1};
}
function createService({db,publicCatalogue,evaluator}){
 async function read(fixtureId){return db.transaction(async c=>{await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');await c.query("SET LOCAL statement_timeout='15s'");const data=await snapshot(c,fixtureId);if(data.fixture.light_source_mode==='integrated')return {data,row:null};const row=(await c.query('SELECT fingerprint,result,assessed_at,assessed_by FROM product_compatibility_assessments_v1 WHERE fixture_id=$1',[fixtureId])).rows[0]||null;return {data,row};});}
 async function status(value){const fixtureId=id(value),{data,row}=await read(fixtureId);if(data.fixture.light_source_mode==='integrated')return {status:'not_applicable',mode:'integrated',groups:[],warnings:[]};const current=!!row&&row.fingerprint===fingerprint(data);return {status:!row?'not_assessed':current?'current':'stale',mode:data.fixture.light_source_mode,assessed_at:row?.assessed_at||null,groups:row?.result?.groups||[],warnings:!row?['Run assessment in admin. No compatible lights are displayed until assessed.']:!current?['Configuration or candidate eligibility changed. Rerun assessment; old results are not displayed publicly.']:row.result.warnings};}
 async function run(value,actor){const fixtureId=id(value),adminId=id(actor.id);return db.transaction(async c=>{await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');await c.query("SET LOCAL statement_timeout='60s'");await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[fixtureId]);const data=await snapshot(c,fixtureId);if(data.fixture.light_source_mode==='integrated')return {status:'not_applicable',mode:'integrated',groups:[],warnings:[]};const result=assess(data,evaluator),hash=fingerprint(data),saved=(await c.query(`INSERT INTO product_compatibility_assessments_v1(fixture_id,fingerprint,result,assessed_by) VALUES($1,$2,$3::jsonb,$4) ON CONFLICT(fixture_id) DO UPDATE SET fingerprint=EXCLUDED.fingerprint,result=EXCLUDED.result,assessed_by=EXCLUDED.assessed_by,assessed_at=now() RETURNING assessed_at`,[fixtureId,hash,JSON.stringify(result),adminId])).rows[0];await c.query('INSERT INTO product_compatibility_audit_v1(fixture_id,actor_id,fingerprint,result) VALUES($1,$2,$3,$4::jsonb)',[fixtureId,adminId,hash,JSON.stringify(result)]);return {...result,status:'current',assessed_at:saved.assessed_at};});}
 async function publicResults(value,input={}){
  const fixtureId=id(value),page=Number(input.page??1);if(!Number.isInteger(page)||page<1||page>1000)fail(400,'Invalid page');const groupId=input.group_id?id(input.group_id):null;
  await publicCatalogue.ready();await publicCatalogue.detail(fixtureId,true);
  const {data,row}=await read(fixtureId);
  if(data.fixture.light_source_mode==='integrated')return {status:'not_applicable',groups:[]};
  if(!row||row.fingerprint!==fingerprint(data))return {status:row?'stale':'not_assessed',groups:[]};
  const selected=row.result.groups.filter(g=>!groupId||g.id===groupId);if(groupId&&!selected.length)fail(404,'Socket group not found');
  const groups=[];for(const g of selected){const eligible=g.entries.filter(e=>e.eligible).map(e=>e.product_id),limit=12;
   const pageIds=eligible.slice((page-1)*limit,page*limit),products=pageIds.length?(await publicCatalogue.byIds(pageIds)).products:[];
   if(eligible.length)groups.push({id:g.id,code:g.code,socket_count:g.socket_count,products,pagination:{page,limit,total:eligible.length,pages:Math.ceil(eligible.length/limit)}});
  }
  // No failed diagnostics, unverified rows, assessor IDs or admin warnings are exposed.
  return {status:'current',groups};
 }
 return {status,run,publicResults};
}
function mount(app){const express=require('express'),db=require('../db/catalogue'),publicCatalogue=require('./public-catalogue-v1').createService(db),{requireAdmin}=require('../middleware/require-admin'),rateLimit=require('express-rate-limit'),service=createService({db,publicCatalogue}),admin=express.Router(),pub=express.Router();const headers=(_req,res,next)=>{res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});next();};const wrap=fn=>async(req,res)=>{try{await fn(req,res);}catch(e){const status=[400,404,409,422].includes(e.status)?e.status:503;res.status(status).json({error:e.code==='42P01'?'Compatibility migration has not been applied':e.status?e.message:'Compatibility service temporarily unavailable'});}};
 admin.use(headers);admin.use(requireAdmin);admin.get('/:id',wrap(async(req,res)=>res.json(await service.status(req.params.id))));admin.post('/:id/assess',wrap(async(req,res)=>res.json(await service.run(req.params.id,req.admin))));
 pub.use(headers);pub.use((_req,res,next)=>require('../api/public-catalogue-v1').enabled(process.env)?next():res.status(404).json({error:'Not found'}));pub.use(rateLimit({windowMs:60000,limit:120,standardHeaders:'draft-7',legacyHeaders:false}));pub.get('/:id',wrap(async(req,res)=>res.json(await service.publicResults(req.params.id,req.query))));
 app.use('/api/admin/compatibility-assessments',admin);app.use('/api/product-insights/compatible-lights',pub);
}
module.exports={id,stable,fingerprint,snapshot,assess,createService,mount};
