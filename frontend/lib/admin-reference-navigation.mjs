const sections=['tag-groups','tags','product-kinds','categories','global'];
export function referenceSection(value){return typeof value==='string'&&sections.includes(value)?value:'tag-groups';}
export const referenceTabs=['categories','tag-groups','product-kinds','category-tag-groups','global-tag-groups','dealers'];
export function catalogueReferenceTab(value){if(value==='tags')return 'tag-groups';return typeof value==='string'&&referenceTabs.includes(value)?value:'categories';}
export function taxonomySectionForTab(value){if(value==='tags')return 'tag-groups';if(['tag-groups','product-kinds'].includes(value))return value;if(value==='category-tag-groups')return 'categories';if(value==='global-tag-groups')return 'global';return null;}
export function catalogueTabForTaxonomy(value){const section=referenceSection(value);return section==='tags'?'tag-groups':section==='categories'?'category-tag-groups':section==='global'?'global-tag-groups':section;}
export function referenceLabel(value){return {'categories':'Categories','tag-groups':'Tag groups & tags','tags':'Tag groups & tags','product-kinds':'Product kinds','category-tag-groups':'Category tag groups','global-tag-groups':'All-products tag groups','dealers':'Dealers'}[value]||value;}
export const referenceLinks=[
 {key:'tag-groups',label:'Tag groups',href:'/admin/catalogue/taxonomy?section=tag-groups'},
 {key:'tags',label:'Tags',href:'/admin/catalogue/taxonomy?section=tags'},
 {key:'product-kinds',label:'Product kinds',href:'/admin/catalogue/taxonomy?section=product-kinds'},
 {key:'categories',label:'Category tag groups',href:'/admin/catalogue/taxonomy?section=categories'},
 {key:'global',label:'All-products tag groups',href:'/admin/catalogue/taxonomy?section=global'},
 {key:'legacy-categories',label:'Categories',href:'/admin/catalogue?workspace=reference&reference=categories'},
 {key:'dealers',label:'Dealers',href:'/admin/catalogue?workspace=reference&reference=dealers'}
];
