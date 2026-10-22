"use client";
import {useEffect,useState} from 'react';
export function useAdminList<T>(url:string,key:string){
 const [rows,setRows]=useState<T[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let active=true;const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),15000);setLoading(true);setError('');
 fetch(url,{credentials:'same-origin',cache:'no-store',signal:ac.signal}).then(async res=>{const data=await res.json();if(!res.ok)throw Error(res.status===401?'Your admin session has expired. Sign in again.':data.error||'Could not load admin data.');if(active)setRows(Array.isArray(data[key])?data[key]:[]);}).catch(e=>{if(active)setError(e.name==='AbortError'?'Loading timed out. Retry.':e.message);}).finally(()=>{clearTimeout(timer);if(active)setLoading(false);});return()=>{active=false;clearTimeout(timer);ac.abort();};
 },[url,key,attempt]);return {rows,loading,error,refresh:()=>setAttempt(n=>n+1)};
}
