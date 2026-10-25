import type {TagSelection} from './catalogue-tag-filter-model.mjs';
export type TagGroup={id:string;name:string;eligible_count:number;classified_count:number;not_classified_count:number};
export type TagChoice={id:string;name:string;product_count:number};
export type TagOptions={group_id:string;items:TagChoice[];pagination:{page:number;limit:number;total:number};not_classified_count:number};
export type TagFacets={source:'catalogue';groups:TagGroup[];selected:(TagSelection&{group_name:string|null;tags:{id:string;name:string|null}[]})[];options:TagOptions|null};
export function decodeTagFacets(input:unknown):TagFacets;
export function tagFacetParams(base:URLSearchParams,value:string,group?:string,term?:string,page?:number):URLSearchParams;
export function loadTagFacets(params:URLSearchParams,options?:{signal?:AbortSignal;fetchImpl?:typeof fetch;timeoutMs?:number}):Promise<TagFacets>;
