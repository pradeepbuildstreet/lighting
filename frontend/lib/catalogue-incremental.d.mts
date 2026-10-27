import type {CatalogueList,CatalogueProduct} from './catalogue-types';
export type ListPosition={y:number;id?:string;offset?:number};
export type RequestTicket={signal:AbortSignal;abort:()=>void};
export function mergeProducts(current:CatalogueProduct[],incoming:CatalogueProduct[]):CatalogueProduct[];
export function appendPage(current:CatalogueList,next:CatalogueList):CatalogueList;
export function createPageRequestGate():{begin():RequestTicket|null;valid(ticket:RequestTicket):boolean;finish(ticket:RequestTicket):boolean;cancel():void};
export function makeSnapshot(key:string,seed:CatalogueList,data:CatalogueList,position:ListPosition,now?:number):unknown;
export function restoreSnapshot(value:unknown,key:string,seed:CatalogueList,now?:number):{data:CatalogueList;position:ListPosition}|null;
