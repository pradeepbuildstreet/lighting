'use client';
import Link from 'next/link';
export default function ErrorPage({reset}:{error:Error&{digest?:string};reset:()=>void}){return <section className="container py-8"><h1 className="text-3xl font-bold">Catalogue unavailable</h1><p role="alert">The catalogue could not be loaded. Please try again.</p><button type="button" onClick={()=>reset()}>Try again</button><p><Link href="/products">Browse products</Link></p></section>;}
