import {pageMetadata} from '@/lib/website-pages/server';
import type {Metadata} from 'next';
import {CatalogueListingPage} from '@/components/CatalogueListingPage';
export const dynamic='force-dynamic';
 const pageSourceMetadata:Metadata={title:'Lighting category | Luminoza',robots:{index:false,follow:false}};
export default function CategoryPage({params,searchParams}:{params:{slug:string[]};searchParams:Record<string,string|string[]|undefined>}){return <CatalogueListingPage searchParams={searchParams} categorySegments={params.slug}/>;}

export async function generateMetadata({params}:{params:{slug:string[]}}){return pageMetadata(pageSourceMetadata,'/categories/'+params.slug.map(encodeURIComponent).join('/'));}
