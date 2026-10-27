export const MAX_MEDIA_BYTES=25*1024*1024;
export function validateFiles(files){
 if(!files.length||files.length>10)throw new Error('Choose between 1 and 10 files.');
 for(const file of files){if(!['image/jpeg','image/png','image/webp','video/mp4'].includes(file.type)||file.size<=0||file.size>MAX_MEDIA_BYTES)throw new Error(file.name+': use JPEG, PNG, WebP or MP4, up to 25 MB.');}
 return files;
}
export function metadata(item,revision){
 const order=Number(item.sort_order);
 if(String(item.sort_order).trim()===''||!Number.isSafeInteger(order)||order<0)throw new Error('Order must be a whole number, zero or greater.');
 if(item.is_primary&&item.media_type!=='image')throw new Error('Only images can be primary.');
 return {caption:String(item.caption??'').trim()||null,alt_text:String(item.alt_text??'').trim()||null,sort_order:order,is_primary:item.is_primary===true,revision:String(revision)};
}
export function mediaSource(productId,item){
 if(item.external_url){try{const u=new URL(item.external_url);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
 return item.storage_key?'/api/admin/catalogue/products/'+encodeURIComponent(productId)+'/media/'+encodeURIComponent(item.id)+'/file':null;
}
export function metadataMatches(item,sent){return !!item&&(item.caption||null)===sent.caption&&(item.alt_text||null)===sent.alt_text&&Number(item.sort_order)===sent.sort_order&&item.is_primary===sent.is_primary;}
