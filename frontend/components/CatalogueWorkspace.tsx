"use client";
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import CatalogueManager from '@/app/admin/catalogue/CatalogueManager';
import {AdminProductBrowser} from './AdminProductBrowser';
import ui from '@/app/admin/catalogue/CatalogueUI.module.css';
import styles from './CatalogueBrowser.module.css';
export function CatalogueWorkspace(){
 const params=useSearchParams(),product=params.get('product'),workspace=params.get('workspace')||'',legacyWorkspace=['manage','import','review'].includes(workspace);
 // CatalogueManager removes product/mode with history.replaceState on Close.
 // Observe that change here instead of leaving its old search-only listing mounted.
 if(product||legacyWorkspace)return <div className={product?styles.editorHost:undefined}><p><Link href="/admin/catalogue">← Back to product browser</Link></p>{product&&<nav className={styles.workspaceNav} aria-label="Catalogue workspaces"><Link href="/admin/catalogue">Products</Link><Link href="/admin/catalogue?workspace=import">Bulk import</Link><Link href="/admin/catalogue?workspace=review">Review queue</Link></nav>}<CatalogueManager key={product?product+':'+(params.get('mode')||'edit'):workspace}/></div>;
 return <main className={ui.root}><h1>Catalogue administration</h1><nav className={styles.workspaceNav} aria-label="Catalogue workspaces"><Link href="/admin/catalogue" aria-current="page">Products</Link><Link href="/admin/catalogue?workspace=import">Bulk import</Link><Link href="/admin/catalogue?workspace=review">Review queue</Link></nav><AdminProductBrowser persist/></main>;
}
