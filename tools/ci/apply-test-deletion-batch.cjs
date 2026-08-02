'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');

const { canonicalJsonBytes, sha256Bytes } = require('../test-portfolio-audit/canonical.cjs');
const { compareText, fail } = require('./canonical-artifact.cjs');
const {
  assertNoExternalTestBindings,
  coreSelectedIdentities,
  impactedIdentities,
  loadDeletionAuthorityArtifacts,
  uniqueObligationProviders,
  verifyDeletionExceptionAuthorization,
  verifyTrackedAuthorization,
} = require('./authorize-test-deletions.cjs');

const DEFAULT_MAX_BATCH_SIZE = 50;
const REQUIRED_VALIDATION_KINDS = Object.freeze([
  'affected_tests',
  'binding_gates',
  'catalog_reconciliation',
  'count',
]);

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function nonEmptyString(value, code) {
  if (typeof value !== 'string' || value.trim() === '') fail(code);
  return value.trim();
}

function stringArray(value, code) {
  if (!Array.isArray(value) || value.length === 0) fail(code);
  const normalized = value.map((entry) => nonEmptyString(entry, code));
  if (new Set(normalized).size !== normalized.length) fail(code);
  return normalized.sort(compareText);
}

function resolveRepositoryFile(repoRoot, repositoryPath) {
  const root = path.resolve(repoRoot);
  const normalized = nonEmptyString(repositoryPath, 'TEST_DELETION_PATH_INVALID').replaceAll(
    '\\',
    '/'
  );
  if (
    path.isAbsolute(normalized) ||
    normalized.startsWith('/') ||
    normalized.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    fail('TEST_DELETION_PATH_OUTSIDE_REPOSITORY', { testPath: repositoryPath });
  }
  const target = path.resolve(root, ...normalized.split('/'));
  const relative = path.relative(root, target);
  if (relative === '' || relative === '..' || relative.startsWith(`..${path.sep}`)) {
    fail('TEST_DELETION_PATH_OUTSIDE_REPOSITORY', { testPath: repositoryPath });
  }

  let current = root;
  for (const segment of normalized.split('/')) {
    current = path.join(current, segment);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
      fail('TEST_DELETION_PATH_SYMLINK', { testPath: repositoryPath, component: current });
    }
  }
  return { normalized, target };
}

function assertNoSymlinkComponents(repoRoot, targetPath) {
  const root = path.resolve(repoRoot);
  const target = path.resolve(targetPath);
  const relative = path.relative(root, target);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail('TEST_DELETION_ARTIFACT_PATH_INVALID');
  }
  let current = root;
  for (const segment of relative.split(path.sep)) {
    if (!segment) continue;
    current = path.join(current, segment);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
      fail('TEST_DELETION_ARTIFACT_PATH_SYMLINK', { target: targetPath, component: current });
    }
  }
}

function normalizeBindings(authorization) {
  if (!isPlainObject(authorization)) fail('TEST_DELETION_REVIEW_MISSING');
  if (
    authorization.verdict !== 'approve_delete' ||
    authorization.reviewProfileVersion !== 'test-portfolio-delete/v1'
  ) {
    fail('TEST_DELETION_REVIEW_MISSING');
  }
  const candidateIdentityKeys = stringArray(
    authorization.candidateIdentityKeys,
    'TEST_DELETION_AUTHORIZATION_DRIFT'
  );
  if (
    !Array.isArray(authorization.candidateBindings) ||
    authorization.candidateBindings.length !== candidateIdentityKeys.length
  ) {
    fail('TEST_DELETION_AUTHORIZATION_DRIFT');
  }
  const identities = new Set();
  const paths = new Set();
  const candidateBindings = authorization.candidateBindings
    .map((binding) => {
      if (!isPlainObject(binding)) fail('TEST_DELETION_AUTHORIZATION_DRIFT');
      const normalized = {
        identityKey: nonEmptyString(binding.identityKey, 'TEST_DELETION_AUTHORIZATION_DRIFT'),
        testPath: nonEmptyString(binding.testPath, 'TEST_DELETION_AUTHORIZATION_DRIFT').replaceAll(
          '\\',
          '/'
        ),
        sourceSha256: nonEmptyString(binding.sourceSha256, 'TEST_DELETION_AUTHORIZATION_DRIFT'),
      };
      if (
        identities.has(normalized.identityKey) ||
        paths.has(normalized.testPath) ||
        !normalized.sourceSha256.startsWith('sha256:')
      ) {
        fail('TEST_DELETION_AUTHORIZATION_DRIFT');
      }
      identities.add(normalized.identityKey);
      paths.add(normalized.testPath);
      return normalized;
    })
    .sort((left, right) => compareText(left.identityKey, right.identityKey));

  if (
    candidateBindings.some(
      (binding, index) => binding.identityKey !== candidateIdentityKeys[index]
    ) ||
    authorization.batchHash !== sha256Bytes(canonicalJsonBytes(candidateIdentityKeys))
  ) {
    fail('TEST_DELETION_AUTHORIZATION_DRIFT');
  }
  return { candidateBindings, candidateIdentityKeys };
}

function maxBatchSize(policy) {
  const configured = policy?.deletion?.maxBatchSize;
  if (configured === undefined) return DEFAULT_MAX_BATCH_SIZE;
  if (!Number.isSafeInteger(configured) || configured < 1 || configured > DEFAULT_MAX_BATCH_SIZE) {
    fail('TEST_DELETION_POLICY_INVALID');
  }
  return configured;
}

function catalogIndex(catalog) {
  if (!isPlainObject(catalog) || !Array.isArray(catalog.tests)) {
    fail('TEST_DELETION_CATALOG_INVALID');
  }
  const byIdentity = new Map();
  for (const entry of catalog.tests) {
    if (!isPlainObject(entry) || typeof entry.identityKey !== 'string') {
      fail('TEST_DELETION_CATALOG_INVALID');
    }
    if (byIdentity.has(entry.identityKey)) fail('TEST_DELETION_CATALOG_INVALID');
    byIdentity.set(entry.identityKey, entry);
  }
  return byIdentity;
}

function protectedCapabilityIds(policy) {
  if (!isPlainObject(policy)) fail('TEST_DELETION_POLICY_INVALID');
  return new Set(
    (policy.protectedCapabilities || []).map((entry) =>
      nonEmptyString(entry?.capabilityId, 'TEST_DELETION_POLICY_INVALID')
    )
  );
}

function verifyDynamicEligibility({
  candidateIdentityKeys,
  candidates,
  catalogByIdentity,
  coreFreeze,
  impact,
}) {
  if (!Array.isArray(candidates)) fail('TEST_DELETION_AUTHORIZATION_DRIFT');
  const candidateByIdentity = new Map();
  for (const candidate of candidates) {
    if (!isPlainObject(candidate)) fail('TEST_DELETION_AUTHORIZATION_DRIFT');
    const identityKey = nonEmptyString(
      candidate.identityKey,
      'TEST_DELETION_AUTHORIZATION_DRIFT'
    );
    if (candidateByIdentity.has(identityKey)) fail('TEST_DELETION_AUTHORIZATION_DRIFT');
    candidateByIdentity.set(identityKey, candidate);
  }
  if (
    candidateByIdentity.size !== candidateIdentityKeys.length ||
    candidateIdentityKeys.some((identityKey) => !candidateByIdentity.has(identityKey))
  ) {
    fail('TEST_DELETION_AUTHORIZATION_DRIFT');
  }

  const coreIdentities = coreSelectedIdentities(coreFreeze);
  const impacted = impactedIdentities(impact);
  const uniqueProviders = uniqueObligationProviders(coreFreeze);
  for (const identityKey of candidateIdentityKeys) {
    const candidate = candidateByIdentity.get(identityKey);
    const catalogEntry = catalogByIdentity.get(identityKey);
    if (!catalogEntry) fail('TEST_DELETION_AUTHORIZATION_DRIFT', { identityKey });
    if (
      candidate.lifecycleState === 'core_permanent' ||
      catalogEntry.lifecycleState === 'core_permanent' ||
      coreIdentities.has(identityKey)
    ) {
      fail('CORE_TEST_CHANGE_REQUIRES_SEPARATE_FLOW', { identityKey });
    }
    if (candidate.lifecycleState !== 'deletion_candidate') {
      fail('TEST_DELETION_CANDIDATE_STATE_INVALID', { identityKey });
    }
    if (impacted.has(identityKey)) {
      fail('TEST_DELETION_CHANGED_CODE_IMPACTED', { identityKey });
    }
    if (uniqueProviders.has(identityKey)) {
      fail('TEST_DELETION_UNIQUE_OBLIGATION_PROVIDER', { identityKey });
    }
  }
}

function verifyPreconditions({
  repoRoot,
  authorization,
  catalog,
  policy,
  candidates,
  coreFreeze,
  impact,
}) {
  const { candidateBindings, candidateIdentityKeys } = normalizeBindings(authorization);
  if (candidateBindings.length > maxBatchSize(policy)) fail('TEST_DELETION_BATCH_TOO_LARGE');
  if (authorization.policyHash !== sha256Bytes(canonicalJsonBytes(policy))) {
    fail('TEST_DELETION_AUTHORIZATION_DRIFT');
  }

  const catalogByIdentity = catalogIndex(catalog);
  if (candidates || coreFreeze || impact) {
    if (!candidates || !coreFreeze || !impact) fail('TEST_DELETION_AUTHORIZATION_DRIFT');
    verifyDynamicEligibility({
      candidateIdentityKeys,
      candidates,
      catalogByIdentity,
      coreFreeze,
      impact,
    });
  }
  const protectedIds = protectedCapabilityIds(policy);
  const resolved = candidateBindings.map((binding) => {
    const entry = catalogByIdentity.get(binding.identityKey);
    if (!entry || entry.testPath?.replaceAll('\\', '/') !== binding.testPath) {
      fail('TEST_DELETION_AUTHORIZATION_DRIFT', { identityKey: binding.identityKey });
    }
    const protectedRefs = [
      ...(entry.capabilityRefs || []),
      ...(entry.classifications?.protectedCapabilityRefs || []),
    ];
    if (
      entry.lifecycleState === 'core_permanent' ||
      protectedRefs.some((ref) => protectedIds.has(ref))
    ) {
      fail('CORE_TEST_CHANGE_REQUIRES_SEPARATE_FLOW', { identityKey: binding.identityKey });
    }
    const repositoryFile = resolveRepositoryFile(repoRoot, binding.testPath);
    if (!fs.existsSync(repositoryFile.target) || !fs.lstatSync(repositoryFile.target).isFile()) {
      fail('TEST_DELETION_SOURCE_MISSING', { testPath: binding.testPath });
    }
    const bytes = fs.readFileSync(repositoryFile.target);
    if (sha256Bytes(bytes) !== binding.sourceSha256) {
      fail('TEST_DELETION_SOURCE_HASH_DRIFT', { testPath: binding.testPath });
    }
    return { ...binding, ...repositoryFile, bytes, mode: fs.statSync(repositoryFile.target).mode };
  });
  assertNoExternalTestBindings({
    repoRoot,
    candidatePaths: resolved.map((binding) => binding.normalized),
  });
  return { candidateIdentityKeys, resolved };
}

function backupDirectory(repoRoot, artifactsRoot, batchHash) {
  const root = path.resolve(repoRoot);
  const configuredRoot = artifactsRoot
    ? path.resolve(artifactsRoot)
    : path.join(root, '.artifacts', 'test-portfolio');
  const governedRoot = path.join(root, '.artifacts', 'test-portfolio');
  const relative = path.relative(governedRoot, configuredRoot);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail('TEST_DELETION_BACKUP_PATH_INVALID');
  }
  return path.join(
    configuredRoot,
    'deletion-backups',
    nonEmptyString(batchHash, 'TEST_DELETION_AUTHORIZATION_DRIFT').replace(':', '-')
  );
}

function writeBackups(repoRoot, directory, resolved) {
  if (fs.existsSync(directory)) fail('TEST_DELETION_BACKUP_ALREADY_EXISTS');
  assertNoSymlinkComponents(repoRoot, directory);
  for (const entry of resolved) {
    const backupPath = backupFilePath(directory, entry.normalized);
    mkdirParent(backupPath);
    fs.writeFileSync(backupPath, entry.bytes, { flag: 'wx', mode: entry.mode });
  }
  const manifest = {
    files: resolved.map((entry) => ({
      backupFile: path
        .relative(directory, backupFilePath(directory, entry.normalized))
        .replaceAll('\\', '/'),
      sourceSha256: entry.sourceSha256,
      testPath: entry.normalized,
    })),
    schemaVersion: 'test-deletion-backup/v1',
  };
  fs.writeFileSync(path.join(directory, 'manifest.json'), canonicalJsonBytes(manifest), {
    flag: 'wx',
  });
}

function backupFilePath(directory, testPath) {
  const encodedPath = Buffer.from(testPath, 'utf8').toString('base64url');
  return path.join(directory, 'files', `${encodedPath}.bin`);
}

function mkdirParent(target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
}

function restoreBatch(directory, resolved) {
  for (const entry of resolved) {
    const backupPath = backupFilePath(directory, entry.normalized);
    const bytes = fs.readFileSync(backupPath);
    if (sha256Bytes(bytes) !== entry.sourceSha256) {
      fail('TEST_DELETION_BACKUP_HASH_DRIFT', { testPath: entry.normalized });
    }
    mkdirParent(entry.target);
    fs.writeFileSync(entry.target, bytes, { mode: entry.mode });
  }
}

function verifyCleanTrackedPaths(repoRoot, resolved) {
  const paths = resolved.map((entry) => entry.normalized);
  const status = execFileSync('git', ['status', '--porcelain=v1', '--', ...paths], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (status.trim() !== '') fail('TEST_DELETION_SOURCE_DIRTY', { status: status.trim() });
  for (const testPath of paths) {
    try {
      execFileSync('git', ['ls-files', '--error-unmatch', '--', testPath], {
        cwd: repoRoot,
        stdio: 'ignore',
      });
    } catch {
      fail('TEST_DELETION_SOURCE_UNTRACKED', { testPath });
    }
  }
}

function stageDeletionBatch(repoRoot, resolved) {
  execFileSync('git', ['add', '-u', '--', ...resolved.map((entry) => entry.normalized)], {
    cwd: repoRoot,
    stdio: 'ignore',
  });
}

function stageRestoredBatch(repoRoot, resolved) {
  execFileSync('git', ['add', '--', ...resolved.map((entry) => entry.normalized)], {
    cwd: repoRoot,
    stdio: 'ignore',
  });
}

function removeBatch(resolved) {
  for (const entry of resolved) fs.rmSync(entry.target);
}

async function applyDeletionBatch({
  repoRoot,
  authorization,
  catalog,
  candidates,
  coreFreeze,
  impact,
  policy,
  validate,
  artifactsRoot,
}) {
  if (typeof validate !== 'function') fail('TEST_DELETION_VALIDATION_MISSING');
  const root = path.resolve(nonEmptyString(repoRoot, 'TEST_DELETION_REPOSITORY_INVALID'));
  const { candidateIdentityKeys, resolved } = verifyPreconditions({
    repoRoot: root,
    authorization,
    catalog,
    candidates,
    coreFreeze,
    impact,
    policy,
  });
  verifyCleanTrackedPaths(root, resolved);
  const backupDir = backupDirectory(root, artifactsRoot, authorization.batchHash);
  writeBackups(root, backupDir, resolved);
  try {
    removeBatch(resolved);
    stageDeletionBatch(root, resolved);
    let validation;
    try {
      validation = await validate({
        deletedIdentityKeys: candidateIdentityKeys,
        deletedPaths: resolved.map((entry) => entry.normalized).sort(compareText),
      });
    } catch (error) {
      validation = {
        passed: false,
        issueCode: error?.code || 'TEST_DELETION_VALIDATION_ERROR',
      };
    }
    if (!isPlainObject(validation) || validation.passed !== true) {
      restoreBatch(backupDir, resolved);
      stageRestoredBatch(root, resolved);
      fs.rmSync(backupDir, { recursive: true, force: true });
      return {
        batchHash: authorization.batchHash,
        issueCode: validation?.issueCode || 'TEST_DELETION_VALIDATION_FAILED',
        status: 'rolled_back',
      };
    }

    return {
      backupPath: path.relative(root, backupDir).replaceAll('\\', '/'),
      batchHash: authorization.batchHash,
      deletedIdentityKeys: candidateIdentityKeys,
      deletedPaths: resolved.map((entry) => entry.normalized).sort(compareText),
      status: 'applied',
      validationEvidence: isPlainObject(validation.evidence) ? validation.evidence : {},
    };
  } catch (error) {
    try {
      restoreBatch(backupDir, resolved);
      stageRestoredBatch(root, resolved);
      fs.rmSync(backupDir, { recursive: true, force: true });
    } catch (rollbackError) {
      error.rollbackError = rollbackError;
    }
    throw error;
  }
}

function resolveInputPath(repoRoot, inputPath, code) {
  const root = path.resolve(repoRoot);
  const target = path.resolve(root, nonEmptyString(inputPath, code));
  const relative = path.relative(root, target);
  if (relative === '' || relative === '..' || relative.startsWith(`..${path.sep}`)) fail(code);
  let current = root;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) fail(code);
  }
  return target;
}

function readJson(filePath, code) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    fail(code, { filePath });
  }
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) fail('TEST_DELETION_ARGUMENT_INVALID');
    parsed[key.slice(2)] = value;
  }
  for (const required of [
    'authorization',
    'candidates',
    'candidate-set',
    'catalog',
    'core-freeze',
    'impact',
  ]) {
    if (!parsed[required]) fail('TEST_DELETION_ARGUMENT_MISSING', { argument: required });
  }
  return parsed;
}

function validationCommands(authorization) {
  if (!Array.isArray(authorization.validationCommands)) {
    fail('TEST_DELETION_VALIDATION_MISSING');
  }
  const seenKinds = new Set();
  const commands = authorization.validationCommands.map((entry) => {
    if (!isPlainObject(entry)) fail('TEST_DELETION_VALIDATION_INVALID');
    const kind = nonEmptyString(entry.kind, 'TEST_DELETION_VALIDATION_INVALID');
    const command = nonEmptyString(entry.command, 'TEST_DELETION_VALIDATION_INVALID');
    if (!REQUIRED_VALIDATION_KINDS.includes(kind)) fail('TEST_DELETION_VALIDATION_INVALID');
    if (!Array.isArray(entry.args) || entry.args.some((argument) => typeof argument !== 'string')) {
      fail('TEST_DELETION_VALIDATION_INVALID');
    }
    seenKinds.add(kind);
    return { args: entry.args.slice(), command, kind };
  });
  if (REQUIRED_VALIDATION_KINDS.some((kind) => !seenKinds.has(kind))) {
    fail('TEST_DELETION_VALIDATION_MISSING');
  }
  return commands;
}

function writeAtomic(filePath, bytes) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, bytes, { flag: 'wx' });
    fs.renameSync(temporary, filePath);
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
}

function commandValidator({ repoRoot, authorization }) {
  const commands = validationCommands(authorization);
  const logRoot = path.join(
    repoRoot,
    '.artifacts',
    'test-portfolio',
    'deletion-batches',
    `${authorization.batchHash.replace(':', '-')}.validation`
  );
  return async () => {
    const commandEvidence = [];
    for (let index = 0; index < commands.length; index += 1) {
      const entry = commands[index];
      const runtimeCommand =
        process.platform === 'win32' && entry.command === 'npm' ? process.execPath : entry.command;
      const runtimeArgs =
        process.platform === 'win32' && entry.command === 'npm'
          ? [
              path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
              ...entry.args,
            ]
          : entry.args;
      const result = spawnSync(runtimeCommand, runtimeArgs, {
        cwd: repoRoot,
        encoding: 'utf8',
        env: process.env,
        maxBuffer: 32 * 1024 * 1024,
        shell: false,
      });
      const logPath = path.join(logRoot, `${String(index + 1).padStart(2, '0')}-${entry.kind}.log`);
      assertNoSymlinkComponents(repoRoot, logPath);
      writeAtomic(
        logPath,
        Buffer.from(
          [
            `command=${entry.command}`,
            `runtimeCommand=${runtimeCommand}`,
            `args=${JSON.stringify(entry.args)}`,
            `runtimeArgs=${JSON.stringify(runtimeArgs)}`,
            `exitCode=${result.status ?? 'null'}`,
            'stdout:',
            result.stdout || '',
            'stderr:',
            result.stderr || '',
          ].join('\n'),
          'utf8'
        )
      );
      commandEvidence.push({
        exitCode: result.status,
        kind: entry.kind,
        logPath: path.relative(repoRoot, logPath).replaceAll('\\', '/'),
      });
      if (result.error || result.status !== 0) {
        return {
          evidence: { commandEvidence },
          issueCode: 'TEST_DELETION_VALIDATION_COMMAND_FAILED',
          passed: false,
        };
      }
    }
    return {
      evidence: { commandCount: commands.length, commandEvidence },
      passed: true,
    };
  };
}

async function applyFromFiles({
  repoRoot = process.cwd(),
  authorizationPath,
  candidatesPath,
  candidateSet,
  catalogPath,
  coreFreezePath,
  impactPath,
  policyPath = 'repo-governance/ci/test-policy.json',
  registryPath = 'repo-governance/ci/test-deletion-exception-authorizations.json',
}) {
  const root = path.resolve(repoRoot);
  const authorization = readJson(
    resolveInputPath(root, authorizationPath, 'TEST_DELETION_AUTHORIZATION_PATH_INVALID'),
    'TEST_DELETION_AUTHORIZATION_INVALID'
  );
  const policy = readJson(
    resolveInputPath(root, policyPath, 'TEST_DELETION_POLICY_PATH_INVALID'),
    'TEST_DELETION_POLICY_INVALID'
  );
  const registry = readJson(
    resolveInputPath(root, registryPath, 'TEST_DELETION_REGISTRY_PATH_INVALID'),
    'TEST_DELETION_REGISTRY_INVALID'
  );
  verifyTrackedAuthorization({ registry, authorization });
  verifyDeletionExceptionAuthorization({ policy, registry, authorization });
  if (!isPlainObject(authorization.authorityBindings)) {
    fail('TEST_DELETION_AUTHORIZATION_DRIFT');
  }
  const authority = loadDeletionAuthorityArtifacts({
    repoRoot: root,
    candidatesPath,
    candidateSet,
    catalogPath,
    coreFreezePath,
    impactPath,
    policy,
  });
  if (
    !canonicalJsonBytes(authority.authorityBindings).equals(
      canonicalJsonBytes(authorization.authorityBindings)
    )
  ) {
    fail('TEST_DELETION_AUTHORIZATION_DRIFT');
  }
  const result = await applyDeletionBatch({
    repoRoot: root,
    authorization,
    catalog: authority.catalog,
    candidates: authority.normalizedCandidates,
    coreFreeze: authority.coreFreeze,
    impact: authority.impact,
    policy,
    validate: commandValidator({ repoRoot: root, authorization }),
  });
  const resultPath = path.join(
    root,
    '.artifacts',
    'test-portfolio',
    'deletion-batches',
    `${authorization.batchHash.replace(':', '-')}.result.json`
  );
  assertNoSymlinkComponents(root, resultPath);
  writeAtomic(resultPath, canonicalJsonBytes(result));
  return {
    ...result,
    resultPath: path.relative(root, resultPath).replaceAll('\\', '/'),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await applyFromFiles({
    authorizationPath: args.authorization,
    candidatesPath: args.candidates,
    candidateSet: args['candidate-set'],
    catalogPath: args.catalog,
    coreFreezePath: args['core-freeze'],
    impactPath: args.impact,
    policyPath: args.policy,
    registryPath: args.registry,
  });
  process.stdout.write(`${canonicalJsonBytes(result).toString('utf8')}\n`);
  if (result.status !== 'applied') process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error?.code || error?.message || 'TEST_DELETION_BATCH_FAILED'}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  applyDeletionBatch,
  applyFromFiles,
  resolveRepositoryFile,
  verifyPreconditions,
};
