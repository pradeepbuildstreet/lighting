"use client";
import {useEffect,useMemo,useState} from 'react';
import {buildListQuery} from '@/lib/catalogue-client';
import type {CatalogueQuery} from '@/lib/catalogue-types';
import {parseTagSelections,encodeTagSelections,toggleTagChoice,toggleUnclassifiedChoice} from '@/lib/catalogue-tag-filter-model.mjs';
import {groupDraft} from '@/lib/tag-filter-draft.mjs';
import {createFacetCache} from '@/lib/tag-facet-cache.mjs';
import {loadTagFacets,tagFacetParams} from '@/lib/catalogue-tag-facets.mjs';
import type {TagFacets,TagGroup,TagOptions} from '@/lib/catalogue-tag-facets.mjs';
import {HoverPopover} from './HoverControls';
import styles from './StorefrontSkeleton.module.css';
const loadCachedFacets=createFacetCache(loadTagFacets);
type Props={query:CatalogueQuery;value:string;onApply:(group:string,draft:string)=>boolean;pending:boolean};
function Choices({query,value,onApply,pending,group,close}:Props&{group:TagGroup;close:()=>void}){
 const initialDraft=groupDraft(value,group.id),[draft,setDraft]=useState(initialDraft),selected=useMemo(()=>parseTagSelections(draft),[draft]),row=selected.find(s=>s.group_id===group.id),[page,setPage]=useState(1),[retry,setRetry]=useState(0),[data,setData]=useState<TagOptions|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const key=tagFacetParams(buildListQuery(query),value,group.id,'',page).toString();
 useEffect(()=>{const ctl=new AbortController();setBusy(true);setError('');void loadCachedFacets(new URLSearchParams(key),{signal:ctl.signal,bypass:retry>0}).then(result=>{if(!ctl.signal.aborted)setData(result.options);}).catch(e=>{if(!ctl.signal.aborted)setError(e instanceof Error?e.message:'Choices unavailable.');}).finally(()=>{if(!ctl.signal.aborted)setBusy(false);});return()=>ctl.abort();},[key,retry]);
 function change(make:()=>ReturnType<typeof parseTagSelections>){try{setDraft(encodeTagSelections(make()));setError('');}catch(e){setError(e instanceof Error?e.message:'Check your selections.');}}
 function apply(){if(pending)return;if(onApply(group.id,draft))close();else setError('Selections could not be applied. Check the filter status and retry.');}
 function go(next:number){setRetry(n=>next===page?n+1:0);setPage(next);}
 const missing=data?.not_classified_count??group.not_classified_count,shownPage=data?.pagination.page||page;
 return <div className={styles.fields}><fieldset className={styles.choices}><legend>{group.name}</legend>{data?.items.map(item=><label key={item.id} className={styles.choice}><input type="checkbox" checked={row?.tag_ids.includes(item.id)||false} disabled={!item.product_count&&!row?.tag_ids.includes(item.id)} onChange={()=>change(()=>toggleTagChoice(selected,group.id,item.id))}/><span>{item.name}</span><small>{item.product_count}</small></label>)}{(missing>0||row?.unclassified)&&<label className={styles.choice}><input type="checkbox" checked={!!row?.unclassified} onChange={()=>change(()=>toggleUnclassifiedChoice(selected,group.id))}/><span>Not classified</span><small>{missing}</small></label>}</fieldset>{busy&&<p role="status" className={styles.notice}>{data?'Refreshing options…':'Loading choices…'}</p>}{error&&<div role="alert" className={styles.error}>{error}<button type="button" className={styles.retry} onClick={()=>setRetry(n=>n+1)}>Retry</button></div>}{data&&<div>{shownPage>1&&<button type="button" disabled={busy} onClick={()=>go(shownPage-1)}>Previous</button>}{shownPage*data.pagination.limit<data.pagination.total&&shownPage<10000&&<button type="button" disabled={busy} onClick={()=>go(shownPage+1)}>More options</button>}</div>}<p className={styles.notice}>{draft!==initialDraft?'Selections not applied. Counts reflect the applied filters.':'Counts reflect the applied filters.'}</p><button type="button" disabled={pending} onClick={()=>{setDraft('');setError('');}}>Clear {group.name}</button><button type="button" disabled={pending} onClick={apply}>{pending?'Applying…':'Apply selections'}</button></div>;
}
function Groups(props:Props){
 const {query,value}=props,key=tagFacetParams(buildListQuery(query),value).toString(),[data,setData]=useState<TagFacets|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{const ctl=new AbortController();setError('');void loadCachedFacets(new URLSearchParams(key),{signal:ctl.signal,bypass:retry>0}).then(result=>{if(!ctl.signal.aborted)setData(result);}).catch(e=>{if(!ctl.signal.aborted)setError(e instanceof Error?e.message:'Features unavailable.');});return()=>ctl.abort();},[key,retry]);
 return <div className={styles.features} aria-label="Feature controls">{data?.groups.map(group=><HoverPopover key={group.id} label={group.name} align="end" kind="dialog">{close=><Choices {...props} group={group} close={close}/>}</HoverPopover>)}{!data&&!error&&<span role="status" className={styles.notice}>Loading features…</span>}{error&&<button type="button" className={styles.retry} title={error} onClick={()=>setRetry(n=>n+1)}>Retry features</button>}</div>;
}
export function CatalogueInlineFeatures(props:Props){const key=tagFacetParams(buildListQuery(props.query),props.value).toString();return <Groups key={key} {...props}/>;}
