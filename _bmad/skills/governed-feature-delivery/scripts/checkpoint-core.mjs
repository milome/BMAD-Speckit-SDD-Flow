import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  closeSync,
  copyFileSync,
  constants,
  openSync,
  readSync,
  realpathSync,
  statSync,
  linkSync,
  mkdirSync,
  readFileSync,
  rmSync,
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
  const size = statSync(filePath).size;
  if (size > MAX_JSON_BYTES) throw new Error(`refusing to read JSON larger than ${MAX_JSON_BYTES} bytes: ${filePath}`);
  return JSON.parse(readFileSync(filePath, 'utf8'));
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

export function sha256File(filePath) {
  const size = statSync(filePath).size;
  if (size > 64 * 1024 * 1024) throw new Error(`refusing to hash file larger than 64 MiB: ${filePath}`);
  const hash = createHash('sha256');
  const buffer = Buffer.allocUnsafe(64 * 1024);
  const handle = openSync(filePath, 'r');
  try {
    let bytesRead;
    do {
      bytesRead = readSync(handle, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    closeSync(handle);
  }
  return hash.digest('hex');
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function git(repo, args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
}

export function artifactPath(repo, filePath) {
  if (!filePath) return null;
  const absolute = path.resolve(repo, filePath);
  const relative = path.relative(repo, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`artifact must stay inside repository: ${filePath}`);
  return relative.replaceAll(path.sep, '/');
}

export function resolveRepoPath(repo, value, label, { output = false } = {}) {
  if (!value || path.isAbsolute(value)) throw new Error(`${label} must be a repository-relative path`);
  const absolute = path.resolve(repo, value);
  const relative = path.relative(repo, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`${label} escapes the repository`);
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
  if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) throw new Error(`${label} resolves outside the repository`);
  return absolute;
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
    scope[key] = [...new Set(entries.map((entry) => entry.replaceAll('\\', '/')))].sort();
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
    scope.evidenceInputs[kind] = [...new Set(entries.map((entry) => entry.replaceAll('\\', '/')))].sort();
  }
  if (Object.values(scope.evidenceInputs).reduce((total, entries) => total + entries.length, 0) > MAX_EVIDENCE_INPUTS) throw new Error('authorizedScope evidence input budget exceeded');
  return scope;
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

export function writeExclusiveJson(filePath, value) {
  const absolute = path.resolve(filePath);
  mkdirSync(path.dirname(absolute), { recursive: true });
  if (existsSync(absolute)) throw new Error(`refusing to overwrite checkpoint: ${absolute}`);
  const temporary = `${absolute}.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    try {
      linkSync(temporary, absolute);
    } catch (error) {
      if (!['EPERM', 'EOPNOTSUPP', 'ENOTSUP', 'EXDEV'].includes(error.code)) throw error;
      copyFileSync(temporary, absolute, constants.COPYFILE_EXCL);
    }
  } finally {
    rmSync(temporary, { force: true });
  }
}

export function writeValidatedExclusiveJson(filePath, value, validate) {
  const absolute = path.resolve(filePath);
  mkdirSync(path.dirname(absolute), { recursive: true });
  if (existsSync(absolute)) throw new Error(`refusing to overwrite checkpoint: ${absolute}`);
  const temporary = `${absolute}.${process.pid}.candidate`;
  try {
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    validate(temporary);
    try {
      linkSync(temporary, absolute);
    } catch (error) {
      if (!['EPERM', 'EOPNOTSUPP', 'ENOTSUP', 'EXDEV'].includes(error.code)) throw error;
      copyFileSync(temporary, absolute, constants.COPYFILE_EXCL);
    }
  } finally {
    rmSync(temporary, { force: true });
  }
}

export function emit(value, exitCode = 0) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
  process.exitCode = exitCode;
}

export function fail(error, code = 'governed_feature_delivery_error') {
  const detail = error?.stdout?.toString().trim() || error?.stderr?.toString().trim();
  const message = `${error instanceof Error ? error.message : String(error)}${detail ? `: ${detail}` : ''}`;
  emit({ ok: false, code, message }, 2);
}
