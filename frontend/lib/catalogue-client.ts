import {getApiBaseUrl} from './api-base';
import {createClient} from './catalogue-core';
import type {CatalogueClient} from './catalogue-types';
export {CatalogueError,buildListQuery,productHref,categoryHref,pageHref,resolveCategoryPath,flattenCategories,formatPrice,safeMediaUrl} from './catalogue-core';
export type * from './catalogue-types';
export function getCatalogueClient(timeoutMs=15000):CatalogueClient {
  return createClient({base:getApiBaseUrl(),fetchImpl:(input,init)=>fetch(input,init),timeoutMs});
}
