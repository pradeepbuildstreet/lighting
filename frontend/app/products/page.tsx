import type { Metadata } from "next";
import { CategoryListing } from "@/components/CategoryListing";
import {
  findCategoryPath,
  getAbsoluteUrl,
  getCategoryHrefFromSlugs,
  getCategoryTree,
} from "@/lib/categories";

type SearchParams = { category?: string | string[]; [key: string]: string | string[] | undefined };

function getCategorySlug(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const categorySlug = getCategorySlug(searchParams.category);
  const categories = await getCategoryTree();
  const categoryPath = categorySlug ? findCategoryPath(categories, categorySlug) : [];
  const category = categoryPath.at(-1);
  const hasExtraFilters = Object.keys(searchParams).some((key) => key !== "category");
  const canonical = getAbsoluteUrl(
    category ? getCategoryHrefFromSlugs(categoryPath.map((item) => item.slug)) : "/products"
  );
  const title = category ? `${category.name} | Luminoza` : "All Lighting Products | Luminoza";
  const description = category?.description?.trim() || "Browse lighting for every room from Luminoza.";

  return {
    title,
    description,
    alternates: { canonical },
    robots: hasExtraFilters ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: { type: "website", title, description, url: canonical, siteName: "Luminoza" },
  };
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { category?: string | string[] };
}) {
  const category = getCategorySlug(searchParams.category);
  const categories = await getCategoryTree();
  const categoryPath = category ? findCategoryPath(categories, category) : [];

  return <CategoryListing categories={categories} categoryPath={categoryPath} />;
}