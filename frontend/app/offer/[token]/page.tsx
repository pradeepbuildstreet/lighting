import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { API_BASE_URL } from "@/lib/categories";
import { getImageSrc } from "@/lib/image-url";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your Luminoza Price Offer",
  robots: { index: false, follow: false },
};

type OfferItem = {
  sku: string;
  name: string;
  quantity: number;
  list_price: number;
  discount_percent: number;
  offer_price: number;
  image_url?: string | null;
};

type Offer = {
  offer_token: string;
  version: number;
  status: string;
  customer_name: string;
  created_at: string;
  expires_at: string | null;
  terms: {
    gst?: string;
    payment_terms?: string;
    payment_details?: string;
    delivery_days?: number | null;
    other_terms?: string;
  };
  items: OfferItem[];
  list_total: number;
  discount_percent: number;
  offer_total: number;
  savings: number;
};

const money = (value: number) => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
}).format(value);

const dateOnly = (value: string) => new Date(value).toLocaleDateString("en-IN", { timeZone: "UTC" });

export default async function CustomerOfferPage({ params }: { params: { token: string } }) {
  let offer: Offer;
  try {
    const response = await fetch(`${API_BASE_URL}/offers/${encodeURIComponent(params.token)}`, { cache: "no-store" });
    if (!response.ok) notFound();
    ({ offer } = await response.json());
  } catch {
    notFound();
  }

  const isExpired = Boolean(offer.expires_at && new Date(offer.expires_at).getTime() < Date.now());
  const pdfUrl = `${API_BASE_URL}/offers/${encodeURIComponent(params.token)}/pdf`;
  const terms = [
    ["GST / tax", offer.terms?.gst],
    ["Payment terms", offer.terms?.payment_terms],
    ["Account / payment details", offer.terms?.payment_details],
    ["Estimated delivery", offer.terms?.delivery_days ? `${offer.terms.delivery_days} days` : ""],
    ["Additional terms", offer.terms?.other_terms],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <div className="container customer-offer-page">
      <header className="customer-offer-heading">
        <div>
          <p className="wishlist-eyebrow">Luminoza / Customer offer</p>
          <h1>Your price offer</h1>
          <p>Prepared for {offer.customer_name}</p>
          {offer.expires_at && <p>Valid until {dateOnly(offer.expires_at)}</p>}
        </div>
        <a className="wishlist-primary-link" href={pdfUrl}>Download PDF</a>
      </header>

      {isExpired && <p className="manager-error" role="status">This offer has expired. Please contact us for updated pricing.</p>}
      {offer.status !== "ready" && <p className="wishlist-feedback">Offer status: {offer.status}</p>}

      <section className="customer-offer-items" aria-label="Offered products">
        <div className="customer-offer-table-head"><span>Product</span><span>Qty</span><span>List price</span><span>Discount</span><span>Offer price</span><span>Line total</span></div>
        {offer.items.map((item) => (
          <article className="customer-offer-item" key={item.sku}>
            <div className="customer-offer-product">
              <div className="customer-offer-image">{item.image_url && <img src={getImageSrc(item.image_url)} alt="" />}</div>
              <div><strong>{item.name}</strong><small>SKU: {item.sku}</small></div>
            </div>
            <span data-label="Qty">{item.quantity}</span>
            <span data-label="List price">{money(item.list_price)}</span>
            <span data-label="Discount">{item.discount_percent}%</span>
            <strong data-label="Offer price">{money(item.offer_price)}</strong>
            <strong data-label="Line total">{money(item.offer_price * item.quantity)}</strong>
          </article>
        ))}
      </section>

      <section className="customer-offer-summary">
        <p><span>Subtotal</span><strong>{money(offer.list_total)}</strong></p>
        <p><span>Discount offered</span><strong>{offer.discount_percent}% ({money(offer.savings)})</strong></p>
        <p><span>Offer total</span><strong>{money(offer.offer_total)}</strong></p>
      </section>

      {!!terms.length && (
        <section className="customer-offer-terms">
          <h2>Terms and conditions</h2>
          <dl>{terms.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        </section>
      )}
      <p className="customer-offer-footnote">This offer is specific to the products and quantities listed above.</p>
    </div>
  );
}