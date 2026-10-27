export const MAX_MEDIA_BYTES:number;
export function validateFiles<T extends {name:string;type:string;size:number}>(files:T[]):T[];
export function metadata(item:Record<string,any>,revision:unknown):{caption:string|null;alt_text:string|null;sort_order:number;is_primary:boolean;revision:string};
export function mediaSource(productId:string,item:Record<string,any>):string|null;
export function metadataMatches(item:Record<string,any>|undefined,sent:Record<string,any>):boolean;
