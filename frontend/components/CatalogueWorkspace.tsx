"use client";
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import CatalogueManager from '@/app/admin/catalogue/CatalogueManager';
import {AdminProductBrowser} from './AdminProductBrowser';
import {NewCatalogueProduct} from './NewCatalogueProduct';
import {ProductIdentityGate} from './ProductIdentityGate';
import ui from '@/app/admin/catalogue/CatalogueUI.module.css';
import styles from './CatalogueBrowser.module.css';
export function CatalogueWorkspace(){
 const params=useSearchParams(),product=params.get('product'),workspace=params.get('workspace')||'',creating=!product&&['new','manage'].includes(workspace),legacy=!!product||['import','review'].includes(workspace),editing=params.get('mode')!=='view';
 const nav=<nav className={styles.workspaceNav} aria-label="Catalogue workspaces"><Link href="/admin/catalogue" aria-current={!legacy&&!creating?'page':undefined}>Products</Link><Link href="/admin/catalogue?workspace=import" aria-current={workspace==='import'?'page':undefined}>Bulk import</Link><Link href="/admin/catalogue?workspace=review" aria-current={workspace==='review'?'page':undefined}>Review queue</Link></nav>;
 if(creating)return <main className={ui.root}><h1>Catalogue administration</h1>{nav}<NewCatalogueProduct/></main>;
 if(legacy){const editor=<CatalogueManager key={product?product+':'+(params.get('mode')||'edit'):workspace}/>;return <div className={styles.editorHost}><p><Link href="/admin/catalogue">← Back to product browser</Link></p>{nav}{product&&editing&&<p><Link href={'/admin/catalogue?product='+encodeURIComponent(product)+'&mode=edit&workspace=identity'}>Review name / identity</Link></p>}{product&&editing?<ProductIdentityGate key={product+':'+workspace} productId={product} force={workspace==='identity'}>{editor}</ProductIdentityGate>:editor}</div>;}
 return <main className={ui.root}><h1>Catalogue administration</h1>{nav}<AdminProductBrowser persist/></main>;
}
