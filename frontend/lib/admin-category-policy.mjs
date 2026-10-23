export function categoryAssignable(row){return row?.is_active===true&&row?.allow_direct_products===true;}
export function categoryAssignmentError(ids,primary,rows){
 if(!Array.isArray(ids)||new Set(ids).size!==ids.length)return 'Category assignments must be unique.';
 const byId=new Map(rows.map(row=>[row.id,row]));
 const invalid=ids.filter(id=>!categoryAssignable(byId.get(id)));
 if(invalid.length)return 'Remove or replace unavailable category assignments: '+invalid.map(id=>byId.get(id)?.name||id).join(', ')+'.';
 if(primary&&!ids.includes(primary))return 'Primary category must be assigned.';
 return '';
}
