import type {Metadata} from 'next';
import Link from 'next/link';
import {AdminShell} from '@/components/AdminShell';
import {CatalogueRulebook} from '@/components/CatalogueRulebook';
import CatalogueManager from '../catalogue/CatalogueManager';
import {catalogueReferenceTab} from '@/lib/admin-reference-navigation.mjs';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Reference Data | Luminoza Admin',robots:{index:false,follow:false}};
export default function ReferenceDataPage({searchParams}:{searchParams:{section?:string;groups?:string}}){return <AdminShell active="taxonomy"><p><Link href="/admin/reference-data">Reference records</Link> · <Link href="/admin/reference-data?section=rules">Tag policies & naming rules</Link></p>{searchParams.section==='rules'?<CatalogueRulebook/>:<CatalogueManager referenceOnly initialReference={catalogueReferenceTab(searchParams.section)} initialGlobal={searchParams.groups==='global'||searchParams.section==='global-tag-groups'}/>}</AdminShell>;}
