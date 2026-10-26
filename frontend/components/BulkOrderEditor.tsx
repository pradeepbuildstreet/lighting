"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import {useAdminNavigationGuard} from '@/lib/use-admin-navigation-guard';
import {orderedCategories} from '@/lib/admin-category-hierarchy.mjs';

type OrderingRow={id:string;name:string;parent_id:string|null;sort_order:number;is_active:boolean|null};
type DisplayRow=OrderingRow&{_depth:number;_ancestors:string[]};
type OrderingSnapshot={items:OrderingRow[];edit_token:string;updated?:number};
type HierarchyResult={rows:DisplayRow[];error:string};

export function BulkOrderEditor({kind='categories',parent,onStateChange,onSaved}:{kind?:string;parent?:string;onStateChange?:(s:{dirty:boolean;busy:boolean})=>void;onSaved?:()=>void}){
 const [rows,setRows]=useState<OrderingRow[]>([]),[draft,setDraft]=useState<Record<string,string>>({}),[baseline,setBaseline]=useState('{}'),[token,setToken]=useState(''),[expanded,setExpanded]=useState<Set<string>>(new Set()),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[blocked,setBlocked]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const lock=useRef(false),path='/api/admin/catalogue/ordering/'+encodeURIComponent(kind)+(parent===undefined?'':'?parent='+encodeURIComponent(parent));
 const dirty=JSON.stringify(draft)!==baseline;
 useAdminNavigationGuard(!onStateChange&&dirty,!onStateChange&&(busy||loading),'ordering');
 useEffect(()=>{onStateChange?.({dirty,busy:busy||loading});},[dirty,busy,loading,onStateChange]);
 useEffect(()=>()=>onStateChange?.({dirty:false,busy:false}),[onStateChange]);

 async function request(method='GET',body?:unknown):Promise<OrderingSnapshot>{
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),45000);
  try{
   const r=await fetch(path,{method,credentials:'same-origin',cache:'no-store',signal:c.signal,...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})}),d=await r.json();
   if(!r.ok)throw Object.assign(new Error(d.error||'Ordering request failed'),{status:r.status});
   if(!Array.isArray(d.items)||typeof d.edit_token!=='string')throw new Error('Invalid ordering response. Reload saved state before retrying.');
   return d as OrderingSnapshot;
  }finally{clearTimeout(timer);}
 }
 function install(d:OrderingSnapshot){
  const next:Record<string,string>=Object.fromEntries(d.items.map(r=>[r.id,String(r.sort_order)]));
  setRows(d.items);setDraft(next);setBaseline(JSON.stringify(next));setToken(d.edit_token);setExpanded(new Set(d.items.map(r=>r.id)));setBlocked(false);
 }
 useEffect(()=>{let live=true;setLoading(true);setError('');void request().then(d=>{if(live)install(d);}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[path]);

 const validation=useMemo(()=>{
  const errors:Record<string,string>={},groups=new Map<string,OrderingRow[]>();
  for(const row of rows){
   const value=draft[row.id]??'',n=Number(value);
   if(!/^(0|[1-9]\d*)$/.test(value)||!Number.isSafeInteger(n)||n<0||n>100000){errors[row.id]='Use an integer from 0 to 100000.';continue;}
   const key=JSON.stringify([row.parent_id||null,n]);groups.set(key,[...(groups.get(key)||[]),row]);
  }
  for(const group of groups.values())if(group.length>1)for(const row of group)errors[row.id]='Duplicate sibling order '+draft[row.id]+': '+group.map(r=>r.name).join(', ');
  return errors;
 },[rows,draft]);

 const hierarchy=useMemo<HierarchyResult>(()=>{
  try{
   if(kind==='categories'&&parent===undefined){
    const byId=new Map<string,OrderingRow>(rows.map(row=>[row.id,row] as const));
    const displayRows=orderedCategories(rows).map((node):DisplayRow=>{
     const row=byId.get(String(node.id));
     if(!row)throw new Error('Category ordering identity mismatch. Reload the complete scope.');
     return {...row,_depth:node._depth,_ancestors:[...node._ancestors]};
    });
    return {rows:displayRows,error:''};
   }
   const displayRows:DisplayRow[]=[...rows].sort((a,b)=>a.sort_order-b.sort_order||a.name.localeCompare(b.name)).map((row):DisplayRow=>({...row,_depth:0,_ancestors:[]}));
   return {rows:displayRows,error:''};
  }catch(e){return {rows:[],error:(e as Error).message};}
 },[rows,kind,parent]);
 const visible=hierarchy.rows.filter(row=>row._ancestors.every(id=>expanded.has(id))),hasChildren=new Set(rows.map(row=>row.parent_id).filter(Boolean)),errors=Object.keys(validation);
 function renumber(){
  const counts=new Map<string,number>(),next:Record<string,string>={};
  for(const row of hierarchy.rows){const key=row.parent_id||'root',n=(counts.get(key)||0)+10;counts.set(key,n);next[row.id]=String(n);}
  setDraft(next);setNotice('Sibling sets renumbered in the displayed order. Save all to apply.');
 }
 async function save(){
  if(lock.current||blocked||errors.length||hierarchy.error||!dirty)return;
  lock.current=true;setBusy(true);setError('');setNotice('');
  try{const d=await request('PUT',{edit_token:token,items:rows.map(row=>({id:row.id,sort_order:Number(draft[row.id])}))});install(d);setNotice('Saved '+d.updated+' ordering changes together.');onSaved?.();}
  catch(e){const x=e as Error&{status?:number};setError(x.message);if(!x.status||x.status===409||x.status>=500)setBlocked(true);}
  finally{lock.current=false;setBusy(false);}
 }
 return <section aria-label="Bulk display ordering"><h2>Display ordering — {kind.replace(/-/g,' ')}</h2><p>Every record in this scope is included, including inactive and collapsed records. Equal numbers are allowed under different parents, not within the same sibling set. No orders are changed until Save all.</p>{error&&<p role="alert">{error}</p>}{hierarchy.error&&<p role="alert">{hierarchy.error}</p>}{notice&&<p role="status">{notice}</p>}{loading?<p role="status">Loading complete ordering scope…</p>:<><div className="actions"><button disabled={busy||blocked||!rows.length||!!hierarchy.error} onClick={renumber}>Renumber all sibling sets: 10, 20, 30…</button>{kind==='categories'&&<><button disabled={busy} onClick={()=>setExpanded(new Set(rows.map(row=>row.id)))}>Expand all</button><button disabled={busy} onClick={()=>setExpanded(new Set())}>Collapse all</button></>}<button disabled={busy||!dirty} onClick={()=>{if(window.confirm('Discard all unsaved order changes?')){setDraft(JSON.parse(baseline));setNotice('Order edits discarded.');}}}>Discard ordering changes</button><button disabled={busy} onClick={()=>{if(dirty&&!window.confirm('Discard order edits and reload?'))return;setLoading(true);void request().then(install).catch(e=>setError(e.message)).finally(()=>setLoading(false));}}>Reload complete scope</button></div>{errors.length>0&&<p role="alert">{errors.length} records have invalid or duplicate sibling orders. Save is blocked, including conflicts in collapsed branches.</p>}<div className="scroll"><table><thead><tr><th>Name / hierarchy</th><th>Active</th><th>Saved order</th><th>Proposed order</th><th>Validation</th></tr></thead><tbody>{visible.map(row=><tr key={row.id} style={validation[row.id]?{background:'#fff1f2'}:undefined}><td style={{paddingInlineStart:12+Math.min(row._depth,64)*18}}>{hasChildren.has(row.id)&&<button aria-label={(expanded.has(row.id)?'Collapse ':'Expand ')+row.name} aria-expanded={expanded.has(row.id)} disabled={busy} onClick={()=>setExpanded(old=>{const next=new Set(old);next.has(row.id)?next.delete(row.id):next.add(row.id);return next;})}>{expanded.has(row.id)?'−':'+'}</button>} {row.name}</td><td>{row.is_active===null?'—':row.is_active?'Yes':'No'}</td><td>{row.sort_order}</td><td><input aria-label={'Sort order for '+row.name} aria-invalid={!!validation[row.id]} type="number" min={0} max={100000} step={1} disabled={busy||blocked} value={draft[row.id]??''} onChange={e=>setDraft(old=>({...old,[row.id]:e.target.value}))}/></td><td>{validation[row.id]||'Valid'}</td></tr>)}</tbody></table></div><button disabled={busy||blocked||!dirty||!!errors.length||!!hierarchy.error} onClick={()=>void save()}>{busy?'Saving all ordering changes…':'Save all ordering changes'}</button>{blocked&&<p>Reload before retrying. The snapshot is stale or a write result is uncertain.</p>}</>}</section>;
}
