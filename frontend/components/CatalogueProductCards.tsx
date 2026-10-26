import {EnquiryCountsProvider,PublicEnquiryCount} from './PublicEnquiryCounts';
import {WishlistButton} from './WishlistButton';
import Link from 'next/link';
import {kindLabel} from '@/lib/catalogue-tag-presentation.mjs';
import {productHref,formatPrice} from '@/lib/catalogue-client';
import {browseProductHref} from '@/lib/catalogue-browse-context.mjs';
import type {CatalogueProduct} from '@/lib/catalogue-types';
import {ProductThumbnail} from './ProductThumbnail';
import styles from './CatalogueListing.module.css';
import grid from './CatalogueProductGrid.module.css';
function EnquiryCountProductCards({products,browseCategory,returnTo,maxRows}:{products:CatalogueProduct[];browseCategory?:string;returnTo?:string;maxRows?:3}){
 const cards=<div className={`${grid.products} ${maxRows===3?grid.threeRows:''}`}>{products.map(p=>{const image=p.media.find(m=>m.type==='image'&&m.primary)||p.media.find(m=>m.type==='image');return <article key={p.id} className="product-result-card" data-catalogue-id={p.id}><Link href={browseProductHref(productHref(p.sku),browseCategory,returnTo)} prefetch={false} className="product-result-link"><ProductThumbnail key={image?.url||p.id} url={image?.url} alt={image?.alt||p.name}/><div className={styles.copy}><h2>{p.name}</h2><p className={styles.price}>{formatPrice(p.price,p.currency)}</p><p className={styles.meta}>{p.sku} · {kindLabel(p.kind,p.kind_name)}{p.brand?' · '+p.brand:''}</p><span>View product</span><PublicEnquiryCount productId={p.id}/></div></Link><div className="product-result-wishlist flex items-start"><WishlistButton productId={p.id} sku={p.sku} name={p.name} compact /></div></article>;})}</div>;
 return maxRows===3?<div className={grid.cap}>{cards}</div>:cards;
}
export function CatalogueProductCards(props:Parameters<typeof EnquiryCountProductCards>[0]){const products=props.maxRows===3?props.products.slice(0,18):props.products;return <EnquiryCountsProvider productIds={products.map(p=>p.id)}><EnquiryCountProductCards {...props} products={products}/></EnquiryCountsProvider>;}
