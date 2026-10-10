import Link from "next/link";

export function ManagerTabs({ active }: { active: "enquiries" | "categories" | "analytics" | "admins" }) {
  return (
    <nav className="manager-tabs" aria-label="Manager sections">
      <Link href="/admin/enquiries" aria-current={active === "enquiries" ? "page" : undefined}>Enquiries</Link>
      <Link href="/admin/analytics" aria-current={active === "analytics" ? "page" : undefined}>Wishlist analytics</Link>
      <Link href="/admin/categories" aria-current={active === "categories" ? "page" : undefined}>Categories</Link>
      <Link href="/admin/users" aria-current={active === "admins" ? "page" : undefined}>Admin accounts</Link>
    </nav>
  );
}