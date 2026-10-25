const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function productId(id){if(typeof id!=='string'||!UUID.test(id))throw new Error('Invalid product ID');return id.toLowerCase();}
export function tagProductEditorHref(id){return id===undefined||id===null||id===''?'/admin/catalogue/tag-products?new=1':'/admin/catalogue/tag-products?edit='+encodeURIComponent(productId(id));}
export function tagProductEntry(search){const p=new URLSearchParams(search);if(p.getAll('edit').length>1||p.getAll('new').length>1||p.has('edit')&&p.has('new'))throw new Error('Ambiguous product editor request');if(p.has('edit'))return {mode:'edit',id:productId(p.get('edit'))};if(p.has('new')){if(p.get('new')!=='1')throw new Error('Invalid new-product request');return {mode:'new'};}return null;}
