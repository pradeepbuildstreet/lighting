import Link from "next/link";
import { Fragment } from "react";
import { getImageSrc } from "@/lib/image-url";
import type { Product } from "@/lib/products";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { getAbsoluteUrl, getCategoryHrefFromSlugs, SITE_ORIGIN } from "@/lib/categories";
import { WishlistButton } from "@/components/WishlistButton";

function formatCategory(slug: string) {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function ProductDetails({ product }: { product: Product }) {
  const categoryName = product.category_name || formatCategory(product.category);
  const categoryPath = product.category_path?.length
    ? product.category_path
    : [{ slug: product.category, name: categoryName }];
  const breadcrumbItems = [
    { name: "Home", item: getAbsoluteUrl("/") },
    ...categoryPath.map((category, index) => ({
      name: category.name,
      item: getAbsoluteUrl(getCategoryHrefFromSlugs(categoryPath.slice(0, index + 1).map((item) => item.slug))),
    })),
    { name: product.name, item: getAbsoluteUrl(`/products/${encodeURIComponent(product.category)}/${encodeURIComponent(product.sku)}`) },
  ];
  const imageUrl = product.image_url ? new URL(getImageSrc(product.image_url) || product.image_url, SITE_ORIGIN).toString() : undefined;
  const structuredProduct = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    description: product.description,
    category: categoryPath.map((category) => category.name).join(" > "),
    image: imageUrl ? [imageUrl] : undefined,
    brand: product.optional_attributes?.brand
      ? { "@type": "Brand", name: product.optional_attributes.brand }
      : undefined,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
      url: breadcrumbItems.at(-1)?.item,
    },
  };
  const structuredBreadcrumb = {
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
    <div className="container py-8">
      <BreadcrumbJsonLd data={structuredProduct} />
      <BreadcrumbJsonLd data={structuredBreadcrumb} />
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-gray-600">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-gray-900">
              Home
            </Link>
          </li>
          {categoryPath.map((category) => (
            <Fragment key={category.slug}>
              <li aria-hidden="true">/</li>
              <li>
                <Link
                  href={getCategoryHrefFromSlugs(categoryPath.slice(0, categoryPath.indexOf(category) + 1).map((item) => item.slug))}
                  className="hover:text-gray-900"
                >
                  {category.name}
                </Link>
              </li>
            </Fragment>
          ))}
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-medium text-gray-900">
            {product.name}
          </li>
        </ol>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-gray-100 rounded-lg min-h-[400px] flex items-center justify-center overflow-hidden">
          {product.image_url ? (
            <img
              src={getImageSrc(product.image_url)}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span>No image available</span>
          )}
        </div>

        <div>
          <h1 className="text-3xl font-bold mb-4">{product.name}</h1>
          <p className="text-gray-600 mb-4">{product.description}</p>
          <div className="product-details-actions">
            <p className="text-2xl font-semibold mb-6">₹{product.price}</p>
            <WishlistButton sku={product.sku} name={product.name} wishlistCount={product.wishlist_count} />
          </div>

          <div className="space-y-2 text-sm">
            <p><strong>Style:</strong> {product.style}</p>
            <p><strong>Material:</strong> {product.material}</p>
            <p><strong>Wattage:</strong> {product.wattage}W</p>
            <p><strong>Lumens:</strong> {product.lumens}</p>
            <p><strong>Color Temperature:</strong> {product.color_temperature}K</p>
          </div>
        </div>
      </div>
    </div>
  );
}