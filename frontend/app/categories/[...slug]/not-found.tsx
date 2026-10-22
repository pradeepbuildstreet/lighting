import Link from 'next/link';
export default function CategoryNotFound(){return <section className="container py-8"><h1 className="text-3xl font-bold">Category not available</h1><p>This category path is missing or no longer public.</p><Link href="/products">Browse all products</Link></section>;}
