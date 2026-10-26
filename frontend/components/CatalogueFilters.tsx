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
 const [draft,setDraft]=useState(()=>draftFromQuery(query,fixed)),[mobile,setMobile]=useState(false),[ready,setReady]=useState(false),[drawer,setDrawer]=useState<'filters'|'sort'|null>(null),[count,setCount]=useState<number|null>(null),[countBusy,setCountBusy]=useState(false),[countError,setCountError]=useState(''),[submitError,setSubmitError]=useState(''),[pending,startTransition]=useTransition(),[mainTarget,setMainTarget]=useState<HTMLElement|null>(null);
 const dialog=useRef<HTMLDialogElement>(null),opener=useRef<HTMLElement|null>(null),lastRequest=useRef('');
 const checked=useMemo(()=>{try{return {params:buildListQuery({...draft,page:1} as CatalogueQuery),error:''};}catch(e){return {params:null,error:e instanceof Error?e.message:'Check the filters.'};}},[draft]);
 const draftKey=checked.params?.toString()||'',dirty=draftKey!==buildListQuery({...query,page:1}).toString();
 useEffect(()=>{setDraft(draftFromQuery(query,fixed));setSubmitError('');lastRequest.current='';},[appliedKey,fixed]);
 useEffect(()=>{const find=()=>{const target=document.getElementById('catalogue-main-filters');if(!target)return false;setMainTarget(target);return true;};if(find())return;const observer=new MutationObserver(()=>{if(find())observer.disconnect();});observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect();},[path,appliedKey]);
 useEffect(()=>{const media=window.matchMedia('(max-width: 1023px)'),update=()=>{setMobile(media.matches);setReady(true);if(!media.matches)setDrawer(null);};update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 useEffect(()=>{
  const header=document.querySelector<HTMLElement>('.site-header');if(!header)return;
  const original={position:header.style.position,top:header.style.top,zIndex:header.style.zIndex};
  const root=document.documentElement,oldHeight=root.style.getPropertyValue('--shop-header-height');
  header.style.position='sticky';header.style.top='0';header.style.zIndex='100';
  const measure=()=>root.style.setProperty('--shop-header-height',`${Math.ceil(header.getBoundingClientRect().height)}px`);
  measure();const observer=new ResizeObserver(measure);observer.observe(header);
  return()=>{observer.disconnect();header.style.position=original.position;header.style.top=original.top;header.style.zIndex=original.zIndex;if(oldHeight)root.style.setProperty('--shop-header-height',oldHeight);else root.style.removeProperty('--shop-header-height');};
 },[]);
 useEffect(()=>{if(!mobile||!drawer)return;const element=dialog.current;if(!element)return;const old=document.body.style.overflow;document.body.style.overflow='hidden';if(!element.open)element.showModal();return()=>{document.body.style.overflow=old;if(element.open)element.close();if(opener.current?.isConnected)opener.current.focus();};},[mobile,drawer]);
 function navigate(next:FilterDraft){try{const href=pageHref(path,buildListQuery({...next,page:1} as CatalogueQuery),1);if(lastRequest.current===href)return;lastRequest.current=href;setSubmitError('');startTransition(()=>router.push(href,{scroll:false}));}catch(e){setSubmitError(e instanceof Error?e.message:'Check the filters.');}}
 useEffect(()=>{if(!ready||mobile||!dirty||!checked.params||pending)return;const timer=setTimeout(()=>navigate(draft),450);return()=>clearTimeout(timer);},[ready,mobile,dirty,draftKey,pending]);
 useEffect(()=>{
  setCount(null);setCountError('');if(!mobile||drawer!=='filters'||!checked.params){setCountBusy(false);return;}
  let live=true;const ctl=new AbortController();setCountBusy(true);
  const timer=setTimeout(()=>{const params=new URLSearchParams(draftKey);params.set('limit','1');params.set('page','1');void getCatalogueClient().list(params,{signal:ctl.signal}).then(data=>{if(live)setCount(data.pagination.total);}).catch(()=>{if(live&&!ctl.signal.aborted)setCountError('Count unavailable. You can still show products.');}).finally(()=>{if(live)setCountBusy(false);});},300);
  return()=>{live=false;clearTimeout(timer);ctl.abort();};
 },[mobile,drawer,draftKey]);
 function change(patch:Partial<FilterDraft>){setDraft(d=>editFilters(d,patch,fixed));setSubmitError('');}
 function close(){setDrawer(null);setDraft(draftFromQuery(query,fixed));setSubmitError('');}
 function open(which:'filters'|'sort',element:HTMLElement){opener.current=element;setDraft(draftFromQuery(query,fixed));setDrawer(which);}
 function submit(event:FormEvent){event.preventDefault();if(!checked.params)return;lastRequest.current='';navigate(draft);setDrawer(null);}
 function reset(scope:'features'|'products'|'filters'){
  const next=scope==='features'?editFilters(draft,{tag_filters:''},fixed):scope==='products'?editFilters(draft,{kind:'',brand:'',currency:'',min_price:'',max_price:''},fixed):clearFilters(draft,fixed);
  setDraft(next);if(!mobile){lastRequest.current='';navigate(next);}
 }
 const context=checked.params?Object.fromEntries(checked.params) as CatalogueQuery:query;
 const selected=selectionCount(query,fixed);
 const sort=<label>Sort<select value={draft.sort} onChange={e=>change({sort:e.target.value})}><option value="name">Name</option><option value="newest">Newest</option><option value="price_asc" disabled={!draft.currency}>Price: low to high</option><option value="price_desc" disabled={!draft.currency}>Price: high to low</option></select></label>;
 const productControls=<>
  <label>Kind<select value={draft.kind} onChange={e=>change({kind:e.target.value})}><option value="">All kinds</option>{Array.from(new Set([...(choices.kinds||[]),...(draft.kind?[draft.kind]:[])])).sort().map(k=><option key={k} value={k}>{kindLabel(k)}</option>)}</select></label>
  <label>Brand<select value={draft.brand} onChange={e=>change({brand:e.target.value})}><option value="">All brands</option>{Array.from(new Set([...choices.brands,...(draft.brand?[draft.brand]:[])])).map(b=><option key={b} value={b}>{b}</option>)}</select></label>
  <details className={styles.priceMenu} onKeyDown={e=>{if(e.key==='Escape'){e.currentTarget.open=false;e.currentTarget.querySelector('summary')?.focus();}}}><summary>Price ▾</summary><div className={styles.pricePopover}>
   <label>Currency<select value={draft.currency} onChange={e=>change({currency:e.target.value})}><option value="">All currencies</option>{Array.from(new Set([...choices.currencies,...(draft.currency?[draft.currency]:[])])).map(c=><option key={c} value={c}>{c}</option>)}</select></label>
   <label>Minimum price<input type="number" step="0.01" min="0" max="999999999999.99" disabled={!draft.currency} value={draft.min_price} onChange={e=>change({min_price:e.target.value})}/></label>
   <label>Maximum price<input type="number" step="0.01" min="0" max="999999999999.99" disabled={!draft.currency} value={draft.max_price} onChange={e=>change({max_price:e.target.value})}/></label>
   {!draft.currency&&<p className={styles.hint}>Choose a currency for price limits and price sorting.</p>}
  </div></details>
 </>;
 const pageSize=<label>Per page<select value={draft.limit} onChange={e=>change({limit:e.target.value})}>{Array.from(new Set([20,50,100,Number(draft.limit||20)])).sort((a,b)=>a-b).map(n=><option key={n} value={n}>{n}</option>)}</select></label>;
 const errors=<>{facetsUnavailable&&<p role="status" className={styles.hint}>Some options could not be refreshed. Your selections are retained.</p>}{(checked.error||submitError)&&<p role="alert" className={styles.error}>{checked.error||submitError}</p>}</>;
 const features=<CatalogueTagFilters query={context} value={draft.tag_filters} onChange={value=>change({tag_filters:value})}/>;
 const toolbar=<div className={styles.toolbarHost}>
  <form onSubmit={submit} className={`${styles.panel} ${styles.desktopToolbar}`} aria-label="Product filters and sorting" aria-busy={pending}>
   <div className={styles.macroGrid}>{productControls}{sort}{pageSize}{selected>0&&<button className={styles.clear} type="button" onClick={()=>reset('filters')}>Clear filters</button>}</div>{errors}
  </form>
  <div className={styles.mobileToolbar} aria-label="Product browsing controls"><button type="button" className={styles.secondary} onClick={e=>open('filters',e.currentTarget)}>Filter{selected?` (${selected})`:''}</button><button type="button" className={styles.secondary} onClick={e=>open('sort',e.currentTarget)}>Sort</button></div>
 </div>;
 return <>
  {mainTarget?createPortal(toolbar,mainTarget):toolbar}
  <div className={styles.desktop}><form onSubmit={submit} className={`${styles.panel} ${styles.featurePanel}`} aria-label="Feature filters" aria-busy={pending}><div className={styles.drawerHead}><h2>Features</h2>{selected>0&&<button className={styles.clear} type="button" onClick={()=>reset('filters')}>Clear filters</button>}</div>{features}</form></div>
  {mobile&&<dialog ref={dialog} className={styles.dialog} aria-labelledby="catalogue-drawer-title" onCancel={e=>{e.preventDefault();close();}}>{drawer&&<form onSubmit={submit} className={`${styles.panel} ${styles.drawerForm}`}>
   <div className={styles.drawerHead}><h2 id="catalogue-drawer-title">{drawer==='sort'?'Sort products':'Filter products'}</h2><button type="button" className={styles.secondary} onClick={close}>Close</button></div>
   <div className={styles.drawerBody}>{drawer==='sort'?<>{sort}{!draft.currency&&<p className={styles.hint}>Set a currency in Filter to enable price sorting.</p>}</>:<><div className={styles.mobileFields}>{productControls}{pageSize}</div>{features}</>}{errors}{countError&&<p role="status" className={styles.hint}>{countError}</p>}</div>
   <div className={styles.drawerFoot}>{drawer==='filters'&&<button className={styles.secondary} type="button" onClick={()=>reset('filters')}>Clear filters</button>}<button className={styles.primary} type="submit" disabled={!checked.params||pending}>{pending?'Updating…':drawer==='sort'?'Apply sort':countBusy?'Show products':count!==null?`Show ${count} products`:'Show products'}</button></div>
  </form>}</dialog>}
 </>;
}
