import test from 'node:test';import assert from 'node:assert/strict';
import {referenceTabs,referenceLinks,referenceDataHref,catalogueReferenceTab,catalogueTabForTaxonomy} from '../lib/admin-reference-navigation.mjs';
test('reference sections are not catalogue workspaces',()=>assert.ok(referenceLinks.every(x=>x.href.startsWith('/admin/reference-data?'))));
test('category assignment alias points to Categories',()=>assert.equal(catalogueReferenceTab('category-tag-groups'),'categories'));
test('global alias retains global panel intent',()=>assert.equal(referenceDataHref('global-tag-groups'),'/admin/reference-data?section=categories&groups=global'));
test('legacy taxonomy global maps to Categories',()=>assert.equal(catalogueTabForTaxonomy('global'),'categories'));
test('tags stay nested under tag groups',()=>assert.equal(referenceDataHref('tags'),'/admin/reference-data?section=tag-groups'));
test('assignment tabs are not duplicated',()=>assert.deepEqual(referenceTabs,['categories','tag-groups','product-kinds','dealers']));
