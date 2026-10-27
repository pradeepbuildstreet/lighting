import {parseTagSelections,encodeTagSelections} from './catalogue-tag-filter-model.mjs';
export function groupDraft(value,group){return encodeTagSelections(parseTagSelections(value).filter(row=>row.group_id===group));}
export function applyGroupDraft(applied,group,draft){const rows=parseTagSelections(draft);if(rows.some(row=>row.group_id!==group))throw Error('Unexpected feature selection');return encodeTagSelections([...parseTagSelections(applied).filter(row=>row.group_id!==group),...rows]);}
