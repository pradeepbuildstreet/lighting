import {AdminShell} from '@/components/AdminShell';
import {BulkOrderEditor} from '@/components/BulkOrderEditor';
export const dynamic='force-dynamic';
export const metadata={title:'Bulk display ordering | Luminoza Admin',robots:{index:false,follow:false}};
export default function OrderingPage({searchParams}:{searchParams:{kind?:string;parent?:string}}){const kinds=['categories','tag-groups','product-kinds','tags','collections','media'],kind=kinds.includes(searchParams.kind||'')?searchParams.kind!:'categories';return <AdminShell active="taxonomy"><h1>Reference display ordering</h1><BulkOrderEditor kind={kind} parent={searchParams.parent}/></AdminShell>;}
