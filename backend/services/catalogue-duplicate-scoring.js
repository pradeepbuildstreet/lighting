"use strict";
const ALGORITHM='2c-evidence-v1';
const normal=v=>typeof v==='string'?v.trim().toLowerCase().replace(/\s+/g,' '):'';
function similarity(a,b){const x=new Set(normal(a).match(/[\p{L}\p{N}]+/gu)||[]),y=new Set(normal(b).match(/[\p{L}\p{N}]+/gu)||[]);if(!x.size||!y.size)return null;return [...x].filter(t=>y.has(t)).length/new Set([...x,...y]).size;}
function compare(a,b){
 if(a.id===b.id||a.product_kind!==b.product_kind)return null;
 const evidence={algorithm:ALGORITHM,subject_revision:String(a.revision),candidate_revision:String(b.revision),signals:[],limitations:['No perceptual image similarity or embeddings','Socket configuration and compatibility rules not compared','Scores are heuristics, not probabilities']};
 let identity=0;
 if(normal(a.brand)&&normal(a.model_number)&&normal(a.brand)===normal(b.brand)&&normal(a.model_number)===normal(b.model_number)){identity=55;evidence.signals.push({kind:'brand_model',score:55,brand:a.brand,model:a.model_number});}
 const name=similarity(a.name,b.name),nameScore=name===null?0:20*name;
 if(name!==null)evidence.signals.push({kind:'name_token_overlap',similarity:name,score:nameScore});
 const keys=a.product_kind==='fixture'?['fixture_type_id','light_source_mode','material','mounting_type','width_mm','depth_mm','height_mm']:['light_type_id','wattage','lumens','color_temperature_k','voltage_min','voltage_max','diameter_mm','length_mm','dimmable'];
 const compared=[];
 for(const key of keys){const x=a.specs?.[key],y=b.specs?.[key];if(x===null||x===undefined||x===''||y===null||y===undefined||y==='')continue;let match;
  if(typeof x==='number'||typeof y==='number'){const nx=Number(x),ny=Number(y);match=Number.isFinite(nx)&&Number.isFinite(ny)&&nx===ny;}else match=typeof x==='boolean'||typeof y==='boolean'?x===y:normal(String(x))===normal(String(y));
  compared.push({field:key,subject:x,candidate:y,match});
 }
 // Coverage penalises sparse evidence instead of treating unknown fields as matches.
 const specScore=25*compared.filter(x=>x.match).length/keys.length;
 evidence.signals.push({kind:'specifications',fields:compared,known_fields:compared.length,total_fields:keys.length,score:specScore});
 const hashes=new Set((a.image_hashes||[]).filter(h=>typeof h==='string'&&/^[a-f0-9]{64}$/i.test(h)).map(h=>h.toLowerCase()));
 const shared=[...new Set((b.image_hashes||[]).filter(h=>typeof h==='string'&&hashes.has(h.toLowerCase())).map(h=>h.toLowerCase()))];
 let score=identity+nameScore+specScore;
 if(shared.length){score=Math.max(score,90);evidence.signals.push({kind:'exact_image_sha256',hashes:shared,score:90,note:'Identical bytes, not proof of identical products'});}
 score=Math.round(Math.min(100,score)*1000)/1000;
 return {overall_score:score,spec_score:Math.round(specScore*4*1000)/1000,image_score:null,evidence};
}
module.exports={ALGORITHM,normal,similarity,compare};
