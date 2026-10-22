export type MediaDraft={id:string;caption:string;alt_text:string;sort_order:string;is_primary:boolean;revision:string;dirty:boolean};
export function makeDraft(media:Record<string,any>,revision:unknown):MediaDraft;
export function editDraft(draft:MediaDraft,key:string,value:unknown):MediaDraft;
export function mergeDrafts(items:Record<string,any>[],revision:unknown,previous?:Record<string,MediaDraft>,resetId?:string|null):Record<string,MediaDraft>;
export function payload(draft:MediaDraft):{caption:string|null;alt_text:string|null;sort_order:number;is_primary:boolean;revision:string};
export function verify(saved:Record<string,any>|undefined,sent:ReturnType<typeof payload>):boolean;
