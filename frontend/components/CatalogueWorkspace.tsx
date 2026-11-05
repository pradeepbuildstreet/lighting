"use client";
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import CatalogueManager from '@/app/admin/catalogue/CatalogueManager';
import {AdminProductBrowser} from './AdminProductBrowser';
import {NewCatalogueProduct} from './NewCatalogueProduct';
import {ProductIdentityGate} from './ProductIdentityGate';
import {BulkProductIdentity} from './BulkProductIdentity';
import {BulkWorkbookV3} from './BulkWorkbookV3';
import {VendorPricingWorkbook} from './VendorPricingWorkbook';
import {CataloguePipeline} from './CataloguePipeline';
import {CatalogueReviewWorkspace} from './CatalogueReviewWorkspace';
import ui from '@/app/admin/catalogue/CatalogueUI.module.css';
import styles from './CatalogueBrowser.module.css';
export function CatalogueWorkspace(){
 const params=useSearchParams(),product=params.get('product'),workspace=params.get('workspace')||'',creating=!product&&['new','manage'].includes(workspace),legacy=!!product||['import','review'].includes(workspace),editing=params.get('mode')!=='view',vendorTab=params.get('bulk_tab')==='vendors';
 const nav=<nav className={styles.workspaceNav} aria-label="Catalogue workspaces"><Link href="/admin/catalogue" aria-current={!legacy&&!creating&&!['bulk-v3','bulk-identity','pipeline'].includes(workspace)?'page':undefined}>Products</Link><Link href="/admin/catalogue?workspace=pipeline" aria-current={workspace==='pipeline'?'page':undefined}>Integrity & saleability</Link><Link href="/admin/catalogue?workspace=import" aria-current={workspace==='import'?'page':undefined}>Bulk import v2</Link><Link href="/admin/catalogue?workspace=bulk-v3" aria-current={workspace==='bulk-v3'?'page':undefined}>New workbook / master</Link><Link href="/admin/catalogue?workspace=bulk-identity" aria-current={workspace==='bulk-identity'?'page':undefined}>Bulk names & SKUs</Link><Link href="/admin/catalogue?workspace=review" aria-current={workspace==='review'?'page':undefined}>Review queue</Link></nav>;
 if(workspace==='review')return <main className={ui.root}><h1>Catalogue administration</h1>{nav}<CatalogueReviewWorkspace key={product||'queue'} productId={product||undefined}/></main>;
 if(!product&&workspace==='bulk-identity')return <main className={ui.root}><h1>Catalogue administration</h1>{nav}<BulkProductIdentity/></main>;
 if(workspace==='pipeline')return <main className={ui.root}><h1>Catalogue administration</h1>{nav}<CataloguePipeline key={product||'summary'} productId={product||undefined}/></main>;
 if(creating)return <main className={ui.root}><h1>Catalogue administration</h1>{nav}<NewCatalogueProduct/></main>;
 if(!product&&workspace==='bulk-v3')return <main className={ui.root}><h1>Catalogue administration</h1>{nav}<nav className={styles.workspaceNav} aria-label="Workbook sections"><Link href="/admin/catalogue?workspace=bulk-v3" aria-current={!vendorTab?'page':undefined}>Products / images</Link><Link href="/admin/catalogue?workspace=bulk-v3&bulk_tab=vendors" aria-current={vendorTab?'page':undefined}>Vendor pricing</Link></nav>{vendorTab?<VendorPricingWorkbook/>:<BulkWorkbookV3/>}</main>;
 if(legacy){const editor=<CatalogueManager key={product?product+':'+(params.get('mode')||'edit'):workspace}/>;return <div className={styles.editorHost}><p><Link href="/admin/catalogue">← Back to product browser</Link></p>{nav}{product&&<p><Link href={'/admin/catalogue?workspace=pipeline&product='+encodeURIComponent(product)}>Integrity, saleability & visibility reasons</Link></p>}{product&&<p><Link href={'/admin/catalogue?workspace=review&product='+encodeURIComponent(product)}>Open independent duplicate review / image comparison</Link></p>}{product&&editing&&<p><Link href={'/admin/catalogue?product='+encodeURIComponent(product)+'&mode=edit&workspace=identity'}>Review name / identity</Link></p>}{product&&editing?<ProductIdentityGate key={product+':'+workspace} productId={product} force={workspace==='identity'}>{editor}</ProductIdentityGate>:editor}</div>;}
 return <main className={ui.root}><h1>Catalogue administration</h1>{nav}<AdminProductBrowser persist/></main>;
}
