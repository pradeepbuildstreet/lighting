const sections=['tag-groups','tags','product-kinds','categories','global'];
export function referenceSection(value){return typeof value==='string'&&sections.includes(value)?value:'tag-groups';}
export const referenceLinks=[
 {key:'tag-groups',label:'Tag groups',href:'/admin/catalogue/taxonomy?section=tag-groups'},
 {key:'tags',label:'Tags',href:'/admin/catalogue/taxonomy?section=tags'},
 {key:'product-kinds',label:'Product kinds',href:'/admin/catalogue/taxonomy?section=product-kinds'},
 {key:'categories',label:'Category tag groups',href:'/admin/catalogue/taxonomy?section=categories'},
 {key:'global',label:'All-products tag groups',href:'/admin/catalogue/taxonomy?section=global'},
 {key:'legacy-categories',label:'Categories',href:'/admin/catalogue?workspace=reference&reference=categories'},
 {key:'fixture-types',label:'Fixture types',href:'/admin/catalogue?workspace=reference&reference=fixture-types'},
 {key:'light-types',label:'Light types',href:'/admin/catalogue?workspace=reference&reference=light-types'},
 {key:'dealers',label:'Dealers',href:'/admin/catalogue?workspace=reference&reference=dealers'}
];
