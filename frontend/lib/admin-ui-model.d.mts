export function statusLabel(value:string):string;
export function identity(row:{product_id?:string|null;sku:string}):string;
export function productLink(row:{product_id?:string|null}):string|null;
export function filterEnquiries<T extends {status:string;customer_name:string;mobile_number:string;email?:string|null;pin_code:string;submitted_at:string}>(rows:T[],query?:string,status?:string):T[];
export function pageRows<T>(rows:T[],page?:number,size?:number):{rows:T[];page:number;pages:number;total:number};
export function effectiveOfferStatus(status:string,expiresAt:string|null,now?:number):string;
export function money(value:number|string|null|undefined,currency?:string):string;
