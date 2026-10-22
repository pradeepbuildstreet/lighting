export class OptionalSeoError extends Error{code:string;constructor(code:string);}
export function optional(operation:()=>Promise<any>,options?:any):Promise<any|null>;
export function validateConfig(env?:any):any;
export function request(config:any,route:string,params?:any,options?:any):Promise<any>;
