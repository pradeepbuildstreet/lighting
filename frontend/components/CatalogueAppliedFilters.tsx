"use client";
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {buildListQuery,pageHref} from '@/lib/catalogue-client';
import {kindLabel} from '@/lib/catalogue-tag-presentation.mjs';
import {clearFilters,editFilters,removeFilter} from '@/lib/catalogue-filter-workspace.mjs';
import {parseTagSelections} from '@/lib/catalogue-tag-filter-model.mjs';
import {loadTagFacets,tagFacetParams} from '@/lib/catalogue-tag-facets.mjs';
import type {TagFacets} from '@/lib/catalogue-tag-facets.mjs';
import type {CatalogueQuery} from '@/lib/catalogue-types';
import styles from './CatalogueFilterWorkspace.module.css';
type Props={path:string;query:CatalogueQuery;fixedCategory?:string;categoryName?:string;summary:string};
export function CatalogueAppliedFilters({path,query,fixedCategory='',categoryName,summary}:Props){
 const router=useRouter(),base=buildListQuery(query).toString(),selected=useMemo(()=>parseTagSelections(query.tag_filters),[query.tag_filters]);
 const [labels,setLabels]=useState<TagFacets|null>(null),[labelError,setLabelError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{if(!selected.length){setLabels(null);setLabelError(false);return;}let live=true;const ctl=new AbortController();setLabelError(false);void loadTagFacets(tagFacetParams(new URLSearchParams(base),query.tag_filters||''),{signal:ctl.signal}).then(data=>{if(live)setLabels(data);}).catch(()=>{if(live&&!ctl.signal.aborted)setLabelError(true);});return()=>{live=false;ctl.abort();};},[base,retry]);
 const href=(key:string,group='',tag='')=>pageHref(path,new URLSearchParams(removeFilter(query,key,group,tag,fixedCategory)),1);
 const chips=[...(!fixedCategory&&query.category?[{key:'category',label:'Category: '+(categoryName||query.category)}]:[]),...(query.kind?[{key:'kind',label:'Product kind: '+kindLabel(query.kind)}]:[]),...(query.brand?[{key:'brand',label:'Brand: '+query.brand}]:[]),...(query.currency?[{key:'currency',label:'Currency: '+query.currency}]:[]),...(query.min_price||query.max_price?[{key:'price',label:`Price: ${query.currency||''} ${query.min_price||'0'} – ${query.max_price||'no maximum'}`}]:[])];
 const hasFilters=!!chips.length||!!selected.length;
 return <section className={styles.toolbar} aria-label="Results and your selections">
  {(query.q||query.search)&&<p className={styles.hint}>Search: {query.q||query.search}{' '}<Link scroll={false} href={pageHref(path,new URLSearchParams(editFilters(query,{q:''},fixedCategory)),1)}>Clear search</Link></p>}
  {hasFilters&&<><div className={styles.resultControls}><h2>Your selections</h2><Link scroll={false} className={styles.clear} href={pageHref(path,new URLSearchParams(clearFilters(query,fixedCategory)),1)}>Clear all filters</Link></div><div className={styles.chips}>
   {chips.map(c=><Link scroll={false} key={c.key} className={styles.chip} href={href(c.key)} aria-label={'Remove '+c.label}>{c.label}<span aria-hidden="true">×</span></Link>)}
   {selected.flatMap(s=>{const names=labels?.selected.find(l=>l.group_id===s.group_id),group=names?.group_name||'Selected feature';return [...s.tag_ids.map(id=><Link scroll={false} key={s.group_id+':'+id} className={styles.chip} href={href('tag',s.group_id,id)} aria-label={'Remove '+group+': '+(names?.tags.find(t=>t.id===id)?.name||'selected value')}>{group}: {names?.tags.find(t=>t.id===id)?.name||'Selected value'}<span aria-hidden="true">×</span></Link>),...(s.unclassified?[<Link scroll={false} key={s.group_id+':unclassified'} className={styles.chip} href={href('unclassified',s.group_id)} aria-label={'Remove '+group+': Not classified'}>{group}: Not classified<span aria-hidden="true">×</span></Link>]:[])];})}
  </div></>}
  {labelError&&<p className={styles.hint} role="status">Some selection names could not be loaded. Selections remain removable. <button className={styles.clear} type="button" onClick={()=>setRetry(n=>n+1)}>Retry names</button></p>}
  <div className={styles.resultControls}><p aria-live="polite">{summary}</p><label>Sort<select value={query.sort||'name'} onChange={e=>router.push(pageHref(path,new URLSearchParams(editFilters(query,{sort:e.target.value},fixedCategory)),1),{scroll:false})}><option value="name">Name</option><option value="newest">Newest</option><option value="price_asc" disabled={!query.currency}>Price: low to high</option><option value="price_desc" disabled={!query.currency}>Price: high to low</option></select></label><label>Per page<select value={String(query.limit||20)} onChange={e=>router.push(pageHref(path,new URLSearchParams(editFilters(query,{limit:e.target.value},fixedCategory)),1),{scroll:false})}>{Array.from(new Set([20,50,100,Number(query.limit||20)])).sort((a,b)=>a-b).map(n=><option key={n} value={n}>{n}</option>)}</select></label></div>
 </section>;
}
