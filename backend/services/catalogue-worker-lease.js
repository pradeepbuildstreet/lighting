"use strict";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LEASE_ERROR='Duplicate job lease is stale, expired, or no longer owned by this worker';
function lost(){throw Object.assign(new Error(LEASE_ERROR),{status:409,code:'DUPLICATE_JOB_LEASE_LOST'});}
async function assertWorkerLease(c,actor,product,lease){
 const generation=String(lease?.generation??'');
 if(!lease||typeof lease!=='object'||Array.isArray(lease)
  ||!UUID.test(lease.product_id)||lease.product_id!==product.id
  ||!UUID.test(lease.actor_id)||lease.actor_id!==actor.id
  ||String(lease.product_revision)!==String(product.revision)
  ||!UUID.test(lease.lease_token)||!/^[1-9][0-9]{0,18}$/.test(generation)
  ||(typeof lease.generation==='number'&&!Number.isSafeInteger(lease.generation))
  ||BigInt(generation)>9223372036854775807n)lost();
 const row=(await c.query(`SELECT product_id FROM public.catalogue_duplicate_jobs
  WHERE product_id=$1::uuid AND product_revision=$2::bigint AND actor_id=$3::uuid
   AND generation=$4::bigint AND lease_token=$5::uuid AND status='processing'
   AND lease_until>clock_timestamp() FOR UPDATE`,[product.id,String(product.revision),actor.id,generation,lease.lease_token])).rows[0];
 if(!row||row.product_id!==product.id)lost();
}
module.exports={LEASE_ERROR,assertWorkerLease};
