"use client";
import {useEffect,useRef,useState,useTransition,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {buildListQuery,pageHref} from '@/lib/catalogue-client';
import {draftFromQuery,editFilters} from '@/lib/catalogue-filter-workspace.mjs';
import type {FilterDraft} from '@/lib/catalogue-filter-workspace.mjs';
import type {CatalogueQuery} from '@/lib/catalogue-types';
import {CatalogueTagFilters} from './CatalogueTagFilters';
import workspace from './CatalogueFilterWorkspace.module.css';
import styles from './ShoppingListingLayout.module.css';
type Props={path:string;query:CatalogueQuery;fixedCategory?:{slug:string;name:string};choices:{categories:{value:string;label:string}[];brands:string[];currencies:string[];kinds?:string[]};facetsUnavailable:boolean};
export function CatalogueSegmentControls({path,query,fixedCategory,choices,facetsUnavailable}:Props){
 const router=useRouter(),fixed=fixedCategory?.slug||'',key=buildListQuery(query).toString();
 const [draft,setDraft]=useState(()=>draftFromQuery(query,fixed)),[panel,setPanel]=useState<'features'|'filters'|'sort'|null>(null),[error,setError]=useState(''),[pending,startTransition]=useTransition();
 const dialog=useRef<HTMLDialogElement>(null),opener=useRef<HTMLButtonElement|null>(null);
 useEffect(()=>{setDraft(draftFromQuery(query,fixed));setPanel(null);setError('');},[key,fixed]);
 useEffect(()=>{if(!panel||!dialog.current)return;const el=dialog.current,old=document.body.style.overflow;document.body.style.overflow='hidden';if(!el.open)el.showModal();return()=>{if(el.open)el.close();document.body.style.overflow=old;if(opener.current?.isConnected)opener.current.focus();};},[panel]);
 function open(which:'features'|'filters'|'sort',button:HTMLButtonElement){opener.current=button;setDraft(draftFromQuery(query,fixed));setError('');setPanel(which);}
 function change(patch:Partial<FilterDraft>){setDraft(d=>editFilters(d,patch,fixed));setError('');}
 function submit(event:FormEvent){event.preventDefault();try{const href=pageHref(path,buildListQuery({...draft,page:1} as CatalogueQuery),1);startTransition(()=>router.push(href,{scroll:false}));setPanel(null);}catch(e){setError(e instanceof Error?e.message:'Check your selections.');}}
 const context={...query,...draft,page:1} as CatalogueQuery;
 return <><div className={styles.controls} aria-label="Product browsing controls">{(['features','filters','sort'] as const).map(which=><button key={which} type="button" aria-haspopup="dialog" aria-expanded={panel===which} onClick={e=>open(which,e.currentTarget)}>{which==='features'?'Features':which==='filters'?'Filters':'Sort'}</button>)}</div>
 <dialog ref={dialog} className={workspace.dialog} aria-labelledby="segment-controls-title" onCancel={event=>{event.preventDefault();setPanel(null);}}>{panel&&<form onSubmit={submit} className={`${workspace.panel} ${workspace.drawerForm}`} aria-busy={pending}><div className={workspace.drawerHead}><h2 id="segment-controls-title">{panel==='features'?'Features':panel==='filters'?'Filters':'Sort products'}</h2><button className={workspace.secondary} type="button" onClick={()=>setPanel(null)}>Close</button></div><div className={workspace.drawerBody}>
 {panel==='features'&&<CatalogueTagFilters query={context} value={draft.tag_filters} onChange={value=>change({tag_filters:value})}/>}
 {panel==='filters'&&<div className={styles.fields}>
 {!fixed&&<label>Category<select value={draft.category||''} onChange={e=>change({category:e.target.value})}><option value="">All categories</option>{choices.categories.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label>}
 <label>Product kind<select value={draft.kind||''} onChange={e=>change({kind:e.target.value})}><option value="">All kinds</option>{Array.from(new Set([...(choices.kinds||[]),...(draft.kind?[draft.kind]:[])])).map(value=><option key={value} value={value}>{value}</option>)}</select></label>
 <label>Brand<select value={draft.brand||''} onChange={e=>change({brand:e.target.value})}><option value="">All brands</option>{Array.from(new Set([...choices.brands,...(draft.brand?[draft.brand]:[])])).map(value=><option key={value} value={value}>{value}</option>)}</select></label>
 <label>Currency<select value={draft.currency||''} onChange={e=>change({currency:e.target.value})}><option value="">All currencies</option>{Array.from(new Set([...choices.currencies,...(draft.currency?[draft.currency]:[])])).map(value=><option key={value} value={value}>{value}</option>)}</select></label>
 <label>Minimum price<input type="number" min="0" max="999999999999.99" step="0.01" disabled={!draft.currency} value={draft.min_price||''} onChange={e=>change({min_price:e.target.value})}/></label><label>Maximum price<input type="number" min="0" max="999999999999.99" step="0.01" disabled={!draft.currency} value={draft.max_price||''} onChange={e=>change({max_price:e.target.value})}/></label>
 {!draft.currency&&<p className={workspace.hint}>Choose a currency for price limits and price sorting.</p>}
 <label>Per page<select value={draft.limit||'20'} onChange={e=>change({limit:e.target.value})}>{Array.from(new Set([20,50,100,Number(draft.limit||20)])).sort((a,b)=>a-b).map(value=><option key={value} value={value}>{value}</option>)}</select></label></div>}
 {panel==='sort'&&<label>Sort<select value={draft.sort||'name'} onChange={e=>change({sort:e.target.value})}><option value="name">Name</option><option value="newest">Newest</option><option value="price_asc" disabled={!draft.currency}>Price: low to high</option><option value="price_desc" disabled={!draft.currency}>Price: high to low</option></select>{!draft.currency&&<span className={workspace.hint}>Choose a currency in Filters to enable price sorting.</span>}</label>}
 {facetsUnavailable&&<p className={workspace.hint} role="status">Some options could not be refreshed. Existing selections are retained.</p>}{error&&<p className={workspace.error} role="alert">{error}</p>}</div><div className={workspace.drawerFoot}>{panel!=='sort'&&<button type="button" className={workspace.secondary} onClick={()=>{setDraft(d=>panel==='features'?editFilters(d,{tag_filters:''},fixed):editFilters(d,{kind:'',brand:'',currency:'',min_price:'',max_price:'',category:fixed},fixed));setError('');}}>Clear {panel}</button>}<button type="submit" className={workspace.primary} disabled={pending}>{pending?'Updating…':'Apply '+panel}</button></div></form>}</dialog></>;
}
