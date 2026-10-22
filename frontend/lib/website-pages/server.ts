import 'server-only';import {cache} from 'react';import type {Metadata} from 'next';
import {byPath} from './pages-core.mjs';import {PAGE_CONFIG} from './location';
export const pageData=cache(async(pathname:string)=>byPath(PAGE_CONFIG,pathname));
export async function pageMetadata(base:Metadata,pathname:string):Promise<Metadata>{
 if(process.env.SEO_INTEGRATION_DISABLED==='true'){ return base; }

 const prior=typeof base.robots==='object'&&base.robots?base.robots:{};
 try{const data=await pageData(pathname);const seo=data.delivery?.effective;if(data.state!=='published'||!seo)return {...base,robots:{...prior,index:false}};
 return {...base,title:seo.seoTitle,description:seo.metaDescription||undefined,robots:{...prior,index:false},alternates:seo.canonical?{...base.alternates,canonical:PAGE_CONFIG.siteOrigin+pathname}:base.alternates,openGraph:{...base.openGraph,title:seo.ogTitle||seo.seoTitle,description:seo.ogDescription||seo.metaDescription||undefined}};
 }catch{return {...base,robots:{...prior,index:false}};}
}
