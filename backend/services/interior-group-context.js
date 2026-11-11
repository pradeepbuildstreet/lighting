'use strict';
const {uuid}=require('./public-catalogue-v1');
async function captureGroup(client,design,groupId){
 if(!groupId)return {group_id:null,group_name:null,group_label:design.grouping_enabled?design.group_label:null};
 if(!design.grouping_enabled)throw Object.assign(Error('Grouping is disabled for this project. Reload the design.'),{status:409});
 const id=uuid(groupId);const row=(await client.query('SELECT g.id,g.name FROM interior_layout_groups lg JOIN interior_project_groups g ON g.id=lg.group_id AND g.project_id=lg.project_id WHERE lg.layout_id=$1 AND lg.group_id=$2 AND lg.project_id=$3 AND g.published',[design.layout_id,id,design.project_id])).rows[0];
 if(!row)throw Object.assign(Error('Selected group is unavailable or does not contain this layout. Reload the project.'),{status:409});
 return {group_id:row.id,group_name:row.name,group_label:design.group_label};
}
module.exports={captureGroup};
