export function createInflightLoader(load){
 let pending=null;
 const cancelled=()=>new DOMException('Catalogue request cancelled','AbortError');
 return function request(options={}){
  if(options.signal?.aborted)return Promise.reject(cancelled());
  if(!pending){
   const entry={controller:new AbortController(),users:0,promise:null};pending=entry;
   entry.promise=Promise.resolve().then(()=>load({signal:entry.controller.signal})).finally(()=>{if(pending===entry)pending=null;});
  }
  const entry=pending;entry.users++;
  return new Promise((resolve,reject)=>{
   let done=false;
   const finish=(settle,value)=>{if(done)return;done=true;options.signal?.removeEventListener('abort',abort);entry.users--;if(entry.users===0&&pending===entry){pending=null;entry.controller.abort();}settle(value);};
   const abort=()=>finish(reject,cancelled());options.signal?.addEventListener('abort',abort,{once:true});
   entry.promise.then(value=>finish(resolve,value),error=>finish(reject,error));
  });
 };
}
export function startCatalogueReads(client){
 const facets=Promise.resolve().then(()=>client.filters()).then(result=>result.facets).catch(()=>null);
 const categories=Promise.resolve().then(()=>client.categories());
 return {categories,facets};
}
