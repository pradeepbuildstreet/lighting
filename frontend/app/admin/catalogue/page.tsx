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
 return <AdminShell active="catalogue"><Suspense fallback={<p role="status">Loading catalogue…</p>}><CatalogueWorkspace/></Suspense></AdminShell>;
}
