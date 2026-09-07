import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { MAX_JSON_BYTES, artifactPath, assertMonotonicScopeDelta, createHashBudget, isManagedArtifactPath, normalizeScope, readFileForHash, readJson, repositoryCaseSemantics, repositoryPathKey, resolveRepoPath, scopePatternCoversConcretePath, scopePatternsOverlap, sha256File, versionAtLeast, writeExclusiveJson } from '../checkpoint-core.mjs';

function fixture(t, contents) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'gfd-hash-budget-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return contents.map((content, index) => {
    const file = path.join(root, `${index}.txt`);
    writeFileSync(file, content, 'utf8');
    return file;
  });
}

test('sha256File enforces a cumulative file budget', (t) => {
  const [first, second] = fixture(t, ['one', 'two']);
  const budget = createHashBudget({ maxFiles: 1, maxBytes: 1024 });
  sha256File(first, budget);
  assert.throws(() => sha256File(second, budget), /hash file budget exceeds 1/u);
});

test('all hash entrypoints enforce the shared byte budget', (t) => {
  const [first, second] = fixture(t, ['1234', '56']);
  const budget = createHashBudget({ maxFiles: 2, maxBytes: 5 });
  readFileForHash(first, budget);
  assert.throws(() => readFileForHash(second, budget), /hash byte budget exceeds 5/u);
});

test('child hash budgets also consume their aggregate parent budget', (t) => {
  const [first, second] = fixture(t, ['one', 'two']);
  const aggregate = createHashBudget({ maxFiles: 1, maxBytes: 1024 });
  const child = createHashBudget({ maxFiles: 2, maxBytes: 1024, parent: aggregate });
  sha256File(first, child);
  assert.throws(() => sha256File(second, child), /hash file budget exceeds 1/u);
});

test('repository paths reject symlink or junction components', (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'gfd-path-link-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const target = path.join(root, 'target');
  mkdirSync(target);
  writeFileSync(path.join(target, 'input.json'), '{}\n', 'utf8');
  try {
    symlinkSync(target, path.join(root, 'alias'), 'junction');
  } catch (error) {
    if (error.code === 'EPERM') return t.skip('link creation is not permitted on this platform');
    throw error;
  }
  assert.throws(() => resolveRepoPath(root, 'alias/input.json', 'input'), /symbolic link or junction/u);
  assert.throws(() => resolveRepoPath(root, 'alias/output.json', 'output', { output: true }), /symbolic link or junction/u);
});

test('declared future evidence paths allow a missing leaf without weakening reads', (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'gfd-future-evidence-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  assert.throws(() => resolveRepoPath(root, 'src/future.ts', 'input'), /does not exist/u);
  const declared = resolveRepoPath(root, 'src/future.ts', 'evidence declaration', { allowMissing: true });
  assert.equal(path.relative(root, declared).replaceAll(path.sep, '/'), 'src/future.ts');
  const dotDotNamed = resolveRepoPath(root, '..cache/future.ts', 'dot-dot-named evidence', { allowMissing: true });
  assert.equal(artifactPath(root, dotDotNamed), '..cache/future.ts');
});

test('runtime version comparison is numeric and fail closed', () => {
  assert.equal(versionAtLeast('18.17.0', '18.17.0'), true);
  assert.equal(versionAtLeast('22.1.0', '18.17.0'), true);
  assert.equal(versionAtLeast('18.16.9', '18.17.0'), false);
  assert.equal(versionAtLeast('unknown', '18.17.0'), false);
});

test('CLI failures bound child-process detail while reporting truncation', () => {
  const moduleUrl = new URL('../checkpoint-core.mjs', import.meta.url).href;
  const child = spawnSync(process.execPath, [
    '--input-type=module',
    '--eval',
    `import { fail } from ${JSON.stringify(moduleUrl)}; const error = new Error('commit failed'); error.stdout = 'HEAD-' + String.fromCharCode(34, 92, 1).repeat(4000) + '-TAIL'; fail(error, 'test_failure');`,
  ], { encoding: 'utf8' });
  assert.equal(child.status, 2, child.stderr);
  assert.ok(Buffer.byteLength(child.stdout, 'utf8') < 4096);
  const payload = JSON.parse(child.stdout);
  assert.equal(payload.detailBytes, 12010);
  assert.equal(payload.detailTruncated, true);
  assert.equal(payload.messageTruncated, true);
  assert.match(payload.message, /HEAD-/u);
  assert.match(payload.message, /-TAIL/u);
});

test('JSON writers enforce the same per-record byte cap as readers', (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'gfd-json-cap-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const atCap = path.join(root, 'at-cap.json');
  const overCap = path.join(root, 'over-cap.json');
  const overhead = Buffer.byteLength(`${JSON.stringify({ data: '' }, null, 2)}\n`, 'utf8');
  writeExclusiveJson(atCap, { data: 'x'.repeat(MAX_JSON_BYTES - overhead) });
  assert.equal(readJson(atCap).data.length, MAX_JSON_BYTES - overhead);
  assert.throws(() => writeExclusiveJson(overCap, { data: 'x'.repeat(MAX_JSON_BYTES - overhead + 1) }), /JSON larger than 4194304 bytes/u);
  assert.equal(existsSync(overCap), false);
});

test('strict scope deltas preserve every parent authority boundary', () => {
  const parent = {
    allowedPaths: ['src/phase/**'],
    protectedPaths: ['src/protected/**'],
    forbiddenWork: ['src/phase/later/**'],
    evidenceInputs: {
      'acceptance-red': ['design.md'],
      'implementation-green': ['design.md'],
      'stop-gate': ['design.md'],
    },
  };
  const extended = structuredClone(parent);
  extended.allowedPaths.push('src/shared/adapter.ts');
  extended.protectedPaths.push('src/shared/**');
  extended.forbiddenWork.push('src/phase/future/**');
  extended.evidenceInputs['stop-gate'].push('integration.test.mjs');
  assert.doesNotThrow(() => assertMonotonicScopeDelta(parent, extended));
  for (const key of ['allowedPaths', 'protectedPaths', 'forbiddenWork']) {
    const weakened = structuredClone(parent);
    weakened[key] = [];
    assert.throws(() => assertMonotonicScopeDelta(parent, weakened), new RegExp(`${key}.*must preserve`, 'u'));
  }
  const weakerEvidence = structuredClone(parent);
  weakerEvidence.evidenceInputs['stop-gate'] = ['plan.md'];
  assert.throws(() => assertMonotonicScopeDelta(parent, weakerEvidence), /evidenceInputs\.stop-gate.*must preserve/u);
  const forbiddenExpansion = structuredClone(parent);
  forbiddenExpansion.allowedPaths.push('src/phase/later/file.ts');
  assert.throws(() => assertMonotonicScopeDelta(parent, forbiddenExpansion), /new allowed path overlaps parent forbidden work/u);
});

test('scope membership is directional and honors concrete glob matches', () => {
  assert.equal(scopePatternCoversConcretePath('.', 'src/file.ts'), true);
  assert.equal(scopePatternsOverlap('.', 'src/**'), true);
  assert.equal(scopePatternCoversConcretePath('docs/*.json', 'docs/config.json'), true);
  assert.equal(scopePatternCoversConcretePath('docs/*.json', 'docs/nested/config.json'), true);
  assert.equal(scopePatternCoversConcretePath('docs/*.json', 'docs/readme.md'), false);
  assert.equal(scopePatternCoversConcretePath('src/**', 'src/deep/file.ts'), true);
  assert.equal(scopePatternCoversConcretePath('src', 'src/deep/file.ts'), true);
  assert.equal(scopePatternCoversConcretePath('tools/helper.ts/child.ts', 'tools/helper.ts'), false);
  assert.equal(scopePatternCoversConcretePath('src/file[0-9].txt', 'src/filea.txt'), false);
  assert.equal(scopePatternCoversConcretePath('readme.md', 'README.md'), false);
});

test('repository path identity uses Git configuration while reserved paths stay conservative', (t) => {
  const sensitive = mkdtempSync(path.join(os.tmpdir(), 'gfd-case-sensitive-'));
  const insensitive = mkdtempSync(path.join(os.tmpdir(), 'gfd-case-insensitive-'));
  const unset = mkdtempSync(path.join(os.tmpdir(), 'gfd-case-unset-'));
  t.after(() => rmSync(sensitive, { recursive: true, force: true }));
  t.after(() => rmSync(insensitive, { recursive: true, force: true }));
  t.after(() => rmSync(unset, { recursive: true, force: true }));
  for (const [repo, ignoreCase] of [[sensitive, 'false'], [insensitive, 'true']]) {
    execFileSync('git', ['init', '-q', repo]);
    execFileSync('git', ['-C', repo, 'config', 'core.ignorecase', ignoreCase]);
  }
  execFileSync('git', ['init', '-q', unset]);
  spawnSync('git', ['-C', unset, 'config', '--unset-all', 'core.ignorecase']);
  assert.deepEqual(repositoryCaseSemantics(sensitive), { ignoreCase: false });
  assert.deepEqual(repositoryCaseSemantics(insensitive), { ignoreCase: true });
  assert.deepEqual(repositoryCaseSemantics(unset), { ignoreCase: false });
  assert.notEqual(repositoryPathKey('README.md', { ignoreCase: false }), repositoryPathKey('readme.md', { ignoreCase: false }));
  assert.equal(repositoryPathKey('README.md', { ignoreCase: true }), repositoryPathKey('readme.md', { ignoreCase: true }));
  assert.throws(() => normalizeScope({ allowedPaths: ['.GIT/hooks/**'], protectedPaths: [], forbiddenWork: [], evidenceInputs: {} }), /reserved repository-internal path/u);
});

test('supported scope patterns match plain Git pathspec results', (t) => {
  const repo = mkdtempSync(path.join(os.tmpdir(), 'gfd-pathspec-oracle-'));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q', repo]);
  const files = ['docs/config.json', 'docs/nested/config.json', 'docs/deep/nested/config.json'];
  for (const file of files) {
    mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
    writeFileSync(path.join(repo, file), '{}\n', 'utf8');
  }
  execFileSync('git', ['-C', repo, 'add', '.']);
  for (const pattern of ['.', 'docs/**/config.json', '**/config.json', 'docs/*.json']) {
    const native = execFileSync('git', ['-C', repo, 'ls-files', '--', pattern], { encoding: 'utf8' }).trim().split(/\r?\n/u).filter(Boolean).sort();
    const local = files.filter((file) => scopePatternCoversConcretePath(pattern, file)).sort();
    assert.deepEqual(local, native, pattern);
  }
});

test('authorized scope rejects Git metadata and managed ledger paths', () => {
  const base = { protectedPaths: [], forbiddenWork: [], evidenceInputs: {} };
  assert.throws(() => normalizeScope({ ...base, allowedPaths: ['.git/config'] }), /reserved repository-internal path/u);
  assert.throws(() => normalizeScope({ ...base, allowedPaths: ['nested/.git/hooks/pre-commit'] }), /reserved repository-internal path/u);
  assert.throws(() => normalizeScope({ ...base, allowedPaths: ['.artifacts/governed-feature-delivery/**'] }), /reserved repository-internal path/u);
  assert.doesNotThrow(() => normalizeScope({ ...base, allowedPaths: ['.artifacts/product/**'] }));
  assert.equal(isManagedArtifactPath('.artifacts/governed-feature-delivery/receipt.json'), true);
  assert.equal(isManagedArtifactPath('.artifacts/governed-feature-delivery-fallback/receipt.json'), true);
  assert.equal(isManagedArtifactPath('.artifacts/product/generated.txt'), false);
  assert.equal(isManagedArtifactPath('.artifacts/Governed-Feature-Delivery/receipt.json'), true);
  assert.throws(() => normalizeScope({ ...base, allowedPaths: ['src/**'], evidenceInputs: { 'acceptance-red': ['.git/config'] } }), /reserved repository-internal path/u);
  assert.throws(() => normalizeScope({ ...base, allowedPaths: ['src/**'], evidenceInputs: { 'stop-gate': ['.artifacts/governed-feature-delivery/receipt.json'] } }), /reserved repository-internal path/u);
});

test('scope rejects pathspec syntax outside the supported Git-compatible subset', () => {
  const base = { protectedPaths: [], forbiddenWork: [], evidenceInputs: {} };
  assert.throws(() => normalizeScope({ ...base, allowedPaths: ['src/[[:digit:]].txt'] }), /unsupported path pattern/u);
  assert.throws(() => normalizeScope({ ...base, allowedPaths: ['src/file***.txt'] }), /unsupported path pattern/u);
});
