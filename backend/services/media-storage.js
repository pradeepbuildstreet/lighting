"use strict";
const fs = require('node:fs');
const path = require('node:path');
const {loadConfig} = require('../config/runtime');
function createMediaStorage(env = process.env) {
  let cached;
  return Object.freeze({getMediaRoot() {
    if (cached) return cached;
    const configured = loadConfig(env).mediaRoot;
    fs.mkdirSync(configured, {recursive:true, mode:0o700});
    const root = fs.realpathSync(configured);
    if (!fs.statSync(root).isDirectory()) throw new Error('Media root must be a directory');
    const probe = fs.mkdtempSync(path.join(root, '.media-probe-'));
    const file = path.join(probe, 'check');
    try {
      fs.writeFileSync(file, 'media-storage-ok', {flag:'wx', mode:0o600});
      if (fs.readFileSync(file, 'utf8') !== 'media-storage-ok') throw new Error('Media storage read check failed');
    } finally {
      try { fs.unlinkSync(file); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      fs.rmdirSync(probe);
    }
    cached = root;
    return cached;
  }});
}
const storage = createMediaStorage();
module.exports = {getMediaRoot:storage.getMediaRoot, createMediaStorage};
