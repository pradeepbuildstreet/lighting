"use strict";
const {createHash}=require('node:crypto');
const {splitEnquiry}=require('./enquiry-availability-core');
const {roundOfferRupees}=require('./offer-pricing');
const {storedQuantity}=require('./wishlist-quantity');
function fail(status,message){throw Object.assign(Error(message),{status});}
function availability(items){
 const split=splitEnquiry(items,items.map(i=>({product_id:i.product_id,available_quantity:i.available_quantity==null?Number(i.quantity):Number(i.available_quantity),note:i.availability_note||''})));
 const version=createHash('sha256').update(JSON.stringify([...split.snapshot].sort((a,b)=>a.product_id.localeCompare(b.product_id)))).digest('hex');
 return {...split,version};
}
function checkVersion(state,version){if(typeof version!=='string'||version!==state.version)fail(409,'Availability changed. Reload availability before saving or creating a quote.');}
async function load(client,token){
 const result=await client.query("SELECT id FROM wishlists WHERE share_token=$1 AND status<>'draft' FOR UPDATE",[token]);
 if(!result.rows.length)fail(404,'Submitted enquiry not found.');
 const id=result.rows[0].id;
 const {rows:items}=await client.query('SELECT product_id,sku,name,price,currency,media,product_href,catalogue_revision,image_url,category_slug,add_count AS quantity,available_quantity,availability_note FROM wishlist_items WHERE wishlist_id=$1 ORDER BY created_at,name',[id]);
 const normalized=items.map(i=>({...i,quantity:storedQuantity(i.quantity??i.add_count)}));
 return {id,items:normalized,state:availability(normalized)};
}
async function save(client,token,body){
 const current=await load(client,token);checkVersion(current.state,body.version);
 if(!Array.isArray(body.items))fail(400,'Availability is required for every enquiry item.');
 const split=splitEnquiry(current.items,body.items);
 for(const row of split.snapshot)await client.query('UPDATE wishlist_items SET available_quantity=$3,availability_note=$4,updated_at=NOW() WHERE wishlist_id=$1 AND product_id=$2',[current.id,row.product_id,row.available_quantity,row.note]);
 await client.query('UPDATE wishlists SET updated_at=NOW() WHERE id=$1',[current.id]);
 return availability(current.items.map(i=>{const r=split.snapshot.find(r=>r.product_id===i.product_id.toLowerCase());return {...i,available_quantity:r.available_quantity,availability_note:r.note};}));
}
function priceQuote(items,state,body){
 checkVersion(state,body.availability_version);
 if(!state.can_quote)fail(400,'No quantity is available. Save availability, but a quote cannot be created.');
 if(!Array.isArray(body.items)||body.items.length!==state.quoted.length)fail(400,'Supply one price for each available product only.');
 const prices=new Map();
 for(const row of body.items){
  if(!row||typeof row.product_id!=='string')fail(400,'Invalid quotation product.');
  const id=row.product_id.toLowerCase();let price;
  try{price=roundOfferRupees(row.offer_price);}catch(_){fail(400,'Enter a valid non-negative offer price.');}
  if(prices.has(id))fail(400,'Duplicate quotation product.');prices.set(id,price);
 }
 return state.quoted.map(item=>{
  const price=prices.get(item.product_id);
  if(price===undefined)fail(400,'Prices must match available products exactly.');
  if(item.currency!=='INR')fail(409,'Only INR enquiries are supported.');
  if(price>Number(item.price))fail(400,`Rounded offer price for ${item.sku} exceeds the enquiry price.`);
  return {...item,list_price:Number(item.price),offer_price:price};
 });
}
function totals(items){
 const list=items.reduce((s,i)=>s+Math.round(Number(i.list_price)*100)*i.quantity,0);
 const offer=items.reduce((s,i)=>s+Math.round(Number(i.offer_price)*100)*i.quantity,0);
 return {list_total:list/100,offer_total:offer/100,savings:(list-offer)/100,discount_percent:list?Math.round((list-offer)/list*10000)/100:0};
}
module.exports={availability,checkVersion,load,save,priceQuote,totals};
