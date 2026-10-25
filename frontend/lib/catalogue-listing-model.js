"use strict";
class ListingInputError extends Error{constructor(message){super(message);this.name='ListingInputError';this.code='invalid_request';}}
function prepareQuery(input,categoryPath,helpers){
 const raw={...input},fixed=categoryPath.length?categoryPath.at(-1).slug:null;
 if(fixed&&raw.category!==undefined&&raw.category!==''&&raw.category!==fixed)throw new ListingInputError('Category filter conflicts with this page.');
 if(fixed)raw.category=fixed;
 const params=helpers.buildListQuery(raw);return Object.fromEntries(params);
}
function filterOptions(tree,facets,query,helpers){
 const categories=helpers.flattenCategories(tree).map(c=>({value:c.slug,label:'— '.repeat(c.path.split('/').length-1)+c.name+' ('+c.product_count+')'}));
 const brands=[...new Set(facets.map(f=>f.brand).filter(b=>typeof b==='string'&&b.length))];if(query.brand&&!brands.includes(query.brand))brands.push(query.brand);brands.sort();
 const currencies=[...new Set(facets.map(f=>f.currency))];if(query.currency&&!currencies.includes(query.currency))currencies.push(query.currency);currencies.sort();
 const kinds=[...new Set(facets.map(f=>f.kind).filter(k=>typeof k==='string'&&k.length))];if(query.kind&&!kinds.includes(query.kind))kinds.push(query.kind);kinds.sort();
 return {categories,brands,currencies,kinds};
}
function listingState(data){const p=data.pagination,count=data.products.length,outOfRange=p.page>Math.max(1,p.pages);return {count,total:p.total,page:p.page,pages:p.pages,outOfRange,empty:p.total===0,start:count?(p.page-1)*p.limit+1:0,end:count?(p.page-1)*p.limit+count:0};}
function paginationLinks(path,query,pagination,helpers){
 const {page,pages}=pagination;if(page>Math.max(1,pages))return [{label:'First page',href:helpers.pageHref(path,query,1)},...(pages>1?[{label:'Last page',href:helpers.pageHref(path,query,pages)}]:[])];
 const links=[];if(page>1)links.push({label:'Previous',href:helpers.pageHref(path,query,page-1)});if(page<pages)links.push({label:'Next',href:helpers.pageHref(path,query,page+1)});return links;
}
function clearFilterHref(path,categoryPath){return path;}
function categoryChildLinks(tree,path,helpers){const active=path.at(-1);return (active?active.children:tree).map(c=>({id:c.id,name:c.name,count:c.product_count,href:helpers.categoryHref(c.path)}));}
module.exports={ListingInputError,prepareQuery,filterOptions,listingState,paginationLinks,clearFilterHref,categoryChildLinks};
