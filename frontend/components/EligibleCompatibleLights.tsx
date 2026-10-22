"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {CatalogueProductCards} from './CatalogueProductCards';
import type {CatalogueProduct} from '@/lib/catalogue-types';
type Group={id:string;code:string;socket_count:number;products:CatalogueProduct[];pagination:{page:number;pages:number}};
export function EligibleCompatibleLights({fixtureId}:{fixtureId:string}){
 const [view,setView]=useState<{id:string;groups:Group[]}>({id:'',groups:[]}),[busy,setBusy]=useState(false);
 const generation=useRef(0),controllers=useRef(new Set<AbortController>());
 const load=useCallback(async(groupId?:string,page=1)=>{const run=generation.current,ac=new AbortController();controllers.current.add(ac);const timer=window.setTimeout(()=>ac.abort(),15000);setBusy(true);
 try{const params=new URLSearchParams({page:String(page)});if(groupId)params.set('group_id',groupId);const response=await fetch('/api/product-insights/compatible-lights/'+encodeURIComponent(fixtureId)+'?'+params,{cache:'no-store',signal:ac.signal});if(!response.ok)throw Error();const data=await response.json();if(run!==generation.current)return;if(data.status!=='current'||!Array.isArray(data.groups)){setView({id:fixtureId,groups:[]});return;}const groups:Group[]=data.groups.filter((g:Group)=>Array.isArray(g.products)&&g.products.length>0);setView(previous=>({id:fixtureId,groups:groupId&&previous.id===fixtureId?previous.groups.filter(g=>g.id!==groupId).concat(groups):groups}));}
 catch(_){if(run===generation.current)setView({id:fixtureId,groups:[]});}
 finally{window.clearTimeout(timer);controllers.current.delete(ac);if(run===generation.current)setBusy(false);}},[fixtureId]);
 useEffect(()=>{generation.current+=1;setView({id:fixtureId,groups:[]});void load();return()=>{generation.current+=1;for(const ac of controllers.current)ac.abort();controllers.current.clear();};},[fixtureId,load]);
 if(view.id!==fixtureId||!view.groups.length)return null;
 return <section className="my-8" aria-labelledby="eligible-compatible-lights"><h2 id="eligible-compatible-lights" className="text-2xl font-semibold mb-4">Compatible lights</h2><p className="mb-6">Selected against the recorded socket-group rules. Confirm your final lighting selection with Luminoza.</p>{view.groups.map(g=><div key={g.id} className="my-6"><h3 className="text-xl mb-4">{g.code} · {g.socket_count} socket{g.socket_count===1?'':'s'}</h3><CatalogueProductCards products={g.products}/><nav className="flex gap-6 my-4" aria-label={'Compatible lights for '+g.code}>{g.pagination.page>1&&<button type="button" disabled={busy} onClick={()=>void load(g.id,g.pagination.page-1)}>Previous lights</button>}{g.pagination.page<g.pagination.pages&&<button type="button" disabled={busy} onClick={()=>void load(g.id,g.pagination.page+1)}>More compatible lights</button>}</nav></div>)}</section>;
}
