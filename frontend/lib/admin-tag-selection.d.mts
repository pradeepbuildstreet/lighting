type Row=Record<string,any>;
export function selectTag(current:Row[],tag:Row,group:Row,checked?:boolean):Row[];
export function tagSelectionErrors(tags:Row[],groups:Row[]):string[];
