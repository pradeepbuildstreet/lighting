import {redirect} from 'next/navigation';
import {catalogueTabForTaxonomy,referenceSection} from '@/lib/admin-reference-navigation.mjs';
export const dynamic='force-dynamic';
export default function TaxonomyPage({searchParams}:{searchParams?:{section?:string|string[]}}){const section=referenceSection(searchParams?.section),tab=catalogueTabForTaxonomy(section);redirect('/admin/catalogue?workspace=reference&reference='+encodeURIComponent(tab)+(section==='global'?'&groups=global':''));}
