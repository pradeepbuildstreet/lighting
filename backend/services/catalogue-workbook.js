"use strict";
const V=require('../validators/catalogue');
const columns=['sku','name','product_kind','brand','model_number','description','selling_price','currency','is_active','category_slugs','primary_category_slug','fixture_type_code','light_type_code','light_source_mode','material','style','mounting_type','width_mm','depth_mm','height_mm','integrated_specs','other_specs','wattage','lumens','color_temperature_k','voltage_min','voltage_max','diameter_mm','length_mm','dimmable','mode_change_confirmed'];
function inspectZip(b){
 if(!Buffer.isBuffer(b)||b.length<22||b.length>5242880)V.fail('XLSX exceeds size limit or is empty');
 let end=-1;for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--)if(b.readUInt32LE(i)===0x06054b50&&i+22+b.readUInt16LE(i+20)===b.length){end=i;break;}
 if(end<0||b.readUInt16LE(end+4)||b.readUInt16LE(end+6))V.fail('Invalid ZIP envelope');
 const count=b.readUInt16LE(end+10),size=b.readUInt32LE(end+12);let p=b.readUInt32LE(end+16),total=0;const names=new Set();
 if(!count||count>1000||count!==b.readUInt16LE(end+8)||p+size!==end)V.fail('Unsupported ZIP directory');
 for(let i=0;i<count;i++){
  if(p+46>end||b.readUInt32LE(p)!==0x02014b50)V.fail('Invalid ZIP entry');
  const next=p+46+b.readUInt16LE(p+28)+b.readUInt16LE(p+30)+b.readUInt16LE(p+32),expanded=b.readUInt32LE(p+24);
  if(next>end||(b.readUInt16LE(p+8)&1)||![0,8].includes(b.readUInt16LE(p+10))||expanded===0xffffffff)V.fail('Unsupported ZIP entry');
  const name=b.subarray(p+46,p+46+b.readUInt16LE(p+28)).toString('utf8');
  if(names.has(name)||name.startsWith('/')||name.includes('\\')||name.split('/').includes('..')||/vbaProject|externalLinks|\.bin$/i.test(name))V.fail('Unsafe workbook archive');
  names.add(name);total+=expanded;if(total>33554432)V.fail('Workbook expanded size exceeds 32 MiB');p=next;
 }
 if(p!==end||!names.has('[Content_Types].xml')||!names.has('xl/workbook.xml'))V.fail('Not an XLSX workbook');
}
function cell(v){if(v==null)return '';if(['string','number','boolean'].includes(typeof v))return typeof v==='string'?v.trim():v;if(Array.isArray(v.richText))return v.richText.map(x=>x.text||'').join('').trim();V.fail('Use plain cells, not formulas, hyperlinks or dates');}
function bool(v){if(v==null||v==='')return undefined;if(v===true||v==='true')return true;if(v===false||v==='false')return false;V.fail('Boolean values must be true or false');}
function obj(v){if(v==null||v==='')return {};try{const x=JSON.parse(v);if(x&&typeof x==='object'&&!Array.isArray(x))return x;}catch(_){}V.fail('Specifications must be JSON objects');}
function parseSheet(sheet,masters){
 if(!sheet||sheet.name!=='Products'||sheet.rowCount>1001||sheet.columnCount>columns.length)V.fail('Use Products worksheet, maximum 1000 product rows');
 const headers=[];for(let c=1;c<=sheet.columnCount;c++)headers.push(cell(sheet.getRow(1).getCell(c).value));
 if(headers.some(h=>!columns.includes(h))||new Set(headers).size!==headers.length||['sku','name','product_kind'].some(h=>!headers.includes(h)))V.fail('Invalid or missing worksheet headers');
 const find=(items,key,value)=>{if(typeof value!=='string'||!value)V.fail('Missing reference '+key);const matches=items.filter(x=>String(x[key]).toLowerCase()===value.toLowerCase());if(matches.length!==1||!matches[0].is_active)V.fail('Unknown, ambiguous or inactive reference: '+value);return matches[0].id;};
 const rows=[];
 for(let i=2;i<=sheet.rowCount;i++){
  const raw=headers.map((_,c)=>sheet.getRow(i).getCell(c+1).value);if(raw.every(v=>v==null||v===''))continue;
  try{
   const r=Object.fromEntries(headers.map((h,c)=>[h,cell(raw[c])]));const specs={other_specs:obj(r.other_specs)};
   if(r.product_kind==='fixture'){
    specs.fixture_type_id=find(masters.fixtures,'code',r.fixture_type_code);specs.light_source_mode=r.light_source_mode||'replaceable';specs.inbuilt_specs=obj(r.integrated_specs);
    for(const f of ['material','style','mounting_type','width_mm','depth_mm','height_mm'])specs[f]=r[f];
   }else if(r.product_kind==='light'){
    specs.light_type_id=find(masters.lights,'code',r.light_type_code);specs.dimmable=bool(r.dimmable);
    for(const f of ['wattage','lumens','color_temperature_k','voltage_min','voltage_max','diameter_mm','length_mm'])specs[f]=r[f];
   }else V.fail('Invalid product kind');
   const payload={...Object.fromEntries(['sku','name','product_kind','brand','model_number','description','selling_price','currency'].map(f=>[f,r[f]])),specs,is_active:bool(r.is_active),mode_change_confirmed:bool(r.mode_change_confirmed),category_ids:String(r.category_slugs||'').split(';').map(x=>x.trim()).filter(Boolean).map(s=>find(masters.categories,'slug',s)),primary_category_id:r.primary_category_slug?find(masters.categories,'slug',r.primary_category_slug):null};
   const validated=V.product(payload);payload.sku=validated.sku;rows.push({sheet:'Products',row_number:i,payload,errors:[]});
  }catch(e){if(e.status!==400)throw e;rows.push({sheet:'Products',row_number:i,payload:null,errors:[e.message]});}
 }
 if(!rows.length)V.fail('No product rows');return rows;
}
async function parseWorkbook(buffer,masters,ExcelJS){
 inspectZip(buffer);const library=ExcelJS||require('exceljs'),book=new library.Workbook();
 try{await book.xlsx.load(buffer);}catch(_){V.fail('Unable to decode XLSX');}
 if(book.worksheets.some(s=>!['Products','Instructions'].includes(s.name)))V.fail('Unexpected worksheet');
 return parseSheet(book.getWorksheet('Products'),masters);
}
module.exports={columns,inspectZip,cell,parseSheet,parseWorkbook};
