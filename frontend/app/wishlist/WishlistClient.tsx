"use client";

import Link from "next/link";
import { useState } from "react";
import { Grid2X2, Heart, List, Share2, Trash2 } from "lucide-react";
import { useWishlist } from "@/components/WishlistProvider";
import { getAbsoluteUrl } from "@/lib/categories";
import { getImageSrc } from "@/lib/image-url";

const MANAGER_EMAIL = "pradeep33.tcs@gmail.com";
const MANAGER_WHATSAPP = (process.env.NEXT_PUBLIC_MANAGER_WHATSAPP_NUMBER || "918124969000").replace(/\D/g, "");

function getEnquiryUrl(token: string) {
  return getAbsoluteUrl(`/admin/enquiries/${encodeURIComponent(token)}`);
}

export function WishlistClient() {
  const { wishlist, loading, removeProduct, submitEnquiry } = useWishlist();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [customer, setCustomer] = useState({ name: "", mobile_number: "", email: "", pin_code: "", requirements: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const itemCount = wishlist?.items.length || 0;
  const enquiryUrl = wishlist ? getEnquiryUrl(wishlist.share_token) : "";
  const messageText = wishlist
    ? [
        "Lighting House wishlist enquiry",
        `Customer: ${wishlist.customer_name}`,
        `Mobile: ${wishlist.mobile_number}`,
        `PIN code: ${wishlist.pin_code}`,
        wishlist.requirements ? `Requirements: ${wishlist.requirements}` : "",
        `Products: ${wishlist.items.map((item) => item.name).join(", ")}`,
        `Enquiry link: ${enquiryUrl}`,
      ].filter(Boolean).join("\n")
    : "";
  const whatsappUrl = `https://wa.me/${MANAGER_WHATSAPP}?text=${encodeURIComponent(messageText)}`;
  const emailUrl = `mailto:${MANAGER_EMAIL}?subject=${encodeURIComponent("Lighting House wishlist enquiry")}&body=${encodeURIComponent(messageText)}`;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await submitEnquiry(customer);
      setMessage("Enquiry saved. Share the details with the manager using WhatsApp or email.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not submit enquiry.");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!enquiryUrl) return;
    try {
      await navigator.clipboard.writeText(enquiryUrl);
      setMessage("Private wishlist link copied.");
    } catch {
      setMessage(enquiryUrl);
    }
  };

  if (loading) return <div className="container py-12">Loading wishlist...</div>;

  return (
    <div className="container py-10 wishlist-page">
      <div className="wishlist-page-heading">
        <div>
          <p className="wishlist-eyebrow">Lighting House</p>
          <h1>My Wishlist</h1>
          <p>{itemCount} {itemCount === 1 ? "product" : "products"}</p>
        </div>
        {wishlist && (
          <div className="wishlist-view-toggle" role="group" aria-label="Wishlist layout">
            <button type="button" className={view === "grid" ? "is-active" : ""} aria-label="Grid view" aria-pressed={view === "grid"} onClick={() => setView("grid")}>
              <Grid2X2 size={18} aria-hidden="true" />
            </button>
            <button type="button" className={view === "list" ? "is-active" : ""} aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")}>
              <List size={18} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {message && <p className="wishlist-feedback" role="status">{message}</p>}
      {error && <p className="wishlist-error" role="alert">{error}</p>}

      {!wishlist?.items.length ? (
        <div className="wishlist-empty">
          <Heart size={27} aria-hidden="true" />
          <h2>Your wishlist is empty</h2>
          <p>Add products to keep your lighting ideas together.</p>
          <Link href="/products" className="wishlist-primary-link">Browse products</Link>
        </div>
      ) : (
        <>
          <div className={`wishlist-items ${view === "list" ? "is-list" : "is-grid"}`}>
            {wishlist.items.map((item) => (
              <article key={item.sku} className="wishlist-item">
                <Link href={item.category_slug ? `/products/${item.category_slug}/${item.sku}` : "/products"} className="wishlist-item-product">
                  <div className="wishlist-item-image">
                    {item.image_url ? <img src={getImageSrc(item.image_url)} alt={item.name} /> : <span>No image</span>}
                  </div>
                  <div className="wishlist-item-copy">
                    <h2>{item.name}</h2>
                    <p>SKU: {item.sku}</p>
                    <strong>₹{item.price}</strong>
                    <span>In your wishlist</span>
                  </div>
                </Link>
                {wishlist.status === "draft" && (
                  <button type="button" className="wishlist-remove" aria-label={`Remove ${item.name}`} onClick={() => void removeProduct(item.sku)}>
                    <Trash2 size={17} aria-hidden="true" />
                  </button>
                )}
              </article>
            ))}
          </div>

          <section className="wishlist-enquiry">
            <div className="wishlist-enquiry-heading">
              <div>
                <h2>{wishlist.status === "draft" ? "Request an enquiry" : "Enquiry submitted"}</h2>
                <p>Customer details are shared with the manager only after you submit.</p>
              </div>
            </div>

            {wishlist.status === "draft" ? (
              <>
                <div className="wishlist-share-link">
                  <label htmlFor="wishlist-share-url">Private wishlist link</label>
                  <input id="wishlist-share-url" readOnly value={enquiryUrl} onFocus={(event) => event.currentTarget.select()} />
                  <button type="button" onClick={() => void copyLink()}>Copy link</button>
                </div>
                <form className="wishlist-enquiry-form" onSubmit={submit}>
                  <label>
                    Name
                    <input required minLength={2} maxLength={160} autoComplete="name" value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} />
                  </label>
                  <label>
                    Mobile number
                    <span className="wishlist-phone-input"><span>+91</span><input required type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="10-digit mobile number" value={customer.mobile_number} onChange={(event) => setCustomer({ ...customer, mobile_number: event.target.value })} /></span>
                  </label>
                  <label>
                    PIN code
                    <input required inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} autoComplete="postal-code" placeholder="6-digit PIN code" value={customer.pin_code} onChange={(event) => setCustomer({ ...customer, pin_code: event.target.value.replace(/\D/g, "").slice(0, 6) })} />
                  </label>
                  <label>
                    Email (optional)
                    <input type="email" maxLength={254} autoComplete="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} />
                  </label>
                  <label className="wishlist-requirements-field">
                    Requirements
                    <textarea rows={4} maxLength={5000} placeholder="Room, quantity, finish, installation, or other details" value={customer.requirements} onChange={(event) => setCustomer({ ...customer, requirements: event.target.value })} />
                  </label>
                  <button type="submit" className="wishlist-submit-button" disabled={busy}>
                    {busy ? "Submitting..." : "Submit enquiry"}
                  </button>
                </form>
              </>
            ) : (
              <div className="wishlist-share-actions">
                <p>Your enquiry is saved. Adding another product starts a new wishlist and leaves this enquiry unchanged.</p>
                <p>{wishlist.customer_name} · +91 {wishlist.mobile_number?.replace(/^\+91/, "")} · PIN {wishlist.pin_code}</p>
                <a href={whatsappUrl} target="_blank" rel="noreferrer" className="wishlist-whatsapp-link">
                  <Share2 size={17} aria-hidden="true" /> Share via WhatsApp
                </a>
                <a href={emailUrl} className="wishlist-email-link">Prepare email to {MANAGER_EMAIL}</a>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}