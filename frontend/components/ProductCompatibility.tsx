"use client";
import {EligibleCompatibleLights} from './EligibleCompatibleLights';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {getCatalogueClient,productHref,formatPrice,CatalogueError} from '@/lib/catalogue-client';
import type {CatalogueCompatibility} from '@/lib/catalogue-types';
import {compatibilityRows,compatibilityPages,reasonText,statusInfo} from '@/lib/product-details-model';
import styles from './ProductDetails.module.css';
type Props={fixtureId:string;mode:'replaceable'|'integrated'|'hybrid'|'unknown'};
function SavedIntegratedCompatibility({fixtureId,mode}:Props){
 const [state,setState]=useState<'idle'|'loading'|'ready'|'error'>('idle'),[data,setData]=useState<CatalogueCompatibility|null>(null),[message,setMessage]=useState(''),[group,setGroup]=useState(''),[filter,setFilter]=useState('all');
 const controller=useRef<AbortController|null>(null),generation=useRef(0);
 useEffect(()=>()=>{generation.current+=1;controller.current?.abort();},[fixtureId]);
 async function load(page=1){const run=++generation.current;controller.current?.abort();const ac=new AbortController();controller.current=ac;setState('loading');setData(null);setMessage('');
  try{const result=await getCatalogueClient().compatibility(fixtureId,{page,limit:20},{signal:ac.signal});if(run!==generation.current)return;setData(result);setState('ready');}
  catch(e){if(run!==generation.current)return;setState('error');setMessage(e instanceof CatalogueError&&e.code==='not_found'?'The fixture is no longer available for public compatibility checks.':e instanceof CatalogueError&&e.code==='rate_limited'?'Too many requests. Please wait before trying again.':e instanceof CatalogueError&&e.code==='timeout'?'The compatibility request timed out. Try again.':'Compatibility is temporarily unavailable. No verdict has been assumed.');}
 }
 if(mode==='integrated')return <section className={styles.section}><h2>Light-source configuration</h2><p className={styles.notice}>This fixture has an integrated light source. Replaceable-light compatibility options do not apply.</p></section>;
 const view=data?compatibilityRows(data,group,filter):null,pages=data?compatibilityPages(data.pagination):null;
 return <section className={styles.section} aria-labelledby="fixture-compatibility-title"><h2 id="fixture-compatibility-title">Light compatibility</h2><p className={styles.meta}>Results evaluate stored rules for each socket group. They are not a certification of the complete fixture.</p>
 {state==='idle'&&<><p>Load the current eligible light candidates and their compatibility checks.</p><button className={styles.button} type="button" onClick={()=>void load()}>Check light compatibility</button></>}
 {state==='loading'&&<p role="status" aria-live="polite" className={styles.notice}>Loading compatibility checks…</p>}
 {state==='error'&&<div className={styles.notice} role="alert"><p>{message}</p><button type="button" className={styles.button} onClick={()=>void load()}>Try again</button></div>}
 {data&&view&&<>
 {data.mode==='integrated'?<p className={styles.notice}>The saved configuration now uses an integrated source. No replaceable-light candidates apply.</p>:view.unconfigured?<p className={styles.notice}>No socket groups are configured. A compatibility verdict is not available.</p>:<>
 <div className={styles.controls}><label>Socket group<select value={view.groupId||''} onChange={e=>setGroup(e.target.value)}>{data.groups.map(g=><option key={g.id} value={g.id}>{g.code} ({g.socket_count} socket{g.socket_count===1?'':'s'})</option>)}</select></label><label>Filter this page<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All verdicts</option><option value="compatible">Configured-rule matches</option><option value="unverified">Unverified</option><option value="exception_approved">Approved exceptions</option><option value="incompatible">Incompatible</option><option value="exception_rejected">Rejected exceptions</option></select></label></div>
 <p className={styles.meta}>Showing {view.shown} of {view.evaluated} candidates on this page; {view.total} eligible lights across all pages. These totals are not counts of compatible matches.</p>
 {data.warning&&<p className={styles.notice}>{data.warning}</p>}
 {view.rows.map(row=><article key={row.product.id} className={styles.candidate}><h3><Link prefetch={false} href={productHref(row.product.sku)}>{row.product.name}</Link></h3><p className={styles.meta}>{row.product.sku} · {formatPrice(row.product.price,row.product.currency)}</p><p className={`${styles.verdict} ${styles[row.display.tone]}`}>{row.display.label}</p>
 {row.verdict&&<><p>Technical result: {statusInfo(row.verdict.technical_status).label}</p>{row.verdict.exception&&<p className={`${styles.notice} ${styles.warning}`}>Manual decision: {row.verdict.exception.decision==='approve'?'approved':'rejected'}. {row.verdict.exception.warning} This does not replace the technical result.</p>}
 {!!row.verdict.reasons.length&&<><h4>Checks not met</h4><ul className={styles.reasons}>{row.verdict.reasons.map((r,i)=><li key={r+'-'+i}>{reasonText(r)}</li>)}</ul></>}
 {!!row.verdict.missing.length&&<><h4>Missing information</h4><ul className={styles.reasons}>{row.verdict.missing.map((r,i)=><li key={r+'-'+i}>{reasonText(r)}</li>)}</ul></>}
 </>}</article>)}
 {!view.rows.length&&<p className={styles.notice}>{view.outOfRange?'This candidate page is outside the current result range.':!view.total?'No eligible light products are available.':'No candidates match this group/filter on this page. Other pages may contain matches.'}</p>}
 {pages&&<nav className={styles.pager} aria-label="Compatibility candidate pages">{!view.outOfRange&&data.pagination.pages>0&&<span>Page {data.pagination.page} of {data.pagination.pages}</span>}{pages.previous!==null&&<button className={styles.button} type="button" onClick={()=>void load(pages.previous!)}>Previous candidates</button>}{pages.next!==null&&<button className={styles.button} type="button" onClick={()=>void load(pages.next!)}>Next candidates</button>}{pages.first!==null&&<button className={styles.button} type="button" onClick={()=>void load(pages.first!)}>First candidate page</button>}</nav>}
 </>}
 </>}
 </section>;
}

export function ProductCompatibility(props:Parameters<typeof SavedIntegratedCompatibility>[0]){return props.mode==='integrated'?<SavedIntegratedCompatibility {...props}/>:<EligibleCompatibleLights fixtureId={props.fixtureId}/>;}
