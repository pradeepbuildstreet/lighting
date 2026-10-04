"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/categories";
import { getImageSrc } from "@/lib/image-url";
import type { Wishlist } from "@/components/WishlistProvider";

export function EnquiryDetail({ token }: { token: string }) {
  const [enquiry, setEnquiry] = useState<Wishlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE_URL}/wishlists/admin/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Enquiry not found.");
        setEnquiry(data.enquiry);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load enquiry."))
      .finally(() => setLoading(false));
  }, [token]);

  const updateStatus = async (status: "contacted" | "closed") => {
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/wishlists/admin/${encodeURIComponent(token)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update enquiry status.");
      setEnquiry(data.enquiry);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update enquiry status.");
    }
  };

  if (loading) return <p>Loading enquiry...</p>;
  if (error && !enquiry) return <p className="manager-error" role="alert">{error}</p>;
  if (!enquiry) return null;

  return (
    <section className="enquiry-detail">
      <Link href="/admin/enquiries" className="manager-back-link">← Enquiry queue</Link>
      <div className="enquiry-detail-heading">
        <div>
          <p className="wishlist-eyebrow">Wishlist enquiry</p>
          <h1>{enquiry.customer_name}</h1>
          <p>Submitted {enquiry.submitted_at ? new Date(enquiry.submitted_at).toLocaleString("en-IN") : ""}</p>
        </div>
        <div className="enquiry-status-actions">
          <span className={`enquiry-status is-${enquiry.status}`}>{enquiry.status}</span>
          {enquiry.status === "submitted" && <button type="button" onClick={() => void updateStatus("contacted")}>Mark contacted</button>}
          {enquiry.status !== "closed" && <button type="button" onClick={() => void updateStatus("closed")}>Close enquiry</button>}
        </div>
      </div>
      {error && <p className="manager-error" role="alert">{error}</p>}

      <div className="enquiry-customer-details">
        <div><span>Mobile</span><a href={`tel:${enquiry.mobile_number}`}>{enquiry.mobile_number}</a></div>
        <div><span>Email</span>{enquiry.email ? <a href={`mailto:${enquiry.email}`}>{enquiry.email}</a> : <strong>Not provided</strong>}</div>
        <div><span>PIN code</span><strong>{enquiry.pin_code}</strong></div>
      </div>

      <section className="enquiry-requirements">
        <h2>Requirements</h2>
        <p>{enquiry.requirements || "No additional requirements provided."}</p>
      </section>

      <section className="enquiry-products">
        <h2>Interested products ({enquiry.items.length})</h2>
        {enquiry.items.map((item) => (
          <article key={item.sku} className="enquiry-product-row">
            <div className="enquiry-product-image">
              {item.image_url && <img src={getImageSrc(item.image_url)} alt={item.name} />}
            </div>
            <div className="enquiry-product-copy">
              <h3>{item.name}</h3>
              <p>SKU: {item.sku} · In wishlist</p>
              <strong>₹{item.price}</strong>
            </div>
            {item.category_slug && <Link href={`/products/${item.category_slug}/${item.sku}`}>View product</Link>}
          </article>
        ))}
      </section>
    </section>
  );
}