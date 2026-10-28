function fail(message){throw new Error(message);}
export function selectTag(current,tag,group,checked=true){
 if(!Array.isArray(current)||!tag||!group||tag.tag_group_id!==group.id)fail('Choose a tag from the selected group');
 if(!checked)return current.filter(t=>t.id!==tag.id);
 if(group.is_active!==true||tag.is_active!==true)fail('Choose active tags and groups');
 const mode=group.selection_mode??'multi';if(!['single','multi'].includes(mode))fail('Reload the group selection policy');
 const base=mode==='single'?current.filter(t=>t.tag_group_id!==group.id):current.filter(t=>t.id!==tag.id);
 const next=[...base,{...tag,group_name:group.name,group_code:group.code,group_active:true,selection_mode:mode}];
 if(next.length>200)fail('At most 200 tags per product');return next;
}
export function tagSelectionErrors(tags,groups){
 const policies=new Map();for(const t of tags)if(t.selection_mode)policies.set(t.tag_group_id,{mode:t.selection_mode,name:t.group_name||t.tag_group_id});
 for(const g of groups)policies.set(g.id,{mode:g.selection_mode??'multi',name:g.name||g.code||g.id});
 const errors=[];for(const [id,p] of policies)if(p.mode==='single'&&new Set(tags.filter(t=>t.tag_group_id===id).map(t=>t.id)).size>1)errors.push(p.name+' permits at most one selection');return errors;
}
