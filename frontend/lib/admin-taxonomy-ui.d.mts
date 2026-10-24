export function referenceDraft(row:Record<string,any>|null,kind:string,group?:string):Record<string,any>;
export function draftSignature(value:unknown):string;
export function mergeReference(items:Record<string,any>[],row:Record<string,any>,limit?:number):Record<string,any>[];
export function appendGroup(ids:string[],id:string):string[];
export function moveGroup(ids:string[],index:number,direction:number):string[];
