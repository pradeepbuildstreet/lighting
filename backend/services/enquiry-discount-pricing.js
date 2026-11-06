"use strict";
const {percent}=require('./product-discount-core');
function quotePrice(item,value){
 if(!['string','number'].includes(typeof value)||!/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(String(value)))throw Object.assign(Error('Enter a non-negative offer price with at most two decimals.'),{status:400});
 const rate=Number(value),discount=Number(percent(item.default_discount_percent??0));
 const ceiling=item.discounted_price==null?Math.round(Number(item.price)*(10000-Math.round(discount*100))/100)/100:Number(item.discounted_price);
 if(!Number.isFinite(ceiling)||ceiling<0||ceiling>Number(item.price))throw Object.assign(Error('Invalid saved enquiry pricing.'),{status:409});
 if(Math.round(rate*100)>Math.round(ceiling*100))throw Object.assign(Error('Offer price for '+item.sku+' cannot exceed its discounted enquiry price ('+ceiling.toFixed(2)+'); minimum discount is '+discount+'%.'),{status:400});
 return Math.round(rate*100)/100;
}
module.exports={quotePrice};
