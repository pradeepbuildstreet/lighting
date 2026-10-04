import Link from "next/link";
import { getImageSrc } from "@/lib/image-url";
import { API_BASE_URL, getAbsoluteUrl, getCategoryHref, getCategoryTree } from "@/lib/categories";

type GalleryProduct = {
  sku: string;
  name: string;
  category?: string;
  image_url?: string;
};

export const metadata = {
  title: "Decorative Lighting Store | Premium Lighting Solutions",
  description:
    "Discover our collection of decorative lighting including pendant lights, wall sconces, ceiling lights, and table lamps",
  alternates: { canonical: getAbsoluteUrl("/") },
  openGraph: {
    type: "website",
    title: "Lighting House | Decorative Lighting",
    description: "Shop lighting for every room, including decorative, false ceiling, solar, and wardrobe lights.",
    url: getAbsoluteUrl("/"),
    siteName: "Lighting House",
  },
};

async function getGalleryProducts(): Promise<GalleryProduct[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/search/products?page=1&limit=100`, {
      cache: "no-store",
    });
    if (!response.ok) return [];

    const data = await response.json();
    const available = (data.products || []).filter((product: GalleryProduct) => product.image_url);
    for (let index = available.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [available[index], available[swapIndex]] = [available[swapIndex], available[index]];
    }

    return Array.from({ length: 30 }, (_, index) => available[index % available.length]).filter(Boolean);
  } catch {
    return [];
  }
}

export default async function Home() {
  const [categories, galleryProducts] = await Promise.all([getCategoryTree(), getGalleryProducts()]);

  return (
    <>
      {galleryProducts.length > 0 && (
        <div className="home-random-gallery" aria-label="Lighting product gallery">
          {galleryProducts.map((product, index) => (
            <Link
              key={`${product.sku}-${index}`}
              href={product.category ? `/products/${encodeURIComponent(product.category)}/${encodeURIComponent(product.sku)}` : "/products"}
              className="home-random-gallery-item"
              aria-label={`View ${product.name}`}
            >
              <img
                src={getImageSrc(product.image_url) || product.image_url}
                alt={product.name}
                loading={index < 10 ? "eager" : "lazy"}
              />
            </Link>
          ))}
        </div>
      )}

      <div className="container">
      <section className="py-16 text-center">
        <h1 className="text-5xl font-bold mb-4">Decorative Lighting</h1>
        <p className="text-xl text-gray-600 mb-8">
          Transform your space with our premium collection of decorative lighting
        </p>
        <Link
          href="/products"
          className="bg-accent text-white px-8 py-3 rounded-lg font-semibold hover:bg-opacity-90"
        >
          Shop Now
        </Link>
      </section>

      <section className="py-12">
        <h2 className="text-3xl font-bold mb-8 text-center">Shop by Category</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {categories.map((category) => (
            <div key={category.id} className="home-category product-card bg-gray-100 rounded-lg p-6">
              <Link href={getCategoryHref(category)}>
                <h3 className="text-xl font-semibold mb-2">{category.name}</h3>
              </Link>
              <p className="text-gray-600">{category.product_count} products</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-12 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div>
            <h3 className="text-xl font-semibold mb-2">✓ Premium Quality</h3>
            <p className="text-gray-600">All lights certified for safety</p>
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-2">✓ Fast Delivery</h3>
            <p className="text-gray-600">3-5 days across India</p>
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-2">✓ 2 Year Warranty</h3>
            <p className="text-gray-600">On all electrical components</p>
          </div>
        </div>
      </section>
      </div>
    </>
  );
}