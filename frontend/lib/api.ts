const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

export const getProducts = async (params?: any) => {
  const response = await fetch(`${API_URL}/search/products?${new URLSearchParams(params as any)}`);
  return response.json();
};

export const getProductBySku = async (sku: string) => {
  const response = await fetch(`${API_URL}/products/${sku}`);
  return response.json();
};

export const importExcel = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_URL}/excel-import/import-excel`, {
    method: "POST",
    body: formData,
  });
  return response.json();
};
