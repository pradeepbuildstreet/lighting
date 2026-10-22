export class OptionalSeoError extends Error{constructor(code){super(code);this.name='OptionalSeoError';this.code=code;}}
export function validateConfig(env=process.env){
 if(env.SEO_BRIDGE_ENABLED!=='true')return null;
 let u;try{u=new URL(env.SEO_BRIDGE_BASE);}catch{throw new OptionalSeoError('CONFIGURATION');}
 const local=['localhost','127.0.0.1','[::1]'].includes(u.hostname);
 if(u.pathname!=='/'||u.username||u.password||u.search||u.hash||!(u.protocol==='https:'||env.NODE_ENV!=='production'&&env.SEO_BRIDGE_ALLOW_LOCAL==='true'&&u.protocol==='http:'&&local))throw new OptionalSeoError('CONFIGURATION');
 if(!/^[a-z][a-z0-9-]{1,62}$/.test(env.SEO_BRIDGE_PROJECT_ID||'')||typeof env.SEO_BRIDGE_TOKEN!=='string'||env.SEO_BRIDGE_TOKEN.length<32||env.SEO_BRIDGE_TOKEN.length>512||/\s/.test(env.SEO_BRIDGE_TOKEN))throw new OptionalSeoError('CONFIGURATION');
 const timeoutMs=Number(env.SEO_TIMEOUT_MS||1000);if(!Number.isInteger(timeoutMs)||timeoutMs<50||timeoutMs>3000)throw new OptionalSeoError('CONFIGURATION');
 let canonicalOrigin=null;if(env.SEO_CANONICAL_ORIGIN){let c;try{c=new URL(env.SEO_CANONICAL_ORIGIN);}catch{throw new OptionalSeoError('CONFIGURATION');}if(c.protocol!=='https:'||c.origin!==env.SEO_CANONICAL_ORIGIN||c.username||c.password)throw new OptionalSeoError('CONFIGURATION');canonicalOrigin=c.origin;}
 return {origin:u.origin,projectId:env.SEO_BRIDGE_PROJECT_ID,token:env.SEO_BRIDGE_TOKEN,canonicalOrigin,timeoutMs};
}
export async function optional(operation,{onError=()=>{}}={}){try{return await operation();}catch(e){try{onError({event:'optional_seo_unavailable',code:e instanceof OptionalSeoError?e.code:'UNAVAILABLE'});}catch{}return null;}}
export async function request(config,route,params={}, {fetchImpl=fetch,maxBytes=1000000}={}){
 if(!config)return null;
 if(typeof route!=='string'||!/^[a-zA-Z0-9_/-]+$/.test(route)||route.includes('..'))throw new OptionalSeoError('INVALID_ROUTE');
 const u=new URL('/v1/projects/'+config.projectId+'/'+route,config.origin);for(const[k,v]of Object.entries(params))u.searchParams.set(k,String(v));
 const ac=new AbortController();let timer;
 const task=async()=>{const r=await fetchImpl(u,{method:'GET',headers:{Authorization:'Bearer '+config.token,Accept:'application/json'},redirect:'error',cache:'no-store',signal:ac.signal});
  if(!r.ok)throw new OptionalSeoError('HTTP_'+r.status);
  if(!r.headers.get('content-type')?.toLowerCase().includes('application/json'))throw new OptionalSeoError('INVALID_RESPONSE');
  const reader=r.body?.getReader();if(!reader)throw new OptionalSeoError('INVALID_RESPONSE');
  const cancel=()=>{void reader.cancel().catch(()=>{});};ac.signal.addEventListener('abort',cancel,{once:true});
  let bytes=0,text='';const decoder=new TextDecoder();try{while(true){const p=await reader.read();if(p.done)break;bytes+=p.value.byteLength;if(bytes>maxBytes){ac.abort();throw new OptionalSeoError('RESPONSE_LIMIT');}text+=decoder.decode(p.value,{stream:true});}text+=decoder.decode();}finally{ac.signal.removeEventListener('abort',cancel);void reader.cancel().catch(()=>{});}
  let data;try{data=JSON.parse(text);}catch{throw new OptionalSeoError('INVALID_JSON');}
  if(!data||data.projectId!==config.projectId)throw new OptionalSeoError('WRONG_PROJECT');return data;
 };
 try{return await Promise.race([task(),new Promise((_,reject)=>{timer=setTimeout(()=>{ac.abort();reject(new OptionalSeoError('TIMEOUT'));},config.timeoutMs);})]);}finally{clearTimeout(timer);ac.abort();}
}
