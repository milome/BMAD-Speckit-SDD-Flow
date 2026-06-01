const { describe, it } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DISPLAY_BUDGETS } = require('../src/runtime/ai-tdd/display-budget');
const {
  BMADS_CORE_HEADING_KEYS,
  HEADING_SCHEMAS,
  schemaHeadingSequence,
} = require('../src/runtime/markdown-sections');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const PACKAGE_CLI = path.join(PACKAGE_ROOT, 'bin', 'bmad-speckit.js');
const CORE_HEADINGS = schemaHeadingSequence(HEADING_SCHEMAS.bmads, BMADS_CORE_HEADING_KEYS);
const ZH_CORE_HEADINGS = schemaHeadingSequence(HEADING_SCHEMAS.bmadsZhCn, BMADS_CORE_HEADING_KEYS);

function makeRuntimeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmads-heading-'));
  const recordId = 'REQ-HEADING-CONTRACT';
  const recordsRoot = path.join(root, '_bmad-output', 'runtime', 'requirement-records');
  const recordRoot = path.join(recordsRoot, recordId);
  fs.mkdirSync(recordRoot, { recursive: true });
  fs.writeFileSync(
    path.join(recordRoot, 'requirement-record.json'),
    `${JSON.stringify(
      {
        recordId,
        title: 'Heading contract fixture',
        currentMentalModel: 'architecture_confirmation',
        sourceDocumentHash: 'sha256:heading-source',
        implementationConfirmationHash: 'sha256:heading-confirmation',
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(recordsRoot, 'index.json'),
    `${JSON.stringify(
      {
        active: {
          recordId,
          recordPath: `_bmad-output/runtime/requirement-records/${recordId}/requirement-record.json`,
        },
        records: [
          {
            recordId,
            recordPath: `_bmad-output/runtime/requirement-records/${recordId}/requirement-record.json`,
          },
        ],
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return root;
}

function runCli(args, cwd) {
  return execFileSync(process.execPath, [PACKAGE_CLI, ...args], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      BMAD_LANG: '',
      LC_ALL: 'C',
      LC_MESSAGES: 'C',
      LANG: 'C',
    },
  });
}

function headings(markdown) {
  return markdown
    .split(/\r?\n/)
    .filter((line) => /^#{1,3}\s+/u.test(line))
    .map((line) => line.trim());
}

function coreHeadings(markdown) {
  return headings(markdown).slice(0, CORE_HEADINGS.length);
}

describe('bmads heading contract', () => {
  it('renders governed action headings and Official Execution Paths as stable sections by default', () => {
    const root = makeRuntimeRoot();
    try {
      const text = runCli(['bmads', '--cwd', root]);

      assert.match(text, /^## Available Next Actions$/m);
      assert.match(text, /^### Recommended Now$/m);
      assert.match(text, /^### Core Skills$/m);
      assert.match(text, /^### Navigation$/m);
      assert.match(text, /^### Official Execution Paths$/m);
      assert.match(text, /Requirement contract authoring: use skill `requirements-contract-authoring`; typical action\/lane: author-confirmation-ready-source/);
      assert.match(text, /prepare_architecture_confirmation/);
      assert.match(text, /run_implementation_readiness_gate/);
      assert.match(text, /confirm-closeout-acceptance/);
      assert.doesNotMatch(text, /^- Skill: `prepare_architecture_confirmation`/m);
      assert.doesNotMatch(text, /^- Skill: `author-confirmation-ready-source`/m);
      assert.doesNotMatch(text, /^- Skill: `confirm-closeout-acceptance`/m);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps bmads and bmad-speckit alias heading sequences identical', () => {
    const root = makeRuntimeRoot();
    try {
      const bmads = runCli(['bmads', '--cwd', root, '--budget', 'route']);
      const alias = runCli(['bmad-speckit', '--cwd', root, '--budget', 'route']);

      assert.deepEqual(headings(alias), headings(bmads));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('preserves core H1/H2/H3 hierarchy across display budgets', () => {
    const root = makeRuntimeRoot();
    try {
      for (const budget of DISPLAY_BUDGETS) {
        const text = runCli(['bmads', '--cwd', root, '--budget', budget]);
        assert.deepEqual(coreHeadings(text), CORE_HEADINGS, `budget=${budget}`);
        assert.ok(
          text.indexOf('## Recommended Next Steps') < text.indexOf('## Available Next Actions'),
          `budget=${budget} should place Available Next Actions after Recommended Next Steps`
        );
        assert.ok(
          text.indexOf('## Available Next Actions') <
            text.indexOf('## Current Actionable Requirement Records'),
          `budget=${budget} should place Available Next Actions before records`
        );
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('uses the same heading schema for zh-CN output', () => {
    const root = makeRuntimeRoot();
    try {
      const en = headings(runCli(['bmads', '--cwd', root, '--budget', 'route']));
      const zh = headings(runCli(['bmads', '--cwd', root, '--budget', 'route', '--lang', 'zh-CN']));

      assert.deepEqual(coreHeadings(runCli(['bmads', '--cwd', root, '--budget', 'route'])), CORE_HEADINGS);
      assert.deepEqual(coreHeadings(runCli(['bmads', '--cwd', root, '--budget', 'route', '--lang', 'zh-CN'])), ZH_CORE_HEADINGS);
      assert.equal(zh.length, en.length);
      assert.match(zh.join('\n'), /^## 可用下一步$/m);
      assert.match(zh.join('\n'), /^### 当前推荐$/m);
      assert.match(zh.join('\n'), /^### 核心技能$/m);
      assert.match(zh.join('\n'), /^### 导航$/m);
      assert.match(zh.join('\n'), /^### 官方执行路径$/m);
      assert.equal(zh.filter((line) => line.startsWith('### ')).length, en.filter((line) => line.startsWith('### ')).length);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
