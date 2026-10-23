export function visibleCategoryTree(nodes){
 return nodes.flatMap(node=>{
  const children=visibleCategoryTree(node.children);
  return node.product_count>0||children.length?[{...node,children}]:[];
 });
}
