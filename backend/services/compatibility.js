"use strict";
function evaluate(rule,light,override=null){
 if(override?.decision==='reject')return {state:'incompatible',source:'manual',reasons:[override.reason]};
 if(override?.decision==='approve')return {state:'compatible',source:'manual',reasons:[override.reason]};
 const failed=[],missing=[];
 const num=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
 if(!light.light_type_id)missing.push('Light type missing');
 else if(light.light_type_id!==rule.light_type_id)failed.push('Light type mismatch');
 for(const [limit,field,label] of [['max_wattage','wattage','Wattage'],['max_diameter_mm','diameter_mm','Diameter'],['max_length_mm','length_mm','Length']]){
  if(num(rule[limit])){if(!num(light[field]))missing.push(`${label} missing`);else if(Number(light[field])>Number(rule[limit]))failed.push(`${label} exceeds limit`);}
 }
 if(!num(rule.supply_voltage_min)||!num(rule.supply_voltage_max))missing.push('Fixture supply range missing');
 else if(!num(light.voltage_min)||!num(light.voltage_max))missing.push('Light voltage range missing');
 else if(Number(light.voltage_min)>Number(rule.supply_voltage_min)||Number(light.voltage_max)<Number(rule.supply_voltage_max))failed.push('Light operating range does not cover fixture supply');
 if(rule.requires_dimmable){if(light.dimmable===null||light.dimmable===undefined)missing.push('Dimming information missing');else if(light.dimmable!==true)failed.push('Dimmable light required');}
 return {state:failed.length?'incompatible':missing.length?'unverified':'compatible',source:'rule',reasons:[...failed,...missing]};
}
module.exports={evaluate};
