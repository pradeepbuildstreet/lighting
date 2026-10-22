import {readFile} from 'node:fs/promises';import {spawn} from 'node:child_process';
import path from 'node:path';
export function fail(message,status=400){const e=new Error(message);e.status=status;throw e;}
export function localPath(s){if(typeof s!=='string'||s.length>500||!/^\/[A-Za-z0-9/_%.-]*$/.test(s)||s.startsWith('//')||/[\\?#]/.test(s))fail('Use a plain site path without query/fragment');let decoded;try{decoded=decodeURIComponent(s);}catch{fail('Invalid URL encoding');}if(decoded.split('/').some(x=>['.','..'].includes(x))||/[\\?#%]/.test(decoded)||decoded.startsWith('//'))fail('Ambiguous path refused');if(/^\/(?:api|admin|_next)(?:\/|$)/.test(decoded)||['/robots.txt','/sitemap.xml'].includes(decoded))fail('Protected path refused');return s;}
export function origin(s){let u;try{u=new URL(s);}catch{fail('Invalid site origin');}if(u.pathname!=='/'||u.search||u.hash||u.username||u.password||!['https:','http:'].includes(u.protocol))fail('Use an HTTP(S) origin without a path');if(u.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname))fail('Plain HTTP is allowed only for loopback');return u.origin;}
export function productPath(sku){if(typeof sku!=='string'||!sku||sku.length>200)fail('Invalid SKU');return '/catalogue/products/'+encodeURIComponent(sku);}
export function validatePlan(b){
 const siteOrigin=origin(b.siteOrigin);if(!Array.isArray(b.products)||b.products.length>50||!Array.isArray(b.redirects)||b.redirects.length>50)fail('Maximum 50 product policies and 50 redirects');
 const products=b.products.map(p=>{const sku=p.sku;if(typeof p.noindex!=='boolean'||typeof p.canonical!=='boolean')fail('Product policy switches must be boolean');productPath(sku);return {sku,noindex:p.noindex,canonical:p.canonical};});
 if(new Set(products.map(p=>p.sku)).size!==products.length)fail('Duplicate product policy');
 const redirects=b.redirects.map(r=>{localPath(r.from);if(!r.from.startsWith('/products/')&&!r.from.startsWith('/legacy-products/'))fail('This release redirects only /products/ or /legacy-products/ aliases');productPath(r.targetSku);if(r.from===productPath(r.targetSku))fail('Self redirect');return {from:r.from,targetSku:r.targetSku,status:307};});
 if(new Set(redirects.map(r=>r.from)).size!==redirects.length)fail('Duplicate redirect source');const map=new Map(redirects.map(r=>[r.from,productPath(r.targetSku)]));
 for(const r of redirects){const seen=new Set();let p=r.from;while(map.has(p)){if(seen.has(p))fail('Redirect loop');seen.add(p);p=map.get(p);}if(map.has(productPath(r.targetSku)))fail('Redirect chains refused; target must be final');}
 return {siteOrigin,products,redirects,environment:'local-or-staging',indexingActivation:false};
}
export async function loadState(file){let s;try{s=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return null;fail('Delivery state unreadable or corrupt',503);}if(s.version!==1||!Number.isSafeInteger(s.generation)||!s.connection)fail('Unsupported delivery state',503);return s;}
export async function cliPreview(connection,sku){return new Promise((resolve,reject)=>{
 const child=spawn(process.execPath,[path.join(connection.s1Root,'apps','cli','registry.mjs'),'preview',connection.projectId,connection.ids[sku]],{cwd:connection.s1Root,env:{...process.env,SEO_REGISTRY_PATH:connection.registryPath},shell:false,windowsHide:true});let out='',err='',finished=false;const timer=setTimeout(()=>{child.kill();done(Error('Fresh SEO preview timed out'));},12000);
 function done(error,value){if(finished)return;finished=true;clearTimeout(timer);error?reject(error):resolve(value);}
 child.on('error',done);child.stdout.on('data',b=>{out+=b;if(out.length>1000000){child.kill();done(Error('Preview too large'));}});child.stderr.on('data',b=>{err+=b;if(err.length>200000){child.kill();done(Error('Preview stderr too large'));}});
 child.on('close',code=>{if(code!==0)return done(Error('Fresh preview failed'));try{done(null,JSON.parse(out));}catch{done(Error('Fresh preview returned unsupported JSON'));}});
});}
export function publicAllowed(preview){return preview?.sourceReadiness?.publicSource?.ready===true&&Array.isArray(preview.reasons)&&!preview.reasons.some(r=>/EXCLUD|UNPUBLISH|NOT_PUBLIC/i.test(String(r)));}
export function eligible(preview,binding){return publicAllowed(preview)&&preview.sourceId===binding.sourceId&&String(preview.sourceRevision)===binding.sourceRevision&&preview.projectRevision===binding.projectRevision;}
export function canIndex(preview,baseIndex,enabled=false){return enabled===true&&baseIndex===true&&preview.sourceReadiness?.indexing?.ready===true&&preview.seo?.robots?.index===true;}
export async function effectiveProduct(state,sku,preview=cliPreview){
 const approved=state?.approved;if(!approved||approved.generation!==state.generation)return null;const rule=approved.plan.products.find(p=>p.sku===sku);if(!rule)return null;const binding=approved.bindings[sku];if(!binding)return null;
 const current=await preview(state.connection,sku);if(!eligible(current,binding))return null;return {rule,current,siteOrigin:approved.plan.siteOrigin,activationApproved:approved.plan.indexingActivation===true};
}
export async function resolveRedirect(state,pathname,preview=cliPreview){
 localPath(pathname);const approved=state?.approved;if(!approved||approved.generation!==state.generation)return null;const r=approved.plan.redirects.find(r=>r.from===pathname);if(!r)return null;
 const binding=approved.bindings[r.targetSku];if(!binding)return null;const current=await preview(state.connection,r.targetSku);if(!eligible(current,binding))return null;return {path:productPath(r.targetSku),status:307};
}
export async function sitemapEntries(state,enabled=false,preview=cliPreview){
 if(!enabled||!state?.approved||state.approved.plan.indexingActivation!==true||state.approved.generation!==state.generation)return [];
 const site=origin(state.approved.plan.siteOrigin);if(!site.startsWith('https://'))return [];const entries=[];
 for(const rule of state.approved.plan.products){if(rule.noindex||!rule.canonical)continue;const p=await effectiveProduct(state,rule.sku,preview);if(!p||!canIndex(p.current,p.current.seo?.robots?.index,enabled))continue;const url=site+productPath(rule.sku);if(p.current.seo?.canonical!==url)continue;entries.push({url});}return entries;
}
