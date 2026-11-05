"use client";
import {useEffect,useState} from 'react';
import {comparisonImages,comparisonRevisionChanged} from './duplicate-image-comparison.mjs';
import {productIdentifier} from '@/lib/admin-product-identity.mjs';
type Row=Record<string,any>;
type Identity={id:string;sku:string;name:string;revision:number|string;model_number?:string|null};
type Candidate={candidate_product_id:string;sku:string;name:string;current_revision:number|string;model_number?:string|null};
function label(product:Identity){return product.model_number===undefined?(product.sku||'SKU pending')+' (code unavailable)':productIdentifier(product);}
function Photo({src,alt,small=false}:{src:string|null;alt:string;small?:boolean}){
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[src]);
 if(!src||failed)return <span role="status">{small?'Unavailable':'Image unavailable. Missing or failed images are not evidence that products are distinct.'}</span>;
 return <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)} style={{width:'100%',height:small?64:320,objectFit:'contain',background:'#fff'}}/>;
}
function Gallery({product,label:heading,disabled}:{product:Identity;label:string;disabled:boolean}){
 const [state,setState]=useState<{revision:unknown;images:Row[]}|null>(null),[selected,setSelected]=useState(''),[reload,setReload]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{
  let live=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
  setState(null);setSelected('');setLoading(true);setError('');
  void fetch('/api/admin/catalogue/products/'+encodeURIComponent(product.id)+'/extensions',{credentials:'same-origin',cache:'no-store',signal:controller.signal}).then(async response=>{
   const data=await response.json();if(!response.ok)throw Error(data.error||'Could not load product images');
   const images=comparisonImages(product.id,data.media);
   if(live){setState({revision:data.revision,images});setSelected(images[0]?.id||'');}
  }).catch(e=>{if(live)setError(e.name==='AbortError'?'Image loading timed out. Retry loading images.':e.message);}).finally(()=>{clearTimeout(timer);if(live)setLoading(false);});
  return()=>{live=false;clearTimeout(timer);controller.abort();};
 },[product.id,product.revision,reload]);
 const image=state?.images.find(item=>item.id===selected)||state?.images[0];
 return <article style={{minWidth:0,border:'1px solid #d1d5db',borderRadius:6,padding:12}} aria-label={heading+' images'}>
  <h4>{heading}: {label(product)}</h4><p>{product.name||'Unnamed product'}</p>
  <button type="button" disabled={disabled||loading} onClick={()=>setReload(n=>n+1)}>Reload {heading.toLowerCase()} images</button>
  {loading&&<p role="status">Loading images…</p>}{error&&<p role="alert">{error}</p>}
  {state&&comparisonRevisionChanged(product.revision,state.revision)&&<p role="alert">Product revision differs from the review display or could not be verified. These are current images, not an audit snapshot. Refresh review state and rerun the audit before deciding.</p>}
  {state&&!state.images.length&&<p role="status">No product images available. Do not treat this as proof of uniqueness.</p>}
  {image&&<figure style={{margin:'12px 0'}}><Photo key={String(image.id)+':'+reload} src={image.src} alt={image.alt_text||image.caption||product.sku+' product image'}/><figcaption>{image.is_primary?'Primary image · ':''}{image.caption||image.alt_text||'Product image'}</figcaption>{image.src&&<a href={image.src} target="_blank" rel="noreferrer">Open full-size image in a new tab</a>}</figure>}
  {state&&state.images.length>0&&<div aria-label={heading+' image choices'} style={{display:'flex',gap:8,flexWrap:'wrap'}}>{state.images.map((item,index)=><button type="button" key={item.id} disabled={disabled} aria-pressed={image?.id===item.id} aria-label={'Show '+heading.toLowerCase()+' image '+(index+1)+(item.is_primary?' (primary)':'')} onClick={()=>setSelected(item.id)} style={{width:80,minHeight:80,padding:4,border:image?.id===item.id?'3px solid #183b30':'1px solid #d1d5db',background:'#fff',color:'#183b30'}}><Photo key={String(item.id)+':'+reload} src={item.src} alt="" small/></button>)}</div>}
  <p><a href={'/admin/catalogue?product='+encodeURIComponent(product.id)+'&mode=view'} target="_blank" rel="noreferrer">Open full product details</a></p>
 </article>;
}
export default function DuplicateImageComparison({subject,candidates,disabled=false}:{subject:Identity;candidates:Candidate[];disabled?:boolean}){
 const [selected,setSelected]=useState(candidates[0]?.candidate_product_id||''),[identities,setIdentities]=useState<Record<string,Identity>>({}),[codeError,setCodeError]=useState('');
 const candidateKey=candidates.map(item=>item.candidate_product_id+':'+item.current_revision).join('|');
 useEffect(()=>{
  let live=true,next=0;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
  setIdentities({});setCodeError('');
  async function worker(){while(next<candidates.length&&!controller.signal.aborted){const item=candidates[next++];try{
   const response=await fetch('/api/admin/catalogue/taxonomy/products-v2/'+encodeURIComponent(item.candidate_product_id),{credentials:'same-origin',cache:'no-store',signal:controller.signal}),data=await response.json();
   if(!response.ok||data.product?.id!==item.candidate_product_id)throw Error('Product code lookup failed');
   if(live)setIdentities(old=>({...old,[item.candidate_product_id]:data.product}));
  }catch{if(live)setCodeError('Some candidate codes could not be loaded. Images and review remain available; refresh review state to retry.');}}}
  void Promise.all(Array.from({length:Math.min(3,candidates.length)},()=>worker())).finally(()=>clearTimeout(timer));
  return()=>{live=false;clearTimeout(timer);controller.abort();};
 },[candidateKey]);
 const candidate=candidates.find(item=>item.candidate_product_id===selected)||candidates[0];
 const comparison=candidate?{id:candidate.candidate_product_id,sku:candidate.sku,name:candidate.name,revision:candidate.current_revision,model_number:identities[candidate.candidate_product_id]?.model_number??candidate.model_number}:null;
 return <section aria-label="Duplicate product image comparison"><h3>Compare product images</h3>
 <p>Compare shape, finish, details and all available views alongside the audit evidence. Images below are current product media, not saved audit-time snapshots. Visual similarity alone does not confirm a duplicate.</p>
 {codeError&&<p role="status">{codeError}</p>}
 {!!candidates.length&&<label className="field">Candidate to compare<select disabled={disabled} value={candidate?.candidate_product_id||''} onChange={e=>setSelected(e.target.value)}>{candidates.map(item=><option key={item.candidate_product_id} value={item.candidate_product_id}>{identities[item.candidate_product_id]?productIdentifier(identities[item.candidate_product_id]):item.model_number!==undefined?productIdentifier(item):item.sku+(codeError?' (code unavailable)':' (loading code…)')} — {item.name}</option>)}</select></label>}
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,320px),1fr))',gap:16,margin:'12px 0'}}>
 <Gallery key={'subject:'+subject.id} product={subject} label="Subject product" disabled={disabled}/>
 {comparison?<Gallery key={'candidate:'+comparison.id} product={comparison} label="Candidate product" disabled={disabled}/>:<p>No audit candidates to compare. No matches is not proof of uniqueness.</p>}
 </div></section>;
}
