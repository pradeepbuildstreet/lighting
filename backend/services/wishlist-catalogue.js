"use strict";
const {uuid,createService}=require('./public-catalogue-v1');
const {percent}=require('./product-discount-core');
function fail(status,message){const e=new Error(message);e.status=status;throw e;}
function money(value){if(value===null||value===undefined||typeof value==='boolean'||!/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(String(value)))fail(400,'Invalid price');return Math.round(Number(value)*100)/100;}
function snapshot(p){
 if(p.currency!=='INR')fail(409,'Only INR catalogue products can be quoted in this release');
 const image=p.media.find(m=>m.type==='image'&&m.primary)||p.media.find(m=>m.type==='image');
 return {product_id:uuid(p.id),sku:p.sku,name:p.name,price:money(p.price),default_discount_percent:percent(p.default_discount_percent??0),currency:p.currency,image_url:image?.url||null,media:p.media,product_href:'/catalogue/product-id/'+p.id,catalogue_revision:p.revision,category_slug:null};
}
async function lookup(id){
 if(!require('../api/public-catalogue-v1').enabled(process.env))fail(503,'Public catalogue is not enabled');
 const db=require('../db/catalogue'),service=createService(db);await service.ready();
 const product=(await service.detail(uuid(id),true)).product;
 const pricing=(await require('./public-product-prices').readPrices(db,product.id)).prices[0];
 if(!pricing)fail(409,'Product pricing is no longer publicly available');
 return snapshot({...product,price:pricing.list_price,currency:pricing.currency,default_discount_percent:pricing.default_discount_percent});
}
module.exports={fail,money,snapshot,lookup};
