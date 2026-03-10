/**
 * FeedbackCommand tests (Story 13.5 - E13-S5)
 * TDD RED→GREEN→REFACTOR for T1 (feedbackCommand, getFeedbackHintText, bin), T2 (init hint), T3
 * Run: node --test tests/feedback.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const path = require('path');

const BIN = path.join(__dirname, '../bin/bmad-speckit.js');
const FULL_FLOW_AI_LIST = ['cursor-agent', 'claude', 'qwen', 'auggie', 'codebuddy', 'amp', 'qodercli', 'kiro-cli'];

// T1.1-T1.3: FeedbackCommand unit tests
describe('T1: FeedbackCommand (T1.1-T1.3)', () => {
  it('feedbackCommand exists and getFeedbackHintText exported (T1.1, T1.3)', () => {
    const feedback = require('../src/commands/feedback');
    assert.strictEqual(typeof feedback.feedbackCommand, 'function', 'feedbackCommand must exist');
    assert.strictEqual(typeof feedback.getFeedbackHintText, 'function', 'getFeedbackHintText must exist');
  });

  it('getFeedbackHintText returns non-empty string with feedback entry (T1.3)', () => {
    const { getFeedbackHintText } = require('../src/commands/feedback');
    const hint = getFeedbackHintText();
    assert.strictEqual(typeof hint, 'string');
    assert.ok(hint.length > 0);
    assert.ok(
      hint.includes('bmad-speckit feedback') || hint.includes('feedback') || hint.includes('反馈'),
      `hint should mention feedback entry: ${hint}`
    );
  });

  it('feedbackCommand stdout contains feedback entry and all 8 AI items (T1.1, T1.2)', () => {
    const { feedbackCommand } = require('../src/commands/feedback');
    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    try {
      const exit = process.exit;
      let exitCode = null;
      process.exit = (code) => { exitCode = code; };
      feedbackCommand();
      process.exit = exit;
      assert.strictEqual(exitCode, 0, 'feedbackCommand should process.exit(0)');
    } finally {
      console.log = origLog;
    }
    const out = logs.join('\n');
    for (const ai of FULL_FLOW_AI_LIST) {
      assert.ok(out.includes(ai), `output must include "${ai}": ${out}`);
    }
    assert.ok(
      out.includes('feedback') || out.includes('反馈') || out.includes('bmad-speckit'),
      `output must contain feedback entry hint: ${out}`
    );
  });
});

// T1.4: bin registration
describe('T1.4: bin registration', () => {
  it('bmad-speckit feedback => exit 0, stdout contains feedback and 8 AI items', () => {
    const r = spawnSync('node', [BIN, 'feedback'], {
      encoding: 'utf8',
      timeout: 5000,
    });
    assert.strictEqual(r.status, 0, `expected exit 0: ${r.stderr || r.stdout}`);
    const out = (r.stdout || '') + (r.stderr || '');
    for (const ai of FULL_FLOW_AI_LIST) {
      assert.ok(out.includes(ai), `CLI output must include "${ai}": ${out}`);
    }
    assert.ok(out.includes('feedback') || out.includes('反馈') || out.includes('bmad-speckit'), `CLI output must contain feedback entry: ${out}`);
  });

  it('bmad-speckit --help lists feedback', () => {
    const r = spawnSync('node', [BIN, '--help'], { encoding: 'utf8', timeout: 5000 });
    assert.strictEqual(r.status, 0);
    const out = (r.stdout || '') + (r.stderr || '');
    assert.ok(out.includes('feedback'), `--help should list feedback: ${out}`);
  });

  it('feedback works in non-TTY (pipe) (T2.2, T3.2)', () => {
    const r = spawnSync('node', [BIN, 'feedback'], {
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, CI: '1' },
      stdio: 'pipe',
    });
    assert.strictEqual(r.status, 0);
    const out = (r.stdout || '') + (r.stderr || '');
    assert.ok(out.length > 0);
    for (const ai of FULL_FLOW_AI_LIST) {
      assert.ok(out.includes(ai), `non-TTY output must include "${ai}": ${out}`);
    }
  });
});

// T2: init stdout feedback hint (T2.1, T3.3)
describe('T2: init stdout feedback hint', () => {
  const fs = require('fs');
  const os = require('os');

  it('init failure => no feedback hint in stdout (T2.3)', () => {
    const tmpDir = path.join(os.tmpdir(), `bmad-speckit-feedback-fail-${Date.now()}`);
    const invalidPath = path.join(tmpDir, 'nonexistent_bmad');
    fs.mkdirSync(tmpDir, { recursive: true });
    const projectDir = path.join(tmpDir, 'proj');
    fs.mkdirSync(projectDir, { recursive: true });
    const r = spawnSync('node', [BIN, 'init', '.', '--bmad-path', invalidPath, '--ai', 'cursor-agent', '--yes'], {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: 5000,
    });
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
    assert.notStrictEqual(r.status, 0, 'init should fail');
    const out = (r.stdout || '') + (r.stderr || '');
    assert.ok(!out.includes('get the feedback entry'), 'failed init must not output feedback hint');
  });

  it('init --bmad-path --ai cursor-agent --yes => stdout contains feedback hint (T2.1, T3.3)', () => {
    const tmpDir = path.join(os.tmpdir(), `bmad-speckit-feedback-init-${Date.now()}`);
    const sharedBmad = path.join(tmpDir, 'shared_bmad');
    fs.mkdirSync(path.join(sharedBmad, 'core'), { recursive: true });
    fs.mkdirSync(path.join(sharedBmad, 'cursor', 'commands'), { recursive: true });
    fs.mkdirSync(path.join(sharedBmad, 'cursor', 'rules'), { recursive: true });
    const projectDir = path.join(tmpDir, 'proj');
    fs.mkdirSync(projectDir, { recursive: true });
    const r = spawnSync('node', [BIN, 'init', '.', '--bmad-path', sharedBmad, '--ai', 'cursor-agent', '--yes', '--no-git'], {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: 15000,
    });
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
    assert.strictEqual(r.status, 0, `init should succeed: ${r.stderr || r.stdout}`);
    const out = (r.stdout || '') + (r.stderr || '');
    assert.ok(
      out.includes('bmad-speckit feedback') || out.includes('Feedback:'),
      `stdout must contain feedback hint (after POST_INIT_GUIDE_MSG): ${out}`
    );
  });
});

// T3.4: regression - version, config, upgrade, feedback unaffected
describe('T3.4: regression', () => {
  it('version, config list, upgrade --help, feedback still work', () => {
    const rVersion = spawnSync('node', [BIN, 'version'], { encoding: 'utf8', timeout: 5000 });
    const rConfig = spawnSync('node', [BIN, 'config', 'list'], { encoding: 'utf8', timeout: 5000 });
    const rUpgrade = spawnSync('node', [BIN, 'upgrade', '--help'], { encoding: 'utf8', timeout: 5000 });
    const rFeedback = spawnSync('node', [BIN, 'feedback'], { encoding: 'utf8', timeout: 5000 });
    assert.strictEqual(rVersion.status, 0, 'version should work');
    assert.strictEqual(rConfig.status, 0, 'config list should work');
    assert.strictEqual(rUpgrade.status, 0, 'upgrade --help should work');
    assert.strictEqual(rFeedback.status, 0, 'feedback should work');
  });
});
