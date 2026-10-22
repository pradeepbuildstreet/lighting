"use client";
import styles from "./EnquiryProductSummary.module.css";
import { WishlistMedia } from "@/components/WishlistMedia";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/api-base";
import { itemIdentity, wishlistProductHref } from "@/lib/wishlist-product";
import type { Wishlist } from "@/components/WishlistProvider";
import { lineAmount } from "@/lib/wishlist-quantity.mjs";
import { OfferManager } from "@/components/OfferManager";

const formatAmount = (value: number | string) => Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Enquiry = Wishlist & {
  communication_channel?: string | null;
  whatsapp_opened_at?: string | null;
};

export function EnquiryDetail({ token }: { token: string }) {
  const [enquiry, setEnquiry] = useState<Enquiry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusBusy,setStatusBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/wishlists/admin/${encodeURIComponent(token)}`, { cache: "no-store", credentials: "include" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Enquiry not found.");
        setEnquiry(data.enquiry);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load enquiry."))
      .finally(() => setLoading(false));
  }, [token]);

  const updateStatus = async (status: "contacted" | "closed") => {
    if(statusBusy)return;
    setStatusBusy(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/wishlists/admin/${encodeURIComponent(token)}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update enquiry status.");
      setEnquiry(data.enquiry);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update enquiry status.");
    } finally { setStatusBusy(false); }
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
          {enquiry.status === "submitted" && <button type="button" disabled={statusBusy} onClick={() => void updateStatus("contacted")}>Mark contacted</button>}
          {enquiry.status !== "closed" && <button type="button" disabled={statusBusy} onClick={() => void updateStatus("closed")}>Close enquiry</button>}
        </div>
      </div>
      {error && <p className="manager-error" role="alert">{error}</p>}

      <div className="enquiry-customer-details">
        <div><span>Mobile</span><a href={`tel:${enquiry.mobile_number}`}>{enquiry.mobile_number}</a></div>
        <div><span>Email</span>{enquiry.email ? <a href={`mailto:${enquiry.email}`}>{enquiry.email}</a> : <strong>Not provided</strong>}</div>
        <div><span>PIN code</span><strong>{enquiry.pin_code}</strong></div>
        <div><span>Contact channel</span><strong>{enquiry.communication_channel === "whatsapp" ? "WhatsApp opened" : "Website enquiry"}</strong></div>
      </div>

      <section className="enquiry-requirements">
        <h2>Requirements</h2>
        <p>{enquiry.requirements || "No additional requirements provided."}</p>
      </section>

      <section className="enquiry-products">
        <h2>Interested products ({enquiry.items.length})</h2>
        {enquiry.items.map((item) => (
          <article key={itemIdentity(item)} className={`enquiry-product-row ${styles.productRow}`}>
            <div className={`enquiry-product-image ${styles.productImage}`}>
              <WishlistMedia item={item} />
            </div>
            <div className={`enquiry-product-copy ${styles.productCopy}`}>
              <h3>{item.name}</h3>
              <p>SKU: {item.sku}</p>
              <dl className={styles.metrics} aria-label="Requested product amounts">
                <div className={styles.metric}>
                  <dt>Unit price</dt>
                  <dd>{item.currency || "INR"} {formatAmount(item.price)}</dd>
                </div>
                <div className={styles.metric}>
                  <dt>Requested qty</dt>
                  <dd>{item.quantity}</dd>
                </div>
                <div className={`${styles.metric} ${styles.lineAmount}`}>
                  <dt>Line amount</dt>
                  <dd>{item.currency || "INR"} {formatAmount(lineAmount(item.price, item.quantity))}</dd>
                </div>
              </dl>
            </div>
            <Link className={styles.viewProduct} href={wishlistProductHref(item)}>View product</Link>
          </article>
        ))}
      </section>
      <OfferManager enquiry={enquiry} />
    </section>
  );
}