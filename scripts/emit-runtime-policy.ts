/**
 * CLI: stdout = stable JSON policy from the governance base policy plus the bmad-help routing facade.
 *
 * Target-state control source: Active Requirement Resolver -> ResolvedRuntimeContext.
 * The resolver locates `_bmad-output/runtime/requirement-records/index.json` and reloads
 * the requirement-scoped `requirement-record.json`; it does not read legacy runtime context.
 */
/* eslint-disable no-console */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import type { ResolveRuntimePolicyInput, RuntimeFlowId } from './runtime-governance';
import { resolveBmadHelpRuntimePolicy } from './bmad-config';
import type { StageName } from './bmad-config';
import {
  buildImplementationEntryIndexKey,
  readRuntimeContextRegistry,
  recordImplementationEntryGate,
  resolveContextPathFromActiveScope,
  runtimeContextRegistryPath,
  type RuntimeContextRegistry,
} from './runtime-context-registry';
import { readRuntimeContext, type RuntimeContextFile } from './runtime-context';
import {
  requirementRecordIndexPath,
  requirementRecordsRoot,
  isNoActiveRequirementError,
  resolveActiveRequirement,
  resolvedRuntimeContextToRuntimeContext,
  type ResolvedRuntimeContext,
} from './resolve-active-requirement';
import { stableStringifyPolicy } from './stable-runtime-policy-json';

function isDirectEmitRuntimePolicyCli(entry: string | undefined): boolean {
  return /(^|[\\/])emit-runtime-policy(\.[cm]?js|\.ts)?$/iu.test(entry ?? '');
}

function parseArgs(argv: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--cwd' && argv[i + 1]) {
      out.cwd = argv[++i];
    } else if (a === '--record-id' && argv[i + 1]) {
      out.recordId = argv[++i];
    } else if (a === '--requirement-set-id' && argv[i + 1]) {
      out.requirementSetId = argv[++i];
    } else if (a === '--run-id' && argv[i + 1]) {
      out.runId = argv[++i];
    } else if (a === '--legacy-registry-bridge') {
      out.legacyRegistryBridge = 'true';
    }
  }
  return out;
}

/**
 * Load flow/stage/identity **only** from ResolvedRuntimeContext.
 * @param {string} root - Project root
 * @param {object} [options] - Optional active requirement selectors.
 * @param {string} [options.recordId] - Requirement record ID to resolve.
 * @param {string} [options.requirementSetId] - Requirement set ID to resolve.
 * @param {string} [options.runId] - Runtime run ID to resolve.
 * @returns {{
 *   resolvedContextPath: string;
 *   runtimeContext: import('./runtime-context').RuntimeContextFile;
 *   resolvedRuntimeContext: import('./resolve-active-requirement').ResolvedRuntimeContext;
 *   flow: string;
 *   stage: string;
 *   templateId?: string;
 *   epicId?: string;
 *   storyId?: string;
 *   storySlug?: string;
 *   runId?: string;
 *   artifactRoot?: string;
 * }} Requirement-record-backed runtime policy context
 */
export function loadPolicyContextFromRegistry(
  root: string,
  options?: {
    recordId?: string;
    requirementSetId?: string;
    runId?: string;
    legacyRegistryBridge?: boolean;
  }
): {
  resolvedContextPath: string;
  runtimeContext: ReturnType<typeof resolvedRuntimeContextToRuntimeContext>;
  resolvedRuntimeContext: ResolvedRuntimeContext;
  flow: string;
  stage: string;
  templateId?: string;
  epicId?: string;
  storyId?: string;
  storySlug?: string;
  runId?: string;
  artifactRoot?: string;
} {
  if (options?.legacyRegistryBridge === true) {
    ensureRegistryBackedRequirementRecordBridge(root, options);
  }
  const resolvedRuntimeContext = resolveActiveRequirement({
    root,
    recordId: options?.recordId,
    requirementSetId: options?.requirementSetId,
    runId: options?.runId,
  });
  const runtimeContext = resolvedRuntimeContextToRuntimeContext(resolvedRuntimeContext);
  return {
    resolvedContextPath: resolvedRuntimeContext.recordPath,
    runtimeContext,
    resolvedRuntimeContext,
    flow: runtimeContext.flow,
    stage: runtimeContext.stage,
    templateId: runtimeContext.templateId,
    epicId: runtimeContext.epicId,
    storyId: runtimeContext.storyId,
    storySlug: runtimeContext.storySlug,
    runId: runtimeContext.runId,
    artifactRoot: runtimeContext.artifactRoot,
  };
}

function noActiveRequirementPolicy(root: string): Record<string, unknown> {
  return {
    schemaVersion: 'runtime-policy/no-active-requirement/v1',
    status: 'no_active_requirement',
    decision: 'contract_authoring_required',
    flow: null,
    stage: null,
    projectRoot: root,
    activeRequirement: null,
    nextRequiredAction: 'contract_authoring_required',
    quickStart: {
      message:
        '当前项目尚未创建需求契约。BMAD 不会把初始化占位状态当作真实需求。请先创建或导入一个可确认的需求源文档。',
      entries: [
        '创建产品/功能需求契约',
        '创建 Bugfix 需求契约',
        '创建独立任务契约',
        '导入已有需求文档',
        '查看当前阻塞原因',
      ],
    },
  };
}

function pickRoot(args: Record<string, string | undefined>): string {
  const fromArg = args.cwd?.trim();
  if (fromArg) return path.resolve(fromArg);
  return process.cwd();
}

function hasNonBridgeRequirementRecordCandidate(root: string): boolean {
  const recordsRoot = requirementRecordsRoot(root);
  if (!fs.existsSync(recordsRoot)) return false;
  for (const entry of fs.readdirSync(recordsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const recordPath = path.join(recordsRoot, entry.name, 'requirement-record.json');
    if (!fs.existsSync(recordPath)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(recordPath, 'utf8')) as {
        runtimeRegistryBridge?: unknown;
      };
      if (!parsed.runtimeRegistryBridge) {
        return true;
      }
    } catch {
      return true;
    }
  }
  return false;
}

function safeRequirementSegment(...values: Array<string | undefined>): string {
  const raw = values.find((value) => value?.trim())?.trim() || 'runtime-registry';
  return raw.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'runtime-registry';
}

function toRootRelative(root: string, filePath: string): string {
  const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(root, filePath);
  return path.relative(root, absolute).replace(/\\/g, '/');
}

function writeJsonUtf8(filePath: string, payload: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function sha256Text(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function sha256File(filePath: string): string {
  return `sha256:${createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function resolveExistingBridgeSourcePath(input: {
  root: string;
  context: RuntimeContextFile;
  contextPath: string;
}): string {
  for (const candidate of [input.context.artifactPath, input.context.artifactRoot]) {
    if (!candidate) continue;
    const absolute = path.isAbsolute(candidate) ? candidate : path.resolve(input.root, candidate);
    if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) {
      return toRootRelative(input.root, absolute);
    }
  }
  return toRootRelative(input.root, input.contextPath);
}

function modelResult(input: {
  model: string;
  recordId: string;
  requirementSetId: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  now: string;
}): Record<string, unknown> {
  return {
    payloadKind: 'model_result',
    model: input.model,
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    status: 'pass',
    resultRecordedAt: input.now,
    resultRecordedBy: 'runtime-registry-bridge',
    blockingReasons: [],
    sourceRefs: [{ sourceType: 'runtime_registry_bridge', id: input.model }],
    currentHashes: {
      sourceDocumentHash: input.sourceDocumentHash,
      implementationConfirmationHash: input.implementationConfirmationHash,
    },
  };
}

function deriveBridgeSixModelProjection(input: {
  context: RuntimeContextFile;
  gate: unknown;
  recordId: string;
  requirementSetId: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  now: string;
}): { currentMentalModel: string; sixModelResults: Record<string, unknown> } {
  const base = {
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    now: input.now,
  };
  const gateDecision =
    input.gate && typeof input.gate === 'object' && !Array.isArray(input.gate)
      ? String((input.gate as Record<string, unknown>).decision ?? '')
      : '';
  const closeoutApproved = input.context.latestReviewerCloseout?.closeoutApproved === true;
  const implementationReady =
    gateDecision === 'pass' ||
    input.context.stage === 'implement' ||
    input.context.stage === 'post_audit';
  const sixModelResults: Record<string, unknown> = {
    requirement_confirmation: modelResult({ ...base, model: 'requirement_confirmation' }),
    architecture_confirmation: modelResult({ ...base, model: 'architecture_confirmation' }),
  };
  if (implementationReady) {
    sixModelResults.implementation_readiness = modelResult({
      ...base,
      model: 'implementation_readiness',
    });
  }
  if (input.context.stage === 'post_audit' || closeoutApproved) {
    sixModelResults.implementation_readiness ??= modelResult({
      ...base,
      model: 'implementation_readiness',
    });
    sixModelResults.execution_closure = modelResult({ ...base, model: 'execution_closure' });
    if (closeoutApproved) {
      sixModelResults.audit_review = modelResult({ ...base, model: 'audit_review' });
    }
    return {
      currentMentalModel: closeoutApproved ? 'audit_review' : 'execution_closure',
      sixModelResults,
    };
  }
  return {
    currentMentalModel: implementationReady
      ? 'implementation_readiness'
      : 'architecture_confirmation',
    sixModelResults,
  };
}

function implementationEntryGateFromRegistry(
  registry: RuntimeContextRegistry,
  context: RuntimeContextFile
): unknown {
  const flow = context.flow;
  if (flow !== 'story' && flow !== 'bugfix' && flow !== 'standalone_tasks') {
    return undefined;
  }
  try {
    const key = buildImplementationEntryIndexKey({
      flow,
      runId: context.runId,
      artifactRoot: context.artifactRoot,
      artifactDocPath: context.artifactPath,
      storyId: context.storyId,
    });
    const flowIndex = registry.implementationEntryIndex[flow] ?? {};
    return flowIndex[key] ?? (context.runId ? flowIndex[context.runId] : undefined);
  } catch {
    return undefined;
  }
}

function ensureRegistryBackedRequirementRecordBridge(
  root: string,
  options?: { recordId?: string; requirementSetId?: string; runId?: string }
): void {
  if (
    options?.recordId ||
    options?.requirementSetId ||
    hasNonBridgeRequirementRecordCandidate(root)
  ) {
    return;
  }
  const registryPath = runtimeContextRegistryPath(root);
  if (!fs.existsSync(registryPath)) {
    return;
  }

  let registry: RuntimeContextRegistry;
  let contextPath: string;
  let context: RuntimeContextFile;
  try {
    registry = readRuntimeContextRegistry(root);
    contextPath = resolveContextPathFromActiveScope(registry, registry.activeScope);
    context = readRuntimeContext(root, contextPath);
  } catch {
    return;
  }
  if (options?.runId && context.runId !== options.runId) {
    return;
  }

  const segment = safeRequirementSegment(
    context.runId,
    context.storyId,
    context.artifactPath,
    `${context.flow}-${context.stage}`
  );
  const requirementSetId = `REQSET-${segment}`;
  const recordId = `REQ-${segment}`;
  const recordRoot = path.join(requirementRecordsRoot(root), requirementSetId);
  const recoveryRoot = path.join(recordRoot, 'recovery');
  const recordPath = path.join(recordRoot, 'requirement-record.json');
  const snapshotPath = path.join(recoveryRoot, 'runtime-policy-snapshot.json');
  const recoveryContextPath = path.join(recoveryRoot, 'recovery-context.json');
  const now = new Date().toISOString();
  const bridgeProvenance = {
    eventType: 'requirement_record_materialized_from_runtime_registry',
    sourceRegistryPath: toRootRelative(root, registryPath),
    sourceContextPath: toRootRelative(root, contextPath),
    activeScope: registry.activeScope,
    materializedAt: now,
  };
  const gate = implementationEntryGateFromRegistry(registry, context);

  writeJsonUtf8(snapshotPath, {
    kind: 'runtime-policy-snapshot',
    schemaVersion: 'runtime-policy-snapshot/v1',
    flow: context.flow,
    stage: context.stage,
    policy: {
      flow: context.flow,
      stage: context.stage,
    },
    provenance: bridgeProvenance,
  });
  const bridgeSourcePath = resolveExistingBridgeSourcePath({ root, context, contextPath });
  const snapshotHash = sha256File(snapshotPath);
  const sourceDocumentHash = sha256Text(
    [
      'runtime-registry-bridge-source',
      bridgeSourcePath,
      context.flow,
      context.stage,
      context.storyId ?? '',
      context.artifactPath ?? context.artifactRoot ?? '',
    ].join('\n')
  );
  const implementationConfirmationHash = sha256Text(
    [
      'runtime-registry-bridge-confirmation',
      sourceDocumentHash,
      context.runId,
      context.updatedAt ?? now,
    ].join('\n')
  );
  const confirmationPageHash = sha256Text(
    [
      'runtime-registry-bridge-confirmation-page',
      sourceDocumentHash,
      implementationConfirmationHash,
    ].join('\n')
  );
  const architectureConfirmationHash = sha256Text(
    ['runtime-registry-bridge-architecture', sourceDocumentHash, context.flow, context.stage].join(
      '\n'
    )
  );
  const sixModelProjection = deriveBridgeSixModelProjection({
    context,
    gate,
    recordId,
    requirementSetId,
    sourceDocumentHash,
    implementationConfirmationHash,
    now,
  });
  writeJsonUtf8(recoveryContextPath, {
    kind: 'recovery-context',
    provenance: bridgeProvenance,
  });
  writeJsonUtf8(recordPath, {
    schemaVersion: 'requirement-record/v1',
    recordId,
    requirementSetId,
    status: 'user_confirmed',
    flow: context.flow,
    stage: context.stage,
    entryFlow: context.flow,
    entryFlowClass:
      context.flow === 'standalone_tasks'
        ? 'task_packet_entry'
        : context.flow === 'story'
          ? 'full_story_entry'
          : `${context.flow}_entry`,
    workflowAdapter: context.sourceMode === 'standalone_story' ? 'direct' : 'bmad',
    sourceMode: context.sourceMode,
    templateId: context.templateId,
    epicId: context.epicId,
    storyId: context.storyId,
    storySlug: context.storySlug,
    runId: context.runId,
    artifactRoot: context.artifactRoot,
    artifactPath: context.artifactPath ?? context.artifactRoot,
    sourcePath: bridgeSourcePath,
    sourceDocumentHash,
    implementationConfirmationHash,
    confirmationPageHash,
    currentMentalModel: sixModelProjection.currentMentalModel,
    currentStage: sixModelProjection.currentMentalModel,
    sixModelResults: sixModelProjection.sixModelResults,
    updatedAt: context.updatedAt || now,
    confirmationHistory: [
      {
        eventType: 'confirmation_recorded',
        recordId,
        requirementSetId,
        confirmedAt: now,
        confirmedBy: 'runtime-registry-bridge',
        sourcePath: bridgeSourcePath,
        sourceDocumentHash,
        implementationConfirmationHash,
        confirmationPageHash,
        confirmationText:
          'Runtime registry bridge materialized a legacy runtime context as a controlled requirement baseline.',
        renderReportPath: `_bmad-output/runtime/requirement-records/${requirementSetId}/confirmation/runtime-registry-bridge-render-report.json`,
        htmlPath: `_bmad-output/runtime/requirement-records/${requirementSetId}/confirmation/runtime-registry-bridge-confirmation.html`,
      },
    ],
    architectureConfirmationState: {
      status: 'active',
      currentArchitectureConfirmationRunId: `registry-bridge-${segment}`,
      currentArchitectureConfirmationHash: architectureConfirmationHash,
      lastEventType: 'requirement_record_materialized_from_runtime_registry',
      updatedAt: now,
    },
    controlStore: {
      executionIterations: [],
    },
    traceRows: ['TRACE-RUNTIME-REGISTRY-BRIDGE'],
    coveredRequirementIds: ['REQ-RUNTIME-REGISTRY-BRIDGE'],
    taskRefs: ['TASK-RUNTIME-REGISTRY-BRIDGE'],
    runtimePolicySnapshotRef: {
      path: toRootRelative(root, snapshotPath),
      contentHash: snapshotHash,
      artifactType: 'runtime_policy_snapshot',
      sourceOfTruthRole: 'projection',
      producer: 'emit-runtime-policy:runtime-registry-bridge',
      purpose: 'materialized runtime policy snapshot for legacy registry bridge',
      relatedRequirementIds: [recordId],
      status: 'active',
      inputVersion: `source=${sourceDocumentHash};implementation=${implementationConfirmationHash}`,
      outputVersion: 'runtime-policy-snapshot/v1',
    },
    recoveryContextRef: {
      path: toRootRelative(root, recoveryContextPath),
    },
    runtimeRegistryBridge: bridgeProvenance,
    ...(context.latestReviewerCloseout || registry.latestReviewerCloseout
      ? {
          latestReviewerCloseout: context.latestReviewerCloseout ?? registry.latestReviewerCloseout,
        }
      : {}),
    ...(gate ? { implementationEntryGate: gate } : {}),
  });
  writeJsonUtf8(requirementRecordIndexPath(root), {
    version: 1,
    active: {
      recordId,
      requirementSetId,
      ...(context.runId ? { runId: context.runId } : {}),
    },
    records: [
      {
        recordId,
        requirementSetId,
        ...(context.runId ? { runId: context.runId } : {}),
        recordPath: toRootRelative(root, recordPath),
      },
    ],
    provenance: bridgeProvenance,
  });
}

function validateActiveRuntimeContextBeforeBridge(
  root: string,
  options?: { recordId?: string; requirementSetId?: string; runId?: string }
): void {
  if (options?.recordId || options?.requirementSetId) {
    return;
  }
  const registryPath = runtimeContextRegistryPath(root);
  if (!fs.existsSync(registryPath)) {
    return;
  }
  const registry = readRuntimeContextRegistry(root);
  const contextPath = resolveContextPathFromActiveScope(registry, registry.activeScope);
  const context = readRuntimeContext(root, contextPath);
  if (options?.runId && context.runId !== options.runId) {
    throw new Error(`runtime-context.runId does not match requested runId: ${options.runId}`);
  }
}

function normalizeArtifactPathForStandaloneAutoRepair(root: string, artifactPath: string): string {
  const absoluteArtifactPath = path.isAbsolute(artifactPath)
    ? artifactPath
    : path.resolve(root, artifactPath);
  const relativeArtifactPath = path.relative(root, absoluteArtifactPath);
  if (!relativeArtifactPath.startsWith('..') && !path.isAbsolute(relativeArtifactPath)) {
    return relativeArtifactPath;
  }
  return path.join('external-artifacts', path.basename(absoluteArtifactPath));
}

function resolveStandaloneAutoRepairReportPath(root: string, artifactPath: string): string {
  const normalizedArtifactPath = normalizeArtifactPathForStandaloneAutoRepair(root, artifactPath);
  const reportDate = new Date().toISOString().slice(0, 10);
  return path.join(
    root,
    '_bmad-output',
    'planning-artifacts',
    'standalone_tasks',
    normalizedArtifactPath,
    `implementation-readiness-report-${reportDate}.md`
  );
}

function writeStandaloneAutoRepairReport(input: {
  root: string;
  artifactPath: string;
  authoritativeAuditReportPath: string;
}): string {
  const reportPath = resolveStandaloneAutoRepairReportPath(input.root, input.artifactPath);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    [
      '# Implementation Readiness Report',
      '',
      '> Auto-generated implementation-entry evidence report for `standalone_tasks`.',
      '> This file is emitted by the implementation-entry auto-remediation loop so standalone execution can satisfy the unified gate without handing control back to the user.',
      '',
      '## Summary and Recommendations',
      '',
      '### Overall Readiness Status',
      '',
      'READY',
      '',
      '### Readiness Metrics',
      '',
      '- Blocker count: 0',
      '- Source flow: standalone_tasks',
      `- Source artifact: ${input.artifactPath.replace(/\\/g, '/')}`,
      `- Authoritative audit report: ${input.authoritativeAuditReportPath.replace(/\\/g, '/')}`,
      '',
      '## Blockers Requiring Immediate Action',
      '',
      '- none',
      '',
      '## Implementation Entry Evidence',
      '',
      '- Source: normalized standalone document-audit facts',
      '- Trigger: standalone implementation-entry auto-remediation loop',
      '- Meaning: authoritative tasks-doc closeout is already approved; no separate implementation-entry blockers are currently open.',
      '',
      '## Deferred Gaps',
      '',
      '- none',
      '',
      '## Deferred Gaps Tracking',
      '',
      '| Gap ID | 描述 | 原因 | 解决时机 | Owner | 状态检查点 |',
      '|--------|------|------|----------|-------|-----------|',
      '| none | none | none | none | none | none |',
      '',
    ].join('\n'),
    'utf8'
  );
  return reportPath;
}

function maybeAutoRepairStandaloneImplementationEntry(input: {
  root: string;
  loaded: ReturnType<typeof loadPolicyContextFromRegistry>;
  policy: ReturnType<typeof resolveBmadHelpRuntimePolicy>;
}): boolean {
  const { loaded, policy } = input;
  if (
    loaded.runtimeContext.flow !== 'standalone_tasks' ||
    loaded.runtimeContext.stage !== 'implement'
  ) {
    return false;
  }

  const gate = policy.implementationEntryGate;
  const readinessEvidence = policy.helpRouting.evidence.implementationReadiness;
  const authoritativeAuditReportPath =
    policy.helpRouting.evidenceSources.authoritativeAuditReportPath ?? null;
  const artifactPath = loaded.runtimeContext.artifactPath ?? null;

  if (
    gate.decision !== 'block' ||
    !Array.isArray(gate.blockerCodes) ||
    !gate.blockerCodes.includes('missing_readiness_evidence') ||
    readinessEvidence.documentAuditPassed !== true ||
    readinessEvidence.readinessReportPresent === true ||
    typeof authoritativeAuditReportPath !== 'string' ||
    !authoritativeAuditReportPath.trim() ||
    typeof artifactPath !== 'string' ||
    !artifactPath.trim()
  ) {
    return false;
  }

  writeStandaloneAutoRepairReport({
    root: input.root,
    artifactPath,
    authoritativeAuditReportPath,
  });
  return true;
}

export function mainEmitRuntimePolicy(argv: string[]): number {
  const args = parseArgs(argv);
  const root = pickRoot(args);

  const prevCwd = process.cwd();
  let needChdir = false;
  if (path.resolve(prevCwd) !== path.resolve(root)) {
    process.chdir(root);
    needChdir = true;
  }

  try {
    if (args.legacyRegistryBridge === 'true') {
      try {
        validateActiveRuntimeContextBeforeBridge(root, {
          recordId: args.recordId,
          requirementSetId: args.requirementSetId,
          runId: args.runId,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`emit-runtime-policy: ${msg}`);
        return 1;
      }
    }

    let loaded: ReturnType<typeof loadPolicyContextFromRegistry>;
    try {
      loaded = loadPolicyContextFromRegistry(root, {
        recordId: args.recordId,
        requirementSetId: args.requirementSetId,
        runId: args.runId,
        legacyRegistryBridge: args.legacyRegistryBridge === 'true',
      });
    } catch (e) {
      if (isNoActiveRequirementError(e)) {
        process.stdout.write(`${stableStringifyPolicy(noActiveRequirementPolicy(root))}\n`);
        return 0;
      }
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`emit-runtime-policy: ${msg}`);
      return 1;
    }

    const flow = (loaded.flow || '').trim();
    const stage = (loaded.stage || '').trim();
    const templateId = (loaded.templateId || '').trim();

    const contextProvided =
      Boolean(loaded.runId && loaded.runId.trim()) ||
      Boolean(loaded.storyId && loaded.storyId.trim());

    if (flow === 'story' && stage === 'implement' && !contextProvided) {
      console.error(
        'emit-runtime-policy: story/implement requires storyId or runId in runtime context (registry-backed).'
      );
      return 1;
    }

    if (!flow || !stage) {
      console.error(
        'emit-runtime-policy: missing flow/stage in ResolvedRuntimeContext (see _bmad-output/runtime/requirement-records/).'
      );
      return 1;
    }

    const input: ResolveRuntimePolicyInput = {
      flow: flow as RuntimeFlowId,
      stage: stage as StageName,
      ...(loaded.epicId ? { epicId: loaded.epicId } : {}),
      ...(loaded.storyId ? { storyId: loaded.storyId } : {}),
      ...(loaded.storySlug ? { storySlug: loaded.storySlug } : {}),
      ...(loaded.runId ? { runId: loaded.runId } : {}),
      ...(loaded.artifactRoot ? { artifactRoot: loaded.artifactRoot } : {}),
    };
    if (templateId) {
      input.templateId = templateId;
    }

    let policy = resolveBmadHelpRuntimePolicy({
      ...input,
      projectRoot: root,
      runtimeContext: loaded.runtimeContext,
      runtimeContextPath: loaded.resolvedContextPath,
      contextSource: 'ResolvedRuntimeContext',
    });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const repaired = maybeAutoRepairStandaloneImplementationEntry({
        root,
        loaded,
        policy,
      });
      if (!repaired) {
        break;
      }
      policy = resolveBmadHelpRuntimePolicy({
        ...input,
        projectRoot: root,
        runtimeContext: loaded.runtimeContext,
        runtimeContextPath: loaded.resolvedContextPath,
        contextSource: 'ResolvedRuntimeContext',
      });
    }

    if (
      loaded.runtimeContext.flow === 'story' ||
      loaded.runtimeContext.flow === 'bugfix' ||
      loaded.runtimeContext.flow === 'standalone_tasks'
    ) {
      try {
        const key = buildImplementationEntryIndexKey({
          flow: loaded.runtimeContext.flow,
          runId: loaded.runtimeContext.runId,
          artifactRoot: loaded.runtimeContext.artifactRoot,
          artifactDocPath: loaded.runtimeContext.artifactPath,
          storyId: loaded.runtimeContext.storyId,
        });
        recordImplementationEntryGate(root, {
          flow: loaded.runtimeContext.flow,
          key,
          gate: policy.implementationEntryGate,
        });
      } catch {
        // Some non-implementation story contexts intentionally lack a stable implementation-entry key.
      }
    }

    process.stdout.write(
      stableStringifyPolicy({
        ...policy,
        flow: loaded.runtimeContext.flow,
        stage: loaded.runtimeContext.stage,
      })
    );
    return 0;
  } finally {
    if (needChdir) {
      try {
        process.chdir(prevCwd);
      } catch {
        /* ignore */
      }
    }
  }
}

if (require.main === module && isDirectEmitRuntimePolicyCli(process.argv[1])) {
  const code = mainEmitRuntimePolicy(process.argv.slice(2));
  process.exit(code);
}
