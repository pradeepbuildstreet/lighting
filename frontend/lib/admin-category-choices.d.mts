export type CategoryChoice={id:string;name:string;_depth:number;_path:string;can_assign:boolean;assignment_hint:string};
export type CategoryChoiceGroup={id:string;name:string;hint:string;choices:CategoryChoice[]};
export function groupedCategoryChoices(rows:unknown):CategoryChoiceGroup[];
