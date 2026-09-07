#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, realpathSync, statSync } from 'node:fs';
import { validateJsonSchema } from './json-schema-lite.mjs';
import {
  GATE_REPLAY_REASON,
  MAX_JSON_BYTES,
  MAX_STATE_HISTORY,
  MAX_SCOPE_DELTAS,
  MAX_EVIDENCE_ENTRIES,
  SCHEMA_VERSION,
  STATES,
  artifactPath,
  assertMonotonicScopeDelta,
  emit,
  fail,
  parseArgs,
  readJson,
  repositoryCaseSemantics,
  repositoryPathKey,
  required,
  resolveRepoPath,
  sha256File,
  sha256Text,
  policyHash,
  scopeHash,
  NEXT_ACTIONS,
  NEXT_ACTION_TEXT,
  authorityAllowed,
  objectHash,
  validateAuthorityPolicy,
  validateStrongMerge,
  canonicalJson,
  changedIgnoredGovernedPaths,
  git,
  gitNullPaths,
  governedIgnoredFingerprint,
  listWorktreePaths,
  isIsoDateTime,
  normalizeScope,
} from './checkpoint-core.mjs';

const HELP = `Validate checkpoint shape, state history, successor signals, and state-dependent evidence.

Required: --checkpoint FILE
Optional: --repo DIR --historical true --enforce-source-baseline true --enforce-merge-ref true`;
const SHA256 = /^[a-f0-9]{64}$/u;
const GIT_SHA = /^[a-f0-9]{40,64}$/u;
const MAX_LINEAGE_BYTES = 64 * 1024 * 1024;
const MAX_LINEAGE_RECORDS = 64;
const MAX_VALIDATION_ARTIFACT_BYTES = 256 * 1024 * 1024;
const MAX_VALIDATION_ARTIFACT_FILES = 2048;
const MAX_REPORTED_ISSUES = 20;
const MAX_REPORTED_ISSUE_BYTES = 384;
const MAX_REPORTED_ISSUES_BYTES = 1536;
const PHASE_RECEIPT_SCHEMA = readJson(new URL('../assets/phase-receipt.schema.json', import.meta.url));
const EXECUTION_CHECKPOINT_SCHEMA = readJson(new URL('../assets/execution-checkpoint.schema.json', import.meta.url));
const SCOPE_DELTA_FROM = new Set(['PHASE_PLANNED', 'RED_CONFIRMED', 'GREEN_CONFIRMED', 'STOP_GATE_GREEN']);
const REQUIRED = [
  'schemaVersion', 'checkpointGeneration', 'checkpointRevision', 'featureId', 'currentPhase', 'state',
  'specHash', 'phasePlanHash', 'successorPolicyHash', 'authorityPolicyHash', 'scopeHash', 'authorizedScope', 'branch', 'baseSha', 'headSha', 'completedPhase',
  'currentStep', 'stopGateEvidence', 'scopeAttestation', 'reviewer', 'scopeDeltas', 'designFreezeReceipt', 'nextActionCode', 'nextExactAction',
  'successorPolicy', 'stateHistory', 'artifacts', 'updatedAt',
];
const ALLOWED = new Set([
  ...REQUIRED, 'lastSuccessorSignal', 'previousCheckpointHash',
  'recoveryReceipt', 'sourcePhaseReceipt', 'previousCheckpointPath',
  'pullRequest', 'merge', 'release',
]);
const NEXT = {
  DISCOVERED: ['SPEC_FROZEN'], SPEC_FROZEN: ['PHASE_PLANNED'],
  PHASE_PLANNED: ['RED_CONFIRMED'], RED_CONFIRMED: ['GREEN_CONFIRMED'],
  GREEN_CONFIRMED: ['STOP_GATE_GREEN'], STOP_GATE_GREEN: ['REVIEWED'],
  REVIEWED: ['PR_GREEN'], PR_GREEN: ['MERGED'], MERGED: ['NEXT_PHASE', 'RELEASED'],
};

function string(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function sameRepositoryPath(repo, left, right) {
  const semantics = repositoryCaseSemantics(repo);
  return repositoryPathKey(left, semantics) === repositoryPathKey(right, semantics);
}

function hasOnlyKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every((key) => keys.includes(key));
}

function evidenceMatches(checkpoint, kind, status) {
  return checkpoint.stopGateEvidence.some((item) =>
    item.kind === kind && item.status === status && item.headSha === checkpoint.headSha);
}

function truncateUtf8(value, maxBytes) {
  if (Buffer.byteLength(value, 'utf8') <= maxBytes) return value;
  const suffix = '...[truncated]';
  const contentLimit = Math.max(0, maxBytes - Buffer.byteLength(suffix, 'utf8'));
  let result = '';
  let bytes = 0;
  for (const character of value) {
    const characterBytes = Buffer.byteLength(character, 'utf8');
    if (bytes + characterBytes > contentLimit) break;
    result += character;
    bytes += characterBytes;
  }
  return `${result}${suffix}`;
}

function summarizeIssues(issues) {
  const issueBytes = issues.reduce((total, issue) => total + Buffer.byteLength(issue, 'utf8'), 0);
  const reported = [];
  let reportedIssueBytes = 0;
  for (const issue of issues.slice(0, MAX_REPORTED_ISSUES)) {
    const remaining = MAX_REPORTED_ISSUES_BYTES - reportedIssueBytes;
    if (remaining <= Buffer.byteLength('...[truncated]', 'utf8')) break;
    const bounded = truncateUtf8(issue, Math.min(MAX_REPORTED_ISSUE_BYTES, remaining));
    reported.push(bounded);
    reportedIssueBytes += Buffer.byteLength(bounded, 'utf8');
  }
  return {
    issueBytes,
    issues: reported,
    issuesTruncated: reported.length < issues.length || reportedIssueBytes < issueBytes,
    reportedIssueBytes,
  };
}

function hashArtifact(filePath, context) {
  const canonicalPath = canonicalRealPath(filePath, context.caseSemantics);
  const cached = context.hashCache.get(canonicalPath);
  if (cached) return cached;
  const size = statSync(filePath).size;
  if (context.artifactReads >= MAX_VALIDATION_ARTIFACT_FILES) throw new Error(`validation artifact read budget exceeds ${MAX_VALIDATION_ARTIFACT_FILES}`);
  if (context.artifactBytes + size > MAX_VALIDATION_ARTIFACT_BYTES) throw new Error(`validation artifact byte budget exceeds ${MAX_VALIDATION_ARTIFACT_BYTES}`);
  const hash = sha256File(filePath);
  context.hashCache.set(canonicalPath, hash);
  context.artifactReads += 1;
  context.artifactBytes += size;
  return hash;
}

function readArtifactJson(filePath, context) {
  const canonicalPath = canonicalRealPath(filePath, context.caseSemantics);
  const cached = context.jsonCache.get(canonicalPath);
  if (cached) return cached;
  const size = statSync(filePath).size;
  if (context.artifactReads >= MAX_VALIDATION_ARTIFACT_FILES) throw new Error(`validation artifact read budget exceeds ${MAX_VALIDATION_ARTIFACT_FILES}`);
  if (context.artifactBytes + size > MAX_VALIDATION_ARTIFACT_BYTES) throw new Error(`validation artifact byte budget exceeds ${MAX_VALIDATION_ARTIFACT_BYTES}`);
  const value = readJson(filePath);
  context.jsonCache.set(canonicalPath, value);
  context.artifactReads += 1;
  context.artifactBytes += size;
  return value;
}

function canonicalGitArtifactPath(value, label) {
  if (!string(value) || path.isAbsolute(value) || /^[a-z]:[\\/]/iu.test(value) || value.includes('\0') || value.split(/[\\/]/u).includes('..') || value.startsWith(':')) {
    throw new Error(`${label} must be a repository-relative Git path`);
  }
  const normalized = path.posix.normalize(value.replaceAll('\\', '/'));
  if (normalized === '.' || normalized.startsWith('../')) throw new Error(`${label} escapes the repository`);
  return normalized;
}

function readGitArtifact(repo, commitSha, value, label, context) {
  const relativePath = canonicalGitArtifactPath(value, label);
  const cacheKey = `${commitSha}:${relativePath}`;
  const cached = context.gitBlobCache.get(cacheKey);
  if (cached) return cached;
  if (context.artifactReads >= MAX_VALIDATION_ARTIFACT_FILES) throw new Error(`validation artifact read budget exceeds ${MAX_VALIDATION_ARTIFACT_FILES}`);
  const remaining = MAX_VALIDATION_ARTIFACT_BYTES - context.artifactBytes;
  if (remaining <= 0) throw new Error(`validation artifact byte budget exceeds ${MAX_VALIDATION_ARTIFACT_BYTES}`);
  const valueBuffer = execFileSync('git', ['-C', repo, 'cat-file', 'blob', `${commitSha}:${relativePath}`], {
    encoding: 'buffer',
    maxBuffer: remaining + 1,
  });
  if (valueBuffer.length > remaining) throw new Error(`validation artifact byte budget exceeds ${MAX_VALIDATION_ARTIFACT_BYTES}`);
  context.gitBlobCache.set(cacheKey, valueBuffer);
  context.artifactReads += 1;
  context.artifactBytes += valueBuffer.length;
  return valueBuffer;
}

function hashGitArtifact(repo, commitSha, value, label, context) {
  return createHash('sha256').update(readGitArtifact(repo, commitSha, value, label, context)).digest('hex');
}

function readGitArtifactJson(repo, commitSha, value, label, context) {
  const relativePath = canonicalGitArtifactPath(value, label);
  const cacheKey = `${commitSha}:${relativePath}`;
  const cached = context.gitJsonCache.get(cacheKey);
  if (cached) return cached;
  const source = new TextDecoder('utf-8', { fatal: true }).decode(readGitArtifact(repo, commitSha, relativePath, label, context));
  const parsed = JSON.parse(source);
  context.gitJsonCache.set(cacheKey, parsed);
  return parsed;
}

function hashCheckpointArtifact(repo, checkpoint, value, label, context, stableArtifacts) {
  if (stableArtifacts) {
    try { return hashGitArtifact(repo, checkpoint.headSha, value, label, context); }
    catch (error) {
      if (error.status !== 128 || STATES.indexOf(checkpoint.state) >= STATES.indexOf('MERGED') || context.sealedLineageArtifacts) throw error;
    }
  }
  return hashArtifact(resolveRepoPath(repo, value, label), context);
}

function readCheckpointArtifactJson(repo, checkpoint, value, label, context, stableArtifacts) {
  if (stableArtifacts) {
    try { return readGitArtifactJson(repo, checkpoint.headSha, value, label, context); }
    catch (error) {
      if (error.status !== 128 || STATES.indexOf(checkpoint.state) >= STATES.indexOf('MERGED') || context.sealedLineageArtifacts) throw error;
    }
  }
  return readArtifactJson(resolveRepoPath(repo, value, label), context);
}

function validateSourcePhaseLineage(repo, sourcePath, context) {
  const canonicalPath = canonicalRealPath(sourcePath, context.caseSemantics);
  if (context.sourceLineages.has(canonicalPath)) return;
  const runner = fileURLToPath(new URL('./run-phase.mjs', import.meta.url));
  const output = execFileSync(process.execPath, [runner, '--action', 'phase-lineage', '--receipt', artifactPath(repo, sourcePath), '--repo', repo], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 4 * 1024 * 1024 });
  const result = JSON.parse(output);
  if (!result.ok || !Number.isInteger(result.lineage?.records) || !Number.isInteger(result.lineage?.bytes)) throw new Error('source status did not return lineage metadata');
  context.sourceLineages.add(canonicalPath);
  context.sourceLineageRecords += result.lineage.records;
  context.sourceLineageBytes += result.lineage.bytes;
}

function validateEvidence(item, checkpoint, repo, current, issues, context) {
  if (!string(item?.id) || !string(item?.kind) || !string(item?.status)) {
    issues.push('evidence entries require id, kind, and status');
    return;
  }
  const allowedEvidenceKeys = new Set(['id', 'kind', 'status', 'headSha', 'command', 'commandHash', 'inputHashes', 'receiptPath', 'receiptHash', 'completedAt']);
  if (Object.keys(item).some((key) => !allowedEvidenceKeys.has(key))) issues.push(`evidence ${item.id} has unknown fields`);
  if (!GIT_SHA.test(item.headSha ?? '')) issues.push(`evidence ${item.id} has invalid headSha`);
  if (!string(item.command) || !SHA256.test(item.commandHash ?? '')) {
    issues.push(`evidence ${item.id} requires command and commandHash`);
  } else if (item.command !== item.command.trim() || sha256Text(item.command) !== item.commandHash) {
    issues.push(`evidence ${item.id} commandHash does not match command`);
  }
  if (!item.inputHashes || typeof item.inputHashes !== 'object' || Array.isArray(item.inputHashes) || Object.keys(item.inputHashes).length === 0) {
    issues.push(`evidence ${item.id} requires inputHashes`);
  } else if (Object.values(item.inputHashes).some((hash) => !SHA256.test(hash))) {
    issues.push(`evidence ${item.id} contains an invalid input hash`);
  } else {
    const requiredInputs = [...(checkpoint.authorizedScope?.evidenceInputs?.[item.kind] ?? [])].sort();
    const actualInputs = Object.keys(item.inputHashes).sort();
    if (JSON.stringify(requiredInputs) !== JSON.stringify(actualInputs)) issues.push(`evidence ${item.id} does not exactly cover authorized evidence inputs`);
    if (current) {
      for (const [input, expectedHash] of Object.entries(item.inputHashes)) {
        try { if (hashArtifact(resolveRepoPath(repo, input, `evidence input ${input}`), context) !== expectedHash) issues.push(`evidence ${item.id} input is stale: ${input}`); }
        catch { issues.push(`evidence ${item.id} input is missing: ${input}`); }
      }
    }
  }
  if (!string(item.receiptPath) || !SHA256.test(item.receiptHash ?? '')) {
    issues.push(`evidence ${item.id} requires receiptPath and receiptHash`);
  } else {
    try { if (hashArtifact(resolveRepoPath(repo, item.receiptPath, `evidence receipt ${item.id}`), context) !== item.receiptHash) issues.push(`evidence ${item.id} receipt hash is stale`); }
    catch { issues.push(`evidence ${item.id} receipt is missing`); }
  }
  if (!isIsoDateTime(item.completedAt)) issues.push(`evidence ${item.id} has invalid completedAt`);
  const expectedStatus = { 'acceptance-red': 'confirmed', 'implementation-green': 'confirmed', 'stop-gate': 'pass' }[item.kind];
  if (!expectedStatus || item.status !== expectedStatus) issues.push(`evidence ${item.id} has invalid kind/status`);
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function changedPaths(repo, baseSha, headSha, pathspecs = []) {
  return gitNullPaths(repo, ['diff', '--no-renames', '--name-only', '-z', '--diff-filter=ACDMRTUXB', baseSha, headSha, '--', ...pathspecs]);
}

function validateScopeAttestation(checkpoint, repo, issues) {
  const attestation = checkpoint.scopeAttestation;
  const allowedKeys = new Set(['baseSha', 'headSha', 'scopeHash', 'changedPaths', 'createdAt']);
  if (!attestation || typeof attestation !== 'object' || Array.isArray(attestation) || Object.keys(attestation).some((key) => !allowedKeys.has(key))) {
    issues.push('review state requires a strict scopeAttestation');
    return;
  }
  if (attestation.baseSha !== checkpoint.baseSha || attestation.headSha !== checkpoint.headSha || attestation.scopeHash !== checkpoint.scopeHash || !Array.isArray(attestation.changedPaths) || !isIsoDateTime(attestation.createdAt)) {
    issues.push('scopeAttestation does not bind checkpoint base, head, scope, paths, and time');
    return;
  }
  try {
    git(repo, ['merge-base', '--is-ancestor', checkpoint.baseSha, checkpoint.headSha]);
    const changed = changedPaths(repo, checkpoint.baseSha, checkpoint.headSha).sort();
    const allowed = new Set(changedPaths(repo, checkpoint.baseSha, checkpoint.headSha, checkpoint.authorizedScope.allowedPaths));
    const protectedChanged = changedPaths(repo, checkpoint.baseSha, checkpoint.headSha, checkpoint.authorizedScope.protectedPaths).filter((entry) => !allowed.has(entry));
    const forbiddenChanged = changedPaths(repo, checkpoint.baseSha, checkpoint.headSha, checkpoint.authorizedScope.forbiddenWork);
    if (!same(changed, [...attestation.changedPaths].sort()) || changed.some((entry) => !allowed.has(entry)) || protectedChanged.length || forbiddenChanged.length) issues.push('scopeAttestation does not prove the committed Git diff is authorized');
  } catch { issues.push('scopeAttestation requires an ancestral, verifiable Git diff'); }
}

function validateParentSemantics(parent, child, issues) {
  if (parent.checkpointGeneration + 1 === child.checkpointGeneration) {
    for (const key of ['featureId', 'specHash', 'successorPolicyHash', 'authorityPolicyHash', 'successorPolicy', 'designFreezeReceipt', 'sourcePhaseReceipt']) {
      if (!same(parent[key], child[key])) issues.push(`next phase changed frozen field: ${key}`);
    }
    for (const key of ['specPath', 'successorPolicyPath', 'authorityPolicyPath']) {
      if (!same(parent.artifacts?.[key], child.artifacts?.[key])) issues.push(`next phase changed frozen artifact: ${key}`);
    }
    if (child.state !== 'PHASE_PLANNED' || child.checkpointRevision !== 1 || child.completedPhase !== parent.currentPhase || child.stopGateEvidence.length || child.scopeDeltas.length || child.scopeAttestation || child.reviewer || child.pullRequest || child.merge || child.release || child.lastSuccessorSignal || child.stateHistory.length !== 1 || child.stateHistory[0]?.state !== 'PHASE_PLANNED') issues.push('next phase checkpoint is not a clean PHASE_PLANNED generation');
    return;
  }
  const scopeDelta = child.state === 'PHASE_PLANNED' && SCOPE_DELTA_FROM.has(parent.state) && child.stateHistory.at(-1)?.reason === 'approved scope delta requires gate replay';
  const gateReplay = child.state === 'PHASE_PLANNED' && ['GREEN_CONFIRMED', 'STOP_GATE_GREEN', 'REVIEWED', 'PR_GREEN'].includes(parent.state) && child.stateHistory.at(-1)?.reason === GATE_REPLAY_REASON;
  if (STATES.indexOf(parent.state) >= 1) {
    for (const key of ['specHash', 'successorPolicyHash', 'authorityPolicyHash', 'successorPolicy', 'designFreezeReceipt', 'sourcePhaseReceipt']) {
      if (!same(parent[key], child[key])) issues.push(`checkpoint revision changed frozen field: ${key}`);
    }
    for (const key of ['specPath', 'successorPolicyPath', 'authorityPolicyPath']) {
      if (!same(parent.artifacts?.[key], child.artifacts?.[key])) issues.push(`checkpoint revision changed frozen artifact: ${key}`);
    }
  }
  const allowed = new Set(['checkpointRevision', 'previousCheckpointPath', 'previousCheckpointHash', 'updatedAt', 'stateHistory', 'state', 'nextActionCode', 'nextExactAction', 'currentStep']);
  if (['RED_CONFIRMED', 'GREEN_CONFIRMED', 'STOP_GATE_GREEN'].includes(child.state)) for (const key of ['headSha', 'stopGateEvidence']) allowed.add(key);
  if (child.state === 'REVIEWED') for (const key of ['scopeAttestation', 'reviewer']) allowed.add(key);
  if (child.state === 'PR_GREEN') allowed.add('pullRequest');
  if (child.state === 'MERGED') allowed.add('merge');
  if (['NEXT_PHASE', 'RELEASED'].includes(child.state)) for (const key of ['completedPhase', 'lastSuccessorSignal', 'release']) allowed.add(key);
  if (parent.state === 'DISCOVERED' && child.state === 'SPEC_FROZEN') for (const key of ['specHash', 'successorPolicyHash', 'authorityPolicyHash', 'successorPolicy', 'designFreezeReceipt', 'artifacts']) allowed.add(key);
  if (parent.state === 'SPEC_FROZEN' && child.state === 'PHASE_PLANNED') for (const key of ['phasePlanHash', 'scopeHash', 'authorizedScope', 'artifacts']) allowed.add(key);
  if (scopeDelta) for (const key of ['phasePlanHash', 'scopeHash', 'authorizedScope', 'scopeDeltas', 'artifacts', 'headSha', 'branch', 'stopGateEvidence', 'scopeAttestation', 'reviewer', 'pullRequest', 'merge', 'release']) allowed.add(key);
  if (gateReplay) for (const key of ['headSha', 'branch', 'stopGateEvidence', 'scopeAttestation', 'reviewer', 'pullRequest', 'merge', 'release']) allowed.add(key);
  for (const key of Object.keys(child)) {
    if (!allowed.has(key) && !same(parent[key], child[key])) issues.push(`checkpoint revision changed immutable field: ${key}`);
  }
  if (!parent.stateHistory.every((entry, index) => same(entry, child.stateHistory[index]))) issues.push('stateHistory is not append-only');
  if (scopeDelta) {
    try { assertMonotonicScopeDelta(parent.authorizedScope, child.authorizedScope); }
    catch (error) { issues.push(error.message); }
  }
  if (child.stateHistory.length !== parent.stateHistory.length + 1) issues.push('checkpoint revision must append exactly one stateHistory entry');
  if (parent.state === 'GREEN_CONFIRMED' && child.state === 'STOP_GATE_GREEN' && child.headSha !== parent.headSha) issues.push('GREEN_CONFIRMED with a changed HEAD requires gate replay before STOP_GATE_GREEN');
  if (!scopeDelta && !parent.scopeDeltas.every((entry, index) => same(entry, child.scopeDeltas[index]))) issues.push('scopeDeltas is not append-only');
  if (!scopeDelta && !gateReplay && !parent.stopGateEvidence.every((entry, index) => same(entry, child.stopGateEvidence[index]))) issues.push('stopGateEvidence is not append-only');
  const expectedEvidence = { RED_CONFIRMED: ['acceptance-red', 'confirmed'], GREEN_CONFIRMED: ['implementation-green', 'confirmed'], STOP_GATE_GREEN: ['stop-gate', 'pass'] }[child.state];
  if (expectedEvidence) {
    const added = child.stopGateEvidence.at(-1);
    if (child.stopGateEvidence.length !== parent.stopGateEvidence.length + 1 || added?.kind !== expectedEvidence[0] || added?.status !== expectedEvidence[1]) issues.push(`${child.state} must append exactly one matching evidence entry`);
  }
}

function readCheckpoint(checkpointPath) {
  const size = statSync(checkpointPath).size;
  if (size > MAX_JSON_BYTES) throw new Error(`checkpoint exceeds ${MAX_JSON_BYTES} bytes`);
  return readJson(checkpointPath);
}

function validateCheckpointFile(checkpointPath, repo, historical, enforceSourceBaseline, enforceMergeRef, context) {
  const checkpoint = readJson(checkpointPath);
  const issues = validateJsonSchema(checkpoint, EXECUTION_CHECKPOINT_SCHEMA).map((issue) => `schema: ${issue}`);
  let authorityPolicy = null;
  let lineageParentPath = null;
  let sourcePhaseReceipt = null;
  const stage = STATES.indexOf(checkpoint.state);
  if (context.lineageIndex === 0 && stage >= STATES.indexOf('MERGED')) context.sealedLineageArtifacts = true;
  const stableArtifacts = context.stableHistoricalArtifacts || context.sealedLineageArtifacts || stage >= STATES.indexOf('MERGED');
  for (const key of REQUIRED) if (!Object.hasOwn(checkpoint, key)) issues.push(`missing field: ${key}`);
  for (const key of Object.keys(checkpoint)) if (!ALLOWED.has(key)) issues.push(`unknown field: ${key}`);
  if (!hasOnlyKeys(checkpoint.artifacts, ['specPath', 'phasePlanPath', 'scopePath', 'successorPolicyPath', 'authorityPolicyPath']) || Object.values(checkpoint.artifacts ?? {}).some((value) => value !== null && !string(value))) issues.push('artifacts must be a strict path object');
  if (checkpoint.schemaVersion !== SCHEMA_VERSION) issues.push('unsupported schemaVersion');
  if (!Number.isInteger(checkpoint.checkpointGeneration) || checkpoint.checkpointGeneration < 1) issues.push('invalid checkpointGeneration');
  if (!Number.isInteger(checkpoint.checkpointRevision) || checkpoint.checkpointRevision < 1) issues.push('invalid checkpointRevision');
  for (const key of ['featureId', 'currentPhase', 'branch', 'currentStep', 'nextExactAction']) {
    if (!string(checkpoint[key])) issues.push(`invalid ${key}`);
  }
  if (!STATES.includes(checkpoint.state)) issues.push('invalid state');
  if (checkpoint.sourcePhaseReceipt !== undefined && checkpoint.sourcePhaseReceipt !== null) {
    const source = checkpoint.sourcePhaseReceipt;
    if (!hasOnlyKeys(source, ['receiptPath', 'receiptHash', 'confirmedContinuation', 'phaseId', 'branch', 'headSha', 'treeHash', 'planHash', 'scopeHash', 'riskPolicyHash', 'linkedAt']) || source.confirmedContinuation !== 'merge' || !string(source.phaseId) || !SHA256.test(source.receiptHash ?? '') || !SHA256.test(source.treeHash ?? '') || !isIsoDateTime(source.linkedAt)) issues.push('sourcePhaseReceipt has invalid bridge metadata');
    try {
      const sourcePath = resolveRepoPath(repo, source.receiptPath, 'source phase receipt');
      validateSourcePhaseLineage(repo, sourcePath, context);
      const sourceReceipt = readArtifactJson(sourcePath, context);
      sourcePhaseReceipt = sourceReceipt;
      for (const extension of sourceReceipt.scopeExtensions ?? []) resolveRepoPath(repo, extension.path, 'source phase scope extension', { allowMissing: true });
      const initialBridge = checkpoint.checkpointGeneration === 1 && checkpoint.checkpointRevision === 1 && checkpoint.previousCheckpointPath === null;
      const sourceBindingInvalid = validateJsonSchema(sourceReceipt, PHASE_RECEIPT_SCHEMA).length
        || hashArtifact(sourcePath, context) !== source.receiptHash
        || sourceReceipt.schemaVersion !== 'GovernedFeatureDeliveryPhaseReceipt/v2'
        || sourceReceipt.state !== 'STRICT_REQUIRED'
        || sourceReceipt.featureId !== checkpoint.featureId
        || sourceReceipt.phaseId !== source.phaseId
        || sourceReceipt.strictBoundary?.branch !== source.branch
        || sourceReceipt.strictBoundary?.headSha !== source.headSha
        || sourceReceipt.strictBoundary?.treeHash !== source.treeHash
        || (sourceReceipt.planHash !== null && sourceReceipt.planHash !== source.planHash)
        || (sourceReceipt.scopeHash !== null && sourceReceipt.scopeHash !== source.scopeHash)
        || sourceReceipt.riskPolicyHash !== source.riskPolicyHash;
      const initialCheckpointInvalid = initialBridge && (checkpoint.currentPhase !== source.phaseId || checkpoint.baseSha !== source.headSha || checkpoint.branch !== source.branch || checkpoint.phasePlanHash !== source.planHash || checkpoint.scopeHash !== source.scopeHash);
      if (sourceBindingInvalid || initialCheckpointInvalid) issues.push('sourcePhaseReceipt bridge binding is invalid');
      if (sourceReceipt.artifacts?.riskPolicyPath) {
        const actualRiskPolicyHash = stableArtifacts
          ? hashGitArtifact(repo, sourceReceipt.headSha, sourceReceipt.artifacts.riskPolicyPath, 'source risk policy', context)
          : hashArtifact(resolveRepoPath(repo, sourceReceipt.artifacts.riskPolicyPath, 'source risk policy'), context);
        if (actualRiskPolicyHash !== sourceReceipt.riskPolicyHash) issues.push('sourcePhaseReceipt risk policy binding is invalid');
      }
      if (enforceSourceBaseline && stage <= STATES.indexOf('PR_GREEN')) {
        if (!sourceReceipt.baseline?.ignoredGoverned) {
          issues.push('sourcePhaseReceipt lacks an ignored governed baseline; establish a new strict baseline');
        } else {
          const declared = [];
          if (sourceReceipt.artifacts?.scopePath) {
            const sourceScopePath = resolveRepoPath(repo, sourceReceipt.artifacts.scopePath, 'source phase scope');
            const sourceScope = normalizeScope(readArtifactJson(sourceScopePath, context));
            declared.push(...sourceScope.protectedPaths, ...sourceScope.forbiddenWork);
          }
          if (sourceReceipt.artifacts?.riskPolicyPath) {
            const policy = readArtifactJson(resolveRepoPath(repo, sourceReceipt.artifacts.riskPolicyPath, 'source risk policy'), context);
            if (Array.isArray(policy.strictPaths)) declared.push(...policy.strictPaths);
          }
          const liveIgnored = governedIgnoredFingerprint(repo, declared);
          const changedIgnored = changedIgnoredGovernedPaths(sourceReceipt.baseline.ignoredGoverned, liveIgnored);
          if (changedIgnored.length) issues.push(`sourcePhaseReceipt ignored governed risk changed since baseline: ${changedIgnored.join(', ')}`);
        }
      }
    } catch (error) { issues.push(`sourcePhaseReceipt artifact binding is invalid: ${error.message}`); }
  }
  if (!GIT_SHA.test(checkpoint.baseSha ?? '')) issues.push('invalid baseSha');
  if (!GIT_SHA.test(checkpoint.headSha ?? '')) issues.push('invalid headSha');
  if (!historical && stage >= 0 && stage <= 7) {
    try {
      if (git(repo, ['rev-parse', 'HEAD']).toLowerCase() !== checkpoint.headSha) issues.push('checkpoint head is not the current Git HEAD');
      if ((git(repo, ['branch', '--show-current']) || 'DETACHED') !== checkpoint.branch) issues.push('checkpoint branch is not the current Git branch');
      if (stage >= 6 && listWorktreePaths(repo).length) issues.push('review and PR states require a clean worktree outside managed artifacts');
    } catch { issues.push('current Git worktree identity cannot be verified'); }
  }
  if (!historical && checkpoint.state === 'NEXT_PHASE') {
    try {
      if (git(repo, ['rev-parse', 'HEAD']).toLowerCase() !== checkpoint.merge?.sha) issues.push('next phase HEAD is not the recorded successor base');
      const branch = git(repo, ['branch', '--show-current']) || 'DETACHED';
      if (branch === 'DETACHED') issues.push('next phase requires a named branch');
      if (branch === checkpoint.branch) issues.push('next phase must use a different branch from the completed phase');
    } catch { issues.push('next phase Git worktree identity cannot be verified'); }
  }
  for (const key of ['allowedPaths', 'protectedPaths', 'forbiddenWork']) {
    const values = checkpoint.authorizedScope?.[key];
    if (!Array.isArray(values) || values.some((entry) => !string(entry))) issues.push(`invalid authorizedScope.${key}`);
  }
  for (const kind of ['acceptance-red', 'implementation-green', 'stop-gate']) {
    const values = checkpoint.authorizedScope?.evidenceInputs?.[kind];
    if (!Array.isArray(values) || values.some((entry) => !string(entry))) issues.push(`invalid authorizedScope.evidenceInputs.${kind}`);
  }
  if (stage >= 3 && sourcePhaseReceipt?.scopeExtensions?.some((extension) => !(checkpoint.authorizedScope?.allowedPaths ?? []).some((allowed) => sameRepositoryPath(repo, extension.path, allowed)))) {
    issues.push('source phase scope extensions require an approved strict scope delta before RED');
  }
  if (!Array.isArray(checkpoint.stopGateEvidence)) issues.push('stopGateEvidence must be an array');
  else {
    if (checkpoint.stopGateEvidence.length > MAX_EVIDENCE_ENTRIES) issues.push(`stopGateEvidence exceeds maximum entry count ${MAX_EVIDENCE_ENTRIES}`);
    const currentKind = stage === 3 ? 'acceptance-red' : stage === 4 ? 'implementation-green' : stage >= 5 && stage <= 7 ? 'stop-gate' : null;
    checkpoint.stopGateEvidence.forEach((item) => validateEvidence(item, checkpoint, repo, !historical && item.kind === currentKind && item.headSha === checkpoint.headSha, issues, context));
    const ids = checkpoint.stopGateEvidence.map((item) => item.id);
    if (new Set(ids).size !== ids.length) issues.push('evidence ids must be unique');
  }
  if (!Array.isArray(checkpoint.scopeDeltas)) issues.push('scopeDeltas must be an array');
  else {
    if (checkpoint.scopeDeltas.length > MAX_SCOPE_DELTAS) issues.push(`scopeDeltas exceeds maximum entry count ${MAX_SCOPE_DELTAS}`);
    const deltaIds = new Set();
    for (const delta of checkpoint.scopeDeltas) {
      if (!delta || typeof delta !== 'object' || Array.isArray(delta)) issues.push('scopeDeltas entries must be objects');
      else {
        if (!string(delta.id) || !string(delta.authority) || !['approved', 'rejected'].includes(delta.decision) || !isIsoDateTime(delta.decidedAt)) issues.push('scope delta has invalid identity, decision, authority, or date');
        for (const key of ['beforeScopeHash', 'afterScopeHash', 'phasePlanHash']) if (!SHA256.test(delta[key] ?? '')) issues.push(`scope delta has invalid ${key}`);
        const allowedDeltaKeys = new Set(['id', 'decision', 'beforeScopeHash', 'afterScopeHash', 'phasePlanHash', 'authority', 'decidedAt']);
        if (Object.keys(delta).some((key) => !allowedDeltaKeys.has(key))) issues.push(`scope delta ${delta.id ?? '<unknown>'} has unknown fields`);
        if (deltaIds.has(delta.id)) issues.push('scope delta ids must be unique');
        deltaIds.add(delta.id);
      }
    }
  }
  if (
    !checkpoint.successorPolicy ||
    typeof checkpoint.successorPolicy.allowedCodes !== 'object' ||
    checkpoint.successorPolicy.allowedCodes === null ||
    Array.isArray(checkpoint.successorPolicy.allowedCodes) ||
    Object.keys(checkpoint.successorPolicy.allowedCodes).length === 0
  ) {
    if (stage >= 1 || Object.keys(checkpoint.successorPolicy?.allowedCodes ?? {}).length > 0) issues.push('invalid successorPolicy.allowedCodes');
  }
  try {
    if (checkpoint.successorPolicyHash !== policyHash(checkpoint.successorPolicy)) issues.push('successorPolicyHash does not match successorPolicy');
  } catch { issues.push('invalid successorPolicyHash'); }
  try {
    if (checkpoint.scopeHash !== scopeHash(checkpoint.authorizedScope)) issues.push('scopeHash does not match authorizedScope');
  } catch { issues.push('invalid scopeHash'); }
  if (checkpoint.authorityPolicyHash !== null || stage >= 1 || checkpoint.recoveryReceipt) {
    try {
      authorityPolicy = validateAuthorityPolicy(readCheckpointArtifactJson(repo, checkpoint, checkpoint.artifacts?.authorityPolicyPath, 'authority policy', context, stableArtifacts));
      if (objectHash(authorityPolicy) !== checkpoint.authorityPolicyHash) issues.push('authority policy artifact hash does not match');
    } catch { issues.push('authority policy artifact is missing or invalid'); }
  }
  if (authorityPolicy && checkpoint.scopeDeltas.some((delta) => !authorityAllowed(authorityPolicy, 'scopeDelta', delta.authority))) issues.push('scope delta authority is not allowed');
  if (stage >= 1 && Object.keys(checkpoint.successorPolicy?.allowedCodes ?? {}).length === 0) issues.push('frozen design requires successor allowlist');
  if (checkpoint.nextActionCode !== NEXT_ACTIONS[checkpoint.state]) issues.push('nextActionCode is not valid for current state');
  const canonicalAction = NEXT_ACTION_TEXT[checkpoint.nextActionCode];
  if (checkpoint.currentStep !== canonicalAction || checkpoint.nextExactAction !== canonicalAction) issues.push('action text does not match the canonical state action');
  if (stage >= 1) {
    const freeze = checkpoint.designFreezeReceipt;
    if (!hasOnlyKeys(freeze, ['authority', 'frozenAt', 'specHash', 'successorPolicyHash', 'receiptPath', 'receiptHash']) || freeze.specHash !== checkpoint.specHash || freeze.successorPolicyHash !== checkpoint.successorPolicyHash || !authorityPolicy || !authorityAllowed(authorityPolicy, 'designFreeze', freeze.authority) || !isIsoDateTime(freeze.frozenAt) || !string(freeze.receiptPath) || !SHA256.test(freeze.receiptHash ?? '')) issues.push('state requires an authorized designFreezeReceipt');
    else {
      try {
        const receiptPath = resolveRepoPath(repo, freeze.receiptPath, 'design freeze receipt');
        if (!existsSync(receiptPath) || hashArtifact(receiptPath, context) !== freeze.receiptHash) issues.push('design freeze receipt binding is invalid');
      } catch { issues.push('design freeze receipt is unreadable'); }
    }
  }
  if (checkpoint.recoveryReceipt) {
    const recovery = checkpoint.recoveryReceipt;
    if (!hasOnlyKeys(recovery, ['authority', 'decidedAt', 'sourceHashes', 'fieldSources', 'decision', 'receiptPath', 'receiptHash']) || !authorityPolicy || !authorityAllowed(authorityPolicy, 'recovery', recovery.authority) || !isIsoDateTime(recovery.decidedAt) || recovery.decision !== 'reconstructed' || !recovery.sourceHashes || Object.keys(recovery.sourceHashes).length === 0 || Object.values(recovery.sourceHashes).some((hash) => !SHA256.test(hash)) || !recovery.fieldSources || Object.keys(recovery.fieldSources).length === 0 || !string(recovery.receiptPath) || !SHA256.test(recovery.receiptHash ?? '')) issues.push('invalid or unauthorized recoveryReceipt');
    else {
      try { if (hashArtifact(resolveRepoPath(repo, recovery.receiptPath, 'recovery receipt'), context) !== recovery.receiptHash) issues.push('recovery receipt binding is invalid'); }
      catch { issues.push('recovery receipt is missing'); }
      const requiredFields = ['featureId', 'currentPhase', 'headSha', 'branch'];
      if (JSON.stringify(Object.keys(recovery.fieldSources).sort()) !== JSON.stringify([...requiredFields].sort())) issues.push('recovery fieldSources do not cover required fields exactly');
      for (const [source, expectedHash] of Object.entries(recovery.sourceHashes)) {
        try { if (hashArtifact(resolveRepoPath(repo, source, `recovery source ${source}`), context) !== expectedHash) issues.push(`recovery source hash mismatch: ${source}`); }
        catch { issues.push(`recovery source is missing: ${source}`); }
      }
      // The recovery source establishes the identity of the recovery origin.
      // Later immutable revisions may legitimately advance headSha while their
      // parent hash, receipt hash, and lineage provide the continuity proof.
      const isRecoveryOrigin = checkpoint.checkpointGeneration === 1 && checkpoint.checkpointRevision === 1;
      if (isRecoveryOrigin) {
        for (const field of requiredFields) {
          const source = recovery.fieldSources[field];
          if (!Object.hasOwn(recovery.sourceHashes, source)) issues.push(`recovery field source is not hash-bound: ${field}`);
          else {
            try { if (readArtifactJson(resolveRepoPath(repo, source, `recovery field source ${field}`), context)[field] !== checkpoint[field]) issues.push(`recovery source does not prove field: ${field}`); }
            catch { issues.push(`recovery field source is unreadable: ${field}`); }
          }
        }
      }
    }
  }
  if (stage >= 1) {
    try { if (hashCheckpointArtifact(repo, checkpoint, checkpoint.artifacts?.specPath, 'spec artifact', context, stableArtifacts) !== checkpoint.specHash) issues.push('spec artifact hash does not match'); }
    catch { issues.push('spec artifact is missing'); }
    try { if (policyHash(readCheckpointArtifactJson(repo, checkpoint, checkpoint.artifacts?.successorPolicyPath, 'successor policy artifact', context, stableArtifacts)) !== checkpoint.successorPolicyHash) issues.push('successor policy artifact hash does not match'); }
    catch { issues.push('successor policy artifact is missing or invalid'); }
  }
  if (stage >= 2) {
    try { if (hashCheckpointArtifact(repo, checkpoint, checkpoint.artifacts?.phasePlanPath, 'phase plan artifact', context, stableArtifacts) !== checkpoint.phasePlanHash) issues.push('phase plan artifact hash does not match'); }
    catch { issues.push('phase plan artifact is missing'); }
    try { if (scopeHash(readCheckpointArtifactJson(repo, checkpoint, checkpoint.artifacts?.scopePath, 'scope artifact', context, stableArtifacts)) !== checkpoint.scopeHash) issues.push('scope artifact hash does not match'); }
    catch { issues.push('scope artifact is missing or invalid'); }
  }
  if (!Array.isArray(checkpoint.stateHistory) || checkpoint.stateHistory.length === 0) issues.push('stateHistory must not be empty');
  else {
    const history = checkpoint.stateHistory;
    if (history.length > MAX_STATE_HISTORY) issues.push(`stateHistory exceeds maximum entry count ${MAX_STATE_HISTORY}`);
    for (const entry of history) {
      if (!hasOnlyKeys(entry, ['state', 'at', 'reason']) || !STATES.includes(entry?.state) || !isIsoDateTime(entry?.at) || !string(entry?.reason)) issues.push('stateHistory contains an invalid entry');
    }
    if (history.at(-1)?.state !== checkpoint.state) issues.push('stateHistory does not end at current state');
    if (checkpoint.checkpointGeneration === 1 && history[0]?.state !== 'DISCOVERED') issues.push('first generation must begin at DISCOVERED');
    if (checkpoint.checkpointGeneration > 1 && history[0]?.state !== 'PHASE_PLANNED') issues.push('later generation must begin at PHASE_PLANNED');
    const requiresParent = checkpoint.checkpointGeneration > 1 || checkpoint.checkpointRevision > 1;
    if (!requiresParent && (checkpoint.previousCheckpointPath !== null || checkpoint.previousCheckpointHash !== null)) issues.push('initial checkpoint must not carry parent metadata');
    if (requiresParent && !SHA256.test(checkpoint.previousCheckpointHash ?? '')) issues.push('checkpoint lineage requires previousCheckpointHash');
    if (requiresParent && !string(checkpoint.previousCheckpointPath)) issues.push('checkpoint lineage requires previousCheckpointPath');
    if (requiresParent && string(checkpoint.previousCheckpointPath)) {
      const parentCandidate = path.resolve(path.dirname(checkpointPath), checkpoint.previousCheckpointPath);
      try { lineageParentPath = resolveRepoPath(repo, path.relative(repo, parentCandidate), 'previous checkpoint'); }
      catch { issues.push('previous checkpoint escapes repository'); }
      if (lineageParentPath && !existsSync(lineageParentPath)) issues.push('previous checkpoint is missing');
      else if (lineageParentPath) {
        try {
          const parent = readCheckpoint(lineageParentPath);
          if (hashArtifact(lineageParentPath, context) !== checkpoint.previousCheckpointHash) issues.push('previousCheckpointHash does not match parent checkpoint');
          if (parent.featureId !== checkpoint.featureId) issues.push('parent belongs to a different feature');
          if (parent.checkpointGeneration === checkpoint.checkpointGeneration) {
            if (parent.checkpointRevision + 1 !== checkpoint.checkpointRevision || parent.currentPhase !== checkpoint.currentPhase) issues.push('checkpoint revision lineage is invalid');
            const scopeDelta = checkpoint.state === 'PHASE_PLANNED' && SCOPE_DELTA_FROM.has(parent.state) && checkpoint.stateHistory.at(-1)?.reason === 'approved scope delta requires gate replay';
            const gateReplay = checkpoint.state === 'PHASE_PLANNED' && ['GREEN_CONFIRMED', 'STOP_GATE_GREEN', 'REVIEWED', 'PR_GREEN'].includes(parent.state) && checkpoint.stateHistory.at(-1)?.reason === GATE_REPLAY_REASON;
            if (scopeDelta) {
              const delta = checkpoint.scopeDeltas.at(-1);
              if (checkpoint.scopeDeltas.length !== parent.scopeDeltas.length + 1 || delta?.decision !== 'approved' || delta.beforeScopeHash !== parent.scopeHash || delta.afterScopeHash !== checkpoint.scopeHash || delta.phasePlanHash !== checkpoint.phasePlanHash) issues.push('scope delta revision is not correctly bound');
            } else if (!gateReplay && !(NEXT[parent.state] ?? []).includes(checkpoint.state)) issues.push('checkpoint state does not follow parent state');
            if (parent.state === 'GREEN_CONFIRMED' && checkpoint.state === 'STOP_GATE_GREEN' && checkpoint.headSha !== parent.headSha) issues.push('GREEN_CONFIRMED with a changed HEAD requires gate replay before STOP_GATE_GREEN');
          } else if (parent.checkpointGeneration + 1 === checkpoint.checkpointGeneration) {
            if (checkpoint.checkpointRevision !== 1 || parent.state !== 'NEXT_PHASE' || parent.lastSuccessorSignal?.target !== checkpoint.currentPhase) issues.push('next phase lineage is invalid');
          } else issues.push('checkpoint generation is not contiguous');
          validateParentSemantics(parent, checkpoint, issues);
        } catch { issues.push('previous checkpoint is not valid JSON'); }
      }
    }
    for (let index = 1; index < history.length; index += 1) {
      const scopeReset = history[index].state === 'PHASE_PLANNED' && SCOPE_DELTA_FROM.has(history[index - 1].state) && history[index].reason === 'approved scope delta requires gate replay';
      const gateReplay = history[index].state === 'PHASE_PLANNED' && history[index].reason === GATE_REPLAY_REASON && ['GREEN_CONFIRMED', 'STOP_GATE_GREEN', 'REVIEWED', 'PR_GREEN'].includes(history[index - 1].state);
      if (!scopeReset && !gateReplay && !(NEXT[history[index - 1].state] ?? []).includes(history[index].state)) issues.push(`invalid transition: ${history[index - 1].state} -> ${history[index].state}`);
    }
  }
  if (stage >= 1 && !SHA256.test(checkpoint.specHash ?? '')) issues.push('state requires specHash');
  if (stage >= 2 && !SHA256.test(checkpoint.phasePlanHash ?? '')) issues.push('state requires phasePlanHash');
  if (stage >= 2 && checkpoint.authorizedScope?.allowedPaths?.length === 0) issues.push('planned phase requires allowedPaths');
  if (stage >= 2) {
    for (const kind of ['acceptance-red', 'implementation-green', 'stop-gate']) {
      if (checkpoint.authorizedScope?.evidenceInputs?.[kind]?.length === 0) issues.push(`planned phase requires evidenceInputs.${kind}`);
    }
  }
  if (stage === 3 && !evidenceMatches(checkpoint, 'acceptance-red', 'confirmed')) issues.push('RED_CONFIRMED requires current acceptance-red evidence');
  if (stage > 3 && !checkpoint.stopGateEvidence.some((item) => item.kind === 'acceptance-red' && item.status === 'confirmed')) issues.push('later states require acceptance-red evidence');
  if (stage === 4 && !evidenceMatches(checkpoint, 'implementation-green', 'confirmed')) issues.push('GREEN_CONFIRMED requires current implementation-green evidence');
  if (stage > 4 && !checkpoint.stopGateEvidence.some((item) => item.kind === 'implementation-green' && item.status === 'confirmed')) issues.push('later states require implementation-green evidence');
  if (stage >= 5 && !evidenceMatches(checkpoint, 'stop-gate', 'pass')) issues.push('STOP_GATE_GREEN requires current stop-gate evidence');
  if (stage >= 6) validateScopeAttestation(checkpoint, repo, issues);
  if (stage >= 6 && !(checkpoint.reviewer?.headSha === checkpoint.headSha && ['approved', 'no-findings'].includes(checkpoint.reviewer?.status) && string(checkpoint.reviewer?.authority))) issues.push('REVIEWED requires current authorized reviewer approval');
  if (stage >= 6 && !hasOnlyKeys(checkpoint.reviewer, ['headSha', 'status', 'authority'])) issues.push('reviewer contains unknown fields');
  if (stage >= 6 && (!authorityPolicy || !authorityAllowed(authorityPolicy, 'review', checkpoint.reviewer?.authority))) issues.push('reviewer is not allowed by authority policy');
  if (stage >= 7 && !(checkpoint.pullRequest?.headSha === checkpoint.headSha && checkpoint.pullRequest?.status === 'green' && string(checkpoint.pullRequest?.url))) issues.push('PR_GREEN requires current green PR evidence');
  if (stage >= 7 && !hasOnlyKeys(checkpoint.pullRequest, ['url', 'headSha', 'status'])) issues.push('pullRequest contains unknown fields');
  if (stage >= 8) {
    const legacyMerge = hasOnlyKeys(checkpoint.merge, ['commitSha', 'mergedAt']) && GIT_SHA.test(checkpoint.merge?.commitSha ?? '') && isIsoDateTime(checkpoint.merge?.mergedAt);
    const strongMerge = hasOnlyKeys(checkpoint.merge, ['sha', 'ref', 'containsReviewedSha', 'mergedAt']) && GIT_SHA.test(checkpoint.merge?.sha ?? '') && /^refs\/(heads|remotes)\//u.test(checkpoint.merge?.ref ?? '') && checkpoint.merge?.containsReviewedSha === checkpoint.headSha && isIsoDateTime(checkpoint.merge?.mergedAt);
    if (!strongMerge && (enforceMergeRef || !(historical && legacyMerge))) issues.push('MERGED requires a full integration ref and a distinct merge commit');
    if (strongMerge) {
      try {
        let integrationRefs = [];
        if (checkpoint.sourcePhaseReceipt?.receiptPath) {
          const sourceReceipt = readArtifactJson(resolveRepoPath(repo, checkpoint.sourcePhaseReceipt.receiptPath, 'source phase receipt'), context);
          integrationRefs = sourceReceipt.risk?.integrationRefs ?? [];
          if (!Array.isArray(sourceReceipt.risk?.integrationRefs) && sourceReceipt.artifacts?.riskPolicyPath) {
            const sourceRiskPolicy = readGitArtifactJson(repo, sourceReceipt.headSha, sourceReceipt.artifacts.riskPolicyPath, 'source risk policy', context);
            if (hashGitArtifact(repo, sourceReceipt.headSha, sourceReceipt.artifacts.riskPolicyPath, 'source risk policy', context) !== sourceReceipt.riskPolicyHash) throw new Error('source risk policy hash mismatch');
            integrationRefs = sourceRiskPolicy.integrationRefs ?? [];
          }
        }
        validateStrongMerge(repo, {
          phaseBranch: checkpoint.branch,
          reviewedSha: checkpoint.headSha,
          merge: checkpoint.merge,
          integrationRefs,
          requireLiveRef: !historical || enforceMergeRef,
        });
      } catch { issues.push('merge commit does not prove integration of the reviewed head'); }
    }
  }
  if (stage >= 9 && checkpoint.completedPhase !== checkpoint.currentPhase) issues.push('terminal phase state requires completedPhase=currentPhase');
  if (checkpoint.state === 'NEXT_PHASE' || checkpoint.state === 'RELEASED') {
    if (!checkpoint.lastSuccessorSignal) issues.push('terminal successor state requires an exact successor signal');
  }
  if (checkpoint.state === 'RELEASED' && !(string(checkpoint.release?.receiptPath) && SHA256.test(checkpoint.release?.receiptHash ?? '') && isIsoDateTime(checkpoint.release?.releasedAt) && authorityPolicy && authorityAllowed(authorityPolicy, 'release', checkpoint.release?.authority))) issues.push('RELEASED requires an authorized release receipt');
  if (checkpoint.state === 'RELEASED' && !hasOnlyKeys(checkpoint.release, ['receiptPath', 'receiptHash', 'releasedAt', 'authority'])) issues.push('release contains unknown fields');
  if (checkpoint.state === 'RELEASED' && checkpoint.release?.receiptPath) {
    try { if (hashArtifact(resolveRepoPath(repo, checkpoint.release.receiptPath, 'release receipt'), context) !== checkpoint.release.receiptHash) issues.push('release receipt binding is invalid'); }
    catch { issues.push('release receipt is missing'); }
  }
  if (checkpoint.lastSuccessorSignal) {
    const { code, target, authority, signedAt } = checkpoint.lastSuccessorSignal;
    if (!string(code) || !string(target) || !string(authority) || !isIsoDateTime(signedAt) || checkpoint.successorPolicy?.allowedCodes?.[code] !== target) issues.push('lastSuccessorSignal is not exactly allowlisted and authorized');
    if (!authorityPolicy || !authorityAllowed(authorityPolicy, 'successor', authority)) issues.push('successor signal authority is not allowed');
    if (!hasOnlyKeys(checkpoint.lastSuccessorSignal, ['code', 'target', 'authority', 'signedAt'])) issues.push('successor signal contains unknown fields');
    if (checkpoint.state === 'NEXT_PHASE' && target === 'RELEASED') issues.push('NEXT_PHASE successor target must name a phase');
    if (checkpoint.state === 'RELEASED' && target !== 'RELEASED') issues.push('RELEASED successor target must be RELEASED');
  }
  if (!isIsoDateTime(checkpoint.updatedAt)) issues.push('invalid updatedAt');
  return { checkpoint, issues, lineageParentPath };
}

function canonicalRealPath(filePath, caseSemantics) {
  const resolved = realpathSync.native(filePath);
  return repositoryPathKey(resolved, caseSemantics);
}

try {
  const options = parseArgs(process.argv.slice(2), new Set(), new Set(['checkpoint', 'repo', 'historical', 'enforce-source-baseline', 'enforce-merge-ref']));
  if (options.help) {
    process.stdout.write(`${HELP}\n`);
    process.exit(0);
  }
  const repo = path.resolve(options.repo ?? process.cwd());
  const checkpointPath = resolveRepoPath(repo, required(options, 'checkpoint'), '--checkpoint');
  if (options.historical !== undefined && !['true', 'false'].includes(options.historical)) throw new Error('--historical must be true or false');
  if (options['enforce-source-baseline'] !== undefined && !['true', 'false'].includes(options['enforce-source-baseline'])) throw new Error('--enforce-source-baseline must be true or false');
  if (options['enforce-merge-ref'] !== undefined && !['true', 'false'].includes(options['enforce-merge-ref'])) throw new Error('--enforce-merge-ref must be true or false');
  const historical = options.historical === 'true';
  const enforceSourceBaseline = options['enforce-source-baseline'] === 'true' || !historical;
  const enforceMergeRef = options['enforce-merge-ref'] === 'true';
  const visited = new Set();
  const context = {
    hashCache: new Map(), jsonCache: new Map(), gitBlobCache: new Map(), gitJsonCache: new Map(),
    artifactBytes: 0, artifactReads: 0, sourceLineages: new Set(), sourceLineageRecords: 0, sourceLineageBytes: 0,
    caseSemantics: repositoryCaseSemantics(repo), stableHistoricalArtifacts: historical && !enforceSourceBaseline,
    sealedLineageArtifacts: false, lineageIndex: 0,
  };
  const issues = [];
  let currentPath = checkpointPath;
  let lineageBytes = 0;
  let lineageRecords = 0;
  let rootState = null;

  while (currentPath) {
    if (lineageRecords + context.sourceLineageRecords >= MAX_LINEAGE_RECORDS) {
      issues.push(`combined checkpoint lineage exceeds maximum record count ${MAX_LINEAGE_RECORDS}`);
      break;
    }
    if (lineageRecords >= MAX_LINEAGE_RECORDS) {
      issues.push(`checkpoint lineage exceeds maximum record count ${MAX_LINEAGE_RECORDS}`);
      break;
    }
    let canonicalPath;
    let size;
    try {
      canonicalPath = canonicalRealPath(currentPath, context.caseSemantics);
      size = statSync(currentPath).size;
    } catch {
      issues.push(`${lineageRecords === 0 ? 'checkpoint' : 'ancestor checkpoint'} is missing or unreadable`);
      break;
    }
    if (visited.has(canonicalPath)) {
      issues.push('checkpoint lineage contains a real-path cycle');
      break;
    }
    visited.add(canonicalPath);
    if (size > MAX_JSON_BYTES) {
      issues.push(`checkpoint lineage record exceeds ${MAX_JSON_BYTES} bytes`);
      break;
    }
    lineageBytes += size;
    if (lineageBytes + context.sourceLineageBytes > MAX_LINEAGE_BYTES) {
      issues.push(`checkpoint lineage exceeds cumulative byte limit ${MAX_LINEAGE_BYTES}`);
      break;
    }

    try {
      context.lineageIndex = lineageRecords;
      const result = validateCheckpointFile(currentPath, repo, historical || lineageRecords > 0, enforceSourceBaseline && lineageRecords === 0, enforceMergeRef && lineageRecords === 0, context);
      if (lineageRecords === 0) rootState = result.checkpoint.state;
      const prefix = lineageRecords === 0 ? '' : `ancestor ${path.relative(repo, currentPath).replaceAll(path.sep, '/')}: `;
      issues.push(...result.issues.map((issue) => `${prefix}${issue}`));
      currentPath = result.lineageParentPath;
      lineageRecords += 1;
    } catch (error) {
      const prefix = lineageRecords === 0 ? 'checkpoint' : `ancestor ${path.relative(repo, currentPath).replaceAll(path.sep, '/')}`;
      issues.push(`${prefix} validation failed: ${error.message}`);
      break;
    }
  }

  if (lineageRecords + context.sourceLineageRecords > MAX_LINEAGE_RECORDS && !issues.some((issue) => issue.includes('maximum record count'))) {
    issues.push(`combined checkpoint lineage exceeds maximum record count ${MAX_LINEAGE_RECORDS}`);
  }
  if (lineageBytes + context.sourceLineageBytes > MAX_LINEAGE_BYTES && !issues.some((issue) => issue.includes('cumulative byte limit'))) {
    issues.push(`combined checkpoint lineage exceeds cumulative byte limit ${MAX_LINEAGE_BYTES}`);
  }

  const issueSummary = summarizeIssues(issues);
  emit({
    ok: issues.length === 0,
    checkpoint: checkpointPath,
    state: rootState,
    lineageRecords,
    lineageBytes,
    sourceLineageRecords: context.sourceLineageRecords,
    sourceLineageBytes: context.sourceLineageBytes,
    issueCount: issues.length,
    ...issueSummary,
  }, issues.length === 0 ? 0 : 2);
} catch (error) {
  fail(error, 'governed_feature_checkpoint_validation_failed');
}
