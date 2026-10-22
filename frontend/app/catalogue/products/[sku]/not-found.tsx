import Link from 'next/link';
export default function NotFound(){return <section className="container py-8"><h1 className="text-3xl font-bold">Product not available</h1><p>This product is missing or no longer publicly available.</p><Link href="/products">Browse eligible products</Link></section>;}
