"use client";
import Link from 'next/link';
import {Suspense,useEffect,useRef,useState,type FormEvent} from 'react';
import {usePathname,useRouter,useSearchParams} from 'next/navigation';
import {Heart,Menu,Search,X} from 'lucide-react';
import {getCatalogueClient,categoryHref} from '@/lib/catalogue-client';
import type {CatalogueCategory} from '@/lib/catalogue-types';
import {navLinks} from '@/lib/catalogue-route-model';
import {useWishlist} from './WishlistProvider';
import styles from './SiteHeader.module.css';
function HeaderContent(){
 const pathname=usePathname(),params=useSearchParams(),router=useRouter(),{wishlist}=useWishlist();
 const shopping=pathname==='/'||/^\/(products|categories|catalogue|item|product-collections|collections|brands|variants)(\/|$)/.test(pathname);
 const base=params.toString(),activeSearch=params.get('q')||params.get('search')||'';
 const [term,setTerm]=useState(activeSearch),[categories,setCategories]=useState<CatalogueCategory[]>([]),[unavailable,setUnavailable]=useState(false),[attempt,setAttempt]=useState(0),[panel,setPanel]=useState<'search'|'menu'|null>(null);
 const header=useRef<HTMLElement>(null),dialog=useRef<HTMLDialogElement>(null),search=useRef<HTMLInputElement>(null),opener=useRef<HTMLElement|null>(null),departments=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{setTerm(activeSearch);setPanel(null);if(departments.current)departments.current.open=false;},[pathname,base,activeSearch]);
 useEffect(()=>{
  const ctl=new AbortController();let live=true;setUnavailable(false);
  try{void getCatalogueClient().categories({signal:ctl.signal}).then(data=>{if(live)setCategories(data.categories);}).catch(()=>{if(live&&!ctl.signal.aborted)setUnavailable(true);});}catch(_){setUnavailable(true);}
  return()=>{live=false;ctl.abort();};
 },[attempt]);
 useEffect(()=>{
  if(!shopping||!header.current)return;const root=document.documentElement,old=root.style.getPropertyValue('--shop-header-height');
  const measure=()=>{if(header.current)root.style.setProperty('--shop-header-height',`${Math.ceil(header.current.getBoundingClientRect().height)}px`);};
  measure();const observer=new ResizeObserver(measure);observer.observe(header.current);
  return()=>{observer.disconnect();if(old)root.style.setProperty('--shop-header-height',old);else root.style.removeProperty('--shop-header-height');};
 },[shopping]);
 useEffect(()=>{const outside=(event:PointerEvent)=>{if(departments.current&&event.target instanceof Node&&!departments.current.contains(event.target))departments.current.open=false;};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[]);
 useEffect(()=>{
  if(!panel||!dialog.current)return;const element=dialog.current,old=document.body.style.overflow;document.body.style.overflow='hidden';if(!element.open)element.showModal();if(panel==='search')search.current?.focus();
  const resize=()=>{const height=window.visualViewport?.height||window.innerHeight;element.style.setProperty('--panel-height',`${Math.max(120,height-24)}px`);if(panel==='search'&&document.activeElement===search.current)search.current?.scrollIntoView({block:'nearest'});};
  const media=window.matchMedia('(min-width:1024px)'),change=()=>setPanel(null);resize();window.visualViewport?.addEventListener('resize',resize);media.addEventListener('change',change);
  return()=>{window.visualViewport?.removeEventListener('resize',resize);media.removeEventListener('change',change);document.body.style.overflow=old;if(element.open)element.close();if(opener.current?.isConnected)opener.current.focus();};
 },[panel]);
 function open(which:'search'|'menu',element:HTMLElement){opener.current=element;setTerm(activeSearch);setPanel(which);}
 function runSearch(value:string){
  const listing=pathname==='/products'||/^\/(categories|catalogue)(\/|$)/.test(pathname);
  const next=listing?new URLSearchParams(base):new URLSearchParams();next.delete('search');next.delete('page');if(value.trim())next.set('q',value.trim());else next.delete('q');
  const target=listing?pathname:'/products';setPanel(null);router.push(target+(next.size?'?'+next.toString():''));
 }
 function submit(event:FormEvent){event.preventDefault();runSearch(term);}
 const navigation=<nav className={styles.navigation} aria-label="Shop by department"><Link prefetch={false} href="/products" onClick={()=>setPanel(null)}>All products</Link>{categories.map(category=><div key={category.id}><Link prefetch={false} href={categoryHref(category.path)} onClick={()=>{setPanel(null);if(departments.current)departments.current.open=false;}}>{category.name}</Link>{!!category.children.length&&<details><summary>Browse {category.name}</summary><div className={styles.children}>{navLinks(category.children,{categoryHref}).map(child=><Link prefetch={false} key={child.id} href={child.href} style={{paddingInlineStart:12+child.depth*12}} onClick={()=>{setPanel(null);if(departments.current)departments.current.open=false;}}>{child.name}</Link>)}</div></details>}</div>)}{unavailable&&<p role="status">Departments are temporarily unavailable. <button type="button" onClick={()=>setAttempt(n=>n+1)}>Retry</button></p>}</nav>;
 const count=wishlist?.items.length||0;
 return <header ref={header} className={`site-header ${styles.header} ${shopping?styles.sticky:''}`}>
  <div className={styles.bar}>
   <Link prefetch={false} href="/" className={styles.brand} aria-label="Luminoza home"><img src="/luminoza-logo.svg" alt="Luminoza"/><small>Beautiful lighting! Exuberant living!</small></Link>
   <details ref={departments} className={styles.departments} onKeyDown={event=>{if(event.key==='Escape'){event.currentTarget.open=false;event.currentTarget.querySelector('summary')?.focus();}}}><summary>Departments ▾</summary><div className={styles.departmentPanel}>{navigation}</div></details>
   <form className={styles.search} role="search" onSubmit={submit}><label className={styles.srOnly} htmlFor="header-product-search">Search products or SKU</label><input id="header-product-search" type="search" maxLength={200} placeholder="Search products or SKU" value={term} onChange={event=>setTerm(event.target.value)}/>{!!activeSearch&&<button type="button" className={styles.clearSearch} onClick={()=>{setTerm('');runSearch('');}}>Clear search</button>}<button type="submit" aria-label="Search"><Search size={19} aria-hidden="true"/></button></form>
   <button className={`${styles.icon} ${styles.mobileOnly}`} type="button" aria-label="Open product search" aria-haspopup="dialog" aria-expanded={panel==='search'} onClick={event=>open('search',event.currentTarget)}><Search size={21} aria-hidden="true"/></button>
   <Link prefetch={false} href="/wishlist" className={styles.wishlist} aria-label={`Wishlist, ${count} products`}><Heart size={21} aria-hidden="true"/><span className={styles.wishlistText}>Wishlist</span>{count>0&&<span className={styles.count}>{count}</span>}</Link>
   <button className={`${styles.icon} ${styles.mobileOnly}`} type="button" aria-label="Open department menu" aria-haspopup="dialog" aria-expanded={panel==='menu'} onClick={event=>open('menu',event.currentTarget)}><Menu size={22} aria-hidden="true"/></button>
  </div>
  <dialog ref={dialog} className={styles.dialog} aria-labelledby="header-panel-title" onCancel={event=>{event.preventDefault();setPanel(null);}}>{panel&&<><div className={styles.panelHead}><h2 id="header-panel-title">{panel==='search'?'Search products':'Shop by department'}</h2><button type="button" className={styles.icon} aria-label="Close panel" onClick={()=>setPanel(null)}><X size={22} aria-hidden="true"/></button></div>{panel==='search'?<form className={styles.searchPanel} role="search" onSubmit={submit}><label htmlFor="floating-product-search">Product name, brand or SKU</label><input ref={search} id="floating-product-search" type="search" maxLength={200} value={term} onChange={event=>setTerm(event.target.value)}/><div className={styles.searchActions}><button type="button" onClick={()=>{setTerm('');runSearch('');}}>Clear search</button><button type="submit">Search products</button></div></form>:navigation}</>}</dialog>
 </header>;
}
export function SiteHeader(){return <Suspense fallback={<header className={`site-header ${styles.header}`}><div className={styles.bar}>Luminoza</div></header>}><HeaderContent/></Suspense>;}
