"use client";
import {useState} from 'react';
import {ZoomableImage} from './ZoomableImage';
import {wishlistImage, type WishlistMedia as Media} from '@/lib/wishlist-product';
export function WishlistMedia({item}:{item:{name:string;image_url?:string|null;media?:Media[]}}){
 const [failed,setFailed]=useState(false),image=wishlistImage(item),video=item.media?.find(m=>m.type==='video');
 if(failed)return <span>Media unavailable</span>;
 if(image)return <ZoomableImage src={image} alt={item.name} loading="lazy" onError={()=>setFailed(true)}/>;
 if(video)return <video src={video.url} controls preload="metadata" aria-label={item.name} onClick={e=>e.stopPropagation()} onError={()=>setFailed(true)}/>;
 return <span>No image</span>;
}
