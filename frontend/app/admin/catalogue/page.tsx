import type {Metadata} from 'next';
import {Suspense} from 'react';
import {redirect} from 'next/navigation';
import {AdminShell} from '@/components/AdminShell';
import {referenceDataHref} from '@/lib/admin-reference-navigation.mjs';
import {CatalogueWorkspace} from '@/components/CatalogueWorkspace';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Catalogue | Luminoza',robots:{index:false,follow:false}};
export default function CataloguePage({searchParams}:{searchParams?:{workspace?:string;reference?:string;groups?:string;product?:string}}){
 if(searchParams?.workspace==='reference'||searchParams?.reference)redirect(referenceDataHref(searchParams.reference,searchParams.groups==='global'));
 const historyHref='/admin/catalogue/resolutions'+(searchParams?.product?'?product='+encodeURIComponent(searchParams.product):'');
 return <AdminShell active="catalogue"><p><a href={historyHref} target="_blank" rel="noreferrer">Resolution history and audited reversal (opens separately)</a></p><Suspense fallback={<p role="status">Loading catalogue…</p>}><CatalogueWorkspace/></Suspense></AdminShell>;
}
