"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL, getAbsoluteUrl } from "@/lib/categories";

type OfferProduct = {
  sku: string;
  name: string;
  price: number;
  add_count: number;
};

type EnquiryForOffer = {
  share_token: string;
  customer_name?: string | null;
  mobile_number?: string | null;
  items: OfferProduct[];
};

type OfferSummary = {
  offer_token: string;
  version: number;
  status: string;
  expires_at: string | null;
  created_at: string;
};

type OfferTerms = {
  gst: string;
  payment_terms: string;
  payment_details: string;
  delivery_days: string;
  other_terms: string;
};

const blankTerms: OfferTerms = {
  gst: "",
  payment_terms: "",
  payment_details: "",
  delivery_days: "",
  other_terms: "",
};

const money = (value: number) => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
}).format(value);

export function OfferManager({ enquiry }: { enquiry: EnquiryForOffer }) {
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [discounts, setDiscounts] = useState<Record<string, string>>({});
  const [terms, setTerms] = useState<OfferTerms>(blankTerms);
  const [expiresAt, setExpiresAt] = useState("");
  const [offers, setOffers] = useState<OfferSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadOffers = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/offers/enquiry/${encodeURIComponent(enquiry.share_token)}`, {
      credentials: "include",
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load offer history.");
    setOffers(data.offers || []);
  }, [enquiry.share_token]);

  useEffect(() => {
    setPrices(Object.fromEntries(enquiry.items.map((item) => [item.sku, Number(item.price).toFixed(2)])));
    setDiscounts(Object.fromEntries(enquiry.items.map((item) => [item.sku, "0"])));
    void loadOffers().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load offer history."));
  }, [enquiry.items, loadOffers]);

  const listTotal = enquiry.items.reduce((sum, item) => sum + item.price * item.add_count, 0);
  const offerTotal = enquiry.items.reduce((sum, item) => {
    const price = Number(prices[item.sku]);
    return sum + (Number.isFinite(price) ? price * item.add_count : 0);
  }, 0);
  const discountPercent = listTotal ? Math.round(((listTotal - offerTotal) / listTotal) * 10000) / 100 : 0;
  const invalidPricing = enquiry.items.some((item) => {
    const price = Number(prices[item.sku]);
    const discount = Number(discounts[item.sku]);
    return !Number.isFinite(price) || price < 0 || price > item.price ||
      !Number.isFinite(discount) || discount < 0 || discount > 100;
  });

  function updateDiscount(item: OfferProduct, value: string) {
    setDiscounts((current) => ({ ...current, [item.sku]: value }));
    if (value.trim() === "") return;
    const percent = Number(value);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) return;
    const nextPrice = Math.round(item.price * (1 - percent / 100) * 100) / 100;
    setPrices((current) => ({ ...current, [item.sku]: nextPrice.toFixed(2) }));
  }

  function updateOfferPrice(item: OfferProduct, value: string) {
    setPrices((current) => ({ ...current, [item.sku]: value }));
    if (value.trim() === "") {
      setDiscounts((current) => ({ ...current, [item.sku]: "" }));
      return;
    }
    const price = Number(value);
    if (!Number.isFinite(price) || item.price <= 0) return;
    const percent = Math.round(((item.price - price) / item.price) * 10000) / 100;
    setDiscounts((current) => ({ ...current, [item.sku]: percent.toFixed(2) }));
  }

  async function createOffer() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/offers/enquiry/${encodeURIComponent(enquiry.share_token)}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: enquiry.items.map((item) => ({ sku: item.sku, offer_price: prices[item.sku] })),
          terms: {
            ...terms,
            delivery_days: terms.delivery_days || null,
          },
          expires_at: expiresAt || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create offer.");
      setMessage(`Offer version ${data.offer.version} created. Open WhatsApp to share it with the customer.`);
      await loadOffers();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create offer.");
    } finally {
      setBusy(false);
    }
  }

  function offerLinks(offer: OfferSummary) {
    const offerUrl = getAbsoluteUrl(`/offer/${encodeURIComponent(offer.offer_token)}`);
    const pdfUrl = `${API_BASE_URL}/offers/${encodeURIComponent(offer.offer_token)}/pdf`;
    const digits = String(enquiry.mobile_number || "").replace(/\D/g, "");
    const text = `Hello ${enquiry.customer_name || ""}, your Luminoza price offer is ready. View offer: ${offerUrl}`;
    const whatsappUrl = `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
    return { offerUrl, pdfUrl, whatsappUrl };
  }

  return (
    <section className="offer-manager" aria-labelledby="offer-manager-title">
      <div className="offer-manager-heading">
        <div>
          <p className="category-manager-eyebrow">Customer quotation</p>
          <h2 id="offer-manager-title">Prepare a price offer</h2>
        </div>
        <p>Offer prices apply to this enquiry only; catalog prices remain unchanged.</p>
      </div>

      <div className="offer-price-list">
        <div className="offer-price-header"><span>Product</span><span>Qty</span><span>List price</span><span>Discount %</span><span>Offer price / unit</span></div>
        {enquiry.items.map((item) => (
          <label className="offer-price-row" key={item.sku}>
            <span className="offer-product-label"><strong>{item.name}</strong><small>SKU: {item.sku}</small></span>
            <span>{item.add_count}</span>
            <span>{money(item.price)}</span>
            <span className="offer-price-edit">
              <small>Discount %</small>
              <input
                aria-label={`Discount percentage for ${item.name}`}
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={discounts[item.sku] ?? "0"}
                onChange={(event) => updateDiscount(item, event.target.value)}
              />
            </span>
            <span className="offer-price-edit">
              <small>Offer price</small>
              <input
                aria-label={`Offer price per unit for ${item.name}`}
                type="number"
                min="0"
                max={item.price}
                step="0.01"
                required
                value={prices[item.sku] || ""}
                onChange={(event) => updateOfferPrice(item, event.target.value)}
              />
            </span>
          </label>
        ))}
      </div>

      <div className="offer-totals">
        <span>Subtotal <strong>{money(listTotal)}</strong></span>
        <span>Discount offered <strong>{discountPercent}% ({money(Math.max(0, listTotal - offerTotal))})</strong></span>
        <span>Offer total <strong>{money(offerTotal)}</strong></span>
      </div>

      <div className="offer-terms-form">
        <h3>Terms and conditions</h3>
        <label>GST / tax terms<input value={terms.gst} placeholder="Example: GST additional at applicable rate" onChange={(event) => setTerms({ ...terms, gst: event.target.value })} /></label>
        <label>Advance / payment terms<input value={terms.payment_terms} placeholder="Enter advance payment and balance terms" onChange={(event) => setTerms({ ...terms, payment_terms: event.target.value })} /></label>
        <label>Account / payment details<textarea rows={3} value={terms.payment_details} placeholder="Enter only the payment details to share with this customer" onChange={(event) => setTerms({ ...terms, payment_details: event.target.value })} /></label>
        <label>Estimated delivery (days)<input type="number" min="1" max="365" value={terms.delivery_days} placeholder="Enter estimated days" onChange={(event) => setTerms({ ...terms, delivery_days: event.target.value })} /></label>
        <label>Other terms<textarea rows={3} value={terms.other_terms} placeholder="Warranty, installation, offer validity conditions, or other notes" onChange={(event) => setTerms({ ...terms, other_terms: event.target.value })} /></label>
        <label>Offer valid until<input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label>
      </div>

      {error && <p className="manager-error" role="alert">{error}</p>}
      {message && <p className="category-manager-message" role="status">{message}</p>}
      <button className="category-manager-primary" type="button" disabled={busy || invalidPricing || !enquiry.items.length} onClick={() => void createOffer()}>
        {busy ? "Creating offer..." : "Create offer"}
      </button>

      {!!offers.length && (
        <div className="offer-history">
          <h3>Offer history</h3>
          {offers.map((offer) => {
            const links = offerLinks(offer);
            return (
              <article className="offer-history-row" key={offer.offer_token}>
                <div><strong>Version {offer.version}</strong><small>Created {new Date(offer.created_at).toLocaleString("en-IN")}{offer.expires_at ? ` · Valid until ${new Date(offer.expires_at).toLocaleDateString("en-IN")}` : ""}</small></div>
                <span className="enquiry-status">Ready to share</span>
                <div className="offer-history-actions">
                  <a href={links.offerUrl} target="_blank" rel="noreferrer">View link</a>
                  <a href={links.pdfUrl}>Download PDF</a>
                  <a href={links.whatsappUrl} target="_blank" rel="noreferrer">Open WhatsApp</a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}