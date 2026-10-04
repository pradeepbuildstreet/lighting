import { notFound, redirect } from "next/navigation";
import { getProductBySku } from "@/lib/products";

type Props = {
  params: {
    category: string;
  };
};

export default async function LegacyProductDetailsPage({ params }: Props) {
  const product = await getProductBySku(params.category);

  if (!product?.category) notFound();

  redirect(`/products/${product.category}/${product.sku}`);
}