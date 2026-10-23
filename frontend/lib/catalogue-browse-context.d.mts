import type {CatalogueCategory,CatalogueProduct} from './catalogue-types';
export function safeReturnTo(value:unknown):string|null;
export function browseProductHref(base:string,category?:string,returnTo?:string):string;
export function resolveBrowseTrail(tree:CatalogueCategory[],assignments:CatalogueProduct['categories'],requested:unknown):{id:string;name:string;path:string}[];
