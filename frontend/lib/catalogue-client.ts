import {getApiBaseUrl} from './api-base';
import {createClient} from './catalogue-core';
import {pruneEmptyCategories,createInflightLoader} from './catalogue-navigation.mjs';
import type {CatalogueClient,CatalogueCategories,RequestOptions} from './catalogue-types';
export {CatalogueError,buildListQuery,productHref,categoryHref,pageHref,resolveCategoryPath,flattenCategories,formatPrice,safeMediaUrl} from './catalogue-core';
export type * from './catalogue-types';
const browserCategoryLoaders=new Map<string,(options?:RequestOptions)=>Promise<CatalogueCategories>>();
export function getCatalogueClient(timeoutMs=15000):CatalogueClient {
 const base=getApiBaseUrl();
 const client=createClient({base,fetchImpl:(input,init)=>fetch(input,init),timeoutMs});
 const categories=(options?:RequestOptions)=>client.categories(options).then(data=>({...data,categories:pruneEmptyCategories(data.categories)}));
 if(typeof window==='undefined')return {...client,categories};
 const key=base+'|'+timeoutMs;
 let shared=browserCategoryLoaders.get(key);
 if(!shared){shared=createInflightLoader(categories);browserCategoryLoaders.set(key,shared);}
 return {...client,categories:shared};
}
