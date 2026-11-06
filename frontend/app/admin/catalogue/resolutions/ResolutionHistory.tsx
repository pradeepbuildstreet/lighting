"use client";
import {useEffect,useRef,useState} from 'react';
type Group={id:string;reviewer_id:string;notes:string;created_at:string;member_count:number;algorithm_version:string;corpus_digest:string;decision?:string;reviewed_revision?:string;duplicate_of_product_id?:string|null};
type Item={product_id:string;reviewed_revision:string;decision:string;duplicate_of_product_id:string|null;audit_id:string;review_id:string;product_snapshot:Record<string,unknown>;[key:string]:unknown};
type Listing={product:{id:string;sku:string|null;name:string;revision:string;review_status:string;is_active:boolean;published:boolean};groups:Group[];next_cursor:string|null};
type Detail={group:Group;items:Item[]};
export default function ResolutionHistory({initialProductId=''}:{initialProductId?:string}){
 const [productId,setProductId]=useState(initialProductId),[listing,setListing]=useState<Listing|null>(null),[detail,setDetail]=useState<Detail|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const controller=useRef<AbortController|null>(null),sequence=useRef(0);
 useEffect(()=>()=>{sequence.current++;controller.current?.abort();},[]);
 async function request(path:string,apply:(data:any)=>void){
  const ticket=++sequence.current;controller.current?.abort();const c=new AbortController();controller.current=c;setBusy(true);setError('');
  const timer=setTimeout(()=>c.abort(),30000);
  try{const response=await fetch('/api/admin/catalogue'+path,{credentials:'same-origin',cache:'no-store',signal:c.signal});const data=await response.json();if(ticket!==sequence.current)return;if(!response.ok)throw Error(data.error||'History unavailable');apply(data);}
  catch(e){if(ticket===sequence.current)setError(e instanceof Error&&e.name==='AbortError'?'History request timed out. No decision was changed.':e instanceof Error?e.message:'History unavailable');}
  finally{clearTimeout(timer);if(ticket===sequence.current){controller.current=null;setBusy(false);}}
 }
 async function load(id:string,before?:string){
  setDetail(null);if(!before)setListing(null);
  await request('/products/'+encodeURIComponent(id)+'/duplicate-history'+(before?'?before='+encodeURIComponent(before):''),data=>{
   if(!data.product||data.product.id.toLowerCase()!==id.toLowerCase()||!Array.isArray(data.groups)||(data.next_cursor!==null&&typeof data.next_cursor!=='string'))throw Error('Invalid history response');
   setListing(data);
  });
 }
 async function open(id:string){setDetail(null);await request('/duplicates/groups/'+encodeURIComponent(id)+'/history',data=>{if(data.group?.id!==id||!Array.isArray(data.items))throw Error('Invalid resolution response');setDetail(data);});}
 return <section aria-label="Group resolution history"><h1>Group resolution history</h1>
 <p>This screen is read-only. Historical outcomes describe the original decision, not necessarily the product state today. Audited reversal and reversal-event history are not available yet.</p>
 <form onSubmit={e=>{e.preventDefault();void load(productId.trim());}}><label className="field">Product ID<input required value={productId} disabled={busy} pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}" onChange={e=>setProductId(e.target.value)}/></label><button type="submit" disabled={busy}>Load latest history</button></form>
 {busy&&<p role="status">Loading history...</p>}{error&&<p role="alert">{error}</p>}
 {listing&&<section><h2>{listing.product.sku||'SKU pending'} — {listing.product.name}</h2><p>Current revision: {listing.product.revision}; review state: {listing.product.review_status}; active: {String(listing.product.is_active)}; published: {String(listing.product.published)}.</p>
 {!listing.groups.length&&<p>No group resolutions on this history page. This does not mean the product has no individual reviews.</p>}
 <ul>{listing.groups.map(g=><li key={g.id}><button type="button" disabled={busy} onClick={()=>void open(g.id)}>{g.created_at} — {g.decision} — reviewed revision {g.reviewed_revision}</button><p>Resolution: {g.id}; reviewer: {g.reviewer_id}; members: {g.member_count}; retained target: {g.duplicate_of_product_id||'none'}.</p><p style={{whiteSpace:'pre-wrap'}}>Notes: {g.notes}</p></li>)}</ul>
 {listing.next_cursor&&<button type="button" disabled={busy} onClick={()=>void load(listing.product.id,listing.next_cursor!)}>Older resolutions</button>}
 </section>}
 {detail&&<section aria-label="Historical resolution evidence"><h2>Resolution {detail.group.id}</h2><p>Reviewer: {detail.group.reviewer_id}; recorded: {detail.group.created_at}; algorithm: {detail.group.algorithm_version}.</p><p style={{overflowWrap:'anywhere'}}>Corpus digest: {detail.group.corpus_digest}</p><p style={{whiteSpace:'pre-wrap'}}>Notes: {detail.group.notes}</p>
 {detail.items.length!==detail.group.member_count&&<p role="alert">Recorded membership count differs from the returned items. Treat this evidence as incomplete.</p>}
 {detail.items.map(i=><article key={i.product_id}><h3>{String(i.product_snapshot.sku||i.product_id)} — {String(i.product_snapshot.name||'')}</h3><p>Original outcome: {i.decision}; reviewed revision: {i.reviewed_revision}; retained target: {i.duplicate_of_product_id||'none'}.</p><p>Product: {i.product_id}; audit: {i.audit_id}; review: {i.review_id}.</p><details><summary>Reviewed product snapshot</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(i.product_snapshot,null,2)}</pre></details><details><summary>Linked audit and review evidence</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(Object.fromEntries(Object.entries(i).filter(([key])=>key!=='product_snapshot')),null,2)}</pre></details></article>)}
 </section>}
 </section>;
}
