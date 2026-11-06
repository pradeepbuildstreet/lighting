"use strict";
function percent(value){
 if(!['string','number'].includes(typeof value)||!/^(0|[1-9]\d{0,2})(\.\d{1,2})?$/.test(String(value))||Number(value)>100){const e=new Error('Discount must be between 0 and 100 with at most two decimals');e.status=400;throw e;}
 return String(value);
}
function discounted(price,value){const p=percent(value);if(price===null||price===undefined)return null;return Math.round((Number(price)*(10000-Math.round(Number(p)*100)))/100)/100;}
module.exports={percent,discounted};
