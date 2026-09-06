import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  closeSync,
  copyFileSync,
  constants,
  openSync,
  fstatSync,
  readSync,
  realpathSync,
  linkSync,
  lstatSync,
  mkdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

export const MAX_JSON_BYTES = 4 * 1024 * 1024;
export const SCHEMA_VERSION = 'GovernedFeatureDeliveryCheckpoint/v1';
export const GATE_REPLAY_REASON = 'committed change requires gate replay';
export const MAX_SCOPE_PATHS = 256;
export const MAX_SCOPE_PATH_CHARS = 24 * 1024;
export const MAX_EVIDENCE_INPUTS = 1024;
export const MAX_REPO_PATH_LENGTH = 1024;
export const MAX_STATE_HISTORY = 128;
export const MAX_SCOPE_DELTAS = 256;
export const MAX_EVIDENCE_ENTRIES = 256;
export const MAX_HASH_FILES = 2048;
export const MAX_HASH_BYTES = 256 * 1024 * 1024;
export const MAX_IGNORED_GOVERNED_PATHS = 2048;
export const MAX_IGNORED_GOVERNED_BYTES = 1024 * 1024;
export const MIN_NODE_VERSION = '18.17.0';
export const MIN_GIT_VERSION = '2.31.0';
export const STATES = [
  'DISCOVERED',
  'SPEC_FROZEN',
  'PHASE_PLANNED',
  'RED_CONFIRMED',
  'GREEN_CONFIRMED',
  'STOP_GATE_GREEN',
  'REVIEWED',
  'PR_GREEN',
  'MERGED',
  'NEXT_PHASE',
  'RELEASED',
];

export const NEXT_ACTIONS = {
  DISCOVERED: 'FREEZE_SPEC',
  SPEC_FROZEN: 'WRITE_PHASE_PLAN',
  PHASE_PLANNED: 'WRITE_RED_ACCEPTANCE',
  RED_CONFIRMED: 'IMPLEMENT',
  GREEN_CONFIRMED: 'RUN_STOP_GATES',
  STOP_GATE_GREEN: 'REQUEST_REVIEW',
  REVIEWED: 'OPEN_PR',
  PR_GREEN: 'MERGE_PHASE',
  MERGED: 'SIGN_SUCCESSOR',
  NEXT_PHASE: 'INITIALIZE_NEXT_PHASE',
  RELEASED: 'HALT_FOR_DECISION',
};

export const NEXT_ACTION_TEXT = {
  FREEZE_SPEC: 'freeze the stable design spec with an external receipt',
  WRITE_PHASE_PLAN: 'write the active phase plan and authorized scope manifest',
  WRITE_RED_ACCEPTANCE: 'write and observe RED acceptance',
  IMPLEMENT: 'implement only the authorized active phase scope',
  RUN_STOP_GATES: 'run the declared phase stop gates',
  REQUEST_REVIEW: 'request review of the current head',
  OPEN_PR: 'open or update the active phase pull request',
  MERGE_PHASE: 'merge the active phase using repository policy',
  SIGN_SUCCESSOR: 'record an exact allowlisted successor signal',
  INITIALIZE_NEXT_PHASE: 'initialize the exact signaled next phase with inherited frozen authorities and a new plan and scope manifest',
  RECONSTRUCT_FROM_EVIDENCE: 'replay only canonical hash-bound evidence',
  HALT_FOR_DECISION: 'halt until a new explicitly authorized feature begins',
};

const DELIVERY_STAGES = ['Plan', 'Baseline', 'Implement', 'Verify', 'Commit', 'Next'];
const RISK_PATTERNS = [
  ['protected path', /(^|[\/._-])(protected|security|auth|authentication|authenticate|authn|authz|authorization|permission|permissions|acl|iam|release)([\/._-]|$)/iu],
  ['shared contract', /(^|[\/._-])(schema|schemas|migration|migrations|contract|contracts|shared|sharedtypes|shared-types|shared_types)([\/._-]|$)/iu],
  ['CI or infrastructure', /(^|\/)(\.github|\.gitlab-ci\.yml|\.circleci|Jenkinsfile|azure-pipelines\.yml|ci|deploy|infra|Dockerfile|docker-compose)(\/|\.|$)/iu],
  ['database or release surface', /(^|\/)(db|database|publish|release|\.changeset|package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lock|bun\.lockb|pyproject\.toml|poetry\.lock|uv\.lock|setup\.py|setup\.cfg|requirements(?:-[^/]*)?\.txt|Pipfile|Pipfile\.lock|Cargo\.toml|Cargo\.lock|go\.mod|go\.sum|pom\.xml|build\.gradle|build\.gradle\.kts|gradle\.properties|Gemfile|Gemfile\.lock|[^/]+\.gemspec|composer\.json|composer\.lock)(\/|\.|$)/iu],
];
const RISK_NAME_TOKENS = [
  'protected', 'security', 'auth', 'authentication', 'authenticate', 'authn', 'authz', 'authorization',
  'permission', 'permissions', 'acl', 'iam', 'release', 'schema', 'schemas', 'migration', 'migrations',
  'contract', 'contracts', 'shared', 'sharedtypes', 'shared-types', 'shared_types', 'ci', 'deploy', 'infra',
  'db', 'database', 'publish',
];
const RISK_MANIFEST_NAMES = [
  '.gitlab-ci.yml', 'Jenkinsfile', 'azure-pipelines.yml', 'Dockerfile*', 'docker-compose*', 'package.json',
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb', 'pyproject.toml', 'poetry.lock',
  'uv.lock', 'setup.py', 'setup.cfg', 'requirements*.txt', 'Pipfile', 'Pipfile.lock', 'Cargo.toml', 'Cargo.lock',
  'go.mod', 'go.sum', 'pom.xml', 'build.gradle', 'build.gradle.kts', 'gradle.properties', 'Gemfile',
  'Gemfile.lock', '*.gemspec', 'composer.json', 'composer.lock',
];
const MANAGED_ARTIFACT_ROOTS = [
  '.artifacts/governed-feature-delivery',
  '.artifacts/governed-feature-delivery-fallback',
];
export const MANAGED_ARTIFACT_PATHSPEC_EXCLUSIONS = MANAGED_ARTIFACT_ROOTS.map((root) => `:(exclude)${root}/**`);
const IGNORED_DEPENDENCY_EXCLUSIONS = [
  'node_modules', '.pnpm', '.yarn/cache', '.venv', 'venv', '__pycache__', '.gradle', 'target', 'vendor',
].flatMap((directory) => [`:(exclude)${directory}/**`, `:(exclude)**/${directory}/**`]);
const BUILTIN_IGNORED_RISK_CANDIDATES = [
  '.github/**', '**/.github/**', '.circleci/**', '**/.circleci/**', '.changeset/**', '**/.changeset/**',
  ...RISK_NAME_TOKENS.flatMap((token) => [`*${token}*`, `**/*${token}*`]),
  ...RISK_MANIFEST_NAMES.flatMap((name) => [name, `**/${name}`]),
];
const DEFAULT_HASH_BUDGET = createHashBudget();
let gitVersionChecked = false;

export function versionAtLeast(actual, minimum) {
  const left = actual.split('.').slice(0, 3).map(Number);
  const right = minimum.split('.').slice(0, 3).map(Number);
  if (left.length !== 3 || right.length !== 3 || [...left, ...right].some((part) => !Number.isInteger(part))) return false;
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] > right[index];
  }
  return true;
}

if (!versionAtLeast(process.versions.node, MIN_NODE_VERSION)) {
  throw new Error(`governed-feature-delivery requires Node ${MIN_NODE_VERSION} or newer; found ${process.versions.node}`);
}

export function createHashBudget({ maxFiles = MAX_HASH_FILES, maxBytes = MAX_HASH_BYTES, parent = null } = {}) {
  return { files: 0, bytes: 0, maxFiles, maxBytes, parent };
}

function reserveHashRead(filePath, size, budget) {
  if (budget.files + 1 > budget.maxFiles) throw new Error(`hash file budget exceeds ${budget.maxFiles}`);
  if (budget.bytes + size > budget.maxBytes) throw new Error(`hash byte budget exceeds ${budget.maxBytes}`);
  if (budget.parent) reserveHashRead(filePath, size, budget.parent);
  budget.files += 1;
  budget.bytes += size;
}

function sameFileIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

export function readFileForHash(filePath, budget = DEFAULT_HASH_BUDGET) {
  const limit = 64 * 1024 * 1024;
  const canonicalBefore = realpathSync(filePath);
  const handle = openSync(filePath, 'r');
  try {
    const initial = fstatSync(handle);
    const pathInitial = statSync(filePath);
    if (!sameFileIdentity(initial, pathInitial) || realpathSync(filePath) !== canonicalBefore) throw new Error(`hash input changed while opening: ${filePath}`);
    if (initial.size > limit) throw new Error(`refusing to hash file larger than 64 MiB: ${filePath}`);
    reserveHashRead(filePath, initial.size, budget);
    const chunks = [];
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let total = 0;
    while (true) {
      const bytesRead = readSync(handle, buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      total += bytesRead;
      if (total > limit) throw new Error(`file grew beyond 64 MiB while hashing: ${filePath}`);
      if (total > initial.size) {
        const growth = total - Math.max(initial.size, total - bytesRead);
        if (budget.bytes + growth > budget.maxBytes) throw new Error(`hash byte budget exceeds ${budget.maxBytes}`);
        budget.bytes += growth;
      }
      chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
    }
    const final = fstatSync(handle);
    const pathFinal = statSync(filePath);
    if (!sameFileIdentity(initial, final) || !sameFileIdentity(final, pathFinal) || final.size !== initial.size || total !== initial.size || final.mtimeMs !== initial.mtimeMs || final.ctimeMs !== initial.ctimeMs || realpathSync(filePath) !== canonicalBefore) {
      throw new Error(`hash input changed while reading: ${filePath}`);
    }
    return Buffer.concat(chunks, total);
  } finally {
    closeSync(handle);
  }
}

export function legacyProgress(checkpoint, warnings = []) {
  const index = {
    DISCOVERED: 0, SPEC_FROZEN: 0, PHASE_PLANNED: 1, RED_CONFIRMED: 2,
    GREEN_CONFIRMED: 3, STOP_GATE_GREEN: 3, REVIEWED: 4, PR_GREEN: 4,
    MERGED: 5, NEXT_PHASE: 5, RELEASED: 5,
  }[checkpoint.state] ?? 0;
  return {
    stage: DELIVERY_STAGES[index],
    completed: DELIVERY_STAGES.slice(0, index),
    next: checkpoint.nextExactAction,
    updatedAt: new Date().toISOString(),
    warnings,
  };
}

export function parseArgs(argv, repeatable = new Set(), allowed = null) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`unexpected argument: ${token}`);
    const key = token.slice(2);
    if (key === 'help') {
      result.help = true;
      continue;
    }
    if (allowed && !allowed.has(key)) throw new Error(`unknown option: --${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for --${key}`);
    index += 1;
    if (repeatable.has(key)) result[key] = [...(result[key] ?? []), value];
    else if (Object.hasOwn(result, key)) throw new Error(`duplicate option: --${key}`);
    else result[key] = value;
  }
  return result;
}

export function required(options, key) {
  if (!options[key]) throw new Error(`--${key} is required`);
  return options[key];
}

export function readJson(filePath) {
  const handle = openSync(filePath, 'r');
  try {
    const size = fstatSync(handle).size;
    if (size > MAX_JSON_BYTES) throw new Error(`refusing to read JSON larger than ${MAX_JSON_BYTES} bytes: ${filePath}`);
    const chunks = [];
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let total = 0;
    while (true) {
      const bytesRead = readSync(handle, buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      total += bytesRead;
      if (total > MAX_JSON_BYTES) throw new Error(`JSON grew beyond ${MAX_JSON_BYTES} bytes while reading: ${filePath}`);
      chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
    }
    return JSON.parse(Buffer.concat(chunks, total).toString('utf8'));
  } finally {
    closeSync(handle);
  }
}

export function sha256Text(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function isIsoDateTime(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/u.exec(value);
  if (!match) return false;
  const [, year, month, day, hour, minute, second, offsetHour = '00', offsetMinute = '00'] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() + 1 !== Number(month) || date.getUTCDate() !== Number(day)) return false;
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59 || Number(offsetHour) > 23 || Number(offsetMinute) > 59) return false;
  return !Number.isNaN(Date.parse(value));
}

export function sha256File(filePath, budget = DEFAULT_HASH_BUDGET) {
  return createHash('sha256').update(readFileForHash(filePath, budget)).digest('hex');
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function git(repo, args) {
  if (!gitVersionChecked) {
    const versionOutput = execFileSync('git', ['--version'], { encoding: 'utf8', maxBuffer: 1024 }).trim();
    const actualVersion = /\b(\d+\.\d+\.\d+)\b/u.exec(versionOutput)?.[1];
    if (!actualVersion || !versionAtLeast(actualVersion, MIN_GIT_VERSION)) throw new Error(`governed-feature-delivery requires Git ${MIN_GIT_VERSION} or newer; found ${versionOutput}`);
    gitVersionChecked = true;
  }
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }).trim();
}

export function gitNullPaths(repo, args) {
  const output = execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  return output.split('\0').filter(Boolean).map((entry) => entry.replaceAll('\\', '/'));
}

export function repositoryCaseSemantics(repo) {
  try { return { ignoreCase: git(repo, ['config', '--bool', 'core.ignorecase']) === 'true' }; }
  catch (error) {
    if (error.status === 1) return { ignoreCase: false };
    throw error;
  }
}

export function repositoryPathKey(value, { ignoreCase = false } = {}) {
  const normalized = value.replaceAll('\\', '/');
  return ignoreCase ? normalized.toLowerCase() : normalized;
}

function riskComparablePath(value) {
  return value.replace(/([A-Z]+)([A-Z][a-z])/gu, '$1-$2').replace(/([a-z0-9])([A-Z])/gu, '$1-$2');
}

export function riskReasonsForPath(value) {
  return RISK_PATTERNS.filter(([, pattern]) => pattern.test(riskComparablePath(value))).map(([reason]) => reason);
}

function ignoredPathsForSpecs(repo, pathspecs, exclusions = MANAGED_ARTIFACT_PATHSPEC_EXCLUSIONS) {
  if (pathspecs.length === 0) return [];
  const output = execFileSync('git', ['-C', repo, 'ls-files', '-z', '--others', '--ignored', '--exclude-standard', '--', ...pathspecs, ...exclusions], {
    encoding: 'utf8', maxBuffer: MAX_IGNORED_GOVERNED_BYTES, timeout: 30_000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  return output.split('\0').filter(Boolean).map((entry) => entry.replaceAll('\\', '/'));
}

export function governedIgnoredFingerprint(repo, declaredPathspecs = [], aggregateBudget = DEFAULT_HASH_BUDGET) {
  const declared = ignoredPathsForSpecs(repo, [...new Set(declaredPathspecs)]);
  const builtin = ignoredPathsForSpecs(repo, BUILTIN_IGNORED_RISK_CANDIDATES, [...IGNORED_DEPENDENCY_EXCLUSIONS, ...MANAGED_ARTIFACT_PATHSPEC_EXCLUSIONS])
    .filter((file) => riskReasonsForPath(file).length > 0);
  const paths = [...new Set([...declared, ...builtin])]
    .filter((file) => !isManagedArtifactPath(file))
    .sort();
  if (paths.length > MAX_IGNORED_GOVERNED_PATHS) throw new Error(`ignored governed path budget exceeded (${MAX_IGNORED_GOVERNED_PATHS})`);
  const budget = createHashBudget({ maxFiles: MAX_IGNORED_GOVERNED_PATHS, maxBytes: MAX_IGNORED_GOVERNED_BYTES, parent: aggregateBudget });
  const entries = paths.map((file) => {
    const filePath = resolveRepoPath(repo, file, `ignored governed path ${file}`);
    const stats = lstatSync(filePath);
    const type = stats.isFile() ? 'file' : stats.isDirectory() ? 'directory' : stats.isSymbolicLink() ? 'symlink' : 'other';
    return { path: file, hash: stats.isFile() ? sha256File(filePath, budget) : null, type, mode: stats.mode.toString(8), size: stats.size };
  });
  return { entries, hash: objectHash(entries) };
}

export function changedIgnoredGovernedPaths(expected, actual) {
  const expectedEntries = new Map((expected?.entries ?? []).map((entry) => [entry.path, entry]));
  const actualEntries = new Map((actual?.entries ?? []).map((entry) => [entry.path, entry]));
  return [...new Set([...expectedEntries.keys(), ...actualEntries.keys()])]
    .filter((file) => objectHash(expectedEntries.get(file) ?? null) !== objectHash(actualEntries.get(file) ?? null));
}

export function listWorktreePaths(repo) {
  const working = gitNullPaths(repo, ['diff', '--no-renames', '--name-only', '-z', '--diff-filter=ACDMRTUXB', '--', ...MANAGED_ARTIFACT_PATHSPEC_EXCLUSIONS]);
  const staged = gitNullPaths(repo, ['diff', '--no-renames', '--cached', '--name-only', '-z', '--diff-filter=ACDMRTUXB', '--', ...MANAGED_ARTIFACT_PATHSPEC_EXCLUSIONS]);
  const untracked = gitNullPaths(repo, ['ls-files', '-z', '--others', '--exclude-standard', '--', ...MANAGED_ARTIFACT_PATHSPEC_EXCLUSIONS]);
  return [...new Set([...working, ...staged, ...untracked].filter((value) => !isManagedArtifactPath(value)))];
}

function isPhaseIntegrationRef(ref, phaseBranch) {
  if (!phaseBranch || phaseBranch === 'DETACHED') return false;
  if (ref === `refs/heads/${phaseBranch}`) return true;
  if (!ref.startsWith('refs/remotes/')) return false;
  const remoteBranch = ref.slice('refs/remotes/'.length);
  const separator = remoteBranch.indexOf('/');
  return separator >= 0 && remoteBranch.slice(separator + 1) === phaseBranch;
}

export function validateStrongMerge(repo, { phaseBranch, reviewedSha, merge, integrationRefs = [], requireLiveRef = true }) {
  const expectedKeys = ['containsReviewedSha', 'mergedAt', 'ref', 'sha'];
  if (!merge || Object.keys(merge).sort().join(',') !== expectedKeys.sort().join(',') || !/^[a-f0-9]{40,64}$/u.test(merge.sha ?? '') || !/^refs\/(heads|remotes)\//u.test(merge.ref ?? '') || merge.containsReviewedSha !== reviewedSha || !isIsoDateTime(merge.mergedAt)) {
    throw new Error('MERGED requires sha, full integration ref, reviewed-head binding, and timestamp');
  }
  if (isPhaseIntegrationRef(merge.ref, phaseBranch)) throw new Error('MERGED integration ref must not be the phase branch or its remote-tracking alias');
  if (integrationRefs.length > 0 && !integrationRefs.includes(merge.ref)) throw new Error('merge ref is not allowed by source risk policy');

  const mergeSha = git(repo, ['rev-parse', `${merge.sha}^{commit}`]).toLowerCase();
  if (requireLiveRef && (git(repo, ['rev-parse', '--symbolic-full-name', merge.ref]) !== merge.ref || git(repo, ['rev-parse', merge.ref]).toLowerCase() !== mergeSha)) {
    throw new Error('MERGED integration ref does not resolve to the merge commit');
  }
  const commitLine = git(repo, ['rev-list', '--parents', '-n', '1', mergeSha]).split(/\s+/u);
  if (mergeSha === reviewedSha || commitLine.length < 3) throw new Error('MERGED requires a distinct merge commit with at least two parents');
  git(repo, ['merge-base', '--is-ancestor', reviewedSha, mergeSha]);
  try {
    git(repo, ['merge-base', '--is-ancestor', reviewedSha, commitLine[1]]);
  } catch (error) {
    if (error.status === 1) return { ...merge, sha: mergeSha };
    throw error;
  }
  throw new Error('MERGED first parent already contains the reviewed head');
}

function relativeEscapesRoot(relative) {
  return path.isAbsolute(relative) || relative === '..' || relative.startsWith(`..${path.sep}`);
}

export function artifactPath(repo, filePath) {
  if (!filePath) return null;
  const absolute = path.resolve(repo, filePath);
  const relative = path.relative(repo, absolute);
  if (relativeEscapesRoot(relative)) throw new Error(`artifact must stay inside repository: ${filePath}`);
  return relative.replaceAll(path.sep, '/');
}

function assertNoLinkedComponents(repo, absolute, label) {
  const relative = path.relative(path.resolve(repo), absolute);
  let current = path.resolve(repo);
  for (const component of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    if (!existsSync(current)) break;
    if (lstatSync(current).isSymbolicLink()) throw new Error(`${label} contains a symbolic link or junction`);
  }
}

export function resolveRepoPath(repo, value, label, { output = false, allowMissing = false } = {}) {
  if (!value || path.isAbsolute(value)) throw new Error(`${label} must be a repository-relative path`);
  const absolute = path.resolve(repo, value);
  const relative = path.relative(repo, absolute);
  if (relativeEscapesRoot(relative)) throw new Error(`${label} escapes the repository`);
  if (!output && !allowMissing && !existsSync(absolute)) throw new Error(`${label} does not exist`);
  assertNoLinkedComponents(repo, absolute, label);
  const anchor = output ? path.dirname(absolute) : absolute;
  let existing = anchor;
  while (!existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) throw new Error(`${label} has no existing repository ancestor`);
    existing = parent;
  }
  const realRepo = realpathSync(repo);
  const realExisting = realpathSync(existing);
  const realRelative = path.relative(realRepo, realExisting);
  if (relativeEscapesRoot(realRelative)) throw new Error(`${label} resolves outside the repository`);
  if (!output && existsSync(absolute)) return realpathSync(absolute);
  const canonical = path.resolve(realExisting, path.relative(existing, absolute));
  const canonicalRelative = path.relative(realRepo, canonical);
  if (relativeEscapesRoot(canonicalRelative)) throw new Error(`${label} resolves outside the repository`);
  return canonical;
}

export function canonicalRepoRelativePath(value) {
  const normalized = path.posix.normalize(value.replaceAll('\\', '/'));
  return normalized.startsWith('./') ? normalized.slice(2) : normalized;
}

function unsupportedScopePattern(value) {
  if (/\[\[:/u.test(value)) return true;
  for (const match of value.matchAll(/\*{2,}/gu)) {
    if (match[0] !== '**') return true;
    const start = match.index;
    const end = start + 2;
    if (!((start === 0 || value[start - 1] === '/') && (end === value.length || value[end] === '/'))) return true;
  }
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '[') continue;
    const end = value.indexOf(']', index + 1);
    if (end === -1 || end === index + 1 || value.slice(index + 1, end).includes('[')) return true;
    index = end;
  }
  return false;
}

export function normalizeScope(value) {
  if (value !== null && value !== undefined && (typeof value !== 'object' || Array.isArray(value))) {
    throw new Error('authorizedScope must be an object');
  }
  const scope = { ...(value ?? {}) };
  const allowedKeys = new Set(['allowedPaths', 'protectedPaths', 'forbiddenWork', 'evidenceInputs']);
  if (Object.keys(scope).some((key) => !allowedKeys.has(key))) throw new Error('authorizedScope contains unknown fields');
  for (const key of ['allowedPaths', 'protectedPaths', 'forbiddenWork']) {
    const entries = scope[key] ?? [];
    if (!Array.isArray(entries) || entries.some((entry) => typeof entry !== 'string' || entry.trim().length === 0 || entry.length > MAX_REPO_PATH_LENGTH || path.isAbsolute(entry) || /^[a-z]:[\\/]/iu.test(entry) || entry.split(/[\\/]/u).includes('..') || entry.startsWith('!') || entry.startsWith(':'))) {
      throw new Error(`authorizedScope.${key} must contain positive repository-relative Git pathspecs`);
    }
    scope[key] = [...new Set(entries.map(canonicalRepoRelativePath))].sort();
    if (scope[key].some(unsupportedScopePattern)) throw new Error(`authorizedScope.${key} contains an unsupported path pattern`);
    if (scope[key].some((entry) => isReservedRepositoryPath(entry, { pattern: true }))) {
      throw new Error(`authorizedScope.${key} contains a reserved repository-internal path`);
    }
  }
  const scopePaths = ['allowedPaths', 'protectedPaths', 'forbiddenWork'].flatMap((key) => scope[key]);
  if (scopePaths.length > MAX_SCOPE_PATHS || scopePaths.reduce((total, entry) => total + entry.length, 0) > MAX_SCOPE_PATH_CHARS) throw new Error('authorizedScope pathspec budget exceeded');
  const evidenceInputs = scope.evidenceInputs ?? {};
  if (typeof evidenceInputs !== 'object' || Array.isArray(evidenceInputs)) throw new Error('authorizedScope.evidenceInputs must be an object');
  const evidenceKinds = ['acceptance-red', 'implementation-green', 'stop-gate'];
  if (Object.keys(evidenceInputs).some((kind) => !evidenceKinds.includes(kind))) throw new Error('authorizedScope.evidenceInputs contains an unknown gate kind');
  scope.evidenceInputs = {};
  for (const kind of evidenceKinds) {
    const entries = evidenceInputs[kind] ?? [];
    if (!Array.isArray(entries) || entries.some((entry) => typeof entry !== 'string' || entry.trim().length === 0 || entry.length > MAX_REPO_PATH_LENGTH || path.isAbsolute(entry) || /^[a-z]:[\\/]/iu.test(entry) || entry.split(/[\\/]/u).includes('..'))) {
      throw new Error(`authorizedScope.evidenceInputs.${kind} must contain repository-relative file paths`);
    }
    scope.evidenceInputs[kind] = [...new Set(entries.map(canonicalRepoRelativePath))].sort();
    if (scope.evidenceInputs[kind].some((entry) => isReservedRepositoryPath(entry))) throw new Error(`authorizedScope.evidenceInputs.${kind} contains a reserved repository-internal path`);
  }
  if (Object.values(scope.evidenceInputs).reduce((total, entries) => total + entries.length, 0) > MAX_EVIDENCE_INPUTS) throw new Error('authorizedScope evidence input budget exceeded');
  return scope;
}

function scopePathShape(value) {
  const normalized = value.replaceAll('\\', '/');
  if (normalized === '.') return { glob: false, prefix: '' };
  const wildcard = normalized.search(/[?*[\]]/u);
  return { glob: wildcard !== -1, prefix: wildcard === -1 ? normalized.replace(/\/$/u, '') : normalized.slice(0, wildcard) };
}

export function isManagedArtifactPath(value) {
  const normalized = value.replaceAll('\\', '/').replace(/^\.\//u, '').replace(/\/+$/u, '');
  const comparable = normalized.toLowerCase();
  return MANAGED_ARTIFACT_ROOTS.some((root) => comparable === root || comparable.startsWith(`${root}/`));
}

export function isReservedRepositoryPath(value, { pattern = false } = {}) {
  const normalized = value.replaceAll('\\', '/').replace(/^\.\//u, '').replace(/\/+$/u, '');
  if (normalized.split('/').some((segment) => segment.toLowerCase() === '.git')) return true;
  if (!pattern) return isManagedArtifactPath(normalized);
  if (normalized === '.') return false;
  return MANAGED_ARTIFACT_ROOTS.some((root) => scopePatternsOverlap(normalized.toLowerCase(), root));
}

function globRegexSource(pattern) {
  let source = '';
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === '*') {
      if (pattern[index + 1] === '*') {
        index += 1;
        if (pattern[index + 1] === '/') {
          index += 1;
          source += '(?:.*/)';
        } else source += '.*';
      } else source += '.*';
    } else if (character === '?') source += '.';
    else if (character === '[') {
      const end = pattern.indexOf(']', index + 1);
      if (end === -1) source += '\\[';
      else {
        let contents = pattern.slice(index + 1, end);
        if (contents.startsWith('!')) contents = `^${contents.slice(1)}`;
        source += `[${contents.replaceAll('\\', '\\\\')}]`;
        index = end;
      }
    } else source += character.replace(/[\\^$+?.()|{}]/gu, '\\$&');
  }
  return source;
}

export function scopePatternCoversConcretePath(pattern, concretePath) {
  const normalizedPattern = pattern.replaceAll('\\', '/').replace(/^\.\//u, '').replace(/\/+$/u, '');
  const normalizedPath = concretePath.replaceAll('\\', '/').replace(/^\.\//u, '').replace(/\/+$/u, '');
  if (normalizedPattern === '.') return true;
  if (!/[?*[\]]/u.test(normalizedPattern)) {
    return normalizedPath === normalizedPattern || normalizedPath.startsWith(`${normalizedPattern}/`);
  }
  return new RegExp(`^${globRegexSource(normalizedPattern)}$`, 'u').test(normalizedPath);
}

export function scopePatternsOverlap(left, right) {
  const a = scopePathShape(left);
  const b = scopePathShape(right);
  if (!a.prefix || !b.prefix) return true;
  if (!a.glob && !b.glob) return a.prefix === b.prefix || a.prefix.startsWith(`${b.prefix}/`) || b.prefix.startsWith(`${a.prefix}/`);
  if (a.glob && b.glob) return a.prefix.startsWith(b.prefix) || b.prefix.startsWith(a.prefix);
  const pattern = a.glob ? a : b;
  const literal = a.glob ? b : a;
  return literal.prefix.startsWith(pattern.prefix) || pattern.prefix.startsWith(`${literal.prefix}/`);
}

export function assertMonotonicScopeDelta(parentValue, nextValue) {
  const parent = normalizeScope(parentValue);
  const next = normalizeScope(nextValue);
  for (const key of ['allowedPaths', 'protectedPaths', 'forbiddenWork']) {
    const nextEntries = new Set(next[key]);
    if (parent[key].some((entry) => !nextEntries.has(entry))) throw new Error(`scope delta ${key} must preserve every parent entry`);
  }
  for (const kind of Object.keys(parent.evidenceInputs)) {
    const nextEntries = new Set(next.evidenceInputs[kind]);
    if (parent.evidenceInputs[kind].some((entry) => !nextEntries.has(entry))) throw new Error(`scope delta evidenceInputs.${kind} must preserve every parent entry`);
  }
  const parentAllowed = new Set(parent.allowedPaths);
  const newAllowed = next.allowedPaths.filter((entry) => !parentAllowed.has(entry));
  if (newAllowed.some((allowed) => parent.forbiddenWork.some((forbidden) => scopePatternsOverlap(allowed, forbidden)))) {
    throw new Error('scope delta new allowed path overlaps parent forbidden work');
  }
  return next;
}

export function scopeHash(value) {
  return sha256Text(canonicalJson(normalizeScope(value)));
}

export function policyHash(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => key !== 'allowedCodes') || !value.allowedCodes || typeof value.allowedCodes !== 'object' || Array.isArray(value.allowedCodes) || Object.keys(value.allowedCodes).some((code) => code.trim().length === 0) || Object.values(value.allowedCodes).some((target) => typeof target !== 'string' || target.trim().length === 0)) {
    throw new Error('successor policy must contain a non-null allowedCodes object');
  }
  return sha256Text(canonicalJson(value));
}

export function objectHash(value) {
  return sha256Text(canonicalJson(value));
}

export function validateAuthorityPolicy(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('authority policy must be an object');
  const roles = ['designFreeze', 'recovery', 'scopeDelta', 'review', 'successor', 'release'];
  if (Object.keys(value).some((key) => !roles.includes(key))) throw new Error('authority policy contains an unknown role');
  for (const role of roles) {
    if (!Array.isArray(value[role]) || value[role].length === 0 || value[role].some((entry) => typeof entry !== 'string' || entry.trim().length === 0)) throw new Error(`authority policy requires ${role}`);
  }
  return value;
}

export function authorityAllowed(policy, role, authority) {
  return validateAuthorityPolicy(policy)[role].includes(authority);
}

function prepareOutput(filePath, repo) {
  const requested = path.resolve(filePath);
  mkdirSync(path.dirname(requested), { recursive: true });
  if (repo) assertNoLinkedComponents(repo, requested, 'checkpoint output');
  const stableParent = realpathSync(path.dirname(requested));
  if (repo) {
    const relative = path.relative(realpathSync(repo), stableParent);
    if (relativeEscapesRoot(relative)) throw new Error('checkpoint output parent resolves outside the repository');
  }
  const absolute = path.join(stableParent, path.basename(requested));
  return { requested, stableParent, absolute };
}

function assertOutputParentStable(requested, stableParent, repo) {
  if (repo) assertNoLinkedComponents(repo, requested, 'checkpoint output');
  if (realpathSync(path.dirname(requested)) !== stableParent) throw new Error('checkpoint output parent changed during write');
}

export function writeExclusiveJson(filePath, value, repo = null) {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  if (Buffer.byteLength(serialized, 'utf8') > MAX_JSON_BYTES) throw new Error(`refusing to write JSON larger than ${MAX_JSON_BYTES} bytes: ${filePath}`);
  const { requested, stableParent, absolute } = prepareOutput(filePath, repo);
  if (existsSync(absolute)) throw new Error(`refusing to overwrite checkpoint: ${absolute}`);
  const temporary = `${absolute}.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, serialized, { encoding: 'utf8', flag: 'wx' });
    assertOutputParentStable(requested, stableParent, repo);
    try {
      linkSync(temporary, absolute);
    } catch (error) {
      if (!['EPERM', 'EOPNOTSUPP', 'ENOTSUP', 'EXDEV'].includes(error.code)) throw error;
      copyFileSync(temporary, absolute, constants.COPYFILE_EXCL);
    }
  } catch (error) {
    try { rmSync(temporary, { force: true }); } catch {}
    throw error;
  }
  try { rmSync(temporary, { force: true }); } catch {}
}

export function writeValidatedExclusiveJson(filePath, value, validate, repo = null) {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  if (Buffer.byteLength(serialized, 'utf8') > MAX_JSON_BYTES) throw new Error(`refusing to write JSON larger than ${MAX_JSON_BYTES} bytes: ${filePath}`);
  const { requested, stableParent, absolute } = prepareOutput(filePath, repo);
  if (existsSync(absolute)) throw new Error(`refusing to overwrite checkpoint: ${absolute}`);
  const temporary = `${absolute}.${process.pid}.candidate`;
  try {
    writeFileSync(temporary, serialized, { encoding: 'utf8', flag: 'wx' });
    validate(temporary);
    assertOutputParentStable(requested, stableParent, repo);
    try {
      linkSync(temporary, absolute);
    } catch (error) {
      if (!['EPERM', 'EOPNOTSUPP', 'ENOTSUP', 'EXDEV'].includes(error.code)) throw error;
      copyFileSync(temporary, absolute, constants.COPYFILE_EXCL);
    }
  } catch (error) {
    try { rmSync(temporary, { force: true }); } catch {}
    throw error;
  }
  try { rmSync(temporary, { force: true }); } catch {}
}

export function emit(value, exitCode = 0) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
  process.exitCode = exitCode;
}

function boundedFailureText(value, maxBytes) {
  const text = String(value ?? '').trim();
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes <= maxBytes) return { text, bytes, truncated: false };
  const marker = '\n...[truncated]...\n';
  const buffer = Buffer.from(text, 'utf8');
  const available = maxBytes - Buffer.byteLength(marker, 'utf8');
  const headBytes = Math.ceil(available / 2);
  const tailBytes = Math.floor(available / 2);
  return {
    text: `${buffer.subarray(0, headBytes).toString('utf8')}${marker}${buffer.subarray(buffer.length - tailBytes).toString('utf8')}`,
    bytes,
    truncated: true,
  };
}

export function fail(error, code = 'governed_feature_delivery_error') {
  const baseSource = error instanceof Error ? error.message : String(error);
  const detailSource = error?.stdout?.toString() || error?.stderr?.toString() || '';
  let fallback;
  for (const [baseLimit, detailLimit] of [[1024, 2048], [512, 1024], [256, 512], [128, 256]]) {
    const base = boundedFailureText(baseSource, baseLimit);
    const detail = boundedFailureText(detailSource, detailLimit);
    const message = `${base.text}${detail.text ? `: ${detail.text}` : ''}`;
    const payload = { ok: false, code, message, detailBytes: detail.bytes, detailTruncated: detail.truncated, messageTruncated: base.truncated || detail.truncated };
    fallback = payload;
    if (Buffer.byteLength(JSON.stringify(payload), 'utf8') < 3584) {
      emit(payload, 2);
      return;
    }
  }
  emit(fallback, 2);
}
