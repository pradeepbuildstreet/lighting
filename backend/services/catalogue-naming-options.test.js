"use strict";
const assert=require('node:assert/strict');
const {validateRule}=require('./catalogue-rulebook-core');
const {suggestName,DEFAULT_RULE,RULE_VERSION}=require('./catalogue-identity-rules');
const rule={groups:['style','material','primary-color'],maxLength:255,separator:' & ',maxPerGroup:2,includeBrand:true,includePrimaryCategory:true,includeProductKind:false};
const data={brand:'Clara',categoryName:'Pendant Lights',kindCode:'fixture',kindName:'Fixtures',tags:[{group_code:'style',name:'Modern'},{group_code:'material',name:'Metal'},{group_code:'primary-color',name:'Black'}]};
const before=JSON.stringify(rule);assert.equal(validateRule(rule).includeProductKind,false);assert.equal(suggestName(data,validateRule(rule)).name,'Clara Modern Metal Black Pendant Light');
for(const category of [false,true])for(const kind of [false,true]){const name=suggestName(data,validateRule({...rule,includePrimaryCategory:category,includeProductKind:kind})).name;assert.equal(name.includes('Pendant Light'),category);assert.equal(name.endsWith('Fixture'),kind);}
const {includeProductKind,...legacy}=rule;assert.equal(validateRule(legacy).includeProductKind,true);assert(suggestName(data,legacy).name.endsWith('Fixture'));assert.equal(DEFAULT_RULE.includeProductKind,true);assert.equal(RULE_VERSION,6);
for(const value of ['false',0,null,[]])assert.throws(()=>validateRule({...rule,includeProductKind:value}),{status:400});assert.throws(()=>validateRule({...rule,unknownOption:true}),{status:400});assert.equal(suggestName({brand:'',tags:[]},validateRule({...rule,includePrimaryCategory:false})).name,'');assert.throws(()=>suggestName(data,validateRule({...rule,maxLength:5})));assert.equal(JSON.stringify(rule),before);
console.log('Naming option validation, four inclusion combinations, legacy defaults and non-mutation tests passed');
