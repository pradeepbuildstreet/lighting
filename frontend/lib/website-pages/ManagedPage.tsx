import Link from 'next/link';import {notFound} from 'next/navigation';import {pageData} from './server';
export async function ManagedPage({pathname}:{pathname:string}){
 const data=await pageData(pathname);if(data.state==='unavailable')throw new Error('Published page source temporarily unavailable');if(data.state!=='published')notFound();
 return <main className="container py-8"><h1 className="text-3xl font-bold mb-6">{data.title}</h1><div className="whitespace-pre-wrap mb-8">{data.body}</div>{data.products?.length>0&&<section><h2 className="text-2xl mb-4">Referenced catalogue products</h2><ul>{data.products.map((p:any)=><li key={p.id} className="mb-4"><Link href={'/catalogue/products/'+encodeURIComponent(p.sku)}>{p.name}</Link><p>{p.sku} · {p.currency} {p.price}</p></li>)}</ul></section>}</main>;
}
