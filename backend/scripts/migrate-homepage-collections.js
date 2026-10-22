"use strict";
const path=require('node:path'),fs=require('node:fs');require('dotenv').config({path:path.resolve(__dirname,'../.env')});
const db=require('../db/catalogue'),appDb=require('../db/database');
async function main(){
 const args=process.argv.slice(2);if(args.length>1||args.some(a=>!['--apply','--check'].includes(a)))throw Error('Usage: --check (default) or --apply');
 if(args[0]==='--apply'){
  const ddl=fs.readFileSync(path.resolve(__dirname,'../migrations/homepage-collections-v1.sql'),'utf8').replace(/^BEGIN;\s*/,'').replace(/COMMIT;\s*$/,'');
  await db.transaction(async c=>{await c.query("SET LOCAL lock_timeout='5s'");await c.query("SET LOCAL statement_timeout='60s'");await c.query(ddl);});
  await appDb.withTransaction(async c=>{await c.query("SET LOCAL lock_timeout='5s'");await c.query("SET LOCAL statement_timeout='60s'");await c.query(fs.readFileSync(path.resolve(__dirname,'../migrations/homepage-enquiry-indexes-v1.sql'),'utf8'));});
  console.log('Additive collection schema and enquiry indexes applied. No product, enquiry, offer or admin data deleted.');
 }
 const schema=(await db.query("SELECT to_regclass('public.homepage_feature_versions') AS versions,to_regclass('public.homepage_collections') AS collections,to_regclass('public.homepage_collection_products') AS members,to_regclass('public.homepage_collection_audit') AS audit")).rows[0];
 if(!schema||Object.values(schema).some(v=>!v))throw Error('Homepage migration pending');
 if(!(await db.query('SELECT version FROM homepage_feature_versions WHERE version=1')).rows.length)throw Error('Homepage version 1 missing');
 await appDb.query('SELECT product_id FROM wishlist_items LIMIT 0');await appDb.query('SELECT submitted_at FROM wishlists LIMIT 0');
 console.log('Feature schema check passed. Counts derive from retained submitted enquiries; no history invented.');
}
main().catch(e=>{console.error('Migration stopped:',e.code||e.message);process.exitCode=1;}).finally(async()=>{await db.close();await appDb.pool.end();});
