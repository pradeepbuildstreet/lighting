"use client";
import {useRef,useState} from 'react';
import {AdminProductBrowser} from './AdminProductBrowser';
import {useAdminNavigationGuard} from '@/lib/use-admin-navigation-guard';
import {BULK_IDENTITY_LIMIT,mergeIdentitySelection,identityBody,makeIdentityPreview,verifyIdentitySnapshot} from '@/lib/admin-bulk-identity.mjs';
type Row=Record<string,any>;
const base='/api/admin/catalogue/taxonomy/products-v2';
async function request(path:string,body?:unknown){
 const r=await fetch(base+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(45000),...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
 const d=await r.json().catch(()=>({}));
 if(!r.ok)throw Object.assign(Error(d.error||'Identity request failed'+(r.headers.get('retry-after')?' — wait '+r.headers.get('retry-after')+' seconds':'')),{status:r.status});
 return d;
}
function suggest(p:Row){return request('/'+encodeURIComponent(p.id)+'/name-suggestion',{brand:p.brand,tag_ids:p.tags.map((t:Row)=>t.id),primary_category_id:p.primary_category_id});}
export function BulkProductIdentity(){
 const [selected,setSelected]=useState<Row[]>([]),[rows,setRows]=useState<Row[]>([]),[replaceNames,setReplaceNames]=useState(false),[assignSku,setAssignSku]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[uncertain,setUncertain]=useState(false);
 const lock=useRef(false);
 useAdminNavigationGuard(rows.some(r=>r.include&&!r.saved)||uncertain,busy,'bulk product identity');
 function choose(incoming:Row[]){try{setSelected(mergeIdentitySelection(selected,incoming));setError('');}catch(e){setError((e as Error).message);}}
 function toggle(p:Row){if(selected.some(x=>x.id===p.id))setSelected(selected.filter(x=>x.id!==p.id));else choose([p]);}
 function update(id:string,patch:Row){setRows(old=>old.map(r=>r.id===id?{...r,...patch}:r));}
 function clear(){if(rows.length&&!window.confirm('Discard the current preview and unsaved name edits? Saved identities are retained.'))return;setRows([]);setError('');setMessage('');}
 async function preview(){
  if(lock.current||!selected.length)return;
  if(rows.length&&!window.confirm('Reload saved products and regenerate the preview? Unsaved name edits will be discarded.'))return;
  lock.current=true;setBusy(true);setError('');setMessage('Loading naming rules and product identities…');
  try{
   const state=await request('/state');if(state.draft_identity_ready!==true)throw Error('Draft identity storage is not ready. No products have been changed.');
   const next:Row[]=[];
   for(let i=0;i<selected.length;i++){
    const item=selected[i];setMessage('Previewing '+(i+1)+'/'+selected.length);
    try{const d=await request('/'+encodeURIComponent(item.id));if(d.product?.id!==item.id)throw Error('Product response identity mismatch');const s=await suggest(d.product);next.push(makeIdentityPreview(d.product,s,replaceNames,assignSku));}
    catch(e){const x=e as Error&{status?:number};if(x.status===401||x.status===403||x.status===429)throw e;next.push({id:item.id,product:item,name:'',include:false,status:'Blocked',error:x.message});}
   }
   setRows(next);setUncertain(false);setMessage('Preview complete. Review included rows before saving. No SKU has been reserved or assigned by preview.');
  }catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}
 }
 async function apply(){
  if(lock.current||uncertain)return;
  const todo=rows.filter(r=>r.include&&!r.saved&&!r.error);
  if(!todo.length)return;
  try{for(const r of todo)identityBody(r.product,r.name,assignSku);}catch(e){setError((e as Error).message);return;}
  if(!window.confirm('Save the '+todo.length+' reviewed product identities'+(assignSku?' and allocate missing permanent SKUs':'')+'? Existing SKUs will not change. Each product is saved independently; this does not request activation or bypass publication checks.'))return;
  lock.current=true;setBusy(true);setError('');let saved=0;
  try{
   for(let i=0;i<todo.length;i++){
    const row=todo[i];let sent=false;
    setMessage('Saving '+(i+1)+'/'+todo.length);update(row.id,{status:'Checking current product and naming rule…'});
    try{
     const current=await request('/'+encodeURIComponent(row.id));
     if(current.product?.id!==row.id)throw Error('Product response identity mismatch');
     verifyIdentitySnapshot(row,current.product,await suggest(current.product));
     const body=identityBody(row.product,row.name,assignSku);
     update(row.id,{status:'Saving identity…'});sent=true;
     const result=await request('/'+encodeURIComponent(row.id)+'/identity',body);
     if(result.product?.id!==row.id||result.product.name!==body.product.name||!result.product.sku&&body.assign_sku||row.product.sku&&result.product.sku!==row.product.sku)throw Error('Saved identity response could not be verified. Reload the preview before retrying.');
     saved++;update(row.id,{saved:true,include:false,status:'Saved',product:result.product});
    }catch(e){
     const x=e as Error&{status?:number},unknown=sent&&(!x.status||x.status>=500);
     update(row.id,{include:false,status:unknown?'Outcome uncertain — reload preview':'Not saved — regenerate preview',error:x.message});
     if(unknown||x.status===401||x.status===403||x.status===429){setUncertain(unknown);setError(x.message+' Processing stopped. Reload the preview to inspect saved identities before another save.');break;}
    }
   }
   setMessage(saved+' product identities saved in this run. See each row for saved, blocked or unprocessed status.');
  }finally{lock.current=false;setBusy(false);}
 }
 const ready=rows.filter(r=>r.include&&!r.saved&&!r.error).length;
 return <section className="panel"><h2>Bulk names & SKU assignment</h2>
 <p>Select up to {BULK_IDENTITY_LIMIT} products across result pages. Generate names using the existing primary-category naming rule, saved brand and tags. Review names before saving; SKUs are allocated only on save by the existing server-side allocator.</p>
 {error&&<p className="error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
 <fieldset disabled={busy||rows.length>0||uncertain}><legend>Batch options</legend><label><input type="checkbox" checked={assignSku} onChange={e=>setAssignSku(e.target.checked)}/>Assign missing SKUs; retain every existing SKU.</label><br/><label><input type="checkbox" checked={replaceNames} onChange={e=>setReplaceNames(e.target.checked)}/>Allow replacement of existing names. Off by default to protect manually edited names.</label></fieldset>
 <p>{selected.length} products selected. Selection remains while paging or changing search filters.</p>
 <div className="actions"><button type="button" disabled={busy||!selected.length} onClick={()=>void preview()}>{rows.length||uncertain?'Reload saved identities & regenerate preview':'Preview generated names & missing SKUs'}</button><button type="button" disabled={busy||uncertain||!rows.length} onClick={clear}>Edit selection / options</button><button type="button" disabled={busy||uncertain||!ready} onClick={()=>void apply()}>Save {ready} reviewed identities</button></div>
 {uncertain&&<p role="alert">A save may have completed despite the failed response. Do not recreate products or repeat the batch blindly. Reload the preview to inspect current names and assigned SKUs.</p>}
 {rows.length>0&&<div className="scroll"><table><thead><tr><th>Include</th><th>Product / current SKU</th><th>Generated suggestion / rule</th><th>Name to save</th><th>SKU action</th><th>Result</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><input type="checkbox" aria-label={'Include '+(r.product.name||r.product.model_number||r.id)} checked={r.include} disabled={busy||uncertain||!!r.error||r.saved} onChange={e=>update(r.id,{include:e.target.checked})}/></td><td><a href={'/admin/catalogue?product='+encodeURIComponent(r.id)+'&mode=view'} target="_blank" rel="noreferrer">{r.product.name||r.product.model_number||'Unnamed draft'}</a><p>{r.product.sku||'SKU pending'}</p></td><td>{r.suggestion?.name||'Unavailable'}<p>{r.suggestion?.scope_label}</p></td><td><input aria-label={'Name for '+r.id} maxLength={255} value={r.name} disabled={busy||uncertain||r.saved||!!r.error||r.protectedName} onChange={e=>update(r.id,{name:e.target.value})}/>{r.protectedName&&<p>Existing name protected.</p>}</td><td>{r.product.sku?'Retain '+r.product.sku:assignSku?'Assign once on save':'Leave pending'}</td><td>{r.status}{r.error&&<p role="alert">{r.error}</p>}</td></tr>)}</tbody></table></div>}
 <p>Saving uses the existing revision-checked identity endpoint. Product attributes, categories and tags are preserved in the save request. Normal validation and integrity/saleability processing still apply; activation is not requested. Batches are not all-or-nothing: each row has its own transaction. Keep this tab open until results are reviewed.</p>
 {!rows.length&&!uncertain&&<><AdminProductBrowser selected={selected} onToggle={toggle} onAdd={choose} disabled={busy}/>{selected.length>0&&<details><summary>Selected products ({selected.length})</summary><ul>{selected.map(p=><li key={p.id}>{p.sku||'SKU pending'} — {p.name||p.model_number||p.id} <button type="button" disabled={busy} onClick={()=>toggle(p)}>Remove</button></li>)}</ul><button type="button" disabled={busy} onClick={()=>setSelected([])}>Clear selection</button></details>}</>}
 </section>;
}
