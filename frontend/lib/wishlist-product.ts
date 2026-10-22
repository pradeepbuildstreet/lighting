import {getImageSrc} from './image-url';
export type WishlistMedia = {id:string;type:'image'|'video';url:string;primary?:boolean;poster_id?:string|null;alt?:string|null};
export {itemIdentity,wishlistProductHref} from './catalogue-item-identity';
export function wishlistImage(item:{image_url?:string|null;media?:WishlistMedia[]}):string|undefined{
 const image=item.media?.find(m=>m.type==='image'&&m.primary)||item.media?.find(m=>m.type==='image');
 return getImageSrc(image?.url||item.image_url);
}
