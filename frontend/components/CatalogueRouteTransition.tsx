import Link from 'next/link';
import {notFound,permanentRedirect} from 'next/navigation';
import {getCatalogueClient,categoryHref,productHref,flattenCategories} from '@/lib/catalogue-client';
import {resolveAlias} from '@/lib/catalogue-route-model';
export async function CatalogueRouteTransition({value,preferCategory=false}:{value:string;preferCategory?:boolean}){
 let result:Awaited<ReturnType<typeof resolveAlias>>;try{result=await resolveAlias(value,preferCategory,getCatalogueClient(),{categoryHref,productHref,flattenCategories});}catch(_){result={kind:'unavailable' as const};}
 if(result.kind==='missing')notFound();
 if(result.kind==='redirect')permanentRedirect(result.href);
 return <section className="container py-8"><h1 className="text-3xl font-bold">Catalogue temporarily unavailable</h1><p role="alert">The requested catalogue route could not be resolved. No dummy product has been substituted.</p><Link href="/products">Browse products</Link></section>;
}
