"use client";
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {balancedMenuColumns,menuPosition} from '@/lib/portrait-menu.mjs';
import styles from './ShoppingInteractions.module.css';
type Item={id:string;href:string;name:string;depth:number};
export function PortraitCategoryMenu({id,items,onNavigate}:{id:string;items:Item[];onNavigate:()=>void}){
 const panel=useRef<HTMLDivElement>(null),[position,setPosition]=useState<{left:number;top:number;maxHeight:number}|null>(null);
 const columns=balancedMenuColumns(items);
 useEffect(()=>{
  const element=panel.current,anchor=element?.parentElement;if(!element||!anchor)return;
  const place=()=>{const rect=anchor.getBoundingClientRect(),size=element.getBoundingClientRect();setPosition(menuPosition(rect,size,{width:window.innerWidth,height:window.innerHeight}));};
  place();const observer=new ResizeObserver(place);observer.observe(anchor);observer.observe(element);
  window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
  return()=>{observer.disconnect();window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);};
 },[items.length]);
 if(!columns.length)return null;
 return <div ref={panel} id={id} className={styles.submenu} style={{gridTemplateColumns:`repeat(${columns.length},minmax(180px,220px))`,...(position||{}),visibility:position?'visible':'hidden'}}>{columns.map((column,index)=><div className={styles.submenuColumn} key={index}>{column.map(child=><Link prefetch={false} key={child.id} href={child.href} style={{paddingInlineStart:12+child.depth*10}} onClick={onNavigate}>{child.name}</Link>)}</div>)}</div>;
}
