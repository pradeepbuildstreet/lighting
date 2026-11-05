"use strict";
const connection=require('./connection');
const {validateAdminActor}=require('../services/admin-actor');
let worker;
async function actor(c,user){const validated=await validateAdminActor(c,user);await c.query("SELECT set_config('app.catalogue_actor_id',$1,true)",[validated.id]);return validated;}
async function close(){if(worker)await worker.stop();return connection.close();}
const db={query:connection.query,transaction:connection.transaction,actor,close};
module.exports=db;
worker=require('../services/catalogue-duplicate-worker').createDuplicateWorker(db,{log:event=>console.error(JSON.stringify(event))}).start();
