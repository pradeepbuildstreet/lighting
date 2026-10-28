"use strict";
function chooseCategoryRule(category,override,globalRule,builtIn){
 if(category&&category.allow_direct_products!==true)throw Object.assign(Error('Primary category must allow direct products'),{status:400});
 if(override&&(!category||override.category_id!==category.id))throw Object.assign(Error('Naming-rule category mismatch'),{status:400});
 const custom=!!category&&override?.enabled===true,record=custom?override:globalRule;
 return {rule:record?.rule||builtIn,rule_scope:custom?'category':'default',category_id:custom?category.id:null,settings_revision:record?String(record.revision):null};
}
module.exports={chooseCategoryRule};
