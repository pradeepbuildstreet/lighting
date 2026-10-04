import Link from "next/link";
import { Mail, MapPin, Phone, Pin } from "lucide-react";

const phone = process.env.NEXT_PUBLIC_STORE_PHONE;
const email = process.env.NEXT_PUBLIC_STORE_EMAIL;
const address = process.env.NEXT_PUBLIC_STORE_ADDRESS;
const mapEmbedUrl = process.env.NEXT_PUBLIC_STORE_MAP_EMBED_URL;
const mapUrl = address
  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
  : undefined;
const iframeUrl = mapEmbedUrl || (address
  ? `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`
  : undefined);

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer-grid">
          <div className="site-footer-brand">
            <Link href="/" className="footer-wordmark">LIGHTING HOUSE<span>.</span></Link>
            <p>Thoughtful lighting for the places that feel like home.</p>
            <Link href="/products" className="footer-shop-link">Explore the collection <span aria-hidden="true">↗</span></Link>
          </div>

          <div className="site-footer-column">
            <h2>Contact</h2>
            {phone ? (
              <a href={`tel:${phone}`}><Phone size={16} aria-hidden="true" />{phone}</a>
            ) : (
              <p><Phone size={16} aria-hidden="true" />Phone details coming soon</p>
            )}
            {email ? (
              <a href={`mailto:${email}`}><Mail size={16} aria-hidden="true" />{email}</a>
            ) : (
              <p><Mail size={16} aria-hidden="true" />Email details coming soon</p>
            )}
          </div>

          <div className="site-footer-column site-footer-address">
            <h2>Find us</h2>
            <p><MapPin size={17} aria-hidden="true" />{address || "Store address coming soon"}</p>
            {mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer">Open in Google Maps <span aria-hidden="true">↗</span></a>}
          </div>

          <div className="site-footer-map" aria-label="Store map">
            {iframeUrl ? (
              <iframe
                src={iframeUrl}
                title="Map showing the store location"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="site-map-pending">
                <Pin size={25} aria-hidden="true" />
                <span>Store location</span>
                <small>Map coming soon</small>
              </div>
            )}
          </div>
        </div>

        <div className="site-footer-bottom">
          <span>© {new Date().getFullYear()} Lighting House</span>
          <span>Made for brighter everyday living</span>
        </div>
      </div>
    </footer>
  );
}