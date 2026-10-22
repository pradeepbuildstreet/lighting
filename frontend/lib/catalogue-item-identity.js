"use strict";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function catalogueProductId(value){if(typeof value!=='string'||!UUID.test(value))throw new Error('Catalogue product UUID required.');return value.toLowerCase();}
function itemIdentity(item){return catalogueProductId(item?.product_id);}
function wishlistProductHref(item){return '/catalogue/product-id/'+itemIdentity(item);}
module.exports={catalogueProductId,itemIdentity,wishlistProductHref};
