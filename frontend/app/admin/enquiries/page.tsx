import type { Metadata } from "next";
import { EnquiryQueue } from "@/components/EnquiryQueue";
import { ManagerTabs } from "@/components/ManagerTabs";

export const metadata: Metadata = {
  title: "Wishlist Enquiries | Luminoza",
  robots: { index: false, follow: false },
};

export default function EnquiriesPage() {
  return (
    <div className="container py-8 manager-page">
      <ManagerTabs active="enquiries" />
      <div className="manager-page-heading">
        <p className="wishlist-eyebrow">Manager</p>
        <h1>Wishlist Enquiries</h1>
        <p>Submitted customer requests, products, and requirements.</p>
      </div>
      <EnquiryQueue />
    </div>
  );
}