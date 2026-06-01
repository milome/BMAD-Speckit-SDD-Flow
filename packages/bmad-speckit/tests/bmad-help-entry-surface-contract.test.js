const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const PACKAGE_CLI = path.join(PACKAGE_ROOT, 'bin', 'bmad-speckit.js');
const PUBLIC_COMMAND_DIRS = [
  path.join(PROJECT_ROOT, '_bmad', 'commands'),
  path.join(PROJECT_ROOT, '.codex', 'commands'),
  path.join(PROJECT_ROOT, '.cursor', 'commands'),
  path.join(PROJECT_ROOT, '.claude', 'commands'),
];

function makeRuntimeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmads-entry-surface-'));
  const recordId = 'REQ-ENTRY-LANG';
  const recordsRoot = path.join(root, '_bmad-output', 'runtime', 'requirement-records');
  const recordRoot = path.join(recordsRoot, recordId);
  fs.mkdirSync(recordRoot, { recursive: true });
  fs.writeFileSync(
    path.join(recordRoot, 'requirement-record.json'),
    `${JSON.stringify(
      {
        recordId,
        title: 'Entry language fixture',
        currentMentalModel: 'implementation_readiness',
        sourceDocumentHash: 'sha256:entry-source',
        implementationConfirmationHash: 'sha256:entry-confirmation',
        sixModelResults: {
          implementation_readiness: { status: 'pass' },
        },
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

describe('bmad-help and bmads package entry surface', () => {
  it('uses the single package CLI entry and package runtime renderers', () => {
    const cli = fs.readFileSync(PACKAGE_CLI, 'utf8');

    assert.ok(cli.includes(".command('bmad-help')"));
    assert.ok(cli.includes(".command('bmads')"));
    assert.ok(cli.includes('../src/runtime/bmad-help-renderer'));
    assert.ok(cli.includes('../src/runtime/bmads-renderer'));
    assert.ok(!cli.includes("runRepoScript('bmads-renderer.ts'"));
    assert.ok(!cli.includes("runRepoScript('bmad-help-renderer.ts'"));

    assert.equal(fs.existsSync(path.join(PACKAGE_ROOT, 'bin', 'bmad-help.js')), false);
    assert.equal(fs.existsSync(path.join(PACKAGE_ROOT, 'bin', 'bmads.js')), false);
    assert.equal(fs.existsSync(path.join(PROJECT_ROOT, 'scripts', 'bmad-help-renderer.ts')), false);
    assert.equal(fs.existsSync(path.join(PROJECT_ROOT, 'scripts', 'bmads-renderer.ts')), false);
    assert.equal(
      fs.existsSync(path.join(PROJECT_ROOT, '_bmad', 'skills', 'ai-tdd-runtime-navigator', 'SKILL.md')),
      false
    );
    assert.equal(
      fs.existsSync(
        path.join(
          PACKAGE_ROOT,
          '_bmad',
          'skills',
          'ai-tdd-runtime-navigator',
          'SKILL.md'
        )
      ),
      false
    );
    for (const dir of PUBLIC_COMMAND_DIRS) {
      if (!fs.existsSync(dir)) continue;
      assert.equal(fs.existsSync(path.join(dir, 'ai-tdd-runtime-navigator.md')), false);
      assert.equal(fs.existsSync(path.join(dir, 'bmad-navigator.md')), false);
    }
  });

  it('prints both bmad-help and bmads from bmad-speckit --help', () => {
    const help = execFileSync(process.execPath, [PACKAGE_CLI, '--help'], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
    });

    assert.match(help, /\bbmad-help\b/);
    assert.match(help, /\bbmads\b/);
  });

  it('forwards bmads runtime options through the single package CLI entry', () => {
    const root = makeRuntimeRoot();
    try {
      const text = execFileSync(
        process.execPath,
        [PACKAGE_CLI, 'bmads', '--cwd', root, '--budget', 'expanded', '--lang', 'zh-CN'],
        {
          cwd: PROJECT_ROOT,
          encoding: 'utf8',
        }
      );

      assert.match(text, /你现在看到什么/);
      assert.match(text, /你正在查看 REQ-ENTRY-LANG 的 AI-TDD runtime 状态。/);
      assert.match(text, /6\/6\. Delivery Confirmation/);
      assert.doesNotMatch(text, /60\. Delivery Confirmation/);
      assert.doesNotMatch(text, /panorama rows hidden by route budget/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('defaults bmads package CLI output to English user copy', () => {
    const root = makeRuntimeRoot();
    try {
      const text = execFileSync(process.execPath, [PACKAGE_CLI, 'bmads', '--cwd', root], {
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

      assert.match(text, /What you are looking at/);
      assert.match(text, /You are looking at the AI-TDD runtime state for REQ-ENTRY-LANG\./);
      assert.doesNotMatch(text, /你现在看到什么/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not infer Chinese output from host locale without explicit bmads language', () => {
    const root = makeRuntimeRoot();
    try {
      const text = execFileSync(process.execPath, [PACKAGE_CLI, 'bmads', '--cwd', root], {
        cwd: PROJECT_ROOT,
        encoding: 'utf8',
        env: {
          ...process.env,
          BMAD_LANG: '',
          BMAD_LOCALE: '',
          LC_ALL: 'zh_CN.UTF-8',
          LC_MESSAGES: 'zh_CN.UTF-8',
          LANG: 'zh_CN.UTF-8',
        },
      });

      assert.match(text, /What you are looking at/);
      assert.doesNotMatch(text, /你现在看到什么/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
