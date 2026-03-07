/**
 * E2E tests for init command (T027-T028)
 * Run: node tests/e2e/init-e2e.test.js
 *
 * E2E-1,2,3,6,7: skip - require TTY + interactive input
 * E2E-8,9: skip - require network / mock
 * E2E-10: skip - requires read-only dir (platform-specific)
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const BIN = path.join(__dirname, '../../bin/bmad-speckit.js');
const ROOT = path.join(__dirname, '../../');

function runInit(args = [], cwd = ROOT) {
  return spawnSync('node', [BIN, 'init', ...args], { cwd, encoding: 'utf8', timeout: 10000 });
}

function runGrep(pattern, filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return content.includes(pattern);
}

// E2E-1: init test-dir full flow - SKIP (requires TTY + interaction)
function testE2E1() {
  return { pass: true, skip: true, reason: 'requires TTY + interactive prompts' };
}

// E2E-2: init . path resolution - SKIP (requires TTY)
function testE2E2() {
  return { pass: true, skip: true, reason: 'requires TTY' };
}

// E2E-3: init --here path resolution - SKIP (requires TTY)
function testE2E3() {
  return { pass: true, skip: true, reason: 'requires TTY' };
}

// E2E-4: --modules bmm,tea only deploys specified modules (unit-style, no TTY)
async function testE2E4() {
  const { generateSkeleton } = require('../../src/commands/init-skeleton');
  const tmp = path.join(os.tmpdir(), `bmad-speckit-e2e4-${Date.now()}`);
  const templateDir = path.join(tmp, 'template');
  const destDir = path.join(tmp, 'dest');
  fs.mkdirSync(templateDir, { recursive: true });
  fs.mkdirSync(destDir, { recursive: true });

  const bmad = path.join(templateDir, '_bmad');
  fs.mkdirSync(path.join(bmad, 'bmm'), { recursive: true });
  fs.mkdirSync(path.join(bmad, 'tea'), { recursive: true });
  fs.mkdirSync(path.join(bmad, 'bmb'), { recursive: true });
  fs.mkdirSync(path.join(bmad, 'core'), { recursive: true });
  fs.mkdirSync(path.join(bmad, '_config'), { recursive: true });
  fs.writeFileSync(path.join(bmad, 'bmm', 'x.md'), 'bmm');
  fs.writeFileSync(path.join(bmad, 'tea', 'y.md'), 'tea');
  fs.writeFileSync(path.join(bmad, 'bmb', 'z.md'), 'bmb');

  await generateSkeleton(destDir, templateDir, ['bmm', 'tea'], false);

  const destBmad = path.join(destDir, '_bmad');
  const hasBmm = fs.existsSync(path.join(destBmad, 'bmm', 'x.md'));
  const hasTea = fs.existsSync(path.join(destBmad, 'tea', 'y.md'));
  const hasBmb = fs.existsSync(path.join(destBmad, 'bmb', 'z.md'));
  const hasCore = fs.existsSync(path.join(destBmad, 'core'));
  const hasConfig = fs.existsSync(path.join(destBmad, '_config'));

  try { fs.rmSync(tmp, { recursive: true }); } catch (_) {}
  return hasBmm && hasTea && hasCore && hasConfig && !hasBmb;
}

// E2E-5: Non-empty dir without --force => exit 4
function testE2E5() {
  const tmpDir = path.join(os.tmpdir(), `bmad-speckit-e2e5-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'x');
  const r = runInit(['.'], tmpDir);
  const ok = r.status === 4;
  try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
  return ok;
}

// E2E-6: --no-git skips git init - SKIP (requires TTY to complete init)
function testE2E6() {
  return { pass: true, skip: true, reason: 'requires TTY to complete init flow' };
}

// E2E-7: --force overwrites non-empty dir - SKIP (requires TTY)
function testE2E7() {
  return { pass: true, skip: true, reason: 'requires TTY' };
}

// E2E-8: --github-token, --skip-tls - SKIP (requires network)
function testE2E8() {
  return { pass: true, skip: true, reason: 'requires network' };
}

// E2E-9: template fetch failure => exit 3 - SKIP (requires network mock)
function testE2E9() {
  return { pass: true, skip: true, reason: 'requires network mock' };
}

// E2E-10: path not writable => exit 4 - SKIP (platform-specific read-only dir)
function testE2E10() {
  return { pass: true, skip: true, reason: 'requires read-only dir, platform-specific' };
}

// T029: grep verification - production code critical path
function testT029() {
  const checks = [
    { file: path.join(ROOT, 'bin/bmad-speckit.js'), pattern: 'init' },
    { file: path.join(ROOT, 'src/commands/init.js'), pattern: 'template-fetcher' },
    { file: path.join(ROOT, 'src/commands/init.js'), pattern: 'ai-builtin' },
    { file: path.join(ROOT, 'src/commands/init.js'), pattern: 'utils/path' },
    { file: path.join(ROOT, 'src/commands/init.js'), pattern: 'utils/tty' },
    { file: path.join(ROOT, 'src/services/template-fetcher.js'), pattern: 'path' },
  ];
  for (const { file, pattern } of checks) {
    if (!fs.existsSync(file) || !runGrep(pattern, file)) {
      return false;
    }
  }
  return true;
}

async function run() {
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  const tests = [
    { name: 'E2E-1', fn: testE2E1 },
    { name: 'E2E-2', fn: testE2E2 },
    { name: 'E2E-3', fn: testE2E3 },
    { name: 'E2E-4', fn: testE2E4, async: true },
    { name: 'E2E-5', fn: testE2E5 },
    { name: 'E2E-6', fn: testE2E6 },
    { name: 'E2E-7', fn: testE2E7 },
    { name: 'E2E-8', fn: testE2E8 },
    { name: 'E2E-9', fn: testE2E9 },
    { name: 'E2E-10', fn: testE2E10 },
    { name: 'T029', fn: testT029 },
  ];

  for (const { name, fn, async: isAsync } of tests) {
    try {
      const result = isAsync ? await fn() : fn();
      if (typeof result === 'object' && result.skip) {
        console.log(`${name}: SKIP (${result.reason})`);
        skipped++;
      } else if (result) {
        console.log(`${name}: PASS`);
        passed++;
      } else {
        console.log(`${name}: FAIL`);
        failed++;
      }
    } catch (err) {
      console.log(`${name}: FAIL - ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
