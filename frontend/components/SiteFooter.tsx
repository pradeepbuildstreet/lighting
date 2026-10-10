import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";

const phoneNumbers = ["9600096298", "8124969000"];
const email = "pradeep33.tcs@gmail.com";
const showrooms = [
  {
    name: "LED Zone",
    address: "No 10, Ratan Bazaar, Evening Bazaar, Tamil Nadu",
    directions: "https://maps.app.goo.gl/t5Sg3MG2oLgyoBX26",
  },
  {
    name: "HomeStory",
    address: "1/348, East Coast Rd, Anna Enclave, Injambakkam, Chennai, Tamil Nadu 600115",
    directions: "https://share.google/jrM4UJC2TDh3p9sga",
  },
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer-grid">
          <div className="site-footer-brand">
            <Link href="/" className="footer-wordmark" aria-label="Luminoza home"><img src="/luminoza-logo-light.svg" alt="Luminoza" /></Link>
            <p className="site-footer-tagline">Beautiful lighting! Exuberant living!</p>
            <Link href="/products" className="footer-shop-link">Explore the collection <span aria-hidden="true">↗</span></Link>
          </div>

          <div className="site-footer-column">
            <h2>Contact</h2>
            {phoneNumbers.map((phone) => <a href={`tel:+91${phone}`} key={phone}><Phone size={16} aria-hidden="true" />+91 {phone}</a>)}
            <a href={`mailto:${email}`}><Mail size={16} aria-hidden="true" />{email}</a>
          </div>

          <div className="site-footer-column site-footer-address">
            <h2>Showrooms</h2>
            {showrooms.map((showroom) => (
              <div className="site-footer-showroom" key={showroom.name}>
                <strong><MapPin size={16} aria-hidden="true" />{showroom.name}</strong>
                <p>{showroom.address}</p>
                <a href={showroom.directions} target="_blank" rel="noreferrer">Get directions <span aria-hidden="true">↗</span></a>
              </div>
            ))}
          </div>
        </div>

        <div className="site-footer-bottom">
          <span>© {new Date().getFullYear()} Luminoza</span>
          <span>Beautiful lighting! Exuberant living!</span>
        </div>
      </div>
    </footer>
  );
}