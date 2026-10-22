import {HomepageShowcase} from '@/components/HomepageShowcase';
import {pageMetadata} from '@/lib/website-pages/server';
import Link from 'next/link';
import type {Metadata} from 'next';
import {getCatalogueClient,categoryHref,safeMediaUrl} from '@/lib/catalogue-client';
import {buildGalleryItems} from '@/lib/home-gallery-model';
import {HomeCatalogueGallery} from '@/components/HomeCatalogueGallery';
import {homeState} from '@/lib/catalogue-route-model';
import {CatalogueProductCards} from '@/components/CatalogueProductCards';
export const dynamic='force-dynamic';
 const pageSourceMetadata:Metadata={title:'Luminoza | Beautiful lighting! Exuberant living!',description:'Browse the published Luminoza lighting catalogue by category.',robots:{index:false,follow:false}};
export default async function Home(){
 let state:ReturnType<typeof homeState>;try{const client=getCatalogueClient();const [categories,products]=await Promise.allSettled([client.categories(),client.list({sort:'newest',limit:100})]);state=homeState(categories,products);}catch(_){state=homeState({status:'rejected',reason:null},{status:'rejected',reason:null});}
 const gallery=buildGalleryItems(state.products,{safeMediaUrl},30);
 return <><HomeCatalogueGallery items={gallery}/><div className="container"><section className="py-16 text-center"><h1 className="text-5xl font-bold mb-4">Decorative Lighting</h1><p className="text-xl text-gray-600 mb-8">Explore fixture and light details in our published catalogue.</p><Link prefetch={false} href="/products" className="bg-accent text-white px-8 py-3 rounded-lg font-semibold hover:bg-opacity-90">Browse products</Link></section>
 <section className="py-12"><h2 className="text-3xl font-bold mb-8 text-center">Shop by Category</h2>{state.categoriesUnavailable?<p role="status">Categories are temporarily unavailable. <Link prefetch={false} href="/products">Browse all products</Link></p>:state.categories.length?<div className="grid grid-cols-1 sm:grid-cols-2 gap-6">{state.categories.map(c=><div key={c.id} className="home-category product-card bg-gray-100 rounded-lg p-6"><Link prefetch={false} href={categoryHref(c.path)}><h3 className="text-xl font-semibold mb-2">{c.name}</h3></Link><p className="text-gray-600">{c.product_count} eligible product{c.product_count===1?'':'s'} across this category</p>{c.description&&<p>{c.description}</p>}</div>)}</div>:<p>No public categories are available yet.</p>}</section>
 <HomepageShowcase/><section className="py-12"><h2 className="text-3xl font-bold mb-8">Latest catalogue products</h2>{state.productsUnavailable?<p role="status">Products are temporarily unavailable. Please try again.</p>:state.products.length?<CatalogueProductCards products={state.products.slice(0,12)}/>:<p>No products are currently eligible for public display.</p>}</section>
</div></>;
}

export async function generateMetadata(){return pageMetadata(pageSourceMetadata,'/');}
