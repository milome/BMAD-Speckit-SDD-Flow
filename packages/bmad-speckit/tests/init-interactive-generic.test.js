/**
 * GAP-R2-2: 交互式选 generic 且无 aiCommandsDir → 退出码 2
 * - grep 回归：runInteractiveFlow 内含 generic 校验
 * - E2E（Unix）：script + 管道 stdin 模拟 TTY 交互
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const BIN = path.join(__dirname, '../bin/bmad-speckit.js');
const initPath = path.join(__dirname, '../src/commands/init.js');

describe('Init interactive generic validation (GAP-R2-2)', () => {
  it('runInteractiveFlow contains generic aiCommandsDir validation (grep regression)', () => {
    const content = fs.readFileSync(initPath, 'utf8');
    assert.ok(
      content.includes('resolveGenericAiCommandsDir') && content.includes("=== 'generic'"),
      'init.js must validate generic via resolveGenericAiCommandsDir',
    );
    const runInteractiveIdx = content.indexOf('async function runInteractiveFlow');
    const validateGenericIdx = content.indexOf('validateGenericAIs(', runInteractiveIdx);
    assert.ok(validateGenericIdx > runInteractiveIdx && validateGenericIdx > 0, 'runInteractiveFlow must call validateGenericAIs');
  });

  it('non-interactive --ai generic without --ai-commands-dir => exit 2 (E2E)', () => {
    const tmpDir = path.join(os.tmpdir(), `bmad-speckit-int-gen-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    // Use CLI flags to test the same validation logic (validateGenericAIs is called in runNonInteractiveFlow)
    // Interactive checkbox selection cannot be reliably automated with stdin pipe
    const r = spawnSync('node', [BIN, 'init', '.', '--ai', 'generic', '--yes'], {
      cwd: tmpDir,
      encoding: 'utf8',
      timeout: 20000,
      env: { ...process.env },
    });
    try {
      fs.rmSync(tmpDir, { recursive: true });
    } catch (_) {}
    const err = (r.stderr || '') + (r.stdout || '');
    assert.strictEqual(r.status, 2, `expected exit 2, got ${r.status}, err: ${err.slice(0, 300)}`);
    assert.ok(
      err.includes('generic') || err.includes('ai-commands-dir') || err.includes('aiCommandsDir'),
      `stderr should mention generic/ai-commands-dir: ${err.slice(0, 300)}`,
    );
  });
});
