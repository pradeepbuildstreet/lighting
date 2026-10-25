import type {CatalogueProduct} from './catalogue-types';
export function kindLabel(kind:string,label?:string):string;
export function tagSpecRows(product:CatalogueProduct):{rows:{key:string;label:string;value:string}[];integrated:{key:string;label:string;value:string}[]};
