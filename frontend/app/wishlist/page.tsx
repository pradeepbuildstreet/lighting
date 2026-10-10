import type { Metadata } from "next";
import { WishlistClient } from "./WishlistClient";

export const metadata: Metadata = {
  title: "My Wishlist | Luminoza",
  robots: { index: false, follow: false },
};

export default function WishlistPage() {
  return <WishlistClient />;
}