import {Suspense} from 'react';
import {CategoryProductDiscovery} from './CategoryProductDiscovery';
import {PublicProductEnquiryCount} from './PublicEnquiryCounts';
import {WishlistButton} from './WishlistButton';
import Link from 'next/link';
import {kindLabel,tagSpecRows} from '@/lib/catalogue-tag-presentation.mjs';
import {categoryHref,formatPrice} from '@/lib/catalogue-client';
import type {CatalogueProduct} from '@/lib/catalogue-types';
import {fixtureMode,specRows} from '@/lib/product-details-model';
import {ProductMediaGallery} from './ProductMediaGallery';
import {ProductCompatibility} from './ProductCompatibility';
import {ProductBreadcrumbs} from './ProductBreadcrumbs';
import styles from './ProductDetails.module.css';
export function CatalogueProductDetails({product,adminPreview=false}:{product:CatalogueProduct;adminPreview?:boolean}){
 const specs=product.tag_model?tagSpecRows(product):specRows(product);
 return <section className="container py-8">{adminPreview?<p>{product.categories.map(c=>c.name).join(' › ')}{product.categories.length?' › ':''}{product.name}</p>:<ProductBreadcrumbs productId={product.id} revision={product.revision} name={product.name} categories={product.categories}/>}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8"><ProductMediaGallery key={product.id} product={product} adminPreview={adminPreview}/><div><h1 className="text-3xl font-bold mb-4">{product.name}</h1>{!adminPreview&&<PublicProductEnquiryCount productId={product.id}/>}<p className={styles.meta}>{product.sku} · {kindLabel(product.kind,product.kind_name)}{product.brand?' · '+product.brand:''}</p>{product.model&&<p>Model: {product.model}</p>}<p className={styles.price}>{adminPreview&&!product.price?'Selling price not set (draft)':formatPrice(product.price,product.currency)}</p>{adminPreview?<p>Preview only — customer actions are disabled.</p>:<WishlistButton productId={product.id} sku={product.sku} name={product.name}/>}<p>{product.description||'Description not supplied.'}</p>
 {!!product.categories.length&&<p className={styles.meta}>Categories: {product.categories.map((c,i)=><span key={c.id}>{i>0?', ':''}{adminPreview?c.name:<Link href={categoryHref(c.path)}>{c.name}</Link>}{c.primary?' (primary)':''}</span>)}</p>}
 <h2 className="text-xl font-semibold mt-6">Specifications</h2><dl className={styles.specs}>{specs.rows.map(r=><div key={r.key}><dt>{r.label}</dt><dd>{r.value}</dd></div>)}</dl>
 {!!specs.integrated.length&&<><h2 className="text-xl font-semibold">Integrated source specifications</h2><dl className={styles.specs}>{specs.integrated.map(r=><div key={r.key}><dt>{r.label}</dt><dd>{r.value}</dd></div>)}</dl></>}
 {product.tag_model&&product.tags_loaded&&[true,false].map(filter=>{const tags=(product.tags||[]).filter(t=>t.filter_attribute===filter);return tags.length?<section key={String(filter)}><h2 className="text-xl font-semibold mt-6">{filter?'Category filter attributes':'Additional information'}</h2><dl className={styles.specs}>{tags.map(t=><div key={t.id}><dt>{t.group_name}</dt><dd>{t.name}</dd></div>)}</dl></section>:null;})}
 </div></div>
 {!adminPreview&&product.kind==='fixture'&&<ProductCompatibility key={product.id} fixtureId={product.id} mode={fixtureMode(product)}/>}
 {!adminPreview&&<Suspense fallback={<p role="status">Loading category products…</p>}><CategoryProductDiscovery productId={product.id}/></Suspense>}
 </section>;
}
