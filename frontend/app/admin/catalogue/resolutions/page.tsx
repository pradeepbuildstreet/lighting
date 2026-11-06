import type {Metadata} from 'next';
import {AdminShell} from '@/components/AdminShell';
import ResolutionHistory from './ResolutionHistory';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Group resolution history | Luminoza',robots:{index:false,follow:false}};
export default function ResolutionHistoryPage({searchParams}:{searchParams?:{product?:string}}){
 return <AdminShell active="catalogue"><p><a href="/admin/catalogue">Back to catalogue</a></p><ResolutionHistory initialProductId={searchParams?.product}/></AdminShell>;
}
