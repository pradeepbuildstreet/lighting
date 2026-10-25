export function catalogueListStatus(product){
 const visibility=product.visibility, published=product.published===true;
 const collect=value=>Array.isArray(value)?value.filter(x=>typeof x==='string'&&x.trim()):[];
 const warnings=[...new Set([...collect(visibility?.reasons),...collect(visibility?.compatibility_warnings),...collect(product.validation_warnings)])];
 if(published&&!visibility)warnings.unshift('Visibility validation is not available; reload the listing.');
 if(published&&visibility&&visibility.visible!==true&&!warnings.length)warnings.push('This product is not currently visible to customers.');
 const tone=!published?'red':warnings.length?'amber':'green';
 const label=!published?'Unpublished':tone==='amber'?'Published with warnings':'Published — no warnings';
 return {tone,label,warnings,summary:[label,product.is_active===false?'Inactive':'Active','Duplicate review: '+(product.review_status||'draft'),...warnings].join('. ')};
}
