import type {Metadata} from 'next';import {pageData,pageMetadata} from '@/lib/website-pages/server';import {ManagedPage} from '@/lib/website-pages/ManagedPage';
export const dynamic='force-dynamic';export const runtime='nodejs';
type Props={params:{slug:string}};
const pathname=(slug:string)=>'/variants/'+encodeURIComponent(slug);
export async function generateMetadata({params}:Props):Promise<Metadata>{const route=pathname(params.slug);const data=await pageData(route);return pageMetadata({title:data.state==='published'?data.title:'Page unavailable',description:data.state==='published'?data.body.slice(0,300):undefined,robots:{index:false,follow:true}},route);}
export default function Page({params}:Props){return <ManagedPage pathname={pathname(params.slug)}/>;}
