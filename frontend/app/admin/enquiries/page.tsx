import type { Metadata } from "next";
import { EnquiryQueue } from "@/components/EnquiryQueue";
import { AdminShell } from "@/components/AdminShell";

export const metadata: Metadata = {
  title: "Wishlist Enquiries | Luminoza",
  robots: { index: false, follow: false },
};

export default function EnquiriesPage() {
  return (
    <AdminShell active="enquiries">
      <div className="manager-page-heading">
        <p className="wishlist-eyebrow">Manager</p>
        <h1>Wishlist Enquiries</h1>
        <p>Submitted customer requests, products, and requirements.</p>
      </div>
      <EnquiryQueue />
    </AdminShell>
  );
}