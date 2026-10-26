export function categoryTileImage(category,products,safeUrl){
 for(const product of products){
  if(!product.categories.some(c=>c.path===category.path||c.path.startsWith(category.path+'/')))continue;
  const images=product.media.filter(m=>m.type==='image').sort((a,b)=>Number(b.primary)-Number(a.primary));
  for(const image of images){const url=safeUrl(image.url);if(url)return {url,alt:image.alt||product.name};}
 }
 return null;
}
export async function categoryTileImages(categories,products,safeUrl,loadProducts){
 const images=categories.map(c=>categoryTileImage(c,products,safeUrl)),missing=categories.map((_,i)=>i).filter(i=>!images[i]);let cursor=0;
 async function worker(){while(cursor<missing.length){const i=missing[cursor++];try{images[i]=categoryTileImage(categories[i],await loadProducts(categories[i]),safeUrl);}catch(_){images[i]=null;}}}
 await Promise.all(Array.from({length:Math.min(4,missing.length)},worker));return images;
}
