"use strict";
const path = require('node:path');
function loadConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  function integer(key, fallback, min, max) {
    const value = Number(env[key] ?? fallback);
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid ${key}`);
    return value;
  }
  const databaseUrl = env.CATALOG_DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const db = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(db.protocol)) throw new Error('DATABASE_URL must be PostgreSQL');
  const siteUrl = env.SITE_URL || env.FRONTEND_ORIGIN?.split(',')[0]?.trim() || (production ? '' : 'http://localhost:3001');
  if (!siteUrl) throw new Error('SITE_URL is required in production');
  const site = new URL(siteUrl);
  if (!['http:','https:'].includes(site.protocol) || (production && site.protocol !== 'https:')) throw new Error('Invalid SITE_URL scheme');
  if (site.pathname !== '/' || site.search || site.hash || site.username || site.password) throw new Error('SITE_URL must be an origin, not a path');
  const origins = (env.FRONTEND_ORIGIN || site.origin).split(',').map(x => x.trim()).filter(Boolean);
  for (const origin of origins) if (new URL(origin).origin !== origin) throw new Error('FRONTEND_ORIGIN values must be origins');
  if (production && (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32)) throw new Error('Production AUTH_SECRET must contain at least 32 characters');
  const rawTrust = env.TRUST_PROXY || 'false';
  if (rawTrust === 'true') throw new Error('Do not trust all proxies. Specify loopback, IP/CIDR or a verified hop count');
  const trustProxy = rawTrust === 'false' ? false : /^\d+$/.test(rawTrust) ? Number(rawTrust) : rawTrust;
  const mediaRoot = env.MEDIA_STORAGE_ROOT || path.resolve(__dirname,'../../var/media');
  if (!path.isAbsolute(mediaRoot)) throw new Error('MEDIA_STORAGE_ROOT must be an absolute path');
  return Object.freeze({production,databaseUrl,siteOrigin:site.origin,origins,trustProxy,mediaRoot,
    port:integer('PORT',3000,1,65535),host:env.HOST || '127.0.0.1',
    poolMax:integer('DB_POOL_MAX',10,1,100),dbTimeout:integer('DB_CONNECT_TIMEOUT_MS',5000,100,60000)});
}
module.exports = {loadConfig};
