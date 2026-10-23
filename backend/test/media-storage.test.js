"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createMediaStorage}=require('../services/media-storage');
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'luminoza-media-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
function env(root){return {DATABASE_URL:'postgresql://test:test@localhost/test',MEDIA_STORAGE_ROOT:root};}
test('configured root is created and canonicalized',t=>{const root=path.join(fixture(t),'media');assert.equal(createMediaStorage(env(root)).getMediaRoot(),fs.realpathSync(root));});
test('relative root is rejected',()=>assert.throws(()=>createMediaStorage(env('relative')).getMediaRoot(),/absolute/));
test('file cannot be used as root',t=>{const p=path.join(fixture(t),'file');fs.writeFileSync(p,'x');assert.throws(()=>createMediaStorage(env(p)).getMediaRoot());});
test('root is cached for this process',t=>{const parent=fixture(t),e=env(path.join(parent,'first')),s=createMediaStorage(e),first=s.getMediaRoot();e.MEDIA_STORAGE_ROOT=path.join(parent,'second');assert.equal(s.getMediaRoot(),first);assert.equal(fs.existsSync(e.MEDIA_STORAGE_ROOT),false);});
test('startup probe leaves no files',t=>{const root=createMediaStorage(env(path.join(fixture(t),'media'))).getMediaRoot();assert.deepEqual(fs.readdirSync(root),[]);});
test('existing media survive storage reinitialization',t=>{const e=env(path.join(fixture(t),'media')),root=createMediaStorage(e).getMediaRoot();fs.writeFileSync(path.join(root,'existing.jpg'),'test-content');const again=createMediaStorage(e).getMediaRoot();assert.equal(fs.readFileSync(path.join(again,'existing.jpg'),'utf8'),'test-content');});
test('canonical root resolves symlinks',t=>{const parent=fixture(t),target=path.join(parent,'target'),link=path.join(parent,'link');fs.mkdirSync(target);fs.symlinkSync(
  target,
  link,
  process.platform === 'win32' ? 'junction' : 'dir'
);assert.equal(createMediaStorage(env(link)).getMediaRoot(),fs.realpathSync(target));});
