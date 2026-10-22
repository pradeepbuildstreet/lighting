import type {Metadata} from 'next';
import {notFound,redirect} from 'next/navigation';
import {CatalogueError,getCatalogueClient,productHref} from '@/lib/catalogue-client';
export const dynamic='force-dynamic';
export const metadata:Metadata={robots:{index:false,follow:false}};
export default async function ProductIdentityPage({params}:{params:{id:string}}){
 let sku:string;
 try{sku=(await getCatalogueClient().byId(params.id)).product.sku;}
 catch(e){if(e instanceof CatalogueError&&['not_found','invalid_request'].includes(e.code))notFound();throw e;}
 redirect(productHref(sku));
}
