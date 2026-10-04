'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getImageSrc } from '@/lib/image-url';

interface Product {
  sku: string;
  name: string;
  price: number;
  wattage: number;
  lumens: number;
  color_temperature: number;
  material: string;
  style: string;
  category: string;
  image_url: string;
}

export default function ProductGridClient({ category }: { category: string }) {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      const params = new URLSearchParams(searchParams.toString());
      params.set('category', category);

      const response = await fetch(`http://localhost:3001/api/search/products?${params}`);
      const data = await response.json();
      setProducts(data.products || []);
      setLoading(false);
    };

    fetchProducts();
  }, [searchParams, category]);

  if (loading) return <div className="text-center py-8">Loading products...</div>;

  if (products.length === 0) {
    return <div className="text-center py-8 bg-gray-100 rounded-lg">No products found in this category.</div>;
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      {products.map((product) => (
        <a key={product.sku} href={`/products/${product.category}/${product.sku}`} className="product-card bg-white rounded-lg shadow overflow-hidden">
          <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
            {product.image_url ? <img src={getImageSrc(product.image_url)} alt={product.name} className="w-full h-full object-cover" /> : <span>No Image</span>}
          </div>
          <div className="p-4">
            <h3 className="font-semibold text-lg mb-2">{product.name}</h3>
            <p className="text-red-500 font-bold">{product.price}₹</p>
            <div className="text-sm text-gray-600 mt-2">
              <span>{product.wattage}W</span> | <span className="ml-2">{product.lumens}lm</span> | <span className="ml-2">{product.color_temperature}K</span>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}