const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const MODULE_HELP = path.join(PROJECT_ROOT, '_bmad', 'bmm', 'module-help.csv');
const CLAW_SCOPE_ROOT = 'D:/Dev/claw-scope';

function parseCsvLine(line) {
  const cells = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === ',' && !inQuote) {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

function walkSkillFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSkillFiles(full, out);
    } else if (entry.isFile() && entry.name === 'SKILL.md') {
      out.push(full);
    }
  }
  return out;
}

function collectSkillMap(rootDir) {
  const files = walkSkillFiles(rootDir);
  const map = new Map();
  for (const file of files) {
    const skillName = path.basename(path.dirname(file));
    if (!map.has(skillName)) map.set(skillName, []);
    map.get(skillName).push(file);
  }
  return map;
}

function loadBmadHelpSkillRefs() {
  const text = fs.readFileSync(MODULE_HELP, 'utf8').trim();
  const rows = text.split(/\r?\n/).slice(1).map(parseCsvLine);
  return rows
    .map((cells) => ({
      name: cells[2],
      code: cells[3],
      workflowFile: cells[5],
      command: cells[6],
    }))
    .filter((row) => row.workflowFile.startsWith('skill:'));
}

describe('bmad-help skill route audit', () => {
  it('all skill: references in module-help have source assets in repo', () => {
    const refs = loadBmadHelpSkillRefs();
    const sourceMap = collectSkillMap(path.join(PROJECT_ROOT, '_bmad'));

    const missing = refs.filter((ref) => !sourceMap.has(ref.workflowFile.slice('skill:'.length)));

    assert.deepStrictEqual(
      missing,
      [],
      `Missing source SKILL.md for: ${missing.map((item) => `${item.workflowFile} (${item.name}/${item.code})`).join(', ')}`,
    );
  });

  it('all repo skill references are installed into claw-scope Claude and Cursor skill dirs', () => {
    const refs = loadBmadHelpSkillRefs();
    const claudeMap = collectSkillMap(path.join(CLAW_SCOPE_ROOT, '.claude', 'skills'));
    const cursorMap = collectSkillMap(path.join(CLAW_SCOPE_ROOT, '.cursor', 'skills'));

    const missingClaude = refs.filter((ref) => !claudeMap.has(ref.workflowFile.slice('skill:'.length)));
    const missingCursor = refs.filter((ref) => !cursorMap.has(ref.workflowFile.slice('skill:'.length)));

    assert.deepStrictEqual(
      missingClaude,
      [],
      `Missing Claude-installed skills: ${missingClaude.map((item) => `${item.workflowFile} (${item.name}/${item.code})`).join(', ')}`,
    );
    assert.deepStrictEqual(
      missingCursor,
      [],
      `Missing Cursor-installed skills: ${missingCursor.map((item) => `${item.workflowFile} (${item.name}/${item.code})`).join(', ')}`,
    );
  });

  it('bmad-help workflow prefers real skill names and treats bmad-bmm-* as aliases', () => {
    const workflow = fs.readFileSync(path.join(PROJECT_ROOT, '_bmad', 'skills', 'bmad-help', 'workflow.md'), 'utf8');

    assert.match(workflow, /display the real skill name in backticks/);
    assert.match(workflow, /legacy\/compatibility alias/);
    assert.doesNotMatch(workflow, /Show the command as a skill name in backticks/);
  });
});
