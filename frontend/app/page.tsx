import {HomepageShowcase} from '@/components/HomepageShowcase';
import {pageMetadata} from '@/lib/website-pages/server';
import Link from 'next/link';
import type {Metadata} from 'next';
import {getCatalogueClient,categoryHref,safeMediaUrl} from '@/lib/catalogue-client';
import {buildGalleryItems} from '@/lib/home-gallery-model';
import {getHomeCategoryTiles} from '@/lib/home-category-tiles';
import {HomeCatalogueGallery} from '@/components/HomeCatalogueGallery';
import {homeState} from '@/lib/catalogue-route-model';
import {CatalogueProductCards} from '@/components/CatalogueProductCards';
import styles from '@/components/HomeShopping.module.css';
export const dynamic='force-dynamic';
const pageSourceMetadata:Metadata={title:'Luminoza | Beautiful lighting! Exuberant living!',description:'Browse the published Luminoza lighting catalogue by category.',robots:{index:false,follow:false}};
export default async function Home(){
 let state:ReturnType<typeof homeState>;
 let categories:Awaited<ReturnType<typeof getHomeCategoryTiles>>['categories']=[];
 try{const client=getCatalogueClient();const [categoryResult,products]=await Promise.allSettled([getHomeCategoryTiles(),client.list({sort:'newest',limit:100})]);state=homeState(categoryResult,products);if(categoryResult.status==='fulfilled')categories=categoryResult.value.categories;}catch(_){state=homeState({status:'rejected',reason:null},{status:'rejected',reason:null});}
 const gallery=buildGalleryItems(state.products,{safeMediaUrl},30);
 return <><HomeCatalogueGallery items={gallery}/><div className={styles.shell}>
 <section className={`${styles.section} ${styles.categorySection}`} aria-labelledby="home-categories-heading"><h2 id="home-categories-heading">Shop By Categories</h2>{state.categoriesUnavailable?<p role="status">Categories are temporarily unavailable. <Link prefetch={false} href="/products">Browse all products</Link></p>:categories.length?<div className={styles.categories}>{categories.map(c=><Link prefetch={false} href={categoryHref(c.path)} key={c.id} className={styles.category}><div className={styles.categoryImage}>{c.image?<img src={c.image.url} alt="" loading="lazy" width={300} height={300}/>:<span className={styles.categoryPlaceholder}>Image coming soon</span>}</div><h3>{c.name}</h3></Link>)}</div>:<p>No public categories with products are available yet.</p>}</section>
 <HomepageShowcase/><section className={styles.section}><div className={styles.sectionHead}><h2>Latest catalogue products</h2><Link href="/products?sort=newest">View all latest products</Link></div>{state.productsUnavailable?<p role="status">Products are temporarily unavailable. Please try again.</p>:state.products.length?<CatalogueProductCards products={state.products.slice(0,18)} maxRows={3}/>:<p>No products are currently eligible for public display.</p>}</section>
 </div></>;
}
export async function generateMetadata(){return pageMetadata(pageSourceMetadata,'/');}
