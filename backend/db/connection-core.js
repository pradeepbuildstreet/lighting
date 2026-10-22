"use strict";
function createConnection({Pool,readConfig,logError=()=>{}}){
 let instance,closing=false,closePromise;
 function getPool(){
  if(closing)throw new Error('Database connection is shutting down');
  if(!instance){
   const c=readConfig();
   instance=new Pool({connectionString:c.databaseUrl,max:c.poolMax,connectionTimeoutMillis:c.dbTimeout,idleTimeoutMillis:30000});
   instance.on('error',e=>logError({event:'database_pool_error',code:e.code||'DB_ERROR'}));
  }
  return instance;
 }
 async function query(sql,args){return getPool().query(sql,args);}
 async function connect(){return getPool().connect();}
 function close(){
  if(!closePromise){closing=true;closePromise=Promise.resolve().then(()=>instance?instance.end():undefined);}
  return closePromise;
 }
 async function transaction(work){
  const client=await connect();
  try{await client.query('BEGIN');const result=await work(client);await client.query('COMMIT');return result;}
  catch(error){try{await client.query('ROLLBACK');}catch(_){}throw error;}
  finally{client.release();}
 }
 const pool=Object.freeze({query,connect,end:close});
 return Object.freeze({pool,query,transaction,close});
}
module.exports={createConnection};
