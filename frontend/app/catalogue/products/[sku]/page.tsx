import {withTechnicalMetadata} from '@/lib/seo-delivery/server';
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {cache} from 'react';
import {getCatalogueClient,CatalogueError} from '@/lib/catalogue-client';
import {CatalogueProductDetails} from '@/components/CatalogueProductDetails';
import {productSeo} from '@/lib/seo-bridge';
import {safeJsonLd,SeoClientError} from '@/lib/seo-bridge-client.mjs';
export const dynamic='force-dynamic';
const load=cache(async(sku:string)=>{const client=getCatalogueClient();let product;try{product=(await client.bySku(sku)).product;}catch(e){if(e instanceof CatalogueError&&e.code==='invalid_request')notFound();if(e instanceof CatalogueError&&e.code==='not_found'){try{await client.list({limit:1});}catch(_){throw new Error('Catalogue temporarily unavailable');}notFound();}throw e;}let seo;try{seo=await productSeo(product);}catch(e){if(e instanceof SeoClientError&&e.status===404)notFound();throw e;}return {product,seo};});
type Props={params:{sku:string}};
 async function seoOriginalGenerateMetadata({params}:Props):Promise<Metadata>{const {product,seo}=await load(params.sku);return seo?seo.metadata:{title:product.seo.title||product.name+' | Luminoza',description:product.seo.description||product.description||undefined,robots:{index:false,follow:false}};}
export default async function ProductPage({params}:Props){const {product,seo}=await load(params.sku);return <><CatalogueProductDetails product={product}/>{seo?.jsonLd&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd(seo.jsonLd)}}/>}</>;}

export async function generateMetadata(...args:Parameters<typeof seoOriginalGenerateMetadata>){const base=await seoOriginalGenerateMetadata(...args);const params=await args[0].params;return withTechnicalMetadata(base,params.sku);}
