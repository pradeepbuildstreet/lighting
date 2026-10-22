"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, Heart, Menu, Search, X } from "lucide-react";
import {getCatalogueClient,categoryHref as getCategoryHrefFromPath} from '@/lib/catalogue-client';
import type {CatalogueCategory as CategoryNode} from '@/lib/catalogue-types';
import {navLinks} from '@/lib/catalogue-route-model';
const getCategoryHref=(category:CategoryNode)=>getCategoryHrefFromPath(category.path);
import { useWishlist } from "@/components/WishlistProvider";

function SearchForm({ mobile = false }: { mobile?: boolean }) {
  return (
    <form
      action="/products"
      method="get"
      className={`site-search ${mobile ? "site-search-mobile" : "site-search-desktop"}`}
      role="search"
    >
      <label className="sr-only" htmlFor={mobile ? "mobile-product-search" : "product-search"}>
        Search products
      </label>
      <input
        id={mobile ? "mobile-product-search" : "product-search"}
        name="q"
        maxLength={200}
        type="search"
        placeholder="Search products or SKU"
      />
      <button type="submit" aria-label="Search">
        <Search size={18} aria-hidden="true" />
      </button>
    </form>
  );
}

export function SiteHeader() {
  const { wishlist } = useWishlist();
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [categoriesUnavailable,setCategoriesUnavailable]=useState(false);
  const [navigationAttempt,setNavigationAttempt]=useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [openDesktopCategory, setOpenDesktopCategory] = useState<string | null>(null);

  useEffect(()=>{
    const ac=new AbortController();let active=true;
    try{getCatalogueClient().categories({signal:ac.signal}).then(data=>{if(active){setCategories(data.categories);setCategoriesUnavailable(false);}}).catch(()=>{if(active){setCategories([]);setCategoriesUnavailable(true);}});}catch(_){setCategoriesUnavailable(true);}
    return ()=>{active=false;ac.abort();};
  },[navigationAttempt]);

  return (
    <header className="site-header">
      <div className="container">
        <div className="site-header-main">
          <Link prefetch={false} href="/" className="site-brand" aria-label="Luminoza home">
            <span className="site-brand-lockup">
              <img src="/luminoza-logo.svg" alt="Luminoza" />
              <small>Beautiful lighting! Exuberant living!</small>
            </span>
          </Link>

          <nav className="site-nav site-nav-desktop" aria-label="Shop by department">
            <Link prefetch={false} href="/products">All products</Link>
            {categories.map((category) => (
              <div
                className={`site-nav-item ${openDesktopCategory === category.id ? "is-open" : ""}`}
                key={category.id}
                onMouseEnter={() => setOpenDesktopCategory(category.id)}
                onMouseLeave={() => setOpenDesktopCategory(null)}
                onFocusCapture={() => setOpenDesktopCategory(category.id)}
                onBlurCapture={(event) => {
                  const nextTarget = event.relatedTarget;
                  if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
                    setOpenDesktopCategory(null);
                  }
                }}
              >
                <Link prefetch={false}
                  href={getCategoryHref(category)}
                  aria-haspopup={category.children.length ? "true" : undefined}
                  aria-expanded={category.children.length ? openDesktopCategory === category.id : undefined}
                  aria-controls={category.children.length ? `desktop-subcategories-${category.slug}` : undefined}
                  onClick={() => setOpenDesktopCategory(null)}
                >
                  {category.name}
                </Link>
                {category.children.length > 0 && (
                  <div id={`desktop-subcategories-${category.slug}`} className="site-nav-dropdown">
                    {navLinks(category.children,{categoryHref:getCategoryHrefFromPath}).map((child) => (
                      <Link prefetch={false} key={child.id} href={child.href} style={{paddingInlineStart:12+child.depth*12}} onClick={() => setOpenDesktopCategory(null)}>
                        {child.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          <SearchForm />

          <Link prefetch={false} href="/wishlist" className="wishlist-header-link" aria-label={`Wishlist, ${wishlist?.items.length || 0} products`}>
            <Heart size={19} aria-hidden="true" />
            <span>Wishlist</span>
            {!!wishlist?.items.length && <span className="wishlist-header-count">{wishlist.items.length}</span>}
          </Link>

          <button
            type="button"
            className="site-menu-toggle"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-site-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        <nav
          id="mobile-site-menu"
          className={`site-nav site-nav-mobile ${menuOpen ? "is-open" : ""}`}
          aria-label="Shop by department"
        >
          <SearchForm mobile />
          <Link prefetch={false} href="/products" onClick={()=>setMenuOpen(false)}>All products</Link>
          <Link prefetch={false} href="/wishlist" className="wishlist-mobile-link" onClick={() => setMenuOpen(false)}>
            <Heart size={18} aria-hidden="true" /> Wishlist ({wishlist?.items.length || 0})
          </Link>
          {categories.map((category) => (
            <div className="site-nav-mobile-group" key={category.id}>
              <div className="site-nav-mobile-heading">
                <Link prefetch={false} href={getCategoryHref(category)} onClick={() => setMenuOpen(false)}>
                  {category.name}
                </Link>
                {category.children.length > 0 && (
                  <button
                    type="button"
                    aria-label={`${expandedCategory === category.id ? "Hide" : "Show"} ${category.name} subcategories`}
                    aria-expanded={expandedCategory === category.id}
                    aria-controls={`mobile-subcategories-${category.slug}`}
                    onClick={() => setExpandedCategory((current) => current === category.id ? null : category.id)}
                  >
                    <ChevronDown size={17} aria-hidden="true" />
                  </button>
                )}
              </div>
              {category.children.length > 0 && expandedCategory === category.id && (
                <div id={`mobile-subcategories-${category.slug}`} className="site-nav-mobile-children">
                  {navLinks(category.children,{categoryHref:getCategoryHrefFromPath}).map((child) => (
                    <Link prefetch={false}
                      className="site-nav-mobile-child"
                      key={child.id}
                      href={child.href} style={{paddingInlineStart:12+child.depth*12}}
                      onClick={() => setMenuOpen(false)}
                    >
                      {child.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        {categoriesUnavailable&&<p role="status" className="category-manager-notice">Category navigation is temporarily unavailable. Use All products to retry the catalogue. <button type="button" className="underline" onClick={()=>setNavigationAttempt(n=>n+1)}>Retry categories</button></p>}
      </div>
    </header>
  );
}