#!/usr/bin/env node
'use strict';

/**
 * Shared locale + JSON messages for Claude hooks (TC.1–TC.3).
 * BMAD_HOOKS_LOCALE=en → messages.en.json; default zh → messages.zh.json
 */
const fs = require('node:fs');
const path = require('node:path');

/**
 * @returns {'en'|'zh'}
 */
function getHooksLocale() {
  const v = (process.env.BMAD_HOOKS_LOCALE || 'zh').toLowerCase();
  return v === 'en' ? 'en' : 'zh';
}

/**
 * @param {string} hooksDir - __dirname of the calling hook
 * @returns {Record<string, unknown>}
 */
function loadHookMessages(hooksDir) {
  const loc = getHooksLocale();
  const basename = loc === 'en' ? 'messages.en.json' : 'messages.zh.json';
  const file = path.join(hooksDir, basename);
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw);
}

/**
 * Time locale string for hook banners (user-visible).
 * @returns {string}
 */
function getHooksTimeLocale() {
  return getHooksLocale() === 'en' ? 'en-US' : 'zh-CN';
}

module.exports = {
  getHooksLocale,
  loadHookMessages,
  getHooksTimeLocale,
};
