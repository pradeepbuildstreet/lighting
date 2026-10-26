"use client";
import {useCallback,useEffect,useState} from 'react';
import {API_BASE_URL} from '@/lib/api-base';
import {offerRupeesOrNaN} from '@/lib/offer-pricing';
import {effectiveOfferStatus,statusLabel} from '@/lib/admin-ui-model.mjs';
import {useAdminNavigationGuard} from '@/lib/use-admin-navigation-guard';
type Product={product_id:string;sku:string;name:string;price:number;quantity:number};
type Enquiry={share_token:string;customer_name?:string|null;mobile_number?:string|null;items:Product[]};
type AvailabilityLine={product_id:string;sku:string;name:string;requested_quantity:number;available_quantity:number;unavailable_quantity:number;note:string};
type Availability={version:string;snapshot:AvailabilityLine[]};
type Offer={offer_token:string;version:number;status:string;expires_at:string|null;created_at:string};
type Terms={gst:string;payment_terms:string;payment_details:string;delivery_days:string;other_terms:string};
const money=(v:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(v);
export function OfferManager({enquiry}:{enquiry:Enquiry}){
 const [prices,setPrices]=useState<Record<string,string>>({}),[discounts,setDiscounts]=useState<Record<string,string>>({});
 const [saved,setSaved]=useState<Availability|null>(null),[quantities,setQuantities]=useState<Record<string,string>>({}),[notes,setNotes]=useState<Record<string,string>>({});
 const [offers,setOffers]=useState<Offer[]>([]),[terms,setTerms]=useState<Terms>({gst:'',payment_terms:'',payment_details:'',delivery_days:'',other_terms:''}),[expiry,setExpiry]=useState('');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState(''),[origin,setOrigin]=useState(''),[draftChanged,setDraftChanged]=useState(false);
 const availabilityDirty=!!saved&&saved.snapshot.some(i=>quantities[i.product_id]!==String(i.available_quantity)||(notes[i.product_id]||'').trim()!==i.note);
 useAdminNavigationGuard(draftChanged||availabilityDirty,busy,'offer');
 const adopt=(state:Availability)=>{setSaved(state);setQuantities(Object.fromEntries(state.snapshot.map(i=>[i.product_id,String(i.available_quantity)])));setNotes(Object.fromEntries(state.snapshot.map(i=>[i.product_id,i.note])));};
 const base=`${API_BASE_URL}/offers/enquiry/${encodeURIComponent(enquiry.share_token)}`;
 const request=useCallback(async(url:string,init?:RequestInit)=>{const r=await fetch(url,{...init,credentials:'include',cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.error||'Could not process quotation.');return data;},[]);
 const history=useCallback(async()=>{const data=await request(base);setOffers(data.offers||[]);},[base,request]);
 useEffect(()=>{let active=true;setLoading(true);setSaved(null);setError('');setOrigin(window.location.origin);setDraftChanged(false);
  setPrices(Object.fromEntries(enquiry.items.map(i=>[i.product_id,String(Math.floor(Number(i.price)))])));
  setDiscounts(Object.fromEntries(enquiry.items.map(i=>[i.product_id,Number(i.price)?String(Math.round((Number(i.price)-Math.floor(Number(i.price)))/Number(i.price)*10000)/100):'0'])));
  Promise.all([request(base+'/availability'),request(base)]).then(([a,h])=>{if(active){adopt(a.availability);setOffers(h.offers||[]);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[base,enquiry.items,request]);
 const invalidAvailability=!saved||enquiry.items.some(i=>!i.product_id||!/^\d+$/.test(quantities[i.product_id]??'')||!Number.isSafeInteger(Number(quantities[i.product_id]))||Number(quantities[i.product_id])>Number(i.quantity)||(notes[i.product_id]||'').trim().length>1000);
 const included=enquiry.items.filter(i=>Number(quantities[i.product_id])>0);
 const excluded=enquiry.items.filter(i=>Number.isFinite(Number(quantities[i.product_id]))&&Number(quantities[i.product_id])<Number(i.quantity));
 const listTotal=included.reduce((s,i)=>s+Math.round(Number(i.price)*100)*Number(quantities[i.product_id]),0)/100;
 const total=included.reduce((s,i)=>{const p=offerRupeesOrNaN(prices[i.product_id]);return s+(Number.isFinite(p)?p*100*Number(quantities[i.product_id]):0);},0)/100;
 const discount=listTotal?Math.round((listTotal-total)/listTotal*10000)/100:0;
 const invalidPricing=included.some(i=>{const p=offerRupeesOrNaN(prices[i.product_id]),d=Number(discounts[i.product_id]);return !Number.isFinite(p)||p<0||p>Number(i.price)||!Number.isFinite(d)||d<0||d>100;});
 function updatePrice(item:Product,value:string){setDraftChanged(true);setPrices(p=>({...p,[item.product_id]:value}));const n=Number(value);setDiscounts(d=>({...d,[item.product_id]:value.trim()===''?'':Number.isFinite(n)&&Number(item.price)>0?String(Math.round((Number(item.price)-n)/Number(item.price)*10000)/100):'0'}));}
 function updateDiscount(item:Product,value:string){setDraftChanged(true);setDiscounts(d=>({...d,[item.product_id]:value}));const d=Number(value);if(value.trim()!==''&&Number.isFinite(d)&&d>=0&&d<=100)setPrices(p=>({...p,[item.product_id]:String(Math.round(Number(item.price)*(1-d/100)))}));}
 async function saveAvailability(){if(busy||invalidAvailability||!saved)return;setBusy(true);setError('');setMessage('');try{const data=await request(base+'/availability',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:saved.version,items:enquiry.items.map(i=>({product_id:i.product_id,available_quantity:Number(quantities[i.product_id]),note:notes[i.product_id]||''}))})});adopt(data.availability);setMessage('Availability saved. Original enquiry quantities and earlier quotations are unchanged.');}catch(e){setError(e instanceof Error?e.message:'Could not save availability.');}finally{setBusy(false);}}
 async function reloadAvailability(){if(busy)return;if(availabilityDirty&&!window.confirm('Discard unsaved availability edits and reload the saved quantities?'))return;setBusy(true);setError('');try{adopt((await request(base+'/availability')).availability);}catch(e){setError(e instanceof Error?e.message:'Could not reload availability.');}finally{setBusy(false);}}
 async function createOffer(){if(busy||invalidAvailability||invalidPricing||availabilityDirty||!included.length||!saved)return;setBusy(true);setError('');setMessage('');try{const data=await request(base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({availability_version:saved.version,items:included.map(i=>({product_id:i.product_id,offer_price:offerRupeesOrNaN(prices[i.product_id])})),terms:{...terms,delivery_days:terms.delivery_days||null},expires_at:expiry||null})});setDraftChanged(false);setMessage(`Offer version ${data.offer.version} created with saved available quantities.`);await history();}catch(e){setError(e instanceof Error?e.message:'Could not create quotation.');}finally{setBusy(false);}}
 return <section className="offer-manager" aria-labelledby="offer-manager-title">
  <div className="offer-manager-heading"><div><p className="category-manager-eyebrow">Customer quotation</p><h2 id="offer-manager-title">Prepare a price offer</h2></div><p>Original requested quantities stay unchanged. Save availability first; only available quantities are priced. Each quotation version preserves its own prices and availability.</p></div>
  {loading&&<p>Loading availability...</p>}
  <fieldset disabled={busy||loading} style={{border:0,padding:0,minWidth:0}}>
   <div className="offer-price-list"><div className="offer-price-header"><span>Product</span><span>Availability</span><span>Enquiry unit price</span><span>Discount %</span><span>Offer price / unit</span></div>
   {enquiry.items.map(item=>{const id=item.product_id,q=Number(quantities[id]),left=Number(item.quantity)-q;return <div className="offer-price-row" key={id||item.sku}>
    <span className="offer-product-label"><strong>{item.name}</strong><small>SKU: {item.sku}</small><small>Original requested qty: {item.quantity}</small></span>
    <span><label>Available qty<input aria-label={`Available quantity for ${item.name}`} type="number" min="0" max={item.quantity} step="1" value={quantities[id]??''} onChange={e=>setQuantities(q=>({...q,[id]:e.target.value}))}/></label><small>{Number.isInteger(q)&&left>=0?(q===0?'Unavailable / excluded':left>0?`Partial: ${left} excluded`:'Full quantity available'):'Enter a valid quantity'}</small><label>Availability remark<textarea maxLength={1000} rows={2} value={notes[id]||''} onChange={e=>setNotes(n=>({...n,[id]:e.target.value}))}/></label></span>
    <span>{money(Number(item.price))}</span>
    <span className="offer-price-edit"><input aria-label={`Discount percentage for ${item.name}`} type="number" min="0" max="100" step="0.01" disabled={!q} value={discounts[id]??'0'} onChange={e=>updateDiscount(item,e.target.value)}/></span>
    <span className="offer-price-edit"><input aria-label={`Offer price per unit for ${item.name}`} type="number" min="0" max={item.price} step="0.01" disabled={!q} value={prices[id]??''} onChange={e=>updatePrice(item,e.target.value)} onBlur={e=>{const p=offerRupeesOrNaN(e.target.value);if(Number.isFinite(p))updatePrice(item,String(p));}}/><small>Line amount: {q&&Number.isFinite(offerRupeesOrNaN(prices[id]))?money(offerRupeesOrNaN(prices[id])*q):money(0)}</small></span>
   </div>;})}</div>
   <button type="button" disabled={invalidAvailability||!availabilityDirty} onClick={()=>void saveAvailability()}>Save availability</button>{' '}<button type="button" onClick={()=>void reloadAvailability()}>Reload saved availability</button>
   {availabilityDirty&&<p role="status">Availability has unsaved changes. Save before creating a quotation.</p>}
   {!invalidAvailability&&!included.length&&<p role="status">All quantities are unavailable. Availability can be saved, but no quotation can be created.</p>}
   <div className="offer-totals"><span>Available-quantity subtotal <strong>{money(listTotal)}</strong></span><span>Discount offered <strong>{discount}% ({money(Math.max(0,listTotal-total))})</strong></span><span>Offer total <strong>{money(total)}</strong></span><small>Unit rates round to the nearest INR 1 before totals and cannot exceed enquiry prices. Excluded quantities are not charged.</small></div>
   <div className="offer-terms-form" onChangeCapture={()=>setDraftChanged(true)}><h3>Terms and conditions</h3><label>GST / tax terms<input value={terms.gst} onChange={e=>setTerms({...terms,gst:e.target.value})}/></label><label>Advance / payment terms<input value={terms.payment_terms} onChange={e=>setTerms({...terms,payment_terms:e.target.value})}/></label><label>Account / payment details<textarea rows={3} value={terms.payment_details} onChange={e=>setTerms({...terms,payment_details:e.target.value})}/></label><label>Estimated delivery (days)<input type="number" min="1" max="365" value={terms.delivery_days} onChange={e=>setTerms({...terms,delivery_days:e.target.value})}/></label><label>Other terms<textarea rows={3} value={terms.other_terms} onChange={e=>setTerms({...terms,other_terms:e.target.value})}/></label><label>Offer valid until<input type="date" value={expiry} onChange={e=>setExpiry(e.target.value)}/></label></div>
   <button className="category-manager-primary" type="button" disabled={invalidAvailability||invalidPricing||availabilityDirty||!included.length} onClick={()=>void createOffer()}>{busy?'Saving...':'Create offer'}</button>
  </fieldset>
  {error&&<p className="manager-error" role="alert">{error}</p>}{message&&<p className="category-manager-message" role="status">{message}</p>}
  {!!excluded.length&&!invalidAvailability&&<section><h3>Unavailable / excluded from this quotation</h3><p>Not included in the subtotal, discount or offer total.</p>{excluded.map(i=><p key={i.product_id}>{i.name} ({i.sku}): requested {i.quantity}; available {quantities[i.product_id]}; excluded {Number(i.quantity)-Number(quantities[i.product_id])}. {notes[i.product_id]}</p>)}</section>}
  {!!offers.length&&<div className="offer-history"><h3>Offer history</h3>{offers.map(o=>{const token=encodeURIComponent(o.offer_token),url='/offer/'+token,share=origin?new URL(url,origin).href:'',digits=String(enquiry.mobile_number||'').replace(/\D/g,''),whatsapp=share?'https://wa.me/'+digits+'?text='+encodeURIComponent(`Hello ${enquiry.customer_name||''}, your Luminoza price offer is ready. View offer: ${share}`):'';return <article className="offer-history-row" key={o.offer_token}><div><strong>Version {o.version}</strong><small>Created {new Date(o.created_at).toLocaleString('en-IN')}{o.expires_at?` · Valid until ${new Date(o.expires_at).toLocaleDateString('en-IN')}`:''}</small></div><span className="enquiry-status">{statusLabel(effectiveOfferStatus(o.status,o.expires_at))}</span><div className="offer-history-actions"><a href={url} target="_blank" rel="noopener noreferrer">View link</a><a href={`${API_BASE_URL}/offers/${token}/pdf`}>Download PDF</a>{whatsapp&&<a href={whatsapp} target="_blank" rel="noopener noreferrer">Open WhatsApp</a>}</div></article>;})}</div>}
 </section>;
}
