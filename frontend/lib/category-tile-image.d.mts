import type {CatalogueCategory,CatalogueProduct} from './catalogue-types';
export function categoryTileImage(category:Pick<CatalogueCategory,'path'>,products:CatalogueProduct[],safeUrl:(url:string)=>string|null):{url:string;alt:string}|null;
export function categoryTileImages(categories:Pick<CatalogueCategory,'path'>[],products:CatalogueProduct[],safeUrl:(url:string)=>string|null,loadProducts:(category:Pick<CatalogueCategory,'path'>)=>Promise<CatalogueProduct[]>):Promise<({url:string;alt:string}|null)[]>;
