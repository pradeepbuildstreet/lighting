"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const {filename,verify,IMAGE_SIZE}=require('../services/dealer-enquiry-export');
const {makeZip,crc32}=require('../services/dealer-enquiry-zip');
test('dealer thumbnail doubles the existing 48-point PDF baseline',()=>assert.equal(IMAGE_SIZE,96));
test('filenames are dealer-prefixed, path-safe and distinct per dealer',()=>{const a={dealer_code:'A / Lighting',dealer_name:'Dealer A',dealer_id:'12345678-0000-0000-0000-000000000000'};const name=filename(a,'ABC12345');assert.match(name,/^A-Lighting-Dealer-A-/);assert.match(name,/\.pdf$/);assert.doesNotMatch(name,/[\\/]/);assert.notEqual(name,filename({...a,dealer_id:'12345678-0000-0000-0000-000000000001'},'ABC12345'));});
test('download accepts exactly the reviewed snapshot',()=>{const d={fingerprint:'a'.repeat(64)};assert.doesNotThrow(()=>verify(d,'a'.repeat(64)));assert.throws(()=>verify(d,'b'.repeat(64)),e=>e.status===409);assert.throws(()=>verify(d,''),e=>e.status===400);});
test('ZIP CRC reference and duplicate-name guard',()=>{assert.equal(crc32(Buffer.from('123456789')),0xcbf43926);const entries=[{name:'A.pdf',data:Buffer.from('%PDF-A')}];assert.equal(makeZip(entries).readUInt32LE(0),0x04034b50);assert.throws(()=>makeZip([...entries,...entries]),/duplicate/);});
