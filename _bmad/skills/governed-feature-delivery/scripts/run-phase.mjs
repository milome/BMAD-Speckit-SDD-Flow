#!/usr/bin/env node
/**
 * Lightweight phase orchestrator. The legacy checkpoint scripts remain the
 * strict backend; this command owns the fast/phase receipt lifecycle.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  artifactPath,
  canonicalRepoRelativePath,
  changedIgnoredGovernedPaths,
  emit,
  fail,
  git,
  gitNullPaths,
  governedIgnoredFingerprint,
  isManagedArtifactPath,
  MANAGED_ARTIFACT_PATHSPEC_EXCLUSIONS,
  MAX_JSON_BYTES,
  isReservedRepositoryPath,
  legacyProgress,
  normalizeScope,
  objectHash,
  parseArgs,
  readJson,
  readFileForHash,
  repositoryCaseSemantics,
  repositoryPathKey,
  riskReasonsForPath,
  required,
  resolveRepoPath,
  sha256File,
  scopeHash,
  scopePatternCoversConcretePath,
  scopePatternsOverlap,
  validateStrongMerge,
  writeExclusiveJson,
} from './checkpoint-core.mjs';
import { assertJsonSchema } from './json-schema-lite.mjs';

const HELP = `Run a governed feature phase with a lightweight, recoverable receipt.

Usage:
  node run-phase.mjs --action start --out .artifacts/governed-feature-delivery/receipt.json --feature-id ID --phase-id ID [--previous NEXT] [--target-path PATH] [options]
  node run-phase.mjs --action verify --receipt RECEIPT --out VERIFIED --verify-command "..." [--scope-rationale TEXT]
  node run-phase.mjs --action commit --receipt VERIFIED --out COMMITTED --commit-message "..."
  node run-phase.mjs --action pr-green --receipt COMMITTED --out PR --pr-url URL
  node run-phase.mjs --action merge --receipt PR --out MERGED --merge-sha SHA --merge-ref FULL_REF
  node run-phase.mjs --action next --receipt COMMITTED_OR_MERGED --out NEXT --next-phase phase-2
  node run-phase.mjs --action resume --receipt PAUSED --out NEXT --next-phase phase-2
  node run-phase.mjs --action preflight --receipt RECEIPT --out RESULT --target-path PATH [--target-path PATH]
  node run-phase.mjs --action strict-init --receipt STRICT_REQUIRED --out CHECKPOINT [strict inputs] [--confirm-continuation merge]
  node run-phase.mjs --action status --receipt receipt.json
  node run-phase.mjs --action phase-lineage --receipt receipt.json

Modes: auto (default), fast, phase, strict. Continuation: commit (default), merge, pause.
Use --scope-rationale TEXT when start, preflight, or verify adds a low-risk phase-local path not listed in the scope manifest.
The rationale must explain necessity, minimality, and phase locality; obvious placeholders are rejected.
Git metadata and the managed ledger roots are never valid target/scope paths. Other .artifacts paths remain ordinary governed work.
The strict mode delegates the existing hash-linked v1 checkpoint workflow.`;

const STAGES = ['Plan', 'Baseline', 'Implement', 'Verify', 'Commit', 'Next'];
const PHASE_RECEIPT_SCHEMA = readJson(fileURLToPath(new URL('../assets/phase-receipt.schema.json', import.meta.url)));
const STRICT_INPUT_OPTIONS = ['spec', 'freeze-receipt', 'plan', 'scope', 'successor-policy', 'authority-policy'];
const MAX_PHASE_LINEAGE_RECORDS = 64;
const MAX_PHASE_LINEAGE_BYTES = 64 * 1024 * 1024;
const VERIFICATION_RECEIPT_GROWTH_RESERVE_BYTES = 128 * 1024;
const PLACEHOLDER_RATIONALES = new Set(['x', 'todo', 'tbd', 'n/a', 'na', 'none', 'placeholder', 'required', 'needed', 'automatic low-risk phase extension']);

function now() { return new Date().toISOString(); }
function hashText(value) { return createHash('sha256').update(value).digest('hex'); }
function canonicalCommand(command) { return command.trim(); }
function currentHead(repo) { return git(repo, ['rev-parse', 'HEAD']).toLowerCase(); }
function currentBranch(repo) { return git(repo, ['branch', '--show-current']) || 'DETACHED'; }
function worktreeFingerprint(repo) {
  const paths = workingPaths(repo);
  const modes = treeModes(repo, paths);
  assertLightweightEntryTypes(repo, paths, modes);
  const files = paths.map((file) => ({ file, hash: fileHash(repo, file), mode: modes[file] }));
  return {
    worktree: paths.length ? 'dirty' : 'clean',
    statusHash: objectHash({ files }),
  };
}

function readOptionalHash(repo, value) {
  if (!value) return null;
  return sha256File(resolveRepoPath(repo, value, 'artifact'));
}

function literalPathspec(value) {
  return `:(literal)${value}`;
}

function broadPathspec(value) {
  return ['.', '*', '**', '**/*'].includes(value.replaceAll('\\', '/'));
}

function readRiskPolicy(repo, riskPolicyPath) {
  const policy = readJson(resolveRepoPath(repo, riskPolicyPath, '--risk-policy'));
  const allowed = new Set(['strictPaths', 'requirePullRequest', 'integrationRefs']);
  if (Object.keys(policy).some((key) => !allowed.has(key))) throw new Error('risk policy contains unknown fields');
  if (!Array.isArray(policy.strictPaths) || typeof policy.requirePullRequest !== 'boolean') throw new Error('risk policy requires strictPaths[] and requirePullRequest');
  const strictPaths = normalizeScope({ allowedPaths: policy.strictPaths }).allowedPaths;
  const integrationRefs = policy.integrationRefs ?? [];
  if (!Array.isArray(integrationRefs) || integrationRefs.some((entry) => typeof entry !== 'string' || !/^refs\/(heads|remotes)\//u.test(entry))) throw new Error('risk policy integrationRefs must contain full branch refs');
  return { ...policy, strictPaths, integrationRefs: [...new Set(integrationRefs)].sort() };
}

function classifyRisk(repo, scopePath, riskPolicyPath, continuation = 'commit', receipt = null, targetPaths = [], frozenPhasePaths = null) {
  const concreteCandidates = [...targetPaths];
  const scopeCandidates = [];
  const reasons = [];
  let integrationRefs = [];
  const receiptPhasePaths = receipt ? frozenPhasePaths ?? phaseChangedPaths(repo, receipt) : [];
  if (scopePath) {
    const scope = normalizeScope(readJson(resolveRepoPath(repo, scopePath, '--scope')));
    scopeCandidates.push(...(scope.allowedPaths ?? []));
    if ((scope.allowedPaths ?? []).some((allowed) => (scope.protectedPaths ?? []).some((protectedPath) => broadPathspec(allowed) || broadPathspec(protectedPath) || scopePatternsOverlap(allowed, protectedPath)))) reasons.push('protected path');
    if (targetPaths.some((target) => scope.protectedPaths.some((protectedPath) => broadPathspec(protectedPath) || scopePatternCoversConcretePath(protectedPath, target)))) reasons.push('protected path');
    if (receiptPhasePaths.some((file) => scope.protectedPaths.some((protectedPath) => scopePatternCoversConcretePath(protectedPath, file)))) reasons.push('protected path');
  }
  if (receipt) concreteCandidates.push(...receiptPhasePaths, ...(receipt.scopeExtensions ?? []).map((entry) => entry.path));
  if (riskPolicyPath) {
    const policy = readRiskPolicy(repo, riskPolicyPath);
    integrationRefs = policy.integrationRefs;
    if (scopeCandidates.some((candidate) => policy.strictPaths.some((strictPath) => broadPathspec(candidate) || broadPathspec(strictPath) || scopePatternsOverlap(candidate, strictPath)))
      || concreteCandidates.some((candidate) => policy.strictPaths.some((strictPath) => broadPathspec(strictPath) || scopePatternCoversConcretePath(strictPath, candidate)))) reasons.push('repository protected path policy');
    if (policy.requirePullRequest) reasons.push('repository requires PR and merge');
  }
  reasons.push(...[...scopeCandidates, ...concreteCandidates].flatMap(riskReasonsForPath));
  const unique = [...new Set(reasons)];
  return { reasons: unique, strict: unique.length > 0, integrationRefs, classifiedAt: now() };
}

function changedPaths(repo, baseSha, pathspecs = []) {
  const specs = [...pathspecs, ...MANAGED_ARTIFACT_PATHSPEC_EXCLUSIONS];
  const tracked = gitNullPaths(repo, ['diff', '--no-renames', '--name-only', '-z', '--diff-filter=ACDMRTUXB', baseSha, 'HEAD', '--', ...specs]);
  const working = gitNullPaths(repo, ['diff', '--no-renames', '--name-only', '-z', '--diff-filter=ACDMRTUXB', '--', ...specs]);
  const staged = gitNullPaths(repo, ['diff', '--no-renames', '--cached', '--name-only', '-z', '--diff-filter=ACDMRTUXB', '--', ...specs]);
  const untracked = gitNullPaths(repo, ['ls-files', '-z', '--others', '--exclude-standard', '--', ...specs]);
  return [...new Set([...tracked, ...working, ...staged, ...untracked].filter((value) => !isManagedArtifactPath(value)))];
}

function workingPaths(repo) {
  const working = gitNullPaths(repo, ['diff', '--no-renames', '--name-only', '-z', '--diff-filter=ACDMRTUXB', '--', ...MANAGED_ARTIFACT_PATHSPEC_EXCLUSIONS]);
  const staged = gitNullPaths(repo, ['diff', '--no-renames', '--cached', '--name-only', '-z', '--diff-filter=ACDMRTUXB', '--', ...MANAGED_ARTIFACT_PATHSPEC_EXCLUSIONS]);
  const untracked = gitNullPaths(repo, ['ls-files', '-z', '--others', '--exclude-standard', '--', ...MANAGED_ARTIFACT_PATHSPEC_EXCLUSIONS]);
  return [...new Set([...working, ...staged, ...untracked].filter((value) => !isManagedArtifactPath(value)))];
}

function ignoredGovernedPathspecs(repo, receipt) {
  const pathspecs = [];
  if (receipt.artifacts?.scopePath) {
    const scope = normalizeScope(readJson(resolveRepoPath(repo, receipt.artifacts.scopePath, '--scope')));
    pathspecs.push(...scope.protectedPaths, ...scope.forbiddenWork);
  }
  if (receipt.artifacts?.riskPolicyPath) {
    pathspecs.push(...readRiskPolicy(repo, receipt.artifacts.riskPolicyPath).strictPaths);
  }
  return [...new Set(pathspecs)];
}

function assertIgnoredGovernedCurrent(repo, receipt) {
  const expected = receipt.baseline?.ignoredGoverned;
  if (!expected) return null;
  const actual = governedIgnoredFingerprint(repo, ignoredGovernedPathspecs(repo, receipt));
  if (actual.hash === expected.hash) return actual;
  const changed = changedIgnoredGovernedPaths(expected, actual);
  const ignoredScope = inspectPreflightScope(repo, receipt.artifacts?.scopePath, changed, receipt);
  if (ignoredScope.forbidden.length) throw new Error(`ignored governed forbidden work changed since baseline: ${ignoredScope.forbidden.join(', ')}`);
  throw new Error(`ignored governed risk changed since baseline: ${changed.join(', ')}`);
}

function fileHash(repo, file) {
  const absolute = path.resolve(repo, file);
  return existsSync(absolute) ? sha256File(resolveRepoPath(repo, file, `changed file ${file}`)) : null;
}

function singleWorkingBlobHash(repo, file) {
  if (!existsSync(path.resolve(repo, file))) return null;
  const filePath = resolveRepoPath(repo, file, `changed file ${file}`);
  return execFileSync('git', ['-C', repo, 'hash-object', '--filters', `--path=${file}`, '--stdin'], {
    input: readFileForHash(filePath), encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, timeout: 30_000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  }).trim().toLowerCase();
}

function pathspecBatches(files, maxChars = 24 * 1024) {
  const batches = [];
  let batch = [];
  let chars = 0;
  for (const file of files) {
    const nextChars = file.length + 16;
    if (batch.length && chars + nextChars > maxChars) {
      batches.push(batch);
      batch = [];
      chars = 0;
    }
    batch.push(file);
    chars += nextChars;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

function parseTreeEntries(output) {
  const entries = new Map();
  for (const entry of output.split('\0').filter(Boolean)) {
    const tab = entry.indexOf('\t');
    if (tab < 0) continue;
    const [mode, , object] = entry.slice(0, tab).split(' ');
    entries.set(entry.slice(tab + 1).replaceAll('\\', '/'), { mode, object });
  }
  return entries;
}

function commitTreeEntries(repo, files, commitSha) {
  const entries = new Map();
  for (const batch of pathspecBatches([...files].sort())) {
    const output = execFileSync('git', ['-C', repo, 'ls-tree', '-rz', commitSha, '--', ...batch.map(literalPathspec)], {
      encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, timeout: 30_000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
    for (const [file, entry] of parseTreeEntries(output)) entries.set(file, entry);
  }
  return entries;
}

function indexModes(repo, files) {
  const modes = new Map();
  for (const batch of pathspecBatches([...files].sort())) {
    const output = execFileSync('git', ['-C', repo, 'ls-files', '--stage', '-z', '--', ...batch.map(literalPathspec)], {
      encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, timeout: 30_000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
    for (const entry of output.split('\0').filter(Boolean)) {
      const tab = entry.indexOf('\t');
      if (tab < 0) continue;
      const [mode, , stage] = entry.slice(0, tab).split(' ');
      if (stage === '0') modes.set(entry.slice(tab + 1).replaceAll('\\', '/'), mode);
    }
  }
  return modes;
}

function workingTreeModes(repo, files) {
  const sorted = [...files].sort();
  const indexed = indexModes(repo, sorted);
  const respectsFileMode = git(repo, ['config', '--bool', 'core.filemode']) === 'true';
  return Object.fromEntries(sorted.map((file) => {
    const absolute = path.resolve(repo, file);
    let stats;
    try { stats = lstatSync(absolute); }
    catch (error) {
      if (error.code === 'ENOENT') return [file, null];
      throw error;
    }
    if (stats.isSymbolicLink()) return [file, '120000'];
    const indexMode = indexed.get(file) ?? null;
    if (stats.isDirectory()) return [file, indexMode === '160000' ? indexMode : null];
    if (respectsFileMode) return [file, (stats.mode & 0o111) === 0 ? '100644' : '100755'];
    return [file, indexMode === '100755' ? indexMode : '100644'];
  }));
}

function blobHashes(repo, files, commitSha = null) {
  const sorted = [...files].sort();
  if (commitSha) {
    const entries = commitTreeEntries(repo, sorted, commitSha);
    return Object.fromEntries(sorted.map((file) => [file, entries.get(file)?.object ?? null]));
  }
  const hashes = new Map();
  const batchable = sorted.filter((file) => existsSync(path.resolve(repo, file)) && !/[\r\n]/u.test(file));
  if (batchable.length) {
    const output = execFileSync('git', ['-C', repo, 'hash-object', '--filters', '--stdin-paths'], {
      input: `${batchable.join('\n')}\n`, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, timeout: 30_000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    }).trim().split(/\r?\n/u);
    if (output.length !== batchable.length) throw new Error('git hash-object did not return one hash per changed path');
    batchable.forEach((file, index) => hashes.set(file, output[index].toLowerCase()));
  }
  for (const file of sorted) {
    if (!existsSync(path.resolve(repo, file))) hashes.set(file, null);
    else if (/[\r\n]/u.test(file)) hashes.set(file, singleWorkingBlobHash(repo, file));
  }
  return Object.fromEntries(sorted.map((file) => [file, hashes.get(file) ?? null]));
}

function treeModes(repo, files, commitSha = null) {
  const sorted = [...files].sort();
  if (!commitSha) return workingTreeModes(repo, sorted);
  const entries = commitTreeEntries(repo, sorted, commitSha);
  return Object.fromEntries(sorted.map((file) => [file, entries.get(file)?.mode ?? null]));
}

function assertLightweightEntryTypes(repo, files, modes = null) {
  const actualModes = modes ?? treeModes(repo, files);
  for (const file of files) {
    if (['120000', '160000'].includes(actualModes[file])) throw new Error('lightweight delivery does not support symlink or gitlink changes; use strict mode');
  }
}

function treeModesMatch(expected, actual) {
  return expected === undefined || expected === null || sameValue(expected, actual);
}

function assertBaselineDirtPreserved(repo, receipt) {
  const baselinePaths = receipt.baseline.changedPaths ?? [];
  const modes = treeModes(repo, baselinePaths);
  assertLightweightEntryTypes(repo, baselinePaths, modes);
  const working = new Set(workingPaths(repo));
  const changed = baselinePaths.filter((file) => !working.has(file) || fileHash(repo, file) !== receipt.baseline.fileHashes?.[file] || !treeModesMatch(receipt.baseline.treeModes?.[file], modes[file]));
  if (changed.length) throw new Error(`baseline-dirty files changed during phase; isolate or re-baseline first: ${changed.join(', ')}`);
}

function phaseChangedPaths(repo, receipt) {
  assertBaselineDirtPreserved(repo, receipt);
  const current = changedPaths(repo, receipt.baseSha);
  const baselinePaths = new Set(receipt.baseline.changedPaths ?? []);
  return current.filter((file) => !baselinePaths.has(file));
}

function assertAuthorizedScope(repo, receipt) {
  const scopePath = receipt.artifacts?.scopePath;
  if (!scopePath) return phaseChangedPaths(repo, receipt);
  const scope = normalizeScope(readJson(resolveRepoPath(repo, scopePath, '--scope')));
  const changed = phaseChangedPaths(repo, receipt);
  const allowedSpecs = scope.allowedPaths ?? [];
  const forbiddenSpecs = scope.forbiddenWork ?? [];
  const allowed = new Set(allowedSpecs.length ? changedPaths(repo, receipt.baseSha, allowedSpecs) : []);
  const extensions = new Set((receipt.scopeExtensions ?? []).map((entry) => pathKey(repo, entry.path)));
  const forbidden = new Set(forbiddenSpecs.length ? changedPaths(repo, receipt.baseSha, forbiddenSpecs) : []);
  const outside = changed.filter((file) => !allowed.has(file) && !extensions.has(pathKey(repo, file)));
  const forbiddenChanged = changed.filter((file) => forbidden.has(file));
  if (forbiddenChanged.length) throw new Error(`forbidden phase work detected: ${forbiddenChanged.join(', ')}`);
  if (outside.length) throw new Error(`scope expansion required before verification: ${outside.join(', ')}`);
  return changed;
}

function normalizeTargetPaths(repo, targets) {
  if (targets.some((entry) => typeof entry !== 'string' || !entry.trim() || entry.length > 1024 || path.isAbsolute(entry) || /^[a-z]:[\\/]/iu.test(entry) || entry.split(/[\\/]/u).includes('..') || /[?*]/u.test(entry) || entry.startsWith('!') || entry.startsWith(':'))) {
    throw new Error('--target-path must contain concrete repository-relative paths without Git pathspec magic');
  }
  const normalized = [];
  const seen = new Set();
  const semantics = repositoryCaseSemantics(repo);
  for (const entry of targets.map(canonicalRepoRelativePath)) {
    const key = repositoryPathKey(entry, semantics);
    if (!seen.has(key)) normalized.push(entry);
    seen.add(key);
  }
  if (normalized.some((entry) => isReservedRepositoryPath(entry))) throw new Error('--target-path contains a reserved repository-internal path');
  return normalized;
}

function assertTargetPathsContained(repo, targets) {
  for (const target of targets) resolveRepoPath(repo, target, '--target-path', { allowMissing: true });
}

function assertScopeExtensionsContained(repo, receipt) {
  for (const extension of receipt.scopeExtensions ?? []) resolveRepoPath(repo, extension.path, 'scope extension', { allowMissing: true });
}

function pathKey(repo, value) {
  const canonical = canonicalRepoRelativePath(value);
  return repositoryPathKey(canonical, repositoryCaseSemantics(repo));
}

function inspectPreflightScope(repo, scopePath, targets, receipt = null) {
  if (!scopePath) return { outside: [], forbidden: [] };
  const scope = normalizeScope(readJson(resolveRepoPath(repo, scopePath, '--scope')));
  const extensions = new Set((receipt?.scopeExtensions ?? []).map((entry) => pathKey(repo, entry.path)));
  const outside = targets.filter((target) => !extensions.has(pathKey(repo, target)) && !scope.allowedPaths.some((allowed) => scopePatternCoversConcretePath(allowed, target)));
  const forbidden = targets.filter((target) => scope.forbiddenWork.some((denied) => scopePatternCoversConcretePath(denied, target)));
  return { outside, forbidden };
}

function inspectChangedScope(repo, receipt) {
  const scopePath = receipt.artifacts?.scopePath;
  const changed = phaseChangedPaths(repo, receipt);
  if (!scopePath) return { changed, outside: [], forbidden: [] };
  const scope = normalizeScope(readJson(resolveRepoPath(repo, scopePath, '--scope')));
  const allowed = new Set(scope.allowedPaths.length ? changedPaths(repo, receipt.baseSha, scope.allowedPaths) : []);
  const forbiddenSet = new Set(scope.forbiddenWork.length ? changedPaths(repo, receipt.baseSha, scope.forbiddenWork) : []);
  const extensions = new Set((receipt.scopeExtensions ?? []).map((entry) => pathKey(repo, entry.path)));
  return {
    changed,
    outside: changed.filter((file) => !allowed.has(file) && !extensions.has(pathKey(repo, file))),
    forbidden: changed.filter((file) => forbiddenSet.has(file)),
  };
}

function appendScopeExtensions(repo, receipt, paths, rationale) {
  const existing = receipt.scopeExtensions ?? [];
  const accepted = new Set(existing.map((entry) => pathKey(repo, entry.path)));
  const additions = normalizeTargetPaths(repo, paths).filter((entry) => !accepted.has(pathKey(repo, entry))).sort();
  if (additions.length === 0) return existing;
  if (additions.length > 32) throw new Error('one action may append at most 32 lightweight scope extensions');
  if (existing.length + additions.length > 128) throw new Error('lightweight scope extension limit exceeded; use a new phase or strict scope delta');
  const reason = rationale?.trim();
  if (!reason) throw new Error('--scope-rationale is required for each new low-risk phase scope extension');
  if (reason.length > 2048) throw new Error('--scope-rationale exceeds 2048 characters');
  if (reason.length < 12 || PLACEHOLDER_RATIONALES.has(reason.toLowerCase())) throw new Error('--scope-rationale must not be a placeholder; record why the path is necessary, minimal, and phase-local');
  const recordedAt = now();
  return [...existing, ...additions.map((entry) => ({ path: entry, rationale: reason, recordedAt }))];
}

function scopeExtensionsHash(receipt) {
  return objectHash(receipt.scopeExtensions ?? []);
}

function assertInputsCurrent(repo, receipt) {
  const { planPath, scopePath, riskPolicyPath } = receipt.artifacts ?? {};
  if (planPath && sha256File(resolveRepoPath(repo, planPath, 'plan artifact')) !== receipt.planHash) throw new Error('plan changed after baseline; start a new baseline');
  if (scopePath && scopeHash(readJson(resolveRepoPath(repo, scopePath, 'scope artifact'))) !== receipt.scopeHash) throw new Error('scope changed after baseline; start a new baseline');
  if (riskPolicyPath && sha256File(resolveRepoPath(repo, riskPolicyPath, 'risk policy artifact')) !== receipt.riskPolicyHash) throw new Error('risk policy changed after baseline; start a new baseline');
}

function verificationOutputMatches(repo, verification) {
  if (verification?.outputPath == null && verification?.outputHash == null) return true;
  if (typeof verification?.outputPath !== 'string' || typeof verification?.outputHash !== 'string') return false;
  try { return sha256File(resolveRepoPath(repo, verification.outputPath, 'verification output')) === verification.outputHash; }
  catch { return false; }
}

function assertVerificationOutputCurrent(repo, verification) {
  if (!verificationOutputMatches(repo, verification)) throw new Error(`verification output changed: ${verification.outputPath}`);
}

function boundVerification(receipt) {
  if (receipt.commit) return receipt.verification[receipt.commit.verificationCount - 1] ?? null;
  return receipt.state === 'VERIFIED' ? receipt.verification.at(-1) ?? null : null;
}

function receiptIntegrationRefs(repo, receipt) {
  if (Array.isArray(receipt.risk.integrationRefs)) return receipt.risk.integrationRefs;
  const riskPolicyPath = receipt.artifacts?.riskPolicyPath;
  if (!riskPolicyPath) return [];
  const resolved = resolveRepoPath(repo, riskPolicyPath, 'legacy risk policy artifact');
  if (sha256File(resolved) !== receipt.riskPolicyHash) throw new Error('legacy receipt requires its original risk policy to recover integration refs');
  return readRiskPolicy(repo, riskPolicyPath).integrationRefs;
}

function assertBaselineBranch(repo, receipt) {
  if (currentBranch(repo) !== receipt.baseline.branch) throw new Error(`phase branch changed after baseline: expected ${receipt.baseline.branch}`);
}

function assertNoPhaseResidual(repo, receipt) {
  assertBaselineDirtPreserved(repo, receipt);
  const baselinePaths = new Set(receipt.baseline.changedPaths ?? []);
  const residual = workingPaths(repo).filter((file) => !baselinePaths.has(file) || fileHash(repo, file) !== receipt.baseline.fileHashes?.[file]);
  if (residual.length) throw new Error(`phase has uncommitted residual changes: ${residual.join(', ')}`);
}

function assertCommitBoundaryCurrent(repo, receipt, commitSha) {
  if (currentHead(repo) !== commitSha || currentBranch(repo) !== receipt.baseline.branch) throw new Error('commit boundary changed HEAD or branch');
  assertInputsCurrent(repo, receipt);
  assertScopeExtensionsContained(repo, receipt);
  assertIgnoredGovernedCurrent(repo, receipt);
  assertNoPhaseResidual(repo, receipt);
}

function strictBoundary(repo) {
  const tree = worktreeFingerprint(repo);
  return { branch: currentBranch(repo), headSha: currentHead(repo), treeHash: tree.statusHash, capturedAt: now() };
}

function commitPendingPath(parentPath) {
  return `${parentPath}.commit-pending.json`;
}

function committedReceipt(parent, sha) {
  return {
    ...parent,
    state: 'COMMITTED',
    headSha: sha,
    commit: {
      sha,
      headSha: sha,
      scopeHash: parent.scopeHash,
      scopeExtensionsHash: scopeExtensionsHash(parent),
      verificationCount: parent.verification.length,
      verificationTreeHash: parent.verification.at(-1).treeHash,
      createdAt: now(),
    },
  };
}

function commitIntentMatches(actual, expected) {
  const allowed = new Set([...Object.keys(expected), 'createdAt']);
  return actual && typeof actual === 'object' && !Array.isArray(actual)
    && Object.keys(actual).every((key) => allowed.has(key))
    && typeof actual.createdAt === 'string' && !Number.isNaN(Date.parse(actual.createdAt))
    && Object.keys(expected).every((key) => sameValue(actual[key], expected[key]));
}

function expectedCommitIntent(parentPath, parent, latestVerification, message) {
  const expected = {
    schemaVersion: 'GovernedFeatureDeliveryCommitIntent/v1',
    parentReceiptHash: sha256File(parentPath),
    previousHead: latestVerification.headSha,
    branch: parent.baseline.branch,
    messageHash: hashText(message.trim()),
    scopeExtensionsHash: scopeExtensionsHash(parent),
    phaseChanges: latestVerification.changedPaths,
    blobHashes: latestVerification.blobHashes,
  };
  if (latestVerification.treeModes !== undefined) expected.treeModes = latestVerification.treeModes;
  return expected;
}

function commitIntentCompatible(actual, expected, receipt) {
  if (commitIntentMatches(actual, expected)) return true;
  if (actual?.scopeExtensionsHash !== undefined || (receipt.scopeExtensions ?? []).length !== 0) return false;
  const legacy = { ...expected };
  delete legacy.scopeExtensionsHash;
  return commitIntentMatches(actual, legacy);
}

function commitPaths(repo, sha) {
  return gitNullPaths(repo, ['diff-tree', '--no-renames', '--no-commit-id', '--name-only', '-z', '-r', sha]).sort();
}

function progress(state, warnings = [], continuation = 'commit', mode = 'phase') {
  const index = {
    PLANNED: 0, BASELINE: 1, IMPLEMENTING: 2, VERIFIED: 3,
    COMMITTED: 4, PR_GREEN: 4, MERGED: 4, NEXT_PHASE: 5, PAUSED: 5, STRICT_REQUIRED: 1,
  }[state] ?? 0;
  const completed = STAGES.slice(0, index);
  const next = state === 'COMMITTED' ? (mode === 'fast' ? 'none' : continuation === 'merge' ? 'record PR_GREEN' : continuation === 'pause' ? 'seal PAUSED' : 'record NEXT_PHASE')
    : state === 'PR_GREEN' ? 'record MERGED from the integration ref'
      : state === 'MERGED' ? 'record NEXT_PHASE'
        : state === 'NEXT_PHASE' ? 'initialize the next phase from the recorded base commit'
    : state === 'STRICT_REQUIRED' ? 'use the strict checkpoint backend before editing'
      : state === 'PAUSED' ? 'record NEXT_PHASE with resume after an explicit decision'
        : STAGES[index + 1] ? `complete ${STAGES[index + 1]}` : 'none';
  return { stage: STAGES[index], completed, next, updatedAt: now(), warnings };
}

function validateReceipt(repo, receipt) {
  assertJsonSchema(receipt, PHASE_RECEIPT_SCHEMA, 'phase receipt');
  if (receipt.baseSha !== receipt.baseline.headSha) throw new Error('baseSha must match the baseline HEAD');
  const ignoredGoverned = receipt.baseline.ignoredGoverned;
  if (ignoredGoverned) {
    const ignoredPaths = ignoredGoverned.entries.map((entry) => entry.path);
    if (!sameValue(normalizeTargetPaths(repo, ignoredPaths), ignoredPaths) || ignoredGoverned.hash !== objectHash(ignoredGoverned.entries)) throw new Error('baseline ignored governed fingerprint is invalid');
  }
  const extensions = receipt.scopeExtensions ?? [];
  const extensionPaths = extensions.map((entry) => entry.path);
  if (!sameValue(normalizeTargetPaths(repo, extensionPaths), extensionPaths)) throw new Error('scopeExtensions must contain unique normalized concrete paths');
  const extensionHash = objectHash(extensions);
  if ((receipt.previousReceiptPath === null) !== (receipt.previousReceiptHash === null)) throw new Error('receipt lineage fields must both be null or both be set');
  if (receipt.previousReceiptPath === null && !['BASELINE', 'STRICT_REQUIRED'].includes(receipt.state)) throw new Error(`${receipt.state} cannot be a genesis receipt`);
  if (receipt.previousReceiptPath === null && receipt.verification.length > 0) throw new Error('genesis receipts cannot contain verification evidence');
  for (const item of receipt.verification) {
    if ((typeof item.outputPath === 'string') !== (typeof item.outputHash === 'string')) throw new Error('verification outputPath and outputHash must both be set or both be absent');
  }
  if (receipt.state === 'STRICT_REQUIRED' && (receipt.mode !== 'strict' || receipt.risk.strict !== true)) throw new Error('STRICT_REQUIRED requires strict mode and risk');
  if (receipt.mode === 'strict' && receipt.state !== 'STRICT_REQUIRED') throw new Error('v2 strict receipts must stop at STRICT_REQUIRED');
  if (receipt.mode === 'fast' && !['BASELINE', 'IMPLEMENTING', 'VERIFIED', 'COMMITTED'].includes(receipt.state)) throw new Error('fast mode ends at COMMITTED');
  if (receipt.risk.strict && receipt.state !== 'STRICT_REQUIRED') throw new Error('strict risk must latch STRICT_REQUIRED');
  if (receipt.state === 'STRICT_REQUIRED' && (receipt.strictBoundary?.branch !== receipt.baseline.branch || receipt.strictBoundary?.headSha !== receipt.headSha)) throw new Error('STRICT_REQUIRED must bind its branch and HEAD');
  if (receipt.state !== 'STRICT_REQUIRED' && receipt.strictBoundary !== null) throw new Error('only STRICT_REQUIRED carries a strict boundary');
  const commitStates = ['COMMITTED', 'PR_GREEN', 'MERGED', 'NEXT_PHASE', 'PAUSED'];
  const pullRequestStates = ['PR_GREEN', 'MERGED'];
  const mergeStates = ['MERGED'];
  if (receipt.state === 'NEXT_PHASE' && receipt.continuation === 'merge') {
    pullRequestStates.push('NEXT_PHASE');
    mergeStates.push('NEXT_PHASE');
  }
  if (!commitStates.includes(receipt.state) && receipt.commit !== null) throw new Error(`${receipt.state} cannot contain commit evidence`);
  if (!pullRequestStates.includes(receipt.state) && receipt.pullRequest !== null) throw new Error(`${receipt.state} cannot contain pull request evidence`);
  if (!mergeStates.includes(receipt.state) && receipt.merge !== null) throw new Error(`${receipt.state} cannot contain merge evidence`);
  if (receipt.state !== 'NEXT_PHASE' && receipt.successor !== null) throw new Error(`${receipt.state} cannot contain successor evidence`);
  if (receipt.state === 'VERIFIED' && receipt.verification.at(-1)?.status !== 'pass') throw new Error('VERIFIED requires the latest verification to pass');
  if (['VERIFIED', 'COMMITTED', 'PR_GREEN', 'MERGED', 'NEXT_PHASE', 'PAUSED'].includes(receipt.state) && receipt.scopeExtensions !== undefined && receipt.verification.at(-1)?.inputHashes?.scopeExtensionsHash !== extensionHash) throw new Error(`${receipt.state} requires verification bound to lightweight scope extensions`);
  if (['VERIFIED', 'COMMITTED', 'PR_GREEN', 'MERGED', 'NEXT_PHASE', 'PAUSED'].includes(receipt.state) && ignoredGoverned && receipt.verification.at(-1)?.inputHashes?.ignoredGovernedHash !== ignoredGoverned.hash) throw new Error(`${receipt.state} requires verification bound to the ignored governed baseline`);
  if (['COMMITTED', 'PR_GREEN', 'MERGED', 'NEXT_PHASE', 'PAUSED'].includes(receipt.state) && (!receipt.commit || receipt.commit.sha !== receipt.commit.headSha || receipt.commit.verificationCount !== receipt.verification.length || receipt.commit.scopeHash !== receipt.scopeHash || (receipt.scopeExtensions !== undefined && receipt.commit.scopeExtensionsHash !== extensionHash))) throw new Error(`${receipt.state} requires a verification-bound commit receipt`);
  if (receipt.commit) {
    const bound = receipt.verification[receipt.commit.verificationCount - 1];
    if (!bound || bound.status !== 'pass' || bound.treeHash !== receipt.commit.verificationTreeHash) throw new Error('commit receipt does not bind the latest passing verification');
  }
  if (['PR_GREEN', 'MERGED'].includes(receipt.state) && (receipt.continuation !== 'merge' || receipt.pullRequest?.headSha !== receipt.commit.sha || receipt.pullRequest?.status !== 'green')) throw new Error(`${receipt.state} requires merge continuation and PR_GREEN evidence`);
  if (receipt.state === 'MERGED' && (!receipt.merge || receipt.merge.containsCommitSha !== receipt.commit.sha)) throw new Error('MERGED requires a merge receipt containing the phase commit');
  if (receipt.state === 'PAUSED' && receipt.continuation !== 'pause') throw new Error('PAUSED requires pause continuation');
  if (receipt.state === 'NEXT_PHASE') {
    const expectedBase = receipt.continuation === 'merge' ? receipt.merge?.sha : receipt.commit?.sha;
    if (!receipt.successor || receipt.successor.baseSha !== expectedBase || receipt.successor.target === receipt.phaseId) throw new Error('NEXT_PHASE requires a distinct target bound to the committed or merged base');
  }
  const expectedHead = ['BASELINE', 'IMPLEMENTING'].includes(receipt.state) ? receipt.baseSha
    : receipt.state === 'VERIFIED' ? receipt.verification.at(-1).headSha
      : ['COMMITTED', 'PR_GREEN', 'PAUSED'].includes(receipt.state) ? receipt.commit.sha
        : receipt.state === 'MERGED' ? receipt.merge.sha
          : receipt.state === 'NEXT_PHASE' ? receipt.successor.baseSha
            : receipt.state === 'STRICT_REQUIRED' ? receipt.strictBoundary.headSha : null;
  if (expectedHead && receipt.headSha !== expectedHead) throw new Error(`${receipt.state} headSha does not match its evidence anchor`);
}

function sameValue(left, right) {
  if (left === undefined || right === undefined) return left === right;
  return objectHash(left) === objectHash(right);
}

function strictHandoff(receipt) {
  return {
    action: 'strict-init',
    requiredOptions: STRICT_INPUT_OPTIONS.map((option) => `--${option}`),
    confirmation: receipt.continuation === 'merge' ? null : '--confirm-continuation merge',
  };
}

function ledgerOutputPath(repo, value) {
  const output = resolveRepoPath(repo, value, '--out', { output: true });
  if (!artifactPath(repo, output).startsWith('.artifacts/governed-feature-delivery/')) throw new Error('--out must be under .artifacts/governed-feature-delivery/');
  return output;
}

function withParent(repo, parentPath, receipt) {
  return { ...receipt, previousReceiptPath: artifactPath(repo, parentPath), previousReceiptHash: sha256File(parentPath) };
}

function prepareReceiptForWrite(repo, receipt, warnings = []) {
  const value = { ...receipt, warnings: [...new Set([...(receipt.warnings ?? []), ...warnings])] };
  value.progress = progress(value.state, value.warnings, value.continuation, value.mode);
  value.updatedAt = now();
  validateReceipt(repo, value);
  return value;
}

function assertReceiptLineageCapacity(value, parentLineage) {
  if (value.previousReceiptPath && !parentLineage) throw new Error('child receipt requires loaded parent lineage metadata');
  const receiptBytes = Buffer.byteLength(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  if (receiptBytes > MAX_JSON_BYTES) throw new Error(`receipt exceeds the per-record byte limit ${MAX_JSON_BYTES}`);
  const lineage = {
    records: (parentLineage?.records ?? 0) + 1,
    bytes: (parentLineage?.bytes ?? 0) + receiptBytes,
  };
  if (lineage.records > MAX_PHASE_LINEAGE_RECORDS || lineage.bytes > MAX_PHASE_LINEAGE_BYTES) throw new Error('receipt lineage exceeds the write budget');
}

function assertVerificationReceiptCapacity(repo, receipt, parentLineage) {
  const value = prepareReceiptForWrite(repo, receipt);
  assertReceiptLineageCapacity(value, parentLineage);
  const receiptBytes = Buffer.byteLength(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  if (receiptBytes + VERIFICATION_RECEIPT_GROWTH_RESERVE_BYTES > MAX_JSON_BYTES
    || (parentLineage?.bytes ?? 0) + receiptBytes + VERIFICATION_RECEIPT_GROWTH_RESERVE_BYTES > MAX_PHASE_LINEAGE_BYTES) {
    throw new Error(`verification requires ${VERIFICATION_RECEIPT_GROWTH_RESERVE_BYTES} bytes of receipt capacity before running the command`);
  }
  return { maxReceiptBytes: receiptBytes + VERIFICATION_RECEIPT_GROWTH_RESERVE_BYTES };
}

function assertChildReceiptAdmissible(repo, receipt, warnings, parentLineage) {
  const value = prepareReceiptForWrite(repo, receipt, warnings);
  assertReceiptLineageCapacity(value, parentLineage);
  return value;
}

function assertReceiptByteLimit(value, capacity) {
  if (!capacity) return;
  const receiptBytes = Buffer.byteLength(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  if (receiptBytes > capacity.maxReceiptBytes) throw new Error(`verification receipt grew by more than ${VERIFICATION_RECEIPT_GROWTH_RESERVE_BYTES} bytes after the command`);
}

function writeReceipt(repo, output, receipt, warnings = [], requiredLedger = false, parentLineage = null, capacity = null) {
  const value = assertChildReceiptAdmissible(repo, receipt, warnings, parentLineage);
  assertReceiptByteLimit(value, capacity);
  try {
    writeExclusiveJson(output, value, repo);
    return { value, ledgerWarning: null, path: output };
  } catch (error) {
    if (requiredLedger) throw new Error(`boundary ledger write failed: ${error.message}`);
    const warning = `ledger write warning: ${error.message}`;
    process.stderr.write(`${warning}\n`);
    const warnedValue = { ...value, warnings: [...value.warnings, warning], progress: progress(value.state, [...value.warnings, warning], value.continuation, value.mode) };
    assertReceiptByteLimit(warnedValue, capacity);
    const warnedReceiptBytes = Buffer.byteLength(`${JSON.stringify(warnedValue, null, 2)}\n`, 'utf8');
    if (warnedReceiptBytes > MAX_JSON_BYTES) throw new Error(`fallback receipt exceeds the per-record byte limit ${MAX_JSON_BYTES}`);
    const warnedBytes = (parentLineage?.bytes ?? 0) + warnedReceiptBytes;
    if (warnedBytes > MAX_PHASE_LINEAGE_BYTES) throw new Error('fallback receipt lineage exceeds the write budget');
    const fallback = path.join(repo, '.artifacts', 'governed-feature-delivery-fallback', `${hashText(artifactPath(repo, output)).slice(0, 16)}-${Date.now()}.json`);
    try {
      writeExclusiveJson(fallback, warnedValue, repo);
      return { value: warnedValue, ledgerWarning: warning, path: fallback };
    } catch (fallbackError) {
      throw new Error(`ledger write and fallback both failed: ${error.message}; ${fallbackError.message}`);
    }
  }
}

function loadReceiptWithLineage(repo, value, { phaseOnly = false } = {}) {
  const context = { visited: new Set(), records: 0, bytes: 0 };
  const receipt = loadReceipt(repo, value, context, phaseOnly);
  return { receipt, lineage: { records: context.records, bytes: context.bytes } };
}

function strictCheckpointCurrentness(repo, value) {
  const checkpointPath = resolveRepoPath(repo, value, '--receipt');
  const validator = fileURLToPath(new URL('./validate-execution-checkpoint.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [validator, '--checkpoint', artifactPath(repo, checkpointPath), '--repo', repo, '--enforce-source-baseline', 'true'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  let validation;
  try { validation = JSON.parse(result.stdout); }
  catch { throw new Error(result.stderr?.trim() || 'strict checkpoint currentness did not return JSON'); }
  if (result.status === 0 && validation.ok) return [];
  if (result.status === 2 && Array.isArray(validation.issues)) return validation.issues;
  throw new Error(validation.message || result.stderr?.trim() || 'strict checkpoint currentness failed');
}

function loadReceipt(repo, value, context = null, phaseOnly = false) {
  const traversal = context ?? { visited: new Set(), records: 0, bytes: 0 };
  const receiptPath = resolveRepoPath(repo, value, '--receipt');
  const receiptRealPath = realpathSync(receiptPath);
  const key = repositoryPathKey(receiptRealPath, repositoryCaseSemantics(repo));
  if (traversal.visited.has(key)) throw new Error('receipt lineage cycle detected');
  traversal.visited.add(key);
  traversal.records += 1;
  traversal.bytes += statSync(receiptPath).size;
  if (traversal.records > MAX_PHASE_LINEAGE_RECORDS || traversal.bytes > MAX_PHASE_LINEAGE_BYTES) throw new Error('receipt lineage exceeds the read budget');
  const receipt = readJson(receiptPath);
  if (receipt.schemaVersion === 'GovernedFeatureDeliveryCheckpoint/v1') {
    if (phaseOnly) throw new Error('phase lineage cannot contain a strict checkpoint');
    const validator = fileURLToPath(new URL('./validate-execution-checkpoint.mjs', import.meta.url));
    const validation = JSON.parse(execFileSync(process.execPath, [validator, '--checkpoint', artifactPath(repo, receiptPath), '--repo', repo, '--historical', 'true'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 4 * 1024 * 1024 }));
    traversal.records = validation.lineageRecords + validation.sourceLineageRecords;
    traversal.bytes = validation.lineageBytes + validation.sourceLineageBytes;
    return { ...receipt, phaseId: receipt.currentPhase, mode: 'strict', continuation: 'merge', strictState: receipt.state, progress: legacyProgress(receipt), warnings: [] };
  }
  validateReceipt(repo, receipt);
  assertScopeExtensionsContained(repo, receipt);
  if (receipt.previousReceiptPath || receipt.previousReceiptHash) {
    if (!receipt.previousReceiptPath || !receipt.previousReceiptHash) throw new Error('receipt lineage requires both previous path and hash');
    const previousPath = resolveRepoPath(repo, receipt.previousReceiptPath, 'previous receipt');
    if (sha256File(previousPath) !== receipt.previousReceiptHash) throw new Error('previous receipt hash does not match');
    const previous = loadReceipt(repo, receipt.previousReceiptPath, traversal, phaseOnly);
    const strictUpgrade = previous.mode !== 'strict' && receipt.mode === 'strict' && receipt.state === 'STRICT_REQUIRED';
    const nextPhaseStart = previous.state === 'NEXT_PHASE' && ['BASELINE', 'STRICT_REQUIRED'].includes(receipt.state) && previous.successor?.target === receipt.phaseId;
    if (previous.schemaVersion !== receipt.schemaVersion || previous.featureId !== receipt.featureId || (!strictUpgrade && !nextPhaseStart && previous.mode !== receipt.mode) || previous.continuation !== receipt.continuation) throw new Error('receipt lineage changed immutable delivery fields');
    if (nextPhaseStart) {
      if (receipt.baseSha !== previous.successor.baseSha || receipt.baseline.headSha !== previous.successor.baseSha || receipt.baseline.branch === previous.baseline.branch) throw new Error('next phase baseline does not match the sealed successor');
    } else {
      const previousExtensions = previous.scopeExtensions ?? [];
      const currentExtensions = receipt.scopeExtensions ?? [];
      if (currentExtensions.length < previousExtensions.length || previousExtensions.some((entry, index) => !sameValue(entry, currentExtensions[index]))) throw new Error('receipt lineage rewrote lightweight scope extensions');
      if (currentExtensions.length > previousExtensions.length && !['IMPLEMENTING', 'VERIFIED'].includes(receipt.state)) throw new Error('lightweight scope extensions may be appended only during implementation or verification');
      for (const field of ['phaseId', 'baseSha', 'planHash', 'scopeHash', 'riskPolicyHash', 'baseline', 'artifacts']) {
        if (!sameValue(previous[field], receipt[field])) throw new Error(`receipt lineage changed immutable field: ${field}`);
      }
      if (!strictUpgrade && !sameValue(previous.risk, receipt.risk)) throw new Error('receipt lineage changed immutable risk classification');
      if (receipt.verification.length < previous.verification.length || previous.verification.some((entry, index) => !sameValue(entry, receipt.verification[index]))) throw new Error('receipt lineage rewrote verification evidence');
      for (const field of ['commit', 'pullRequest', 'merge']) {
        if (previous[field] !== null && !sameValue(previous[field], receipt[field])) throw new Error(`receipt lineage rewrote ${field} evidence`);
      }
    }
    const transitions = {
      BASELINE: ['IMPLEMENTING', 'VERIFIED', 'STRICT_REQUIRED'], IMPLEMENTING: ['IMPLEMENTING', 'VERIFIED', 'STRICT_REQUIRED'],
      VERIFIED: ['VERIFIED', 'IMPLEMENTING', 'COMMITTED', 'STRICT_REQUIRED'],
      COMMITTED: previous.mode === 'fast' ? ['STRICT_REQUIRED'] : previous.continuation === 'merge' ? ['PR_GREEN', 'STRICT_REQUIRED'] : previous.continuation === 'pause' ? ['PAUSED', 'STRICT_REQUIRED'] : ['NEXT_PHASE', 'STRICT_REQUIRED'],
      PR_GREEN: ['MERGED', 'STRICT_REQUIRED'], MERGED: ['NEXT_PHASE'], PAUSED: ['NEXT_PHASE'], NEXT_PHASE: ['BASELINE', 'STRICT_REQUIRED'],
    };
    if (!(transitions[previous.state] ?? []).includes(receipt.state)) throw new Error(`invalid receipt lineage transition: ${previous.state} -> ${receipt.state}`);
  }
  return receipt;
}

function liveStatus(repo, receipt) {
  if (receipt.schemaVersion !== 'GovernedFeatureDeliveryPhaseReceipt/v2') {
    const warnings = [...(receipt.warnings ?? [])];
    const branch = currentBranch(repo);
    const headSha = currentHead(repo);
    const worktree = workingPaths(repo).length ? 'dirty' : 'clean';
    const livePhaseStates = ['DISCOVERED', 'SPEC_FROZEN', 'PHASE_PLANNED', 'RED_CONFIRMED', 'GREEN_CONFIRMED', 'STOP_GATE_GREEN', 'REVIEWED', 'PR_GREEN'];
    if (livePhaseStates.includes(receipt.state)) {
      if (branch !== receipt.branch) warnings.push(`branch changed: expected ${receipt.branch}, found ${branch}`);
      if (headSha !== receipt.headSha) warnings.push(`HEAD changed: expected ${receipt.headSha}, found ${headSha}`);
    } else if (receipt.state === 'NEXT_PHASE') {
      if (headSha !== receipt.merge?.sha) warnings.push(`HEAD changed: expected merged successor base ${receipt.merge?.sha}, found ${headSha}`);
      if (branch === 'DETACHED') warnings.push('next phase requires a named branch; current checkout is detached');
      if (branch === receipt.branch) warnings.push('next phase must use a different branch from the completed phase');
    }
    if (['REVIEWED', 'PR_GREEN'].includes(receipt.state) && worktree !== 'clean') warnings.push('review and PR states require a clean worktree');
    return { progress: legacyProgress(receipt, warnings), warnings, current: { branch, headSha, worktree, receiptCurrent: warnings.length === 0 } };
  }
  const historicalWarnings = [...(receipt.warnings ?? [])];
  const currentnessIssues = [];
  const check = (operation, prefix = '') => {
    try { operation(); }
    catch (error) { currentnessIssues.push(`${prefix}${error.message}`); }
  };
  const branch = currentBranch(repo);
  const headSha = currentHead(repo);
  const tree = worktreeFingerprint(repo);
  const phaseInputStates = ['BASELINE', 'IMPLEMENTING', 'VERIFIED', 'COMMITTED', 'PAUSED', 'STRICT_REQUIRED'];
  if (phaseInputStates.includes(receipt.state)) {
    check(() => assertInputsCurrent(repo, receipt));
    check(() => assertBaselineDirtPreserved(repo, receipt));
    check(() => assertIgnoredGovernedCurrent(repo, receipt));
  }
  if (['BASELINE', 'IMPLEMENTING', 'VERIFIED', 'COMMITTED'].includes(receipt.state)) {
    if (branch !== receipt.baseline.branch) currentnessIssues.push(`branch changed: expected ${receipt.baseline.branch}, found ${branch}`);
    const expectedHead = receipt.state === 'COMMITTED' ? receipt.commit.sha : receipt.headSha;
    if (headSha !== expectedHead) currentnessIssues.push(`HEAD changed: expected ${expectedHead}, found ${headSha}`);
  } else if (receipt.state === 'PAUSED') {
    if (headSha !== receipt.commit.sha) currentnessIssues.push(`HEAD changed: expected ${receipt.commit.sha}, found ${headSha}`);
  } else if (receipt.state === 'NEXT_PHASE') {
    if (headSha !== receipt.successor.baseSha) currentnessIssues.push(`HEAD changed: expected successor base ${receipt.successor.baseSha}, found ${headSha}`);
    if (branch === 'DETACHED') currentnessIssues.push('next phase requires a named branch; current checkout is detached');
    if (branch === receipt.baseline.branch) currentnessIssues.push('next phase must use a different branch from the previous phase');
  } else if (receipt.state === 'PR_GREEN') {
    check(() => git(repo, ['rev-parse', `${receipt.commit.sha}^{commit}`]), 'phase commit object is unavailable: ');
  } else if (receipt.state === 'STRICT_REQUIRED') {
    if (branch !== receipt.strictBoundary.branch) currentnessIssues.push(`branch changed: expected ${receipt.strictBoundary.branch}, found ${branch}`);
    if (headSha !== receipt.strictBoundary.headSha) currentnessIssues.push(`HEAD changed: expected ${receipt.strictBoundary.headSha}, found ${headSha}`);
    if (tree.statusHash !== receipt.strictBoundary.treeHash || tree.worktree !== 'clean') currentnessIssues.push('strict-init requires the unchanged, clean pre-implementation STRICT_REQUIRED boundary');
  } else if (receipt.state === 'MERGED') {
    check(() => validateStrongMerge(repo, {
      phaseBranch: receipt.baseline.branch,
      reviewedSha: receipt.commit.sha,
      merge: { sha: receipt.merge.sha, ref: receipt.merge.ref, containsReviewedSha: receipt.commit.sha, mergedAt: receipt.merge.mergedAt },
      integrationRefs: receiptIntegrationRefs(repo, receipt),
    }));
  }
  if (receipt.state === 'BASELINE' && tree.statusHash !== receipt.baseline.statusHash) currentnessIssues.push('working tree changed since baseline; implementation is in progress');
  if (receipt.state === 'VERIFIED') {
    if (tree.statusHash !== receipt.verification.at(-1)?.treeHash) currentnessIssues.push('working tree changed after verification');
    check(() => assertVerificationOutputCurrent(repo, receipt.verification.at(-1)));
  }
  if (['COMMITTED', 'PAUSED'].includes(receipt.state)) {
    check(() => assertNoPhaseResidual(repo, receipt));
    check(() => assertVerificationOutputCurrent(repo, boundVerification(receipt)));
  }
  if (['BASELINE', 'IMPLEMENTING', 'VERIFIED', 'COMMITTED', 'PAUSED'].includes(receipt.state)) {
    let liveRisk = null;
    try {
      const frozenPhasePaths = receipt.commit ? commitPaths(repo, receipt.commit.sha) : null;
      liveRisk = classifyRisk(repo, receipt.artifacts?.scopePath, receipt.artifacts?.riskPolicyPath, receipt.continuation, receipt, [], frozenPhasePaths);
    } catch (error) {
      currentnessIssues.push(`live risk could not be classified: ${error.message}`);
    }
    if (liveRisk?.strict && receipt.mode !== 'strict') currentnessIssues.push(`live risk requires strict upgrade: ${liveRisk.reasons.join(', ')}`);
  }
  const warnings = [...new Set([...historicalWarnings, ...currentnessIssues])];
  const stateForProgress = receipt.state === 'BASELINE' && tree.statusHash !== receipt.baseline.statusHash ? 'IMPLEMENTING' : receipt.state;
  return {
    progress: progress(stateForProgress, warnings, receipt.continuation, receipt.mode),
    warnings,
    current: { branch, headSha, worktree: tree.worktree, treeHash: tree.statusHash, receiptCurrent: currentnessIssues.length === 0 },
  };
}

function verifyCommand(repo, command) {
  const result = spawnSync(command, { cwd: repo, shell: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 });
  return { status: result.status === 0 && !result.error ? 'pass' : 'fail', exitCode: result.status, signal: result.signal, output: `${result.stdout ?? ''}${result.stderr ?? ''}`, error: result.error?.message ?? null };
}

try {
  const options = parseArgs(process.argv.slice(2), new Set(['target-path']), new Set([
    'action', 'repo', 'out', 'receipt', 'previous', 'feature-id', 'phase-id', 'next-phase', 'mode', 'continuation',
    'plan', 'scope', 'risk-policy', 'verify-command', 'verify-output', 'commit-message', 'pr-url', 'merge-sha', 'merge-ref',
    'spec', 'freeze-receipt', 'successor-policy', 'authority-policy', 'confirm-continuation',
    'target-path', 'scope-rationale',
  ]));
  if (options.help) { process.stdout.write(`${HELP}\n`); process.exit(0); }
  const repo = path.resolve(options.repo ?? process.cwd());
  const action = options.action ?? 'start';
  if (action === 'phase-lineage') {
    const loaded = loadReceiptWithLineage(repo, required(options, 'receipt'), { phaseOnly: true });
    emit({ ok: true, phaseId: loaded.receipt.phaseId, state: loaded.receipt.state, lineage: loaded.lineage });
  } else if (action === 'status') {
    const receiptPath = required(options, 'receipt');
    const loaded = loadReceiptWithLineage(repo, receiptPath);
    const receipt = loaded.receipt.schemaVersion === 'GovernedFeatureDeliveryCheckpoint/v1'
      ? { ...loaded.receipt, warnings: strictCheckpointCurrentness(repo, receiptPath) }
      : loaded.receipt;
    const live = liveStatus(repo, receipt);
    emit({ ok: true, phaseId: receipt.phaseId, state: receipt.state, mode: receipt.mode, progress: live.progress, current: live.current, lineage: loaded.lineage, strictHandoff: receipt.state === 'STRICT_REQUIRED' ? strictHandoff(receipt) : null, warnings: live.warnings });
  } else if (action === 'strict-init') {
    const parentPath = resolveRepoPath(repo, required(options, 'receipt'), '--receipt');
    const parent = loadReceiptWithLineage(repo, required(options, 'receipt')).receipt;
    if (parent.schemaVersion !== 'GovernedFeatureDeliveryPhaseReceipt/v2' || parent.state !== 'STRICT_REQUIRED') throw new Error('strict-init requires a v2 STRICT_REQUIRED receipt');
    if (!parent.baseline?.ignoredGoverned) throw new Error('strict-init requires an ignored governed baseline; establish a new strict baseline first');
    if (parent.continuation !== 'merge' && options['confirm-continuation'] !== 'merge') throw new Error('strict v1 backend is merge-only; rerun with --confirm-continuation merge after explicit confirmation');
    assertInputsCurrent(repo, parent);
    assertIgnoredGovernedCurrent(repo, parent);
    const boundaryTree = worktreeFingerprint(repo);
    if (parent.strictBoundary.headSha !== parent.baseSha || currentBranch(repo) !== parent.strictBoundary.branch || currentHead(repo) !== parent.strictBoundary.headSha || boundaryTree.statusHash !== parent.strictBoundary.treeHash || boundaryTree.worktree !== 'clean') throw new Error('strict-init requires the unchanged, clean pre-implementation STRICT_REQUIRED boundary');
    const strictInputs = {
      spec: options.spec,
      'freeze-receipt': options['freeze-receipt'],
      plan: options.plan ?? parent.artifacts?.planPath,
      scope: options.scope ?? parent.artifacts?.scopePath,
      'successor-policy': options['successor-policy'],
      'authority-policy': options['authority-policy'],
    };
    const missing = STRICT_INPUT_OPTIONS.filter((option) => !strictInputs[option]);
    if (missing.length) throw new Error(`strict-init requires ${missing.map((option) => `--${option}`).join(', ')}`);
    if (parent.artifacts?.planPath && strictInputs.plan !== parent.artifacts.planPath) throw new Error('strict-init cannot override the phase plan from STRICT_REQUIRED');
    if (parent.artifacts?.scopePath && strictInputs.scope !== parent.artifacts.scopePath) throw new Error('strict-init cannot override the scope from STRICT_REQUIRED');
    const output = ledgerOutputPath(repo, required(options, 'out'));
    if (existsSync(output)) throw new Error('strict-init requires an unused ledger output path');
    const initializer = fileURLToPath(new URL('./init-execution-checkpoint.mjs', import.meta.url));
    const initArgs = [initializer, '--repo', repo, '--out', artifactPath(repo, output), '--feature-id', parent.featureId, '--phase-id', parent.phaseId, '--source-phase-receipt', artifactPath(repo, parentPath), '--confirmed-continuation', 'merge'];
    for (const option of STRICT_INPUT_OPTIONS) initArgs.push(`--${option}`, strictInputs[option]);
    try {
      execFileSync(process.execPath, initArgs, { encoding: 'utf8', stdio: 'pipe', maxBuffer: 4 * 1024 * 1024 });
    } catch (error) {
      throw new Error(`strict backend initialization failed: ${error.stdout?.toString().trim() || error.stderr?.toString().trim() || error.message}`);
    }
    const checkpoint = loadReceipt(repo, artifactPath(repo, output));
    emit({ ok: true, receipt: artifactPath(repo, output), sourceReceipt: artifactPath(repo, parentPath), sourceReceiptHash: sha256File(parentPath), mode: 'strict', state: checkpoint.state, progress: checkpoint.progress, warnings: checkpoint.warnings });
  } else if (action === 'start') {
    const output = ledgerOutputPath(repo, required(options, 'out'));
    const featureId = required(options, 'feature-id');
    const phaseId = required(options, 'phase-id');
    const requestedMode = options.mode ?? 'auto';
    const continuation = options.continuation ?? 'commit';
    if (!['auto', 'fast', 'phase', 'strict'].includes(requestedMode)) throw new Error('mode must be auto, fast, phase, or strict');
    if (!['commit', 'merge', 'pause'].includes(continuation)) throw new Error('continuation must be commit, merge, or pause');
    const previousLoad = options.previous ? loadReceiptWithLineage(repo, options.previous) : null;
    const previous = previousLoad?.receipt ?? null;
    if (previous && (previous.schemaVersion !== 'GovernedFeatureDeliveryPhaseReceipt/v2' || previous.state !== 'NEXT_PHASE' || previous.successor?.target !== phaseId || previous.featureId !== featureId)) throw new Error('--previous must be a v2 NEXT_PHASE receipt for this feature and phase');
    if (previous) {
      if (previous.successor.baseSha !== currentHead(repo)) throw new Error('next phase must start at the exact recorded successor base SHA');
      if (previous.continuation !== continuation) throw new Error('next phase continuation must match the sealed previous phase');
      if (currentBranch(repo) === previous.baseline.branch) throw new Error('next phase must use a different branch from the previous phase');
    }
    if (currentBranch(repo) === 'DETACHED') throw new Error('phase baseline requires a named branch');
    const discoveredPolicy = options['risk-policy'] ?? (existsSync(path.join(repo, '.governed-feature-delivery.json')) ? '.governed-feature-delivery.json' : null);
    const targetPaths = normalizeTargetPaths(repo, options['target-path'] ?? []);
    assertTargetPathsContained(repo, targetPaths);
    const targetScope = inspectPreflightScope(repo, options.scope, targetPaths);
    if (targetScope.forbidden.length) throw new Error(`preflight target is forbidden phase work: ${targetScope.forbidden.join(', ')}`);
    const risk = classifyRisk(repo, options.scope, discoveredPolicy, continuation, null, targetPaths);
    if (requestedMode === 'strict') {
      risk.strict = true;
      risk.reasons = [...new Set([...risk.reasons, 'explicit strict mode'])];
    }
    const hasPhaseInputs = Boolean(options.plan || options.scope);
    if (previous && requestedMode === 'fast') throw new Error('a sealed successor cannot downgrade from phase to fast');
    const mode = requestedMode === 'auto' ? (risk.strict ? 'strict' : previous || hasPhaseInputs || continuation !== 'commit' ? 'phase' : 'fast') : requestedMode;
    if (mode === 'fast' && continuation !== 'commit') throw new Error('fast mode is single-phase and requires continuation=commit');
    if (mode === 'phase' && (!options.plan || !options.scope)) throw new Error('phase mode requires both --plan and --scope');
    const scopeExtensions = risk.strict ? [] : appendScopeExtensions(repo, { scopeExtensions: [] }, targetScope.outside, options['scope-rationale']);
    const warnings = [];
    if (risk.strict && continuation !== 'merge') warnings.push('strict v1 backend requires continuation=merge; start a new strict receipt after explicit confirmation');
    if (requestedMode !== 'strict' && risk.strict) {
      warnings.push(`risk auto-upgrade: ${risk.reasons.join(', ')}`);
    }
    const headSha = currentHead(repo);
    const baselineTree = worktreeFingerprint(repo);
    if (risk.strict && baselineTree.worktree !== 'clean') throw new Error('strict handoff requires a clean worktree; isolate or restore existing changes before retrying');
    const baselinePaths = changedPaths(repo, headSha);
    assertLightweightEntryTypes(repo, baselinePaths);
    const artifacts = { planPath: options.plan ?? null, scopePath: options.scope ?? null, riskPolicyPath: discoveredPolicy };
    const baseline = { branch: currentBranch(repo), headSha, worktree: baselineTree.worktree, statusHash: baselineTree.statusHash, changedPaths: baselinePaths, fileHashes: Object.fromEntries(baselinePaths.map((file) => [file, fileHash(repo, file)])), treeModes: treeModes(repo, baselinePaths), ignoredGoverned: governedIgnoredFingerprint(repo, ignoredGovernedPathspecs(repo, { artifacts })), capturedAt: now() };
    const planHash = readOptionalHash(repo, options.plan);
    const phaseScopeHash = options.scope ? scopeHash(readJson(resolveRepoPath(repo, options.scope, '--scope'))) : null;
    if (mode === 'phase' && readJson(resolveRepoPath(repo, options.scope, '--scope')).allowedPaths?.length === 0) throw new Error('phase scope requires at least one allowedPaths entry');
    const riskPolicyHash = readOptionalHash(repo, discoveredPolicy);
    const state = risk.strict ? 'STRICT_REQUIRED' : 'BASELINE';
    const receipt = {
      schemaVersion: 'GovernedFeatureDeliveryPhaseReceipt/v2', featureId, phaseId,
      mode: risk.strict ? 'strict' : mode, continuation, state,
      baseSha: headSha, headSha, planHash, scopeHash: phaseScopeHash, riskPolicyHash, baseline,
      scopeExtensions, verification: [], commit: null, pullRequest: null, merge: null, successor: null, risk,
      strictBoundary: state === 'STRICT_REQUIRED' ? strictBoundary(repo) : null,
      artifacts,
      progress: progress(state, warnings, continuation, risk.strict ? 'strict' : mode), warnings,
      previousReceiptPath: previous ? artifactPath(repo, resolveRepoPath(repo, options.previous, '--previous')) : null,
      previousReceiptHash: previous ? sha256File(resolveRepoPath(repo, options.previous, '--previous')) : null,
      updatedAt: now(),
    };
    const result = writeReceipt(repo, output, receipt, [], false, previousLoad?.lineage ?? null);
    emit({ ok: true, receipt: result.path ? artifactPath(repo, result.path) : null, mode: receipt.mode, state: receipt.state, progress: result.value.progress, strictHandoff: receipt.state === 'STRICT_REQUIRED' ? strictHandoff(receipt) : null, warnings: result.value.warnings });
  } else {
    const parentPath = resolveRepoPath(repo, required(options, 'receipt'), '--receipt');
    const parentLoad = loadReceiptWithLineage(repo, required(options, 'receipt'));
    const parent = parentLoad.receipt;
    const writeChild = (destination, value, childWarnings = [], requiredLedger = false, capacity = null) => writeReceipt(repo, destination, value, childWarnings, requiredLedger, parentLoad.lineage, capacity);
    const output = ledgerOutputPath(repo, required(options, 'out'));
    if (parent.schemaVersion === 'GovernedFeatureDeliveryCheckpoint/v1') throw new Error('v1 checkpoint is read-only here; continue with the strict checkpoint backend');
    if (parent.state === 'STRICT_REQUIRED') throw new Error('strict upgrade is latched; use the strict checkpoint backend');
    if (!parent.baseline?.ignoredGoverned) throw new Error('receipt lacks an ignored governed baseline; establish a new baseline before creating further delivery evidence');
    const allowedFrom = {
      preflight: ['BASELINE', 'IMPLEMENTING', 'VERIFIED'],
      verify: ['BASELINE', 'IMPLEMENTING', 'VERIFIED'],
      commit: ['VERIFIED'],
      'pr-green': ['COMMITTED'],
      merge: ['PR_GREEN'],
      next: ['COMMITTED', 'MERGED'],
      resume: ['PAUSED'],
    };
    if (!(allowedFrom[action] ?? []).includes(parent.state)) throw new Error(`invalid phase transition: ${parent.state} -> ${action}`);
    const sealedMergeAction = action === 'merge' || (action === 'next' && parent.state === 'MERGED');
    if (!sealedMergeAction) {
      assertInputsCurrent(repo, parent);
      assertIgnoredGovernedCurrent(repo, parent);
    }
    const preflightTargets = action === 'preflight' ? normalizeTargetPaths(repo, options['target-path'] ?? []) : [];
    assertTargetPathsContained(repo, preflightTargets);
    const current = currentHead(repo);
    const tree = worktreeFingerprint(repo);
    const warnings = [];
    if (['preflight', 'verify', 'commit', 'pr-green'].includes(action) || (action === 'next' && parent.state === 'COMMITTED')) assertBaselineBranch(repo, parent);
    if (['preflight', 'verify'].includes(action) && current !== parent.headSha) throw new Error('Git HEAD changed after the receipt; resume from the current canonical receipt or establish a new baseline');
    let preflightScope = { outside: [], forbidden: [] };
    if (action === 'preflight') {
      if (preflightTargets.length === 0) throw new Error('preflight requires at least one --target-path');
      preflightScope = inspectPreflightScope(repo, parent.artifacts?.scopePath, preflightTargets, parent);
      if (preflightScope.forbidden.length) throw new Error(`preflight target is forbidden phase work: ${preflightScope.forbidden.join(', ')}`);
    }
    const changedScope = action === 'verify' ? inspectChangedScope(repo, parent) : null;
    if (changedScope?.forbidden.length) throw new Error(`forbidden phase work detected: ${changedScope.forbidden.join(', ')}`);
    if (['commit', 'pr-green'].includes(action) || (action === 'next' && parent.state === 'COMMITTED') || action === 'resume') assertVerificationOutputCurrent(repo, boundVerification(parent));
    const frozenPhasePaths = parent.commit ? commitPaths(repo, parent.commit.sha) : null;
    const currentRisk = sealedMergeAction ? parent.risk : classifyRisk(repo, parent.artifacts?.scopePath, parent.artifacts?.riskPolicyPath, parent.continuation, parent, preflightTargets, frozenPhasePaths);
    if (currentRisk.strict && parent.mode !== 'strict') {
      if (tree.worktree !== 'clean' || current !== parent.baseSha) throw new Error('strict upgrade requires the clean phase baseline; restore phase changes and rerun preflight');
      const next = withParent(repo, parentPath, { ...parent, mode: 'strict', state: 'STRICT_REQUIRED', headSha: current, risk: currentRisk, strictBoundary: strictBoundary(repo) });
      const written = writeChild(output, next, [`risk auto-upgrade: ${currentRisk.reasons.join(', ')}`]);
      emit({ ok: false, code: 'strict_upgrade_required', receipt: written.path ? artifactPath(repo, written.path) : null, state: written.value.state, progress: written.value.progress, warnings: written.value.warnings }, 2);
    } else if (action === 'preflight') {
      const scopeExtensions = appendScopeExtensions(repo, parent, preflightScope.outside, options['scope-rationale']);
      const scopeExpanded = scopeExtensions.length > (parent.scopeExtensions ?? []).length;
      const nextValue = { ...parent, state: parent.state === 'BASELINE' || scopeExpanded ? 'IMPLEMENTING' : parent.state, headSha: current };
      if (parent.scopeExtensions !== undefined || scopeExpanded) nextValue.scopeExtensions = scopeExtensions;
      const next = withParent(repo, parentPath, nextValue);
      const written = writeChild(output, next);
      emit({ ok: true, receipt: written.path ? artifactPath(repo, written.path) : null, state: written.value.state, progress: written.value.progress, warnings: written.value.warnings });
    } else if (action === 'verify') {
      let scopeExtensions = parent.scopeExtensions ?? [];
      let effectiveParent = parent.scopeExtensions === undefined ? { ...parent } : { ...parent, scopeExtensions };
      const command = required(options, 'verify-command');
      const commandHash = hashText(canonicalCommand(command));
      const inputHashes = { planHash: parent.planHash, scopeHash: parent.scopeHash, riskPolicyHash: parent.riskPolicyHash };
      if (parent.scopeExtensions !== undefined) inputHashes.scopeExtensionsHash = scopeExtensionsHash(effectiveParent);
      if (parent.baseline.ignoredGoverned) inputHashes.ignoredGovernedHash = parent.baseline.ignoredGoverned.hash;
      const outputPath = options['verify-output'] ? ledgerOutputPath(repo, options['verify-output']) : null;
      const outputArtifact = outputPath ? artifactPath(repo, outputPath) : null;
      const reusable = parent.scopeExtensions === undefined ? null : parent.verification.findLast((item) => item.status === 'pass' && item.headSha === current && item.treeHash === tree.statusHash && item.commandHash === commandHash && objectHash(item.inputHashes) === objectHash(inputHashes) && (item.outputPath ?? null) === outputArtifact && verificationOutputMatches(repo, item));
      if (reusable) {
        const verification = parent.verification.at(-1) === reusable ? parent.verification : [...parent.verification, reusable];
        const next = withParent(repo, parentPath, { ...effectiveParent, state: 'VERIFIED', headSha: current, verification, warnings: (effectiveParent.warnings ?? []).filter((warning) => warning !== 'verification failed; commit is blocked') });
        const written = writeChild(output, next);
        emit({ ok: true, reused: true, receipt: written.path ? artifactPath(repo, written.path) : null, state: written.value.state, progress: written.value.progress, warnings: written.value.warnings });
        process.exit(0);
      }
      if (outputPath && existsSync(outputPath)) throw new Error('--verify-output must not already exist');
      if (parent.verification.length >= PHASE_RECEIPT_SCHEMA.properties.verification.maxItems) throw new Error('verification evidence limit reached; start a new phase baseline');
      scopeExtensions = appendScopeExtensions(repo, effectiveParent, changedScope.outside, options['scope-rationale']);
      effectiveParent = { ...effectiveParent, scopeExtensions };
      const provisionalChanges = assertAuthorizedScope(repo, effectiveParent);
      const provisionalModes = treeModes(repo, provisionalChanges);
      assertLightweightEntryTypes(repo, provisionalChanges, provisionalModes);
      const provisionalInputHashes = { planHash: parent.planHash, scopeHash: parent.scopeHash, scopeExtensionsHash: scopeExtensionsHash(effectiveParent), riskPolicyHash: parent.riskPolicyHash };
      if (parent.baseline.ignoredGoverned) provisionalInputHashes.ignoredGovernedHash = parent.baseline.ignoredGoverned.hash;
      const provisionalVerification = {
        command: canonicalCommand(command), commandHash, status: 'fail', headSha: current, treeHash: tree.statusHash,
        changedPaths: [...provisionalChanges].sort(), blobHashes: blobHashes(repo, provisionalChanges), treeModes: provisionalModes,
        inputHashes: provisionalInputHashes, completedAt: now(), outputPath: outputArtifact,
        outputHash: outputArtifact ? '0'.repeat(64) : null,
      };
      const projectedVerificationReceipt = withParent(repo, parentPath, {
        ...effectiveParent, state: 'IMPLEMENTING', headSha: current,
        verification: [...(parent.verification ?? []), provisionalVerification],
      });
      const verificationCapacity = assertVerificationReceiptCapacity(repo, projectedVerificationReceipt, parentLoad.lineage);
      const result = verifyCommand(repo, command);
      const postHead = currentHead(repo);
      if (postHead !== current || currentBranch(repo) !== parent.baseline.branch) throw new Error('verification command changed Git HEAD or branch');
      assertInputsCurrent(repo, effectiveParent);
      assertIgnoredGovernedCurrent(repo, effectiveParent);
      const postRisk = classifyRisk(repo, parent.artifacts?.scopePath, parent.artifacts?.riskPolicyPath, parent.continuation, effectiveParent);
      const postScope = inspectChangedScope(repo, effectiveParent);
      if (postScope.forbidden.length) throw new Error(`verification command introduced forbidden phase work: ${postScope.forbidden.join(', ')}`);
      if (postRisk.strict && parent.mode !== 'strict') throw new Error(`verification command introduced strict risk: ${postRisk.reasons.join(', ')}`);
      const postAdditions = postScope.outside;
      scopeExtensions = appendScopeExtensions(repo, effectiveParent, postAdditions, options['scope-rationale']);
      effectiveParent = { ...effectiveParent, scopeExtensions };
      const phaseChanges = assertAuthorizedScope(repo, effectiveParent);
      assertLightweightEntryTypes(repo, phaseChanges);
      const postTree = worktreeFingerprint(repo);
      const postInputHashes = { planHash: parent.planHash, scopeHash: parent.scopeHash, scopeExtensionsHash: scopeExtensionsHash(effectiveParent), riskPolicyHash: parent.riskPolicyHash };
      if (parent.baseline.ignoredGoverned) postInputHashes.ignoredGovernedHash = parent.baseline.ignoredGoverned.hash;
      let persistedOutput = outputArtifact;
      const verification = { command: canonicalCommand(command), commandHash, status: result.status, headSha: postHead, treeHash: postTree.statusHash, changedPaths: [...phaseChanges].sort(), blobHashes: blobHashes(repo, phaseChanges), treeModes: treeModes(repo, phaseChanges), inputHashes: postInputHashes, completedAt: now(), outputPath: persistedOutput, outputHash: persistedOutput ? hashText(result.output) : null };
      const nextWarnings = result.status === 'pass' ? (effectiveParent.warnings ?? []).filter((warning) => warning !== 'verification failed; commit is blocked') : effectiveParent.warnings;
      let next = withParent(repo, parentPath, { ...effectiveParent, state: result.status === 'pass' ? 'VERIFIED' : 'IMPLEMENTING', headSha: postHead, verification: [...(parent.verification ?? []), verification], warnings: nextWarnings });
      if (result.status === 'fail') warnings.push('verification failed; commit is blocked');
      assertChildReceiptAdmissible(repo, next, warnings, parentLoad.lineage);
      let outputCreated = false;
      if (outputPath) {
        try {
          mkdirSync(path.dirname(outputPath), { recursive: true });
          writeFileSync(outputPath, result.output, { encoding: 'utf8', flag: 'wx' });
          outputCreated = true;
        } catch (error) {
          warnings.push(`verification output write warning: ${error.message}`);
          persistedOutput = null;
          const unboundVerification = { ...verification, outputPath: null, outputHash: null };
          next = { ...next, verification: [...(parent.verification ?? []), unboundVerification] };
          assertChildReceiptAdmissible(repo, next, warnings, parentLoad.lineage);
        }
      }
      let written;
      try { written = writeChild(output, next, warnings, false, verificationCapacity); }
      catch (error) {
        if (outputCreated) rmSync(outputPath, { force: true });
        throw error;
      }
      emit({ ok: result.status === 'pass', receipt: written.path ? artifactPath(repo, written.path) : null, state: written.value.state, progress: written.value.progress, verification: { status: result.status, exitCode: result.exitCode, signal: result.signal, error: result.error, outputPath: persistedOutput }, warnings: written.value.warnings });
      if (result.status !== 'pass') process.exitCode = 1;
    } else if (action === 'commit') {
      const phaseChanges = assertAuthorizedScope(repo, parent);
      assertLightweightEntryTypes(repo, phaseChanges);
      if (parent.state !== 'VERIFIED' || parent.verification.at(-1)?.status !== 'pass') throw new Error('commit requires the latest verification to pass');
      const latestVerification = parent.verification.at(-1);
      if (existsSync(output)) throw new Error('commit boundary requires an unused ledger output path');
      const message = required(options, 'commit-message');
      const pendingPath = commitPendingPath(parentPath);
      const expectedIntent = expectedCommitIntent(parentPath, parent, latestVerification, message);
      const projectedSha = '0'.repeat(current.length);
      assertChildReceiptAdmissible(repo, withParent(repo, parentPath, committedReceipt(parent, projectedSha)), [], parentLoad.lineage);
      if (latestVerification.headSha !== current) {
        if (!existsSync(pendingPath)) throw new Error('HEAD changed after verification; rerun verification');
        const pending = readJson(pendingPath);
        const previousHead = git(repo, ['rev-parse', `${current}^`]).toLowerCase();
        const actualMessageHash = hashText(git(repo, ['show', '-s', '--format=%B', current]).trim());
        const actualPaths = commitPaths(repo, current);
        if (!commitIntentCompatible(pending, expectedIntent, parent)
          || previousHead !== expectedIntent.previousHead
          || currentBranch(repo) !== expectedIntent.branch
          || actualMessageHash !== expectedIntent.messageHash
          || !sameValue(actualPaths, latestVerification.changedPaths)
          || !sameValue(blobHashes(repo, actualPaths, current), latestVerification.blobHashes)
          || !treeModesMatch(latestVerification.treeModes, treeModes(repo, actualPaths, current))) {
          throw new Error('pending commit recovery does not match current verification');
        }
        assertCommitBoundaryCurrent(repo, parent, current);
        const recovered = withParent(repo, parentPath, committedReceipt(parent, current));
        const written = writeChild(output, recovered, [], true);
        rmSync(pendingPath, { force: true });
        emit({ ok: true, recovered: true, receipt: artifactPath(repo, output), state: written.value.state, commitSha: current, progress: written.value.progress, warnings: written.value.warnings });
        process.exit(0);
      }
      if (latestVerification.treeHash !== tree.statusHash) throw new Error('working tree changed after verification; rerun verification');
      if (phaseChanges.length === 0) throw new Error('commit requires at least one phase change after baseline');
      mkdirSync(path.dirname(output), { recursive: true });
      if (!sameValue([...phaseChanges].sort(), latestVerification.changedPaths) || !sameValue(blobHashes(repo, phaseChanges), latestVerification.blobHashes) || !treeModesMatch(latestVerification.treeModes, treeModes(repo, phaseChanges))) throw new Error('phase content changed after verification; rerun verification');
      let pending;
      if (existsSync(pendingPath)) {
        pending = readJson(pendingPath);
        if (!commitIntentCompatible(pending, expectedIntent, parent)) throw new Error(`existing commit intent does not match this commit attempt: ${artifactPath(repo, pendingPath)}`);
      } else {
        pending = { ...expectedIntent, createdAt: now() };
        writeExclusiveJson(pendingPath, pending, repo);
      }
      try {
        const commitPathspecs = phaseChanges.map(literalPathspec);
        execFileSync('git', ['-C', repo, 'add', '-A', '--', ...commitPathspecs]);
        execFileSync('git', ['-C', repo, 'commit', '--only', '-m', message, '--', ...commitPathspecs], { stdio: 'pipe', maxBuffer: 4 * 1024 * 1024 });
      } catch (error) {
        if (currentHead(repo) === current) rmSync(pendingPath, { force: true });
        throw error;
      }
      const sha = currentHead(repo);
      if (git(repo, ['rev-parse', `${sha}^`]).toLowerCase() !== current || !sameValue(commitPaths(repo, sha), pending.phaseChanges) || !sameValue(blobHashes(repo, pending.phaseChanges, sha), pending.blobHashes) || !treeModesMatch(pending.treeModes, treeModes(repo, pending.phaseChanges, sha))) throw new Error('commit content differs from the verified phase snapshot');
      assertCommitBoundaryCurrent(repo, parent, sha);
      const next = withParent(repo, parentPath, committedReceipt(parent, sha));
      const written = writeChild(output, next, [], true);
      rmSync(pendingPath, { force: true });
      emit({ ok: true, receipt: artifactPath(repo, output), state: written.value.state, commitSha: sha, progress: written.value.progress, warnings: written.value.warnings });
    } else if (action === 'pr-green') {
      if (parent.continuation !== 'merge' || parent.state !== 'COMMITTED') throw new Error('PR_GREEN requires merge continuation from COMMITTED');
      if (current !== parent.commit.sha) throw new Error('PR_GREEN requires the committed HEAD');
      assertNoPhaseResidual(repo, parent);
      const next = withParent(repo, parentPath, { ...parent, state: 'PR_GREEN', pullRequest: { url: required(options, 'pr-url'), headSha: current, status: 'green', recordedAt: now() } });
      const written = writeChild(output, next, [], true);
      emit({ ok: true, receipt: artifactPath(repo, output), state: written.value.state, progress: written.value.progress, warnings: written.value.warnings });
    } else if (action === 'merge') {
      if (parent.continuation !== 'merge' || parent.state !== 'PR_GREEN') throw new Error('MERGED requires merge continuation from PR_GREEN');
      const mergeRef = required(options, 'merge-ref');
      const integrationRefs = receiptIntegrationRefs(repo, parent);
      const validatedMerge = validateStrongMerge(repo, {
        phaseBranch: parent.baseline.branch,
        reviewedSha: parent.commit.sha,
        merge: { sha: required(options, 'merge-sha'), ref: mergeRef, containsReviewedSha: parent.commit.sha, mergedAt: now() },
        integrationRefs,
      });
      const mergeSha = validatedMerge.sha;
      const next = withParent(repo, parentPath, { ...parent, state: 'MERGED', headSha: mergeSha, merge: { sha: mergeSha, ref: mergeRef, containsCommitSha: parent.commit.sha, mergedAt: now() } });
      const written = writeChild(output, next, [], true);
      emit({ ok: true, receipt: artifactPath(repo, output), state: written.value.state, mergeSha, progress: written.value.progress, warnings: written.value.warnings });
    } else if (action === 'next' || action === 'resume') {
      if (parent.mode === 'fast') throw new Error('fast mode is single-phase; start a phase delivery before requesting a successor');
      if (parent.continuation === 'pause' && action === 'next') {
        if (parent.state !== 'COMMITTED') throw new Error('pause continuation requires COMMITTED');
        if (current !== parent.commit.sha) throw new Error('pause continuation requires current HEAD at the phase commit');
        assertNoPhaseResidual(repo, parent);
        const next = withParent(repo, parentPath, { ...parent, state: 'PAUSED', successor: null });
        const written = writeChild(output, next, [], true);
        emit({ ok: true, receipt: artifactPath(repo, output), state: written.value.state, progress: written.value.progress, warnings: written.value.warnings });
      } else {
        if (action === 'resume' && (parent.continuation !== 'pause' || parent.state !== 'PAUSED')) throw new Error('resume requires a PAUSED receipt');
        if (action === 'resume' && current !== parent.commit.sha) throw new Error('resume requires current HEAD at the paused phase commit');
        if (action === 'resume') assertNoPhaseResidual(repo, parent);
        const expected = parent.continuation === 'commit' ? 'COMMITTED' : 'MERGED';
        if (action !== 'resume' && parent.state !== expected) throw new Error(`${parent.continuation} continuation requires ${expected} before NEXT_PHASE`);
        if (parent.continuation === 'commit' && current !== parent.commit.sha) throw new Error('commit continuation requires current HEAD at the phase commit');
        if (parent.continuation === 'commit') assertNoPhaseResidual(repo, parent);
        if (parent.continuation === 'merge') {
          validateStrongMerge(repo, {
            phaseBranch: parent.baseline.branch,
            reviewedSha: parent.commit.sha,
            merge: {
              sha: parent.merge.sha,
              ref: parent.merge.ref,
              containsReviewedSha: parent.merge.containsCommitSha,
              mergedAt: parent.merge.mergedAt,
            },
            integrationRefs: parent.risk.integrationRefs ?? [],
          });
        }
        const target = required(options, 'next-phase');
        const baseSha = parent.continuation === 'merge' ? parent.merge.sha : parent.commit.sha;
        const next = withParent(repo, parentPath, { ...parent, state: 'NEXT_PHASE', successor: { target, baseSha, createdAt: now() } });
        const written = writeChild(output, next, [], true);
        emit({ ok: true, receipt: artifactPath(repo, output), state: written.value.state, nextPhase: target, baseSha, progress: written.value.progress, warnings: written.value.warnings });
      }
    } else throw new Error(`unknown action: ${action}`);
  }
} catch (error) {
  fail(error, 'governed_feature_phase_failed');
}
