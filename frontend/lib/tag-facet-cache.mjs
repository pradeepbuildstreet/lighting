export function createFacetCache(loader,{ttl=30000,maxEntries=40,now=Date.now}={}){
 if(!Number.isFinite(ttl)||ttl<0||!Number.isInteger(maxEntries)||maxEntries<1)throw Error('Invalid facet cache configuration');
 const cache=new Map(),inflight=new Map(),cancelled=()=>new DOMException('Cancelled','AbortError');
 return function load(params,{signal,bypass=false}={}){
  if(signal?.aborted)return Promise.reject(cancelled());const query=new URLSearchParams(params);query.sort();const key=query.toString(),cached=cache.get(key);
  if(!bypass&&cached&&now()-cached.time<ttl){cache.delete(key);cache.set(key,cached);return Promise.resolve(cached.data);}cache.delete(key);
  let entry=bypass?null:inflight.get(key);
  if(!entry){entry={controller:new AbortController(),users:0,done:false,promise:null};inflight.set(key,entry);const current=entry;entry.promise=Promise.resolve().then(()=>loader(new URLSearchParams(query),{signal:current.controller.signal})).then(data=>{if(!current.controller.signal.aborted&&inflight.get(key)===current){cache.set(key,{time:now(),data});while(cache.size>maxEntries)cache.delete(cache.keys().next().value);}return data;}).finally(()=>{current.done=true;if(inflight.get(key)===current)inflight.delete(key);});}
  const current=entry;current.users++;
  return new Promise((resolve,reject)=>{let settled=false;const detach=()=>{signal?.removeEventListener('abort',abort);current.users--;if(!current.users&&!current.done){current.controller.abort();if(inflight.get(key)===current)inflight.delete(key);}};const abort=()=>{if(settled)return;settled=true;detach();reject(cancelled());};signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();current.promise.then(data=>{if(settled)return;settled=true;detach();resolve(data);},error=>{if(settled)return;settled=true;detach();reject(error);});});
 };
}
