import Link from 'next/link';
import {notFound} from 'next/navigation';
import {Fragment,Suspense} from 'react';
import {getCatalogueClient,resolveCategoryPath,categoryHref,pageHref,CatalogueError} from '@/lib/catalogue-client';
import {startCatalogueReads} from '@/lib/catalogue-performance.mjs';
import {clearFilters} from '@/lib/catalogue-filter-workspace.mjs';
import type {CatalogueCategory,CatalogueFacet,CatalogueList,CatalogueQuery} from '@/lib/catalogue-types';
import {prepareQuery,filterOptions,listingState,paginationLinks} from '@/lib/catalogue-listing-model';
import {listingHelpers} from '@/lib/catalogue-listing-adapter';
import {CatalogueFilters} from './CatalogueFilters';
import {CatalogueAppliedFilters} from './CatalogueAppliedFilters';
import {CatalogueIncrementalProducts} from './CatalogueIncrementalProducts';
import styles from './CatalogueListing.module.css';
import layout from './StorefrontSkeleton.module.css';
type Props={searchParams:Record<string,string|string[]|undefined>;categorySegments?:string[]};
function Notice({path,message}:{path:string;message:string}){return <section className="container py-8"><h1 className="text-3xl font-bold">Lighting catalogue</h1><p className={styles.notice} role="alert">{message}</p><Link href={path}>Return to unfiltered listing</Link></section>;}
async function DeferredFilters({path,query,categories,fixedCategory,facetsPromise}:{path:string;query:CatalogueQuery;categories:CatalogueCategory[];fixedCategory?:{slug:string;name:string};facetsPromise:Promise<CatalogueFacet[]|null>}){const facets=await facetsPromise;return <CatalogueFilters path={path} query={query} fixedCategory={fixedCategory} choices={filterOptions(categories,facets||[],query,listingHelpers)} facetsUnavailable={facets===null}/>;}
export async function CatalogueListingPage({searchParams,categorySegments}:Props){
 let categories:CatalogueCategory[],facetsPromise:Promise<CatalogueFacet[]|null>=Promise.resolve(null);
 let path='/products';if(categorySegments){try{path=categoryHref(categorySegments);}catch(_){notFound();}}
 let client;try{client=getCatalogueClient();const reads=startCatalogueReads(client);facetsPromise=reads.facets;categories=(await reads.categories).categories;}catch(_){return <Notice path={path} message="The catalogue is temporarily unavailable. Please try again later."/>;}
 const categoryPath=categorySegments?resolveCategoryPath(categories,categorySegments):[];
 if(categorySegments&&!categoryPath.length)notFound();
 let query:CatalogueQuery;try{query=prepareQuery(searchParams,categoryPath,listingHelpers);if(query.category&&!listingHelpers.flattenCategories(categories).some(c=>c.slug===query.category))return <Notice path={path} message="The selected category is no longer available. Clear the filters to continue."/>;}catch(e){return <Notice path={path} message={e instanceof Error&&'code' in e&&e.code==='invalid_request'?e.message:'Check the listing filters and try again.'}/>;}
 let data:CatalogueList;try{data=await client.list(query);}catch(e){return <Notice path={path} message={e instanceof CatalogueError&&e.code==='rate_limited'?'Too many catalogue requests. Please wait and try again.':e instanceof CatalogueError&&e.code==='invalid_request'?'The selected filters could not be accepted. Clear them and try again.':'Products are temporarily unavailable. Please try again later.'}/>;}
 const state=listingState(data),active=categoryPath.at(-1),links=paginationLinks(path,query,data.pagination,listingHelpers);
 const selectedCategory=listingHelpers.flattenCategories(categories).find(c=>c.slug===query.category),browseCategory=active?.path||selectedCategory?.path,returnTo=pageHref(path,query,data.pagination.page),clearHref=pageHref(path,new URLSearchParams(clearFilters(query,active?.slug||'')),1);
 const pager=<nav className={styles.pager} aria-label="Product result pages">{!state.outOfRange&&state.pages>0&&<span>Page {state.page} of {state.pages}</span>}{links.map(l=><Link prefetch={false} key={l.label} href={l.href}>{l.label}</Link>)}</nav>;
 return <section className={`container ${layout.page}`}>
 <header className={layout.heading} data-storefront-segment="3"><div className={layout.title}><h1>{active?.name||selectedCategory?.name||'All Products'}</h1><span>({state.total})</span></div><p className={layout.description}>{active?.description||selectedCategory?.description||''}</p></header>
 <div className={layout.browsingRow} data-storefront-segment="4"><nav className={layout.breadcrumbs} aria-label="Breadcrumb"><ol><li><Link href="/">Home</Link></li><li aria-hidden="true">/</li><li>{active?<Link href="/products">Products</Link>:<span aria-current="page">Products</span>}</li>{categoryPath.map((c,i)=><Fragment key={c.id}><li aria-hidden="true">/</li><li>{i===categoryPath.length-1?<span aria-current="page">{c.name}</span>:<Link href={categoryHref(c.path)}>{c.name}</Link>}</li></Fragment>)}</ol></nav><Suspense fallback={<span role="status">Loading controls…</span>}><DeferredFilters path={path} query={query} categories={categories} fixedCategory={active?{slug:active.slug,name:active.name}:undefined} facetsPromise={facetsPromise}/></Suspense></div>
 <div className={layout.selections} data-storefront-segment="5"><CatalogueAppliedFilters path={path} query={query} fixedCategory={active?.slug} categoryName={selectedCategory?.name} summary={`${state.total} matching products`}/></div>
 <div className={layout.products} data-storefront-segment="6">
 {state.page>1&&!state.outOfRange&&<Link prefetch={false} href={pageHref(path,query,1)}>Start from the first results page</Link>}
 {state.outOfRange?<p className={styles.notice}>This page is outside the current results. Use the page links below.</p>:state.empty?<p className={styles.notice}>No products match all your selections. Remove a selection above to broaden the results, or <Link href={clearHref}>clear filters</Link>. Your search and category page are retained.</p>:!state.count?<p className={styles.notice}>No products were returned for this page. Please refresh the listing.</p>:<CatalogueIncrementalProducts key={returnTo} initial={data} path={path} query={query} browseCategory={browseCategory} returnTo={returnTo}/>}
 {state.outOfRange?pager:<noscript>{pager}</noscript>}
 </div></section>;
}
