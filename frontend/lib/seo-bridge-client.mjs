export class SeoClientError extends Error{constructor(message,status=503){super(message);this.name='SeoClientError';this.status=status;}}
export function safeJsonLd(value){const slash=String.fromCharCode(92);return JSON.stringify(value).replaceAll('<',slash+'u003c').replaceAll('>',slash+'u003e').replaceAll('&',slash+'u0026').replaceAll(String.fromCharCode(8232),slash+'u2028').replaceAll(String.fromCharCode(8233),slash+'u2029');}
export function assertProductMatches(bundle,p){if(bundle.sourceId!==p.id||String(bundle.sourceRevision)!==String(p.revision))throw new SeoClientError('Catalogue revision changed; retry');const e=bundle.entity;if(e.sku!==p.sku||e.name!==p.name||e.description!==(typeof p.description==='string'?p.description:null)||e.price.amount!==String(p.price)||e.price.currency!==p.currency||e.commerce.brand!==(p.brand||null))throw new SeoClientError('Visible product and SEO source disagree');const media=rows=>rows.map(m=>({id:m.id,type:m.type,url:m.url}));if(JSON.stringify(media(e.media))!==JSON.stringify(media(p.media)))throw new SeoClientError('Visible media and SEO source disagree');const cats=rows=>rows.map(c=>({id:c.id,name:c.name,path:c.path,primary:!!c.primary}));if(JSON.stringify(cats(e.categories))!==JSON.stringify(cats(p.categories)))throw new SeoClientError('Visible categories and SEO source disagree');return bundle;}
export function createSeoClient({bridgeBase,token,projectId,allowLocal=false,canonicalOrigin=null,fetchImpl=fetch,timeoutMs=12000}){let base;try{base=new URL(bridgeBase);}catch(_){throw new SeoClientError('Invalid bridge base');}if(base.username||base.password||base.search||base.hash||base.pathname!=='/'||typeof token!=='string'||token.length<32||!/^[a-z][a-z0-9-]{1,62}$/.test(projectId))throw new SeoClientError('Invalid server-side SEO configuration');const local=['localhost','127.0.0.1','[::1]'].includes(base.hostname);if(base.protocol!=='https:'&&!(allowLocal&&local&&base.protocol==='http:'))throw new SeoClientError('SEO bridge requires HTTPS or explicit local HTTP');let expected=null;if(canonicalOrigin){const u=new URL(canonicalOrigin);if(u.protocol!=='https:'||u.origin!==canonicalOrigin)throw new SeoClientError('Canonical origin must be an exact HTTPS origin');expected=u.origin;}
 return {async product(id){if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new SeoClientError('Invalid UUID',400);id=id.toLowerCase();const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),timeoutMs);try{const r=await fetchImpl(base.origin+'/v1/projects/'+projectId+'/products/'+id+'/seo',{method:'GET',redirect:'error',headers:{Authorization:'Bearer '+token,Accept:'application/json'},cache:'no-store',signal:ac.signal});if(!r.ok){
 if(process.env.NODE_ENV==='development'){
  console.error(JSON.stringify({
   event:'seo_bridge_http_failed',
   status:r.status,
   host:base.hostname,
   port:base.port||(base.protocol==='https:'?'443':'80')
  }));
 }

 const message=r.status===404
  ?'Product not found'
  :process.env.NODE_ENV==='development'
   ?'SEO bridge unavailable; HTTP '+r.status
   :'SEO bridge unavailable';

 throw new SeoClientError(message,r.status===404?404:503);
}if(!r.headers.get('content-type')?.includes('application/json'))throw new SeoClientError('Invalid bridge response');const b=await r.json();if(b.status!=='ok'||b.sourceId!==id||!b.entity||!b.metadata||!b.metadata.robots||b.metadata.robots.index!==false)throw new SeoClientError('Invalid/unsafe bridge response');if(b.canonical){const c=new URL(b.canonical);if(!expected||c.origin!==expected||c.protocol!=='https:'||c.username||c.password||c.hash||c.search||!c.pathname.startsWith('/catalogue/products/'))throw new SeoClientError('Unexpected canonical URL');}if(b.metadata.alternates?.canonical!==(b.canonical||undefined))throw new SeoClientError('Canonical metadata mismatch');b.jsonLdSerialized=b.jsonLd?safeJsonLd(b.jsonLd):null;return b;}catch(e){
 if(e instanceof SeoClientError)throw e;

 if(process.env.NODE_ENV==='development'){
  console.error(JSON.stringify({
   event:'seo_bridge_request_failed',
   host:base.hostname,
   port:base.port||(base.protocol==='https:'?'443':'80'),
   protocol:base.protocol,
   errorName:e?.name||'Error',
   code:e?.cause?.code||e?.code||null,
   causes:Array.isArray(e?.cause?.errors)
    ?e.cause.errors.map(x=>({code:x.code||null}))
    :undefined
  }));
 }

 throw new SeoClientError('SEO bridge temporarily unavailable');
}finally{clearTimeout(timer);}}};}
