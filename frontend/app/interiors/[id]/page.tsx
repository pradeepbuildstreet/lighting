import {InteriorCustomer} from '@/components/InteriorCustomer';
export default function InteriorDesignPage({params,searchParams}:{params:{id:string};searchParams:{group_id?:string|string[]}}){const group=typeof searchParams.group_id==='string'?searchParams.group_id:'';return <InteriorCustomer key={params.id+':'+group} designId={params.id}/>;}
