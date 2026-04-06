#!/usr/bin/env node
'use strict';

/**
 * Shared locale + JSON messages for runtime hooks (TC.3); mirrors `.claude/hooks/hook-load-messages.js`.
 */
const fs = require('node:fs');
const path = require('node:path');

function getHooksLocale() {
  const v = (process.env.BMAD_HOOKS_LOCALE || 'zh').toLowerCase();
  return v === 'en' ? 'en' : 'zh';
}

function loadHookMessages(hooksDir) {
  const loc = getHooksLocale();
  const basename = loc === 'en' ? 'messages.en.json' : 'messages.zh.json';
  const file = path.join(hooksDir, basename);
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw);
}

function getHooksTimeLocale() {
  return getHooksLocale() === 'en' ? 'en-US' : 'zh-CN';
}

module.exports = {
  getHooksLocale,
  loadHookMessages,
  getHooksTimeLocale,
};
