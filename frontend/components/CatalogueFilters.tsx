"use client";
import {useEffect,useMemo,useRef,useState,useTransition,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {kindLabel} from '@/lib/catalogue-tag-presentation.mjs';
import {buildListQuery,getCatalogueClient,pageHref} from '@/lib/catalogue-client';
import {draftFromQuery,editFilters,clearFilters,selectionCount} from '@/lib/catalogue-filter-workspace.mjs';
import type {FilterDraft} from '@/lib/catalogue-filter-workspace.mjs';
import type {CatalogueQuery} from '@/lib/catalogue-types';
import {CatalogueTagFilters} from './CatalogueTagFilters';
import styles from './CatalogueFilterWorkspace.module.css';
type Props={path:string;query:CatalogueQuery;fixedCategory?:{slug:string;name:string};choices:{categories:{value:string;label:string}[];brands:string[];currencies:string[];kinds?:string[]};facetsUnavailable:boolean};
export function CatalogueFilters({path,query,fixedCategory,choices,facetsUnavailable}:Props){
 const fixed=fixedCategory?.slug||'',appliedKey=buildListQuery(query).toString(),router=useRouter();
 const [draft,setDraft]=useState(()=>draftFromQuery(query,fixed)),[mobile,setMobile]=useState(false),[open,setOpen]=useState(false),[count,setCount]=useState<number|null>(null),[countBusy,setCountBusy]=useState(false),[countError,setCountError]=useState(''),[submitError,setSubmitError]=useState(''),[pending,startTransition]=useTransition();
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),lastRequest=useRef('');
 const checked=useMemo(()=>{try{const params=buildListQuery({...draft,page:1} as CatalogueQuery);return {params,error:''};}catch(e){return {params:null,error:e instanceof Error?e.message:'Check the filters.'};}},[draft]);
 const applied=buildListQuery({...query,page:1}),dirty=checked.params?checked.params.toString()!==applied.toString():true;
 const draftKey=checked.params?.toString()||'';
 useEffect(()=>{setDraft(draftFromQuery(query,fixed));setSubmitError('');lastRequest.current='';},[appliedKey,fixed]);
 useEffect(()=>{const media=window.matchMedia('(max-width: 1023px)'),update=()=>{setMobile(media.matches);if(!media.matches)setOpen(false);};update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 useEffect(()=>{if(!mobile||!open)return;const element=dialog.current;if(!element)return;const old=document.body.style.overflow;document.body.style.overflow='hidden';if(!element.open)element.showModal();return()=>{document.body.style.overflow=old;if(element.open)element.close();trigger.current?.focus();};},[mobile,open]);
 function navigate(next:FilterDraft){try{const href=pageHref(path,buildListQuery({...next,page:1} as CatalogueQuery),1);if(lastRequest.current===href)return;lastRequest.current=href;setSubmitError('');startTransition(()=>router.push(href,{scroll:false}));}catch(e){setSubmitError(e instanceof Error?e.message:'Check the filters.');}}
 useEffect(()=>{if(mobile||!dirty||!checked.params||pending)return;const timer=setTimeout(()=>navigate(draft),500);return()=>clearTimeout(timer);},[mobile,dirty,draftKey,pending]);
 useEffect(()=>{setCount(null);setCountError('');if(!mobile||!open||!checked.params){setCountBusy(false);return;}let live=true;const ctl=new AbortController();setCountBusy(true);const timer=setTimeout(()=>{const params=new URLSearchParams(draftKey);params.set('limit','1');params.set('page','1');void getCatalogueClient().list(params,{signal:ctl.signal}).then(data=>{if(live)setCount(data.pagination.total);}).catch(e=>{if(live&&!ctl.signal.aborted)setCountError('Result count is unavailable. You can still apply your filters.');}).finally(()=>{if(live)setCountBusy(false);});},300);return()=>{live=false;clearTimeout(timer);ctl.abort();};},[mobile,open,draftKey]);
 function change(patch:Partial<FilterDraft>){setDraft(d=>editFilters(d,patch,fixed));setSubmitError('');}
 function close(){setOpen(false);setDraft(draftFromQuery(query,fixed));}
 function submit(event:FormEvent){event.preventDefault();if(!checked.params)return;lastRequest.current='';navigate(draft);setOpen(false);}
 const context=checked.params?Object.fromEntries(checked.params) as CatalogueQuery:query;
 const countSelected=selectionCount(query,fixed);
 const form=<form onSubmit={submit} className={styles.panel} aria-label="Catalogue filters" aria-busy={pending}>
  <div className={styles.drawerHead}><h2>Filter products</h2>{mobile&&<button type="button" className={styles.secondary} onClick={close}>Close</button>}</div>
  <label>Search products<input type="search" value={draft.q} maxLength={200} placeholder="Name, SKU or brand" onChange={e=>change({q:e.target.value})}/></label>
  <section aria-labelledby="browse-filter-title"><h3 id="browse-filter-title">Browse products</h3>
   {fixedCategory?<p className={styles.hint}>Category: {fixedCategory.name}</p>:<label>Category<select value={draft.category} onChange={e=>change({category:e.target.value})}><option value="">All categories</option>{choices.categories.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label>}
   <label>Product kind<select value={draft.kind} onChange={e=>change({kind:e.target.value})}><option value="">All product kinds</option>{Array.from(new Set([...(choices.kinds||[]),...(draft.kind?[draft.kind]:[])])).sort().map(k=><option key={k} value={k}>{kindLabel(k)}</option>)}</select></label>
  </section>
  <section aria-labelledby="price-brand-title"><h3 id="price-brand-title">Price &amp; brand</h3>
   <label>Brand<select value={draft.brand} onChange={e=>change({brand:e.target.value})}><option value="">All brands</option>{Array.from(new Set([...choices.brands,...(draft.brand?[draft.brand]:[])])).map(b=><option key={b} value={b}>{b}</option>)}</select></label>
   <label>Currency<select value={draft.currency} onChange={e=>change({currency:e.target.value})}><option value="">All currencies</option>{Array.from(new Set([...choices.currencies,...(draft.currency?[draft.currency]:[])])).map(c=><option key={c} value={c}>{c}</option>)}</select></label>
   {!draft.currency&&<p className={styles.hint}>Choose a currency to set a price range.</p>}
   <div className={styles.price}><label>Minimum price<input type="number" step="0.01" min="0" max="999999999999.99" disabled={!draft.currency} value={draft.min_price} onChange={e=>change({min_price:e.target.value})}/></label><label>Maximum price<input type="number" step="0.01" min="0" max="999999999999.99" disabled={!draft.currency} value={draft.max_price} onChange={e=>change({max_price:e.target.value})}/></label></div>
  </section>
  <CatalogueTagFilters query={context} value={draft.tag_filters} onChange={value=>change({tag_filters:value})}/>
  {facetsUnavailable&&<p role="status" className={styles.hint}>Some filter options could not be refreshed. Your selections are retained.</p>}
  {(checked.error||submitError)&&<p role="alert" className={styles.error}>{checked.error||submitError}</p>}
  {countError&&<p role="status" className={styles.hint}>{countError}</p>}
  <div className={`${styles.actions} ${mobile?styles.drawerFoot:''}`}><button className={styles.primary} type="submit" disabled={!checked.params||pending}>{pending?'Updating products…':mobile?(countBusy?'Checking products…':count!==null?`Show ${count} products`:'Show products'):'Apply now'}</button><button className={styles.secondary} type="button" onClick={()=>setDraft(clearFilters(draft,fixed))}>Clear filters</button></div>
  {!mobile&&<p className={styles.hint} role="status">{pending?'Updating products…':'Results update automatically. Selections can also be removed above the products.'}</p>}
 </form>;
 return <><button ref={trigger} type="button" className={styles.trigger} onClick={()=>setOpen(true)}>Filter{countSelected?` (${countSelected})`:''}</button>{mobile?<dialog ref={dialog} className={styles.dialog} aria-label="Filter products" onCancel={e=>{e.preventDefault();close();}}>{open&&form}</dialog>:<div className={styles.desktop}>{form}</div>}</>;
}
