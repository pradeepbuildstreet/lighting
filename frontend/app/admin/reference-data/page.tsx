import type {Metadata} from 'next';
import {AdminShell} from '@/components/AdminShell';
import CatalogueManager from '../catalogue/CatalogueManager';
import {catalogueReferenceTab} from '@/lib/admin-reference-navigation.mjs';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Reference Data | Luminoza Admin',robots:{index:false,follow:false}};
export default function ReferenceDataPage({searchParams}:{searchParams:{section?:string;groups?:string}}){return <AdminShell active="taxonomy"><CatalogueManager referenceOnly initialReference={catalogueReferenceTab(searchParams.section)} initialGlobal={searchParams.groups==='global'||searchParams.section==='global-tag-groups'}/></AdminShell>;}
