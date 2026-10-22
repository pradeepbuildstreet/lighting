"use strict";
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const out=v=>console.log(JSON.stringify(v,null,2));function fail(message){const e=Error(message);e.safe=true;throw e;}
(async()=>{let pool,client;try{
 const raw=process.env.TARGET_DATABASE_URL;if(!raw)fail('Set TARGET_DATABASE_URL privately');let u;try{u=new URL(raw);}catch{fail('Invalid PostgreSQL destination URL');}
 if(!['postgres:','postgresql:'].includes(u.protocol)||!u.username||!u.password||!u.pathname.slice(1)||['localhost','127.0.0.1','[::1]'].includes(u.hostname))fail('Use an explicit remote PostgreSQL connection URL, not the local source');
 const email=(process.env.ADMIN_EMAIL||'').trim().toLowerCase(),password=process.env.ADMIN_PASSWORD;
 if(!/^\S+@\S+\.\S+$/.test(email))fail('Set a valid ADMIN_EMAIL');
 if(!password||password.length<12||Buffer.byteLength(password,'utf8')>72)fail('Admin password needs at least 12 characters and at most 72 UTF-8 bytes');
 const backend=path.join(path.resolve(process.env.LUMINOZA_WEBSITE_ROOT||'D:\\PycharmProjects\\decorative-lighting-ecommerce_from_zip\\decorative-lighting-ecommerce'),'backend');
 const req=createRequire(path.join(backend,'package.json'));let Pool,bcrypt;try{({Pool}=req('pg'));bcrypt=req('bcryptjs');}catch{fail('Existing backend pg and bcryptjs dependencies are required');}
 out({action:'create-one-application-admin',target:{host:u.hostname,database:decodeURIComponent(u.pathname.slice(1))},email});
 const rl=require('node:readline/promises').createInterface({input:process.stdin,output:process.stdout});const answer=await rl.question('Type CREATE FIRST ADMIN to proceed: ');rl.close();if(answer!=='CREATE FIRST ADMIN')fail('Cancelled; no account created');
 const ssl={rejectUnauthorized:true};if(process.env.PGSSLROOTCERT)ssl.ca=fs.readFileSync(process.env.PGSSLROOTCERT,'utf8');
 pool=new Pool({host:u.hostname,port:Number(u.port||5432),database:decodeURIComponent(u.pathname.slice(1)),user:decodeURIComponent(u.username),password:decodeURIComponent(u.password),ssl,max:1,connectionTimeoutMillis:15000});
 client=await pool.connect();await client.query('BEGIN');await client.query('SET LOCAL statement_timeout=\'15s\'');
 const version=(await client.query("SELECT current_setting('server_version_num')::integer AS version, (SELECT max(version) FROM public.schema_versions) AS schema_version")).rows[0];
 if(Math.floor(Number(version.version)/10000)!==17||Number(version.schema_version)<3)fail('Expected the reviewed PostgreSQL 17 baseline with current schema version');
 await client.query('LOCK TABLE public.app_users IN EXCLUSIVE MODE');
 const state=(await client.query('SELECT (SELECT count(*) FROM public.app_users)::integer AS users, EXISTS(SELECT 1 FROM public.products) OR EXISTS(SELECT 1 FROM public.categories) OR EXISTS(SELECT 1 FROM public.wishlists) OR EXISTS(SELECT 1 FROM public.wishlist_items) OR EXISTS(SELECT 1 FROM public.wishlist_offers) OR EXISTS(SELECT 1 FROM public.wishlist_offer_items) OR EXISTS(SELECT 1 FROM public.homepage_collections) AS business_present')).rows[0];
 if(state.users!==0||state.business_present)fail('Application users or business rows already exist; refusing automatic creation/reset');
 const hash=await bcrypt.hash(password,12);const result=await client.query("INSERT INTO public.app_users(email,password_hash,role,is_active) VALUES($1,$2,'admin',true) RETURNING id,email,role,is_active",[email,hash]);
 await client.query('COMMIT');out({result:'first-admin-created',admin:result.rows[0],passwordPrinted:false});
}catch(e){if(client)await client.query('ROLLBACK').catch(()=>{});out({result:'stopped-for-review',error:e.safe?e.message:'Connection/bootstrap failed. Check destination, permissions and TLS trust; do not disable certificate verification.',code:e.code||null});process.exitCode=1;}finally{client?.release();if(pool)await pool.end();}})();
