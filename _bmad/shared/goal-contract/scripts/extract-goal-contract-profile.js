#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const DEFAULT_TEMPLATE = path.join(ROOT, '_bmad', 'shared', 'goal-contract', 'goal-execution-contract-template.md');
const SLOT_OPEN_RE = /<!--\s*goal-slot:([A-Za-z0-9_-]+)([^>]*)-->/g;

function sha256(content) {
  return `sha256:${crypto.createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

function canonicalTextForContractHash(text) {
  return String(text).replace(/^\uFEFF/u, '').replace(/\r\n/g, '\n');
}

function templateHashFor(text) {
  return sha256(canonicalTextForContractHash(text));
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function profileHashFor(profile) {
  return sha256(stableStringify({ ...profile, profileHash: null }));
}

function normalizeRepoPath(file, root = ROOT) {
  return path.relative(root, file).split(path.sep).join('/');
}

function extractSections(templateText) {
  return Array.from(templateText.matchAll(/^##\s+(.+?)\s*$/gm)).map((match) => match[1].trim());
}

function parseSlotAttributes(rawAttributes) {
  const attributes = {};
  const text = String(rawAttributes ?? '');
  for (const token of text.trim().split(/\s+/).filter(Boolean)) {
    const [key, value] = token.split('=');
    attributes[key] = value === undefined ? true : value;
  }
  return attributes;
}

function extractSlots(templateText) {
  const slots = [];
  const seen = new Map();
  let match;
  while ((match = SLOT_OPEN_RE.exec(templateText))) {
    const name = match[1];
    const closeMarker = `<!-- /goal-slot:${name} -->`;
    const closeIndex = templateText.indexOf(closeMarker, SLOT_OPEN_RE.lastIndex);
    const slot = {
      name,
      required: /\brequired\b/.test(match[2]),
      dynamic: /dynamic=([A-Za-z0-9_-]+)/.exec(match[2])?.[1] ?? null,
      openIndex: match.index,
      closeIndex,
      attributes: parseSlotAttributes(match[2]),
    };
    slots.push(slot);
    seen.set(name, (seen.get(name) ?? 0) + 1);
  }
  return {
    slots,
    duplicateSlots: Array.from(seen.entries())
      .filter(([, count]) => count > 1)
      .map(([name]) => name),
    unclosedSlots: slots.filter((slot) => slot.closeIndex < 0).map((slot) => slot.name),
  };
}

function extractTemplateProfile(templateText) {
  const slotInfo = extractSlots(templateText);
  return {
    templateHash: templateHashFor(templateText),
    sections: extractSections(templateText),
    slots: slotInfo.slots.map((slot) => ({
      name: slot.name,
      required: slot.required,
      dynamic: slot.dynamic,
    })),
    duplicateSlots: slotInfo.duplicateSlots,
    unclosedSlots: slotInfo.unclosedSlots,
  };
}

function main(argv = process.argv.slice(2)) {
  const templatePath = argv[0] ? path.resolve(argv[0]) : DEFAULT_TEMPLATE;
  const templateText = fs.readFileSync(templatePath, 'utf8');
  const profile = extractTemplateProfile(templateText);
  process.stdout.write(`${JSON.stringify({ templatePath: normalizeRepoPath(templatePath), ...profile }, null, 2)}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  ROOT,
  DEFAULT_TEMPLATE,
  canonicalTextForContractHash,
  extractSections,
  extractSlots,
  extractTemplateProfile,
  normalizeRepoPath,
  profileHashFor,
  sha256,
  stableStringify,
  templateHashFor,
};
