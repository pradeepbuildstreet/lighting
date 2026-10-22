"use strict";
function roundOfferRupees(value){
 if(typeof value!=='string'&&typeof value!=='number')throw Error('Invalid offer price');
 const s=String(value);if(!/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(s))throw Error('Invalid offer price');
 const [whole,fraction='']=s.split('.');return Number(whole)+(Number((fraction+'00').slice(0,2))>=50?1:0);
}
function offerRupeesOrNaN(value){try{return roundOfferRupees(value);}catch(_){return NaN;}}
module.exports={roundOfferRupees,offerRupeesOrNaN};
