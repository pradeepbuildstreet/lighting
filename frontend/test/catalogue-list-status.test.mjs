import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogueListStatus} from '../lib/catalogue-list-status.mjs';
test('unpublished is red even with warnings',()=>assert.equal(catalogueListStatus({published:false,visibility:{visible:false,reasons:['Not published']}}).tone,'red'));
test('published and visible without warnings is green',()=>assert.equal(catalogueListStatus({published:true,visibility:{visible:true,reasons:[]}}).tone,'green'));
test('published with validation warnings is amber',()=>assert.equal(catalogueListStatus({published:true,visibility:{visible:false,reasons:['Primary image required']}}).tone,'amber'));
test('non-blocking compatibility warnings also produce amber',()=>assert.equal(catalogueListStatus({published:true,visibility:{visible:true,reasons:[],compatibility_warnings:['Compatibility unavailable']}}).tone,'amber'));
test('unknown visibility is not green',()=>assert.equal(catalogueListStatus({published:true}).tone,'amber'));
test('warnings are deduplicated and summary identifies inactive products',()=>{const s=catalogueListStatus({published:true,is_active:false,visibility:{visible:false,reasons:['Inactive'],compatibility_warnings:['Inactive']}});assert.deepEqual(s.warnings,['Inactive']);assert.match(s.summary,/Inactive/);});
