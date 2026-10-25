import {parseTagSelections} from './catalogue-tag-filter-model.mjs';
const SLUG_PATH=/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;
const LIST_KEYS=new Set(['q','search','category','kind','brand','currency','min_price','max_price','sort','page','limit','tag_filters']);
export function safeReturnTo(value){
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||value.includes('\\'))return null;
 try{const url=new URL(value,'https://browse.invalid');if(url.origin!=='https://browse.invalid'||url.hash)return null;
  if(url.pathname!=='/products'&&!(url.pathname.startsWith('/categories/')&&SLUG_PATH.test(url.pathname.slice(12))))return null;
  const seen=new Set();for(const [key] of url.searchParams){if(!LIST_KEYS.has(key)||seen.has(key))return null;seen.add(key);}
  if(url.searchParams.has('tag_filters')){parseTagSelections(url.searchParams.get('tag_filters'));const base=new URLSearchParams(url.searchParams);base.delete('tag_filters');if((url.pathname+(base.size?'?'+base.toString():'' )).length>4000)return null;}else if(value.length>4000)return null;
  return url.pathname+url.search;
 }catch(_){return null;}
}
export function browseProductHref(base,category,returnTo){
 if(typeof base!=='string'||!base.startsWith('/catalogue/products/')||/[?#\\]/.test(base))throw new Error('Expected canonical product path');
 const query=new URLSearchParams();if(typeof category==='string'&&SLUG_PATH.test(category))query.set('browse',category);
 const back=safeReturnTo(returnTo);if(back)query.set('returnTo',back);
 return base+(query.size?'?'+query.toString():'');
}
export function resolveBrowseTrail(tree,assignments,requested){
 const primary=assignments.find(c=>c.primary)||assignments[0];
 const belongs=typeof requested==='string'&&SLUG_PATH.test(requested)&&assignments.some(c=>c.path===requested||c.path.startsWith(requested+'/'));
 function walk(path){if(!path)return [];let nodes=tree;const result=[];for(const segment of path.split('/')){const found=nodes.find(c=>c.slug===segment);if(!found)return [];result.push({id:found.id,name:found.name,path:found.path});nodes=found.children;}return result;}
 const trail=walk(belongs?requested:primary?.path);if(trail.length)return trail;
 const fallback=walk(primary?.path);return fallback.length?fallback:primary?[{id:primary.id,name:primary.name,path:primary.path}]:[];
}
