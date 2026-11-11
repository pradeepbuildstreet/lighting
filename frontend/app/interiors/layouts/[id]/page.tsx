import {InteriorProjectBrowser} from '@/components/InteriorProjectBrowser';
export default function InteriorLayoutPage({params}:{params:{id:string}}){return <InteriorProjectBrowser key={params.id} layoutId={params.id}/>;}
