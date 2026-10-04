import { Fragment } from "react";
import Link from "next/link";
import { CategoryNavigation } from "@/components/CategoryNavigation";
import { Filters } from "@/components/Filters";
import { ProductListing } from "@/components/ProductListing";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import {
  flattenCategories,
  getCategoryHref,
  getAbsoluteUrl,
  getCategoryHrefFromSlugs,
  type CategoryNode,
} from "@/lib/categories";

export function CategoryListing({
  categories,
  categoryPath,
}: {
  categories: CategoryNode[];
  categoryPath: CategoryNode[];
}) {
  const activeCategory = categoryPath.at(-1);
  const filterContext = activeCategory?.children.length ? activeCategory : categoryPath.at(-2);
  const categoryChoices = filterContext
    ? [filterContext, ...filterContext.children]
    : flattenCategories(categories);
  const categoryOptions = categoryChoices.map((category) => ({
    slug: category.slug,
    name: category.name,
    href: getCategoryHref(category),
  }));
  const breadcrumbItems = [
    { name: "Home", item: getAbsoluteUrl("/") },
    ...categoryPath.map((category, index) => ({
      name: category.name,
      item: getAbsoluteUrl(getCategoryHrefFromSlugs(categoryPath.slice(0, index + 1).map((item) => item.slug))),
    })),
  ];

  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.item,
    })),
  };

  return (
    <div className="container py-8 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
      <aside className="h-fit">
        <Filters
          categorySlug={activeCategory?.slug}
          categoryOptions={categoryOptions}
          categoryContextName={filterContext?.name}
        />
      </aside>

      <main>
        {categoryPath.length > 0 && (
          <>
            <BreadcrumbJsonLd data={breadcrumbData} />
            <nav aria-label="Breadcrumb" className="mb-4 text-sm text-gray-600">
              <ol className="flex flex-wrap items-center gap-2">
                <li><Link href="/" className="hover:text-gray-900">Home</Link></li>
                {categoryPath.map((category, index) => (
                  <Fragment key={category.id}>
                    <li aria-hidden="true">/</li>
                    {index === categoryPath.length - 1 ? (
                      <li aria-current="page" className="font-medium text-gray-900">{category.name}</li>
                    ) : (
                      <li>
                        <Link
                          href={getCategoryHrefFromSlugs(categoryPath.slice(0, index + 1).map((item) => item.slug))}
                          className="hover:text-gray-900"
                        >
                          {category.name}
                        </Link>
                      </li>
                    )}
                  </Fragment>
                ))}
              </ol>
            </nav>
          </>
        )}
        <h1 className="text-3xl font-bold mb-2">{activeCategory?.name || "All Lighting Products"}</h1>
        <CategoryNavigation categories={categories} activeSlug={activeCategory?.slug} />
        <ProductListing categorySlug={activeCategory?.slug} />
      </main>
    </div>
  );
}