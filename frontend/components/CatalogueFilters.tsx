"use client";
import {useState,type FormEvent} from 'react';
import Link from 'next/link';
import {buildListQuery} from '@/lib/catalogue-client';
import type {CatalogueQuery} from '@/lib/catalogue-types';
import styles from './CatalogueListing.module.css';
type Props={path:string;query:CatalogueQuery;fixedCategory?:{slug:string;name:string};choices:{categories:{value:string;label:string}[];brands:string[];currencies:string[]};facetsUnavailable:boolean};
export function CatalogueFilters({path,query,fixedCategory,choices,facetsUnavailable}:Props){
 const [currency,setCurrency]=useState(query.currency||''),[sort,setSort]=useState(query.sort||'name'),[min,setMin]=useState(query.min_price||''),[max,setMax]=useState(query.max_price||''),[error,setError]=useState('');
 function changeCurrency(value:string){setCurrency(value);if(!value){setMin('');setMax('');if(sort.startsWith('price_'))setSort('name');}}
 function submit(event:FormEvent<HTMLFormElement>){setError('');try{const input=Object.fromEntries(new FormData(event.currentTarget).entries());buildListQuery(input as CatalogueQuery);}catch(e){event.preventDefault();setError(e instanceof Error?e.message:'Check the filters.');}}
 return <form action={path} method="get" onSubmit={submit} className={styles.filters} key={JSON.stringify(query)} aria-label="Catalogue filters">
 <h2 className="text-lg font-semibold">Filter products</h2>
 <label>Search<input type="search" name="q" defaultValue={query.q||''} maxLength={200}/></label>
 {fixedCategory?<><p>Category: {fixedCategory.name}</p><input type="hidden" name="category" value={fixedCategory.slug}/></>:<label>Category<select name="category" defaultValue={query.category||''}><option value="">All categories</option>{choices.categories.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label>}
 <label>Product kind<select name="kind" defaultValue={query.kind||''}><option value="">Fixtures and lights</option><option value="fixture">Fixtures</option><option value="light">Lights</option></select></label>
 <label>Brand<select name="brand" defaultValue={query.brand||''}><option value="">All brands</option>{choices.brands.map(b=><option key={b} value={b}>{b}</option>)}</select></label>
 <label>Currency<select name="currency" value={currency} onChange={e=>changeCurrency(e.target.value)}><option value="">All currencies</option>{choices.currencies.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
 <p className={styles.meta}>Select a currency to use price filters or price sorting.</p>
 <label>Minimum price<input type="number" name="min_price" step="0.01" min="0" max="999999999999.99" value={min} disabled={!currency} onChange={e=>setMin(e.target.value)}/></label>
 <label>Maximum price<input type="number" name="max_price" step="0.01" min="0" max="999999999999.99" value={max} disabled={!currency} onChange={e=>setMax(e.target.value)}/></label>
 <label>Sort<select name="sort" value={sort} onChange={e=>setSort(e.target.value as NonNullable<CatalogueQuery['sort']>)}><option value="name">Name</option><option value="newest">Newest</option><option value="price_asc" disabled={!currency}>Price: low to high</option><option value="price_desc" disabled={!currency}>Price: high to low</option></select></label>
 <label>Products per page<select name="limit" defaultValue={String(query.limit||20)}>{Array.from(new Set([20,50,100,Number(query.limit||20)])).sort((a,b)=>a-b).map(n=><option key={n} value={n}>{n}</option>)}</select></label>
 {facetsUnavailable&&<p role="status" className={styles.meta}>Brand/currency options could not be refreshed. Existing selections are retained.</p>}
 {error&&<p role="alert" className={styles.error}>{error}</p>}
 <button className={styles.button} type="submit">Apply filters</button><Link href={path} className={styles.clear}>Clear filters</Link>
 </form>;
}
