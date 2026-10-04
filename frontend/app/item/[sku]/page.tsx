import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: { sku: string } }) {
  // Mock product data - replace with API call
  const product = {
    sku: params.sku,
    name: "Modern Pendant Light DL-001",
    description: "Elegant modern pendant light with brass finish",
    price: 2999,
    wattage: 12,
    lumens: 1200,
    color_temperature: 3000,
    material: "brass",
    style: "modern",
    image_url: "/uploads/dl001.jpg"
  };

  return {
    title: `${product.name} - ${product.price}₹ | Decorative Lighting`,
    description: `${product.description} | Wattage: ${product.wattage}W, Lumens: ${product.lumens}, Color: ${product.color_temperature}K, Material: ${product.material}`,
    keywords: `${product.name}, ${product.style} light, ${product.material} lighting, ${product.color_temperature}K LED`,
    openGraph: {
      title: product.name,
      description: product.description,
      images: [{ url: product.image_url }]
    }
  };
}

export default async function ProductPage({ params }: { params: { sku: string } }) {
  // Mock product - replace with API call
  const product = {
    sku: params.sku,
    name: "Modern Pendant Light DL-001",
    description: "Elegant modern pendant light with brass finish, perfect for dining rooms and living spaces. Features energy-efficient LED technology.",
    price: 2999,
    wattage: 12,
    lumens: 1200,
    color_temperature: 3000,
    material: "brass",
    style: "modern",
    category: "ceiling",
    image_url: "/uploads/dl001.jpg",
    optional_attributes: {
      brand: "LuxLight",
      ip_rating: 20,
      voltage: 220,
      beam_angle: 90,
      mounting_type: "pendant",
      smart_compatible: true,
      warranty: "2 years"
    }
  };

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "sku": product.sku,
    "description": product.description,
    "brand": product.optional_attributes.brand,
    "offers": {
      "@type": "Offer",
      "price": product.price,
      "priceCurrency": "INR",
      "availability": "https://schema.org/InStock"
    },
    "image": product.image_url,
    "wattage": product.wattage,
    "lumens": product.lumens
  };

  return (
    <div className="container py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />

      <div className="grid grid-cols-2 gap-8">
        {/* Product Image */}
        <div>
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full rounded-lg shadow-lg"
          />
        </div>

        {/* Product Details */}
        <div>
          <h1 className="text-4xl font-bold mb-4">{product.name}</h1>
          <p className="text-3xl text-accent font-bold mb-6">{product.price}₹</p>

          <p className="text-gray-600 mb-6">{product.description}</p>

          {/* Key Attributes */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <span className="text-gray-600">Wattage:</span>
              <span className="font-semibold ml-2">{product.wattage}W</span>
            </div>
            <div>
              <span className="text-gray-600">Lumens:</span>
              <span className="font-semibold ml-2">{product.lumens}</span>
            </div>
            <div>
              <span className="text-gray-600">Color Temp:</span>
              <span className="font-semibold ml-2">{product.color_temperature}K</span>
            </div>
            <div>
              <span className="text-gray-600">Material:</span>
              <span className="font-semibold ml-2">{product.material}</span>
            </div>
            <div>
              <span className="text-gray-600">Style:</span>
              <span className="font-semibold ml-2">{product.style}</span>
            </div>
            <div>
              <span className="text-gray-600">Warranty:</span>
              <span className="font-semibold ml-2">{product.optional_attributes.warranty}</span>
            </div>
          </div>

          {/* Add to Cart */}
          <button className="bg-accent text-white px-8 py-4 rounded-lg font-semibold w-full hover:bg-opacity-90">
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
