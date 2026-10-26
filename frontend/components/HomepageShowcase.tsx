import Link from 'next/link';
import {getApiBaseUrl} from '@/lib/api-base';
import {safeMediaUrl} from '@/lib/catalogue-client';
import {CatalogueProductCards} from './CatalogueProductCards';
import {ProductThumbnail} from './ProductThumbnail';
import type {HomepageData} from '@/lib/homepage-types';
import styles from './HomeShopping.module.css';
export async function HomepageShowcase(){
 let data:HomepageData;try{const response=await fetch(`${getApiBaseUrl()}/homepage`,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)return null;data=await response.json();if(!Array.isArray(data.products)||!Array.isArray(data.collections))return null;}catch(_){return null;}
 const popular=data.products.filter(p=>p&&Number.isSafeInteger(p.enquiry_count)&&p.enquiry_count>0);
 return <>{!!data.collections.length&&<section className={styles.section} aria-labelledby="curated-collections"><h2 id="curated-collections">Explore our collections</h2><div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">{data.collections.map(c=>{const image=c.cover?.media.find(m=>m.type==='image'&&m.primary)||c.cover?.media.find(m=>m.type==='image');return <Link prefetch={false} href={'/product-collections/'+encodeURIComponent(c.slug)} key={c.slug} className="product-result-link product-result-card"><ProductThumbnail url={safeMediaUrl(image?.url)||undefined} alt={image?.alt||c.title}/><div className="p-6"><h3 className="text-xl font-semibold">{c.title}</h3>{c.description&&<p>{c.description}</p>}<p>{c.product_count} products · Explore collection</p></div></Link>;})}</div></section>}
 {!!popular.length&&<section className={styles.section} aria-labelledby="popular-products"><div className={styles.sectionHead}><h2 id="popular-products">Most enquired products</h2><Link href="/products">Browse all products</Link></div><p>Based on submitted customer enquiries.</p><CatalogueProductCards products={popular} maxRows={3}/></section>}</>;
}
