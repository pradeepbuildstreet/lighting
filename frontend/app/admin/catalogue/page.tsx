import type {Metadata} from 'next';
import {redirect} from 'next/navigation';
import {AdminShell} from '@/components/AdminShell';
import {referenceDataHref} from '@/lib/admin-reference-navigation.mjs';
import CatalogueManager from './CatalogueManager';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Catalogue | Luminoza',robots:{index:false,follow:false}};
export default function CataloguePage({searchParams}:{searchParams?:{workspace?:string;reference?:string;groups?:string}}){if(searchParams?.workspace==='reference'||searchParams?.reference)redirect(referenceDataHref(searchParams.reference,searchParams.groups==='global'));return <AdminShell active="catalogue"><CatalogueManager/></AdminShell>;}
