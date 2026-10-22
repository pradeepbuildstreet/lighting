import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default function DeprecatedCategoriesPage(){redirect('/admin/catalogue?workspace=reference&reference=categories');}
