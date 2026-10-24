import type {Metadata} from 'next';
import {AdminShell} from '@/components/AdminShell';
import {referenceSection} from '@/lib/admin-reference-navigation.mjs';
import TaxonomyManager from './TaxonomyManager';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Tag reference data | Luminoza',robots:{index:false,follow:false}};
export default function TaxonomyPage({searchParams}:{searchParams?:{section?:string|string[]}}){const section=referenceSection(searchParams?.section);return <AdminShell active="taxonomy"><TaxonomyManager key={section} initialTab={section}/></AdminShell>;}
