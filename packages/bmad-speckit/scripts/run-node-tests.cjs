const { existsSync, readdirSync } = require('node:fs');
const { basename, isAbsolute, join, relative, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

function collectTests(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTests(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.test.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

function normalizePathForMatch(value) {
  return String(value || '').replace(/\\/g, '/');
}

function matchesFilter(testFile, filter, cwd) {
  const normalizedFilter = normalizePathForMatch(filter);
  const absoluteTestFile = resolve(cwd, testFile);
  const relativeTestFile = normalizePathForMatch(relative(cwd, absoluteTestFile));
  const absoluteFilter = isAbsolute(filter) ? normalizePathForMatch(resolve(filter)) : null;

  return (
    relativeTestFile === normalizedFilter ||
    relativeTestFile.includes(normalizedFilter) ||
    relativeTestFile.endsWith(`/${normalizedFilter}`) ||
    basename(testFile) === normalizedFilter ||
    basename(testFile).includes(normalizedFilter) ||
    (absoluteFilter != null && normalizePathForMatch(absoluteTestFile) === absoluteFilter)
  );
}

function applyFilters(testFiles, filters, cwd) {
  if (filters.length === 0) return testFiles;
  return testFiles.filter((testFile) =>
    filters.some((filter) => matchesFilter(testFile, filter, cwd))
  );
}

const filters = process.argv.slice(2).filter((arg) => String(arg).trim() !== '');
const stateMutatingTestNames = new Set([
  'ai-tdd-projection-manifest.test.js',
  'bmad-help-bmads-fusion-contract.test.js',
  'bmads-six-model-installed-parity.test.js',
  'judge-runtime-installed-parity.test.js',
  'main-agent-build-dist.test.js',
  'main-agent-dist-no-redundant-assets.test.js',
  'main-agent-full-orchestration-no-regression.test.js',
  'pack-bmad-mirror.test.js',
]);
let testFiles = [];

try {
  testFiles = collectTests('tests').sort();
} catch (error) {
  if (error && error.code === 'ENOENT') {
    console.log('No tests yet');
    process.exit(0);
  }
  throw error;
}

if (testFiles.length === 0) {
  console.log('No tests yet');
  process.exit(0);
}

testFiles = applyFilters(testFiles, filters, process.cwd());

if (filters.length > 0 && testFiles.length === 0) {
  console.error(`No tests matched filters: ${filters.join(', ')}`);
  process.exit(1);
}

const childEnv = { ...process.env };
delete childEnv.NODE_TEST_CONTEXT;
const tsSourceRegisterPath = './tests/register-ts-source.cjs';
const preloadArgs = existsSync(tsSourceRegisterPath) ? ['-r', tsSourceRegisterPath] : [];

function runTestFiles(files, extraArgs = []) {
  if (files.length === 0) return 0;
  const result = spawnSync(process.execPath, [
    ...preloadArgs,
    '--test',
    ...extraArgs,
    ...files,
  ], {
    stdio: 'inherit',
    env: childEnv,
  });

  if (typeof result.status === 'number') return result.status;

  if (result.error) {
    throw result.error;
  }

  return 1;
}

function isStateMutatingTest(testFile) {
  return stateMutatingTestNames.has(basename(testFile));
}

const stableTestFiles = testFiles.filter((testFile) => !isStateMutatingTest(testFile));
const stateMutatingTestFiles = testFiles.filter(isStateMutatingTest);

let status = runTestFiles(stableTestFiles);
if (status === 0) {
  status = runTestFiles(stateMutatingTestFiles, ['--test-concurrency=1']);
}

process.exit(status);
