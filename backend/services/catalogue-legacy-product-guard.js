"use strict";
function fail(status,message){const e=new Error(message);e.status=status;throw e;}
async function assertLegacyProduct(c,product,status=409){
 if(!['fixture','light'].includes(product.product_kind))fail(status,'Tag-model products require the version-2 editor or import');
 const model=(await c.query('SELECT EXISTS(SELECT 1 FROM product_attributes WHERE product_id=$1) OR EXISTS(SELECT 1 FROM product_tags WHERE product_id=$1) AS tag_model',[product.id])).rows[0];
 if(typeof model?.tag_model!=='boolean')fail(503,'Unable to verify legacy product write eligibility');
 if(model.tag_model)fail(status,'Tag-model products require the version-2 editor or import');
}
module.exports={assertLegacyProduct};
