"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {setTimeout:delay}=require('node:timers/promises');
const {assertWorkerLease}=require('../services/catalogue-worker-lease');
const enabled=process.env.CATALOGUE_TEST_DATABASE_DISPOSABLE==='1';
test('PostgreSQL lease ownership and lock-wait expiry primitive',{skip:!enabled,timeout:20000},async t=>{
 const connectionString=process.env.TEST_DATABASE_URL;
 if(!connectionString)throw Error('TEST_DATABASE_URL is required for disposable integration tests');
 const url=new URL(connectionString);
 if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('Refusing non-loopback database: use a disposable local PostgreSQL service');
 const {Pool}=require('pg'),pool=new Pool({connectionString,max:4,connectionTimeoutMillis:3000});
 const schema='catalogue_lease_test_'+randomUUID().replaceAll('-',''),table='"'+schema+'".jobs';
 const id=randomUUID(),actor={id:randomUUID()},product={id,revision:'7'},token=randomUUID();
 const claim={product_id:id,product_revision:'7',actor_id:actor.id,generation:'2',lease_token:token};
 const lost=e=>e?.code==='DUPLICATE_JOB_LEASE_LOST'&&e.status===409;
 const client=c=>({query:(sql,args)=>c.query(sql.replaceAll('public.catalogue_duplicate_jobs',table),args)});
 let blocker,worker;
 async function reset(){await pool.query('UPDATE '+table+" SET generation=2,lease_until=clock_timestamp()+interval '1 minute' WHERE product_id=$1",[id]);}
 async function check(lease=claim){const c=await pool.connect();try{await c.query('BEGIN');await assertWorkerLease(client(c),actor,product,lease);}finally{await c.query('ROLLBACK');c.release();}}
 async function waitForLock(pid){
  for(let n=0;n<100;n++){const row=(await pool.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0];if(row?.wait_event_type==='Lock')return;await delay(20);}
  throw Error('Worker did not enter an observable row-lock wait');
 }
 try{
  await pool.query('CREATE SCHEMA "'+schema+'"');
  await pool.query('CREATE TABLE '+table+' (product_id uuid PRIMARY KEY,product_revision bigint NOT NULL,actor_id uuid NOT NULL,generation bigint NOT NULL,lease_token uuid NOT NULL,status text NOT NULL,lease_until timestamptz NOT NULL)');
  await pool.query('INSERT INTO '+table+" VALUES($1,7,$2,2,$3,'processing',clock_timestamp()+interval '1 minute')",[id,actor.id,token]);
  await t.test('an owned current lease succeeds',async()=>{await check();});
  await t.test('wrong generation and token fail closed',async()=>{await assert.rejects(check({...claim,generation:'3'}),lost);await assert.rejects(check({...claim,lease_token:randomUUID()}),lost);});
  await t.test('a lease already expired before locking is rejected',async()=>{await pool.query('UPDATE '+table+" SET lease_until=clock_timestamp()-interval '1 second'");await assert.rejects(check(),lost);await reset();});
  blocker=await pool.connect();worker=await pool.connect();
  await t.test('expiry while waiting on an unchanged row lock is rejected after acquisition',async()=>{
   let pending;
   try{
    await pool.query('UPDATE '+table+" SET lease_until=clock_timestamp()+interval '2 seconds' WHERE product_id=$1",[id]);
    await blocker.query('BEGIN');await blocker.query('SELECT product_id FROM '+table+' WHERE product_id=$1 FOR UPDATE',[id]);
    await worker.query('BEGIN');const pid=(await worker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    pending=assertWorkerLease(client(worker),actor,product,claim).then(()=>({ok:true}),error=>({error}));
    await waitForLock(pid);await pool.query('SELECT pg_sleep(2.1)');await blocker.query('ROLLBACK');
    const outcome=await pending;assert.ok(lost(outcome.error),'Lease check accepted a lease that expired while blocked');
   }finally{await blocker.query('ROLLBACK');if(pending)await pending;await worker.query('ROLLBACK');await reset();}
  });
  await t.test('generation changed by the lock owner invalidates a waiting worker',async()=>{
   let pending;
   try{
    await blocker.query('BEGIN');await blocker.query('UPDATE '+table+' SET generation=3 WHERE product_id=$1',[id]);
    await worker.query('BEGIN');const pid=(await worker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    pending=assertWorkerLease(client(worker),actor,product,claim).then(()=>({ok:true}),error=>({error}));
    await waitForLock(pid);await blocker.query('COMMIT');const outcome=await pending;assert.ok(lost(outcome.error));
   }finally{await blocker.query('ROLLBACK');if(pending)await pending;await worker.query('ROLLBACK');}
  });
 }finally{
  if(blocker)blocker.release();if(worker)worker.release();
  try{await pool.query('DROP SCHEMA IF EXISTS "'+schema+'" CASCADE');}finally{await pool.end();}
 }
});
