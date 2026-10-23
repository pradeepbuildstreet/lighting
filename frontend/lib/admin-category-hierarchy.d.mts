export type HierarchyCategoryRow=Record<string,any>&{_depth:number;_ancestors:string[];_path:string};
export function orderedCategories(rows:Record<string,any>[]):HierarchyCategoryRow[];
export function categoryParentChoices(ordered:HierarchyCategoryRow[],editingId?:string):HierarchyCategoryRow[];
export function categoryRecord(row:Record<string,any>):Record<string,any>;
