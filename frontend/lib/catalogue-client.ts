import {getApiBaseUrl} from './api-base';
import {cleanListingHref} from './catalogue-listing-url.mjs';
import {createClient,buildListQuery as legacyBuildListQuery,pageHref as legacyPageHref} from './catalogue-core';
import {taggedListQuery,taggedPageHref} from './catalogue-tag-filter-model.mjs';
import {visibleCategoryTree} from './catalogue-category-visibility.mjs';
import {createInflightLoader} from './catalogue-performance.mjs';
import type {CatalogueClient,CatalogueCategories,CatalogueQuery,RequestOptions} from './catalogue-types';
export {CatalogueError,productHref,categoryHref,resolveCategoryPath,flattenCategories,formatPrice,safeMediaUrl} from './catalogue-core';
export type * from './catalogue-types';
export function buildListQuery(input:CatalogueQuery|URLSearchParams={}):URLSearchParams{return taggedListQuery(input,legacyBuildListQuery);}
export function pageHref(path:string,input:CatalogueQuery|URLSearchParams,page:number):string{return cleanListingHref(taggedPageHref(path,input,page,legacyBuildListQuery,legacyPageHref));}
const browserCategoryLoaders=new Map<string,(options?:RequestOptions)=>Promise<CatalogueCategories>>();
export function getCatalogueClient(timeoutMs=15000):CatalogueClient {
 const base=getApiBaseUrl();
 const client=createClient({base,fetchImpl:(input,init)=>fetch(input,init),timeoutMs});
 const list:CatalogueClient['list']=(query={},options)=>{const params=buildListQuery(query),encoded=params.get('tag_filters');params.delete('tag_filters');if(!encoded)return client.list(params,options);const tagged=createClient({base,fetchImpl:(input,init)=>{const url=String(input);return fetch(url+(url.includes('?')?'&':'?')+'tag_filters='+encodeURIComponent(encoded),init);},timeoutMs});return tagged.list(params,options);};
 const categories=(options?:RequestOptions)=>client.categories(options).then(result=>({...result,categories:visibleCategoryTree(result.categories)}));
 if(typeof window==='undefined')return {...client,list,categories};
 const key=base+'|'+timeoutMs;let shared=browserCategoryLoaders.get(key);
 if(!shared){shared=createInflightLoader(categories);browserCategoryLoaders.set(key,shared);}
 return {...client,list,categories:shared};
}
