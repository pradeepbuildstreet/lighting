"use strict";
function createOfferImageLoader(loadImage){
 const images=new Map();let cachedBytes=0;
 return async function(imageUrl){
  const cacheable=typeof imageUrl==='string'&&imageUrl.length>0;
  if(cacheable&&images.has(imageUrl))return images.get(imageUrl);
  const image=await loadImage(imageUrl),bytes=Buffer.isBuffer(image)?image.length:0;
  if(cacheable&&(image===null||Buffer.isBuffer(image))&&images.size<64&&bytes<=16000000-cachedBytes){images.set(imageUrl,image);cachedBytes+=bytes;}
  return image;
 };
}
module.exports={createOfferImageLoader};
