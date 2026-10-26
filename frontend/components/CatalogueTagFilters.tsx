"use client";
import {useEffect,useMemo,useState} from 'react';
import {buildListQuery} from '@/lib/catalogue-client';
import type {CatalogueQuery} from '@/lib/catalogue-types';
import {parseTagSelections,encodeTagSelections,toggleTagChoice,toggleUnclassifiedChoice} from '@/lib/catalogue-tag-filter-model.mjs';
import {loadTagFacets,tagFacetParams} from '@/lib/catalogue-tag-facets.mjs';
import type {TagFacets,TagOptions} from '@/lib/catalogue-tag-facets.mjs';
import type {TagSelection} from '@/lib/catalogue-tag-filter-model.mjs';
import styles from './CatalogueFilterWorkspace.module.css';
type Props={query:CatalogueQuery;value:string;onChange:(value:string)=>void};
export function CatalogueTagFilters({query,value,onChange}:Props){
 const selected=useMemo(()=>parseTagSelections(value),[value]),base=buildListQuery(query).toString();
 const [facets,setFacets]=useState<TagFacets|null>(null),[options,setOptions]=useState<TagOptions|null>(null),[optionsKey,setOptionsKey]=useState(''),[open,setOpen]=useState(''),[page,setPage]=useState(1),[retry,setRetry]=useState(0),[groupBusy,setGroupBusy]=useState(true),[optionBusy,setOptionBusy]=useState(false),[groupError,setGroupError]=useState(''),[optionError,setOptionError]=useState(''),[choiceError,setChoiceError]=useState('');
 const metadataQuery=tagFacetParams(new URLSearchParams(base),value).toString();
 const optionQuery=open?tagFacetParams(new URLSearchParams(base),value,open,'',page).toString():'';
 useEffect(()=>{let live=true;const ctl=new AbortController();setGroupBusy(true);setGroupError('');const timer=setTimeout(()=>{void loadTagFacets(new URLSearchParams(metadataQuery),{signal:ctl.signal}).then(data=>{if(live)setFacets(data);}).catch(e=>{if(live&&!ctl.signal.aborted)setGroupError(e instanceof Error?e.message:'Feature filters are unavailable.');}).finally(()=>{if(live)setGroupBusy(false);});},150);return()=>{live=false;clearTimeout(timer);ctl.abort();};},[metadataQuery,retry]);
 useEffect(()=>{if(!optionQuery){setOptions(null);setOptionBusy(false);return;}let live=true;const ctl=new AbortController();setOptionBusy(true);setOptionError('');const timer=setTimeout(()=>{void loadTagFacets(new URLSearchParams(optionQuery),{signal:ctl.signal}).then(data=>{if(live){setOptions(data.options);setOptionsKey(optionQuery);}}).catch(e=>{if(live&&!ctl.signal.aborted)setOptionError(e instanceof Error?e.message:'Feature choices are unavailable.');}).finally(()=>{if(live)setOptionBusy(false);});},200);return()=>{live=false;clearTimeout(timer);ctl.abort();};},[optionQuery,retry]);
 function change(make:()=>TagSelection[]){try{onChange(encodeTagSelections(make()));setChoiceError('');}catch(e){setChoiceError(e instanceof Error?e.message:'Check the selected features.');}}
 if(facets&&!facets.groups.length&&!selected.length&&!groupBusy&&!groupError)return null;
 return <section aria-label="Feature groups">
 {selected.length>0&&<button className={styles.clear} type="button" onClick={()=>change(()=>[])}>Clear feature filters</button>}
 {groupBusy&&<p className={styles.hint} role="status">Updating features…</p>}
 {(groupError||optionError||choiceError)&&<div role="alert"><p>{groupError||optionError||choiceError}</p><button className={styles.secondary} type="button" onClick={()=>setRetry(n=>n+1)}>Retry filter options</button></div>}
 {facets?.groups.map(g=>{
  const expanded=open===g.id,row=selected.find(s=>s.group_id===g.id),current=optionsKey===optionQuery&&options?.group_id===g.id?options:null,missing=current?.not_classified_count??g.not_classified_count,n=(row?.tag_ids.length||0)+(row?.unclassified?1:0);
  const hasMore=!!current&&current.pagination.page<10000&&current.pagination.page*current.pagination.limit<current.pagination.total;
  return <div key={g.id} className={styles.group}>
   <div className={styles.groupHead}><button type="button" className={styles.toggle} aria-expanded={expanded} onClick={()=>{setOpen(expanded?'':g.id);setPage(1);setOptions(null);}}><span>{g.name}{n?` (${n})`:''}</span><span aria-hidden="true">{expanded?'−':'+'}</span></button>{n>0&&<button className={styles.clear} type="button" aria-label={'Clear '+g.name} onClick={()=>change(()=>selected.filter(s=>s.group_id!==g.id))}>Clear</button>}</div>
   {expanded&&<fieldset><legend>{g.name}</legend>
    {current?.items.map(t=><label className={styles.choice} key={t.id}><input type="checkbox" checked={row?.tag_ids.includes(t.id)||false} disabled={optionBusy||(!t.product_count&&!row?.tag_ids.includes(t.id))} onChange={()=>change(()=>toggleTagChoice(selected,g.id,t.id))}/><span>{t.name}</span><small>{t.product_count}</small></label>)}
    {(missing>0||row?.unclassified)&&<label className={styles.choice}><input type="checkbox" checked={!!row?.unclassified} disabled={optionBusy||(!missing&&!row?.unclassified)} onChange={()=>change(()=>toggleUnclassifiedChoice(selected,g.id))}/><span>Not classified</span><small>{missing}</small></label>}
    {optionBusy&&<p role="status" className={styles.hint}>Updating choices…</p>}
    {current&&!optionBusy&&!current.items.length&&!(missing>0)&&<p className={styles.hint}>No matching options.</p>}
    {current&&!optionBusy&&(current.pagination.page>1||hasMore)&&<div className={styles.pages}>{current.pagination.page>1&&<button type="button" onClick={()=>setPage(p=>Math.max(1,p-1))}>Previous</button>}{hasMore&&<button type="button" onClick={()=>setPage(p=>p+1)}>More options</button>}</div>}
   </fieldset>}
  </div>;
 })}
 </section>;
}
