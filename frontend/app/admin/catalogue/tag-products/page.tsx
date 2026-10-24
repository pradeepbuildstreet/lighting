import type {Metadata} from 'next';
import {AdminShell} from '@/components/AdminShell';
import TagProductEditor from './TagProductEditor';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Tag products | Luminoza',robots:{index:false,follow:false}};
export default function TagProductsPage(){return <AdminShell active="catalogue"><TagProductEditor/></AdminShell>;}
