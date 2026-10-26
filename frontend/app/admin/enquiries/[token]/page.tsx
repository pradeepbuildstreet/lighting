import type { Metadata } from "next";
import { EnquiryDetail } from "@/components/EnquiryDetail";
import { DealerEnquiryPanel } from "@/components/DealerEnquiryPanel";
import { AdminShell } from "@/components/AdminShell";

export const metadata: Metadata = {
  title: "Wishlist Enquiry | Luminoza",
  robots: { index: false, follow: false },
};

export default function EnquiryDetailPage({ params }: { params: { token: string } }) {
  return (
    <AdminShell active="enquiries">
      <EnquiryDetail token={params.token} />
      <DealerEnquiryPanel key={params.token} token={params.token} />
    </AdminShell>
  );
}
