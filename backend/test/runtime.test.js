const test=require('node:test');const assert=require('node:assert/strict');
const {loadConfig}=require('../config/runtime');
const env={CATALOG_DATABASE_URL:'postgresql://user:pass@127.0.0.1:5432/test',MEDIA_STORAGE_ROOT:require('node:path').resolve('test-media')};
test('development config',()=>assert.equal(loadConfig(env).port,3000));
test('database required',()=>assert.throws(()=>loadConfig({}),/CATALOG_DATABASE_URL/));
test('invalid database scheme',()=>assert.throws(()=>loadConfig({...env,CATALOG_DATABASE_URL:'https://example.com'}),/PostgreSQL/));
test('invalid port',()=>assert.throws(()=>loadConfig({...env,PORT:'NaN'}),/PORT/));
test('relative media root rejected',()=>assert.throws(()=>loadConfig({...env,MEDIA_STORAGE_ROOT:'relative'}),/absolute/));
test('trust all proxies rejected',()=>assert.throws(()=>loadConfig({...env,TRUST_PROXY:'true'}),/trust all/));
test('production requires secret',()=>assert.throws(()=>loadConfig({...env,NODE_ENV:'production',SITE_URL:'https://luminoza.in'}),/AUTH_SECRET/));
test('production https',()=>assert.throws(()=>loadConfig({...env,NODE_ENV:'production',SITE_URL:'http://luminoza.in',AUTH_SECRET:'x'.repeat(40)}),/scheme/));
test('explicit production configuration',()=>assert.equal(loadConfig({...env,NODE_ENV:'production',SITE_URL:'https://luminoza.in',AUTH_SECRET:'x'.repeat(40),TRUST_PROXY:'loopback'}).siteOrigin,'https://luminoza.in'));

test('obsolete setting is not a fallback',()=>assert.throws(()=>loadConfig({['DATABASE'+'_URL']:'postgresql://x:y@localhost/db'}),/CATALOG_DATABASE_URL/));
test('only catalogue setting is read',()=>assert.equal(loadConfig({...env,['DATABASE'+'_URL']:'https://invalid.example'}).databaseUrl,env.CATALOG_DATABASE_URL));
