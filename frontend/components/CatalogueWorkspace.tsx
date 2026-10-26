"use client";
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import CatalogueManager from '@/app/admin/catalogue/CatalogueManager';
import {AdminProductBrowser} from './AdminProductBrowser';
import {NewCatalogueProduct} from './NewCatalogueProduct';
import ui from '@/app/admin/catalogue/CatalogueUI.module.css';
import styles from './CatalogueBrowser.module.css';
export function CatalogueWorkspace(){
 const params=useSearchParams(),product=params.get('product'),workspace=params.get('workspace')||'',creating=!product&&['new','manage'].includes(workspace),legacy=!!product||['import','review'].includes(workspace);
 const nav=<nav className={styles.workspaceNav} aria-label="Catalogue workspaces"><Link href="/admin/catalogue" aria-current={!legacy&&!creating?'page':undefined}>Products</Link><Link href="/admin/catalogue?workspace=import" aria-current={workspace==='import'?'page':undefined}>Bulk import</Link><Link href="/admin/catalogue?workspace=review" aria-current={workspace==='review'?'page':undefined}>Review queue</Link></nav>;
 if(creating)return <main className={ui.root}><h1>Catalogue administration</h1>{nav}<NewCatalogueProduct/></main>;
 if(legacy)return <div className={styles.editorHost}><p><Link href="/admin/catalogue">← Back to product browser</Link></p>{nav}<CatalogueManager key={product?product+':'+(params.get('mode')||'edit'):workspace}/></div>;
 return <main className={ui.root}><h1>Catalogue administration</h1>{nav}<AdminProductBrowser persist/></main>;
}
