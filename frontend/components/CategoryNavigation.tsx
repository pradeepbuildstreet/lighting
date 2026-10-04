import Link from "next/link";
import { findCategoryPath, getCategoryHref, type CategoryNode } from "@/lib/categories";

export function CategoryNavigation({
  categories,
  activeSlug,
}: {
  categories: CategoryNode[];
  activeSlug?: string;
}) {
  const activePath = activeSlug ? findCategoryPath(categories, activeSlug) : [];
  const activeRoot = activePath[0];

  if (!activeRoot?.children.length) return null;

  return (
    <nav className="category-subnav" aria-label={`${activeRoot.name} subcategories`}>
      {activeRoot.children.map((category) => (
        <Link
          key={category.id}
          href={getCategoryHref(category)}
          aria-current={category.slug === activeSlug ? "page" : undefined}
        >
          {category.name}
        </Link>
      ))}
    </nav>
  );
}