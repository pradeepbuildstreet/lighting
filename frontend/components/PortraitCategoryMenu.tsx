"use client";
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {menuPosition} from '@/lib/portrait-menu.mjs';
import styles from './ShoppingInteractions.module.css';
type Item={id:string;href:string;name:string;depth:number;count?:number};
export function PortraitCategoryMenu({id,items,onNavigate}:{id:string;items:Item[];onNavigate:()=>void}){
 const panel=useRef<HTMLDivElement>(null),[position,setPosition]=useState<{left:number;top:number;maxHeight:number}|null>(null);
 useEffect(()=>{const element=panel.current,anchor=element?.parentElement;if(!element||!anchor)return;const place=()=>setPosition(menuPosition(anchor.getBoundingClientRect(),element.getBoundingClientRect(),{width:window.innerWidth,height:window.innerHeight}));place();const observer=new ResizeObserver(place);observer.observe(anchor);observer.observe(element);window.addEventListener('resize',place);window.addEventListener('scroll',place,true);return()=>{observer.disconnect();window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);};},[items.length]);
 if(!items.length)return null;
 return <div ref={panel} id={id} className={styles.submenu} style={{gridTemplateColumns:'minmax(0,1fr)',width:240,...(position||{}),visibility:position?'visible':'hidden'}}><div className={styles.submenuColumn}>{items.map(child=><Link prefetch={false} key={child.id} href={child.href} style={{paddingInlineStart:12+child.depth*10}} onClick={onNavigate}><span>{child.name}</span>{child.count!==undefined&&<small aria-label={`${child.count} products`}> ({child.count})</small>}</Link>)}</div></div>;
}
