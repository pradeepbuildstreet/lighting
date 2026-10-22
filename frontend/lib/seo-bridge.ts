import 'server-only';
import type {CatalogueProduct} from './catalogue-types';
import {optionalProductSeo} from './seo-live-test/product.mjs';
export async function productSeo(product:CatalogueProduct){
 const selected=process.env.NODE_ENV==='development'
  && process.env.SEO_PRODUCT_TEST_ENABLED==='true'
  && process.env.SEO_PRODUCT_TEST_ID===product.id
  && process.env.SEO_BRIDGE_ENABLED==='true';
 if(process.env.SEO_INTEGRATION_DISABLED==='true'&&!selected)return null;
 if(!selected)return null;
 return optionalProductSeo(product,{onError:(event:any)=>console.warn(JSON.stringify(event))});
}
