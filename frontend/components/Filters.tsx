"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { API_BASE_URL } from "@/lib/categories";

type CategoryOption = { slug: string; name: string; href: string };

type OptionsMap = {
  brand: string[];
  style: string[];
  material: string[];
  color_temperature: string[];
  wattage: string[];
};

export function Filters({
  categorySlug,
  categoryOptions,
  categoryContextName,
}: {
  categorySlug?: string;
  categoryOptions: CategoryOption[];
  categoryContextName?: string;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [options, setOptions] = useState<OptionsMap>({
    brand: [],
    style: [],
    material: [],
    color_temperature: [],
    wattage: [],
  });

  const [filters, setFilters] = useState({
    category: "",
    brand: "",
    style: "",
    material: "",
    color_temperature: "",
    wattage_min: "",
    wattage_max: "",
    price_min: "",
    price_max: "",
  });

  useEffect(() => {
    setFilters({
      category: searchParams.get("category") || categorySlug || "",
      brand: searchParams.get("brand") || "",
      style: searchParams.get("style") || "",
      material: searchParams.get("material") || "",
      color_temperature: searchParams.get("color_temperature") || "",
      wattage_min: searchParams.get("wattage_min") || "",
      wattage_max: searchParams.get("wattage_max") || "",
      price_min: searchParams.get("price_min") || "",
      price_max: searchParams.get("price_max") || "",
    });
  }, [categorySlug, searchParams]);

  useEffect(() => {
    const load = async () => {
      const attrs = ["brand", "style", "material", "color_temperature", "wattage"];
      const entries = await Promise.all(
        attrs.map(async (attr) => {
          const params = new URLSearchParams({ attribute: attr });
          if (categorySlug) params.set("category", categorySlug);
          const res = await fetch(
            `${API_BASE_URL}/search/filters/options?${params.toString()}`
          );
          const data = await res.json();
          return [attr, data.options || []] as const;
        })
      );
      setOptions(Object.fromEntries(entries) as OptionsMap);
    };

    load();
  }, [categorySlug]);

  const updateField = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    const selectedCategory = categoryOptions.find((category) => category.slug === filters.category);

    Object.entries(filters).forEach(([key, value]) => {
      if (key === "category") params.delete(key);
      else if (value) params.set(key, value);
      else params.delete(key);
    });

    params.set("page", "1");
    const target = selectedCategory?.href || pathname;
    router.push(`${target}?${params.toString()}`);
  };

  const clearFilters = () => {
    setFilters({
      category: categorySlug || "",
      brand: "",
      style: "",
      material: "",
      color_temperature: "",
      wattage_min: "",
      wattage_max: "",
      price_min: "",
      price_max: "",
    });
    const target = categoryOptions.find((category) => category.slug === categorySlug)?.href || pathname;
    router.push(target);
  };

  return (
    <div className="filters-sidebar bg-gray-50 rounded-lg p-6">
      <h2 className="text-xl font-bold mb-4">Filters</h2>

      <div className="space-y-4">
        <div>
          <h3 className="font-semibold mb-2">Category</h3>
          <select
            value={filters.category}
            onChange={(e) => updateField("category", e.target.value)}
            className="w-full border rounded px-2 py-2"
          >
            <option value={categoryContextName ? categoryOptions[0]?.slug || "" : ""}>
              {categoryContextName ? `All ${categoryContextName}` : "All Categories"}
            </option>
            {categoryOptions
              .filter((item) => item.slug !== categoryOptions[0]?.slug || !categoryContextName)
              .map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Brand</h3>
          <select
            value={filters.brand}
            onChange={(e) => updateField("brand", e.target.value)}
            className="w-full border rounded px-2 py-2"
          >
            <option value="">All Brands</option>
            {options.brand.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Style</h3>
          <select
            value={filters.style}
            onChange={(e) => updateField("style", e.target.value)}
            className="w-full border rounded px-2 py-2"
          >
            <option value="">All Styles</option>
            {options.style.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Material</h3>
          <select
            value={filters.material}
            onChange={(e) => updateField("material", e.target.value)}
            className="w-full border rounded px-2 py-2"
          >
            <option value="">All Materials</option>
            {options.material.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Color Temperature</h3>
          <select
            value={filters.color_temperature}
            onChange={(e) => updateField("color_temperature", e.target.value)}
            className="w-full border rounded px-2 py-2"
          >
            <option value="">All</option>
            {options.color_temperature.map((item) => (
              <option key={item} value={item}>
                {item}K
              </option>
            ))}
          </select>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Price Range</h3>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Min"
              value={filters.price_min}
              onChange={(e) => updateField("price_min", e.target.value)}
              className="w-1/2 border rounded px-2 py-1"
            />
            <input
              type="number"
              placeholder="Max"
              value={filters.price_max}
              onChange={(e) => updateField("price_max", e.target.value)}
              className="w-1/2 border rounded px-2 py-1"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={applyFilters}
            className="flex-1 bg-black text-white rounded px-4 py-2"
          >
            Apply Filters
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="flex-1 border rounded px-4 py-2"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}