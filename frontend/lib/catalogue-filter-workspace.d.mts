import type {CatalogueQuery} from './catalogue-types';
export type FilterDraft={q:string;category:string;kind:string;brand:string;currency:string;min_price:string;max_price:string;sort:string;limit:string;tag_filters:string};
export function draftFromQuery(query?:CatalogueQuery|FilterDraft,fixed?:string):FilterDraft;
export function editFilters(query:CatalogueQuery|FilterDraft,patch?:Partial<FilterDraft>,fixed?:string):FilterDraft;
export function clearFilters(query:CatalogueQuery|FilterDraft,fixed?:string):FilterDraft;
export function removeFilter(query:CatalogueQuery|FilterDraft,key:string,group?:string,tag?:string,fixed?:string):FilterDraft;
export function selectionCount(query:CatalogueQuery|FilterDraft,fixed?:string):number;
