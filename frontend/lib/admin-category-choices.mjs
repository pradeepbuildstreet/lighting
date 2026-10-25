import {orderedCategories} from './admin-category-hierarchy.mjs';
import {assignable} from './admin-tag-product-editor.mjs';
export function groupedCategoryChoices(rows){
 const ordered=orderedCategories(rows),byId=new Map(ordered.map(c=>[c.id,c])),groups=[],byRoot=new Map();
 for(const c of ordered){const unavailable=!c.is_active||c._ancestors.some(id=>!byId.get(id)?.is_active)||typeof c.allow_direct_products!=='boolean',can_assign=assignable(c,rows),assignment_hint=can_assign?'':unavailable?'Unavailable':'Group only — no direct products';const choice={id:c.id,name:c.name,_depth:c._depth,_path:c._path,can_assign,assignment_hint};if(!c._depth){const group={id:c.id,name:c.name,hint:assignment_hint,choices:[choice]};groups.push(group);byRoot.set(c.id,group);}else byRoot.get(c._ancestors[0]).choices.push(choice);}
 return groups;
}
