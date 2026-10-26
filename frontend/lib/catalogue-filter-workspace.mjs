import {parseTagSelections,encodeTagSelections,toggleTagChoice,toggleUnclassifiedChoice} from './catalogue-tag-filter-model.mjs';
const keys=['q','category','kind','brand','currency','min_price','max_price','sort','limit','tag_filters'];
export function draftFromQuery(query={},fixed=''){
 const draft=Object.fromEntries(keys.map(k=>[k,String(query[k]??'')]));
 draft.q=String(query.q||query.search||'');draft.category=fixed||draft.category;draft.sort=draft.sort||'name';draft.limit=draft.limit||'20';return draft;
}
export function editFilters(query,patch={},fixed=''){
 const next={...draftFromQuery(query,fixed),...patch};if(fixed)next.category=fixed;
 if(!next.currency){next.min_price='';next.max_price='';if(next.sort.startsWith('price_'))next.sort='name';}return next;
}
export function clearFilters(query,fixed=''){
 const next=draftFromQuery(query,fixed);return editFilters(next,{category:fixed,kind:'',brand:'',currency:'',min_price:'',max_price:'',tag_filters:''},fixed);
}
export function removeFilter(query,key,group='',tag='',fixed=''){
 const next=draftFromQuery(query,fixed);
 if(key==='tag')next.tag_filters=encodeTagSelections(toggleTagChoice(parseTagSelections(next.tag_filters),group,tag));
 else if(key==='unclassified')next.tag_filters=encodeTagSelections(toggleUnclassifiedChoice(parseTagSelections(next.tag_filters),group));
 else if(key==='group')next.tag_filters=encodeTagSelections(parseTagSelections(next.tag_filters).filter(s=>s.group_id!==group));
 else if(key==='price'){next.min_price='';next.max_price='';}
 else if(['category','kind','brand','currency'].includes(key))next[key]='';
 return editFilters(next,{},fixed);
}
export function selectionCount(query,fixed=''){
 const d=draftFromQuery(query,fixed);return ['kind','brand','currency'].filter(k=>d[k]).length+(!fixed&&d.category?1:0)+(d.min_price||d.max_price?1:0)+parseTagSelections(d.tag_filters).reduce((n,s)=>n+s.tag_ids.length+(s.unclassified?1:0),0);
}
