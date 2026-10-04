"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/categories";

export type WishlistItem = {
  sku: string;
  name: string;
  price: number;
  image_url?: string;
  category_slug?: string;
  add_count: number;
};

export type Wishlist = {
  id: string;
  share_token: string;
  status: "draft" | "submitted" | "contacted" | "closed";
  updated_at: string;
  customer_name?: string | null;
  mobile_number?: string | null;
  email?: string | null;
  pin_code?: string | null;
  requirements?: string | null;
  submitted_at?: string | null;
  items: WishlistItem[];
};

type WishlistContextValue = {
  wishlist: Wishlist | null;
  sessionId: string | null;
  loading: boolean;
  addProduct: (sku: string) => Promise<Wishlist>;
  removeProduct: (sku: string) => Promise<void>;
  submitEnquiry: (details: {
    name: string;
    mobile_number: string;
    email: string;
    pin_code: string;
    requirements: string;
  }) => Promise<Wishlist>;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);
const SESSION_KEY = "lighting-house-wishlist-session";

async function responseData(response: Response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Wishlist request failed.");
  return data;
}

async function fetchWishlist(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [wishlist, setWishlist] = useState<Wishlist | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const existingSession = window.localStorage.getItem(SESSION_KEY);
    const nextSession = existingSession || window.crypto.randomUUID();
    if (!existingSession) window.localStorage.setItem(SESSION_KEY, nextSession);
    setSessionId(nextSession);

    fetchWishlist(`${API_BASE_URL}/wishlists/session`, { headers: { "x-wishlist-session": nextSession } })
      .then(responseData)
      .then((data) => setWishlist(data.wishlist))
      .catch(() => setWishlist(null))
      .finally(() => setLoading(false));
  }, []);

  const addProduct = async (sku: string) => {
    let activeSessionId = sessionId;
    if (!activeSessionId) throw new Error("Wishlist is still loading.");
    if (wishlist && wishlist.status !== "draft") {
      activeSessionId = window.crypto.randomUUID();
      window.localStorage.setItem(SESSION_KEY, activeSessionId);
      setSessionId(activeSessionId);
      setWishlist(null);
    }

    const data = await responseData(await fetchWishlist(`${API_BASE_URL}/wishlists/session/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-wishlist-session": activeSessionId },
      body: JSON.stringify({ sku }),
    }));
    setWishlist(data.wishlist);
    return data.wishlist as Wishlist;
  };

  const removeProduct = async (sku: string) => {
    if (!sessionId) throw new Error("Wishlist is still loading.");
    const data = await responseData(await fetchWishlist(
      `${API_BASE_URL}/wishlists/session/items/${encodeURIComponent(sku)}`,
      { method: "DELETE", headers: { "x-wishlist-session": sessionId } }
    ));
    setWishlist(data.wishlist);
  };

  const submitEnquiry: WishlistContextValue["submitEnquiry"] = async (details) => {
    if (!sessionId) throw new Error("Wishlist is still loading.");
    const data = await responseData(await fetchWishlist(`${API_BASE_URL}/wishlists/session/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-wishlist-session": sessionId },
      body: JSON.stringify(details),
    }));
    setWishlist(data.wishlist);
    return data.wishlist as Wishlist;
  };

  return (
    <WishlistContext.Provider value={{ wishlist, sessionId, loading, addProduct, removeProduct, submitEnquiry }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) throw new Error("useWishlist must be used within WishlistProvider.");
  return context;
}