import { notFound, redirect } from "next/navigation";
import { ProductDetails } from "@/components/ProductDetails";
import { getProductBySku } from "@/lib/products";
import type { Metadata } from "next";
import { getAbsoluteUrl } from "@/lib/categories";

type Props = {
  params: {
    category: string;
    sku: string;
  };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySku(params.sku);
  if (!product) return { title: "Product Not Found | Lighting House", robots: { index: false } };

  const title = `${product.name} | Lighting House`;
  const description = product.description?.trim() || `Shop ${product.name} at Lighting House.`;
  const canonical = getAbsoluteUrl(
    `/products/${encodeURIComponent(product.category)}/${encodeURIComponent(product.sku)}`
  );

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title,
      description,
      url: canonical,
      siteName: "Lighting House",
      images: product.image_url ? [{ url: product.image_url, alt: product.name }] : undefined,
    },
    twitter: {
      card: product.image_url ? "summary_large_image" : "summary",
      title,
      description,
      images: product.image_url ? [product.image_url] : undefined,
    },
  };
}

export default async function CategoryProductPage({ params }: Props) {
  const product = await getProductBySku(params.sku);

  if (!product) notFound();
  if (!product.category) notFound();
  if (product.category !== params.category) {
    redirect(`/products/${product.category}/${product.sku}`);
  }

  return <ProductDetails product={product} />;
}