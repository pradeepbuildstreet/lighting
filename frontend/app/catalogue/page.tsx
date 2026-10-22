import type {Metadata} from 'next';
import Link from 'next/link';
import {permanentRedirect} from 'next/navigation';
import {buildListQuery} from '@/lib/catalogue-client';
import type {CatalogueQuery} from '@/lib/catalogue-types';
export const dynamic='force-dynamic';
export const metadata:Metadata={robots:{index:false,follow:false}};
export default function CatalogueAlias({searchParams}:{searchParams:Record<string,string|string[]|undefined>}){let query;try{query=buildListQuery(searchParams as CatalogueQuery);}catch(_){return <section className="container py-8"><h1>Invalid catalogue filters</h1><Link href="/products">Clear filters</Link></section>;}permanentRedirect('/products?'+query.toString());}
