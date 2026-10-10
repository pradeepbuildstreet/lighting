import type { Metadata } from "next";
import { EnquiryDetail } from "@/components/EnquiryDetail";
import { ManagerTabs } from "@/components/ManagerTabs";

export const metadata: Metadata = {
  title: "Wishlist Enquiry | Luminoza",
  robots: { index: false, follow: false },
};

export default function EnquiryDetailPage({ params }: { params: { token: string } }) {
  return (
    <div className="container py-8 manager-page">
      <ManagerTabs active="enquiries" />
      <EnquiryDetail token={params.token} />
    </div>
  );
}