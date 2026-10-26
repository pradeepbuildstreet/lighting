import type {Metadata} from 'next';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {AdminShell} from '@/components/AdminShell';
import {AdminProductBrowser} from '@/components/AdminProductBrowser';
import {referenceDataHref} from '@/lib/admin-reference-navigation.mjs';
import CatalogueManager from './CatalogueManager';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Catalogue | Luminoza',robots:{index:false,follow:false}};
export default function CataloguePage({searchParams}:{searchParams?:{workspace?:string;reference?:string;groups?:string;product?:string}}){
 if(searchParams?.workspace==='reference'||searchParams?.reference)redirect(referenceDataHref(searchParams.reference,searchParams.groups==='global'));
 const editor=!!searchParams?.product||['manage','import','review'].includes(searchParams?.workspace||'');
 return <AdminShell active="catalogue">{editor?<><p><Link href="/admin/catalogue">← Back to product browser</Link></p><CatalogueManager/></>:<main><h1>Catalogue products</h1><p>Browse products by category, brand, dealer, tags and status. View and Edit remain separate actions.</p><nav style={{display:'flex',gap:16,flexWrap:'wrap',marginBottom:16}}><Link href="/admin/catalogue?workspace=manage">Product management / new product</Link><Link href="/admin/catalogue?workspace=import">Bulk import</Link><Link href="/admin/catalogue?workspace=review">Review queue</Link></nav><AdminProductBrowser persist/></main>}</AdminShell>;
}
