import type {Metadata} from 'next';
import {AdminShell} from '@/components/AdminShell';
import CatalogueManager from './CatalogueManager';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Catalogue | Luminoza',robots:{index:false,follow:false}};
export default function CataloguePage(){return <AdminShell active="catalogue"><p><a href="/admin/catalogue/taxonomy">Reference data: tag groups, tags, product kinds and category filters</a> · <a href="/admin/catalogue/tag-products">Tag product editor (activation-gated)</a></p><CatalogueManager/></AdminShell>;}
