import type { Metadata } from "next";
import { ManagerTabs } from "@/components/ManagerTabs";
import { WishlistAnalytics } from "@/components/WishlistAnalytics";

export const metadata: Metadata = {
  title: "Wishlist Analytics | Lighting House",
  robots: { index: false, follow: false },
};

export default function WishlistAnalyticsPage() {
  return (
    <div className="container py-8 manager-page">
      <ManagerTabs active="analytics" />
      <div className="manager-page-heading">
        <p className="wishlist-eyebrow">Manager</p>
        <h1>Wishlist Analytics</h1>
        <p>Aggregate customer interest to help guide inventory decisions. Customer identities are not shown here.</p>
      </div>
      <WishlistAnalytics />
    </div>
  );
}