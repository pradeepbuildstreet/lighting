"use strict";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function fail(message){throw Object.assign(Error(message),{status:400});}
function splitEnquiry(items,selection){
 if(!Array.isArray(items)||!items.length||items.length>100)fail('An enquiry must contain 1 to 100 products');
 const edits=new Map();if(selection!==undefined){if(!Array.isArray(selection)||selection.length!==items.length)fail('Availability is required for every enquiry item');for(const row of selection){if(!row||typeof row.product_id!=='string'||!UUID.test(row.product_id)||edits.has(row.product_id.toLowerCase()))fail('Duplicate or invalid availability product');edits.set(row.product_id.toLowerCase(),row);}}
 const seen=new Set(),quoted=[],unavailable=[],snapshot=[];
 for(const item of items){if(typeof item.product_id!=='string'||!UUID.test(item.product_id)||seen.has(item.product_id.toLowerCase()))fail('Every enquiry item needs a unique catalogue product ID');const id=item.product_id.toLowerCase();seen.add(id);const requested=Number(item.quantity);if(!Number.isSafeInteger(requested)||requested<1||requested>2147483647)fail('Invalid saved requested quantity');const edit=selection===undefined?{available_quantity:requested,note:''}:edits.get(id);if(!edit)fail('Availability does not match the enquiry products');const available=edit.available_quantity;if(typeof available!=='number'||!Number.isInteger(available)||available<0||available>requested)fail('Available quantity must be a whole number between zero and the requested quantity');if(edit.note!==undefined&&typeof edit.note!=='string')fail('Availability remark must be text');const note=(edit.note||'').trim();if(note.length>1000)fail('Availability remark is too long');const remaining=requested-available,record={product_id:id,sku:item.sku,name:item.name,requested_quantity:requested,available_quantity:available,unavailable_quantity:remaining,note};snapshot.push(record);if(available)quoted.push({...item,...record,quantity:available,availability_label:remaining?'Part quantity available':'Full quantity available'});if(remaining)unavailable.push({...record,availability_label:available?'Remaining quantity unavailable':'Entire requested quantity unavailable'});
 }
 return {quoted,unavailable,snapshot,is_partial:unavailable.length>0,can_quote:quoted.length>0};
}
module.exports={splitEnquiry};
