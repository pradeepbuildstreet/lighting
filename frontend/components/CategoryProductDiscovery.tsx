import {getApiBaseUrl} from '@/lib/api-base';
import {decode,categoryHref} from '@/lib/catalogue-core';
import type {CatalogueProduct} from '@/lib/catalogue-types';
import {CatalogueProductCards} from './CatalogueProductCards';
import Link from 'next/link';
import styles from './CategoryProductDiscovery.module.css';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function CategoryProductDiscovery({productId}:{productId:string}){
 if(!UUID.test(productId))return null;
 let popular:CatalogueProduct[],latest:CatalogueProduct[],category:{id:string;name:string;path:string};
 try{
  const response=await fetch(`${getApiBaseUrl()}/catalogue/products/id/${encodeURIComponent(productId)}/discovery`,{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Discovery unavailable');
  const data=await response.json();
  if(data.source!=='catalogue'||data.product_id!==productId||!Array.isArray(data.most_enquired)||!Array.isArray(data.latest)||data.most_enquired.length>6||data.latest.length>6)throw Error('Invalid discovery response');
  if(data.category===null){if(data.most_enquired.length||data.latest.length)throw Error('Missing category');return null;}
  if(!data.category||!UUID.test(data.category.id)||typeof data.category.name!=='string'||!data.category.name.trim()||data.category.name.length>255||typeof data.category.path!=='string')throw Error('Invalid discovery category');
  categoryHref(data.category.path);category=data.category;
  if(data.most_enquired.some((p:{enquiry_count?:unknown})=>!Number.isSafeInteger(p.enquiry_count)||Number(p.enquiry_count)<=0))throw Error('Invalid enquiry counts');
  popular=data.most_enquired.map(decode.product);latest=data.latest.map(decode.product);
  const all=[...popular,...latest];
  if(new Set(all.map(p=>p.id)).size!==all.length||all.some(p=>p.id===productId||!p.categories.some(c=>c.id===category.id)))throw Error('Invalid discovery membership');
 }catch(_){return <p className={styles.notice} role="status">Category discoveries are temporarily unavailable.</p>;}
 if(!popular.length&&!latest.length)return null;
 return <div className={styles.root}>
  {!!popular.length&&<section aria-label="Most enquired in this category"><div className={styles.heading}><h2>Most enquired in this category</h2><Link href={categoryHref(category.path)}>Browse {category.name}</Link></div><p className={styles.description}>Ranked by distinct submitted customer enquiries.</p><CatalogueProductCards products={popular} browseCategory={category.path}/></section>}
  {!!latest.length&&<section aria-label="Latest in this category"><div className={styles.heading}><h2>Latest in this category</h2><Link href={categoryHref(category.path)}>Browse {category.name}</Link></div><CatalogueProductCards products={latest} browseCategory={category.path}/></section>}
 </div>;
}
