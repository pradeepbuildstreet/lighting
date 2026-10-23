import type {CatalogueClient,CatalogueCategories,CatalogueFacet,RequestOptions} from './catalogue-types';
export function createInflightLoader<T>(load:(options:{signal:AbortSignal})=>Promise<T>):(options?:RequestOptions)=>Promise<T>;
export function startCatalogueReads(client:Pick<CatalogueClient,'categories'|'filters'>):{categories:Promise<CatalogueCategories>;facets:Promise<CatalogueFacet[]|null>};
