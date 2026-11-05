export function productIdentifier(product){
 const sku=typeof product?.sku==='string'?product.sku.trim():'';
 const code=typeof product?.model_number==='string'?product.model_number.trim():'';
 return (sku||'SKU pending')+' ('+(code||'code not set')+')';
}
