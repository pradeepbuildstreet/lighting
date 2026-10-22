import Link from 'next/link';
import {notFound} from 'next/navigation';
import {Fragment} from 'react';
import {getCatalogueClient,resolveCategoryPath,categoryHref,CatalogueError} from '@/lib/catalogue-client';
import type {CatalogueCategory,CatalogueFacet,CatalogueList,CatalogueQuery} from '@/lib/catalogue-types';
import {prepareQuery,filterOptions,listingState,paginationLinks,categoryChildLinks} from '@/lib/catalogue-listing-model';
import {listingHelpers} from '@/lib/catalogue-listing-adapter';
import {CatalogueFilters} from './CatalogueFilters';
import {CatalogueProductCards} from './CatalogueProductCards';
import styles from './CatalogueListing.module.css';
type Props={searchParams:Record<string,string|string[]|undefined>;categorySegments?:string[]};
function Notice({path,message}:{path:string;message:string}){return <section className="container py-8"><h1 className="text-3xl font-bold">Lighting catalogue</h1><p className={styles.notice} role="alert">{message}</p><Link href={path}>Return to unfiltered listing</Link></section>;}
export async function CatalogueListingPage({searchParams,categorySegments}:Props){
 let categories:CatalogueCategory[],facets:CatalogueFacet[]=[],facetsUnavailable=false;
 let path='/products';if(categorySegments){try{path=categoryHref(categorySegments);}catch(_){notFound();}}
 let client;try{client=getCatalogueClient();const [cats,facetResult]=await Promise.all([client.categories(),client.filters().then(value=>({ok:true as const,value})).catch(()=>({ok:false as const}))]);categories=cats.categories;if(facetResult.ok)facets=facetResult.value.facets;else facetsUnavailable=true;}catch(_){return <Notice path={path} message="The catalogue is temporarily unavailable. Please try again later."/>;}
 const categoryPath=categorySegments?resolveCategoryPath(categories,categorySegments):[];
 if(categorySegments&&!categoryPath.length)notFound();
 let query:CatalogueQuery;try{query=prepareQuery(searchParams,categoryPath,listingHelpers);if(query.category&&!listingHelpers.flattenCategories(categories).some(c=>c.slug===query.category))return <Notice path={path} message="The selected category is no longer available. Clear the filters to continue."/>;}catch(e){return <Notice path={path} message={e instanceof Error&&'code' in e&&e.code==='invalid_request'?e.message:'Check the listing filters and try again.'}/>;}
 let data:CatalogueList;try{data=await client.list(query);}catch(e){const message=e instanceof CatalogueError&&e.code==='rate_limited'?'Too many catalogue requests. Please wait and try again.':e instanceof CatalogueError&&e.code==='invalid_request'?'The selected filters could not be accepted. Clear them and try again.':'Products are temporarily unavailable. Please try again later.';return <Notice path={path} message={message}/>;}
 const state=listingState(data),options=filterOptions(categories,facets,query,listingHelpers),active=categoryPath.at(-1),links=paginationLinks(path,query,data.pagination,listingHelpers),children=categoryChildLinks(categories,categoryPath,listingHelpers);
 return <section className="container py-8 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
 <aside className="h-fit"><CatalogueFilters key={JSON.stringify(query)} path={path} query={query} fixedCategory={active?{slug:active.slug,name:active.name}:undefined} choices={options} facetsUnavailable={facetsUnavailable}/></aside>
 <div><nav aria-label="Breadcrumb"><ol className={styles.breadcrumb}><li><Link href="/">Home</Link></li><li aria-hidden="true">/</li><li><Link href="/products">Products</Link></li>{categoryPath.map((c,i)=><Fragment key={c.id}><li aria-hidden="true">/</li><li>{i===categoryPath.length-1?<span aria-current="page">{c.name}</span>:<Link href={categoryHref(c.path)}>{c.name}</Link>}</li></Fragment>)}</ol></nav>
 <h1 className="text-3xl font-bold mb-2">{active?.name||'All lighting products'}</h1>{active?.description&&<p>{active.description}</p>}
 {!!children.length&&<nav className={styles.children} aria-label={active?'Subcategories':'Categories'}>{children.map(c=><Link key={c.id} href={c.href}>{c.name} ({c.count})</Link>)}</nav>}
 <p className={styles.summary} aria-live="polite">{state.count?`${state.start}–${state.end} of ${state.total} products`:`${state.total} matching products`}</p>
 {state.outOfRange?<p className={styles.notice}>This page is outside the current results. Use the page links below.</p>:state.empty?<p className={styles.notice}>No currently eligible products match these filters. <Link href={path}>Clear filters</Link></p>:!state.count?<p className={styles.notice}>No products were returned for this page. Please refresh the listing.</p>:<CatalogueProductCards products={data.products}/>}
 <nav className={styles.pager} aria-label="Product result pages">{!state.outOfRange&&state.pages>0&&<span>Page {state.page} of {state.pages}</span>}{links.map(l=><Link prefetch={false} key={l.label} href={l.href}>{l.label}</Link>)}</nav>
 </div></section>;
}
