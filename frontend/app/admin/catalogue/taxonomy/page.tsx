import {redirect} from 'next/navigation';
import {catalogueTabForTaxonomy} from '@/lib/admin-reference-navigation.mjs';
export const dynamic='force-dynamic';
export default function TaxonomyPage({searchParams}:{searchParams?:{section?:string|string[]}}){const tab=catalogueTabForTaxonomy(searchParams?.section);redirect('/admin/catalogue?workspace=reference&reference='+encodeURIComponent(tab));}
