export type WishlistSelection={selected(id:string):boolean;pending(id:string):boolean;set(id:string,desired:boolean):Promise<void>};
export function createWishlistSelection(options:{read:(id:string)=>boolean;write:(id:string,desired:boolean)=>Promise<unknown>;run:(work:()=>Promise<void>)=>Promise<void>;changed:()=>void;prepare?:(id:string)=>Promise<void>}):WishlistSelection;
