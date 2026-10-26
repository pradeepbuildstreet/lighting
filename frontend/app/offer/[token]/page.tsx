import {WishlistMedia} from '@/components/WishlistMedia';
import Link from 'next/link';
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {API_BASE_URL} from '@/lib/api-base';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Your Luminoza Price Offer',robots:{index:false,follow:false}};
type Item={media?:import('@/lib/wishlist-product').WishlistMedia[];product_id:string;product_href?:string|null;currency?:string;sku:string;name:string;quantity:number;requested_quantity?:number;availability_note?:string;list_price:number;discount_percent:number;offer_price:number;image_url?:string|null};
type Excluded={product_id:string;sku:string;name:string;requested_quantity:number;available_quantity:number;unavailable_quantity:number;note:string};
type Offer={offer_token:string;version:number;status:string;customer_name:string;created_at:string;expires_at:string|null;terms:{gst?:string;payment_terms?:string;payment_details?:string;delivery_days?:number|null;other_terms?:string};items:Item[];unavailable_items?:Excluded[];is_partial?:boolean;list_total:number;discount_percent:number;offer_total:number;savings:number};
const money=(v:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:Number.isInteger(v)?0:2,maximumFractionDigits:2}).format(v);
const dateOnly=(v:string)=>new Date(v).toLocaleDateString('en-IN',{timeZone:'UTC'});
export default async function CustomerOfferPage({params}:{params:{token:string}}){
 let offer:Offer;try{const response=await fetch(`${API_BASE_URL}/offers/${encodeURIComponent(params.token)}`,{cache:'no-store'});if(!response.ok)notFound();({offer}=await response.json());}catch{notFound();}
 const expired=!!offer.expires_at&&new Date(offer.expires_at).getTime()<Date.now();
 const terms=[['GST / tax',offer.terms?.gst],['Payment terms',offer.terms?.payment_terms],['Account / payment details',offer.terms?.payment_details],['Estimated delivery',offer.terms?.delivery_days?`${offer.terms.delivery_days} days`:''],['Additional terms',offer.terms?.other_terms]].filter((entry):entry is [string,string]=>!!entry[1]);
 return <div className="container customer-offer-page">
  <header className="customer-offer-heading"><div><p className="wishlist-eyebrow">Luminoza / Customer offer / Version {offer.version}</p><h1>Your price offer</h1><p>Prepared for {offer.customer_name}</p>{offer.expires_at&&<p>Valid until {dateOnly(offer.expires_at)}</p>}</div><a className="wishlist-primary-link" href={`/api/offers/${encodeURIComponent(params.token)}/pdf`}>Download PDF</a></header>
  {expired&&<p className="manager-error" role="status">This offer has expired. Please contact us for updated pricing.</p>}
  {offer.status!=='ready'&&<p className="wishlist-feedback">Offer status: {offer.status}</p>}
  {offer.is_partial&&<p className="wishlist-feedback" role="status">Partial availability: this quotation covers only the available quantities below, not the entire enquiry. Unavailable products and remaining quantities are listed separately at the bottom and are excluded from all totals.</p>}
  <section className="customer-offer-items" aria-label="Offered products"><div className="customer-offer-table-head"><span>Product</span><span>Qty</span><span>List price</span><span>Discount</span><span>Offer price</span><span>Line total</span></div>
  {offer.items.map(item=><article className="customer-offer-item" key={item.product_id}><div className="customer-offer-product"><div className="customer-offer-image"><WishlistMedia item={item}/></div><div><strong>{item.name}</strong><small>SKU: {item.sku}</small>{(item.requested_quantity??item.quantity)>item.quantity&&<small>Part quantity available: quoting {item.quantity} of {item.requested_quantity} requested.</small>}{item.availability_note&&<small>{item.availability_note}</small>}<Link href={'/catalogue/product-id/'+item.product_id}>View current product</Link></div></div><span data-label="Qty">{item.quantity}</span><span data-label="List price">{money(item.list_price)}</span><span data-label="Discount">{item.discount_percent}%</span><strong data-label="Offer price">{money(item.offer_price)}</strong><strong data-label="Line total">{money(item.offer_price*item.quantity)}</strong></article>)}
  </section>
  <section className="customer-offer-summary"><p><span>Subtotal</span><strong>{money(offer.list_total)}</strong></p><p><span>Discount offered</span><strong>{offer.discount_percent}% ({money(offer.savings)})</strong></p><p><span>Offer total</span><strong>{money(offer.offer_total)}</strong></p></section>
  {!!terms.length&&<section className="customer-offer-terms"><h2>Terms and conditions</h2><dl>{terms.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>}
  <p className="customer-offer-footnote">This offer preserves the agreed prices and quantities for this version. Current catalogue prices or later availability changes do not alter it. Missing or unsupported PDF thumbnails do not change quoted amounts.</p>
  {!!offer.unavailable_items?.length&&<section className="customer-offer-terms" aria-label="Unavailable and excluded quantities"><h2>Unavailable / excluded from this quotation</h2><p>These products or remaining quantities are not included in the subtotal, discount or offer total.</p>{offer.unavailable_items.map(item=><article key={item.product_id}><h3>{item.name}</h3><p>SKU: {item.sku}</p><p>Originally requested: {item.requested_quantity} · Quoted: {item.available_quantity} · Unavailable / excluded: {item.unavailable_quantity}</p>{item.note&&<p>Remark: {item.note}</p>}</article>)}</section>}
 </div>;
}
