"use client";
import {createContext,useContext,useEffect,useState} from 'react';
import type {ReactNode} from 'react';
import {getApiBaseUrl} from '@/lib/api-base';
import {formatPrice} from '@/lib/catalogue-client';
import styles from './ProductPrice.module.css';
type Price={id:string;currency:string;list_price:string;default_discount_percent:string;discounted_price:string};
type State={key:string;loading:boolean;prices:Record<string,Price>};
const Context=createContext<State>({key:'',loading:true,prices:{}});
const money=/^(0|[1-9]\d{0,11})(\.\d{1,2})?$/;
export function ProductPricesProvider({productIds,children}:{productIds:string[];children:ReactNode}){
 const key=JSON.stringify([...new Set(productIds)].sort());
 const [state,setState]=useState<State>({key:'',loading:true,prices:{}});
 useEffect(()=>{
  const ids=JSON.parse(key) as string[],controller=new AbortController();let live=true;
  setState({key,loading:true,prices:{}});
  const timer=setTimeout(()=>controller.abort(),15000);
  async function load(){
   const chunks:string[][]=[];for(let i=0;i<ids.length;i+=100)chunks.push(ids.slice(i,i+100));
   const groups=await Promise.all(chunks.map(async chunk=>{
    const response=await fetch(getApiBaseUrl()+'/catalogue/prices?'+new URLSearchParams({ids:chunk.join(',')}),{credentials:'same-origin',cache:'no-store',signal:controller.signal});
    if(!response.ok)throw Error('Price unavailable');const data=await response.json();if(!Array.isArray(data.prices)||data.prices.length>chunk.length)throw Error('Invalid prices');
    const seen=new Set<string>();
    return data.prices.map((p:Price)=>{if(!p||!chunk.includes(p.id)||seen.has(p.id)||!/^[A-Z]{3}$/.test(p.currency)||!money.test(p.list_price)||!money.test(p.discounted_price)||!/^(0|[1-9]\d{0,2})(\.\d{1,2})?$/.test(p.default_discount_percent)||Number(p.default_discount_percent)>100||Number(p.discounted_price)>Number(p.list_price))throw Error('Invalid price');seen.add(p.id);return p;});
   }));
   if(live)setState({key,loading:false,prices:Object.fromEntries(groups.flat().map(p=>[p.id,p]))});
  }
  void load().catch(()=>{if(live)setState({key,loading:false,prices:{}});}).finally(()=>clearTimeout(timer));
  return()=>{live=false;controller.abort();clearTimeout(timer);};
 },[key]);
 return <Context.Provider value={state.key===key?state:{key,loading:true,prices:{}}}>{children}</Context.Provider>;
}
export function ProductPrice({productId,compact=false}:{productId:string;compact?:boolean}){
 const {loading,prices}=useContext(Context),p=prices[productId],className=compact?`${styles.price} ${styles.compact}`:styles.price;
 if(loading)return <span className={className} aria-busy="true" aria-label="Loading price"><span className={styles.loading}>Loading price…</span></span>;
 if(!p)return <span className={className}><span className={styles.unavailable}>Price unavailable</span></span>;
 const discount=Number(p.default_discount_percent);
 return <span className={className}>{discount>0?<><del className={styles.original} aria-label={'List price '+formatPrice(p.list_price,p.currency)}>{formatPrice(p.list_price,p.currency)}</del><span className={styles.offerRow}><strong className={styles.current} aria-label={'Discounted price '+formatPrice(p.discounted_price,p.currency)}>{formatPrice(p.discounted_price,p.currency)}</strong><span className={styles.tag} aria-label={discount+' percent off'}>{discount}% OFF</span></span></>:<strong className={styles.current}>{formatPrice(p.list_price,p.currency)}</strong>}</span>;
}
