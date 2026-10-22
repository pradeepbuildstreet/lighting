import type {Metadata} from 'next';
import {CatalogueRouteTransition} from '@/components/CatalogueRouteTransition';
export const dynamic='force-dynamic';
export const metadata:Metadata={robots:{index:false,follow:false}};
export default function AliasPage({params}:{params:{sku:string}}){return <CatalogueRouteTransition value={params.sku}/>;}
