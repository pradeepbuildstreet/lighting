"use strict";
const {timingSafeEqual,createHash}=require('node:crypto');
function eq(a,b){if(typeof a!=='string'||typeof b!=='string')return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
function stable(value){function sort(v){if(v===null||typeof v!=='object')return v;if(Array.isArray(v))return v.map(sort);return Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])]));}return createHash('sha256').update(JSON.stringify(sort(value))).digest('hex');}
function createWebsiteHandler({projectId,token,service,homeProvider,limit=120,windowMs=60000,now=Date.now}){
 if(!/^[a-z][a-z0-9-]{1,62}$/.test(projectId)||typeof token!=='string'||token.length<32||token.length>512||/\s/.test(token))throw Error('Explicit project and secret required');
 let started=now(),requests=0;
 return async(req,res)=>{
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:JSON.stringify(data));};
  let url;try{url=new URL(req.url,'http://internal.invalid');}catch{return send(400,{error:'Invalid request'});}
  const prefix='/api/seo-connector/v1/projects/'+projectId;
  if(!url.pathname.startsWith(prefix+'/')||!eq(req.headers.authorization,'Bearer '+token))return send(401,{error:'Authentication required'});
  if(!['GET','HEAD'].includes(req.method))return send(405,{error:'Read only'});
  if(now()-started>=windowMs){started=now();requests=0;}if(++requests>limit)return send(429,{error:'Rate limited'});
  const route=url.pathname.slice(prefix.length),envelope=data=>({contract:'seo-website-v1',projectId,source:'catalogue',...data});
  try{
   if(route==='/content/home')return send(503,{error:'Home projection not configured in catalogue-only phase'});
   if(!route.startsWith('/catalogue/'))return send(404,{error:'Not found'});
   await service.ready();let data;
   if(route==='/catalogue/products')data=await service.list(Object.fromEntries(url.searchParams));
   else if(route==='/catalogue/categories')data=await service.categories();
   else if(route==='/catalogue/filters')data=await service.filters();
   else if(/^\/catalogue\/products\/id\/[a-f0-9-]{36}$/i.test(route))data=await service.detail(route.split('/').pop(),true);
   else if(/^\/catalogue\/products\/[^/]+$/.test(route))data=await service.detail(decodeURIComponent(route.split('/').pop()),false);
   else return send(404,{error:'Not found'});
   if(!data||data.source!=='catalogue')throw Error('Publication projection contract required');
   const safe={};for(const key of ['product','products','categories','facets','pagination'])if(Object.hasOwn(data,key))safe[key]=data[key];
   if(route==='/catalogue/categories')safe.sourceRevision=stable(safe.categories);
   return send(200,envelope(safe));
  }catch(e){const status=[400,404].includes(e.status)?e.status:503;return send(status,{error:status===404?'Not found':status===400?'Invalid request':'Source unavailable'});}
 };
}
function createRouter(express,service,{env=process.env,homeProvider}={}){
 const router=express.Router();
 if(env.SEO_CONNECTOR_ENABLED!=='true'){router.use((_req,res)=>{res.writeHead(404,{'Cache-Control':'no-store'});res.end();});return router;}
 let handler;try{handler=createWebsiteHandler({projectId:env.SEO_CONNECTOR_PROJECT_ID,token:env.SEO_CONNECTOR_READ_TOKEN,service,homeProvider});}catch{
  router.use((_req,res)=>{res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:'Connector unavailable'}));});return router;
 }
 router.use((req,res)=>handler({url:req.originalUrl,method:req.method,headers:req.headers},res));
 return router;
}
module.exports={createWebsiteHandler,createRouter,stable};
