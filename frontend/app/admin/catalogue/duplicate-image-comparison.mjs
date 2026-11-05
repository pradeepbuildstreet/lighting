import {mediaSource} from './media-manager.mjs';
export function comparisonImages(productId,media){
 if(!Array.isArray(media))throw Error('Invalid product media response. Reload images.');
 return media.filter(item=>item&&item.media_type==='image').map(item=>({...item,src:mediaSource(productId,item)})).sort((a,b)=>Number(b.is_primary===true)-Number(a.is_primary===true)||(Number(a.sort_order)||0)-(Number(b.sort_order)||0)||String(a.id).localeCompare(String(b.id)));
}
export function comparisonRevisionChanged(expected,actual){return expected===undefined||expected===null||actual===undefined||actual===null||String(expected)!==String(actual);}
