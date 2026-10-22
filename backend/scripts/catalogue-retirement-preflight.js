"use strict";
async function main(){const db=require('../db/connection');try{const report=await require('../services/catalogue-retirement-preflight').inspectRetirement(db);console.log(JSON.stringify(report,null,2));process.exitCode=report.can_remove_sku_fallbacks?0:2;}catch(e){console.error(JSON.stringify({status:'error',code:e.code||'PREFLIGHT_FAILED',message:'Read-only preflight failed; check schema/configuration locally. Do not recreate the database.'}));process.exitCode=1;}finally{await db.close();}}
if(require.main===module)void main();
module.exports={main};
