export type DiscountBrowserRow=Record<string,any>;
export type DiscountChange={id:string;default_discount_percent:string;expected_token:string};
export function validDiscount(value:unknown):boolean;
export function discountValue(row:DiscountBrowserRow,drafts:Record<string,string>):string;
export function discountDirty(row:DiscountBrowserRow,drafts:Record<string,string>):boolean;
export function discountChanges(rows:DiscountBrowserRow[],drafts:Record<string,string>):DiscountChange[];
export function discountAmount(row:DiscountBrowserRow,value:string):number|null;
