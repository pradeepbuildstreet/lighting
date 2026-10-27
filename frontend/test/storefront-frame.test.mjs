import test from 'node:test';
import assert from 'node:assert/strict';
import {usesStorefrontFrame} from '../lib/storefront-frame.mjs';
test('customer routes share the full-width frame',()=>{for(const path of ['/','/wishlist','/products','/categories/commercial/panels','/catalogue','/item/sku','/collections/trial','/brands/trial','/variants/trial','/articles/trial','/guides/trial','/pages/about','/landing/trial','/future-public-page'])assert.equal(usesStorefrontFrame(path),true,path);});
test('admin API and printable offer routes retain their layouts',()=>{for(const path of ['/admin','/admin/products','/api/catalogue','/offer','/offer/token'])assert.equal(usesStorefrontFrame(path),false,path);});
test('route matching respects path boundaries',()=>{assert.equal(usesStorefrontFrame('/administrator'),true);assert.equal(usesStorefrontFrame('/offers'),true);assert.equal(usesStorefrontFrame(null),false);assert.equal(usesStorefrontFrame(''),false);});
