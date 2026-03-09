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
      content.includes('resolveGenericAiCommandsDir') && content.includes("selectedAI === 'generic'"),
      'runInteractiveFlow must validate generic via resolveGenericAiCommandsDir',
    );
    const runInteractiveIdx = content.indexOf('async function runInteractiveFlow');
    const genericCheckIdx = content.indexOf('if (selectedAI === \'generic\')', runInteractiveIdx);
    assert.ok(genericCheckIdx > runInteractiveIdx && genericCheckIdx > 0, 'generic check must be inside runInteractiveFlow');
  });

  it('interactive select generic without aiCommandsDir => exit 2 (E2E, Unix only)', () => {
    if (process.platform === 'win32') {
      return; // script 在 Windows 上不可用，跳过
    }
    const tmpDir = path.join(os.tmpdir(), `bmad-speckit-int-gen-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const inputFile = path.join(tmpDir, 'input.txt');
    // AI 选择: generic | 路径: Enter | 模板: latest (Enter)
    fs.writeFileSync(inputFile, 'generic\n\n\n', 'utf8');
    const r = spawnSync(
      'sh',
      ['-c', `script -q -c "node '${BIN.replace(/'/g, "'\\''")}' init ." < '${inputFile.replace(/'/g, "'\\''")}'`],
      {
        cwd: tmpDir,
        encoding: 'utf8',
        timeout: 20000,
        env: { ...process.env },
      },
    );
    try {
      fs.rmSync(tmpDir, { recursive: true });
    } catch (_) {}
    if (r.error && r.error.code === 'ENOENT') {
      return; // script 不可用，跳过
    }
    const err = (r.stderr || '') + (r.stdout || '');
    assert.strictEqual(r.status, 2, `expected exit 2, got ${r.status}, err: ${err.slice(0, 300)}`);
    assert.ok(
      err.includes('generic') || err.includes('ai-commands-dir') || err.includes('aiCommandsDir'),
      `stderr should mention generic/ai-commands-dir: ${err.slice(0, 300)}`,
    );
  });
});
