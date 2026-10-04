export type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  path: string;
  description: string | null;
  sort_order: number;
  product_count: number;
  children: CategoryNode[];
};

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
export const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export function getCategoryHrefFromSlugs(slugs: string[]): string {
  return `/categories/${slugs.map(encodeURIComponent).join("/")}`;
}

export function getCategoryHref(category: Pick<CategoryNode, "path" | "slug">): string {
  const pathSegments = category.path.split("/").filter(Boolean);
  const categorySlugs = pathSegments[0] === "products" ? pathSegments.slice(1) : [category.slug];
  return getCategoryHrefFromSlugs(categorySlugs);
}

export function getAbsoluteUrl(path: string): string {
  return new URL(path, SITE_ORIGIN).toString();
}

export async function getCategoryTree(): Promise<CategoryNode[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/categories`, { cache: "no-store" });
    if (!response.ok) return [];
    const data = await response.json();
    return data.categories || [];
  } catch {
    return [];
  }
}

export function flattenCategories(categories: CategoryNode[]): CategoryNode[] {
  return categories.flatMap((category) => [category, ...flattenCategories(category.children)]);
}

export function findCategoryPath(
  categories: CategoryNode[],
  slug: string
): CategoryNode[] {
  for (const category of categories) {
    if (category.slug === slug) return [category];
    const childPath = findCategoryPath(category.children, slug);
    if (childPath.length) return [category, ...childPath];
  }
  return [];
}