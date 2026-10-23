export function createWishlistSelection({read,write,run,changed,prepare=async()=>{}}){
 const pending=new Map();
 return {
  selected(id){return pending.has(id)?pending.get(id).desired:read(id);},
  pending(id){return pending.has(id);},
  set(id,desired){
   if(typeof desired!=='boolean')return Promise.reject(new Error('Selection must be boolean'));
   const existing=pending.get(id);if(existing){existing.desired=desired;changed();return existing.promise;}
   const entry={desired,promise:null};pending.set(id,entry);changed();
   entry.promise=run(async()=>{await prepare(id);while(read(id)!==entry.desired){const target=entry.desired;await write(id,target);}}).finally(()=>{pending.delete(id);changed();});
   return entry.promise;
  }
 };
}
