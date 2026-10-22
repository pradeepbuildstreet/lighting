"use client";

import { useState } from "react";
import { Heart, LoaderCircle } from "lucide-react";
import { useWishlist } from "@/components/WishlistProvider";

export function WishlistButton({
  sku,
  productId,
  name,
  wishlistCount,
  compact = false,
}: {
  sku: string;
  productId?: string;
  name: string;
  wishlistCount?: number;
  compact?: boolean;
}) {
  const { wishlist, loading, addProduct, removeProduct } = useWishlist();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const item = wishlist?.items.find((wishlistItem) => !!productId && wishlistItem.product_id === productId);
  const startsNewWishlist = !!wishlist && wishlist.status !== "draft";

  const handleToggle = async () => {
    setBusy(true);
    setError("");
    try {
      if (item && !startsNewWishlist) await removeProduct(productId!);
      else await addProduct(productId!);
    } catch (caught) {
      setError(caught instanceof Error && caught.name === "AbortError"
        ? "The request timed out. Check your connection and try again."
        : caught instanceof Error ? caught.message : "Could not update wishlist.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className={`wishlist-button-wrap ${compact ? "is-compact" : ""}`}>
      <button
        type="button"
        className={`wishlist-add-button ${item ? "is-added" : ""}`}
        aria-busy={busy}
        aria-label={startsNewWishlist ? `Start a new wishlist and add ${name}` : item ? `Remove ${name} from wishlist` : `Add ${name} to wishlist`}
        title={!productId ? "Open the current catalogue product to add it to your wishlist" : startsNewWishlist ? "Start a new wishlist" : item ? "Remove from wishlist" : "Add to wishlist"}
        disabled={loading || busy || !productId}
        onClick={() => void handleToggle()}
      >
        {busy
          ? <LoaderCircle className="wishlist-loader-icon" size={compact ? 19 : 20} aria-hidden="true" />
          : <Heart size={compact ? 19 : 20} fill={item ? "currentColor" : "none"} aria-hidden="true" />}
      </button>
      {typeof wishlistCount === "number" && (<span className="wishlist-popularity" aria-label={`Wishlisted ${wishlistCount} times by all customers`}>
        {wishlistCount} wishlisted
      </span>)}
      {error && <span className="wishlist-button-error" role="status">{error}</span>}
    </span>
  );
}