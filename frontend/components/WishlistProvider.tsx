"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "@/lib/api-base";

import { createWishlistQueue } from "@/lib/wishlist-quantity.mjs";

import type { WishlistMedia } from "@/lib/wishlist-product";

export type WishlistItem = {
  product_id: string;
  currency?: string;
  media?: WishlistMedia[];
  product_href?: string | null;
  catalogue_revision?: string | null;
  sku: string;
  name: string;
  price: number;
  image_url?: string | null;
  category_slug?: string | null;
  quantity: number;
  /** Legacy storage alias. Requested units use quantity. */
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
  pendingMutations: number;
  updateQuantity: (productId: string, quantity: number) => Promise<Wishlist>;
  addProduct: (productId: string) => Promise<Wishlist>;
  removeProduct: (productId: string) => Promise<void>;
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
  const [pendingMutations, setPendingMutations] = useState(0);
  const activeSession = useRef<string | null>(null);
  const currentWishlist = useRef<Wishlist | null>(null);
  const queue = useRef(createWishlistQueue());
  const failedQuantities = useRef(new Set<string>());
  function remember(next: Wishlist | null) { currentWishlist.current = next; setWishlist(next); }
  function mutate<T,>(work: () => Promise<T>): Promise<T> {
    setPendingMutations(count => count + 1);
    return queue.current.run(work).finally(() => setPendingMutations(count => count - 1));
  }
  function requireSession() {
    if (!activeSession.current) throw new Error("Wishlist is still loading.");
    return activeSession.current;
  }

  useEffect(() => {
    let active = true;
    const existingSession = window.localStorage.getItem(SESSION_KEY);
    const nextSession = existingSession || window.crypto.randomUUID();
    if (!existingSession) window.localStorage.setItem(SESSION_KEY, nextSession);
    activeSession.current = nextSession;
    setSessionId(nextSession);

    fetchWishlist(`${API_BASE_URL}/wishlists/session`, { headers: { "x-wishlist-session": nextSession } })
      .then(responseData)
      .then((data) => { if (active) remember(data.wishlist); })
      .catch(() => { if (active) remember(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const addProduct = (productId: string) => mutate(async () => {
    let activeSessionId = requireSession();
    if (currentWishlist.current && currentWishlist.current.status !== "draft") {
      activeSessionId = window.crypto.randomUUID();
      window.localStorage.setItem(SESSION_KEY, activeSessionId);
      activeSession.current = activeSessionId;
      setSessionId(activeSessionId);
      remember(null);
      failedQuantities.current.clear();
    }
    const data = await responseData(await fetchWishlist(`${API_BASE_URL}/wishlists/session/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-wishlist-session": activeSessionId },
      body: JSON.stringify({ product_id: productId }),
    }));
    remember(data.wishlist);
    return data.wishlist as Wishlist;
  });
  const updateQuantity = (productId: string, quantity: number) => mutate(async () => {
    try {
      const data = await responseData(await fetchWishlist(
        `${API_BASE_URL}/wishlists/session/items/${encodeURIComponent(productId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-wishlist-session": requireSession() },
          body: JSON.stringify({ quantity }),
        }
      ));
      remember(data.wishlist);
      failedQuantities.current.delete(productId);
      return data.wishlist as Wishlist;
    } catch (error) { failedQuantities.current.add(productId); throw error; }
  });
  const removeProduct = (productId: string) => mutate(async () => {
    const data = await responseData(await fetchWishlist(
      `${API_BASE_URL}/wishlists/session/items/${encodeURIComponent(productId)}`,
      { method: "DELETE", headers: { "x-wishlist-session": requireSession() } }
    ));
    failedQuantities.current.delete(productId);
    remember(data.wishlist);
  });
  const submitEnquiry: WishlistContextValue["submitEnquiry"] = (details) => mutate(async () => {
    if (failedQuantities.current.size) throw new Error("Retry failed quantity changes before submitting the enquiry.");
    const data = await responseData(await fetchWishlist(`${API_BASE_URL}/wishlists/session/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-wishlist-session": requireSession() },
      body: JSON.stringify(details),
    }));
    remember(data.wishlist);
    return data.wishlist as Wishlist;
  });

  return (
    <WishlistContext.Provider value={{ wishlist, sessionId, loading, pendingMutations, addProduct, updateQuantity, removeProduct, submitEnquiry }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) throw new Error("useWishlist must be used within WishlistProvider.");
  return context;
}