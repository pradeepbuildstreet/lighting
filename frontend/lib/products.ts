import { API_BASE_URL } from "@/lib/categories";

export type Product = {
  sku: string;
  name: string;
  description: string;
  price: number;
  wattage: number;
  lumens: number;
  color_temperature: number;
  material: string;
  style: string;
  category: string;
  category_name: string;
  category_path: { slug: string; name: string }[];
  wishlist_count: number;
  optional_attributes?: { brand?: string | null };
  image_url?: string;
};

export async function getProductBySku(sku: string): Promise<Product | null> {
  const response = await fetch(
    `${API_BASE_URL}/search/product/${encodeURIComponent(sku)}`,
    { cache: "no-store" }
  );

  if (!response.ok) return null;

  const data = await response.json();
  return data.product ?? null;
}