"use client";
import {useEffect,useState} from 'react';
export function ProductEnquiryCount({productId}:{productId:string}){
 const [count,setCount]=useState<number|null>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{const ac=new AbortController();let active=true;setCount(null);setFailed(false);const timer=window.setTimeout(()=>ac.abort(),15000);
 fetch('/api/admin/homepage/enquiry-count/'+encodeURIComponent(productId),{credentials:'include',cache:'no-store',signal:ac.signal}).then(async response=>{if(!response.ok)throw Error();const data=await response.json();if(!Number.isInteger(data.enquiry_count)||data.enquiry_count<0)throw Error();if(active)setCount(data.enquiry_count);}).catch(()=>{if(active)setFailed(true);}).finally(()=>window.clearTimeout(timer));return()=>{active=false;ac.abort();window.clearTimeout(timer);};},[productId]);
 return <p aria-live="polite">Submitted enquiries: {failed?'Temporarily unavailable':count===null?'Loading…':count}. <small>Once per submitted enquiry, not per unit or wishlist addition.</small></p>;
}
