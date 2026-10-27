"use strict";
function fail(message){throw Object.assign(new Error(message),{status:400});}
function splitList(value,max=200){
 if(value===null||value===undefined||value==='')return [];
 if(typeof value!=='string'||value.length>50000)fail('Use a plain comma-separated text list');
 if(!value.trim())return [];
 const result=[];let text='',quoted=false,closed=false,started=false;
 function emit(){const v=text.trim();if(!v)fail('Empty entry in comma-separated list');result.push(v);if(result.length>max)fail('Too many entries in list');text='';quoted=false;closed=false;started=false;}
 for(let i=0;i<value.length;i++){const c=value[i];if(quoted){if(c==='"'){if(value[i+1]==='"'){text+='"';i++;}else{quoted=false;closed=true;}}else text+=c;}else if(closed){if(c===',')emit();else if(!/\s/.test(c))fail('Unexpected text after quoted entry');}else if(c===',')emit();else if(c==='"'){if(started||text.trim())fail('Quote must start an entry');text='';quoted=true;started=true;}else{text+=c;if(!/\s/.test(c))started=true;}}
 if(quoted)fail('Unclosed quote in list');emit();return result;
}
function joinList(values){return values.map(v=>/[",\r\n]/.test(String(v))?'"'+String(v).replace(/"/g,'""')+'"':String(v)).join(', ');}
function relativeImagePath(value,root=''){
 let p=String(value).trim().replace(/\\/g,'/'),r=String(root||'').trim().replace(/\\/g,'/').replace(/\/+$/,'');
 if(!p||/[\x00-\x1f\x7f]/.test(p))fail('Invalid image path');
 if(/^[A-Za-z]:\//.test(p)||p.startsWith('/')){if(!r||!p.startsWith(r+'/'))fail('Absolute image path must be inside the explicitly supplied local root');p=p.slice(r.length+1);}
 if(p.startsWith('/')||p.includes(':')||p.split('/').some(s=>!s||s==='.'||s==='..'))fail('Use an image path relative to the selected folder; traversal is not allowed');
 if(p.length>1000)fail('Image path is too long');return p;
}
function uniqueEntries(values){return [...new Set(values)];}
function checkRevision(value){if(typeof value==='number'&&!Number.isSafeInteger(value))fail('Exported revision must be retained as text');const s=String(value??'');if(!/^[1-9]\d{0,18}$/.test(s)||BigInt(s)>9223372036854775807n)fail('A positive exported expected_revision is required');return s;}
module.exports={splitList,joinList,relativeImagePath,uniqueEntries,checkRevision};
