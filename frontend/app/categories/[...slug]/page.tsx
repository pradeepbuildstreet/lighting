import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CategoryListing } from "@/components/CategoryListing";
import {
  findCategoryPath,
  getAbsoluteUrl,
  getCategoryHrefFromSlugs,
  getCategoryTree,
} from "@/lib/categories";

type Props = { params: { slug: string[] } };

function resolveCategoryPath(categories: Awaited<ReturnType<typeof getCategoryTree>>, slugs: string[]) {
  const path = findCategoryPath(categories, slugs.at(-1) || "");
  return path.length === slugs.length && path.every((category, index) => category.slug === slugs[index])
    ? path
    : [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const categories = await getCategoryTree();
  const categoryPath = resolveCategoryPath(categories, params.slug);
  const category = categoryPath.at(-1);
  if (!category) return { title: "Category Not Found | Luminoza", robots: { index: false } };

  const title = `${category.name} | Luminoza`;
  const description = category.description?.trim() || `Shop ${category.name.toLowerCase()} at Luminoza.`;
  const canonical = getAbsoluteUrl(getCategoryHrefFromSlugs(params.slug));

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: "website", title, description, url: canonical, siteName: "Luminoza" },
    twitter: { card: "summary", title, description },
  };
}

export default async function CategoryPage({ params }: Props) {
  const categories = await getCategoryTree();
  const categoryPath = resolveCategoryPath(categories, params.slug);
  if (!categoryPath.length) notFound();

  return <CategoryListing categories={categories} categoryPath={categoryPath} />;
}