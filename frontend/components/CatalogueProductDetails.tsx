import {PublicProductEnquiryCount} from './PublicEnquiryCounts';
import {WishlistButton} from './WishlistButton';
import Link from 'next/link';
import {categoryHref,formatPrice} from '@/lib/catalogue-client';
import type {CatalogueProduct} from '@/lib/catalogue-types';
import {fixtureMode,specRows} from '@/lib/product-details-model';
import {ProductMediaGallery} from './ProductMediaGallery';
import {ProductCompatibility} from './ProductCompatibility';
import styles from './ProductDetails.module.css';
export function CatalogueProductDetails({product}:{product:CatalogueProduct}){
 const specs=specRows(product),primary=product.categories.find(c=>c.primary)||product.categories[0];
 return <section className="container py-8"><nav aria-label="Breadcrumb"><ol className={styles.breadcrumb}><li><Link href="/">Home</Link></li><li aria-hidden="true">/</li><li><Link href="/products">Products</Link></li>{primary&&<><li aria-hidden="true">/</li><li><Link href={categoryHref(primary.path)}>{primary.name}</Link></li></>}<li aria-hidden="true">/</li><li aria-current="page">{product.name}</li></ol></nav>
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8"><ProductMediaGallery key={product.id} product={product}/><div><h1 className="text-3xl font-bold mb-4">{product.name}</h1><PublicProductEnquiryCount productId={product.id}/><p className={styles.meta}>{product.sku} · {product.kind==='fixture'?'Fixture':'Light'}{product.brand?' · '+product.brand:''}</p>{product.model&&<p>Model: {product.model}</p>}<p className={styles.price}>{formatPrice(product.price,product.currency)}</p><WishlistButton productId={product.id} sku={product.sku} name={product.name}/><p>{product.description||'Description not supplied.'}</p>
 {!!product.categories.length&&<p className={styles.meta}>Categories: {product.categories.map((c,i)=><span key={c.id}>{i>0?', ':''}<Link href={categoryHref(c.path)}>{c.name}</Link>{c.primary?' (primary)':''}</span>)}</p>}
 <h2 className="text-xl font-semibold mt-6">Specifications</h2><dl className={styles.specs}>{specs.rows.map(r=><div key={r.key}><dt>{r.label}</dt><dd>{r.value}</dd></div>)}</dl>
 {!!specs.integrated.length&&<><h2 className="text-xl font-semibold">Integrated source specifications</h2><dl className={styles.specs}>{specs.integrated.map(r=><div key={r.key}><dt>{r.label}</dt><dd>{r.value}</dd></div>)}</dl></>}
 </div></div>
 {product.kind==='fixture'&&<ProductCompatibility key={product.id} fixtureId={product.id} mode={fixtureMode(product)}/>}
 </section>;
}
