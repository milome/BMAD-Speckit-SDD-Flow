const fs = require('node:fs');
const path = require('node:path');

const TEST_EPIC = 'TEST';
const TEST_STORY = '001';
const TEST_EPIC_SLUG = 'test-epic';
const TEST_STORY_SLUG = 'test-story';

function runE2eVerifyPaths(options = {}) {
  const root = path.resolve(options.cwd || process.cwd());
  const results = [];
  const log = [];
  const expectedDirs = [
    path.join(root, '.claude', 'state', 'stories'),
    path.join(root, `specs/epic-${TEST_EPIC}-${TEST_EPIC_SLUG}/story-${TEST_STORY}-${TEST_STORY_SLUG}`),
    path.join(root, `_bmad-output/implementation-artifacts/epic-${TEST_EPIC}-${TEST_EPIC_SLUG}/story-${TEST_STORY}-${TEST_STORY_SLUG}`),
  ];
  for (const dir of expectedDirs) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      results.push({ name: `dir:${path.relative(root, dir).replace(/\\/g, '/')}`, passed: true, detail: 'created' });
    } catch (error) {
      results.push({ name: `dir:${path.relative(root, dir).replace(/\\/g, '/')}`, passed: false, detail: String(error) });
    }
  }
  const requiredFiles = [
    '.claude/agents/bmad-master.md',
    '.claude/agents/bmad-story-create.md',
    '.claude/agents/bmad-story-audit.md',
    '.claude/agents/speckit-specify.md',
    '.claude/agents/speckit-plan.md',
    '.claude/agents/speckit-gaps.md',
    '.claude/agents/speckit-tasks.md',
    '.claude/agents/layers/bmad-layer4-speckit-specify.md',
    '.claude/agents/layers/bmad-layer4-speckit-plan.md',
    '.claude/agents/layers/bmad-layer4-speckit-gaps.md',
    '.claude/agents/layers/bmad-layer4-speckit-tasks.md',
    '.claude/agents/layers/bmad-layer4-speckit-implement.md',
    '.claude/agents/auditors/auditor-spec.md',
    '.claude/agents/auditors/auditor-plan.md',
    '.claude/agents/auditors/auditor-gaps.md',
    '.claude/agents/auditors/auditor-tasks.md',
    '.claude/agents/auditors/auditor-implement.md',
    '.claude/agents/auditors/auditor-document.md',
  ];
  for (const file of requiredFiles) {
    const exists = fs.existsSync(path.join(root, file));
    results.push({ name: `file:${file}`, passed: exists, detail: exists ? 'exists' : 'missing' });
  }
  const routePrereqMap = [
    ['plan', '.claude/agents/layers/bmad-layer4-speckit-plan.md', 'specify_passed'],
    ['gaps', '.claude/agents/layers/bmad-layer4-speckit-gaps.md', 'plan_passed'],
    ['tasks', '.claude/agents/layers/bmad-layer4-speckit-tasks.md', 'gaps_passed'],
    ['implement', '.claude/agents/layers/bmad-layer4-speckit-implement.md', 'tasks_passed'],
  ];
  for (const [agent, file, expected] of routePrereqMap) {
    const filePath = path.join(root, file);
    if (!fs.existsSync(filePath)) {
      results.push({ name: `prereq:${agent}`, passed: false, detail: 'file_missing' });
      continue;
    }
    const hasPrereq = fs.readFileSync(filePath, 'utf8').includes(expected);
    results.push({ name: `prereq:${agent}`, passed: hasPrereq, detail: hasPrereq ? 'matched' : `missing:${expected}` });
  }
  const cleanupDirs = [
    path.join(root, `specs/epic-${TEST_EPIC}-${TEST_EPIC_SLUG}`),
    path.join(root, `_bmad-output/implementation-artifacts/epic-${TEST_EPIC}-${TEST_EPIC_SLUG}`),
  ];
  for (const dir of cleanupDirs) {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  }
  const failed = results.filter((item) => !item.passed);
  return {
    schemaVersion: 'e2e-verify-paths-result/v1',
    cwd: root,
    results,
    passed: failed.length === 0,
    exitCode: failed.length === 0 ? 0 : 1,
    log,
  };
}

function main(argv = process.argv.slice(2)) {
  const cwdArgIndex = argv.indexOf('--cwd');
  const cwd = cwdArgIndex >= 0 ? argv[cwdArgIndex + 1] : process.cwd();
  const result = runE2eVerifyPaths({ cwd });
  console.log(JSON.stringify(result, null, 2));
  if (require.main === module) process.exit(result.exitCode);
  return result.exitCode;
}

module.exports = {
  runE2eVerifyPaths,
  main,
};
