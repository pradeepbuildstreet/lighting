"use client";
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {buildListQuery,pageHref} from '@/lib/catalogue-client';
import {kindLabel} from '@/lib/catalogue-tag-presentation.mjs';
import {editFilters,removeFilter} from '@/lib/catalogue-filter-workspace.mjs';
import {parseTagSelections} from '@/lib/catalogue-tag-filter-model.mjs';
import {loadTagFacets,tagFacetParams} from '@/lib/catalogue-tag-facets.mjs';
import type {TagFacets} from '@/lib/catalogue-tag-facets.mjs';
import type {CatalogueQuery} from '@/lib/catalogue-types';
import styles from './CatalogueSelections.module.css';
import layout from './StorefrontSkeleton.module.css';
type Props={path:string;query:CatalogueQuery;fixedCategory?:string;categoryName?:string;summary:string};
export function CatalogueAppliedFilters({path,query,fixedCategory='',categoryName,summary}:Props){
 const base=buildListQuery(query).toString();
 const selected=useMemo(()=>parseTagSelections(query.tag_filters),[query.tag_filters]);
 const [labels,setLabels]=useState<TagFacets|null>(null),[labelError,setLabelError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!selected.length){setLabels(null);setLabelError(false);return;}
  let live=true;const ctl=new AbortController();setLabelError(false);
  void loadTagFacets(tagFacetParams(new URLSearchParams(base),query.tag_filters||''),{signal:ctl.signal}).then(data=>{if(live)setLabels(data);}).catch(()=>{if(live&&!ctl.signal.aborted)setLabelError(true);});
  return()=>{live=false;ctl.abort();};
 },[base,retry,selected.length,query.tag_filters]);
 const href=(key:string,group='',tag='')=>pageHref(path,new URLSearchParams(removeFilter(query,key,group,tag,fixedCategory)),1);
 const changed=(patch:Parameters<typeof editFilters>[1])=>pageHref(path,new URLSearchParams(editFilters(query,patch,fixedCategory)),1);
 const search=String(query.q||query.search||'');
 const chips=[
  ...(!fixedCategory&&query.category?[{key:'category',label:'Category: '+(categoryName||query.category)}]:[]),
  ...(query.kind?[{key:'kind',label:'Kind: '+kindLabel(query.kind)}]:[]),
  ...(query.brand?[{key:'brand',label:'Brand: '+query.brand}]:[]),
  ...(query.currency?[{key:'currency',label:'Currency: '+query.currency}]:[]),
  ...(query.min_price||query.max_price?[{key:'price',label:`Price: ${query.currency||''} ${query.min_price||'0'} – ${query.max_price||'no maximum'}`}]:[])
 ];
 const hasProductFilters=!!(query.kind||query.brand||query.currency||query.min_price||query.max_price);
 const hasFeatures=selected.length>0;
 const hasSelections=!!search||chips.length>0||hasFeatures;
 const productPatch={kind:'',brand:'',currency:'',min_price:'',max_price:''};
 function closeMenu(event:React.MouseEvent<HTMLAnchorElement>){const menu=event.currentTarget.closest('details');if(menu)menu.open=false;}
 if(!hasSelections)return null;
 return <div className={layout.selections} data-storefront-segment="5"><section className={styles.root} aria-label="Results and active selections">
  <div className={styles.row}>
   <div className={styles.chips} role="region" aria-label="Active selections; scroll horizontally for more" tabIndex={0}>
    {!!search&&<Link scroll={false} className={styles.chip} href={changed({q:''})} aria-label={'Remove search: '+search}>Search: {search}<span aria-hidden="true">×</span></Link>}
    {chips.map(c=><Link scroll={false} key={c.key} className={styles.chip} href={href(c.key)} aria-label={'Remove '+c.label}>{c.label}<span aria-hidden="true">×</span></Link>)}
    {selected.flatMap(s=>{
     const names=labels?.selected.find(l=>l.group_id===s.group_id),group=names?.group_name||'Selected feature';
     return [
      ...s.tag_ids.map(id=>{const name=names?.tags.find(t=>t.id===id)?.name||'Selected value';return <Link scroll={false} key={s.group_id+':'+id} className={styles.chip} href={href('tag',s.group_id,id)} aria-label={'Remove '+group+': '+name}>{group}: {name}<span aria-hidden="true">×</span></Link>;}),
      ...(s.unclassified?[<Link scroll={false} key={s.group_id+':unclassified'} className={styles.chip} href={href('unclassified',s.group_id)} aria-label={'Remove '+group+': Not classified'}>{group}: Not classified<span aria-hidden="true">×</span></Link>]:[])
     ];
    })}
   </div>
   <div className={styles.actions}>
    {!!search&&<Link scroll={false} className={styles.action} href={changed({q:''})}>Clear search</Link>}
    <details className={styles.menu} onKeyDown={event=>{if(event.key==='Escape'){event.currentTarget.open=false;event.currentTarget.querySelector('summary')?.focus();}}}>
     <summary>Clear <span aria-hidden="true">▾</span></summary>
     <div className={styles.menuItems}>
      {hasFeatures&&<Link scroll={false} href={changed({tag_filters:''})} onClick={closeMenu}>Clear feature filters</Link>}
      {hasProductFilters&&<Link scroll={false} href={changed(productPatch)} onClick={closeMenu}>Clear product filters</Link>}
      <Link scroll={false} href={changed({...productPatch,q:'',tag_filters:'',category:fixedCategory,sort:'name'})} onClick={closeMenu}>Clear all</Link>
     </div>
    </details>
   </div>
  </div>
  {labelError&&<p className={styles.notice} role="status">Some selection names could not be loaded. Selections remain removable. <button type="button" onClick={()=>setRetry(n=>n+1)}>Retry names</button></p>}
  <p className={styles.summary} aria-live="polite">{summary}</p>
 </section></div>;
}
