"use client";
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {tagProductEditorHref} from '@/lib/admin-tag-product-entry.mjs';
type Row=Record<string,any>;
export default function CatalogueProductForm({product}:{product:Row;[key:string]:any}){
 const router=useRouter();let href:string|null=null;
 try{href=tagProductEditorHref(product.id);}catch(_){}
 useEffect(()=>{if(href)router.replace(href);},[href,router]);
 return href?<p role="status">Opening the product editor… <a href={href}>Continue to editor</a></p>:<p role="alert">Invalid product ID. Return to the product list and reload.</p>;
}
