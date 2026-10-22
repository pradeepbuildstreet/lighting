export class SeoClientError extends Error {status:number;constructor(message:string,status?:number);}
export type SeoBundle={status:'ok';sourceId:string;sourceRevision:string;projectRevision:number;canonical:string|null;breadcrumbs:{name:string;path:string}[];entity:any;metadata:any;jsonLd:Record<string,unknown>|null;jsonLdSerialized:string|null};
export function safeJsonLd(value:unknown):string;
export function assertProductMatches(bundle:SeoBundle,product:any):SeoBundle;
export function createSeoClient(config:{bridgeBase:string;token:string;projectId:string;allowLocal?:boolean;canonicalOrigin?:string|null;fetchImpl?:typeof fetch;timeoutMs?:number}):{product(id:string):Promise<SeoBundle>};
