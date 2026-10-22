"use client";
import {useState} from 'react';
import {safeMediaUrl} from '@/lib/catalogue-client';
import type {CatalogueProduct} from '@/lib/catalogue-types';
import {galleryItems,type GalleryItem} from '@/lib/product-details-model';
import styles from './ProductDetails.module.css';
function Asset({item}:{item:GalleryItem}){const [failed,setFailed]=useState(false);return <div className={styles.asset}>{failed?<div><p role="status">This media is currently unavailable.</p><button type="button" onClick={()=>setFailed(false)}>Retry media</button></div>:item.type==='image'?<img src={item.url} alt={item.alt} onError={()=>setFailed(true)}/>:<video src={item.url} poster={item.poster_url||undefined} controls playsInline preload="none" aria-label={item.caption||item.alt} onError={()=>setFailed(true)}/>}</div>;}
export function ProductMediaGallery({product}:{product:CatalogueProduct}){
 const media=galleryItems(product,{safeMediaUrl}),[selected,setSelected]=useState(media[0]?.id||'');
 const active=media.find(m=>m.id===selected)||media[0];
 if(!active)return <div className={styles.asset}><span>No product media supplied.</span></div>;
 return <section className={styles.gallery} aria-label="Product image and video gallery"><figure><Asset key={active.id} item={active}/>{active.caption&&<figcaption className={styles.caption}>{active.caption}</figcaption>}</figure>
 {media.length>1&&<div className={styles.thumbs} role="group" aria-label="Choose product media">{media.map((m,index)=><button key={m.id} type="button" aria-pressed={m.id===active.id} aria-label={'Show '+m.type+' '+(index+1)+(m.caption?': '+m.caption:'')} onClick={()=>setSelected(m.id)}>{m.type==='image'?<img src={m.url} alt="" loading="lazy"/>:<span>Video {index+1}</span>}</button>)}</div>}</section>;
}
