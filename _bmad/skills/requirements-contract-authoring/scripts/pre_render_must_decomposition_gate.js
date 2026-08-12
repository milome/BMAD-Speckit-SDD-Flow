#!/usr/bin/env node
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  asArray,
  extractImplementationConfirmation,
  implementationConfirmationHashFor,
  normalizePathForReport,
  sourceDocumentHashFor,
  stableStringify,
  stringList,
  unique,
} = require('./pre_render_definition_drilldown_lib');
const { collectProjectionQualityIssues } = require('./projection_quality_gate');
const {
  buildDerivedContractExecutionManifest,
} = require('../../../shared/contract-execution-manifest/build-contract-execution-manifest');

const SOURCE_ROW_GROUPS = [
  { sourceKey: 'implementationTasks', projectionKey: 'mustAtomicTasks' },
  { sourceKey: 'evidence', projectionKey: 'mustEvidenceProjection' },
  { sourceKey: 'traceRows', projectionKey: 'mustTraceProjection' },
  { sourceKey: 'acceptanceTests', projectionKey: 'mustAcceptanceProjection' },
  { sourceKey: 'e2eSuites', projectionKey: 'mustAcceptanceProjection' },
  { sourceKey: 'failurePaths', projectionKey: 'mustFailureEdgeProjection' },
  { sourceKey: 'edgeCases', projectionKey: 'mustFailureEdgeProjection' },
  { sourceKey: 'targetModificationPaths', projectionKey: 'mustTargetPathProjection' },
  { sourceKey: 'artifactAutomationPlan', projectionKey: 'mustArtifactProjection' },
  { sourceKey: 'requiredCommands', projectionKey: 'mustCommandProjection' },
];

const VALID_NO_NEW_GAP_VERDICTS = new Set(['no_new_valid_gap', 'no_new_confirmation_blocking_gap']);
const RESOLVED_GAP_STATUSES = new Set(['resolved', 'converted_to_out_boundary', 'converted_to_open_question', 'rejected']);
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const ATTEMPT_POINTER_KEYS = new Set([
  'schemaVersion',
  'authoringAttemptId',
  'attemptManifestPath',
  'attemptManifestHash',
  'latestValidPredecessorCheckpoint',
  'inputManifestHash',
]);
const PREPUBLICATION_REQUIRED_ROLES = new Map([
  ['cp04', ['semantic_ir', 'source_binding', 'resolved_evidence_index']],
  ['cp05', ['confirmation_projection', 'final_markdown']],
  ['cp06', ['execution_manifest', 'per_must_bundle', 'trace_matrix']],
  ['cp07', ['diagram_set']],
  [
    'cp08',
    [
      'projection_reconciliation_report',
      'authority_resolution_report',
      'renderability_probe_report',
      'judge_audit_packet',
      'judge_audit_packet_coverage',
    ],
  ],
]);
const PREPUBLICATION_FORBIDDEN_ROLES = new Set([
  'remediation_plan',
  'remediation_delta',
  'effective_pass_receipt',
  'promotion_receipt',
]);

function usage(exitCode = 0) {
  console.log(`Usage:
  node pre_render_must_decomposition_gate.js --source <source-document.md> [options]

Options:
  --semantic-kernel <semantic-kernel.json>
  --must-decomposition-packet <must_decomposition_packet.json>
  --authoring-dir <dir>
  --prepublication-attempt
  --record-root <requirement-record-root>
  --out <pre-render-must-decomposition-gate-report.json>
  --receipt <must_decomposition_receipt.json>
  --reconciliation-report <must_packet_source_reconciliation_report.json>
  --json
  --help`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = {
    source: '',
    semanticKernel: '',
    mustDecompositionPacket: '',
    authoringDir: '',
    out: '',
    receipt: '',
    reconciliationReport: '',
    prepublicationAttempt: false,
    recordRoot: '',
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') usage(0);
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    if (arg === '--prepublication-attempt') {
      args.prepublicationAttempt = true;
      continue;
    }
    if (
      arg === '--source' ||
      arg === '--semantic-kernel' ||
      arg === '--must-decomposition-packet' ||
      arg === '--authoring-dir' ||
      arg === '--record-root' ||
      arg === '--out' ||
      arg === '--receipt' ||
      arg === '--reconciliation-report'
    ) {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) return { error: `missing value for ${arg}` };
      args[arg.slice(2).replace(/-([a-z])/g, (_m, c) => c.toUpperCase())] = next;
      i += 1;
      continue;
    }
    if (arg.startsWith('--')) return { error: `unknown option ${arg}` };
    if (args.source) return { error: `unexpected positional argument ${arg}` };
    args.source = arg;
  }
  if (!args.source) return { error: 'missing source document path' };
  return args;
}

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(String(value), 'utf8').digest('hex')}`;
}

function hashObject(value) {
  return sha256(stableStringify(value));
}

function hashDomain(domain, value) {
  return sha256(`${domain}\n${stableStringify(value)}\n`);
}

function hashBytes(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  return isRecord(value) &&
    Object.keys(value).length === keys.size &&
    Object.keys(value).every((key) => keys.has(key));
}

function canonicalRecordRelativePath(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || path.posix.isAbsolute(value)) {
    return false;
  }
  const normalized = path.posix.normalize(value);
  return normalized === value && value !== '..' && !value.startsWith('../');
}

function confinedRecordPath(recordRoot, relativePath) {
  if (!canonicalRecordRelativePath(relativePath)) return null;
  const root = path.resolve(recordRoot);
  const absolute = path.resolve(root, ...relativePath.split('/'));
  const relative = path.relative(root, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  const components = relative.split(path.sep).filter(Boolean);
  let current = root;
  if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
    return { error: 'authoring_record_path_reparse_forbidden', path: absolute };
  }
  for (const component of components) {
    current = path.join(current, component);
    if (!fs.existsSync(current)) break;
    if (fs.lstatSync(current).isSymbolicLink()) {
      return { error: 'authoring_record_path_reparse_forbidden', path: absolute };
    }
  }
  if (fs.existsSync(absolute)) {
    const realRoot = fs.realpathSync(root);
    const realTarget = fs.realpathSync(absolute);
    const realRelative = path.relative(realRoot, realTarget);
    if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
      return { error: 'authoring_record_path_reparse_forbidden', path: absolute };
    }
  }
  return { error: null, path: absolute };
}

function pathReparseError(targetPath) {
  const absolute = path.resolve(targetPath);
  const parsed = path.parse(absolute);
  let current = parsed.root;
  if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
    return 'authoring_record_path_reparse_forbidden';
  }
  for (const component of path.relative(parsed.root, absolute).split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    if (!fs.existsSync(current)) break;
    if (fs.lstatSync(current).isSymbolicLink()) {
      return 'authoring_record_path_reparse_forbidden';
    }
  }
  if (fs.existsSync(absolute)) {
    const realTarget = fs.realpathSync(absolute);
    const realRelative = path.relative(path.resolve(parsed.root), realTarget);
    if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
      return 'authoring_record_path_reparse_forbidden';
    }
  }
  return null;
}

function prepublicationFailureReport({ sourcePath, recordRoot, pointerPath, blockingIssues }) {
  const report = {
    schemaVersion: 'requirements-contract-prepublication-render-gate-report/v1',
    verdict: 'FAIL',
    sourcePath: normalizePathForReport(sourcePath),
    recordRoot: normalizePathForReport(recordRoot),
    pointerPath: normalizePathForReport(pointerPath),
    manifestPaths: [],
    artifactRefs: [],
    semanticRevisionId: null,
    scopeSemanticHash: null,
    sourceHashBefore: null,
    sourceHashAfter: null,
    sourceHashPreserved: false,
    failedChecks: unique(blockingIssues.map((item) => item.code)),
    blockingIssues,
  };
  report.contentHash = hashObject({ ...report, contentHash: null });
  return { exitCode: 1, report };
}

function prepublicationIssue(code, refs = []) {
  return issue(code, code.replace(/_/gu, ' '), refs, 'blocker', 'prepublication_attempt_gate');
}

function validateAttemptPointer(pointer) {
  const codes = [];
  if (!hasExactKeys(pointer, ATTEMPT_POINTER_KEYS)) {
    return ['active_authoring_attempt_pointer_shape_invalid'];
  }
  if (pointer.schemaVersion !== 'ActiveAuthoringAttemptPointer/v1') {
    codes.push('active_authoring_attempt_pointer_schema_invalid');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(String(pointer.authoringAttemptId ?? ''))) {
    codes.push('active_authoring_attempt_id_invalid');
  }
  if (!canonicalRecordRelativePath(pointer.attemptManifestPath)) {
    codes.push('active_authoring_attempt_manifest_path_invalid');
  } else if (
    pointer.attemptManifestPath !==
      `authoring/staging/${pointer.authoringAttemptId}/manifests/8-cp08.json`
  ) {
    codes.push('active_authoring_attempt_cp08_path_identity_mismatch');
  }
  if (!SHA256_PATTERN.test(String(pointer.attemptManifestHash ?? ''))) {
    codes.push('active_authoring_attempt_manifest_hash_invalid');
  }
  if (!SHA256_PATTERN.test(String(pointer.inputManifestHash ?? ''))) {
    codes.push('active_authoring_attempt_input_manifest_hash_invalid');
  }
  if (pointer.latestValidPredecessorCheckpoint !== 'cp07') {
    codes.push('active_authoring_attempt_predecessor_mismatch');
  }
  return unique(codes);
}

const CHECKPOINT_MANIFEST_KEYS = new Set([
  'schemaVersion',
  'authoringRequestId',
  'authoringAttemptId',
  'checkpointId',
  'checkpointOrdinal',
  'stage',
  'status',
  'inputManifestHash',
  'previousCheckpointManifestRef',
  'latestValidPredecessorCheckpoint',
  'compilerIdentity',
  'artifactEntries',
  'decisionReceiptRefs',
  'baseAuthorityRef',
  'checkpointManifestHash',
]);
const CHECKPOINT_REF_KEYS = new Set(['checkpointId', 'checkpointOrdinal', 'path', 'hash']);
const ARTIFACT_ENTRY_KEYS = new Set([
  'role',
  'schemaVersion',
  'artifactId',
  'recordRelativePath',
  'artifactHash',
]);
const PREPUBLICATION_ALLOWED_ROLES = new Map([
  ['cp04', new Set(['semantic_ir', 'source_binding', 'resolved_evidence_index', 'lint_report'])],
  ['cp05', new Set(['confirmation_projection', 'final_markdown', 'lint_report'])],
  [
    'cp06',
    new Set([
      'execution_manifest',
      'per_must_bundle',
      'trace_matrix',
      'acceptance_contracts',
      'failure_matrix',
      'edge_matrix',
      'lint_report',
    ]),
  ],
  ['cp07', new Set(['diagram_set', 'confirmation_html', 'confirmation_summary', 'lint_report'])],
  [
    'cp08',
    new Set([
      'projection_reconciliation_report',
      'authority_resolution_report',
      'renderability_probe_report',
      'judge_audit_packet',
      'judge_audit_packet_coverage',
      'lint_report',
    ]),
  ],
]);
const LOGICAL_IDENTITY_ROLES = new Set([
  'confirmation_projection',
  'execution_manifest',
  'per_must_bundle',
  'trace_matrix',
  'acceptance_contracts',
  'failure_matrix',
  'edge_matrix',
  'diagram_set',
  'projection_reconciliation_report',
  'authority_resolution_report',
  'renderability_probe_report',
  'judge_audit_packet',
  'judge_audit_packet_coverage',
]);

function checkpointArtifactHashCandidates(stage, entry, bytes, parsed) {
  const candidates = new Set();
  if (stage === 'cp04' && parsed !== null) {
    const coreRole = {
      semantic_ir: 'semantic-ir',
      source_binding: 'source-binding',
      resolved_evidence_index: 'resolved-evidence-index',
    }[entry.role];
    if (coreRole) {
      candidates.add(
        hashObject({
          domain: 'requirements-contract-core-artifact/v1',
          checkpointId: 'cp-04-id-freeze',
          profileId: 'requirements-contract-cp04-freeze-publication/v1',
          artifactRole: coreRole,
          artifact: parsed,
        })
      );
    }
    return candidates;
  }
  candidates.add(hashBytes(bytes));
  if (parsed !== null) candidates.add(hashObject(parsed));
  return candidates;
}

function cp08ArtifactIssues(entry, parsed) {
  const codes = [];
  if (
    ['projection_reconciliation_report', 'authority_resolution_report'].includes(entry.role) &&
    parsed?.decision !== 'pass'
  ) {
    codes.push(`prepublication_${entry.role}_blocked`);
  }
  if (
    entry.role === 'renderability_probe_report' &&
    (parsed?.decision !== 'pass' || parsed?.promotable !== false)
  ) {
    codes.push('prepublication_renderability_probe_blocked');
  }
  if (entry.role === 'judge_audit_packet' && !isRecord(parsed?.body)) {
    codes.push('judge_audit_packet_coverage_gap');
  }
  if (
    entry.role === 'judge_audit_packet_coverage' &&
    (parsed?.allApplicableArtifactsIncluded !== true ||
      !Array.isArray(parsed?.omittedArtifactIds) ||
      parsed.omittedArtifactIds.length > 0)
  ) {
    codes.push('judge_audit_packet_coverage_gap');
  }
  return codes;
}

function validateCheckpointManifest(manifest, expected) {
  const codes = [];
  if (!hasExactKeys(manifest, CHECKPOINT_MANIFEST_KEYS)) {
    return ['authoring_checkpoint_manifest_shape_invalid'];
  }
  if (manifest.schemaVersion !== 'requirements-contract-authoring-checkpoint-manifest/v1') {
    codes.push('authoring_checkpoint_manifest_schema_invalid');
  }
  if (
    manifest.authoringAttemptId !== expected.authoringAttemptId ||
    manifest.inputManifestHash !== expected.inputManifestHash ||
    manifest.checkpointId !== expected.stage ||
    manifest.stage !== expected.stage ||
    manifest.checkpointOrdinal !== expected.ordinal ||
    manifest.status !== 'passed'
  ) {
    codes.push('authoring_checkpoint_manifest_identity_mismatch');
  }
  const { checkpointManifestHash, ...payload } = manifest;
  if (
    checkpointManifestHash !== expected.hash ||
    checkpointManifestHash !==
      hashDomain('requirements-contract-authoring-checkpoint-manifest/v1', payload)
  ) {
    codes.push('authoring_checkpoint_manifest_hash_mismatch');
  }
  const previous = manifest.previousCheckpointManifestRef;
  if (!hasExactKeys(previous, CHECKPOINT_REF_KEYS)) {
    codes.push('authoring_checkpoint_previous_lineage_invalid');
  } else {
    const previousOrdinal = expected.ordinal - 1;
    const previousId = `cp${String(previousOrdinal).padStart(2, '0')}`;
    const previousPath =
      `authoring/staging/${expected.authoringAttemptId}/manifests/${previousOrdinal}-${previousId}.json`;
    if (
      previous.checkpointId !== previousId ||
      previous.checkpointOrdinal !== previousOrdinal ||
      previous.path !== previousPath ||
      !SHA256_PATTERN.test(String(previous.hash ?? '')) ||
      manifest.latestValidPredecessorCheckpoint !== previousId
    ) {
      codes.push('authoring_checkpoint_previous_lineage_invalid');
    }
  }
  return unique(codes);
}

function validatePrepublicationAttempt(input) {
  const sourcePath = path.resolve(input.sourcePath);
  const recordRoot = path.resolve(input.recordRoot);
  const blockingIssues = [];
  const pointerPath = path.join(recordRoot, 'record', 'active-authoring-request.json');
  const sourceReparseError = pathReparseError(sourcePath);
  if (sourceReparseError) {
    blockingIssues.push(prepublicationIssue(sourceReparseError, [sourcePath]));
  }
  const pointerPathValidation = confinedRecordPath(
    recordRoot,
    'record/active-authoring-request.json'
  );
  if (!pointerPathValidation || pointerPathValidation.error) {
    blockingIssues.push(
      prepublicationIssue(
        pointerPathValidation?.error ?? 'authoring_checkpoint_manifest_path_escape',
        [pointerPath]
      )
    );
  }
  if (blockingIssues.length > 0) {
    return prepublicationFailureReport({ sourcePath, recordRoot, pointerPath, blockingIssues });
  }
  const sourceBefore = fs.readFileSync(sourcePath);
  const pointerRead = input.attemptPointer
    ? { ok: true, value: input.attemptPointer }
    : readJsonSafe(pointerPath);
  if (!pointerRead.ok) {
    blockingIssues.push(
      prepublicationIssue(
        pointerRead.missing
          ? 'active_authoring_attempt_pointer_missing'
          : 'active_authoring_attempt_pointer_unreadable',
        [pointerPath]
      )
    );
  }
  const pointer = pointerRead.ok ? pointerRead.value : null;
  for (const code of validateAttemptPointer(pointer)) {
    blockingIssues.push(prepublicationIssue(code, [pointerPath]));
  }

  const manifests = [];
  const artifacts = [];
  if (blockingIssues.length === 0) {
    let manifestPath = pointer.attemptManifestPath;
    let manifestHash = pointer.attemptManifestHash;
    for (let ordinal = 8; ordinal >= 4; ordinal -= 1) {
      const stage = `cp${String(ordinal).padStart(2, '0')}`;
      const confinedManifest = confinedRecordPath(recordRoot, manifestPath);
      if (!confinedManifest) {
        blockingIssues.push(
          prepublicationIssue('authoring_checkpoint_manifest_path_escape', [manifestPath])
        );
        break;
      }
      if (confinedManifest.error) {
        blockingIssues.push(prepublicationIssue(confinedManifest.error, [manifestPath]));
        break;
      }
      const absoluteManifestPath = confinedManifest.path;
      const read = readJsonSafe(absoluteManifestPath);
      if (!read.ok) {
        blockingIssues.push(
          prepublicationIssue(
            read.missing
              ? 'authoring_checkpoint_manifest_missing'
              : 'authoring_checkpoint_manifest_unreadable',
            [manifestPath]
          )
        );
        break;
      }
      const manifest = read.value;
      const manifestCodes = validateCheckpointManifest(manifest, {
        stage,
        ordinal,
        hash: manifestHash,
        authoringAttemptId: pointer.authoringAttemptId,
        inputManifestHash: pointer.inputManifestHash,
      });
      for (const code of manifestCodes) {
        blockingIssues.push(prepublicationIssue(code, [manifestPath]));
      }
      manifests.push({ stage, path: manifestPath, manifest });
      if (manifestCodes.length > 0) break;
      manifestPath = manifest.previousCheckpointManifestRef.path;
      manifestHash = manifest.previousCheckpointManifestRef.hash;
    }
  }

  let semanticRevisionId = '';
  let scopeSemanticHash = '';
  for (const { stage, manifest } of [...manifests].reverse()) {
    const allowedRoles = PREPUBLICATION_ALLOWED_ROLES.get(stage) ?? new Set();
    const entries = Array.isArray(manifest.artifactEntries) ? manifest.artifactEntries : [];
    const roles = new Set(entries.map((entry) => entry?.role));
    for (const requiredRole of PREPUBLICATION_REQUIRED_ROLES.get(stage) ?? []) {
      if (!roles.has(requiredRole)) {
        blockingIssues.push(
          prepublicationIssue(`prepublication_${stage}_artifact_role_missing:${requiredRole}`)
        );
      }
    }
    for (const entry of entries) {
      if (!hasExactKeys(entry, ARTIFACT_ENTRY_KEYS)) {
        blockingIssues.push(prepublicationIssue('authoring_checkpoint_artifact_shape_invalid'));
        continue;
      }
      if (
        typeof entry.schemaVersion !== 'string' ||
        !entry.schemaVersion ||
        typeof entry.artifactId !== 'string' ||
        !entry.artifactId
      ) {
        blockingIssues.push(
          prepublicationIssue('authoring_checkpoint_artifact_identity_invalid')
        );
        continue;
      }
      if (!allowedRoles.has(entry.role) || PREPUBLICATION_FORBIDDEN_ROLES.has(entry.role)) {
        blockingIssues.push(
          prepublicationIssue(`prepublication_${stage}_artifact_role_forbidden:${entry.role}`)
        );
        continue;
      }
      if (
        !canonicalRecordRelativePath(entry.recordRelativePath) ||
        !SHA256_PATTERN.test(String(entry.artifactHash ?? ''))
      ) {
        blockingIssues.push(
          prepublicationIssue('authoring_checkpoint_artifact_ref_invalid', [entry.artifactId])
        );
        continue;
      }
      if (
        stage !== 'cp04' &&
        !entry.recordRelativePath.startsWith(
          `authoring/staging/${pointer.authoringAttemptId}/`
        )
      ) {
        blockingIssues.push(
          prepublicationIssue('authoring_checkpoint_staged_artifact_path_mismatch', [entry.artifactId])
        );
        continue;
      }
      const confinedArtifact = confinedRecordPath(recordRoot, entry.recordRelativePath);
      if (confinedArtifact?.error) {
        blockingIssues.push(
          prepublicationIssue(confinedArtifact.error, [entry.artifactId])
        );
        continue;
      }
      const absoluteArtifactPath = confinedArtifact?.path;
      if (!absoluteArtifactPath || !fs.existsSync(absoluteArtifactPath)) {
        blockingIssues.push(
          prepublicationIssue('authoring_checkpoint_artifact_missing', [entry.artifactId])
        );
        continue;
      }
      const bytes = fs.readFileSync(absoluteArtifactPath);
      let parsed = null;
      if (/\.json$/u.test(entry.recordRelativePath)) {
        try {
          parsed = JSON.parse(bytes.toString('utf8'));
        } catch {
          blockingIssues.push(
            prepublicationIssue('authoring_checkpoint_artifact_json_invalid', [entry.artifactId])
          );
          continue;
        }
        if (!isRecord(parsed) || parsed.schemaVersion !== entry.schemaVersion) {
          blockingIssues.push(
            prepublicationIssue('authoring_checkpoint_artifact_schema_mismatch', [entry.artifactId])
          );
        }
      }
      if (!checkpointArtifactHashCandidates(stage, entry, bytes, parsed).has(entry.artifactHash)) {
        blockingIssues.push(
          prepublicationIssue('authoring_checkpoint_artifact_hash_mismatch', [entry.artifactId])
        );
      }
      if (stage === 'cp04' && entry.role === 'semantic_ir' && isRecord(parsed)) {
        semanticRevisionId = String(parsed.semanticRevisionId ?? '');
        scopeSemanticHash = String(parsed.scopeSemanticHash ?? '');
        if (!semanticRevisionId || !SHA256_PATTERN.test(scopeSemanticHash)) {
          blockingIssues.push(prepublicationIssue('prepublication_cp04_semantic_identity_invalid'));
        }
      }
      if (stage === 'cp04' && entry.role === 'source_binding' && isRecord(parsed)) {
        if (
          parsed.semanticRevisionId !== semanticRevisionId ||
          parsed.scopeSemanticHash !== scopeSemanticHash
        ) {
          blockingIssues.push(prepublicationIssue('prepublication_cp04_binding_identity_mismatch'));
        }
      }
      if (LOGICAL_IDENTITY_ROLES.has(entry.role) && isRecord(parsed)) {
        if (
          parsed.semanticRevisionId !== semanticRevisionId ||
          parsed.scopeSemanticHash !== scopeSemanticHash
        ) {
          blockingIssues.push(
            prepublicationIssue('prepublication_projection_semantic_identity_mismatch', [
              entry.artifactId,
            ])
          );
        }
      }
      if (stage === 'cp08') {
        for (const code of cp08ArtifactIssues(entry, parsed)) {
          blockingIssues.push(prepublicationIssue(code, [entry.artifactId]));
        }
      }
      artifacts.push({
        stage,
        role: entry.role,
        artifactId: entry.artifactId,
        path: entry.recordRelativePath,
        hash: entry.artifactHash,
      });
    }
  }

  const sourceAfter = fs.readFileSync(sourcePath);
  const sourceHashBefore = hashBytes(sourceBefore);
  const sourceHashAfter = hashBytes(sourceAfter);
  if (!sourceBefore.equals(sourceAfter)) {
    blockingIssues.push(prepublicationIssue('prepublication_probe_source_bytes_changed'));
  }
  const report = {
    schemaVersion: 'requirements-contract-prepublication-render-gate-report/v1',
    verdict: blockingIssues.length === 0 ? 'PASS' : 'FAIL',
    sourcePath: normalizePathForReport(sourcePath),
    recordRoot: normalizePathForReport(recordRoot),
    pointerPath: normalizePathForReport(pointerPath),
    manifestPaths: manifests.map((item) => item.path),
    artifactRefs: artifacts,
    semanticRevisionId: semanticRevisionId || null,
    scopeSemanticHash: scopeSemanticHash || null,
    sourceHashBefore,
    sourceHashAfter,
    sourceHashPreserved: sourceBefore.equals(sourceAfter),
    failedChecks: unique(blockingIssues.map((item) => item.code)),
    blockingIssues,
  };
  report.contentHash = hashObject({ ...report, contentHash: null });
  return { exitCode: report.verdict === 'PASS' ? 0 : 1, report };
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonSafe(filePath) {
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute)) {
    return { ok: false, missing: true, path: absolute };
  }
  try {
    return { ok: true, value: readJsonFile(absolute), path: absolute };
  } catch (error) {
    return {
      ok: false,
      missing: false,
      path: absolute,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function writeJson(filePath, value) {
  const absolute = path.resolve(filePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function issue(code, message, refs = [], severity = 'blocker', source = 'must_decomposition_gate') {
  return { code, message, refs: stringList(refs), severity, source };
}

function unwrapKernel(value) {
  return value?.semanticKernel ?? value;
}

function unwrapPacket(value) {
  return value?.must_decomposition_packet ?? value?.mustDecompositionPacket ?? value;
}

function unwrapReceipt(value) {
  return value?.criticalAuditorReceipt ?? value;
}

function defaultAuthoringDir(sourcePath, confirmation) {
  const recordId = String(confirmation?.recordId ?? '').trim();
  if (recordId) {
    return path.join(process.cwd(), '_bmad-output', 'runtime', 'requirement-records', recordId, 'authoring');
  }
  const base = path.basename(sourcePath, path.extname(sourcePath)).replace(/[^A-Za-z0-9_.-]+/g, '-');
  return path.join(process.cwd(), '_bmad-output', 'runtime', 'requirement-records', base, 'authoring');
}

function collectReceiptPaths(authoringDir) {
  if (!fs.existsSync(authoringDir)) return [];
  return fs
    .readdirSync(authoringDir)
    .filter((fileName) => /^critical-auditor-receipt-round-\d+\.json$/u.test(fileName))
    .map((fileName) => path.join(authoringDir, fileName))
    .sort();
}

function rowId(row, fallback = '') {
  return String(row?.id ?? row?.taskId ?? row?.commandId ?? row?.artifactId ?? row?.path ?? fallback).trim();
}

function sourceRowsForKey(confirmation, key) {
  if (key === 'implementationTasks' || key === 'atomicImplementationTaskList') {
    const canonicalTasks = asArray(confirmation.implementationTasks);
    return canonicalTasks.length ? canonicalTasks : asArray(confirmation.atomicImplementationTaskList);
  }
  if (key === 'currentTargetMap') {
    const map = confirmation.currentTargetMap ?? {};
    return [
      ...asArray(map.currentSummary),
      ...asArray(map.targetSummary),
      ...asArray(map.diffRows),
      ...asArray(map.process),
      ...asArray(map.artifactPaths),
      ...asArray(map.canonicalArtifacts),
      ...asArray(map.existingArtifacts),
    ];
  }
  if (key === 'aiTddContractExecutionManifestProjection') {
    const manifest = confirmation.aiTddContractExecutionManifestProjection ?? confirmation.contractExecutionManifest ?? {};
    return Object.entries(manifest).map(([id, value]) => ({ id, ...(value && typeof value === 'object' ? value : { value }) }));
  }
  if (key === 'closeoutReadinessPreview') {
    const closeout = confirmation.closeoutReadinessPreview ?? {};
    return closeout && Object.keys(closeout).length ? [{ id: 'closeoutReadinessPreview', ...closeout }] : [];
  }
  return asArray(confirmation[key]);
}

function projectionMaterializedTargets(row) {
  return stringList(row?.materializedTo ?? row?.materializedToRefs ?? row?.sourceRefs);
}

function parseMaterializedTarget(target) {
  const text = String(target ?? '');
  const match = text.match(/^implementationConfirmation\.([A-Za-z0-9_.]+)(?:\[([^\]]+)\])?/u);
  if (!match) return null;
  return { sourceKey: match[1].split('.')[0], id: match[2] ?? '' };
}

function hasSourceRow(confirmation, target) {
  const parsed = parseMaterializedTarget(target);
  if (!parsed) return false;
  const rows = sourceRowsForKey(confirmation, parsed.sourceKey);
  if (!parsed.id) return rows.length > 0;
  return rows.some((row, index) => rowId(row, String(index)) === parsed.id || String(row?.path ?? '') === parsed.id);
}

function isProjectionBacked(row, packetHash) {
  if (!row || typeof row !== 'object') return false;
  if (row.derivedFromPacketHash === packetHash) return true;
  if (
    row.projectionStatus === 'synchronized' &&
    (row.derivedFromMustRef || row.derivedFromRequirementRef)
  ) {
    return true;
  }
  if (row.derivedFromProjectionRef || row.derivedFromProjectionId) return true;
  return false;
}

function packetProjectionBacksSourceRow(projections, sourceKey, row, index) {
  const rowIdentifier = rowId(row, String(index));
  const sourceKeys =
    sourceKey === 'implementationTasks'
      ? ['implementationTasks', 'atomicImplementationTaskList']
      : [sourceKey];
  return sourceKeys.some((key) =>
    projections.some((projection) =>
      projectionMaterializedTargets(projection).some((target) => {
        const parsed = parseMaterializedTarget(target);
        if (!parsed || parsed.sourceKey !== key) return false;
        return !parsed.id || parsed.id === rowIdentifier || String(row?.path ?? '') === parsed.id;
      })
    )
  );
}

function allPacketProjectionRows(packet) {
  return asArray(packet.mustPackets).flatMap((mustPacket) =>
    [
      'mustExecutionDecompositionMatrix',
      'mustAtomicTasks',
      'mustEvidenceProjection',
      'mustTraceProjection',
      'mustAcceptanceProjection',
      'mustFailureEdgeProjection',
      'mustTargetPathProjection',
      'mustCurrentTargetProjection',
      'mustAiTddManifestProjection',
      'mustArtifactProjection',
      'mustCommandProjection',
      'mustCloseoutBoundaryProjection',
    ].flatMap((key) =>
      asArray(mustPacket[key]).map((row) => ({
        ...row,
        projectionKey: key,
        mustRef: mustPacket.mustRef,
      }))
    )
  );
}

function collectKernelIssues({ kernel, kernelPath, sourceDocumentHash }) {
  const issues = [];
  if (!kernel) {
    issues.push(issue('missing_semantic_kernel', 'semantic-kernel.json is missing', [kernelPath]));
    return issues;
  }
  if (kernel.schemaVersion !== 'semantic-kernel/v1') {
    issues.push(issue('semantic_kernel_schema_invalid', 'semantic kernel schemaVersion must be semantic-kernel/v1', ['schemaVersion']));
  }
  if (kernel.sourceDocumentHash !== sourceDocumentHash) {
    issues.push(issue('semantic_kernel_source_hash_stale', 'semantic kernel sourceDocumentHash is stale', ['sourceDocumentHash']));
  }
  for (const field of ['goal', 'currentState', 'targetState']) {
    const value = kernel[field];
    if (Array.isArray(value) ? value.length === 0 : !String(value ?? '').trim()) {
      issues.push(issue('semantic_kernel_core_missing', `semantic kernel missing ${field}`, [field]));
    }
  }
  if (!String(kernel.kernelHash ?? '').startsWith('sha256:')) {
    issues.push(issue('semantic_kernel_hash_missing', 'semantic kernel must declare kernelHash', ['kernelHash']));
  }
  return issues;
}

function collectPacketIssues({ packet, packetPath, kernel, sourceDocumentHash, confirmation }) {
  const issues = [];
  if (!packet) {
    issues.push(issue('missing_must_decomposition_packet', 'must_decomposition_packet.json is missing', [packetPath]));
    return issues;
  }
  if (packet.schemaVersion !== 'must-decomposition-packet/v1') {
    issues.push(issue('must_packet_schema_invalid', 'must_decomposition_packet schemaVersion must be must-decomposition-packet/v1', ['schemaVersion']));
  }
  if (packet.status !== 'synchronized') {
    issues.push(issue('must_packet_not_synchronized', 'must_decomposition_packet.status must be synchronized', ['status']));
  }
  if (packet.sourceDocumentHash !== sourceDocumentHash) {
    issues.push(issue('must_packet_source_hash_stale', 'must_decomposition_packet sourceDocumentHash is stale', ['sourceDocumentHash']));
  }
  if (kernel?.kernelHash && packet.semanticKernelHash !== kernel.kernelHash) {
    issues.push(issue('must_packet_semantic_kernel_hash_stale', 'must_decomposition_packet semanticKernelHash is stale', ['semanticKernelHash']));
  }
  if (!String(packet.packetHash ?? '').startsWith('sha256:')) {
    issues.push(issue('must_packet_hash_missing', 'must_decomposition_packet must declare packetHash', ['packetHash']));
  }

  const packetRows = asArray(packet.mustPackets);
  const byMust = new Map(packetRows.map((row) => [row.mustRef, row]));
  for (const must of asArray(confirmation.must)) {
    const mustId = String(must?.id ?? '').trim();
    const mustPacket = byMust.get(mustId);
    if (!mustPacket) {
      issues.push(issue('must_packet_missing_must_row', `${mustId} lacks a mustPackets[] row`, [mustId]));
      continue;
    }
    if (!mustPacket.decompositionBasis || !Object.keys(mustPacket.decompositionBasis).length) {
      issues.push(issue('must_packet_decomposition_basis_missing', `${mustId} lacks decompositionBasis`, [mustId]));
    }
    if (!mustPacket.atomicityDrivers || !Object.keys(mustPacket.atomicityDrivers).length) {
      issues.push(issue('must_packet_atomicity_drivers_missing', `${mustId} lacks atomicityDrivers`, [mustId]));
    }
    if (mustPacket.questionCoverage?.coverageVerdict !== 'complete') {
      issues.push(issue('must_packet_question_coverage_incomplete', `${mustId} questionCoverage is incomplete`, [mustId]));
    }
    const expected = Number(mustPacket.atomicityCompleteness?.expectedTaskCount ?? 0);
    const actual = Number(mustPacket.atomicityCompleteness?.actualTaskCount ?? asArray(mustPacket.mustAtomicTasks).length);
    if (mustPacket.atomicityCompleteness?.completenessVerdict !== 'complete') {
      issues.push(issue('must_packet_atomicity_incomplete', `${mustId} atomicityCompleteness is not complete`, [mustId]));
    }
    if (actual < expected) {
      issues.push(issue('must_packet_under_split', `${mustId} actualTaskCount is less than expectedTaskCount`, [mustId]));
    }
    for (const task of asArray(mustPacket.mustAtomicTasks)) {
      const taskId = rowId(task, mustId);
      const overBroad =
        task.overBroad === true ||
        task.coversMultipleIndependentUnits === true ||
        String(task.estimatedAtomicity ?? '').toLowerCase() === 'over_broad' ||
        asArray(task.primaryObservableBehaviors).length > 1 ||
        asArray(task.primaryAcceptanceOracles).length > 1;
      if (overBroad) {
        issues.push(issue('must_packet_over_broad_atomic_task', `${taskId} covers more than one atomic unit`, [mustId, taskId]));
      }
      if (!asArray(task.targetFiles).length && !task.noFileModificationRequired) {
        issues.push(issue('must_packet_atomic_task_missing_target_files', `${taskId} lacks targetFiles[]`, [mustId, taskId]));
      }
      if (!task.redProofPlan) {
        issues.push(issue('must_packet_atomic_task_missing_red_proof', `${taskId} lacks redProofPlan`, [mustId, taskId]));
      }
    }
  }
  for (const claim of [
    ...asArray(packet.authorClaims),
    ...packetRows.flatMap((row) => asArray(row.authorClaims)),
  ]) {
    if (!claim.criticDisposition) {
      issues.push(issue('author_claim_lacks_critic_disposition', 'Author claim lacks Critical Auditor disposition', [claim.id ?? claim.claim ?? 'authorClaim']));
    }
  }
  return issues;
}

function collectContractExecutionManifestIssues(confirmation) {
  try {
    const manifest = buildDerivedContractExecutionManifest({ confirmation });
    const hasAcceptanceSurface = [
      'acceptanceTests',
      'acceptanceCriteria',
      'e2eSuites',
      'e2eScenarios',
    ].some((field) => asArray(confirmation[field]).length > 0);
    return asArray(manifest?.errorCaseCoverage?.missing)
      .filter(
        (finding) =>
          hasAcceptanceSurface ||
          !['failure_path_acceptance_coverage_missing', 'edge_case_acceptance_coverage_missing'].includes(
            finding.code
          )
      )
      .map((finding) =>
        issue(
          `ai_tdd_manifest_${finding.code}`,
          `errorCaseCoverage missing ${finding.id}: ${finding.code}`,
          ['errorCaseCoverage', finding.id],
          'blocker',
          'contract_execution_manifest'
        )
      );
  } catch (error) {
    return [
      issue(
        'ai_tdd_manifest_derivation_failed',
        error instanceof Error ? error.message : String(error),
        ['aiTddContractExecutionManifestProjection'],
        'blocker',
        'contract_execution_manifest'
      ),
    ];
  }
}

function buildAuditInputHash({ sourceDocumentHash, implementationConfirmationHash, kernel, packet }) {
  return hashObject({
    sourceDocumentHash,
    semanticModelHash: packet?.semanticModelHash ?? kernel?.semanticModelHash ?? null,
    implementationConfirmationHash,
    semanticKernelHash: kernel?.kernelHash ?? null,
    packetHash: packet?.packetHash ?? null,
  });
}

function collectCriticalAuditorIssues({ receiptReads, auditInputHash }) {
  const issues = [];
  const receipts = [];
  for (const read of receiptReads) {
    if (!read.ok) {
      issues.push(issue('critical_auditor_receipt_unreadable', read.error ?? 'Critical Auditor receipt is unreadable', [read.path]));
      continue;
    }
    receipts.push(unwrapReceipt(read.value));
  }
  if (!receipts.length) {
    issues.push(issue('critical_auditor_receipt_missing', 'Critical Auditor receipts are missing'));
    return { issues, receipts: [], consecutiveNoNewGapRounds: 0, latestReceiptHash: null };
  }
  receipts.sort((a, b) => Number(a.roundIndex ?? 0) - Number(b.roundIndex ?? 0));
  let consecutive = 0;
  let latestReceiptHash = null;
  for (const receipt of receipts) {
    latestReceiptHash = hashObject(receipt);
    if (receipt.schemaVersion !== 'critical-auditor-receipt/v1') {
      issues.push(issue('critical_auditor_receipt_schema_invalid', `round ${receipt.roundIndex ?? '?'} has invalid schemaVersion`));
    }
    if (receipt.inputHash !== auditInputHash) {
      issues.push(issue('critical_auditor_receipt_input_hash_stale', `round ${receipt.roundIndex ?? '?'} inputHash is stale`, ['inputHash']));
    }
    const verdict = receipt.convergenceDecision?.verdict;
    if (verdict === 'insufficient_audit') {
      issues.push(issue('critical_auditor_insufficient_audit', `round ${receipt.roundIndex ?? '?'} is insufficient_audit`));
    }
    if (verdict === 'blocked') {
      issues.push(issue('critical_auditor_blocked', `round ${receipt.roundIndex ?? '?'} is blocked`));
    }
    for (const gap of asArray(receipt.validatedGaps)) {
      const status = String(gap.status ?? gap.resolutionStatus ?? '').trim();
      if (!RESOLVED_GAP_STATUSES.has(status)) {
        issues.push(issue('critical_auditor_validated_gap_unresolved', `validated gap ${gap.id ?? gap.code ?? 'unknown'} is unresolved`, [gap.id ?? gap.code ?? 'gap']));
      }
    }
    consecutive = VALID_NO_NEW_GAP_VERDICTS.has(verdict) ? consecutive + 1 : 0;
  }
  if (consecutive < 3) {
    issues.push(issue('critical_auditor_less_than_three_no_new_gap_rounds', 'Critical Auditor has fewer than three consecutive no-new-gap rounds'));
  }
  return { issues, receipts, consecutiveNoNewGapRounds: consecutive, latestReceiptHash };
}

function buildReconciliationReport({
  confirmation,
  packet,
  sourcePath = '',
  packetPath = '',
  sourceDocumentHash = '',
  implementationConfirmationHash = '',
}) {
  const issues = [];
  const packetHash = packet?.packetHash ?? '';
  const projections = allPacketProjectionRows(packet ?? {});
  for (const projection of projections) {
    const targets = projectionMaterializedTargets(projection);
    if (!targets.length) {
      issues.push(
        issue(
          'packet_projection_not_materialized',
          `${rowId(projection, projection.projectionKey)} lacks materializedTo[]`,
          [projection.mustRef, projection.projectionKey]
        )
      );
      continue;
    }
    for (const target of targets) {
      if (!hasSourceRow(confirmation, target)) {
        issues.push(issue('packet_projection_points_to_missing_source_row', `${target} does not resolve to a source row`, [target]));
      }
    }
  }

  for (const group of SOURCE_ROW_GROUPS) {
    for (const [index, row] of sourceRowsForKey(confirmation, group.sourceKey).entries()) {
      if (
        !isProjectionBacked(row, packetHash) &&
        !packetProjectionBacksSourceRow(projections, group.sourceKey, row, index)
      ) {
        issues.push(
          issue(
            'source_row_independently_invented',
            `${group.sourceKey}[${rowId(row)}] lacks synchronized packet back-reference`,
            [group.sourceKey, rowId(row)]
          )
        );
      }
    }
  }

  for (const key of ['currentTargetMap', 'aiTddContractExecutionManifestProjection', 'closeoutReadinessPreview']) {
    const rows = sourceRowsForKey(confirmation, key);
    if (rows.length && !asArray(packet?.mustDerivedProjectionMap).some((row) => stringList(row.materializedTo).some((target) => target.includes(key)))) {
      issues.push(issue('packet_projection_missing_group_mapping', `${key} lacks mustDerivedProjectionMap materialization`, [key]));
    }
  }

  const report = {
    schemaVersion: 'must-packet-source-reconciliation-report/v1',
    recordId: String(confirmation?.recordId ?? '').trim() || null,
    sourceDocumentHash,
    implementationConfirmationHash,
    createdBy: 'pre_render_must_decomposition_gate',
    createdAt: new Date().toISOString(),
    inputRefs: stringList([sourcePath, packetPath]).map((item) => normalizePathForReport(item)),
    verdict: issues.length ? 'fail' : 'pass',
    packetHash,
    checkedGroups: SOURCE_ROW_GROUPS.map((group) => group.sourceKey),
    issueCount: issues.length,
    issues,
  };
  report.contentHash = hashObject({ ...report, contentHash: null });
  return report;
}

function runGate(args) {
  const sourcePath = path.resolve(args.source);
  if (args.prepublicationAttempt) {
    if (!args.recordRoot) {
      const finding = prepublicationIssue('prepublication_record_root_missing');
      return {
        exitCode: 1,
        report: {
          schemaVersion: 'requirements-contract-prepublication-render-gate-report/v1',
          verdict: 'FAIL',
          failedChecks: [finding.code],
          blockingIssues: [finding],
        },
      };
    }
    const result = validatePrepublicationAttempt({
      sourcePath,
      recordRoot: args.recordRoot,
    });
    if (args.out) writeJson(args.out, result.report);
    return result;
  }
  let sourceText;
  let confirmation;
  let blockText;
  try {
    sourceText = fs.readFileSync(sourcePath, 'utf8');
    const extracted = extractImplementationConfirmation(sourceText);
    confirmation = extracted.confirmation;
    blockText = extracted.blockText;
  } catch (error) {
    const finding = issue('source_parse_failed', error instanceof Error ? error.message : String(error), [sourcePath]);
    const report = {
      schemaVersion: 'pre-render-must-decomposition-gate-report/v1',
      verdict: 'FAIL',
      failedChecks: [finding.code],
      blockingIssues: [finding],
    };
    return { exitCode: 1, report };
  }

  const sourceDocumentHash = sourceDocumentHashFor(sourceText, blockText, confirmation);
  const implementationConfirmationHash = implementationConfirmationHashFor(confirmation);
  const authoringDir = path.resolve(args.authoringDir || defaultAuthoringDir(sourcePath, confirmation));
  const kernelPath = path.resolve(args.semanticKernel || confirmation.preConfirmationDrilldown?.semanticKernelRef?.path || path.join(authoringDir, 'semantic-kernel.json'));
  const packetPath = path.resolve(
    args.mustDecompositionPacket ||
      confirmation.preConfirmationDrilldown?.mustDecompositionPacketRef?.path ||
      path.join(authoringDir, 'must_decomposition_packet.json')
  );
  const reportPath = path.resolve(args.out || path.join(authoringDir, 'pre-render-must-decomposition-gate-report.json'));
  const receiptPath = path.resolve(args.receipt || path.join(authoringDir, 'must_decomposition_receipt.json'));
  const reconciliationPath = path.resolve(args.reconciliationReport || path.join(authoringDir, 'must_packet_source_reconciliation_report.json'));

  const kernelRead = readJsonSafe(kernelPath);
  const packetRead = readJsonSafe(packetPath);
  const kernel = kernelRead.ok ? unwrapKernel(kernelRead.value) : null;
  const packet = packetRead.ok ? unwrapPacket(packetRead.value) : null;
  const auditInputHash = buildAuditInputHash({ sourceDocumentHash, implementationConfirmationHash, kernel, packet });
  const receiptReads = collectReceiptPaths(authoringDir).map((receiptFile) => readJsonSafe(receiptFile));

  const blockingIssues = [
    ...(kernelRead.ok ? [] : [issue(kernelRead.missing ? 'missing_semantic_kernel' : 'semantic_kernel_unreadable', kernelRead.error ?? 'semantic-kernel.json is missing or unreadable', [kernelPath])]),
    ...(packetRead.ok ? [] : [issue(packetRead.missing ? 'missing_must_decomposition_packet' : 'must_packet_unreadable', packetRead.error ?? 'must_decomposition_packet.json is missing or unreadable', [packetPath])]),
    ...collectKernelIssues({ kernel, kernelPath, sourceDocumentHash }),
    ...collectPacketIssues({ packet, packetPath, kernel, sourceDocumentHash, confirmation }),
    ...collectProjectionQualityIssues(confirmation, {
      source: 'must_decomposition_gate',
      makeIssue: issue,
    }),
    ...collectContractExecutionManifestIssues(confirmation),
  ];

  const auditor = collectCriticalAuditorIssues({ receiptReads, auditInputHash });
  blockingIssues.push(...auditor.issues);

  const reconciliation = buildReconciliationReport({
    confirmation,
    packet,
    sourcePath,
    packetPath,
    sourceDocumentHash,
    implementationConfirmationHash,
  });
  blockingIssues.push(...reconciliation.issues);
  if (reconciliation.verdict !== 'pass') {
    blockingIssues.push(issue('packet_source_reconciliation_failed', 'packet/source reconciliation verdict is not pass', [reconciliationPath]));
  }

  const verdict = blockingIssues.length ? 'FAIL' : 'PASS';
  const receipt = {
    schemaVersion: 'must-decomposition-receipt/v1',
    verdict,
    recordId: String(confirmation?.recordId ?? '').trim() || null,
    sourcePath: normalizePathForReport(sourcePath),
    sourceDocumentHash,
    implementationConfirmationHash,
    createdBy: 'pre_render_must_decomposition_gate',
    createdAt: new Date().toISOString(),
    inputRefs: [
      normalizePathForReport(sourcePath),
      normalizePathForReport(kernelPath),
      normalizePathForReport(packetPath),
      normalizePathForReport(reconciliationPath),
    ],
    semanticKernelHash: kernel?.kernelHash ?? null,
    packetHash: packet?.packetHash ?? null,
    auditInputHash,
    criticalAuditor: {
      receiptCount: auditor.receipts.length,
      minimumRounds: 3,
      consecutiveNoNewGapRounds: auditor.consecutiveNoNewGapRounds,
      latestReceiptHash: auditor.latestReceiptHash,
      convergenceVerdict: auditor.consecutiveNoNewGapRounds >= 3 ? 'bounded_no_new_gap' : 'blocked',
    },
    reconciliationReportPath: normalizePathForReport(reconciliationPath),
    failedChecks: unique(blockingIssues.map((item) => item.code)),
  };
  receipt.receiptHash = hashObject({ ...receipt, receiptHash: null });
  const report = {
    schemaVersion: 'pre-render-must-decomposition-gate-report/v1',
    verdict,
    recordId: String(confirmation?.recordId ?? '').trim() || null,
    confirmability: verdict === 'PASS' ? 'confirmable' : 'blocked',
    sourcePath: normalizePathForReport(sourcePath),
    authoringDir: normalizePathForReport(authoringDir),
    sourceDocumentHash,
    implementationConfirmationHash,
    createdBy: 'pre_render_must_decomposition_gate',
    createdAt: new Date().toISOString(),
    inputRefs: [
      normalizePathForReport(sourcePath),
      normalizePathForReport(kernelPath),
      normalizePathForReport(packetPath),
      normalizePathForReport(receiptPath),
      normalizePathForReport(reconciliationPath),
    ],
    semanticKernelRef: { path: normalizePathForReport(kernelPath), hash: kernel?.kernelHash ?? null },
    mustDecompositionPacketRef: { path: normalizePathForReport(packetPath), hash: packet?.packetHash ?? null, status: packet?.status ?? null },
    mustDecompositionReceiptPath: normalizePathForReport(receiptPath),
    packetSourceReconciliation: {
      reportPath: normalizePathForReport(reconciliationPath),
      verdict: reconciliation.verdict,
    },
    criticalAuditor: receipt.criticalAuditor,
    failedChecks: receipt.failedChecks,
    blockingIssues,
  };
  report.contentHash = hashObject({ ...report, contentHash: null });

  writeJson(reconciliationPath, reconciliation);
  writeJson(receiptPath, receipt);
  writeJson(reportPath, report);

  return { exitCode: verdict === 'PASS' ? 0 : 1, report, receipt, reconciliation };
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.error) {
    console.error(JSON.stringify({ ok: false, code: 'invalid_args', message: args.error }, null, 2));
    return 2;
  }

  const result = runGate(args);
  if (args.json) {
    process.stdout.write(`${JSON.stringify(result.report, null, 2)}\n`);
  } else {
    console.log(`pre-render-must-decomposition-gate-report.json=${result.report.reportPath ?? ''}`);
    console.log(`must_decomposition_receipt.json=${result.report.mustDecompositionReceiptPath ?? ''}`);
    console.log(`must_packet_source_reconciliation_report.json=${result.report.packetSourceReconciliation?.reportPath ?? ''}`);
    console.log(`verdict=${result.report.verdict}`);
  }
  return result.exitCode;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = {
  main,
  parseArgs,
  runGate,
  validatePrepublicationAttempt,
  buildAuditInputHash,
  buildReconciliationReport,
};
