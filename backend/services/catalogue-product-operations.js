"use strict";
const C=require('./catalogue-tag-product-core');
const protectedFields=['revision','published','review_status','approved_revision','approved_by','approved_at','duplicate_of_product_id','sku','name','product_kind','brand','model_number','description','currency'];
function parseOperation(body){
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['operation','value','expected_token'].includes(k)))C.fail('Invalid operational update');
 if(!/^[a-f0-9]{32}$/.test(body.expected_token||''))C.fail('Reload the product operation token');
 if(body.operation==='selling_price'){if(!['string','number'].includes(typeof body.value)||!/^(0|[1-9]\d{0,11})(\.\d{1,2})?$/.test(String(body.value)))C.fail('Selling price must be non-negative with at most two decimals');return {column:'selling_price',value:String(body.value),token:body.expected_token};}
 if(body.operation==='active'){if(typeof body.value!=='boolean')C.fail('Active status must be true or false');return {column:'is_active',value:body.value,token:body.expected_token};}
 C.fail('Choose selling_price or active');
}
function assertPreserved(before,after){for(const key of protectedFields)if(JSON.stringify(before[key])!==JSON.stringify(after[key]))C.fail('Operational update unexpectedly changed '+key+'; transaction rolled back',409);}
function createProductOperations(db,audit){
 const select='SELECT p.*,md5(to_jsonb(p)::text) AS edit_token FROM products p WHERE p.id=$1';
 async function get(id){const row=(await db.query(select,[C.uuid(id)])).rows[0];if(!row)C.fail('Product not found',404);return row;}
 async function set(actor,id,body){id=C.uuid(id);const op=parseOperation(body);return db.transaction(async c=>{
  await c.query("SET LOCAL lock_timeout='3s'");await c.query("SET LOCAL statement_timeout='15s'");
  await c.query('SELECT pg_advisory_xact_lock(8102401)');await c.query('SELECT pg_advisory_xact_lock(8102403)');await db.actor(c,actor);
  const locked=(await c.query(select+' FOR UPDATE OF p',[id])).rows[0];if(!locked)C.fail('Product not found',404);if(locked.edit_token!==op.token)C.fail('Product changed; reload before updating',409);
  const {edit_token,...before}=locked;
  await c.query('UPDATE products SET '+op.column+'=$2 WHERE id=$1',[id,op.value]);
  const current=(await c.query(select,[id])).rows[0],{edit_token:nextToken,...after}=current;assertPreserved(before,after);
  const other=op.column==='selling_price'?'is_active':'selling_price';if(JSON.stringify(before[other])!==JSON.stringify(after[other]))C.fail('Another operational field changed; transaction rolled back',409);
  await audit(c,actor,'products',id,op.column==='selling_price'?'update_selling_price':'set_active',before,after);return {...after,edit_token:nextToken};
 });}
 return {get,set};
}
module.exports={createProductOperations,parseOperation,assertPreserved};
