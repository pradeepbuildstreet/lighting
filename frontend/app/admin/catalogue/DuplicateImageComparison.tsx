"use client";
import {useEffect,useState} from 'react';
import {comparisonImages,comparisonRevisionChanged} from './duplicate-image-comparison.mjs';
type Row=Record<string,any>;
type Identity={id:string;sku:string;name:string;revision:number|string};
type Candidate={candidate_product_id:string;sku:string;name:string;current_revision:number|string};
function Photo({src,alt,small=false}:{src:string|null;alt:string;small?:boolean}){
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[src]);
 if(!src||failed)return <span role="status">{small?'Unavailable':'Image unavailable. Missing or failed images are not evidence that products are distinct.'}</span>;
 return <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)} style={{width:'100%',height:small?64:320,objectFit:'contain',background:'#fff'}}/>;
}
function Gallery({product,label,disabled}:{product:Identity;label:string;disabled:boolean}){
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
 return <article style={{minWidth:0,border:'1px solid #d1d5db',borderRadius:6,padding:12}} aria-label={label+' images'}>
  <h4>{label}: {product.sku||'SKU pending'}</h4><p>{product.name||'Unnamed product'}</p>
  <button type="button" disabled={disabled||loading} onClick={()=>setReload(n=>n+1)}>Reload {label.toLowerCase()} images</button>
  {loading&&<p role="status">Loading images…</p>}{error&&<p role="alert">{error}</p>}
  {state&&comparisonRevisionChanged(product.revision,state.revision)&&<p role="alert">Product revision differs from the review display or could not be verified. These are current images, not an audit snapshot. Refresh review state and rerun the audit before deciding.</p>}
  {state&&!state.images.length&&<p role="status">No product images available. Do not treat this as proof of uniqueness.</p>}
  {image&&<figure style={{margin:'12px 0'}}><Photo key={String(image.id)+':'+reload} src={image.src} alt={image.alt_text||image.caption||product.sku+' product image'}/><figcaption>{image.is_primary?'Primary image · ':''}{image.caption||image.alt_text||'Product image'}</figcaption>{image.src&&<a href={image.src} target="_blank" rel="noreferrer">Open full-size image in a new tab</a>}</figure>}
  {state&&state.images.length>0&&<div aria-label={label+' image choices'} style={{display:'flex',gap:8,flexWrap:'wrap'}}>{state.images.map((item,index)=><button type="button" key={item.id} disabled={disabled} aria-pressed={image?.id===item.id} aria-label={'Show '+label.toLowerCase()+' image '+(index+1)+(item.is_primary?' (primary)':'')} onClick={()=>setSelected(item.id)} style={{width:80,minHeight:80,padding:4,border:image?.id===item.id?'3px solid #183b30':'1px solid #d1d5db',background:'#fff',color:'#183b30'}}><Photo key={String(item.id)+':'+reload} src={item.src} alt="" small/></button>)}</div>}
  <p><a href={'/admin/catalogue?product='+encodeURIComponent(product.id)+'&mode=view'} target="_blank" rel="noreferrer">Open full product details</a></p>
 </article>;
}
export default function DuplicateImageComparison({subject,candidates,disabled=false}:{subject:Identity;candidates:Candidate[];disabled?:boolean}){
 const [selected,setSelected]=useState(candidates[0]?.candidate_product_id||'');
 const candidate=candidates.find(item=>item.candidate_product_id===selected)||candidates[0];
 return <section aria-label="Duplicate product image comparison"><h3>Compare product images</h3>
 <p>Compare shape, finish, details and all available views alongside the audit evidence. Images below are current product media, not saved audit-time snapshots. Visual similarity alone does not confirm a duplicate.</p>
 {!!candidates.length&&<label className="field">Candidate to compare<select disabled={disabled} value={candidate?.candidate_product_id||''} onChange={e=>setSelected(e.target.value)}>{candidates.map(item=><option key={item.candidate_product_id} value={item.candidate_product_id}>{item.sku} — {item.name}</option>)}</select></label>}
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,320px),1fr))',gap:16,margin:'12px 0'}}>
 <Gallery key={'subject:'+subject.id} product={subject} label="Subject product" disabled={disabled}/>
 {candidate?<Gallery key={'candidate:'+candidate.candidate_product_id} product={{id:candidate.candidate_product_id,sku:candidate.sku,name:candidate.name,revision:candidate.current_revision}} label="Candidate product" disabled={disabled}/>:<p>No audit candidates to compare. No matches is not proof of uniqueness.</p>}
 </div></section>;
}
