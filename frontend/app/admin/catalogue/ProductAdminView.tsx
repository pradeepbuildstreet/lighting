"use client";
import {ProductEnquiryCount} from '@/components/ProductEnquiryCount';
type Row=Record<string,any>;
const title=(s:string)=>s==='inbuilt_specs'?'Integrated specifications':s.replace(/_/g,' ');
function value(v:unknown){if(v===null||v===undefined||v==='')return 'Not specified';if(typeof v==='boolean')return v?'Yes':'No';return typeof v==='object'?JSON.stringify(v,null,2):String(v);}
export default function ProductAdminView({product,masters,listings,onEdit,onPreview}:{product:Row;masters:Record<string,Row[]>;listings:Row[];onEdit:()=>void;onPreview:()=>void}){
 const categories=masters.categories||[],spec=product.specs||{};
 const typeKey=product.product_kind==='fixture'?'fixture_type_id':'light_type_id';
 const type=(masters[product.product_kind==='fixture'?'fixture-types':'light-types']||[]).find(t=>t.id===spec[typeKey]);
 return <section className="panel" aria-label="Read-only admin product details">
  <h2>Admin product view</h2><ProductEnquiryCount productId={product.id}/><p>Saved catalogue data. This view is read-only; Preview shows a frontend-style presentation.</p>
  <div className="actions"><button type="button" onClick={onEdit}>Edit product</button><button type="button" onClick={onPreview}>Frontend preview</button></div>
  <dl className="grid">{['sku','name','product_kind','brand','model_number','selling_price','currency','is_active','review_status','revision'].map(k=><div key={k}><dt>{title(k)}</dt><dd>{value(product[k])}</dd></div>)}</dl>
  <h3>Description</h3><p>{product.description||'Not specified'}</p>
  <h3>Categories</h3><ul>{(product.category_ids||[]).map((id:string)=><li key={id}>{categories.find(c=>c.id===id)?.name||id}{id===product.primary_category_id?' (primary)':''}</li>)}</ul>
  <h3>{product.product_kind==='fixture'?'Fixture':'Light'} specifications</h3>
  <dl className="grid"><div><dt>Type</dt><dd>{type?.name||'Not specified'}</dd></div>{Object.entries(spec).filter(([k])=>!['product_id','product_kind',typeKey].includes(k)).map(([k,v])=><div key={k}><dt>{title(k)}</dt><dd>{typeof v==='object'&&v!==null?<pre>{value(v)}</pre>:value(v)}</dd></div>)}</dl>
  <h3>Dealer listing summary</h3>{listings.length?<ul>{listings.map(l=><li key={l.id}>{l.dealer_name} · {l.dealer_sku||'No dealer SKU'} · {l.net_price??'No current quote'} {l.currency||''}</li>)}</ul>:<p>No dealer listings.</p>}
  <p>Use the product workspace sections to manage media/light configuration, dealers, or review/publication. No public product route is activated by Preview.</p>
 </section>;
}
