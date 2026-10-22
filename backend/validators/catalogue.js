"use strict";
function fail(message){const e=new Error(message);e.status=400;throw e;}
function uuid(v,label='id'){if(typeof v!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v))fail(`Invalid ${label}`);return v;}
function text(v,label,required=false,max=500){if(v===undefined||v===null||v===''){if(required)fail(`${label} is required`);return null;}if(typeof v!=='string')fail(`${label} must be text`);const s=v.trim();if(required&&!s)fail(`${label} is required`);if(s.length>max)fail(`${label} is too long`);return s||null;}
function num(v,label,{integer=false,min=0,positive=false}={}){if(v===null||v===undefined||v==='')return null;if(typeof v==='boolean'||!['string','number'].includes(typeof v))fail(`Invalid ${label}`);const n=Number(v);if(!Number.isFinite(n)||(integer&&!Number.isInteger(n))||n<min||(positive&&n<=0))fail(`Invalid ${label}`);return n;}
function bool(v,fallback=false){if(v===undefined)return fallback;if(typeof v!=='boolean')fail('Boolean fields must be true or false');return v;}
function kind(v){if(!['fixture','light'].includes(v))fail('product_kind must be fixture or light');return v;}
function json(v,label){if(v===undefined||v===null||v==='')return {};if(typeof v!=='object'||Array.isArray(v))fail(`${label} must be an object`);return v;}
function product(body){
 const sku=text(body.sku,'SKU',true,100).toUpperCase();if(/\s/.test(sku))fail('SKU must not contain whitespace');
 const currency=body.currency||'INR';if(!/^[A-Z]{3}$/.test(currency))fail('Invalid currency');
 const categories=body.category_ids||[];if(!Array.isArray(categories)||categories.length>30)fail('Invalid categories');
 for(const id of categories)uuid(id,'category');if(new Set(categories).size!==categories.length)fail('Duplicate category assignments');
 const primary=body.primary_category_id||null;if(primary&&!categories.includes(primary))fail('Primary category must be assigned');
 const k=kind(body.product_kind);const s=body.specs||{};
 const spec={};
 if(k==='fixture'){
  spec.fixture_type_id=uuid(s.fixture_type_id,'fixture type');
  spec.light_source_mode=s.light_source_mode||'replaceable';if(!['replaceable','integrated','hybrid'].includes(spec.light_source_mode))fail('Invalid light source mode');
  for(const f of ['material','style','mounting_type'])spec[f]=text(s[f],f);
  for(const f of ['width_mm','depth_mm','height_mm'])spec[f]=num(s[f],f,{positive:true});
  spec.inbuilt_specs=json(s.inbuilt_specs,'Integrated specifications');
  if(spec.light_source_mode==='replaceable'&&Object.keys(spec.inbuilt_specs).length)fail('Replaceable mode cannot contain integrated specifications; confirm and clear them first');
 }else{
  spec.light_type_id=uuid(s.light_type_id,'light type');
  for(const f of ['wattage','voltage_min','voltage_max','diameter_mm','length_mm'])spec[f]=num(s[f],f,{positive:true});
  for(const f of ['lumens','color_temperature_k'])spec[f]=num(s[f],f,{integer:true,positive:f==='color_temperature_k'});
  if((spec.voltage_min===null)!==(spec.voltage_max===null))fail('Provide both voltage limits or neither');
  if(spec.voltage_min!==null&&spec.voltage_min>spec.voltage_max)fail('Voltage minimum exceeds maximum');
  spec.dimmable=s.dimmable===undefined||s.dimmable===null?null:bool(s.dimmable);
 }
 spec.other_specs=json(s.other_specs,'other_specs');
 return {mode_change_confirmed:bool(body.mode_change_confirmed,false),sku,name:text(body.name,'Name',true,255),product_kind:k,brand:text(body.brand,'Brand'),model_number:text(body.model_number,'Model'),description:text(body.description,'Description',false,20000),selling_price:num(body.selling_price,'Selling price'),currency,is_active:bool(body.is_active,true),categories,primary,spec};
}
module.exports={fail,uuid,text,num,bool,json,product};
