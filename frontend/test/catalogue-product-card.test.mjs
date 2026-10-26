import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {brandLabel} from '../lib/catalogue-card-display.mjs';
test('missing and blank brands have a stable visible placeholder',()=>{for(const value of [undefined,null,'','   '])assert.equal(brandLabel(value),'—');});
test('brand display preserves names and trims surrounding whitespace',()=>{assert.equal(brandLabel('  Luminoza  '),'Luminoza');assert.equal(brandLabel('Éclairage & Co.'),'Éclairage & Co.');});
const css=readFileSync(new URL('../components/CatalogueProductCard.module.css',import.meta.url),'utf8');
const source=readFileSync(new URL('../components/CatalogueProductCards.tsx',import.meta.url),'utf8');
const grid=readFileSync(new URL('../components/CatalogueProductGrid.module.css',import.meta.url),'utf8');
test('source reserves fixed image, title, brand and footer slots',()=>{for(const value of ['height:480px','height:220px','height:44px','height:18px','grid-template-rows:20px 32px','margin-top:auto','height:440px'])assert.ok(css.includes(value));assert.ok(source.includes('Brand: {brand}'));assert.ok(source.includes('className={card.footer}'));});
test('entire product link and separate wishlist controls are retained',()=>{assert.ok(source.includes('browseProductHref(productHref(p.sku),browseCategory,returnTo)'));assert.ok(source.includes('<WishlistButton productId={p.id}'));assert.ok(source.indexOf('</Link>')<source.indexOf('<WishlistButton'));assert.ok(source.includes('<PublicEnquiryCount productId={p.id}/>'));});
test('loading and unavailable enquiry messages keep a reserved two-line slot',()=>{assert.ok(css.includes('.enquiries{height:32px;min-width:0}'));assert.ok(css.includes('font:12px/16px Arial,sans-serif'));assert.ok(!source.includes('Enquired 0'));});
test('listing zoom remains disabled because the existing thumbnail is reused',()=>{assert.ok(source.includes('<ProductThumbnail'));assert.ok(!source.includes('ZoomableImage'));});
test('discovery caps and the uncapped normal listing are retained',()=>{assert.ok(source.includes('props.maxRows===3?props.products.slice(0,18):props.products'));const rules=[...grid.matchAll(/min-width:(\d+)px\)\{\.threeRows\{grid-template-columns:repeat\((\d+),minmax\(0,1fr\)\)\}\.threeRows>article:nth-child\(n\)\{display:block\}\.threeRows>article:nth-child\(n\+(\d+)\)\{display:none\}/g)];assert.equal(rules.length,5);for(const m of rules)assert.equal(Number(m[3])-1,Number(m[2])*3);});
function luminance(hex){const c=hex.match(/\w\w/g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
test('card text and new price colour meet 4.5:1 against the defined white background',()=>{for(const hex of ['555b60','697076','9c4127']){assert.ok(css.includes('#'+hex));assert.ok(1.05/(luminance(hex)+.05)>=4.5);}});
