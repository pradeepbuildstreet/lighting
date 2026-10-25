"use client";
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {catalogueListStatus} from '@/lib/catalogue-list-status.mjs';
import styles from './CatalogueListing.module.css';
export default function CataloguePublishStatus({product}:{product:Record<string,any>}){
 const status=catalogueListStatus(product),[anchor,setAnchor]=useState<{left:number;top:number;above:boolean}|null>(null),id='publish-warning-'+product.id;
 useEffect(()=>{if(!anchor)return;const close=()=>setAnchor(null),key=(e:KeyboardEvent)=>{if(e.key==='Escape')close();};window.addEventListener('keydown',key);window.addEventListener('scroll',close,true);window.addEventListener('resize',close);return()=>{window.removeEventListener('keydown',key);window.removeEventListener('scroll',close,true);window.removeEventListener('resize',close);};},[anchor]);
 function show(el:HTMLElement){const r=el.getBoundingClientRect(),width=Math.min(360,window.innerWidth-24),above=r.top>window.innerHeight/2;setAnchor({left:Math.max(12,Math.min(r.left,window.innerWidth-width-12)),top:above?r.top-8:r.bottom+8,above});}
 return <><button type="button" className={styles.statusIcon+' '+styles[status.tone+'Icon']} aria-label={status.summary} aria-describedby={anchor?id:undefined} aria-expanded={!!anchor} onMouseEnter={e=>show(e.currentTarget)} onMouseLeave={()=>setAnchor(null)} onFocus={e=>show(e.currentTarget)} onBlur={()=>setAnchor(null)} onClick={e=>{if(anchor)setAnchor(null);else show(e.currentTarget);}}><span aria-hidden="true">{status.tone==='green'?'✓':status.tone==='amber'?'!':'○'}</span></button>{anchor&&createPortal(<aside id={id} role="tooltip" className={styles.tooltip} style={{left:anchor.left,top:anchor.top,transform:anchor.above?'translateY(-100%)':undefined}}><strong>{status.label}</strong><p>{product.is_active===false?'Inactive':'Active'} · Duplicate review: {product.review_status||'draft'}</p>{status.warnings.length?<ul>{status.warnings.map(w=><li key={w}>{w}</li>)}</ul>:<p>{product.published?'No warnings reported.':'Unpublished products are not available to customers.'}</p>}</aside>,document.body)}</>;
}
