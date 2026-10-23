"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
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
  const { wishlist, loading, isProductSelected, isSelectionPending, setProductSelected } = useWishlist();
  const [error, setError] = useState("");
  const selected = !!productId && isProductSelected(productId);
  const busy = !!productId && isSelectionPending(productId);
  const startsNewWishlist = !!wishlist && wishlist.status !== "draft";

  const handleToggle = async () => {
    if (!productId || loading) return;
    setError("");
    try {
      await setProductSelected(productId, !isProductSelected(productId));
    } catch (caught) {
      setError(caught instanceof Error && caught.name === "AbortError"
        ? "The save timed out. Reload the page to check saved selections before submitting."
        : caught instanceof Error ? caught.message : "Could not update wishlist. Reload to check saved selections.");
    }
  };

  return (
    <span className={`wishlist-button-wrap ${compact ? "is-compact" : ""}`}>
      <button
        type="button"
        className={`wishlist-add-button ${selected ? "is-added" : ""}`}
        aria-busy={busy}
        aria-pressed={selected}
        aria-label={selected ? `Remove ${name} from wishlist` : startsNewWishlist ? `Start a new wishlist and add ${name}` : `Add ${name} to wishlist`}
        title={!productId ? "Open the current catalogue product to add it to your wishlist" : busy ? "Saving selection; click again to change it" : selected ? "Remove from wishlist" : startsNewWishlist ? "Start a new wishlist" : "Add to wishlist"}
        disabled={loading || !productId}
        onClick={() => void handleToggle()}
      >
        <Heart size={compact ? 19 : 20} fill={selected ? "currentColor" : "none"} aria-hidden="true" />
      </button>
      {typeof wishlistCount === "number" && (<span className="wishlist-popularity" aria-label={`Wishlisted ${wishlistCount} times by all customers`}>
        {wishlistCount} wishlisted
      </span>)}
      {error && <span className="wishlist-button-error" role="status">{error}</span>}
    </span>
  );
}
