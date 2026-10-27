"use client";
import {useEffect,useMemo,useState} from 'react';
import {buildListQuery} from '@/lib/catalogue-client';
import type {CatalogueQuery} from '@/lib/catalogue-types';
import {parseTagSelections,encodeTagSelections,toggleTagChoice,toggleUnclassifiedChoice} from '@/lib/catalogue-tag-filter-model.mjs';
import {loadTagFacets,tagFacetParams} from '@/lib/catalogue-tag-facets.mjs';
import type {TagFacets,TagGroup,TagOptions} from '@/lib/catalogue-tag-facets.mjs';
import {HoverPopover} from './HoverControls';
import styles from './StorefrontSkeleton.module.css';
type Props={query:CatalogueQuery;value:string;onChange:(value:string)=>void};
function Choices({query,value,onChange,group}:{query:CatalogueQuery;value:string;onChange:(value:string)=>void;group:TagGroup}){
 const selected=useMemo(()=>parseTagSelections(value),[value]),row=selected.find(s=>s.group_id===group.id),[page,setPage]=useState(1),[retry,setRetry]=useState(0),[data,setData]=useState<TagOptions|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const key=tagFacetParams(buildListQuery(query),value,group.id,'',page).toString();
 useEffect(()=>{const ctl=new AbortController();setBusy(true);setError('');setData(null);void loadTagFacets(new URLSearchParams(key),{signal:ctl.signal}).then(result=>{if(!ctl.signal.aborted)setData(result.options);}).catch(e=>{if(!ctl.signal.aborted)setError(e instanceof Error?e.message:'Choices unavailable.');}).finally(()=>{if(!ctl.signal.aborted)setBusy(false);});return()=>ctl.abort();},[key,retry]);
 function change(make:()=>ReturnType<typeof parseTagSelections>){try{onChange(encodeTagSelections(make()));setError('');}catch(e){setError(e instanceof Error?e.message:'Check your selections.');}}
 const missing=data?.not_classified_count??group.not_classified_count;
 return <div className={styles.fields}><fieldset className={styles.choices}><legend>{group.name}</legend>{data?.items.map(item=><label key={item.id} className={styles.choice}><input type="checkbox" checked={row?.tag_ids.includes(item.id)||false} disabled={busy||(!item.product_count&&!row?.tag_ids.includes(item.id))} onChange={()=>change(()=>toggleTagChoice(selected,group.id,item.id))}/><span>{item.name}</span><small>{item.product_count}</small></label>)}{(missing>0||row?.unclassified)&&<label className={styles.choice}><input type="checkbox" checked={!!row?.unclassified} disabled={busy} onChange={()=>change(()=>toggleUnclassifiedChoice(selected,group.id))}/><span>Not classified</span><small>{missing}</small></label>}</fieldset>{busy&&<p role="status" className={styles.notice}>Loading choices…</p>}{error&&<div role="alert" className={styles.error}>{error}<button type="button" className={styles.retry} onClick={()=>setRetry(n=>n+1)}>Retry</button></div>}{data&&!busy&&<div>{page>1&&<button type="button" onClick={()=>setPage(p=>p-1)}>Previous</button>}{page*data.pagination.limit<data.pagination.total&&page<10000&&<button type="button" onClick={()=>setPage(p=>p+1)}>More options</button>}</div>}<button type="button" onClick={()=>change(()=>selected.filter(s=>s.group_id!==group.id))}>Clear {group.name}</button><button type="submit">Apply selections</button></div>;
}
export function CatalogueInlineFeatures({query,value,onChange}:Props){
 const key=tagFacetParams(buildListQuery(query),value).toString(),[data,setData]=useState<TagFacets|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{const ctl=new AbortController();setError('');void loadTagFacets(new URLSearchParams(key),{signal:ctl.signal}).then(result=>{if(!ctl.signal.aborted)setData(result);}).catch(e=>{if(!ctl.signal.aborted)setError(e instanceof Error?e.message:'Features unavailable.');});return()=>ctl.abort();},[key,retry]);
 return <div className={styles.features} aria-label="Feature controls">{data?.groups.map(group=><HoverPopover key={group.id} label={group.name} align="end" kind="dialog"><Choices query={query} value={value} onChange={onChange} group={group}/></HoverPopover>)}{!data&&!error&&<span role="status" className={styles.notice}>Loading features…</span>}{error&&<button type="button" className={styles.retry} title={error} onClick={()=>setRetry(n=>n+1)}>Retry features</button>}</div>;
}
