"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/categories";

type ProductAnalytics = {
  sku: string;
  name: string;
  price: number;
  category_slug?: string;
  wishlist_count: number;
  wishlist_sessions: number;
  submitted_enquiries: number;
  last_wishlisted_at?: string | null;
};

export function WishlistAnalytics() {
  const [products, setProducts] = useState<ProductAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE_URL}/wishlists/admin/analytics`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load wishlist analytics.");
        setProducts(data.products || []);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load wishlist analytics."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading wishlist analytics...</p>;
  if (error) return <p className="manager-error" role="alert">{error}</p>;

  return (
    <div className="enquiry-table-wrap">
      <table className="enquiry-table wishlist-analytics-table">
        <thead>
          <tr><th>Product</th><th>Category</th><th>Price</th><th>Wishlists</th><th>Enquiries</th><th>Last interest</th></tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.sku}>
              <td data-label="Product">
                <Link href={product.category_slug ? `/products/${product.category_slug}/${product.sku}` : "/products"}>{product.name}</Link>
                <small>{product.sku}</small>
              </td>
              <td data-label="Category">{product.category_slug || "Uncategorised"}</td>
              <td data-label="Price">₹{product.price}</td>
              <td data-label="Wishlists"><strong>{product.wishlist_count}</strong></td>
              <td data-label="Enquiries">{product.submitted_enquiries}</td>
              <td data-label="Last interest">{product.last_wishlisted_at ? new Date(product.last_wishlisted_at).toLocaleDateString("en-IN") : "Never"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!products.length && <p className="manager-empty">No active products to report.</p>}
    </div>
  );
}