import type { MetadataRoute } from "next";
import { API_BASE_URL, SITE_ORIGIN, flattenCategories, getCategoryHref } from "@/lib/categories";

type ProductSearchResponse = {
  products?: { sku: string; category?: string }[];
  pagination?: { totalPages: number };
};

async function getAllProducts() {
  const products: NonNullable<ProductSearchResponse["products"]> = [];
  let page = 1;

  while (true) {
    const response = await fetch(
      `${API_BASE_URL}/search/products?page=${page}&limit=500`,
      { cache: "no-store" }
    );
    if (!response.ok) break;

    const data: ProductSearchResponse = await response.json();
    products.push(...(data.products || []));
    if (!data.pagination || page >= data.pagination.totalPages) break;
    page += 1;
  }

  return products;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categoriesResponse, products] = await Promise.all([
    fetch(`${API_BASE_URL}/categories`, { cache: "no-store" }),
    getAllProducts(),
  ]);
  const categoryTree = categoriesResponse.ok
    ? (await categoriesResponse.json()).categories || []
    : [];
  const categories = flattenCategories(categoryTree);
  const now = new Date();

  return [
    { url: new URL("/", SITE_ORIGIN).toString(), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: new URL("/products", SITE_ORIGIN).toString(), lastModified: now, changeFrequency: "daily", priority: 0.8 },
    ...categories.map((category) => ({
      url: new URL(getCategoryHref(category), SITE_ORIGIN).toString(),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: category.parent_id ? 0.7 : 0.8,
    })),
    ...products.filter((product) => product.category).map((product) => ({
      url: new URL(`/products/${encodeURIComponent(product.category!)}/${encodeURIComponent(product.sku)}`, SITE_ORIGIN).toString(),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}