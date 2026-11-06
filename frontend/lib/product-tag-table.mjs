export function groupedProductTags(tags,filterAttribute){
 if(!Array.isArray(tags))return [];
 const groups=new Map();
 for(const tag of tags){
  if(!tag||tag.filter_attribute!==filterAttribute||typeof tag.group_id!=='string'||!tag.group_id.trim()||typeof tag.group_name!=='string'||!tag.group_name.trim()||typeof tag.name!=='string'||!tag.name.trim())continue;
  const id=tag.group_id,name=tag.name.trim();
  if(!groups.has(id))groups.set(id,{id,name:tag.group_name.trim(),values:[]});
  const group=groups.get(id);if(!group.values.includes(name))group.values.push(name);
 }
 return [...groups.values()];
}
