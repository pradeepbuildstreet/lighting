import {InteriorProjectBrowser} from '@/components/InteriorProjectBrowser';
export default function InteriorProjectPage({params}:{params:{id:string}}){return <InteriorProjectBrowser key={params.id} projectId={params.id}/>;}
