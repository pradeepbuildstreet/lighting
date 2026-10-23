"use client";
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {Fragment,Suspense,useEffect,useState} from 'react';
import {getCatalogueClient,categoryHref} from '@/lib/catalogue-client';
import type {CatalogueCategory,CatalogueProduct} from '@/lib/catalogue-types';
import {resolveBrowseTrail,safeReturnTo} from '@/lib/catalogue-browse-context.mjs';
import styles from './ProductDetails.module.css';
type Props={productId:string;revision:string;name:string;categories:CatalogueProduct['categories']};
function Trail({name,trail,back}:{name:string;trail:{id:string;name:string;path:string}[];back?:string|null}){return <><nav aria-label="Breadcrumb"><ol className={styles.breadcrumb}><li><Link href="/">Home</Link></li><li aria-hidden="true">/</li><li><Link href="/products">Products</Link></li>{trail.map(c=><Fragment key={c.id}><li aria-hidden="true">/</li><li><Link href={categoryHref(c.path)}>{c.name}</Link></li></Fragment>)}<li aria-hidden="true">/</li><li aria-current="page">{name}</li></ol></nav>{back&&<p className="mb-4"><Link prefetch={false} href={back}>Back to results</Link></p>}</>;}
function DynamicBreadcrumbs(props:Props){
 const params=useSearchParams();const [tree,setTree]=useState<CatalogueCategory[]>([]);
 useEffect(()=>{const ac=new AbortController();let active=true;setTree([]);try{getCatalogueClient().categories({signal:ac.signal}).then(data=>{if(active)setTree(data.categories);}).catch(()=>{});}catch(_){}return()=>{active=false;ac.abort();};},[props.productId,props.revision]);
 const requested=params.getAll('browse').length===1?params.get('browse'):null;
 const back=params.getAll('returnTo').length===1?safeReturnTo(params.get('returnTo')):null;
 return <Trail name={props.name} trail={resolveBrowseTrail(tree,props.categories,requested)} back={back}/>;
}
export function ProductBreadcrumbs(props:Props){return <Suspense fallback={<Trail name={props.name} trail={resolveBrowseTrail([],props.categories,null)}/>}><DynamicBreadcrumbs {...props}/></Suspense>;}
