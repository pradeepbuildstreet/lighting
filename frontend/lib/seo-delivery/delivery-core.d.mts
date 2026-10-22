export function loadState(file:string):Promise<any>;
export function effectiveProduct(state:any,sku:string,preview?:any):Promise<any>;
export function resolveRedirect(state:any,pathname:string,preview?:any):Promise<any>;
export function sitemapEntries(state:any,enabled?:boolean,preview?:any):Promise<Array<{url:string}>>;
export function canIndex(preview:any,baseIndex:boolean,enabled?:boolean):boolean;
