import type {CatalogueProduct} from './catalogue-types';
export type HomepageData={products:(CatalogueProduct&{enquiry_count:number})[];collections:{title:string;slug:string;description:string;product_count:number;cover:CatalogueProduct|null}[];period:string;scan_limited:boolean};
