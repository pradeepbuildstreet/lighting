import type {CatalogueCategory,CatalogueFacet,CatalogueList,CataloguePagination,CatalogueQuery} from './catalogue-types';
export type ListingHelpers={buildListQuery(input:Record<string,unknown>):URLSearchParams;flattenCategories(tree:CatalogueCategory[]):CatalogueCategory[];pageHref(path:string,query:CatalogueQuery,page:number):string;categoryHref(path:string):string};
export class ListingInputError extends Error{readonly code:'invalid_request';}
export function prepareQuery(input:Record<string,unknown>,categoryPath:CatalogueCategory[],helpers:ListingHelpers):CatalogueQuery;
export function filterOptions(tree:CatalogueCategory[],facets:CatalogueFacet[],query:CatalogueQuery,helpers:ListingHelpers):{categories:{value:string;label:string}[];brands:string[];currencies:string[]};
export function listingState(data:CatalogueList):{count:number;total:number;page:number;pages:number;outOfRange:boolean;empty:boolean;start:number;end:number};
export function paginationLinks(path:string,query:CatalogueQuery,pagination:CataloguePagination,helpers:ListingHelpers):{label:string;href:string}[];
export function clearFilterHref(path:string,categoryPath:CatalogueCategory[]):string;
export function categoryChildLinks(tree:CatalogueCategory[],path:CatalogueCategory[],helpers:ListingHelpers):{id:string;name:string;count:number;href:string}[];
