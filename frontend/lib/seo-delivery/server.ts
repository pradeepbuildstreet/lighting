import 'server-only';
import type {Metadata,MetadataRoute} from 'next';
import {loadState,effectiveProduct,resolveRedirect,sitemapEntries,canIndex} from './delivery-core.mjs';
import {POLICY_PATH} from './location';
const enabled=()=>process.env.SEO_DELIVERY_ENABLE_INDEXING==='true';
export async function withTechnicalMetadata(base:Metadata,sku:string):Promise<Metadata>{
 if(process.env.SEO_INTEGRATION_DISABLED==='true'){ return base; }

 const prior=typeof base.robots==='object'&&base.robots?base.robots:{};
 let result:Metadata={...base,robots:{...prior,index:false}};
 try{const state=await loadState(POLICY_PATH);const p=await effectiveProduct(state,sku);if(!p)return result;
  const index=p.activationApproved&&!p.rule.noindex&&canIndex(p.current,(prior as {index?:boolean}).index===true,enabled());
  result={...base,robots:{...prior,index}};
  if(p.rule.canonical)result.alternates={...base.alternates,canonical:p.siteOrigin+'/catalogue/products/'+encodeURIComponent(sku)};
  return result;
 }catch{return result;}
}
export async function deliverySitemap():Promise<MetadataRoute.Sitemap>{
 if(process.env.SEO_INTEGRATION_DISABLED==='true'){ return []; }

 try{return await sitemapEntries(await loadState(POLICY_PATH),enabled());}catch{throw new Error('Fresh sitemap eligibility verification failed');}
}
export async function deliveryRobots():Promise<MetadataRoute.Robots>{
 if(process.env.SEO_INTEGRATION_DISABLED==='true'){ return {rules:{userAgent:'*',disallow:'/'}}; }

 try{const s=await loadState(POLICY_PATH),entries=await sitemapEntries(s,enabled());if(entries.length&&s?.approved)return {rules:{userAgent:'*',allow:'/',disallow:['/admin/']},sitemap:s.approved.plan.siteOrigin+'/sitemap.xml'};}catch{}
 return {rules:{userAgent:'*',disallow:'/'}};
}
export async function deliveryResolve(pathname:string){
 if(process.env.SEO_INTEGRATION_DISABLED==='true'){ return null; }
try{return await resolveRedirect(await loadState(POLICY_PATH),pathname);}catch{return null;}}
