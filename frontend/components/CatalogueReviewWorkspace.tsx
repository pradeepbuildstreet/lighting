"use client";
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import ProductReviewPanel from '@/app/admin/catalogue/ProductReviewPanel';
import GroupDuplicateReview from '@/app/admin/catalogue/GroupDuplicateReview';
import {useAdminNavigationGuard} from '@/lib/use-admin-navigation-guard';
export function CatalogueReviewWorkspace({productId}:{productId?:string}){
 const router=useRouter(),[mode,setMode]=useState<'single'|'group'>('single'),[singleBusy,setSingleBusy]=useState(false),[groupBusy,setGroupBusy]=useState(false),[singleDirty,setSingleDirty]=useState(false),[groupDirty,setGroupDirty]=useState(false),[refresh,setRefresh]=useState(0);
 const busy=singleBusy||groupBusy,dirty=mode==='group'?groupDirty:singleDirty;
 useAdminNavigationGuard(dirty,busy,'duplicate review');
 function changeMode(next:'single'|'group'){if(next===mode||busy)return;if(dirty&&!window.confirm('Leave the current review? Unsaved decisions will be discarded; any saved uncertain group request remains available for recovery.'))return;setSingleDirty(false);setGroupDirty(false);setMode(next);}
 return <section aria-label="Independent duplicate review workspace">
 <div aria-label="Review mode"><button type="button" disabled={busy} aria-pressed={mode==='single'} onClick={()=>changeMode('single')}>Single product review</button><button type="button" disabled={busy} aria-pressed={mode==='group'} onClick={()=>changeMode('group')}>Group review: retain / mark duplicates</button></div>
 <p>Image comparison is independent of the product-content editor. Comparing products does not record a decision. Inspect every suggestion before recording the review.</p>
 <p>Normal integrity and saleability checks reassess publication after review. Activation remains manual. Missing or stale evidence can still block the save.</p>
 {productId&&<p><Link href="/admin/catalogue?workspace=review">Back to review queue</Link> · <Link href={'/admin/catalogue?workspace=pipeline&product='+encodeURIComponent(productId)}>View publication pipeline</Link></p>}
 {mode==='group'?<GroupDuplicateReview key={productId||'queue'} seedProductId={productId} onBusyChange={setGroupBusy} onDirtyChange={setGroupDirty} onSaved={()=>setRefresh(n=>n+1)}/>:<div onChangeCapture={e=>{if(e.target instanceof Element&&e.target.closest('fieldset[data-review-decision]'))setSingleDirty(true);}} onClickCapture={e=>{const button=e.target instanceof Element?e.target.closest('button'):null;if(singleDirty&&button&&/Run fresh duplicate audit|Refresh review state/.test(button.textContent||'')&&!window.confirm('Discard unsaved review notes and reload the review?')){e.preventDefault();e.stopPropagation();}}}>
 <ProductReviewPanel key={(productId||'queue')+':'+refresh} mode={productId?'product':'queue'} productId={productId} parentBusy={false} onBusyChange={setSingleBusy} onChanged={async()=>{setSingleDirty(false);}} onReviewProduct={async id=>{router.push('/admin/catalogue?workspace=review&product='+encodeURIComponent(id));}} onOpenProduct={async(id,view)=>{router.push('/admin/catalogue?product='+encodeURIComponent(id)+'&mode='+(view?'view':'edit'));}}/>
 </div>}</section>;
}
