"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, Heart, Lightbulb, Menu, Search, X } from "lucide-react";
import { API_BASE_URL, getCategoryHref, type CategoryNode } from "@/lib/categories";
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
        name="search"
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [openDesktopCategory, setOpenDesktopCategory] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/categories`)
      .then((response) => (response.ok ? response.json() : { categories: [] }))
      .then((data) => setCategories(data.categories || []))
      .catch(() => setCategories([]));
  }, []);

  return (
    <header className="site-header">
      <div className="container">
        <div className="site-header-main">
          <Link href="/" className="site-brand" aria-label="Lighting House home">
            <span className="site-brand-mark"><Lightbulb size={21} strokeWidth={1.8} /></span>
            <span className="site-brand-copy">
              <strong>LIGHTING HOUSE</strong>
              <small>LIGHT FOR LIVING</small>
            </span>
          </Link>

          <nav className="site-nav site-nav-desktop" aria-label="Shop by department">
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
                <Link
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
                    {category.children.map((child) => (
                      <Link key={child.id} href={getCategoryHref(child)} onClick={() => setOpenDesktopCategory(null)}>
                        {child.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          <SearchForm />

          <Link href="/wishlist" className="wishlist-header-link" aria-label={`Wishlist, ${wishlist?.items.length || 0} products`}>
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
          <Link href="/wishlist" className="wishlist-mobile-link" onClick={() => setMenuOpen(false)}>
            <Heart size={18} aria-hidden="true" /> Wishlist ({wishlist?.items.length || 0})
          </Link>
          {categories.map((category) => (
            <div className="site-nav-mobile-group" key={category.id}>
              <div className="site-nav-mobile-heading">
                <Link href={getCategoryHref(category)} onClick={() => setMenuOpen(false)}>
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
                  {category.children.map((child) => (
                    <Link
                      className="site-nav-mobile-child"
                      key={child.id}
                      href={getCategoryHref(child)}
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
      </div>
    </header>
  );
}