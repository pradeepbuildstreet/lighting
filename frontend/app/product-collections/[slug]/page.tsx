import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getApiBaseUrl} from '@/lib/api-base';
import {CatalogueProductCards} from '@/components/CatalogueProductCards';
import type {CatalogueProduct} from '@/lib/catalogue-types';
export const dynamic='force-dynamic';
export const metadata={title:'Lighting collection | Luminoza',robots:{index:false,follow:false}};
export default async function CollectionPage({params,searchParams}:{params:{slug:string};searchParams:{page?:string}}){
 const raw=searchParams.page||'1';if(!/^[1-9]\d{0,2}$/.test(raw)||!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(params.slug))notFound();
 let data:{collection:{title:string;description:string};products:CatalogueProduct[];pagination:{page:number;pages:number;total:number}};
 let response:Response;
 try{response=await fetch(`${getApiBaseUrl()}/homepage/collections/${encodeURIComponent(params.slug)}?page=${raw}`,{cache:'no-store',signal:AbortSignal.timeout(15000)});}catch(_){return <div className="container py-12"><p role="status">Collection temporarily unavailable. Please try again.</p></div>;}
 if(response.status===404)notFound();if(!response.ok)return <div className="container py-12"><h1>Collection temporarily unavailable</h1><Link href="/products">Browse products</Link></div>;
 try{data=await response.json();}catch(_){return <div className="container py-12"><p>Collection temporarily unavailable.</p></div>;}
 if(data.pagination.pages>0&&Number(raw)>data.pagination.pages)notFound();
 const href=(page:number)=>'/product-collections/'+encodeURIComponent(params.slug)+'?page='+page;
 return <div className="container py-12"><Link href="/">Home</Link><h1 className="text-3xl font-bold my-6">{data.collection.title}</h1>{data.collection.description&&<p className="mb-6">{data.collection.description}</p>}{data.products.length?<CatalogueProductCards products={data.products}/>:<p>No products are currently available in this collection.</p>}<nav className="flex gap-6 my-8" aria-label="Collection pages">{data.pagination.page>1&&<Link href={href(data.pagination.page-1)}>Previous</Link>}<span>Page {data.pagination.page} of {Math.max(1,data.pagination.pages)}</span>{data.pagination.page<data.pagination.pages&&<Link href={href(data.pagination.page+1)}>Next</Link>}</nav><p>Shortlist products and send an enquiry for a personalised offer.</p></div>;
}
