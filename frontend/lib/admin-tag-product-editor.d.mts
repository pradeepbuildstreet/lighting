export function emptyDraft():Record<string,any>;
export function draftFromProduct(p:Record<string,any>):Record<string,any>;
export function envelope(d:Record<string,any>,kind:Record<string,any>|undefined):Record<string,any>;
export function assignable(c:Record<string,any>,rows:Record<string,any>[]):boolean;
export function tagSections(tags:Record<string,any>[],groups:string[]):{filter:Record<string,any>[];information:Record<string,any>[]};
export function addTag(tags:Record<string,any>[],tag:Record<string,any>):Record<string,any>[];
