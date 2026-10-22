"use strict";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function diagnosticPreview(result,query=''){
 if(!result||!['current','not_applicable'].includes(result.status)||!Array.isArray(result.groups))throw Error('Assessment did not return a current saved result');
 if(result.status==='not_applicable')return {status:result.status,groups:[]};
 const q=String(query).trim().slice(0,200).toLocaleLowerCase();
 const groups=result.groups.map(group=>{
  if(!group||!UUID.test(group.id)||!Array.isArray(group.entries))throw Error('Invalid saved socket-group result');
  const lights=group.entries.map(e=>{
   if(!e||!UUID.test(e.product_id)||typeof e.sku!=='string'||typeof e.name!=='string'||typeof e.eligible!=='boolean'||!['compatible','incompatible','unverified'].includes(e.technical))throw Error('Invalid saved light result');
   if(e.manual_decision!=null&&!['approve','reject'].includes(e.manual_decision))throw Error('Unknown manual decision');
   const status=e.manual_decision==='reject'?'exception_rejected':e.manual_decision==='approve'?'exception_approved':e.technical;
   return {id:e.product_id,sku:e.sku,name:e.name,status,technical_status:e.technical,reasons:Array.isArray(e.reasons)?e.reasons.filter(r=>typeof r==='string'):[],missing:[],override:null,eligible:e.eligible,manual_decision:e.manual_decision||null};
  }).filter(e=>!q||e.sku.toLocaleLowerCase().includes(q)||e.name.toLocaleLowerCase().includes(q));
  return {...group,group_code:group.code,lights};
 });
 return {status:result.status,assessed_at:result.assessed_at,groups};
}
async function evaluateAndSaveCompatibility(fixtureId,query='',options={}){
 if(typeof fixtureId!=='string'||!UUID.test(fixtureId))throw Error('Valid fixture UUID required');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),70000),fetchImpl=options.fetchImpl||((...args)=>globalThis.fetch(...args));
 try{
  const response=await fetchImpl('/api/admin/compatibility-assessments/'+encodeURIComponent(fixtureId.toLowerCase())+'/assess',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:'{}',signal:controller.signal});
  let result;try{result=await response.json();}catch(_){throw Error('Assessment server returned an unexpected response');}
  if(!response.ok)throw Error(result?.error||'Could not save compatibility assessment ('+response.status+')');
  return diagnosticPreview(result,query);
 }catch(error){if(error?.name==='AbortError')throw Error('Assessment timed out. Reload saved status before retrying; do not assume the write failed.');throw error;}
 finally{clearTimeout(timer);}
}
module.exports={evaluateAndSaveCompatibility,diagnosticPreview};
