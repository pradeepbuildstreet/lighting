"use client";
import {useState} from 'react';
import {ZoomableImage} from './ZoomableImage';
import styles from './CatalogueListing.module.css';
export function ProductThumbnail({url,alt}:{url?:string;alt:string}){const [failed,setFailed]=useState(false);return <div className={styles.thumb}>{url&&!failed?<ZoomableImage src={url} alt={alt} loading="lazy" onError={()=>setFailed(true)}/>:<span>No image available</span>}</div>;}
