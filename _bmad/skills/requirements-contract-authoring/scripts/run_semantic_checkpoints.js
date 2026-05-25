#!/usr/bin/env node
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  asArray,
  buildDefinitionReportFromSource,
  extractImplementationConfirmation,
  implementationConfirmationHashFor,
  normalizePathForReport,
  sourceDocumentHashFor,
  stringList,
  unique,
} = require('./pre_render_definition_drilldown_lib');
const { buildAssessment } = require('./assess_contract_authoring_scale');

const CHECKPOINTS = [
  {
    id: 'cp-01-header-scope-decisions',
    name: 'Header, scope, non-goals, and frozen decisions',
    allowedSections: ['header', 'background', 'scope', 'nonGoals', 'frozenDecisions'],
  },
  {
    id: 'cp-02-confirmation-core-applicability',
    name: 'implementationConfirmation core fields and applicability',
    allowedSections: ['implementationConfirmation.core', 'applicability'],
  },
  {
    id: 'cp-03-must-neg-out-evidence',
    name: 'must, notDone, mustNot, and evidence',
    allowedSections: ['must', 'notDone', 'mustNot', 'evidence'],
  },
  {
    id: 'cp-04-failure-edge-trace',
    name: 'failurePaths, edgeCases, and traceRows',
    allowedSections: ['failurePaths', 'edgeCases', 'traceRows'],
  },
  {
    id: 'cp-05-views',
    name: 'sequence, flow, edge-case, and boundary views',
    allowedSections: ['sequenceViews', 'flowViews', 'edgeCaseViews', 'boundaryViews'],
  },
  {
    id: 'cp-06-artifacts-commands-closeout',
    name: 'artifact plan, commands, and closeout preview',
    allowedSections: ['artifactAutomationPlan', 'requiredCommands', 'suggestedCommands', 'closeoutReadinessPreview'],
  },
  {
    id: 'cp-07-conditional-modules',
    name: 'conditional governance, runtime, scoring, current-target, scripts, and hooks modules',
    allowedSections: [
      'governanceEventTypeRegistryPolicy',
      'governanceEventTypeRegistry',
      'controlledIngestWriterRegistry',
      'functionalResumeFailureCaseRegistry',
      'scoringDashboardSft',
      'currentTargetMap',
      'scriptsAndHooks',
    ],
  },
  {
    id: 'cp-08-human-readable-views-dod-reverse-audit',
    name: 'human-readable views, evidence overview, DoD, and Reverse Audit Report',
    allowedSections: ['humanReadableViews', 'mermaid', 'evidenceOverview', 'e2eOverview', 'definitionOfDone', 'reverseAuditReport'],
  },
];
const CURRENT_TARGET_SCHEMA_VERSION = 'current-target-map/v1';
const CURRENT_TARGET_DISPLAY_PROFILE = 'closed_loop_current_target_map';
const CURRENT_TARGET_REQUIRED_VIEW_PACK = 'currentTargetMap';
const CURRENT_TARGET_MINIMUM_COVERAGE = {
  currentSummary: 1,
  targetSummary: 1,
  diffRows: 3,
  process: 1,
  artifactPaths: 1,
};
const AUTHORING_MODES = new Set([
  'single_pass',
  'kernel_then_checkpoint',
  'kernel_then_checkpoint_with_amendment',
]);

function usage(exitCode = 0) {
  console.log(`Usage:
  node run_semantic_checkpoints.js --source <source-document.md> --mode plan|status|run|resume|pre-render-gate [options]

Options:
  --assessment <scale-assessment.json>
  --progress <semantic-checkpoint-progress.json>
  --checkpoint <checkpoint-id>
  --until pre-render-ready
  --json

plan/status are read-only. run/resume enforce the mandatory single-file checkpoint commit gate.`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = {
    source: '',
    assessment: '',
    progress: '',
    mode: 'plan',
    checkpoint: '',
    until: 'pre-render-ready',
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') usage(0);
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    if (
      arg === '--source' ||
      arg === '--assessment' ||
      arg === '--progress' ||
      arg === '--mode' ||
      arg === '--checkpoint' ||
      arg === '--until'
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
  if (!['plan', 'status', 'run', 'resume', 'pre-render-gate'].includes(args.mode)) return { error: `unsupported mode ${args.mode}` };
  return args;
}

function sha256File(filePath) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function readJsonIfExists(filePath) {
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute)) return null;
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}

function readJsonSafe(filePath) {
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute)) return { ok: false, missing: true, path: absolute };
  try {
    return { ok: true, value: JSON.parse(fs.readFileSync(absolute, 'utf8')), path: absolute };
  } catch (error) {
    return {
      ok: false,
      missing: false,
      path: absolute,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function backupProgressPath(progressPath) {
  return `${path.resolve(progressPath)}.bak`;
}

function writeJsonFileAtomic(filePath, value) {
  const absolute = path.resolve(filePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  const content = `${JSON.stringify(value, null, 2)}\n`;
  const temporary = path.join(
    path.dirname(absolute),
    `.${path.basename(absolute)}.${process.pid}.${Date.now()}.tmp`
  );
  fs.writeFileSync(temporary, content, 'utf8');
  fs.renameSync(temporary, absolute);
}

function writeProgressAtomic(progressPath, value) {
  const absolute = path.resolve(progressPath);
  if (fs.existsSync(absolute)) {
    fs.copyFileSync(absolute, backupProgressPath(absolute));
  }
  writeJsonFileAtomic(absolute, value);
}

function defaultAuthoringRuntimeDir(sourcePath) {
  try {
    const text = fs.readFileSync(path.resolve(sourcePath), 'utf8');
    const { confirmation } = extractImplementationConfirmation(text);
    const recordId = String(confirmation?.recordId ?? '').trim();
    if (recordId) {
      return path.join(process.cwd(), '_bmad-output', 'runtime', 'requirement-records', recordId, 'authoring');
    }
  } catch (_error) {
    // Fall through to a deterministic source-name directory for drafts without a parseable block.
  }
  const base = path.basename(sourcePath, path.extname(sourcePath)).replace(/[^A-Za-z0-9_.-]+/g, '-');
  return path.join(process.cwd(), '_bmad-output', 'runtime', 'requirement-records', base, 'authoring');
}

function defaultProgressPath(sourcePath) {
  return path.join(defaultAuthoringRuntimeDir(sourcePath), 'semantic-checkpoint-progress.json');
}

function buildPlan({ sourcePath, assessment = null, progress = null }) {
  const completedIds = new Set((progress?.checkpoints ?? []).filter((item) => item.status === 'passed').map((item) => item.id));
  const checkpoints = CHECKPOINTS.map((checkpoint, index) => ({
    ...checkpoint,
    order: index + 1,
    status: completedIds.has(checkpoint.id) ? 'passed' : 'pending',
  }));
  const next = checkpoints.find((checkpoint) => checkpoint.status !== 'passed') ?? null;
  return {
    schemaVersion: 'semantic-checkpoint-plan/v1',
    target: normalizePathForReport(sourcePath),
    modeDecision: assessment?.decision ?? 'unknown',
    authoringMode: resolveAuthoringMode({ assessment, progress }),
    until: 'pre-render-ready',
    checkpointCount: checkpoints.length,
    nextCheckpoint: next?.id ?? null,
    checkpoints,
  };
}

function resolveAuthoringMode({ assessment = null, progress = null } = {}) {
  const candidate = progress?.authoringMode ?? assessment?.authoringMode;
  if (AUTHORING_MODES.has(candidate)) return candidate;
  const decision = progress?.modeDecision ?? progress?.mode ?? assessment?.decision;
  if (decision === 'single_pass') return 'single_pass';
  if (decision === 'checkpoint_required') return 'kernel_then_checkpoint';
  return 'unknown';
}

function git(args, options = {}) {
  return spawnSync('git', args, {
    cwd: options.cwd ?? process.cwd(),
    encoding: 'utf8',
  });
}

function fail(code, message, extra = {}) {
  return {
    ok: false,
    code,
    message,
    ...extra,
  };
}

function ensureGitIdentity() {
  const email = git(['config', 'user.email']);
  const name = git(['config', 'user.name']);
  if (email.status !== 0 || !email.stdout.trim()) git(['config', 'user.email', 'checkpoint-runner@example.invalid']);
  if (name.status !== 0 || !name.stdout.trim()) git(['config', 'user.name', 'Checkpoint Runner']);
}

function stagedPaths() {
  const result = git(['diff', '--cached', '--name-only']);
  if (result.status !== 0) throw new Error(result.stderr || 'git diff --cached failed');
  return result.stdout
    .split(/\r?\n/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function repoRelativePath(filePath) {
  const result = git(['rev-parse', '--show-toplevel']);
  if (result.status !== 0) throw new Error(result.stderr || 'git rev-parse failed');
  return path.relative(result.stdout.trim(), path.resolve(filePath)).replace(/\\/g, '/');
}

function checkpointById(id) {
  return CHECKPOINTS.find((checkpoint) => checkpoint.id === id) ?? null;
}

function latestCommitForFile(sourcePath) {
  const result = git(['log', '-1', '--format=%H', '--', repoRelativePath(sourcePath)]);
  return result.status === 0 ? result.stdout.trim() : '';
}

function latestCheckpointCommitFromGit(sourcePath) {
  const result = git(['log', '-1', '--format=%H%x00%s', '--', repoRelativePath(sourcePath)]);
  if (result.status !== 0 || !result.stdout.trim()) return null;
  const [commitHash, subject = ''] = result.stdout.trim().split('\u0000');
  const checkpoint = CHECKPOINTS.find((item) => subject.includes(item.name));
  if (!checkpoint || !commitHash) return null;
  return {
    id: checkpoint.id,
    commitHash,
    next: nextCheckpointAfter(checkpoint.id),
  };
}

function checkpointIdempotencyKey({ checkpoint, documentHash, commitHash }) {
  return crypto
    .createHash('sha256')
    .update([checkpoint.id, documentHash, commitHash].join('\n'))
    .digest('hex');
}

function findProgressCheckpoint(progress, checkpointId) {
  return (progress?.checkpoints ?? []).find((item) => item.id === checkpointId && item.status === 'passed') ?? null;
}

function updateProgress({ progressPath, sourcePath, checkpoint, commitHash, documentHash, priorProgress, assessment = null }) {
  const previous = priorProgress ?? {};
  const checkpoints = Array.isArray(previous.checkpoints) ? previous.checkpoints.filter((item) => item.id !== checkpoint.id) : [];
  const authoringMode = resolveAuthoringMode({ assessment, progress: previous });
  const entry = {
    id: checkpoint.id,
    name: checkpoint.name,
    status: 'passed',
    commitHash,
    documentHash,
    idempotencyKey: checkpointIdempotencyKey({ checkpoint, documentHash, commitHash }),
    completedAt: new Date().toISOString(),
  };
  const progress = {
    schemaVersion: 'semantic-checkpoint-progress/v1',
    source: normalizePathForReport(sourcePath),
    mode: 'checkpoint_required',
    modeDecision: 'checkpoint_required',
    authoringMode,
    lastCompletedCheckpoint: checkpoint.id,
    currentCheckpoint: nextCheckpointAfter(checkpoint.id),
    lastCommit: commitHash,
    documentHash,
    validation: {
      encoding: 'not_run_by_checkpoint_runner',
      definitionDrilldown: 'not_applicable',
      reverseAudit: 'not_run',
    },
    blockers: [],
    next: nextCheckpointAfter(checkpoint.id),
    checkpoints: [...checkpoints, entry].sort((a, b) => CHECKPOINTS.findIndex((item) => item.id === a.id) - CHECKPOINTS.findIndex((item) => item.id === b.id)),
  };
  writeProgressAtomic(progressPath, progress);
  return progress;
}

function gateIssue(code, message, refs = []) {
  return { code, message, refs: stringList(refs), severity: 'blocker', source: 'pre_render_global_consistency' };
}

function normalizeViewPackList(value) {
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return unique(stringList(value).map((item) => item.trim()));
}

function itemId(item, fallback = '') {
  return String(item?.id ?? item?.artifactId ?? item?.path ?? fallback);
}

function idsFor(items, fallbackPrefix) {
  return new Set(asArray(items).map((item, index) => itemId(item, `${fallbackPrefix}-${index + 1}`)).filter(Boolean));
}

function artifactIds(confirmation) {
  return new Set(
    asArray(confirmation.artifactAutomationPlan)
      .flatMap((artifact) => [artifact.artifactId, artifact.id, artifact.path])
      .filter(Boolean)
      .map(String)
  );
}

function commandIds(confirmation) {
  return new Set(
    [...asArray(confirmation.requiredCommands), ...asArray(confirmation.suggestedCommands)]
      .map((command) => command?.id)
      .filter(Boolean)
      .map(String)
  );
}

function findDuplicateIds(entries) {
  const seen = new Set();
  const duplicates = new Set();
  for (const id of entries.filter(Boolean).map(String)) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates].sort();
}

function checkRequiredArrays(confirmation, issues) {
  const requiredArrays = [
    'must',
    'notDone',
    'mustNot',
    'evidence',
    'failurePaths',
    'edgeCases',
    'traceRows',
    'sequenceViews',
    'flowViews',
    'edgeCaseViews',
    'boundaryViews',
    'artifactAutomationPlan',
    'requiredCommands',
  ];
  for (const field of requiredArrays) {
    if (!Array.isArray(confirmation[field]) || confirmation[field].length === 0) {
      issues.push(gateIssue('global_required_array_missing', `implementationConfirmation.${field} must be a non-empty array`, [field]));
    }
  }
}

function checkDuplicateIds(confirmation, issues) {
  const duplicates = findDuplicateIds([
    ...asArray(confirmation.must).map((item) => item.id),
    ...asArray(confirmation.notDone).map((item) => item.id),
    ...asArray(confirmation.mustNot).map((item) => item.id),
    ...asArray(confirmation.evidence).map((item) => item.id),
    ...asArray(confirmation.failurePaths).map((item) => item.id),
    ...asArray(confirmation.edgeCases).map((item) => item.id),
    ...asArray(confirmation.traceRows).map((item) => item.id),
    ...asArray(confirmation.requiredCommands).map((item) => item.id),
    ...asArray(confirmation.suggestedCommands).map((item) => item.id),
  ]);
  for (const duplicate of duplicates) {
    issues.push(gateIssue('global_duplicate_id', `duplicate implementationConfirmation id ${duplicate}`, [duplicate]));
  }
}

function checkRequirementCoverage(confirmation, sets, issues) {
  const traceRowsByCover = new Map();
  for (const row of asArray(confirmation.traceRows)) {
    for (const coverId of stringList(row.covers)) {
      if (!traceRowsByCover.has(coverId)) traceRowsByCover.set(coverId, []);
      traceRowsByCover.get(coverId).push(row.id);
    }
  }
  for (const requirement of [...asArray(confirmation.must), ...asArray(confirmation.notDone)]) {
    const reqId = itemId(requirement, 'REQ-UNKNOWN');
    const declaredTraceRefs = stringList(requirement.coveredByTraceRows);
    const actualTraceRefs = stringList(traceRowsByCover.get(reqId));
    if (actualTraceRefs.length === 0) {
      issues.push(gateIssue('global_requirement_missing_trace_coverage', `${reqId} must be covered by at least one traceRows[] item`, [reqId]));
    }
    for (const traceRef of declaredTraceRefs) {
      if (!sets.traceIds.has(traceRef)) {
        issues.push(gateIssue('global_requirement_unknown_trace_ref', `${reqId} references unknown trace row ${traceRef}`, [reqId, traceRef]));
      } else if (!actualTraceRefs.includes(traceRef)) {
        issues.push(gateIssue('global_requirement_trace_ref_not_reciprocal', `${reqId} lists ${traceRef}, but that trace row does not cover it`, [reqId, traceRef]));
      }
    }
    const evidenceRefs = stringList(requirement.evidenceRefs);
    if (evidenceRefs.length === 0) {
      issues.push(gateIssue('global_requirement_missing_evidence_ref', `${reqId} must reference at least one evidence row`, [reqId]));
    }
    for (const evidenceRef of evidenceRefs) {
      if (!sets.evidenceIds.has(evidenceRef)) {
        issues.push(gateIssue('global_requirement_unknown_evidence_ref', `${reqId} references unknown evidence ${evidenceRef}`, [reqId, evidenceRef]));
      }
    }
  }
}

function checkTraceRows(confirmation, sets, issues) {
  const executableRequirementIds = new Set([...sets.mustIds, ...sets.negIds]);
  for (const row of asArray(confirmation.traceRows)) {
    const rowId = itemId(row, 'TRACE-UNKNOWN');
    const covers = stringList(row.covers);
    if (covers.length === 0) issues.push(gateIssue('global_trace_missing_cover', `${rowId} must cover at least one MUST or NEG id`, [rowId]));
    for (const coverRef of covers) {
      if (!executableRequirementIds.has(coverRef)) {
        issues.push(gateIssue('global_trace_unknown_cover_ref', `${rowId} covers unknown or non-executable requirement ${coverRef}`, [rowId, coverRef]));
      }
    }
    const evidenceRefs = stringList(row.evidenceRefs);
    if (evidenceRefs.length === 0) issues.push(gateIssue('global_trace_missing_evidence_ref', `${rowId} must reference evidenceRefs[]`, [rowId]));
    for (const evidenceRef of evidenceRefs) {
      if (!sets.evidenceIds.has(evidenceRef)) {
        issues.push(gateIssue('global_trace_unknown_evidence_ref', `${rowId} references unknown evidence ${evidenceRef}`, [rowId, evidenceRef]));
      }
    }
    const contractRefs = stringList(row.contractValidationCommandRefs);
    const deliveryRefs = stringList(row.deliveryEvidenceCommandRefs);
    if (contractRefs.length === 0 || deliveryRefs.length === 0) {
      issues.push(gateIssue('global_trace_missing_split_command_refs', `${rowId} must use contractValidationCommandRefs[] and deliveryEvidenceCommandRefs[]`, [rowId]));
    }
    if (stringList(row.commandRefs).length > 0 && contractRefs.length === 0 && deliveryRefs.length === 0) {
      issues.push(gateIssue('global_trace_legacy_command_refs_only', `${rowId} uses only legacy commandRefs[]`, [rowId]));
    }
    for (const commandRef of [...contractRefs, ...deliveryRefs, ...stringList(row.commandRefs)]) {
      if (!sets.commandIds.has(commandRef)) {
        issues.push(gateIssue('global_command_ref_unknown', `${rowId} references unknown command ${commandRef}`, [rowId, commandRef]));
      }
    }
  }
}

function checkEvidenceAndCommands(confirmation, sets, issues) {
  for (const evidence of asArray(confirmation.evidence)) {
    const evidenceId = itemId(evidence, 'EVD-UNKNOWN');
    if (!String(evidence.gate ?? '').trim() || !String(evidence.oracle ?? '').trim()) {
      issues.push(gateIssue('global_evidence_missing_gate_or_oracle', `${evidenceId} must define both gate and oracle`, [evidenceId]));
    }
    const commandRefs = stringList(evidence.requiredCommandRefs);
    if (commandRefs.length === 0) issues.push(gateIssue('global_evidence_missing_command_ref', `${evidenceId} must define requiredCommandRefs[]`, [evidenceId]));
    for (const commandRef of commandRefs) {
      if (!sets.commandIds.has(commandRef)) {
        issues.push(gateIssue('global_command_ref_unknown', `${evidenceId} references unknown command ${commandRef}`, [evidenceId, commandRef]));
      }
    }
    for (const artifactRef of stringList(evidence.artifactRefs)) {
      if (!sets.artifactIds.has(artifactRef)) {
        issues.push(gateIssue('global_evidence_unknown_artifact_ref', `${evidenceId} references unknown artifact ${artifactRef}`, [evidenceId, artifactRef]));
      }
    }
  }
  for (const commandRef of stringList(confirmation.closeoutReadinessPreview?.requiredCommands)) {
    if (!sets.commandIds.has(commandRef)) {
      issues.push(gateIssue('global_closeout_unknown_command_ref', `closeoutReadinessPreview references unknown command ${commandRef}`, [commandRef]));
    }
  }
}

function checkFailureAndEdgeClosure(confirmation, sets, issues) {
  for (const neg of asArray(confirmation.notDone)) {
    const negId = itemId(neg, 'NEG-UNKNOWN');
    const failureRefs = stringList(neg.coveredByFailurePath);
    if (failureRefs.length === 0) issues.push(gateIssue('global_negative_missing_failure_path', `${negId} must be covered by a failurePath`, [negId]));
    for (const failureRef of failureRefs) {
      if (!sets.failureIds.has(failureRef)) {
        issues.push(gateIssue('global_negative_unknown_failure_path_ref', `${negId} references unknown failurePath ${failureRef}`, [negId, failureRef]));
      }
    }
  }
  for (const failure of asArray(confirmation.failurePaths)) {
    const failureId = itemId(failure, 'FAIL-UNKNOWN');
    for (const negRef of stringList(failure.linkedNegIds)) {
      if (!sets.negIds.has(negRef)) issues.push(gateIssue('global_failure_unknown_neg_ref', `${failureId} references unknown NEG ${negRef}`, [failureId, negRef]));
    }
    for (const evidenceRef of stringList(failure.linkedEvidenceIds)) {
      if (!sets.evidenceIds.has(evidenceRef)) {
        issues.push(gateIssue('global_failure_unknown_evidence_ref', `${failureId} references unknown evidence ${evidenceRef}`, [failureId, evidenceRef]));
      }
    }
    if (stringList(failure.requiredAssertions).length === 0) {
      issues.push(gateIssue('global_failure_missing_required_assertions', `${failureId} must define requiredAssertions[]`, [failureId]));
    }
  }
  for (const edge of asArray(confirmation.edgeCases)) {
    const edgeId = itemId(edge, 'EDGE-UNKNOWN');
    for (const failureRef of stringList(edge.linkedFailurePathIds)) {
      if (!sets.failureIds.has(failureRef)) issues.push(gateIssue('global_edge_unknown_failure_ref', `${edgeId} references unknown failurePath ${failureRef}`, [edgeId, failureRef]));
    }
    for (const evidenceRef of stringList(edge.linkedEvidenceIds)) {
      if (!sets.evidenceIds.has(evidenceRef)) {
        issues.push(gateIssue('global_edge_unknown_evidence_ref', `${edgeId} references unknown evidence ${evidenceRef}`, [edgeId, evidenceRef]));
      }
    }
  }
}

function checkViewRefs(confirmation, sets, issues) {
  const knownCoverIds = new Set([...sets.mustIds, ...sets.negIds, ...sets.outIds, ...sets.evidenceIds, ...sets.traceIds, ...sets.failureIds, ...sets.edgeIds]);
  for (const field of ['sequenceViews', 'flowViews', 'edgeCaseViews', 'boundaryViews']) {
    for (const view of asArray(confirmation[field])) {
      const viewId = itemId(view, `${field}-UNKNOWN`);
      for (const coverRef of stringList(view.covers)) {
        if (!knownCoverIds.has(coverRef)) {
          issues.push(gateIssue('global_view_unknown_cover_ref', `${viewId} covers unknown ID ${coverRef}`, [viewId, coverRef]));
        }
      }
    }
  }
}

function currentTargetApplies(confirmation) {
  return confirmation?.applicability?.currentTargetMap?.applies === true;
}

function currentTargetRequiresCanonicalArtifacts(confirmation) {
  return ['governanceEvents', 'runtimeRecovery', 'scoringDashboardSft', 'scriptsAndHooks'].some(
    (domain) => confirmation?.applicability?.[domain]?.applies === true
  );
}

function currentTargetCoverage(confirmation) {
  const map = confirmation?.currentTargetMap ?? {};
  const countArray = (field) => asArray(map?.[field]).length;
  return {
    currentSummary: countArray('currentSummary'),
    targetSummary: countArray('targetSummary'),
    diffRows: countArray('diffRows'),
    process: countArray('process'),
    artifactPaths: countArray('artifactPaths'),
    canonicalArtifacts: countArray('canonicalArtifacts'),
  };
}

function checkCurrentTargetMapGate(confirmation, issues) {
  if (!currentTargetApplies(confirmation)) return;
  const requiredViewPacks = normalizeViewPackList(confirmation.requiredViewPacks);
  if (!requiredViewPacks.includes(CURRENT_TARGET_REQUIRED_VIEW_PACK)) {
    issues.push(
      gateIssue(
        'global_current_target_required_view_pack_missing',
        'applicability.currentTargetMap.applies=true requires requiredViewPacks[] to include currentTargetMap before HTML render',
        ['applicability.currentTargetMap', 'requiredViewPacks']
      )
    );
  }

  const map = confirmation.currentTargetMap && typeof confirmation.currentTargetMap === 'object' && !Array.isArray(confirmation.currentTargetMap)
    ? confirmation.currentTargetMap
    : {};
  if (map.schemaVersion !== CURRENT_TARGET_SCHEMA_VERSION) {
    issues.push(
      gateIssue(
        'global_current_target_schema_version_missing_or_invalid',
        `applicability.currentTargetMap.applies=true requires currentTargetMap.schemaVersion=${CURRENT_TARGET_SCHEMA_VERSION}`,
        ['currentTargetMap.schemaVersion']
      )
    );
  }
  if (map.displayProfile !== CURRENT_TARGET_DISPLAY_PROFILE) {
    issues.push(
      gateIssue(
        'global_current_target_display_profile_missing_or_invalid',
        `applicability.currentTargetMap.applies=true requires currentTargetMap.displayProfile=${CURRENT_TARGET_DISPLAY_PROFILE}`,
        ['currentTargetMap.displayProfile']
      )
    );
  }

  const coverage = currentTargetCoverage(confirmation);
  const requiredCoverage = { ...CURRENT_TARGET_MINIMUM_COVERAGE };
  if (currentTargetRequiresCanonicalArtifacts(confirmation)) requiredCoverage.canonicalArtifacts = 1;
  const missingCoverage = Object.entries(requiredCoverage)
    .filter(([field, minimum]) => Number(coverage[field] ?? 0) < minimum)
    .map(([field, minimum]) => `${field}:${coverage[field] ?? 0}/${minimum}`);
  if (missingCoverage.length > 0) {
    issues.push(
      gateIssue(
        'global_current_target_required_coverage_insufficient',
        `applicability.currentTargetMap.applies=true requires visible current/target comparison coverage (${missingCoverage.join(', ')})`,
        missingCoverage.map((item) => `currentTargetCoverage.${item}`)
      )
    );
  }
}

function buildPreRenderGlobalConsistencyReport({ sourcePath, progressPath }) {
  const target = path.resolve(sourcePath);
  const reportPath = defaultGlobalGateReportPath(progressPath);
  const issues = [];
  let confirmation = null;
  let sourceDocumentHash = null;
  let implementationConfirmationHash = null;
  try {
    const text = fs.readFileSync(target, 'utf8');
    const extracted = extractImplementationConfirmation(text);
    confirmation = extracted.confirmation;
    sourceDocumentHash = sourceDocumentHashFor(text, extracted.blockText, confirmation);
    implementationConfirmationHash = implementationConfirmationHashFor(confirmation);
  } catch (error) {
    issues.push(gateIssue('global_source_parse_failed', error instanceof Error ? error.message : String(error), [normalizePathForReport(target)]));
  }

  if (confirmation) {
    const sets = {
      mustIds: idsFor(confirmation.must, 'MUST'),
      negIds: idsFor(confirmation.notDone, 'NEG'),
      outIds: idsFor(confirmation.mustNot, 'OUT'),
      evidenceIds: idsFor(confirmation.evidence, 'EVD'),
      traceIds: idsFor(confirmation.traceRows, 'TRACE'),
      failureIds: idsFor(confirmation.failurePaths, 'FAIL'),
      edgeIds: idsFor(confirmation.edgeCases, 'EDGE'),
      commandIds: commandIds(confirmation),
      artifactIds: artifactIds(confirmation),
    };
    checkRequiredArrays(confirmation, issues);
    checkDuplicateIds(confirmation, issues);
    checkRequirementCoverage(confirmation, sets, issues);
    checkTraceRows(confirmation, sets, issues);
    checkEvidenceAndCommands(confirmation, sets, issues);
    checkFailureAndEdgeClosure(confirmation, sets, issues);
    checkViewRefs(confirmation, sets, issues);
    checkCurrentTargetMapGate(confirmation, issues);

    const definitionReport = buildDefinitionReportFromSource({ sourcePath: target, rootDir: process.cwd() });
    for (const finding of asArray(definitionReport.findings).filter((item) => item.severity !== 'warning')) {
      issues.push(gateIssue(`global_${finding.code}`, finding.message, finding.refs));
    }
  }

  return {
    schemaVersion: 'pre-render-global-consistency-gate/v1',
    target: normalizePathForReport(target),
    progressPath: normalizePathForReport(progressPath),
    reportPath: normalizePathForReport(reportPath),
    verdict: issues.length === 0 ? 'PASS' : 'FAIL',
    sourceDocumentHash,
    implementationConfirmationHash,
    issueCount: issues.length,
    failedChecks: unique(issues.map((item) => item.code)).sort(),
    issues,
  };
}

function defaultGlobalGateReportPath(progressPath) {
  return path.join(path.dirname(progressPath), 'pre-render-global-consistency-report.json');
}

function writeJsonFile(filePath, value) {
  writeJsonFileAtomic(filePath, value);
}

function updateProgressWithGlobalGate({ progressPath, gateReport }) {
  const progressRead = readJsonSafe(progressPath);
  const progress = progressRead.ok ? progressRead.value : null;
  if (!progress) return null;
  const updated = {
    ...progress,
    validation: {
      ...(progress.validation ?? {}),
      globalConsistency: gateReport.verdict === 'PASS' ? 'pass' : 'fail',
      definitionDrilldown:
        gateReport.failedChecks.some((code) => code.startsWith('global_definition_')) ? 'fail' : progress.validation?.definitionDrilldown ?? 'not_applicable',
    },
    preRenderGlobalConsistency: {
      verdict: gateReport.verdict,
      reportPath: gateReport.reportPath,
      issueCount: gateReport.issueCount,
      failedChecks: gateReport.failedChecks,
    },
    blockers: gateReport.verdict === 'PASS' ? [] : gateReport.issues,
  };
  writeProgressAtomic(progressPath, updated);
  return updated;
}

function runPreRenderGlobalConsistencyGate({ sourcePath, progressPath }) {
  const report = buildPreRenderGlobalConsistencyReport({ sourcePath, progressPath });
  writeJsonFile(defaultGlobalGateReportPath(progressPath), report);
  const progress = updateProgressWithGlobalGate({ progressPath, gateReport: report });
  return { report, progress };
}

function nextCheckpointAfter(id) {
  const index = CHECKPOINTS.findIndex((checkpoint) => checkpoint.id === id);
  return index >= 0 && index + 1 < CHECKPOINTS.length ? CHECKPOINTS[index + 1].id : null;
}

function checkpointIndex(id) {
  return CHECKPOINTS.findIndex((checkpoint) => checkpoint.id === id);
}

function appendCheckpointExecutionLog({ sourcePath, checkpoint }) {
  const text = fs.readFileSync(sourcePath, 'utf8');
  const heading = '## Automated Semantic Checkpoint Execution Log';
  const entryHeading = `### ${checkpoint.id}`;
  if (text.includes(entryHeading)) return false;
  const prefix = text.endsWith('\n') ? text : `${text}\n`;
  const headingBlock = text.includes(heading) ? '' : `\n${heading}\n\nThis section is maintained by run_semantic_checkpoints.js before HTML render. It does not mark user confirmation or delivery readiness.\n`;
  const entry = `\n${entryHeading}\n\nStatus: passed\n\nValidated sections: ${checkpoint.allowedSections.join(', ')}.\nHTML render: not run by semantic checkpoint runner.\n`;
  fs.writeFileSync(sourcePath, `${prefix}${headingBlock}${entry}`, 'utf8');
  return true;
}

function commitCheckpoint({ sourcePath, checkpointId, progressPath, assessment = null, priorProgressOverride = null }) {
  const checkpoint = checkpointById(checkpointId);
  if (!checkpoint) return fail('unknown_checkpoint', `unknown checkpoint ${checkpointId}`);
  const currentDocumentHash = sha256File(sourcePath);
  const currentCommitHash = latestCommitForFile(sourcePath);
  const priorProgressRead = priorProgressOverride
    ? { ok: true, value: priorProgressOverride }
    : readJsonSafe(progressPath);
  if (!priorProgressRead.ok && !priorProgressRead.missing) {
    return fail('progress_record_unreadable', 'checkpoint progress record is corrupt and cannot be safely updated', {
      progressPath: normalizePathForReport(progressPath),
      error: priorProgressRead.error,
    });
  }
  const priorProgress = priorProgressRead.ok ? priorProgressRead.value : null;
  const existingEntry = findProgressCheckpoint(priorProgress, checkpoint.id);
  const currentIdempotencyKey = checkpointIdempotencyKey({
    checkpoint,
    documentHash: currentDocumentHash,
    commitHash: currentCommitHash,
  });
  if (existingEntry && existingEntry.documentHash === currentDocumentHash && existingEntry.commitHash === currentCommitHash) {
    if (priorProgressOverride) {
      try {
        writeProgressAtomic(progressPath, priorProgress);
      } catch (error) {
        return fail('progress_write_failed', 'checkpoint was already recorded but recovered progress could not be restored', {
          commitHash: currentCommitHash,
          documentHash: currentDocumentHash,
          progressPath: normalizePathForReport(progressPath),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return {
      ok: true,
      checkpoint: checkpoint.id,
      commitHash: currentCommitHash,
      documentHash: currentDocumentHash,
      idempotencyKey: existingEntry.idempotencyKey ?? currentIdempotencyKey,
      progressPath: normalizePathForReport(progressPath),
      progress: priorProgress,
      noOp: true,
      reason: 'checkpoint_already_recorded_for_current_document_and_commit',
    };
  }
  const targetRel = repoRelativePath(sourcePath);
  const existingStaged = stagedPaths();
  if (existingStaged.length) {
    return fail('staged_paths_exist_before_checkpoint', 'staged paths exist before checkpoint commit', {
      stagedPaths: existingStaged,
    });
  }

  const add = git(['add', '-f', '--', targetRel]);
  if (add.status !== 0) return fail('git_add_failed', add.stderr || 'git add failed');
  const staged = stagedPaths();
  if (staged.length !== 1 || staged[0] !== targetRel) {
    return fail('checkpoint_staged_set_not_single_target', 'checkpoint staged set is not exactly the target document', {
      expected: targetRel,
      stagedPaths: staged,
    });
  }

  ensureGitIdentity();
  const commit = git(['commit', '-m', `docs(requirements): 补充${checkpoint.name}`]);
  if (commit.status !== 0) {
    return fail('git_commit_failed', commit.stderr || commit.stdout || 'git commit failed', { stagedPaths: staged });
  }
  const commitHash = latestCommitForFile(sourcePath);
  const documentHash = sha256File(sourcePath);
  let progress;
  try {
    progress = updateProgress({ progressPath, sourcePath, checkpoint, commitHash, documentHash, priorProgress, assessment });
  } catch (error) {
    return fail('progress_write_failed', 'checkpoint commit succeeded but progress write failed; stop before continuing', {
      commitHash,
      documentHash,
      progressPath: normalizePathForReport(progressPath),
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return {
    ok: true,
    checkpoint: checkpoint.id,
    commitHash,
    documentHash,
    progressPath: normalizePathForReport(progressPath),
    progress,
  };
}

function preRenderReadyResult({ sourcePath, progressPath, completedCheckpoints = [], progress = null, progressOverride = null }) {
  if (progressOverride) {
    try {
      writeProgressAtomic(progressPath, progressOverride);
    } catch (error) {
      return fail('progress_write_failed', 'recovered progress could not be restored before pre-render gate', {
        status: 'blocked',
        completedCheckpoints,
        progressPath: normalizePathForReport(progressPath),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const gate = runPreRenderGlobalConsistencyGate({ sourcePath, progressPath });
  if (gate.report.verdict !== 'PASS') {
    return fail('pre_render_global_consistency_failed', 'pre-render global consistency gate failed; HTML render is blocked', {
      status: 'blocked',
      completedCheckpoints,
      nextCheckpoint: null,
      progressPath: normalizePathForReport(progressPath),
      globalConsistencyReportPath: gate.report.reportPath,
      issueCount: gate.report.issueCount,
      failedChecks: gate.report.failedChecks,
      issues: gate.report.issues,
      progress: gate.progress ?? progress,
    });
  }
  return {
    ok: true,
    status: 'pre_render_ready',
    completedCheckpoints,
    nextCheckpoint: null,
    progressPath: normalizePathForReport(progressPath),
    documentHash: sha256File(sourcePath),
    globalConsistencyReportPath: gate.report.reportPath,
    globalConsistency: {
      verdict: gate.report.verdict,
      issueCount: gate.report.issueCount,
      failedChecks: gate.report.failedChecks,
    },
    progress: gate.progress ?? progress,
  };
}

function runCheckpointLoop({ sourcePath, progressPath, startCheckpointId, assessment = null, priorProgressOverride = null }) {
  if (!startCheckpointId) {
    return preRenderReadyResult({
      sourcePath,
      progressPath,
      progress: priorProgressOverride ?? readJsonIfExists(progressPath),
      progressOverride: priorProgressOverride,
    });
  }
  const startIndex = checkpointIndex(startCheckpointId);
  if (startIndex < 0) return fail('unknown_checkpoint', `unknown checkpoint ${startCheckpointId}`);

  const completedCheckpoints = [];
  let progressOverrideForNextCommit = priorProgressOverride;
  for (const checkpoint of CHECKPOINTS.slice(startIndex)) {
    const existingStaged = stagedPaths();
    if (existingStaged.length) {
      return fail('staged_paths_exist_before_checkpoint', 'staged paths exist before checkpoint commit', {
        status: 'blocked',
        failedCheckpoint: checkpoint.id,
        completedCheckpoints,
        stagedPaths: existingStaged,
      });
    }
    appendCheckpointExecutionLog({ sourcePath, checkpoint });
    const result = commitCheckpoint({
      sourcePath,
      checkpointId: checkpoint.id,
      progressPath,
      assessment,
      priorProgressOverride: progressOverrideForNextCommit,
    });
    progressOverrideForNextCommit = null;
    if (!result.ok) {
      return {
        ...result,
        status: 'blocked',
        failedCheckpoint: checkpoint.id,
        completedCheckpoints,
      };
    }
    completedCheckpoints.push({
      checkpoint: result.checkpoint,
      commitHash: result.commitHash,
      documentHash: result.documentHash,
    });
  }

  return preRenderReadyResult({
    sourcePath,
    progressPath,
    completedCheckpoints,
    progress: readJsonIfExists(progressPath),
  });
}

function resumeStatus({ sourcePath, progressPath }) {
  const progressRead = readJsonSafe(progressPath);
  let recoveredFrom = null;
  let progress = progressRead.ok ? progressRead.value : null;
  if (!progressRead.ok && !progressRead.missing) {
    const backupRead = readJsonSafe(backupProgressPath(progressPath));
    if (backupRead.ok) {
      progress = backupRead.value;
      recoveredFrom = 'backup';
    } else {
      const gitCheckpoint = latestCheckpointCommitFromGit(sourcePath);
      if (gitCheckpoint) {
        const documentHash = sha256File(sourcePath);
        progress = {
          schemaVersion: 'semantic-checkpoint-progress/v1',
          source: normalizePathForReport(sourcePath),
          mode: 'checkpoint_required',
          modeDecision: 'checkpoint_required',
          authoringMode: 'kernel_then_checkpoint',
          lastCompletedCheckpoint: gitCheckpoint.id,
          currentCheckpoint: gitCheckpoint.next,
          lastCommit: gitCheckpoint.commitHash,
          documentHash,
          validation: {
            encoding: 'not_run_by_checkpoint_runner',
            definitionDrilldown: 'not_applicable',
            reverseAudit: 'not_run',
          },
          blockers: [],
          next: gitCheckpoint.next,
          recoveredFrom: 'git_checkpoint',
          checkpoints: [
            {
              id: gitCheckpoint.id,
              name: checkpointById(gitCheckpoint.id)?.name ?? gitCheckpoint.id,
              status: 'passed',
              commitHash: gitCheckpoint.commitHash,
              documentHash,
              idempotencyKey: checkpointIdempotencyKey({
                checkpoint: checkpointById(gitCheckpoint.id),
                documentHash,
                commitHash: gitCheckpoint.commitHash,
              }),
              completedAt: null,
              recovered: true,
            },
          ],
        };
        recoveredFrom = 'git_checkpoint';
      } else {
        return fail('progress_record_unreadable', 'checkpoint progress record is corrupt and no backup or git checkpoint could recover it', {
          progressPath: normalizePathForReport(progressPath),
          error: progressRead.error,
        });
      }
    }
  }
  if (!progress) {
    return {
      ok: true,
      status: 'no_progress',
      nextCheckpoint: CHECKPOINTS[0].id,
      progressPath: normalizePathForReport(progressPath),
    };
  }
  const currentHash = sha256File(sourcePath);
  if (progress.documentHash && progress.documentHash !== currentHash) {
    return fail('document_hash_mismatch', 'current document hash differs from progress record', {
      progressHash: progress.documentHash,
      currentHash,
      nextCheckpoint: progress.next ?? progress.currentCheckpoint,
    });
  }
  return {
    ok: true,
    status: 'ready',
    nextCheckpoint: progress.next ?? progress.currentCheckpoint,
    progressPath: normalizePathForReport(progressPath),
    documentHash: currentHash,
    authoringMode: resolveAuthoringMode({ progress }),
    recoveredFrom,
    progress,
  };
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.error) {
    console.error(JSON.stringify({ verdict: 'FAIL', message: args.error }, null, 2));
    return 2;
  }
  const sourcePath = path.resolve(args.source);
  if (!fs.existsSync(sourcePath)) {
    console.error(JSON.stringify({ verdict: 'FAIL', message: 'source document file not found' }, null, 2));
    return 1;
  }
  const progressPath = path.resolve(args.progress || defaultProgressPath(sourcePath));
  const assessment = args.assessment ? readJsonIfExists(args.assessment) : buildAssessment(sourcePath, progressPath);
  const progressRead = readJsonSafe(progressPath);
  let progress = progressRead.ok ? progressRead.value : null;
  let recoveredStatus = null;
  if (!progressRead.ok && !progressRead.missing) {
    recoveredStatus = resumeStatus({ sourcePath, progressPath });
    if (!recoveredStatus.ok) {
      process.stdout.write(`${JSON.stringify(recoveredStatus, null, 2)}\n`);
      return 1;
    }
    progress = recoveredStatus.progress ?? null;
  }
  if (args.mode === 'plan') {
    const plan = buildPlan({ sourcePath, assessment, progress });
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    return 0;
  }
  if (args.mode === 'status') {
    const status = resumeStatus({ sourcePath, progressPath });
    process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
    return status.ok ? 0 : 1;
  }
  if (args.mode === 'pre-render-gate') {
    const gate = runPreRenderGlobalConsistencyGate({ sourcePath, progressPath });
    process.stdout.write(`${JSON.stringify(gate.report, null, 2)}\n`);
    return gate.report.verdict === 'PASS' ? 0 : 1;
  }
  if (args.mode === 'resume') {
    const status = resumeStatus({ sourcePath, progressPath });
    if (!status.ok) {
      process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
      return 1;
    }
    const checkpointId = args.checkpoint || status.nextCheckpoint;
    const result = args.checkpoint
      ? commitCheckpoint({ sourcePath, checkpointId, progressPath, assessment, priorProgressOverride: status.progress ?? null })
      : runCheckpointLoop({
          sourcePath,
          progressPath,
          startCheckpointId: checkpointId,
          assessment,
          priorProgressOverride: status.progress ?? null,
        });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result.ok ? 0 : 1;
  }
  const plan = buildPlan({ sourcePath, assessment, progress });
  const checkpointId = args.checkpoint || recoveredStatus?.nextCheckpoint || plan.nextCheckpoint || CHECKPOINTS[0].id;
  const result = args.checkpoint
    ? commitCheckpoint({ sourcePath, checkpointId, progressPath, assessment, priorProgressOverride: recoveredStatus?.progress ?? null })
    : runCheckpointLoop({
        sourcePath,
        progressPath,
        startCheckpointId: checkpointId,
        assessment,
        priorProgressOverride: recoveredStatus?.progress ?? null,
      });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result.ok ? 0 : 1;
}

module.exports = {
  CHECKPOINTS,
  buildPlan,
  commitCheckpoint,
  defaultAuthoringRuntimeDir,
  defaultProgressPath,
  parseArgs,
  runCheckpointLoop,
  resumeStatus,
};

if (require.main === module) process.exit(main(process.argv.slice(2)));
