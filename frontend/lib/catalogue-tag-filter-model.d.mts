export type TagSelection={group_id:string;tag_ids:string[];unclassified:boolean};
export class TagFilterError extends Error{readonly code:'invalid_request';}
export function parseTagSelections(value:unknown):TagSelection[];
export function encodeTagSelections(rows:TagSelection[]):string;
export function toggleTagChoice(rows:TagSelection[],group:string,tag:string):TagSelection[];
export function toggleUnclassifiedChoice(rows:TagSelection[],group:string):TagSelection[];
export function taggedListQuery(input:unknown,legacyBuild:(input:any)=>URLSearchParams):URLSearchParams;
export function taggedPageHref(path:string,input:unknown,page:number,legacyBuild:(input:any)=>URLSearchParams,legacyPage:(path:string,input:any,page:number)=>string):string;
