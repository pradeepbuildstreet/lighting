import {validateConfig,optional,request,OptionalSeoError} from './transport.mjs';
import {assertProductMatches,safeJsonLd} from '../seo-bridge-client.mjs';
const text=(x,max)=>typeof x==='string'&&x.length<=max;
export function validateBundle(b,p,config){
 if(!b||b.status!=='ok'||b.projectId!==config.projectId||b.sourceId!==p.id||String(b.sourceRevision)!==String(p.revision)||!Number.isSafeInteger(b.projectRevision)||b.projectRevision<1)throw new OptionalSeoError('BUNDLE_IDENTITY');
 if(!b.approval||typeof b.approval.overrideApplied!=='boolean'||String(b.approval.sourceRevision)!==String(p.revision)||b.approval.projectRevision!==b.projectRevision)throw new OptionalSeoError('APPROVAL_CONTRACT');
 assertProductMatches(b,p);
 const m=b.metadata;if(!m||!text(m.title,1000)||!m.robots||m.robots.index!==false||typeof m.robots.follow!=='boolean'||m.description!==undefined&&!text(m.description,4000))throw new OptionalSeoError('METADATA_CONTRACT');
 if(!b.approval.overrideApplied){if(m.title!==(p.seo?.title||p.name)||(m.description||null)!==(p.seo?.description||p.description||null))throw new OptionalSeoError('UNAPPROVED_OVERRIDE');}
 if(b.canonical!==null){if(typeof b.canonical!=='string'||!config.canonicalOrigin||b.canonical!==config.canonicalOrigin+'/catalogue/products/'+encodeURIComponent(p.sku))throw new OptionalSeoError('CANONICAL_CONTRACT');}
 if(m.alternates?.canonical!==(b.canonical||undefined))throw new OptionalSeoError('CANONICAL_CONTRACT');
 // Validate emitted social values, then copy only the supported original engine shape.
 const metadata={title:m.title,robots:{index:false,follow:m.robots.follow}};
 if(m.description!==undefined)metadata.description=m.description;
 if(b.canonical)metadata.alternates={canonical:b.canonical};
 if(m.openGraph){const g=m.openGraph;if(g.type!=='website'||g.title!==m.title||g.description!==m.description||g.url!==undefined&&g.url!==b.canonical)throw new OptionalSeoError('SOCIAL_CONTRACT');metadata.openGraph={type:'website',title:g.title};if(g.description!==undefined)metadata.openGraph.description=g.description;if(g.url)metadata.openGraph.url=g.url;if(g.images){if(!Array.isArray(g.images)||g.images.length>30||g.images.some(x=>!x||typeof x.url!=='string'||!/^https:\/\//.test(x.url)))throw new OptionalSeoError('SOCIAL_CONTRACT');metadata.openGraph.images=g.images.map(x=>({url:x.url}));}}
 if(m.twitter){const t=m.twitter;if(!['summary','summary_large_image'].includes(t.card)||t.title!==m.title||t.description!==m.description)throw new OptionalSeoError('SOCIAL_CONTRACT');metadata.twitter={card:t.card,title:t.title};if(t.description!==undefined)metadata.twitter.description=t.description;if(t.images){if(!Array.isArray(t.images)||t.images.length>30||t.images.some(x=>typeof x!=='string'||!/^https:\/\//.test(x)))throw new OptionalSeoError('SOCIAL_CONTRACT');metadata.twitter.images=[...t.images];}}
 if(b.jsonLd!==null&&(typeof b.jsonLd!=='object'||Array.isArray(b.jsonLd)))throw new OptionalSeoError('SCHEMA_CONTRACT');
 const serialized=b.jsonLd?safeJsonLd(b.jsonLd):null;
 return {...b,metadata,jsonLdSerialized:serialized};
}
export async function optionalProductSeo(product,options={}){return optional(async()=>{const config=validateConfig(options.env);if(!config)return null;const b=await request(config,'products/'+product.id+'/seo',{},options);return validateBundle(b,product,config);},options);}
export async function loadProductWithOptionalSeo(sku,{loadCatalogue,seoForProduct=optionalProductSeo,onError}={}){
 // Catalogue errors are intentionally outside the optional SEO boundary.
 const product=await loadCatalogue(sku);
 const seo=await optional(()=>seoForProduct(product),{onError});return {product,seo};
}
export function baselineProductMetadata(product){return {title:product.seo?.title||product.name+' | Luminoza',description:product.seo?.description||product.description||undefined,robots:{index:false,follow:false}};}
