import {redirect} from 'next/navigation';
import {catalogueTabForTaxonomy,referenceSection,referenceDataHref} from '@/lib/admin-reference-navigation.mjs';
export const dynamic='force-dynamic';
export default function TaxonomyPage({searchParams}:{searchParams?:{section?:string|string[]}}){const section=referenceSection(searchParams?.section);redirect(referenceDataHref(catalogueTabForTaxonomy(section),section==='global'));}
