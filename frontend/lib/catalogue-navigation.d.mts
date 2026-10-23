import type {CatalogueCategory,RequestOptions} from './catalogue-types';
export function pruneEmptyCategories(nodes:CatalogueCategory[]):CatalogueCategory[];
export function createInflightLoader<T>(load:(options:{signal:AbortSignal})=>Promise<T>):(options?:RequestOptions)=>Promise<T>;
