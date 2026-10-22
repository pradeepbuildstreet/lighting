const ABSOLUTE_URL = /^[a-z][a-z\d+.-]*:/i;
const LEGACY_UPLOAD_PREFIX = /^\/?(?:uploads\/)+/i;

export function getImageSrc(imageUrl?: string | null): string | undefined {
  if (!imageUrl) return undefined;

  // Formatting must not change the origin of an absolute or network-path URL.
  if (ABSOLUTE_URL.test(imageUrl) || imageUrl.startsWith("//")) {
    return imageUrl;
  }

  const suffixIndex = imageUrl.search(/[?#]/);
  const pathname = suffixIndex === -1 ? imageUrl : imageUrl.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? "" : imageUrl.slice(suffixIndex);
  const normalizedPath = pathname.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  const uploadsPath = normalizedPath.replace(LEGACY_UPLOAD_PREFIX, "");

  return uploadsPath === normalizedPath ? imageUrl : `/uploads/${uploadsPath}${suffix}`;
}
