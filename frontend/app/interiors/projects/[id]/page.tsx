import {InteriorProjectBrowser} from '@/components/InteriorProjectBrowser';
export default function InteriorProjectPage({params,searchParams}:{params:{id:string};searchParams:{group_id?:string|string[]}}){const group=typeof searchParams.group_id==='string'?searchParams.group_id:'';return <InteriorProjectBrowser key={params.id+':'+group} projectId={params.id} initialGroupId={group}/>;}
