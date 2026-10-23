const collator=new Intl.Collator('en',{sensitivity:'base'});
export function orderedCategories(rows){
 if(!Array.isArray(rows)||rows.length>10000)throw new Error('Invalid category list');
 const byId=new Map(),children=new Map();
 for(const row of rows){if(!row||typeof row.id!=='string'||typeof row.name!=='string'||byId.has(row.id))throw new Error('Invalid or duplicate category identity');byId.set(row.id,row);}
 for(const row of rows){const parent=row.parent_id||null;if(parent&&!byId.has(parent))throw new Error('Category parent is missing');if(!children.has(parent))children.set(parent,[]);children.get(parent).push(row);}
 for(const list of children.values())list.sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0)||collator.compare(a.name,b.name)||a.id.localeCompare(b.id));
 const result=[],seen=new Set();
 function visit(row,ancestors,names){if(seen.has(row.id)||ancestors.length>64)throw new Error('Category cycle or excessive depth');seen.add(row.id);const path=[...names,row.name];result.push({...row,_depth:ancestors.length,_ancestors:[...ancestors],_path:path.join(' → '),_assignable:row.is_active===true&&row.allow_direct_products===true});for(const child of children.get(row.id)||[])visit(child,[...ancestors,row.id],path);}
 for(const root of children.get(null)||[])visit(root,[],[]);
 if(seen.size!==rows.length)throw new Error('Category cycle detected');
 return result;
}
export function categoryParentChoices(ordered,editingId){return ordered.filter(row=>row.id!==editingId&&!row._ancestors.includes(editingId));}
