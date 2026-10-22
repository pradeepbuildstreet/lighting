"use strict";
const {uuid,createService}=require('./public-catalogue-v1');
function fail(status,message){const e=new Error(message);e.status=status;throw e;}
function money(value){if(value===null||value===undefined||typeof value==='boolean'||! /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(String(value)))fail(400,'Invalid price');return Math.round(Number(value)*100)/100;}
function snapshot(p){
 if(p.currency!=='INR')fail(409,'Only INR catalogue products can be quoted in this release');
 const image=p.media.find(m=>m.type==='image'&&m.primary)||p.media.find(m=>m.type==='image');
 return {product_id:uuid(p.id),sku:p.sku,name:p.name,price:money(p.price),currency:p.currency,
 image_url:image?.url||null,media:p.media,product_href:'/catalogue/product-id/'+p.id,
 catalogue_revision:p.revision,category_slug:null};
}
async function lookup(id){
 if(!require('../api/public-catalogue-v1').enabled(process.env))fail(503,'Public catalogue is not enabled');
 const service=createService(require('../db/catalogue'));await service.ready();
 return snapshot((await service.detail(uuid(id),true)).product);
}
module.exports={fail,money,snapshot,lookup};
