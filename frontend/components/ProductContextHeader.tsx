"use client";
import {useEffect,useState} from 'react';
import {productIdentifier} from '@/lib/admin-product-identity.mjs';
import {comparisonImages} from '@/app/admin/catalogue/duplicate-image-comparison.mjs';
type Row=Record<string,any>;
export function ProductContextHeader({productId}:{productId:string}){
 const [snapshot,setSnapshot]=useState<{product:Row;image:Row|undefined;mediaRevision:unknown}|null>(null),[reload,setReload]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState(''),[failed,setFailed]=useState(false);
 useEffect(()=>{
  let live=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
  setSnapshot(null);setLoading(true);setError('');setFailed(false);
  async function read(path:string){const r=await fetch('/api/admin/catalogue'+path,{credentials:'same-origin',cache:'no-store',signal:controller.signal});const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to load product identity');return d;}
  void Promise.all([read('/taxonomy/products-v2/'+encodeURIComponent(productId)),read('/products/'+encodeURIComponent(productId)+'/extensions')]).then(([p,m])=>{
   if(p.product?.id!==productId)throw Error('Product identity response mismatch');
   const images=comparisonImages(productId,m.media);
   if(live)setSnapshot({product:p.product,image:images[0],mediaRevision:m.revision});
  }).catch(e=>{if(live)setError(e.name==='AbortError'?'Product context loading timed out. Reload the header.':e.message);}).finally(()=>{clearTimeout(timer);if(live)setLoading(false);});
  return()=>{live=false;clearTimeout(timer);controller.abort();};
 },[productId,reload]);
 const current=snapshot?.product.id===productId?snapshot:null,src=current?.image?.src;
 return <section className="panel" aria-label="Selected product identity" style={{margin:'12px 0'}}>
 {loading&&<p role="status">Loading selected product image and code…</p>}{error&&<p role="alert">{error}</p>}
 {current&&<div style={{display:'flex',gap:16,alignItems:'center',flexWrap:'wrap'}}>
 <div style={{width:104,height:104,display:'flex',alignItems:'center',justifyContent:'center',border:'1px solid #d1d5db',background:'#fff',flexShrink:0}}>{src&&!failed?<a href={src} target="_blank" rel="noreferrer" aria-label="Open selected product image full size"><img src={src} width={100} height={100} alt={current.image?.alt_text||current.product.name||'Selected product'} style={{objectFit:'contain'}} referrerPolicy="no-referrer" onError={()=>setFailed(true)}/></a>:<span>No image</span>}</div>
 <div><h2>{productIdentifier(current.product)}</h2><p>{current.product.name||'Unnamed draft'}</p><p>Saved revision {String(current.product.revision)} · {current.product.is_active?'Active':'Inactive'}</p>{String(current.product.revision)!==String(current.mediaRevision)&&<p role="status">Product changed while loading. Reload this header before relying on its image context.</p>}</div>
 </div>}
 <button type="button" disabled={loading} onClick={()=>setReload(n=>n+1)}>Reload product identity / thumbnail</button>
 </section>;
}
