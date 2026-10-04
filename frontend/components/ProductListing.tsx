"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getImageSrc } from "@/lib/image-url";
import { API_BASE_URL } from "@/lib/categories";
import { WishlistButton } from "@/components/WishlistButton";

type Product = {
  id: string;
  sku: string;
  name: string;
  price: number;
  wattage: number;
  color_temperature: number;
  category?: string;
  image_url?: string;
  wishlist_count: number;
};

export function ProductListing({ categorySlug }: { categorySlug?: string }) {
  const searchParams = useSearchParams();
  const paramsString = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (!params.has("category") && categorySlug) params.set("category", categorySlug);
    return params.toString();
  }, [categorySlug, searchParams]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/search/products?${paramsString}`);
        const data = await res.json();
        console.log("Fetched products:", data.products);
        setProducts(data.products || []);
      } catch (error) {
        console.error(error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [paramsString]);

  if (loading) return <div>Loading products...</div>;
  if (!products.length) return <div>No products found.</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {products.map((product) => (
        <article key={product.id} className="product-result-card">
          <Link
            prefetch={false}
            href={
            product.category
              ? `/products/${product.category}/${product.sku}`
              : `/products/${product.sku}`
            }
            className="product-result-link"
          >
            <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
              {product.image_url ? (
                <img
                  src={getImageSrc(product.image_url)}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-gray-500">No Image</span>
              )}
            </div>

            <div className="p-4">
              <h3 className="font-semibold text-lg mb-2">{product.name}</h3>
              <p className="font-bold">₹{product.price}</p>
              <div className="text-sm text-gray-600 mt-2">
                <span>{product.wattage}W</span> |{" "}
                <span className="ml-2">{product.color_temperature}K</span>
              </div>
            </div>
          </Link>
          <div className="product-result-wishlist">
            <WishlistButton sku={product.sku} name={product.name} wishlistCount={product.wishlist_count} compact />
          </div>
        </article>
      ))}
    </div>
  );
}