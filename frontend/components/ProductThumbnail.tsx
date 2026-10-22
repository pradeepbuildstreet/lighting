"use client";
import {useState} from 'react';
import styles from './CatalogueListing.module.css';
export function ProductThumbnail({url,alt}:{url?:string;alt:string}){const [failed,setFailed]=useState(false);return <div className={styles.thumb}>{url&&!failed?<img src={url} alt={alt} loading="lazy" onError={()=>setFailed(true)}/>:<span>No image available</span>}</div>;}
