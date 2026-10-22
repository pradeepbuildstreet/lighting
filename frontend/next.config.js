const origin = process.env.INTERNAL_API_ORIGIN || (process.env.NODE_ENV !== 'production' ? 'http://127.0.0.1:3000' : '');
if (!origin) throw new Error('Set INTERNAL_API_ORIGIN before building the frontend');
const backend = new URL(origin);
if (!['http:','https:'].includes(backend.protocol) || backend.pathname !== '/' || backend.search || backend.hash || backend.username || backend.password) {
  throw new Error('INTERNAL_API_ORIGIN must be an HTTP(S) origin');
}
const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
const site = new URL(siteUrl);
const localBuild = process.env.LOCAL_BUILD === 'true';
const loopbackSite = ['localhost', '127.0.0.1', '[::1]'].includes(site.hostname);
const allowedLocalHttp = localBuild && loopbackSite && site.protocol === 'http:';

if (process.env.NODE_ENV === 'production' &&
    site.protocol !== 'https:' &&
    !allowedLocalHttp) {
  throw new Error('Production SITE_URL must use HTTPS; local HTTP requires LOCAL_BUILD=true and a loopback hostname');
}
const imageHosts = (process.env.IMAGE_REMOTE_HOSTS || '').split(',').map(x=>x.trim()).filter(Boolean);
module.exports = {
  reactStrictMode: true,
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  env: {NEXT_PUBLIC_SITE_URL:site.origin},
  images: {remotePatterns:imageHosts.map(hostname=>({protocol:'https',hostname}))},
  async rewrites() { return [
    {source:'/api/:path*',destination:`${backend.origin}/api/:path*`}
  ]; }
};
