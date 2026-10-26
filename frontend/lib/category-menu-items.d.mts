import type {CatalogueCategory} from './catalogue-types';
export type CategoryMenuItem={id:string;name:string;href:string;depth:number;count:number};
export function categoryMenuItems(nodes:CatalogueCategory[],categoryHref:(path:string)=>string,depth?:number):CategoryMenuItem[];
