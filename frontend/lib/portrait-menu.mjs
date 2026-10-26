export function balancedMenuColumns(items){
 if(!Array.isArray(items))throw new TypeError('Menu items must be a list');
 if(!items.length)return [];
 const count=Math.ceil(items.length/10),base=Math.floor(items.length/count),extra=items.length%count;let offset=0;
 return Array.from({length:count},(_,i)=>{const size=base+(i<extra?1:0),column=items.slice(offset,offset+size);offset+=size;return column;});
}
export function menuPosition(anchor,panel,viewport){
 const edge=12,left=Math.max(edge,Math.min(anchor.left,viewport.width-panel.width-edge));
 const top=Math.max(edge,Math.min(anchor.bottom,viewport.height-edge-44));
 return {left,top,maxHeight:Math.max(44,Math.min(464,viewport.height-top-edge))};
}
