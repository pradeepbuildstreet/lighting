"use client";
import {useEffect,useRef,useState,useTransition,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {buildListQuery,pageHref} from '@/lib/catalogue-client';
import {draftFromQuery,editFilters} from '@/lib/catalogue-filter-workspace.mjs';
import {applyGroupDraft} from '@/lib/tag-filter-draft.mjs';
import type {FilterDraft} from '@/lib/catalogue-filter-workspace.mjs';
import type {CatalogueQuery} from '@/lib/catalogue-types';
import {kindLabel} from '@/lib/catalogue-tag-presentation.mjs';
import {HoverChoice,HoverPopover} from './HoverControls';
import {CatalogueInlineFeatures} from './CatalogueInlineFeatures';
import styles from './StorefrontSkeleton.module.css';
import feedback from './TagFilterFeedback.module.css';
type Props={path:string;query:CatalogueQuery;fixedCategory?:{slug:string;name:string};choices:{categories:{value:string;label:string}[];brands:string[];currencies:string[];kinds?:string[]};facetsUnavailable:boolean};
export function CatalogueFilters({path,query,fixedCategory,choices,facetsUnavailable}:Props){
 const fixed=fixedCategory?.slug||'',key=buildListQuery(query).toString(),router=useRouter(),request=useRef(''),[draft,setDraft]=useState(()=>draftFromQuery(query,fixed)),[error,setError]=useState(''),[pending,startTransition]=useTransition();
 useEffect(()=>{setDraft(draftFromQuery(query,fixed));setError('');request.current='';},[key,fixed]);
 useEffect(()=>{if(!pending)request.current='';},[pending]);
 function navigate(next:FilterDraft):boolean{if(request.current)return false;try{const href=pageHref(path,buildListQuery({...next,page:1} as CatalogueQuery),1);setError('');if(href===pageHref(path,query,Number(query.page||1)))return true;request.current=href;startTransition(()=>router.push(href,{scroll:false}));return true;}catch(e){request.current='';setError(e instanceof Error?e.message:'Check your selections.');return false;}}
 function change(patch:Partial<FilterDraft>,apply=false){const next=editFilters(draft,patch,fixed);setDraft(next);setError('');if(apply)navigate(next);}
 function applyTags(group:string,value:string):boolean{try{const tag_filters=applyGroupDraft(query.tag_filters||'',group,value);return navigate(editFilters(draftFromQuery(query,fixed),{tag_filters},fixed));}catch(e){setError(e instanceof Error?e.message:'Check your feature selections.');return false;}}
 function submit(event:FormEvent){event.preventDefault();navigate(draft);}
 return <div className={styles.controls}><form onSubmit={submit} aria-label="Product features filters and sort" aria-busy={pending}>
 <CatalogueInlineFeatures query={query} value={query.tag_filters||''} onApply={applyTags} pending={pending}/>
 <HoverChoice label="Product kind" value={draft.kind} align="end" onChange={value=>change({kind:value},true)} options={[{value:'',label:'All kinds'},...Array.from(new Set([...(choices.kinds||[]),...(draft.kind?[draft.kind]:[])])).map(value=>({value,label:kindLabel(value)}))]}/>
 <HoverChoice label="Brand" value={draft.brand} align="end" onChange={value=>change({brand:value},true)} options={[{value:'',label:'All brands'},...Array.from(new Set([...choices.brands,...(draft.brand?[draft.brand]:[])])).map(value=>({value,label:value}))]}/>
 <HoverPopover label="Price" align="end" kind="dialog"><div className={styles.fields}><HoverChoice label="Currency" mobile value={draft.currency} onChange={value=>change({currency:value})} options={[{value:'',label:'All currencies'},...Array.from(new Set([...choices.currencies,...(draft.currency?[draft.currency]:[])])).map(value=>({value,label:value}))]}/><label>Minimum price<input type="number" min="0" max="999999999999.99" step="0.01" disabled={!draft.currency} value={draft.min_price} onChange={e=>change({min_price:e.target.value})}/></label><label>Maximum price<input type="number" min="0" max="999999999999.99" step="0.01" disabled={!draft.currency} value={draft.max_price} onChange={e=>change({max_price:e.target.value})}/></label>{!draft.currency&&<p className={styles.notice}>Select a currency for price limits and price sorting.</p>}<button type="submit" disabled={pending}>Apply price</button></div></HoverPopover>
 {(error||facetsUnavailable)&&<HoverPopover label={error?'Check selections':'Options status'} align="end" kind="dialog"><p className={styles.error} role={error?'alert':'status'}>{error||'Some filter options could not be refreshed. Existing selections are retained.'}</p></HoverPopover>}
 <HoverPopover label="Sort" align="end" kind="dialog"><div className={styles.fields}><fieldset className={styles.choices}><legend>Sort products</legend>{[{value:'name',label:'Name'},{value:'newest',label:'Newest'},{value:'price_asc',label:'Price: low to high'},{value:'price_desc',label:'Price: high to low'}].map(option=><label key={option.value} className={styles.choice}><input type="radio" name="catalogue-sort" value={option.value} checked={draft.sort===option.value} disabled={option.value.startsWith('price_')&&!draft.currency} onChange={()=>change({sort:option.value},true)}/>{option.label}</label>)}</fieldset><label>Per page<select value={draft.limit} onChange={e=>change({limit:e.target.value},true)}>{Array.from(new Set([20,50,100,Number(draft.limit||20)])).sort((a,b)=>a-b).map(n=><option key={n} value={n}>{n}</option>)}</select></label>{!draft.currency&&<p className={styles.notice}>Choose a currency under Price for price sorting.</p>}</div></HoverPopover>
 {pending&&<span role="status" className={feedback.pending}><span className={feedback.ring} aria-hidden="true"/>Applying filters…</span>}
 </form></div>;
}
