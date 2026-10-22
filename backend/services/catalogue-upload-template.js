"use strict";
const HEADERS=['sku','name','product_kind','brand','model_number','description','selling_price','currency','is_active','category_slugs','primary_category_slug','fixture_type_code','light_type_code','light_source_mode','material','style','mounting_type','width_mm','depth_mm','height_mm','integrated_specs','other_specs','wattage','lumens','color_temperature_k','voltage_min','voltage_max','diameter_mm','length_mm','dimmable','mode_change_confirmed'];
function text(v){return v==null?'':String(v);}
function categoryPath(id,rows){const byId=new Map(rows.map(r=>[r.id,r])),parts=[],seen=new Set();let next=id;while(next&&!seen.has(next)){seen.add(next);const r=byId.get(next);if(!r)break;parts.unshift(text(r.name));next=r.parent_id;}return parts.join(' > ');}
async function referenceSnapshot(db){return db.transaction(async c=>{
 await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const fixtures=(await c.query('SELECT id,code,name FROM fixture_types WHERE is_active=true ORDER BY name,id')).rows;
 const lights=(await c.query('SELECT id,code,name,base_type,technology FROM light_types WHERE is_active=true ORDER BY name,id')).rows;
 const allCategories=(await c.query('SELECT id,slug,name,parent_id,is_active FROM categories ORDER BY name,id')).rows;
 const categories=allCategories.filter(r=>r.is_active).map(r=>({...r,path:categoryPath(r.id,allCategories)}));
 return {fixtures,lights,categories};
});}
function validateRefs(refs){
 for(const [key,field] of [['fixtures','code'],['lights','code'],['categories','slug']]){
  if(!Array.isArray(refs[key])||refs[key].length>10000)throw new Error('Reference list exceeds template limit');
  const seen=new Set();for(const r of refs[key]){const value=text(r[field]);if(!value||seen.has(value.toLowerCase()))throw new Error('Ambiguous reference list');seen.add(value.toLowerCase());}
 }
}
function populate(book,refs,generatedAt=new Date()){
 validateRefs(refs);book.creator='Catalogue admin';book.created=generatedAt;
 const products=book.addWorksheet('Products'),instructions=book.addWorksheet('Instructions');
 products.addRow(HEADERS);products.views=[{state:'frozen',ySplit:1}];products.autoFilter={from:{row:1,column:1},to:{row:1,column:HEADERS.length}};
 HEADERS.forEach((h,i)=>{products.getColumn(i+1).width=h==='description'||h.endsWith('_specs')?38:24;const c=products.getCell(1,i+1);c.font={bold:true,color:{argb:'FFFFFFFF'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF244B65'}};});
 const lines=[
 'Catalogue upload workbook - live DB reference snapshot at download, not a live database connection',
 'Template schema: 2C-products-v1', 'Generated (UTC): '+generatedAt.toISOString(),
 'Only Products rows are imported. Instructions/reference cells never create DB records.',
 'SKU/name/product_kind required. Fixture rows need fixture_type_code; light rows need light_type_code.',
 'Choose stable codes/slugs. Reference names/paths are shown in tables to the right.',
 'Category assignment: select one slug or manually enter semicolon-separated slugs. Primary must be assigned.',
 'Create/Update/Upsert mode is selected in the application, not this workbook.',
 'Updates replace all imported fields and categories. Blank optional values clear data; booleans/mode follow parser defaults.',
 'Booleans: true or false. Blank dimmable means unknown. Never insert formulas into Products cells.',
 'integrated_specs and other_specs: plain JSON objects. Integrated is not a compatible-options list.',
 'Units: dimensions mm; wattage W; lumens lm; colour temperature K; voltage V.',
 'Maximum 1000 product rows. Upload only XLSX <=5 MiB.',
 'No media, socket groups, compatibility rules, dealer prices or SEO are imported by this template.',
 'References are revalidated against the current DB during preview and commit. Download again after master-data changes.',
 'Empty dropdown: create/activate the relevant reference in Reference data and download again.'
 ];lines.forEach((line,i)=>{const c=instructions.getCell(i+1,1);c.value=line;c.alignment={wrapText:true,vertical:'top'};});instructions.getColumn(1).width=95;
 let column=3;
 function list(name,title,rows,fields){
  const col=column;column+=fields.length+1;
  fields.forEach((field,i)=>{instructions.getColumn(col+i).width=i===0?28:40;instructions.getCell(1,col+i).value=i===0?title:field;instructions.getCell(1,col+i).font={bold:true};});
  if(!rows.length)instructions.getCell(2,col).value='';
  rows.forEach((r,i)=>fields.forEach((field,j)=>{instructions.getCell(i+2,col+j).value=text(r[field]);}));
  const first=instructions.getCell(2,col).address,last=instructions.getCell(Math.max(2,rows.length+1),col).address;
  book.definedNames.add("'Instructions'!"+first.replace(/([A-Z]+)(\d+)/,(_,letters,row)=>'$'+letters+'$'+row)+":"+last.replace(/([A-Z]+)(\d+)/,(_,letters,row)=>'$'+letters+'$'+row),name);
  return name;
 }
 const lists={
  fixture_type_code:list('FixtureTypeCodes','Fixture type codes',refs.fixtures,['code','name']),
  light_type_code:list('LightTypeCodes','Light type codes',refs.lights,['code','name','base_type','technology']),
  category_slugs:list('CategorySlugs','Category slugs',refs.categories,['slug','path']),
  product_kind:list('ProductKinds','Product kinds',[{value:'fixture'},{value:'light'}],['value']),
  light_source_mode:list('LightSourceModes','Light source modes',['replaceable','integrated','hybrid'].map(value=>({value})),['value']),
  is_active:list('BooleanValues','Boolean values',[{value:'true'},{value:'false'}],['value']),
  currency:list('CurrencyValues','Template currency',[{value:'INR'}],['value'])
 };
 lists.primary_category_slug=lists.category_slugs;lists.dimmable=lists.is_active;lists.mode_change_confirmed=lists.is_active;
 for(const [header,range] of Object.entries(lists)){
  const col=HEADERS.indexOf(header)+1;
  for(let row=2;row<=1001;row++)products.getCell(row,col).dataValidation={type:'list',allowBlank:true,formulae:[range],showInputMessage:true,promptTitle:'Select a value',prompt:header==='category_slugs'?'Select one category or type multiple slugs separated by semicolons.':'Use a current code/value from the dropdown.',showErrorMessage:header!=='category_slugs',errorStyle:'stop',errorTitle:'Invalid list value',error:'Use the provided list; the server validates again.'};
 }
 for(const header of ['selling_price','width_mm','depth_mm','height_mm','wattage','lumens','color_temperature_k','voltage_min','voltage_max','diameter_mm','length_mm']){
  const col=HEADERS.indexOf(header)+1;for(let row=2;row<=1001;row++)products.getCell(row,col).dataValidation={type:['lumens','color_temperature_k'].includes(header)?'whole':'decimal',operator:['selling_price','lumens'].includes(header)?'greaterThanOrEqual':'greaterThan',formulae:[0],allowBlank:true,showErrorMessage:true,errorStyle:'stop',error:'Use a nonnegative number; field-specific rules are checked by the server.'};
 }
 return book;
}
async function createBuffer(db,ExcelJS){const refs=await referenceSnapshot(db);const book=populate(new (ExcelJS||require('exceljs')).Workbook(),refs);return book.xlsx.writeBuffer();}
module.exports={HEADERS,categoryPath,referenceSnapshot,validateRefs,populate,createBuffer};
