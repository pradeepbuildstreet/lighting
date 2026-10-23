"use strict";
async function measure(base,fetchImpl=fetch){
 const origin=new URL(base);
 if(origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/'||!(origin.protocol==='https:'||(origin.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(origin.hostname))))throw Error('Supply an HTTPS origin, or HTTP loopback origin, without credentials or a path');
 const samples=[];
 for(const path of ['/products','/api/catalogue/categories','/api/catalogue/products?limit=1'])for(let attempt=1;attempt<=3;attempt++){
  const start=performance.now();
  try{const response=await fetchImpl(new URL(path,origin),{method:'GET',redirect:'error',cache:'no-store',headers:{Accept:path.startsWith('/api/')?'application/json':'text/html'},signal:AbortSignal.timeout(15000)});const headers_ms=performance.now()-start;const bytes=(await response.arrayBuffer()).byteLength;samples.push({path,attempt,status:response.status,ok:response.ok,content_type:response.headers.get('content-type'),headers_ms:Number(headers_ms.toFixed(1)),total_ms:Number((performance.now()-start).toFixed(1)),bytes});}
  catch(error){samples.push({path,attempt,ok:false,error:error.name||'RequestError',total_ms:Number((performance.now()-start).toFixed(1))});}
 }
 return {origin:origin.origin,measured_at:new Date().toISOString(),scope:'Public HTTP headers/body latency only; not browser LCP/INP or database query profiling',samples};
}
module.exports={measure};
if(require.main===module)measure(process.argv[2]).then(report=>{console.log(JSON.stringify(report,null,2));if(report.samples.some(sample=>!sample.ok))process.exitCode=1;}).catch(error=>{console.error(error.message);process.exitCode=1;});
