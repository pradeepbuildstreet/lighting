import type {CatalogueProduct,CatalogueCategory,CatalogueQuery,CatalogueClient,CatalogueCategories,CatalogueList,CatalogueDetail,CatalogueFilters,CatalogueCompatibility} from './catalogue-types';
export type CatalogueErrorCode='invalid_request'|'invalid_response'|'configuration'|'not_found'|'rate_limited'|'unavailable'|'timeout'|'aborted';
export class CatalogueError extends Error{readonly code:CatalogueErrorCode;readonly status:number;constructor(code:CatalogueErrorCode,message:string,status?:number);}
export function buildListQuery(input?:CatalogueQuery|URLSearchParams):URLSearchParams;
export function productHref(sku:string):string;
export function categoryHref(path:string|string[]):string;
export function pageHref(path:string,input:CatalogueQuery|URLSearchParams,page:number):string;
export function resolveCategoryPath(tree:CatalogueCategory[],segments:string[]):CatalogueCategory[];
export function flattenCategories(tree:CatalogueCategory[]):CatalogueCategory[];
export function formatPrice(price:string,currency:string):string;
export function safeMediaUrl(value:unknown):string|null;
export function createClient(options:{base:string;fetchImpl:typeof fetch;timeoutMs?:number}):CatalogueClient;
export const decode:{product(input:unknown):CatalogueProduct;categories(input:unknown):CatalogueCategories;list(input:unknown):CatalogueList;detail(input:unknown):CatalogueDetail;filters(input:unknown):CatalogueFilters;compatibility(input:unknown):CatalogueCompatibility};
