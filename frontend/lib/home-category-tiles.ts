import {getApiBaseUrl} from './api-base';
import {categoryHref,safeMediaUrl} from './catalogue-client';
export type HomeCategoryTile={id:string;name:string;path:string;product_count:number;image:{url:string;alt:string}|null};
export async function getHomeCategoryTiles():Promise<{categories:HomeCategoryTile[]}>{
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch(getApiBaseUrl()+'/catalogue/home-categories',{cache:'no-store',headers:{Accept:'application/json'},signal:controller.signal});
  if(!response.ok)throw new Error('Homepage categories unavailable');
  const data=await response.json();
  if(data?.source!=='catalogue'||!Array.isArray(data.categories)||data.categories.length>5000)throw new Error('Invalid homepage categories');
  const seen=new Set<string>();
  const categories:HomeCategoryTile[]=data.categories.map((value:unknown)=>{
   if(!value||typeof value!=='object')throw new Error('Invalid category tile');
   const c=value as Record<string,unknown>;
   if(typeof c.id!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c.id)||seen.has(c.id)||typeof c.name!=='string'||!c.name.trim()||c.name.length>255||typeof c.path!=='string'||typeof c.product_count!=='number'||!Number.isSafeInteger(c.product_count)||c.product_count<1)throw new Error('Invalid category tile');
   categoryHref(c.path);seen.add(c.id);
   let image:HomeCategoryTile['image']=null;
   if(c.image!==null){
    if(!c.image||typeof c.image!=='object')throw new Error('Invalid category image');
    const raw=c.image as Record<string,unknown>,url=typeof raw.url==='string'?safeMediaUrl(raw.url):null;
    if(!url||typeof raw.alt!=='string'||raw.alt.length>2000)throw new Error('Invalid category image');
    image={url,alt:raw.alt};
   }
   return {id:c.id,name:c.name,path:c.path,product_count:c.product_count,image};
  });
  return {categories};
 }finally{clearTimeout(timer);}
}
