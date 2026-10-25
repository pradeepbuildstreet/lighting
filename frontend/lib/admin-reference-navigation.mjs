const sections=['tag-groups','tags','product-kinds','categories','global'];
export function referenceSection(value){return typeof value==='string'&&sections.includes(value)?value:'tag-groups';}
export const referenceTabs=['categories','tag-groups','product-kinds','dealers'];
export function catalogueReferenceTab(value){if(value==='tags')return 'tag-groups';if(['category-tag-groups','global-tag-groups'].includes(value))return 'categories';return typeof value==='string'&&referenceTabs.includes(value)?value:'categories';}
export function taxonomySectionForTab(value){if(value==='tags')return 'tag-groups';return ['tag-groups','product-kinds'].includes(value)?value:null;}
export function catalogueTabForTaxonomy(value){const section=referenceSection(value);return section==='tags'?'tag-groups':['categories','global'].includes(section)?'categories':section;}
export function referenceDataHref(value,global=false){return '/admin/reference-data?section='+encodeURIComponent(catalogueReferenceTab(value))+(global||value==='global-tag-groups'?'&groups=global':'');}
export function referenceLabel(value){return {'categories':'Categories','tag-groups':'Tag groups & tags','tags':'Tag groups & tags','product-kinds':'Product kinds','category-tag-groups':'Categories','global-tag-groups':'Categories','dealers':'Dealers'}[value]||value;}
export const referenceLinks=[{key:'tag-groups',label:'Tag groups',href:referenceDataHref('tag-groups')},{key:'tags',label:'Tags',href:referenceDataHref('tag-groups')},{key:'product-kinds',label:'Product kinds',href:referenceDataHref('product-kinds')},{key:'categories',label:'Categories & filter groups',href:referenceDataHref('categories')},{key:'dealers',label:'Dealers',href:referenceDataHref('dealers')}];
