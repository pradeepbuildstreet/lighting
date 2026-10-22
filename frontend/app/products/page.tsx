import type {Metadata} from 'next';
import {CatalogueListingPage} from '@/components/CatalogueListingPage';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Lighting products | Luminoza',robots:{index:false,follow:false}};
export default function ProductsPage({searchParams}:{searchParams:Record<string,string|string[]|undefined>}){return <CatalogueListingPage searchParams={searchParams}/>;}
