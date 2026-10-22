"use client";
import {PublicationCompatibilityWarnings} from '@/components/PublicationCompatibilityWarnings';
import {useEffect,useRef,useState} from 'react';
import {canReview,candidateState,reviewError,publicationAction} from './review-state.mjs';
import ProductVisibility from './ProductVisibility';
import type {CatalogueVisibility} from './ProductVisibility';
type Product={id:string;sku:string;name:string;revision:number|string;published:boolean;review_status:string};
type Audit={id:string;status:string;product_revision:number|string;scanned_count?:number;algorithm_version:string};
type Candidate={candidate_product_id:string;sku:string;name:string;overall_score:number|string;current_revision:number|string;evidence:{candidate_revision?:unknown;signals?:unknown[];limitations?:string[]}};
type Detail={audit:Audit;candidates:Candidate[];reviews:{decision:string;notes:string;reviewer_id:string}[]};
type QueueRow=Product&{audit_id?:string;audit_status?:string};
type Readiness={compatibility_warnings?:string[];product:Product;can_publish:boolean;reasons:string[];visibility?:CatalogueVisibility};
type Props={mode?:'queue'|'product';onReviewProduct?:(id:string)=>Promise<void>;productId?:string;productRevision?:number|string;parentBusy:boolean;onBusyChange:(busy:boolean)=>void;onChanged:()=>Promise<void>;onOpenProduct:(id:string,view:boolean)=>Promise<void>};
async function api(path:string,method='GET',body?:unknown){
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),45000);
 try{const response=await fetch('/api/admin/catalogue'+path,{method,credentials:'same-origin',cache:'no-store',signal:controller.signal,...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
 const text=await response.text();let data;try{data=JSON.parse(text);}catch(_){throw new Error(`Unexpected response (${response.status}). Refresh state before repeating a write.`);}
 if(!response.ok)throw new Error(data.error||`Request failed (${response.status})`);return data;}catch(e){if(e instanceof Error&&e.name==='AbortError')throw new Error('Request timed out. Refresh state before repeating a write.');throw e;}finally{clearTimeout(timeout);}
}
export default function ProductReviewPanel({mode='product',onReviewProduct,productId,productRevision,parentBusy,onBusyChange,onChanged,onOpenProduct}:Props){
 const [queue,setQueue]=useState<QueueRow[]>([]),[product,setProduct]=useState<Product|null>(null),[detail,setDetail]=useState<Detail|null>(null),[publication,setPublication]=useState<Readiness|null>(null);
 const [decision,setDecision]=useState('approve_distinct'),[notes,setNotes]=useState(''),[target,setTarget]=useState('');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const generation=useRef(0),mounted=useRef(true);const disabled=busy||loading||parentBusy;
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;};},[]);
 async function refreshQueue(){const data=await api('/duplicates/queue');if(mounted.current)setQueue(data.items);return data.items as QueueRow[];}
 async function load(id:string,auditId?:string){
  const ticket=++generation.current;setLoading(true);setDetail(null);setPublication(null);setProduct(null);setTarget('');setNotes('');
  try{
   const [p,state]=await Promise.all([api('/products/'+id),api('/products/'+id+'/publication')]);
   const latest=await api('/products/'+id+'/duplicate-audits/latest');const selectedAudit=auditId||latest.audit_id;
   const d=selectedAudit?await api('/duplicate-audits/'+selectedAudit):null;
   if(mounted.current&&ticket===generation.current){setProduct(p.product);setPublication(state);setDetail(d);}
  }finally{if(mounted.current&&ticket===generation.current)setLoading(false);}
 }
 useEffect(()=>{let current=true;if(mode==='queue')void refreshQueue().catch(e=>{if(current)setError(e.message);});return()=>{current=false;};},[mode]);
 useEffect(()=>{if(productId)void load(productId).catch(e=>{if(mounted.current)setError(e.message);});},[productId,productRevision]);
 async function perform(fn:()=>Promise<void>){setBusy(true);onBusyChange(true);setError('');setNotice('');try{await fn();}catch(e){setError(e instanceof Error?e.message:'Operation failed');}finally{if(mounted.current)setBusy(false);onBusyChange(false);}}
 async function runAudit(){if(!product)return;const result=await api('/products/'+product.id+'/duplicate-audits','POST',{revision:product.revision});setNotice('Audit completed; no automatic approval or publication.');await load(product.id,result.audit.id);await onChanged();}
 async function saveReview(){
  if(!product||!detail)return;const reason=reviewError(decision,notes,target);if(reason)throw new Error(reason);
  if(!window.confirm(`Record ${decision.replace(/_/g,' ')} for ${product.sku}? The product will remain unpublished.`))return;
  await api('/duplicate-audits/'+detail.audit.id+'/review','POST',{decision,notes:notes.trim(),duplicate_of_product_id:decision==='confirm_duplicate'?target:null});
  setNotice('Review recorded. Publication is a separate action.');await load(product.id,detail.audit.id);await onChanged();
 }
 async function publish(value:boolean){
  if(!product)return;if(!window.confirm(`${value?'Publish':'Unpublish'} ${product.sku} in the separate catalogue? This does not activate a legacy-storefront product route.`))return;
  await api('/products/'+product.id+'/publication','POST',{revision:product.revision,published:value});const current=await api('/products/'+product.id+'/publication');
  setNotice(value?(current.visibility?.visible?'Published and visible in the customer catalogue.':'Publication is enabled, but this product is not visible in the customer catalogue. See the blocking reasons below.'):'Product unpublished and not visible in the customer catalogue.');await load(product.id,detail?.audit.id);await onChanged();
 }
 return <section className="panel" aria-label={mode==='queue'?'Review queue':'Product review and publication'}>
  <h2>{mode==='queue'?'Review queue':'Product review & publication'}</h2>
  <p>Review evidence is heuristic—not a probability or visual similarity verdict. Imported products are not automatically approved or published.</p>
  {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
  <button type="button" disabled={disabled} onClick={()=>void perform(async()=>{await refreshQueue();if(product)await load(product.id,detail?.audit.id);})}>Refresh review state</button>
  {mode==='queue'&&<>
  <p>Pending queue: up to 200 most recently updated products. Approved products can be selected from the main product list.</p>
  <div className="scroll"><table><thead><tr><th>SKU</th><th>Name</th><th>Review status</th><th>Audit</th><th>Actions</th></tr></thead><tbody>{queue.map(row=><tr key={row.id}><td>{row.sku}</td><td>{row.name}</td><td>{row.review_status}</td><td>{row.audit_status||'Not run'}</td><td><button type="button" disabled={disabled} onClick={()=>void perform(()=>onReviewProduct?onReviewProduct(row.id):onOpenProduct(row.id,true))}>Review</button><button type="button" disabled={disabled} onClick={()=>void perform(()=>onOpenProduct(row.id,true))}>View product</button></td></tr>)}</tbody></table></div>
  </>}
  {loading&&<p role="status">Loading review state…</p>}
  {mode==='product'&&product&&<>
   <h3>{product.sku} — {product.name}</h3><p>Revision {product.revision} · {product.review_status} · {product.published?'Published flag set':'Unpublished'}</p>
   <button type="button" disabled={disabled} onClick={()=>void perform(runAudit)}>Run fresh duplicate audit</button>
   <button type="button" disabled={disabled} onClick={()=>void perform(()=>onOpenProduct(product.id,true))}>View product</button>
   <button type="button" disabled={disabled} onClick={()=>void perform(()=>onOpenProduct(product.id,false))}>Edit product</button>
   {detail&&<>
    <p>Audit {detail.audit.id} · {detail.audit.status} · Subject revision {detail.audit.product_revision} · {detail.audit.scanned_count??'Unknown'} other products scanned · {detail.audit.algorithm_version}</p>
    <div className="scroll"><table><thead><tr><th>Candidate</th><th>Heuristic score</th><th>Revision evidence</th><th>Evidence</th><th>View</th></tr></thead><tbody>{detail.candidates.map(c=><tr key={c.candidate_product_id}><td>{c.sku} — {c.name}</td><td>{c.overall_score}/100</td><td>{candidateState(c)}</td><td><details><summary>Show signals</summary><pre>{JSON.stringify(c.evidence,null,2)}</pre></details></td><td><button type="button" disabled={disabled} onClick={()=>void perform(()=>onOpenProduct(c.candidate_product_id,true))}>View candidate</button></td></tr>)}</tbody></table></div>
    {!detail.candidates.length&&<p>No candidates met the configured threshold. This is not proof of uniqueness.</p>}
    {detail.reviews.map((r,i)=><p key={i}>Recorded: {r.decision} · {r.notes}</p>)}
    <fieldset disabled={disabled||!canReview(detail.audit,product,detail.reviews)}><legend>Record review decision</legend>
     <label className="field">Decision<select value={decision} onChange={e=>{setDecision(e.target.value);setTarget('');}}><option value="approve_distinct">Approve distinct</option><option value="confirm_duplicate">Confirm duplicate</option><option value="request_correction">Request correction</option><option value="reject">Reject</option></select></label>
     {decision==='confirm_duplicate'&&<label className="field">Duplicate of<select value={target} onChange={e=>setTarget(e.target.value)}><option value="">Choose candidate</option>{detail.candidates.map(c=><option key={c.candidate_product_id} value={c.candidate_product_id} disabled={candidateState(c)!=='current'}>{c.sku} — {c.name}</option>)}</select></label>}
     <label className="field">Review notes<textarea maxLength={5000} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
     <button type="button" disabled={!!reviewError(decision,notes,target)} onClick={()=>void perform(saveReview)}>Record decision</button>
    </fieldset>
   </>}
   {publication&&<ProductVisibility visibility={publication.visibility}/>}
   <h3>Publication readiness</h3>
   <PublicationCompatibilityWarnings warnings={publication?.compatibility_warnings}/>
   {publication&&<>{publication.reasons.length?<ul>{publication.reasons.map(r=><li key={r}>{r}</li>)}</ul>:<p>No publication blockers reported. The server checks again on submission.</p>}
    <button type="button" disabled={disabled||publicationAction(publication)!=='publish'} onClick={()=>void perform(()=>publish(true))}>Publish catalogue product</button>
    <button type="button" disabled={disabled||publicationAction(publication)!=='unpublish'} onClick={()=>void perform(()=>publish(false))}>Unpublish</button>
   </>}
  </>}
 </section>;
}
