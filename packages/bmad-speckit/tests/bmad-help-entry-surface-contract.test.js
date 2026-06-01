const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
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
});
