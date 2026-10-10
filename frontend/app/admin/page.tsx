import type { Metadata } from "next";
import Link from "next/link";
import { AdminSignOut } from "@/components/AdminSignOut";

export const metadata: Metadata = {
  title: "Admin Overview | Luminoza",
  robots: { index: false, follow: false },
};

const adminSections = [
  { href: "/admin/enquiries", title: "Customer enquiries", description: "Review submitted wishlists and customer requests." },
  { href: "/admin/categories", title: "Store categories", description: "Organize the product catalogue and category hierarchy." },
  { href: "/admin/analytics", title: "Wishlist analytics", description: "See product interest across submitted wishlists." },
  { href: "/admin/users", title: "Admin accounts", description: "Add administrators or disable accounts that no longer need access." },
];

export default function AdminOverviewPage() {
  return (
    <div className="container py-8 admin-overview">
      <div className="admin-overview-heading">
        <div>
          <p className="admin-eyebrow">Luminoza / Operations</p>
          <h1>Administration</h1>
          <p>Store management</p>
        </div>
        <AdminSignOut />
      </div>
      <nav className="admin-section-grid" aria-label="Admin sections">
        {adminSections.map((section) => (
          <Link className="admin-section-link" href={section.href} key={section.href}>
            <span>{section.title}</span>
            <p>{section.description}</p>
          </Link>
        ))}
      </nav>
    </div>
  );
}