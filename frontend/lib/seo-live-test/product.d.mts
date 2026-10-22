export function optionalProductSeo(product:any,options?:any):Promise<any|null>;
export function loadProductWithOptionalSeo(sku:string,options:any):Promise<{product:any;seo:any|null}>;
export function baselineProductMetadata(product:any):any;
export function validateBundle(bundle:any,product:any,config:any):any;
