import {HomepageShowcase} from '@/components/HomepageShowcase';
import {pageMetadata} from '@/lib/website-pages/server';
import Link from 'next/link';
import type {Metadata} from 'next';
import {getCatalogueClient,categoryHref,safeMediaUrl} from '@/lib/catalogue-client';
import {buildGalleryItems} from '@/lib/home-gallery-model';
import {categoryTileImages} from '@/lib/category-tile-image.mjs';
import {HomeCatalogueGallery} from '@/components/HomeCatalogueGallery';
import {homeState} from '@/lib/catalogue-route-model';
import {CatalogueProductCards} from '@/components/CatalogueProductCards';
import styles from '@/components/HomeShopping.module.css';
export const dynamic='force-dynamic';
const pageSourceMetadata:Metadata={title:'Luminoza | Beautiful lighting! Exuberant living!',description:'Browse the published Luminoza lighting catalogue by category.',robots:{index:false,follow:false}};
export default async function Home(){
 let state:ReturnType<typeof homeState>;try{const client=getCatalogueClient();const [categories,products]=await Promise.allSettled([client.categories(),client.list({sort:'newest',limit:100})]);state=homeState(categories,products);}catch(_){state=homeState({status:'rejected',reason:null},{status:'rejected',reason:null});}
 const gallery=buildGalleryItems(state.products,{safeMediaUrl},30);
 const categoryImages=await categoryTileImages(state.categories,state.products,safeMediaUrl,c=>getCatalogueClient().list({category:c.path.split('/').at(-1),sort:'newest',limit:1}).then(data=>data.products));
 return <><HomeCatalogueGallery items={gallery}/><div className={styles.shell}>
 <section className={styles.section}><h2>Shop by Category</h2>{state.categoriesUnavailable?<p role="status">Categories are temporarily unavailable. <Link prefetch={false} href="/products">Browse all products</Link></p>:state.categories.length?<div className={styles.categories}>{state.categories.map((c,index)=>{const image=categoryImages[index];return <Link prefetch={false} href={categoryHref(c.path)} key={c.id} className={styles.category}><div><h3>{c.name} ({c.product_count})</h3>{c.description&&<p>{c.description}</p>}<span>Explore category →</span></div>{image&&<img src={image.url} alt={image.alt} loading="lazy" width={170} height={130}/>}</Link>;})}</div>:<p>No public categories are available yet.</p>}</section>
 <HomepageShowcase/><section className={styles.section}><div className={styles.sectionHead}><h2>Latest catalogue products</h2><Link href="/products?sort=newest">View all latest products</Link></div>{state.productsUnavailable?<p role="status">Products are temporarily unavailable. Please try again.</p>:state.products.length?<CatalogueProductCards products={state.products.slice(0,18)} maxRows={3}/>:<p>No products are currently eligible for public display.</p>}</section>
 </div></>;
}
export async function generateMetadata(){return pageMetadata(pageSourceMetadata,'/');}
