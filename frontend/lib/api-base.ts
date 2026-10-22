// Browser routing stays same-origin; server fetches use a configured internal origin.
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') return '/api';
  const origin = process.env.INTERNAL_API_ORIGIN || (process.env.NODE_ENV !== 'production' ? 'http://127.0.0.1:3000' : '');
  if (!origin) throw new Error('INTERNAL_API_ORIGIN is required for server-side API requests');
  return `${origin.replace(/\/$/, '')}/api`;
}
export const API_BASE_URL = getApiBaseUrl();
export const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || '';
export function getAbsoluteUrl(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Expected internal root-relative path');
  const origin = SITE_ORIGIN || (typeof window !== 'undefined' ? window.location.origin : '');
  if (!origin) throw new Error('SITE_URL / NEXT_PUBLIC_SITE_URL is required for absolute metadata URLs');
  return new URL(path, origin).toString();
}
