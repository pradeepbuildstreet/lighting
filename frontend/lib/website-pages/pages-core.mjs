import {readFile,mkdir,writeFile,open,rename,unlink,copyFile} from 'node:fs/promises';import path from 'node:path';import {createHash,randomUUID,randomBytes} from 'node:crypto';
export function fail(message,status=400){const e=new Error(message);e.status=status;throw e;}
export function fingerprint(v){return createHash('sha256').update(JSON.stringify(v)).digest('hex');}
export const prefixes={brand:'brands',collection:'collections',article:'articles',guide:'guides',landing:'landing',static:'pages',variant:'variants'};
export function validateContent(input){
 const str=(key,max,required=false)=>{if(typeof input[key]!=='string'||input[key].length>max||required&&!input[key].trim())fail('Invalid '+key);return input[key].trim();};
 const type=str('type',30,true);if(!prefixes[type])fail('Unsupported managed page type');const slug=str('slug',120,true);if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))fail('Slug must be lower-case hyphenated text');
 const title=str('title',300,true),body=str('body',30000),brandName=str('brandName',200);
 const productSkus=input.productSkus;if(!Array.isArray(productSkus)||productSkus.length>20||productSkus.some(s=>typeof s!=='string'||!s.trim()||s.length>200)||new Set(productSkus).size!==productSkus.length)fail('Invalid product SKU references');
 if(type==='variant'&&productSkus.length!==1)fail('A variant page must map to exactly one real published product SKU');
 if(type==='brand'&&!brandName)fail('Brand page needs a catalogue brand identity');
 return {type,slug,title,body,brandName,productSkus:productSkus.map(s=>s.trim()),path:'/'+prefixes[type]+'/'+slug};
}
export function validateSEO(input){const text=(k,max)=>{if(typeof input[k]!=='string'||input[k].length>max)fail('Invalid '+k);return input[k].trim();};const seoTitle=text('seoTitle',500),metaDescription=text('metaDescription',2000),ogTitle=text('ogTitle',500),ogDescription=text('ogDescription',2000);if(!seoTitle||/your reviewed|placeholder/i.test(seoTitle+' '+metaDescription))fail('Reviewed factual title/description required');if(typeof input.canonical!=='boolean')fail('Canonical switch required');return {seoTitle,metaDescription,ogTitle,ogDescription,canonical:input.canonical,noindex:true};}
export function flatten(nodes,out=[]){if(!Array.isArray(nodes))fail('Category tree contract unsupported',502);for(const c of nodes){out.push(c);if(c.children)flatten(c.children,out);}return out;}
export async function requestCatalogue(config,route){
 const u=new URL(config.catalogueBase);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.search||u.hash)fail('Catalogue origin unsupported',503);
 if(u.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname))fail('Local HTTP source only',503);
 const headers={Accept:'application/json'};if(process.env.LUMINOZA_READ_TOKEN)headers.Authorization='Bearer '+process.env.LUMINOZA_READ_TOKEN;
 const r=await fetch(u.href.replace(/\/$/,'')+route,{headers,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)fail('Catalogue HTTP '+r.status,r.status===404?404:503);const text=await r.text();if(text.length>2000000)fail('Catalogue response too large',503);try{return JSON.parse(text);}catch{fail('Catalogue JSON invalid',503);}
}
export async function loadStore(config){try{const s=JSON.parse(await readFile(config.store,'utf8'));if(s.version!==1||!Number.isSafeInteger(s.generation)||!Array.isArray(s.entities)||!s.seo||!Array.isArray(s.history))fail('Website pages schema invalid',503);return s;}catch(e){if(e.code==='ENOENT')return {version:1,generation:0,entities:[],seo:{},history:[]};throw e;}}
export async function mutate(config,expected,actor,action,fn){const dir=path.dirname(config.store);await mkdir(dir,{recursive:true,mode:0o700});let lock;try{lock=await open(config.store+'.lock','wx',0o600);}catch(e){if(e.code==='EEXIST')fail('Website page store locked; reload rather than bypass writer',409);throw e;}let temp;try{const s=await loadStore(config);if(s.generation!==expected)fail('Page workspace changed. Reload.',409);await fn(s);s.generation++;s.history.push({at:new Date().toISOString(),actor,action,generation:s.generation});
 try{await readFile(config.store);const backups=path.join(dir,'backups');await mkdir(backups,{recursive:true,mode:0o700});await copyFile(config.store,path.join(backups,Date.now()+'-'+randomBytes(6).toString('hex')+'.json'));}catch(e){if(e.code!=='ENOENT')throw e;}
 temp=config.store+'.'+randomBytes(8).toString('hex')+'.tmp';await writeFile(temp,JSON.stringify(s,null,2),{mode:0o600});await rename(temp,config.store);return s;
 }finally{if(temp)await unlink(temp).catch(()=>{});await lock.close();await unlink(config.store+'.lock');}}
export async function source(config,state,id,deps={}){
 const catalogue=deps.catalogue||((r)=>requestCatalogue(config,r));const entity=state.entities.find(e=>e.id===id);if(!entity)return {state:'unpublished',reason:'Unknown source'};
 try{
  if(entity.adapter==='home'){
   const file=deps.readHome?await deps.readHome():await readFile(config.homeFile,'utf8');return {state:'published',id,type:'home',path:'/',title:'Luminoza',body:'',revision:fingerprint(file),products:[]};
  }
  if(entity.adapter==='category'){
   const c=flatten((await catalogue('/categories')).categories).find(c=>c.id===entity.sourceId);if(!c)return {state:'unpublished',reason:'Category is absent from publication-gated catalogue'};
   return {state:'published',id,type:'category',path:'/categories/'+c.path.split('/').map(encodeURIComponent).join('/'),title:c.name,body:c.description||'',revision:fingerprint({id:c.id,name:c.name,path:c.path,description:c.description||'',parent:c.parent_id}),products:[]};
  }
  if(entity.adapter!=='managed'||!entity.published||entity.deleted)return {state:'unpublished',reason:'Content source not published'};
  const doc=entity.published.doc,products=[];
  if(doc.type==='brand'){const facets=(await catalogue('/filters')).facets;if(!Array.isArray(facets)||!facets.some(f=>f.brand===doc.brandName))return {state:'unpublished',reason:'Brand absent from public catalogue facets'};const list=await catalogue('/products?brand='+encodeURIComponent(doc.brandName)+'&limit=20');products.push(...(list.products||[]));}
  for(const sku of doc.productSkus){const p=(await catalogue('/products/'+encodeURIComponent(sku))).product;if(!p||p.sku!==sku)fail('Product reference mismatch',503);if(!products.some(x=>x.id===p.id))products.push(p);}
  const binding={revision:entity.published.revision,doc,products:products.map(p=>({id:p.id,sku:p.sku,revision:p.revision})).sort((a,b)=>a.id.localeCompare(b.id))};
  return {state:'published',id,type:doc.type,path:doc.path,title:doc.title,body:doc.body,revision:fingerprint(binding),products,variantNote:doc.type==='variant'?'Editorial variant-page mapping to a real SKU; not a native catalogue variant/group model.':null};
 }catch(e){return {state:e.status===404?'unpublished':'unavailable',reason:e.message};}
}
export async function discover(config,state,deps={}){const catalogue=deps.catalogue||((r)=>requestCatalogue(config,r));const result=[{id:'frontend:home',adapter:'home',path:'/',type:'home'}];for(const c of flatten((await catalogue('/categories')).categories))result.push({id:'category:'+c.id,adapter:'category',sourceId:c.id,path:'/categories/'+c.path.split('/').map(encodeURIComponent).join('/'),type:'category'});return result;}
export function delivery(target,src){
 if(src.state!=='published')return {seoState:src.state==='unavailable'?'source_unavailable':'source_unpublished',releaseState:'blocked',effective:null};
 if(!target||target.archived)return {seoState:target?.archived?'archived':'no_draft',releaseState:'not_published',effective:null};
 const approved=target.approval&&target.approval.targetRevision===target.revision&&target.approval.sourceRevision===src.revision;
 const released=approved&&target.release&&target.release.targetRevision===target.revision&&target.release.sourceRevision===src.revision;
 return {seoState:target.approval&&!approved?'stale':approved?'approved':target.review==='submitted'?'in_review':'draft',releaseState:target.release&&!released?'stale':released?'published_current':'not_published',effective:released?target.draft:null};
}
export async function byPath(config,pathname,deps={}){const s=await loadStore(config);const entity=s.entities.find(e=>!e.deleted&&(e.adapter==='managed'?e.published?.doc.path===pathname:e.path===pathname));if(!entity)return {state:'unpublished'};const src=await source(config,s,entity.id,deps);if(src.state==='published'&&src.path!==pathname)return {state:'unpublished',reason:'Source path changed'};return {...src,delivery:delivery(s.seo[entity.id],src)};}
export function newId(){return 'managed:'+randomUUID();}
