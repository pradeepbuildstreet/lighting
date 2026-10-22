import type {CatalogueProduct} from './catalogue-types';
export type HomeGalleryItem={id:string;sku:string;name:string;url:string;alt:string;key:string};
export function buildGalleryItems(products:CatalogueProduct[],helpers:{safeMediaUrl(value:unknown):string|null},slots?:number,random?:()=>number):HomeGalleryItem[];
