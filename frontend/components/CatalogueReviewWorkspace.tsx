"use client";
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import ProductReviewPanel from '@/app/admin/catalogue/ProductReviewPanel';
import {useAdminNavigationGuard} from '@/lib/use-admin-navigation-guard';
export function CatalogueReviewWorkspace({productId}:{productId?:string}){
 const router=useRouter(),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false);
 useAdminNavigationGuard(dirty,busy,'duplicate review');
 return <section aria-label="Independent duplicate review workspace">
 <p>Image comparison is independent of the product-content editor. Comparing candidates does not record a decision. Inspect every suggestion before approving the subject as distinct.</p>
 <p>After a distinct decision, normal integrity and saleability checks reassess publication. Activation remains manual. Missing or stale evidence can still block the save.</p>
 {productId&&<p><Link href="/admin/catalogue?workspace=review">Back to review queue</Link> · <Link href={'/admin/catalogue?workspace=pipeline&product='+encodeURIComponent(productId)}>View publication pipeline</Link></p>}
 <div onChangeCapture={e=>{if(e.target instanceof Element&&e.target.closest('fieldset[data-review-decision]'))setDirty(true);}} onClickCapture={e=>{const button=e.target instanceof Element?e.target.closest('button'):null;if(dirty&&button&&/Run fresh duplicate audit|Refresh review state/.test(button.textContent||'')&&!window.confirm('Discard unsaved review notes and reload the review?')){e.preventDefault();e.stopPropagation();}}}>
 <ProductReviewPanel key={productId||'queue'} mode={productId?'product':'queue'} productId={productId} parentBusy={false} onBusyChange={setBusy} onChanged={async()=>{setDirty(false);}} onReviewProduct={async id=>{router.push('/admin/catalogue?workspace=review&product='+encodeURIComponent(id));}} onOpenProduct={async(id,view)=>{router.push('/admin/catalogue?product='+encodeURIComponent(id)+'&mode='+(view?'view':'edit'));}}/>
 </div></section>;
}
