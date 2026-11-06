"use strict";
function fail(message){throw Object.assign(Error(message),{status:400});}
function parseDiscountFilters(input={}){
 const status=input.discount_status===undefined||input.discount_status===''?'all':input.discount_status;
 if(typeof status!=='string'||!['all','discounted','none'].includes(status))fail('Invalid discount status');
 function bound(key){const value=input[key];if(value===undefined||value==='')return null;if(typeof value!=='string'||!/^(0|[1-9]\d{0,2})(\.\d{1,2})?$/.test(value)||Number(value)>100)fail('Discount limits must be between 0 and 100 with at most two decimals');return String(Number(value));}
 const min=bound('min_discount'),max=bound('max_discount');if(min!==null&&max!==null&&Number(min)>Number(max))fail('Minimum discount exceeds maximum discount');return {status,min,max};
}
module.exports={parseDiscountFilters};
