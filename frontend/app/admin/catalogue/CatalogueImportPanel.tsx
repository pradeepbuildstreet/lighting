"use client";
import {useState} from 'react';
type PreviewRow={sheet:string;row_number:number;record_key:string|null;action:string;errors:string[];staged_data:{payload?:{name?:string};expected_revision?:number|string|null}};
type Preview={job:{id:string;status:string;preview_revision:string;expires_at:string};rows:PreviewRow[];commit_ready:boolean};
type Props={onViewProduct?:(id:string)=>Promise<void>;onBusyChange:(busy:boolean)=>void;onCommitted:()=>Promise<void>;parentBusy:boolean};
export default function CatalogueImportPanel({onViewProduct,onBusyChange,onCommitted,parentBusy}:Props){
 const [file,setFile]=useState<File|null>(null),[mode,setMode]=useState('create'),[preview,setPreview]=useState<Preview|null>(null);
 const [results,setResults]=useState<{id:string;sku:string}[]>([]);
 const [busy,setBusy]=useState(false),[confirmed,setConfirmed]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [templateBusy,setTemplateBusy]=useState(false);
 async function downloadTemplate(){
  setTemplateBusy(true);setError('');const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),45000);
  try{
   const response=await fetch('/api/admin/catalogue/imports/template',{credentials:'same-origin',cache:'no-store',signal:controller.signal});
   if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||'Workbook download failed');}
   const blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='catalogue-upload-template.xlsx';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){setError(e instanceof Error?(e.name==='AbortError'?'Workbook download timed out; retry.':e.message):'Workbook download failed');}finally{clearTimeout(timer);setTemplateBusy(false);}
 }

 const disabled=busy||parentBusy;
 const updates=preview?.rows.some(r=>r.action==='update')||false;
 async function request(path:string,init:RequestInit){
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),45000);
  try{const response=await fetch('/api/admin/catalogue'+path,{...init,credentials:'same-origin',cache:'no-store',signal:controller.signal});
  const raw=await response.text();let data;try{data=JSON.parse(raw);}catch(_){throw new Error(`Unexpected server response (${response.status}); retry the same job if commit outcome is uncertain.`);}
  if(!response.ok)throw new Error(data.error||`Request failed (${response.status})`);return data;}catch(e){if(e instanceof Error&&e.name==='AbortError')throw new Error('Request timed out. Keep this job and retry the same commit if its outcome is uncertain.');throw e;}finally{clearTimeout(timeout);}
 }
 async function perform(fn:()=>Promise<void>){setBusy(true);onBusyChange(true);setError('');setNotice('');try{await fn();}catch(e){setError(e instanceof Error?e.message:'Import failed');}finally{setBusy(false);onBusyChange(false);}}
 async function upload(){
  if(!file)throw new Error('Choose an XLSX workbook');
  if(!file.name.toLowerCase().endsWith('.xlsx')||file.size>5242880)throw new Error('Choose an XLSX workbook no larger than 5 MiB');
  const form=new FormData();form.append('file',file);form.append('mode',mode);
  const data=await request('/imports/upload',{method:'POST',body:form});setPreview(data);setResults([]);setConfirmed(false);setNotice('Preview saved. Products have not been changed.');
 }
 async function commit(){
  if(!preview)throw new Error('Upload a workbook first');
  if(!window.confirm('Commit this preview? Product writes are atomic. Updates replace all imported product fields and category assignments. Products remain drafts.'))return;
  const result=await request('/imports/'+preview.job.id+'/commit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({preview_revision:preview.job.preview_revision,confirm_replacement:confirmed})});
  setResults(result.products);setPreview({...preview,job:{...preview.job,status:'committed'},commit_ready:false});setNotice(`${result.products.length} products committed as drafts${result.replayed?' (previous result recovered)':''}.`);
  try{await onCommitted();}catch(_){setError('Import committed, but the product list could not refresh. Refresh the page; do not upload again solely for this error.');}
 }
 return <section className="panel" aria-labelledby="import2c-title">
  <h2 id="import2c-title">Excel draft import</h2>
 <div className="actions"><button type="button" disabled={templateBusy} onClick={()=>void downloadTemplate()}>{templateBusy?'Preparing workbook…':'Download current upload workbook'}</button><span>Current active type codes and category lists from the catalogue.</span></div>
  <p>Use the Products worksheet. Existing active type codes and category slugs are required. Empty update fields clear values; category assignments are replaced. Media, socket groups, SEO metadata and dealer prices are not imported.</p>
  <div className="grid">
   <label className="field">Workbook<input type="file" accept=".xlsx" disabled={disabled} onChange={e=>{setFile(e.target.files?.[0]||null);setPreview(null);setConfirmed(false);setError('');setNotice('');}}/></label>
   <label className="field">Mode<select value={mode} disabled={disabled} onChange={e=>{setMode(e.target.value);setPreview(null);setConfirmed(false);}}><option value="create">Create only</option><option value="update">Update only</option><option value="upsert">Create or update</option></select></label>
  </div>
  <button type="button" disabled={disabled||!file} onClick={()=>void perform(upload)}>Upload and preview</button>
  {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
  {preview&&<>
   <p>Job: <code>{preview.job.id}</code> · {preview.job.status} · Expires: {preview.job.expires_at}</p>
   <p>{preview.rows.length} rows; {preview.rows.filter(r=>r.action==='error').length} errors. Correct errors and upload again before committing.</p>
   <div className="scroll"><table><thead><tr><th>Sheet / row</th><th>SKU</th><th>Name</th><th>Action</th><th>Expected revision</th><th>Errors</th></tr></thead><tbody>{preview.rows.map(r=><tr key={r.sheet+':'+r.row_number}><td>{r.sheet} / {r.row_number}</td><td>{r.record_key||'—'}</td><td>{r.staged_data.payload?.name||'—'}</td><td>{r.action}</td><td>{r.staged_data.expected_revision??'—'}</td><td>{r.errors.join('; ')}</td></tr>)}</tbody></table></div>
   {updates&&<label><input type="checkbox" disabled={disabled||preview.job.status==='committed'} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> I confirm full replacement of imported product fields and category assignments for updates.</label>}
   <div><button type="button" disabled={disabled||!preview.commit_ready||preview.job.status!=='preview'||(updates&&!confirmed)} onClick={()=>void perform(commit)}>Commit draft import</button></div>
  </>}
  {results.length>0&&<><h3>Imported products</h3><ul>{results.map(p=><li key={p.id}>{p.sku} {onViewProduct&&<button type="button" disabled={disabled} onClick={()=>void perform(()=>onViewProduct(p.id))}>View product</button>}</li>)}</ul></>}
 </section>;
}
