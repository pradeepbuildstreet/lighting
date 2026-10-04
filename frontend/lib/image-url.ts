export function getImageSrc(imageUrl?: string | null): string | undefined {
  if (!imageUrl) return undefined;

  let pathname = imageUrl;
  try {
    pathname = new URL(imageUrl, "http://localhost").pathname;
  } catch {
    return imageUrl;
  }

  const normalizedPath = pathname.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  const uploadsPath = normalizedPath.replace(/^\/?(?:uploads\/)+/i, "");

  return uploadsPath === normalizedPath ? imageUrl : `/uploads/${uploadsPath}`;
}