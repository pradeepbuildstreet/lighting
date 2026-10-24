import type {Metadata} from 'next';
import {AdminShell} from '@/components/AdminShell';
import TaxonomyManager from './TaxonomyManager';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Tag reference data | Luminoza',robots:{index:false,follow:false}};
export default function TaxonomyPage(){return <AdminShell active="catalogue"><TaxonomyManager/></AdminShell>;}
