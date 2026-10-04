"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/categories";

type EnquirySummary = {
  share_token: string;
  customer_name: string;
  mobile_number: string;
  email?: string | null;
  pin_code: string;
  status: string;
  item_count: number;
  submitted_at: string;
};

export function EnquiryQueue() {
  const [enquiries, setEnquiries] = useState<EnquirySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE_URL}/wishlists/admin`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load enquiries.");
        setEnquiries(data.enquiries || []);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load enquiries."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading enquiries...</p>;
  if (error) return <p className="manager-error" role="alert">{error}</p>;
  if (!enquiries.length) return <p className="manager-empty">No submitted enquiries yet.</p>;

  return (
    <div className="enquiry-table-wrap">
      <table className="enquiry-table">
        <thead>
          <tr><th>Customer</th><th>Mobile</th><th>PIN code</th><th>Products</th><th>Status</th><th>Received</th><th /></tr>
        </thead>
        <tbody>
          {enquiries.map((enquiry) => (
            <tr key={enquiry.share_token}>
              <td data-label="Customer">
                <Link href={`/admin/enquiries/${enquiry.share_token}`}>{enquiry.customer_name}</Link>
                {enquiry.email && <small>{enquiry.email}</small>}
              </td>
              <td data-label="Mobile">{enquiry.mobile_number}</td>
              <td data-label="PIN code">{enquiry.pin_code}</td>
              <td data-label="Products">{enquiry.item_count}</td>
              <td data-label="Status"><span className={`enquiry-status is-${enquiry.status}`}>{enquiry.status}</span></td>
              <td data-label="Received">{new Date(enquiry.submitted_at).toLocaleDateString("en-IN")}</td>
              <td data-label="Details"><Link href={`/admin/enquiries/${enquiry.share_token}`}>Open</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}