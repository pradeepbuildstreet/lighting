"use strict";
function buildGalleryItems(products,helpers,slots=30,random=Math.random){
 if(!Array.isArray(products)||!Number.isInteger(slots)||slots<1||slots>100)throw Error('Invalid gallery input');
 const seen=new Set(),pool=[];
 for(const p of products){if(p.source!=='catalogue'||seen.has(p.id))continue;const images=p.media.filter(m=>m.type==='image'&&helpers.safeMediaUrl(m.url));const image=images.find(m=>m.primary)||images[0];if(!image)continue;seen.add(p.id);pool.push({id:p.id,sku:p.sku,name:p.name,url:helpers.safeMediaUrl(image.url),alt:image.alt||p.name});}
 if(!pool.length)return [];
 for(let i=pool.length-1;i>0;i--){const r=random();if(!Number.isFinite(r)||r<0||r>=1)throw Error('Invalid random source');const j=Math.floor(r*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
 return Array.from({length:slots},(_,index)=>({...pool[index%pool.length],key:pool[index%pool.length].id+'-'+index}));
}
module.exports={buildGalleryItems};
