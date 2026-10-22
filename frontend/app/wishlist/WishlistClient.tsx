"use client";
import { WishlistMedia } from "@/components/WishlistMedia";

import Link from "next/link";
import { useRef, useState } from "react";
import { Grid2X2, Heart, List, Share2, Trash2 } from "lucide-react";
import { useWishlist } from "@/components/WishlistProvider";
import { API_BASE_URL, getAbsoluteUrl } from "@/lib/api-base";
import styles from "@/components/WishlistQuantity.module.css";
import { MAX_QUANTITY, quantityInput, lineAmount } from "@/lib/wishlist-quantity.mjs";
import { itemIdentity, wishlistProductHref } from "@/lib/wishlist-product";

const MANAGER_EMAIL = "pradeep33.tcs@gmail.com";
const MANAGER_WHATSAPP = (process.env.NEXT_PUBLIC_MANAGER_WHATSAPP_NUMBER || "918124969000").replace(/\D/g, "");

function getEnquiryUrl(token: string) {
  return getAbsoluteUrl(`/admin/enquiries/${encodeURIComponent(token)}`);
}

export function WishlistClient() {
  const { wishlist, sessionId, loading, pendingMutations, updateQuantity, removeProduct, submitEnquiry } = useWishlist();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [customer, setCustomer] = useState({ name: "", mobile_number: "", email: "", pin_code: "", requirements: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [quantityErrors, setQuantityErrors] = useState<Record<string, string>>({});
  const editVersions = useRef<Record<string, number>>({});
  const submitting = useRef(false);
  const invalidQuantities = !!wishlist?.items.some(item =>
    quantityInput(quantities[itemIdentity(item)] ?? String(item.quantity)) === null || !!quantityErrors[itemIdentity(item)]
  );
  function saveQuantity(productId: string, raw: string) {
    const version = (editVersions.current[productId] || 0) + 1;
    editVersions.current[productId] = version;
    setQuantities(current => ({ ...current, [productId]: raw }));
    const next = quantityInput(raw);
    setQuantityErrors(current => ({ ...current, [productId]: next === null ? `Enter a whole number from 1 to ${MAX_QUANTITY}.` : "" }));
    if (next === null) return;
    void updateQuantity(productId, next).then(() => {
      if (editVersions.current[productId] === version) setQuantityErrors(current => ({ ...current, [productId]: "" }));
    }).catch(caught => {
      if (editVersions.current[productId] === version) setQuantityErrors(current => ({ ...current, [productId]: caught instanceof Error ? caught.message : "Quantity could not be saved. Retry." }));
    });
  }
  async function removeItem(identity: string) {
    setError("");
    try {
      await removeProduct(identity);
      setQuantities(current => { const next = { ...current }; delete next[identity]; return next; });
      setQuantityErrors(current => { const next = { ...current }; delete next[identity]; return next; });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not remove product."); }
  }
  const itemCount = wishlist?.items.length || 0;
  const totalUnits = wishlist?.items.reduce((sum, item) => sum + Number(item.quantity), 0) || 0;
  const enquiryUrl = wishlist ? getEnquiryUrl(wishlist.share_token) : "";
  const messageText = wishlist
    ? [
        "Luminoza wishlist enquiry",
        `Customer: ${wishlist.customer_name}`,
        `Mobile: ${wishlist.mobile_number}`,
        `PIN code: ${wishlist.pin_code}`,
        wishlist.requirements ? `Requirements: ${wishlist.requirements}` : "",
        `Products: ${wishlist.items.map((item) => `${item.name} (Qty: ${item.quantity})`).join(", ")}`,
        `Enquiry link: ${enquiryUrl}`,
      ].filter(Boolean).join("\n")
    : "";
  const whatsappUrl = `https://wa.me/${MANAGER_WHATSAPP}?text=${encodeURIComponent(messageText)}`;
  const emailUrl = `mailto:${MANAGER_EMAIL}?subject=${encodeURIComponent("Luminoza wishlist enquiry")}&body=${encodeURIComponent(messageText)}`;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    if (invalidQuantities) { setError("Save valid quantities for every product before submitting."); return; }
    submitting.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await submitEnquiry(customer);
      setMessage("Enquiry saved. Share the details with the manager using WhatsApp or email.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not submit enquiry.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const openWhatsApp = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const whatsappTab = window.open("about:blank", "_blank");
    if (!whatsappTab) {
      setError("Allow pop-ups to continue to WhatsApp.");
      return;
    }
    whatsappTab.opener = null;
    try {
      if (sessionId) {
        await fetch(`${API_BASE_URL}/wishlists/session/whatsapp-opened`, {
          method: "POST",
          headers: { "x-wishlist-session": sessionId },
        });
      }
    } catch {
      setMessage("Opening WhatsApp. The enquiry channel could not be recorded just now.");
    } finally {
      whatsappTab.location.href = whatsappUrl;
    }
  };

  if (loading) return <div className="container py-12">Loading wishlist...</div>;

  return (
    <div className="container py-10 wishlist-page">
      <div className="wishlist-page-heading">
        <div>
          <p className="wishlist-eyebrow">Luminoza</p>
          <h1>My Wishlist</h1>
          <p>{itemCount} {itemCount === 1 ? "product" : "products"} · {totalUnits} {totalUnits === 1 ? "unit" : "units"}</p>
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
      {pendingMutations > 0 && <p role="status" aria-live="polite">Saving wishlist changes...</p>}

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
              <article key={itemIdentity(item)} className="wishlist-item">
                <Link href={wishlistProductHref(item)} className="wishlist-item-product">
                  <div className="wishlist-item-image">
                    <WishlistMedia item={{...item, media:item.media?.filter(m=>m.type==='image')}} />
                  </div>
                  <div className="wishlist-item-copy">
                    <h2>{item.name}</h2>
                    <p>SKU: {item.sku}</p>
                    <strong>Unit price: {item.currency || "INR"} {Number(item.price).toFixed(2)}</strong>
                    <span>In your wishlist</span>
                  </div>
                </Link>
                <div className={styles.quantityPanel}>
                  {wishlist.status === "draft" ? (
                    <label>Qty
                      <input type="text" inputMode="numeric" pattern="[1-9][0-9]{0,3}" maxLength={4}
                        aria-label={`Quantity for ${item.name}`}
                        aria-invalid={!!quantityErrors[itemIdentity(item)]}
                        aria-describedby={quantityErrors[itemIdentity(item)] ? `qty-error-${itemIdentity(item)}` : undefined}
                        disabled={busy}
                        value={quantities[itemIdentity(item)] ?? String(item.quantity)}
                        onChange={event => saveQuantity(item.product_id, event.target.value)} />
                    </label>
                  ) : <span>Qty: {item.quantity}</span>}
                  <small>Line amount: {item.currency || "INR"} {(wishlist.status !== "draft" || quantityInput(quantities[itemIdentity(item)] ?? String(item.quantity)) !== null)
                    ? lineAmount(item.price, Number(quantities[itemIdentity(item)] ?? item.quantity)).toFixed(2) : "—"}</small>
                  {quantityErrors[itemIdentity(item)] && <>
                    <small className={styles.error} id={`qty-error-${itemIdentity(item)}`} role="alert">{quantityErrors[itemIdentity(item)]}</small>
                    {quantityInput(quantities[itemIdentity(item)] ?? String(item.quantity)) !== null &&
                      <button type="button" disabled={busy || pendingMutations > 0} onClick={() => saveQuantity(item.product_id, quantities[itemIdentity(item)] ?? String(item.quantity))}>Retry saving quantity</button>}
                  </>}
                </div>
                {wishlist.status === "draft" && (
                  <button type="button" className="wishlist-remove" aria-label={`Remove ${item.name}`} disabled={busy || pendingMutations > 0} onClick={() => void removeItem(itemIdentity(item))}>
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
                <p>Submit your details to create an enquiry for the manager. The enquiry link requires admin sign-in.</p>
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
                    <textarea rows={4} maxLength={5000} placeholder="Room, finish, installation, or other details (set quantities above)" value={customer.requirements} onChange={(event) => setCustomer({ ...customer, requirements: event.target.value })} />
                  </label>
                  <button type="submit" className="wishlist-submit-button" disabled={busy || pendingMutations > 0 || invalidQuantities}>
                    {busy ? "Submitting..." : "Submit enquiry"}
                  </button>
                </form>
              </>
            ) : (
              <div className="wishlist-share-actions">
                <p>Your enquiry is saved. Adding another product starts a new wishlist and leaves this enquiry unchanged.</p>
                <p>{wishlist.customer_name} · +91 {wishlist.mobile_number?.replace(/^\+91/, "")} · PIN {wishlist.pin_code}</p>
                <a href={whatsappUrl} target="_blank" rel="noreferrer" onClick={(event) => void openWhatsApp(event)} className="wishlist-whatsapp-link">
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