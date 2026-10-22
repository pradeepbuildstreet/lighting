"use client";
import {createContext,useContext,useEffect,useState} from 'react';
import type {ReactNode} from 'react';
import styles from './PublicEnquiryCounts.module.css';
type State={key:string;status:'loading'|'ready'|'error';counts:Record<string,number>};
const Context=createContext<State|null>(null);
export function EnquiryCountsProvider({productIds,children}:{productIds:string[];children:ReactNode}){
 const key=JSON.stringify([...new Set(productIds.map(id=>id.toLowerCase()))].sort());
 const [state,setState]=useState<State>({key:'',status:'loading',counts:{}});
 useEffect(()=>{const ids:string[]=JSON.parse(key),ac=new AbortController();let active=true;const timer=window.setTimeout(()=>ac.abort(),15000);setState({key,status:'loading',counts:{}});
 const batches:string[][]=[];for(let i=0;i<ids.length;i+=100)batches.push(ids.slice(i,i+100));
 Promise.all(batches.map(async batch=>{const response=await fetch('/api/product-insights/enquiry-counts?ids='+encodeURIComponent(batch.join(',')),{cache:'no-store',signal:ac.signal});if(!response.ok)throw Error('Unavailable');const data=await response.json();if(!data.counts||typeof data.counts!=='object'||Array.isArray(data.counts))throw Error('Invalid counts');for(const [id,count] of Object.entries(data.counts))if(!batch.includes(id)||typeof count!=='number'||!Number.isSafeInteger(count)||Number(count)<0)throw Error('Invalid count');return data.counts as Record<string,number>;})).then(results=>{if(active)setState({key,status:'ready',counts:Object.assign({},...results)});}).catch(()=>{if(active)setState({key,status:'error',counts:{}});}).finally(()=>window.clearTimeout(timer));
 return()=>{active=false;ac.abort();window.clearTimeout(timer);};},[key]);
 const value=state.key===key?state:{key,status:'loading' as const,counts:{}};
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function PublicEnquiryCount({productId}:{productId:string}){const state=useContext(Context),id=productId.toLowerCase(),count=state?.counts[id];return <span className={styles.count}>{!state||state.status==='loading'?'Enquiries: …':state.status==='error'||count===undefined?'Enquiry count unavailable':`Enquired ${count} ${count===1?'time':'times'}`}</span>;}
export function PublicProductEnquiryCount({productId}:{productId:string}){return <EnquiryCountsProvider productIds={[productId]}><PublicEnquiryCount productId={productId}/></EnquiryCountsProvider>;}
