export type CategoryTreeRow=Record<string,any>&{_depth:number;_ancestors:string[];_path:string;_assignable:boolean};
export function orderedCategories(rows:Record<string,any>[]):CategoryTreeRow[];
export function categoryParentChoices(ordered:CategoryTreeRow[],editingId?:string):CategoryTreeRow[];
