import {parseTagSelections,encodeTagSelections} from './catalogue-tag-filter-model.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function bad(){throw new Error('Invalid tag-filter response');}
function record(x){if(!x||typeof x!=='object'||Array.isArray(x))bad();return x;}
function id(x){if(typeof x!=='string'||!UUID.test(x))bad();return x.toLowerCase();}
function name(x,nullable=false){if(nullable&&x===null)return null;if(typeof x!=='string'||!x.length||x.length>120)bad();return x;}
function count(x,min=0,max=Number.MAX_SAFE_INTEGER){if(!Number.isSafeInteger(x)||x<min||x>max)bad();return x;}
function array(x,max){if(!Array.isArray(x)||x.length>max)bad();return x;}
function unique(rows){if(new Set(rows.map(x=>x.id)).size!==rows.length)bad();return rows;}
export function decodeTagFacets(input){
 const x=record(input);if(x.source!=='catalogue')bad();
 const groups=unique(array(x.groups,200).map(v=>{const g=record(v),eligible_count=count(g.eligible_count),classified_count=count(g.classified_count),not_classified_count=count(g.not_classified_count);if(classified_count>eligible_count||not_classified_count!==eligible_count-classified_count)bad();return {id:id(g.id),name:name(g.name),eligible_count,classified_count,not_classified_count};}));
 const raw=array(x.selected,20);parseTagSelections(JSON.stringify(raw.map(v=>{record(v);return {group_id:v.group_id,tag_ids:v.tag_ids,unclassified:v.unclassified};})));
 const selected=raw.map(s=>{const tag_ids=s.tag_ids.map(id),tags=unique(array(s.tags,200).map(t=>{record(t);const key=id(t.id);if(!tag_ids.includes(key))bad();return {id:key,name:name(t.name,true)};}));if(tags.length!==new Set(tag_ids).size)bad();return {group_id:id(s.group_id),tag_ids,unclassified:s.unclassified===true,group_name:name(s.group_name,true),tags};});
 let options=null;if(x.options!==null){const o=record(x.options),p=record(o.pagination),pagination={page:count(p.page,1,10000),limit:count(p.limit,1,100),total:count(p.total)};const items=unique(array(o.items,pagination.limit).map(t=>{record(t);return {id:id(t.id),name:name(t.name),product_count:count(t.product_count)};}));options={group_id:id(o.group_id),items,pagination,not_classified_count:count(o.not_classified_count)};}
 return {source:'catalogue',groups:groups.filter(g=>g.classified_count>0),selected,options};
}
export function tagFacetParams(base,value,group='',term='',page=1){
 const p=new URLSearchParams(base);for(const k of ['page','limit','sort','tag_group','tag_q','tag_page','tag_limit'])p.delete(k);
 const encoded=encodeTagSelections(parseTagSelections(value));if(encoded)p.set('tag_filters',encoded);else p.delete('tag_filters');
 if(group){p.set('tag_group',id(group));if(typeof term!=='string'||term.length>80)throw new Error('Tag search is too long');count(page,1,10000);p.set('tag_page',String(page));p.set('tag_limit','50');if(term.trim())p.set('tag_q',term.trim());}return p;
}
export async function loadTagFacets(params,{signal,fetchImpl=fetch,timeoutMs=10000}={}){
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>120000)throw new Error('Invalid tag-filter timeout');
 const ctl=new AbortController(),abort=()=>ctl.abort();let timeout=false;if(signal?.aborted)throw new DOMException('Cancelled','AbortError');signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(()=>{timeout=true;ctl.abort();},timeoutMs);
 try{const response=await fetchImpl('/api/catalogue/tag-filters?'+params.toString(),{method:'GET',cache:'no-store',credentials:'same-origin',headers:{Accept:'application/json'},signal:ctl.signal});if(!response.ok)throw new Error(response.status===429?'Too many filter requests. Please wait and retry.':'Tag filters are temporarily unavailable.');const data=decodeTagFacets(await response.json());if(ctl.signal.aborted)throw new DOMException('Cancelled','AbortError');const group=params.get('tag_group');if(group?data.options?.group_id!==group.toLowerCase():data.options!==null)bad();return data;}catch(e){if(timeout)throw new Error('Tag filters timed out. Retry.');throw e;}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
