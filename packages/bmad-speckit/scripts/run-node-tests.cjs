const { readdirSync } = require('node:fs');
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
    relativeTestFile.endsWith(`/${normalizedFilter}`) ||
    basename(testFile) === normalizedFilter ||
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

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit',
  env: childEnv,
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

if (result.error) {
  throw result.error;
}

process.exit(1);
