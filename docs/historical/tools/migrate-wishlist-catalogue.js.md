# Historical tool: migrate-wishlist-catalogue.js

Archived from `backend/scripts/migrate-wishlist-catalogue.js`. Reference only; not supported setup or an executable upgrade step. Do not copy/run without a separate data-operation review. Original source follows.

```javascript
"use strict";
const fs=require('node:fs'),path=require('node:path');
const app=require('../db/database'),catalogue=require('../db/catalogue');
async function main(){
 await require('../services/public-catalogue-v1').createService(catalogue).ready();
 const products=(await catalogue.query('SELECT id,sku FROM products ORDER BY id')).rows;
 const bySku=new Map();for(const p of products){const k=p.sku.toUpperCase();bySku.set(k,[...(bySku.get(k)||[]),p.id]);}
 const report=await app.withTransaction(async c=>{
  await c.query("SELECT pg_advisory_xact_lock(hashtext('catalogue-wishlist-007'))");
  await c.query(fs.readFileSync(path.resolve(__dirname,'../../docs/migrations/007_catalogue_wishlist_identity.sql'),'utf8'));
  await c.query('LOCK TABLE wishlists,wishlist_items,wishlist_offers,wishlist_offer_items IN ACCESS EXCLUSIVE MODE');
  if((await c.query('SELECT 1 FROM catalogue_identity_migrations WHERE version=7')).rows.length)return {already_applied:true};
  const report={mapped_wishlist:0,mapped_offer:0,unmapped_wishlist:0,unmapped_offer:0};
  for(const [table,key] of [['wishlist_items','wishlist'],['wishlist_offer_items','offer']]){
   const rows=(await c.query('SELECT id,sku FROM '+table+' WHERE product_id IS NULL ORDER BY id')).rows;
   for(const row of rows){const ids=bySku.get(row.sku.toUpperCase())||[];
    if(ids.length!==1){report['unmapped_'+key]++;continue;}
    await c.query('UPDATE '+table+' SET product_id=$2,product_href=$3 WHERE id=$1',[row.id,ids[0],'/catalogue/product-id/'+ids[0]]);report['mapped_'+key]++;
   }
  }
  // After mapping, prevent modifications to agreed line values. New versions remain append-only.
  await c.query(`CREATE OR REPLACE FUNCTION preserve_offer_line_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Offer lines are immutable; create a new offer version'; END $$;
   DROP TRIGGER IF EXISTS preserve_offer_line_history ON wishlist_offer_items;
   CREATE TRIGGER preserve_offer_line_history BEFORE UPDATE OR DELETE ON wishlist_offer_items FOR EACH ROW EXECUTE FUNCTION preserve_offer_line_history();`);
  await c.query('INSERT INTO catalogue_identity_migrations(version,report) VALUES(7,$1)',[JSON.stringify(report)]);return report;
 });console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(JSON.stringify({error:'Migration failed',code:e.code||e.status||'ERROR',message:e.message}));process.exitCode=1;}).finally(async()=>{await app.pool.end();await catalogue.close();});

```
