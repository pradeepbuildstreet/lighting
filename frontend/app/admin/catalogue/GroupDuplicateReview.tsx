"use client";
import {useEffect,useRef,useState} from 'react';
import {AdminProductBrowser} from '@/components/AdminProductBrowser';
import DuplicateImageComparison from './DuplicateImageComparison';
import {eligibleGroupProduct,groupError,groupPayload,groupSummary,restoreGroupRequest} from './group-review-state.mjs';
import type {GroupProduct,GroupChoice,GroupPreview,PendingGroupRequest} from './group-review-state.mjs';
const STORAGE='luminoza-pending-group-review-v1';
type Props={seedProductId?:string;onBusyChange:(busy:boolean)=>void;onDirtyChange:(dirty:boolean)=>void;onSaved:()=>void};
export default function GroupDuplicateReview({seedProductId,onBusyChange,onDirtyChange,onSaved}:Props){
 const [selected,setSelected]=useState<GroupProduct[]>([]),[preview,setPreview]=useState<GroupPreview|null>(null),[choices,setChoices]=useState<Record<string,GroupChoice>>({}),[examined,setExamined]=useState<Record<string,boolean>>({}),[notes,setNotes]=useState(''),[subjectId,setSubjectId]=useState('');
 const [pending,setPending]=useState<PendingGroupRequest|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[receipt,setReceipt]=useState<{id:string;summary:string}|null>(null),[refresh,setRefresh]=useState(0);
 const mounted=useRef(false),epoch=useRef(0),inFlight=useRef(false),controller=useRef<AbortController|null>(null),busyCallback=useRef(onBusyChange),dirtyCallback=useRef(onDirtyChange);
 busyCallback.current=onBusyChange;dirtyCallback.current=onDirtyChange;
 const dirty=selected.length>0||!!pending||!!notes;
 useEffect(()=>{onDirtyChange(dirty);},[dirty,onDirtyChange]);
 async function api(path:string,body?:unknown){
  const ticket=epoch.current,c=new AbortController();controller.current=c;const timer=setTimeout(()=>c.abort(),45000);
  try{const response=await fetch('/api/admin/catalogue'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',signal:c.signal,...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
   const data=await response.json();if(!mounted.current||ticket!==epoch.current)throw Error('Review request was superseded');if(!response.ok)throw Error(data.error||'Group review request failed');return data;
  }catch(e){if(e instanceof Error&&e.name==='AbortError')throw Error('Request timed out. A saved confirmation may already have committed; retry only its exact saved request.');throw e;}
  finally{clearTimeout(timer);if(controller.current===c)controller.current=null;}
 }
 async function perform(action:()=>Promise<void>){
  if(inFlight.current)return;const ticket=epoch.current;inFlight.current=true;setBusy(true);busyCallback.current(true);setError('');
  try{await action();}catch(e){if(mounted.current&&ticket===epoch.current)setError(e instanceof Error?e.message:'Group review unavailable');}
  finally{if(mounted.current&&ticket===epoch.current){inFlight.current=false;setBusy(false);busyCallback.current(false);}}
 }
 useEffect(()=>{
  mounted.current=true;epoch.current++;inFlight.current=false;
  let saved:PendingGroupRequest|null=null;
  try{const text=sessionStorage.getItem(STORAGE);if(text){saved=restoreGroupRequest(text);if(!saved)setError('Stored retry data is invalid. Inspect product state before preparing another decision.');}}catch{setError('Retry recovery storage is unavailable. Confirmation will not be sent unless its request can be saved first.');}
  if(saved){setPending(saved);setSelected(saved.products);setError('An earlier confirmation has an unverified outcome. Retry the exact saved request or inspect the products before discarding it.');}
  else if(seedProductId)void perform(async()=>{const data=await api('/products/'+encodeURIComponent(seedProductId));if(!data.product||data.product.id!==seedProductId||!eligibleGroupProduct(data.product))throw Error('This product cannot enter group review.');setSelected([data.product]);});
  return()=>{mounted.current=false;epoch.current++;controller.current?.abort();inFlight.current=false;busyCallback.current(false);dirtyCallback.current(false);};
 },[seedProductId]);
 function resetDecisions(){setPreview(null);setChoices({});setExamined({});setNotes('');setReceipt(null);}
 function mayChangeScope(){return !pending&&!inFlight.current&&(!preview||(!notes&&!Object.keys(choices).length&&!Object.keys(examined).length)||window.confirm('Changing the group discards its current decisions, comparison acknowledgements and notes. Continue?'));}
 function toggle(product:Record<string,any>){
  if(!mayChangeScope())return;if(!eligibleGroupProduct(product)){setError('Confirmed duplicates, rejected and archived products cannot be selected.');return;}
  if(!selected.some(p=>p.id===product.id)&&selected.length>=50){setError('A group can contain at most 50 products.');return;}
  resetDecisions();setError('');setSelected(old=>old.some(p=>p.id===product.id)?old.filter(p=>p.id!==product.id):[...old,product as GroupProduct]);
 }
 async function loadPreview(){
  if(!mayChangeScope())return;
  await perform(async()=>{const data=await api('/duplicates/groups/preview',{product_ids:selected.map(p=>p.id)});
   if(!Array.isArray(data.products)||typeof data.preview_token!=='string'||!Array.isArray(data.outside_product_ids)||!Array.isArray(data.comparisons))throw Error('Invalid preview response; no decision was recorded.');
   const expected=new Set(selected.map(p=>p.id));if(data.products.length!==expected.size||new Set(data.products.map((p:GroupProduct)=>p.id)).size!==expected.size||data.products.some((p:GroupProduct)=>!expected.has(p.id)))throw Error('Preview membership differs from the selected group.');
   const products=data.products.map((p:GroupProduct)=>({...p,sku:typeof p.sku==='string'?p.sku:'',name:typeof p.name==='string'?p.name:''}));
   resetDecisions();setPreview({...data,products});setSelected(products);setSubjectId(products[0]?.id||'');
  });
 }
 async function includeOutside(){
  if(!preview||!mayChangeScope())return;const ids=[...new Set([...selected.map(p=>p.id),...preview.outside_product_ids])];
  if(ids.length>50){setError('The complete candidate scope exceeds 50 products. Do not approve an incomplete group.');return;}
  await perform(async()=>{const added:GroupProduct[]=[];for(const id of preview.outside_product_ids){const data=await api('/products/'+encodeURIComponent(id));if(data.product?.id!==id||!eligibleGroupProduct(data.product))throw Error('An outside candidate changed or is no longer eligible. Refresh the preview.');added.push(data.product);}setSelected(old=>[...old,...added.filter(p=>!old.some(x=>x.id===p.id))]);resetDecisions();});
 }
 async function send(saved:PendingGroupRequest){
  const result=await api('/duplicates/groups/confirm',saved.body);
  if(typeof result.group_resolution_id!=='string'||!/^[-a-f0-9]{36}$/i.test(result.group_resolution_id)||!Array.isArray(result.decisions)||result.decisions.length!==saved.body.decisions.length)throw Error('The confirmation response could not be verified. Keep and retry the exact saved request.');
  const targets=new Set(saved.body.decisions.filter(d=>d.disposition==='duplicate').map(d=>d.duplicate_of_product_id));
  for(const d of saved.body.decisions){const returned=result.decisions.find((r:Record<string,any>)=>r.product_id===d.product_id);const expected=d.disposition==='duplicate'?'confirm_duplicate':targets.has(d.product_id)?'retain_primary':'approve_distinct';if(!returned||returned.decision!==expected||String(returned.reviewed_revision)!==d.revision||(returned.duplicate_of_product_id??null)!==d.duplicate_of_product_id)throw Error('Recorded outcomes could not be verified. Retry the exact saved request.');}
  setReceipt({id:result.group_resolution_id,summary:groupSummary(saved.products,saved.body)});setPending(null);setSelected([]);setPreview(null);setChoices({});setExamined({});setNotes('');setRefresh(n=>n+1);
  try{sessionStorage.removeItem(STORAGE);}catch{setError('Decision recorded, but local retry data could not be cleared. A future retry will use the original request key.');}
  onSaved();
 }
 async function confirm(){
  if(!preview||pending||inFlight.current)return;
  await perform(async()=>{const body=groupPayload(preview,choices,examined,notes,crypto.randomUUID()),saved={body,products:preview.products};
   if(!window.confirm('Record these group decisions?\n\n'+groupSummary(saved.products,body)+'\n\nNotes: '+body.notes+'\n\nRetained activation stays unchanged. Publication remains subject to normal checks.'))return;
   try{sessionStorage.setItem(STORAGE,JSON.stringify(saved));}catch{throw Error('The exact request could not be saved for safe retries. No confirmation was sent.');}
   setPending(saved);await send(saved);
  });
 }
 async function retry(){if(!pending||inFlight.current)return;const saved=pending;if(!window.confirm('Retry this exact saved request? It may already have committed; the same request key will recover its result.\n\n'+groupSummary(saved.products,saved.body)+'\n\nNotes: '+saved.body.notes))return;await perform(()=>send(saved));}
 function discardPending(){if(!pending||busy||!window.confirm('Discard local recovery data? The decision may already have committed. Inspect the products before preparing another decision. This does not undo any recorded decision.'))return;try{sessionStorage.removeItem(STORAGE);}catch{setError('Recovery data could not be cleared.');return;}setPending(null);setSelected([]);resetDecisions();setError('');}
 const locked=busy||!!pending,subject=preview?.products.find(p=>p.id===subjectId)||preview?.products[0],reason=preview?groupError(preview.products,choices,examined,notes):'Load a current group preview first.';
 return <section aria-label="Group duplicate review"><h2>Review a group: retain products and resolve duplicates</h2>
 <p>Choose 2–50 products, including any approved product you want to retain. A group can have multiple retained primaries and distinct products. Nothing is approved by default. Confirmed duplicates are not eligible for another review cycle.</p>
 {error&&<p role="alert" className="error">{error}</p>}{busy&&<p role="status">Checking or recording group review…</p>}
 {receipt&&<section aria-label="Recorded group decision"><h3>Group decision recorded</h3><p>Resolution {receipt.id}. Publication and activation remain separate.</p><pre style={{whiteSpace:'pre-wrap'}}>{receipt.summary}</pre></section>}
 {pending&&<section aria-label="Saved confirmation recovery"><h3>Saved request — outcome not yet verified</h3><p>Do not change the decisions or generate a new request key after an uncertain save. The exact request below is retained for safe replay.</p><pre style={{whiteSpace:'pre-wrap'}}>{groupSummary(pending.products,pending.body)}</pre><p>Notes: {pending.body.notes}</p><details><summary>Exact saved request</summary><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(pending.body,null,2)}</pre></details><button type="button" disabled={busy} onClick={()=>void retry()}>Retry exact saved request</button><button type="button" disabled={busy} onClick={discardPending}>Discard local recovery data</button></section>}
 <AdminProductBrowser selected={selected} onToggle={toggle} disabled={locked} selectionLimit={50} showActions={false} withEnquiries={false} refreshKey={refresh}/>
 <section aria-label="Selected review group"><h3>Selected products ({selected.length}/50)</h3>{!selected.length&&<p>Select products in the browser.</p>}<ul>{selected.map(p=><li key={p.id}>{p.sku||'SKU pending'} — {p.name} <button type="button" disabled={locked} onClick={()=>toggle(p)}>Remove from group</button> <a href={'/admin/catalogue?product='+encodeURIComponent(p.id)+'&mode=view'} target="_blank" rel="noreferrer">View product</a></li>)}</ul><button type="button" disabled={locked||selected.length<2} onClick={()=>void loadPreview()}>Load / refresh group preview</button></section>
 {preview&&!pending&&<>
 {!!preview.outside_product_ids.length&&<section role="alert"><h3>Unresolved candidates outside this group</h3><p>Confirmation is blocked until the complete scope has been reviewed.</p><ul>{preview.outside_product_ids.map(id=><li key={id}><a href={'/admin/catalogue?product='+encodeURIComponent(id)+'&mode=view'} target="_blank" rel="noreferrer">View outside candidate {id}</a></li>)}</ul><button type="button" disabled={busy} onClick={()=>void includeOutside()}>Include outside candidates, then refresh preview</button></section>}
 <label className="field">Product to compare<select disabled={busy} value={subject?.id||''} onChange={e=>setSubjectId(e.target.value)}>{preview.products.map(p=><option key={p.id} value={p.id}>{p.sku||'SKU pending'} — {p.name}</option>)}</select></label>
 {subject&&<DuplicateImageComparison key={preview.preview_token+subject.id} subject={subject} candidates={preview.products.filter(p=>p.id!==subject.id).map(p=>({candidate_product_id:p.id,sku:p.sku,name:p.name,current_revision:p.revision,model_number:p.model_number}))} disabled={busy}/>}
 <details><summary>Review all heuristic comparison evidence</summary><p>Scores are suggestions, not probabilities or automatic duplicate decisions.</p><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(preview.comparisons,null,2)}</pre></details>
 <fieldset disabled={busy}><legend>Record a decision for every product</legend>{preview.products.map(p=><div key={p.id} style={{borderBottom:'1px solid #d1d5db',padding:'12px 0'}}><h4>{p.sku||'SKU pending'} — {p.name}</h4><label className="field">Decision<select value={choices[p.id]?.disposition||''} onChange={e=>setChoices(old=>({...old,[p.id]:{disposition:e.target.value as GroupChoice['disposition'],duplicate_of_product_id:''}}))}><option value="">Choose decision</option><option value="retain">Retain this product (distinct or primary)</option><option value="duplicate">Mark as duplicate and disable</option></select></label>{choices[p.id]?.disposition==='duplicate'&&<label className="field">Duplicate of retained product<select value={choices[p.id]?.duplicate_of_product_id||''} onChange={e=>setChoices(old=>({...old,[p.id]:{disposition:'duplicate' as const,duplicate_of_product_id:e.target.value}}))}><option value="">Choose retained product</option>{preview.products.filter(t=>t.id!==p.id&&choices[t.id]?.disposition==='retain').map(t=><option key={t.id} value={t.id}>{t.sku||'SKU pending'} — {t.name}</option>)}</select></label>}<label><input type="checkbox" checked={examined[p.id]===true} onChange={e=>setExamined(old=>({...old,[p.id]:e.target.checked}))}/> I compared this product with every suggestion and reviewed the available evidence.</label></div>)}<label className="field">Group review notes<textarea maxLength={5000} value={notes} onChange={e=>setNotes(e.target.value)}/></label></fieldset>
 {reason&&<p role="status">{reason}</p>}<p>Retained products keep their activation state. Duplicates will be inactive and unpublished. All members are submitted together; normal publication checks still apply.</p><button type="button" disabled={busy||!!reason||!preview.can_confirm||preview.outside_product_ids.length>0} onClick={()=>void confirm()}>Review summary and record group decisions</button>
 </>}
 </section>;
}
