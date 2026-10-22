"use client";
import Link from 'next/link';
import {useState} from 'react';
import {productHref} from '@/lib/catalogue-client';
import type {HomeGalleryItem} from '@/lib/home-gallery-model';
function Tile({item,index}:{item:HomeGalleryItem;index:number}){const [failed,setFailed]=useState(false);return <Link prefetch={false} href={productHref(item.sku)} className="home-random-gallery-item" aria-label={'View '+item.name}>{failed?<span className="flex items-center justify-center h-full p-2 text-xs">Image unavailable: {item.name}</span>:<img src={item.url} alt={item.alt} loading={index<10?'eager':'lazy'} onError={()=>setFailed(true)}/>}</Link>;}
export function HomeCatalogueGallery({items}:{items:HomeGalleryItem[]}){if(!items.length)return null;return <div className="home-random-gallery" aria-label="Lighting product gallery">{items.map((item,index)=><Tile key={item.key} item={item} index={index}/>)}</div>;}
