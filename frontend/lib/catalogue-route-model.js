"use strict";
function homeState(categoryResult,productResult){return {categories:categoryResult.status==='fulfilled'?categoryResult.value.categories:[],products:productResult.status==='fulfilled'?productResult.value.products:[],categoriesUnavailable:categoryResult.status!=='fulfilled',productsUnavailable:productResult.status!=='fulfilled'};}
function navLinks(nodes,helpers,depth=0){return nodes.flatMap(n=>[{id:n.id,name:n.name,href:helpers.categoryHref(n.path),depth},...navLinks(n.children,helpers,depth+1)]);}
async function resolveAlias(value,preferCategory,client,helpers){
 if(typeof value!=='string'||!/^\S{1,100}$/.test(value))return {kind:'missing'};
 try{
  if(preferCategory&&/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value.toLowerCase())){const data=await client.categories();const category=helpers.flattenCategories(data.categories).find(c=>c.slug===value.toLowerCase());if(category)return {kind:'redirect',href:helpers.categoryHref(category.path)};}
  const data=await client.bySku(value);return {kind:'redirect',href:helpers.productHref(data.product.sku)};
 }catch(e){return e&&['not_found','invalid_request'].includes(e.code)?{kind:'missing'}:{kind:'unavailable'};}
}
module.exports={homeState,navLinks,resolveAlias};
