import "./globals.css";
import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { SITE_ORIGIN } from "@/lib/categories";
import { WishlistProvider } from "@/components/WishlistProvider";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: "Decorative Lighting Store | Premium Lighting Solutions",
  description: "Discover our collection of decorative lighting including pendant lights, wall sconces, ceiling lights, and table lamps",
  keywords: "decorative lighting, pendant lights, wall sconces, ceiling lights, LED lamps, modern lighting",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <WishlistProvider>
          <SiteHeader />
          <main className="site-main">{children}</main>
          <SiteFooter />
        </WishlistProvider>
      </body>
    </html>
  );
}
