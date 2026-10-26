"use client";
import {useEffect,useMemo,useRef,useState,useTransition,type FormEvent} from 'react';
import {createPortal} from 'react-dom';
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
 const [draft,setDraft]=useState(()=>draftFromQuery(query,fixed)),[mobile,setMobile]=useState(false),[open,setOpen]=useState(false),[count,setCount]=useState<number|null>(null),[countBusy,setCountBusy]=useState(false),[countError,setCountError]=useState(''),[submitError,setSubmitError]=useState(''),[pending,startTransition]=useTransition(),[mainTarget,setMainTarget]=useState<HTMLElement|null>(null);
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),searchInput=useRef<HTMLInputElement>(null),lastRequest=useRef('');
 const checked=useMemo(()=>{try{const params=buildListQuery({...draft,page:1} as CatalogueQuery);return {params,error:''};}catch(e){return {params:null,error:e instanceof Error?e.message:'Check the filters.'};}},[draft]);
 const applied=buildListQuery({...query,page:1}),dirty=checked.params?checked.params.toString()!==applied.toString():true;
 const draftKey=checked.params?.toString()||'';
 useEffect(()=>{setDraft(draftFromQuery(query,fixed));setSubmitError('');lastRequest.current='';},[appliedKey,fixed]);
 useEffect(()=>{const find=()=>{const target=document.getElementById('catalogue-main-filters');if(!target)return false;setMainTarget(target);return true;};if(find())return;const observer=new MutationObserver(()=>{if(find())observer.disconnect();});observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect();},[path,appliedKey]);
 useEffect(()=>{const media=window.matchMedia('(max-width: 1023px)'),update=()=>{setMobile(media.matches);if(!media.matches)setOpen(false);};update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 useEffect(()=>{if(!mobile||!open)return;const element=dialog.current;if(!element)return;const old=document.body.style.overflow;document.body.style.overflow='hidden';if(!element.open)element.showModal();return()=>{document.body.style.overflow=old;if(element.open)element.close();trigger.current?.focus();};},[mobile,open]);
 function navigate(next:FilterDraft){try{const href=pageHref(path,buildListQuery({...next,page:1} as CatalogueQuery),1);if(lastRequest.current===href)return;lastRequest.current=href;setSubmitError('');startTransition(()=>router.push(href,{scroll:false}));}catch(e){setSubmitError(e instanceof Error?e.message:'Check the filters.');}}
 useEffect(()=>{if(mobile||!dirty||!checked.params||pending)return;const timer=setTimeout(()=>navigate(draft),500);return()=>clearTimeout(timer);},[mobile,dirty,draftKey,pending]);
 useEffect(()=>{setCount(null);setCountError('');if(!mobile||!open||!checked.params){setCountBusy(false);return;}let live=true;const ctl=new AbortController();setCountBusy(true);const timer=setTimeout(()=>{const params=new URLSearchParams(draftKey);params.set('limit','1');params.set('page','1');void getCatalogueClient().list(params,{signal:ctl.signal}).then(data=>{if(live)setCount(data.pagination.total);}).catch(()=>{if(live&&!ctl.signal.aborted)setCountError('Result count is unavailable. You can still apply your filters.');}).finally(()=>{if(live)setCountBusy(false);});},300);return()=>{live=false;clearTimeout(timer);ctl.abort();};},[mobile,open,draftKey]);
 function change(patch:Partial<FilterDraft>){setDraft(d=>editFilters(d,patch,fixed));setSubmitError('');}
 function close(){setOpen(false);setDraft(draftFromQuery(query,fixed));}
 function submit(event:FormEvent){event.preventDefault();event.stopPropagation();if(!checked.params)return;lastRequest.current='';navigate(draft);setOpen(false);}
 function clearAll(){const next=clearFilters(draft,fixed);setDraft(next);lastRequest.current='';navigate(next);setOpen(false);}
 function clearSearch(){const next=editFilters(query,{q:''},fixed);setDraft(next);lastRequest.current='';navigate(next);searchInput.current?.focus();}
 const context=checked.params?Object.fromEntries(checked.params) as CatalogueQuery:query;
 const countSelected=selectionCount({tag_filters:query.tag_filters});
 const macro=<form onSubmit={submit} className={`${styles.panel} ${styles.macroPanel}`} aria-label="Main product filters" aria-busy={pending}>
  <h2>Product filters</h2>
  <div className={styles.searchRow}><label htmlFor="catalogue-search-input">Search products</label><div><input ref={searchInput} id="catalogue-search-input" type="search" value={draft.q} maxLength={200} placeholder="Name, SKU or brand" onChange={e=>change({q:e.target.value})}/><button className={styles.clearSearch} type="button" disabled={pending||!(draft.q||query.q||query.search)} onClick={clearSearch}>Clear search</button></div></div>
  <div className={styles.macroGrid}>
   {fixedCategory?<div className={styles.categoryContext}>Category<strong>{fixedCategory.name}</strong></div>:<label>Category<select value={draft.category} onChange={e=>change({category:e.target.value})}><option value="">All categories</option>{choices.categories.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label>}
   <label>Product kind<select value={draft.kind} onChange={e=>change({kind:e.target.value})}><option value="">All product kinds</option>{Array.from(new Set([...(choices.kinds||[]),...(draft.kind?[draft.kind]:[])])).sort().map(k=><option key={k} value={k}>{kindLabel(k)}</option>)}</select></label>
   <label>Brand<select value={draft.brand} onChange={e=>change({brand:e.target.value})}><option value="">All brands</option>{Array.from(new Set([...choices.brands,...(draft.brand?[draft.brand]:[])])).map(b=><option key={b} value={b}>{b}</option>)}</select></label>
   <label>Currency<select value={draft.currency} onChange={e=>change({currency:e.target.value})}><option value="">All currencies</option>{Array.from(new Set([...choices.currencies,...(draft.currency?[draft.currency]:[])])).map(c=><option key={c} value={c}>{c}</option>)}</select></label>
   <label>Minimum price<input type="number" step="0.01" min="0" max="999999999999.99" disabled={!draft.currency} value={draft.min_price} onChange={e=>change({min_price:e.target.value})}/></label>
   <label>Maximum price<input type="number" step="0.01" min="0" max="999999999999.99" disabled={!draft.currency} value={draft.max_price} onChange={e=>change({max_price:e.target.value})}/></label>
   <label>Sort<select value={draft.sort} onChange={e=>change({sort:e.target.value})}><option value="name">Name</option><option value="newest">Newest</option><option value="price_asc" disabled={!draft.currency}>Price: low to high</option><option value="price_desc" disabled={!draft.currency}>Price: high to low</option></select></label>
   <label>Per page<select value={draft.limit} onChange={e=>change({limit:e.target.value})}>{Array.from(new Set([20,50,100,Number(draft.limit||20)])).sort((a,b)=>a-b).map(n=><option key={n} value={n}>{n}</option>)}</select></label>
  </div>
  {!draft.currency&&<p className={styles.hint}>Choose a currency to set a price range or sort by price.</p>}
  {facetsUnavailable&&<p role="status" className={styles.hint}>Some options could not be refreshed. Your selections are retained.</p>}
  {(checked.error||submitError)&&<p role="alert" className={styles.error}>{checked.error||submitError}</p>}
  <div className={styles.actions}><button className={styles.primary} type="submit" disabled={!checked.params||pending}>{pending?'Updating products…':mobile?'Apply filters':'Apply now'}</button><button className={styles.secondary} type="button" disabled={pending} onClick={clearAll}>Clear filters</button><span className={styles.hint}>{mobile?'Changes apply when you select Apply filters.':'Results update automatically.'}</span></div>
 </form>;
 const features=<form onSubmit={submit} className={`${styles.panel} ${styles.featurePanel}`} aria-label="Feature filters" aria-busy={pending}>
  <div className={styles.drawerHead}><h2>Refine by features</h2>{mobile&&<button type="button" className={styles.secondary} onClick={close}>Close</button>}</div>
  <CatalogueTagFilters query={context} value={draft.tag_filters} onChange={value=>change({tag_filters:value})}/>
  {countError&&<p role="status" className={styles.hint}>{countError}</p>}
  <div className={`${styles.actions} ${mobile?styles.drawerFoot:''}`}><button className={styles.primary} type="submit" disabled={!checked.params||pending}>{pending?'Updating products…':mobile?(countBusy?'Checking products…':count!==null?`Show ${count} products`:'Show products'):'Apply now'}</button><button className={styles.secondary} type="button" disabled={pending} onClick={clearAll}>Clear filters</button></div>
  <p className={styles.hint}>Clear filters resets both panes and keeps your search and category-page context.</p>
 </form>;
 return <>{mainTarget?createPortal(macro,mainTarget):macro}<button ref={trigger} type="button" className={styles.trigger} onClick={()=>setOpen(true)}>Refine by features{countSelected?` (${countSelected})`:''}</button>{mobile?<dialog ref={dialog} className={styles.dialog} aria-label="Refine by features" onCancel={e=>{e.preventDefault();close();}}>{open&&features}</dialog>:<div className={styles.desktop}>{features}</div>}</>;
}
