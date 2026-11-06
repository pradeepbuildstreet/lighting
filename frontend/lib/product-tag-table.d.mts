export type ProductTagInput={group_id:string;group_name:string;name:string;filter_attribute:boolean};
export type ProductTagGroup={id:string;name:string;values:string[]};
export function groupedProductTags(tags:ProductTagInput[]|undefined|null,filterAttribute:boolean):ProductTagGroup[];
