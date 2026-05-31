/* eslint-disable no-console */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import type {
  ExecutionPacket,
  RecommendationPacket,
  ResumePacket,
  TaskReport,
} from './orchestration-dispatch-contract';
import { resolveBmadHelpRuntimePolicy } from './bmad-config';
import type { StageName } from './bmad-config';
import { loadPolicyContextFromRegistry } from './emit-runtime-policy';
import type { ImplementationEntryGate, RuntimeFlowId } from './runtime-governance';
import { stableStringifyPolicy } from './stable-runtime-policy-json';
import { resolveMainAgentOrchestrationSurface } from './main-agent-orchestration';
import {
  governanceEventTypeRegistryPolicyHash,
  governanceEventTypeRegistryHash,
  validateGovernanceTransportEnvelope,
  type GovernanceTransportEnvelope,
} from './governance-transport-envelope';
import {
  artifactRefForPath,
  buildSubagentEvidenceEnvelopeFromTaskReport,
  sha256Object,
  validateSubagentEvidenceEnvelope,
  type SubagentEvidenceEnvelopeValidation,
} from './subagent-evidence-envelope';

type Packet = ExecutionPacket | RecommendationPacket | ResumePacket;

export interface CodexWorkerAdapterReport {
  reportType: 'main_agent_codex_worker_adapter';
  generatedAt: string;
  projectRoot: string;
  packetPath: string;
  taskReportPath: string;
  mode: 'smoke' | 'codex_exec';
  codexCommand: string[];
  exitCode: number;
  scopePassed: boolean;
  taskReport: TaskReport;
  stdinPath: string | null;
  stdoutPath: string | null;
  stderrPath: string | null;
  agentRole: string;
  agentSpecPath: string | null;
  runtimeGovernanceStatus: 'resolved' | 'blocked';
  runtimeGovernanceError: string | null;
  actualFilesChanged: string[];
  transportEnvelope: GovernanceTransportEnvelope | null;
  transportEnvelopeValidation: {
    ok: boolean;
    mismatches: string[];
    registryHash?: string | null;
    registryPolicyHash?: string | null;
  };
  subagentEvidenceEnvelope: Record<string, unknown> | null;
  subagentEvidenceEnvelopeValidation: SubagentEvidenceEnvelopeValidation;
}

interface RuntimeGovernanceResolution {
  status: 'resolved' | 'blocked';
  content: string;
  error: string | null;
}

function parseArgs(argv: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  const aliases: Record<string, string> = {
    'record-id': 'recordId',
    'requirement-set-id': 'requirementSetId',
    'run-id': 'runId',
    'parent-closeout-attempt-id': 'parentCloseoutAttemptId',
    'source-document-hash': 'sourceDocumentHash',
    'implementation-confirmation-hash': 'implementationConfirmationHash',
    'packet-path': 'packetPath',
    'task-report-path': 'taskReportPath',
    'smoke-target-path': 'smokeTargetPath',
    'timeout-ms': 'timeoutMs',
    'codex-binary': 'codexBinary',
    'governance-event-type-registry-policy-path': 'governanceEventTypeRegistryPolicyPath',
    'governance-event-type-registry-path': 'governanceEventTypeRegistryPath',
    'governance-event-type-registry-policy-hash': 'governanceEventTypeRegistryPolicyHash',
    'governance-event-type-registry-hash': 'governanceEventTypeRegistryHash',
    'architecture-confirmation-hash': 'architectureConfirmationHash',
    'trace-rows': 'traceRows',
    'covered-requirement-ids': 'coveredRequirementIds',
    'task-refs': 'taskRefs',
    'report-path': 'reportPath',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--smoke') {
      out.smoke = 'true';
    } else if (token.startsWith('--') && argv[index + 1]) {
      const key = token.slice(2);
      out[aliases[key] ?? key] = argv[++index];
    }
  }
  return out;
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+/, '');
}

function globToRegExp(glob: string): RegExp {
  const normalized = normalizePath(glob);
  let pattern = '';
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];
    if (char === '*' && next === '*') {
      pattern += '.*';
      index += 1;
    } else if (char === '*') {
      pattern += '[^/]*';
    } else {
      pattern += char.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
    }
  }
  return new RegExp(`^${pattern}$`, 'u');
}

function pathMatchesScope(filePath: string, scopes: string[]): boolean {
  const normalized = normalizePath(filePath);
  return scopes.some((scope) => globToRegExp(scope).test(normalized));
}

function readPacket(packetPath: string): Packet {
  return JSON.parse(readStrictUtf8JsonText(packetPath, { allowUtf8Bom: true })) as Packet;
}

function sha256File(filePath: string): string {
  return `sha256:${createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function packetExpectedDelta(packet: Packet): string {
  return packet.expectedDelta;
}

function packetAllowedWriteScope(packet: Packet): string[] {
  return Array.isArray(packet.allowedWriteScope) ? packet.allowedWriteScope : [];
}

function safePathSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'unscoped';
}

function defaultSmokeTargetPath(input: {
  recordId?: string;
  requirementSetId?: string;
  packet: Packet;
}): string {
  const requirementId = safePathSegment(
    input.recordId ?? input.requirementSetId ?? input.packet.parentSessionId
  );
  const packetId = safePathSegment(input.packet.packetId);
  return `_bmad-output/runtime/requirement-records/${requirementId}/artifacts/codex/${packetId}.md`;
}

function packetRole(packet: Packet): string {
  return 'role' in packet && packet.role
    ? packet.role
    : 'recommendedRole' in packet && packet.recommendedRole
      ? packet.recommendedRole
      : 'general-purpose';
}

function safeAgentName(role: string): string {
  return role
    .replace(/\\/g, '/')
    .replace(/\.toml$/u, '')
    .replace(/^\/+/u, '');
}

function resolveCodexAgentSpec(
  projectRoot: string,
  role: string
): { path: string; content: string } | null {
  const normalized = safeAgentName(role);
  const candidates = [
    path.join(projectRoot, '.codex', 'agents', `${normalized}.toml`),
    path.join(projectRoot, '.codex', 'agents', `${normalized.replace(/\//g, '__')}.toml`),
    path.join(projectRoot, '_bmad', 'codex', 'agents', `${normalized}.toml`),
    path.join(projectRoot, '_bmad', 'codex', 'agents', `${normalized.replace(/\//g, '__')}.toml`),
  ];
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    const roots = [
      path.resolve(projectRoot, '.codex', 'agents'),
      path.resolve(projectRoot, '_bmad', 'codex', 'agents'),
    ];
    if (
      roots.some((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`)) &&
      fs.existsSync(resolved)
    ) {
      return { path: resolved, content: fs.readFileSync(resolved, 'utf8') };
    }
  }
  return null;
}

function resolveRuntimeGovernanceBlock(
  projectRoot: string,
  options?: { recordId?: string; requirementSetId?: string; runId?: string; packet?: Packet }
): RuntimeGovernanceResolution {
  try {
    const loaded = loadPolicyContextFromRegistry(projectRoot, options);
    const currentSurface = resolveMainAgentOrchestrationSurface({
      projectRoot,
      recordId: options?.recordId,
      requirementSetId: options?.requirementSetId,
      runId: options?.runId,
      flow: loaded.flow as RuntimeFlowId,
      stage: loaded.stage as StageName,
    });
    const policy = resolveBmadHelpRuntimePolicy({
      flow: loaded.flow as RuntimeFlowId,
      stage: loaded.stage as StageName,
      projectRoot,
      runtimeContext: loaded.runtimeContext,
      runtimeContextPath: loaded.resolvedContextPath,
      ...(loaded.epicId ? { epicId: loaded.epicId } : {}),
      ...(loaded.storyId ? { storyId: loaded.storyId } : {}),
      ...(loaded.storySlug ? { storySlug: loaded.storySlug } : {}),
      ...(loaded.runId ? { runId: loaded.runId } : {}),
      ...(loaded.artifactRoot ? { artifactRoot: loaded.artifactRoot } : {}),
    });
    const governance = alignPolicyWithCurrentDispatchSurface(
      policy as unknown as Record<string, unknown>,
      currentSurface,
      options?.packet
    );
    return {
      status: 'resolved',
      content: stableStringifyPolicy({
        ...governance,
        flow: loaded.runtimeContext.flow,
        stage: loaded.runtimeContext.stage,
        runtimeContextPath: loaded.resolvedContextPath,
      }),
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: 'blocked',
      content: JSON.stringify(
        {
          failClosed: true,
          error: message,
        },
        null,
        2
      ),
      error: message,
    };
  }
}

function passImplementationEntryGateFromSurface(
  surface: ReturnType<typeof resolveMainAgentOrchestrationSurface>
): ImplementationEntryGate | null {
  if (surface.latestGate?.gateId !== 'implementation-readiness') {
    return null;
  }
  if (surface.latestGate.decision !== 'pass') {
    return null;
  }
  const flow =
    surface.orchestrationState?.flow === 'bugfix' ||
    surface.orchestrationState?.flow === 'standalone_tasks'
      ? surface.orchestrationState.flow
      : 'story';
  return {
    gateName: 'implementation-readiness',
    requestedFlow: flow,
    recommendedFlow: flow,
    decision: 'pass',
    readinessStatus: 'ready_clean',
    blockerCodes: [],
    blockerSummary: [],
    rerouteRequired: false,
    rerouteReason: null,
    evidenceSources: {
      readinessReportPath: null,
      remediationArtifactPath: null,
      executionRecordPath: null,
      authoritativeAuditReportPath: null,
    },
    semanticFingerprint: null,
    evaluatedAt: new Date().toISOString(),
  };
}

function alignPolicyWithCurrentDispatchSurface(
  policy: Record<string, unknown>,
  surface: ReturnType<typeof resolveMainAgentOrchestrationSurface>,
  packet?: Packet
): Record<string, unknown> {
  const packetTaskType = packet && 'taskType' in packet ? packet.taskType : null;
  const activePacketStatus = surface.orchestrationState?.pendingPacket?.status ?? null;
  const activeDispatchPacketMatches =
    Boolean(packet) &&
    surface.orchestrationState?.pendingPacket?.packetId === packet?.packetId &&
    (activePacketStatus === 'ready_for_main_agent' ||
      activePacketStatus === 'claimed_by_main_agent' ||
      activePacketStatus === 'dispatched');
  const activeImplementDispatchPacket =
    activeDispatchPacketMatches && packetTaskType === 'implement';
  const packetImpliesImplement =
    (surface.mainAgentNextAction === 'dispatch_implement' && surface.mainAgentReady === true) ||
    activeImplementDispatchPacket;
  if (!packetImpliesImplement) {
    return policy;
  }
  const alignedSurface = activeImplementDispatchPacket
    ? {
        ...surface,
        mainAgentNextAction: 'dispatch_implement',
        mainAgentReady: true,
        ...(surface.runtimeResumeProjection
          ? {
              runtimeResumeProjection: {
                ...surface.runtimeResumeProjection,
                runtimeNextAction: 'dispatch_implement',
                ready: true,
              },
            }
          : {}),
      }
    : surface;

  const gate =
    passImplementationEntryGateFromSurface(alignedSurface) ??
    (policy.implementationEntryGate &&
    typeof policy.implementationEntryGate === 'object' &&
    !Array.isArray(policy.implementationEntryGate)
      ? (policy.implementationEntryGate as ImplementationEntryGate)
      : null);
  const nextPolicy = {
    ...policy,
    implementationReadinessStatus: 'ready_clean',
    implementationEntryRecommended: true,
    implementationEntryDecision: 'pass',
    ...(gate ? { implementationEntryGate: { ...gate, decision: 'pass' } } : {}),
    mainAgentCanContinue: alignedSurface.mainAgentCanContinue,
    continueDecision: alignedSurface.continueDecision,
    mainAgentNextAction: alignedSurface.mainAgentNextAction,
    mainAgentReady: alignedSurface.mainAgentReady,
    mainAgentOrchestration: alignedSurface,
  };
  const helpRouting =
    policy.helpRouting &&
    typeof policy.helpRouting === 'object' &&
    !Array.isArray(policy.helpRouting)
      ? (policy.helpRouting as Record<string, unknown>)
      : null;
  return helpRouting
    ? {
        ...nextPolicy,
        helpRouting: {
          ...helpRouting,
          implementationReadinessStatus: 'ready_clean',
          implementationEntryRecommended: true,
          implementationEntryDecision: 'pass',
          ...(gate ? { implementationEntryGate: { ...gate, decision: 'pass' } } : {}),
          mainAgentCanContinue: alignedSurface.mainAgentCanContinue,
          continueDecision: alignedSurface.continueDecision,
          mainAgentNextAction: alignedSurface.mainAgentNextAction,
          mainAgentReady: alignedSurface.mainAgentReady,
          mainAgentOrchestration: alignedSurface,
        },
      }
    : nextPolicy;
}

function buildPrompt(input: {
  packet: Packet;
  packetPath: string;
  taskReportPath: string;
  codexWritableTaskReportPath: string;
  smokeTargetPath: string | null;
  agentRole: string;
  agentSpec: { path: string; content: string } | null;
  runtimeGovernance: string;
  compiledPromptContent?: string;
  compiledGoalExplanation?: string | null;
}): string {
  const smokeLine = input.smokeTargetPath
    ? `For this bounded smoke run, write a small proof file at ${input.smokeTargetPath} and do not modify files outside allowedWriteScope.`
    : 'Perform the requested packet work without widening scope.';
  return [
    'You are the Codex no-hooks worker for BMAD-Speckit main-agent orchestration.',
    `Use BMAD Codex custom agent role: ${input.agentRole}`,
    '--- Runtime Governance JSON ---',
    input.runtimeGovernance,
    '--- End Runtime Governance JSON ---',
    input.agentSpec
      ? `Loaded Codex agent spec: ${input.agentSpec.path}`
      : 'No Codex agent spec loaded.',
    input.agentSpec
      ? ['--- Codex Agent TOML ---', input.agentSpec.content, '--- End Codex Agent TOML ---'].join(
          '\n'
        )
      : '',
    `Read dispatch packet: ${input.packetPath}`,
    `Packet ID: ${input.packet.packetId}`,
    `Allowed write scope: ${packetAllowedWriteScope(input.packet).join(', ') || '(none)'}`,
    `Expected delta: ${packetExpectedDelta(input.packet)}`,
    smokeLine,
    input.compiledPromptContent
      ? [
          '--- Entry Flow Discipline Profile ---',
          `flow: ${'flow' in input.packet ? input.packet.flow : 'unknown'}`,
          `authorityMode: ${'authorityMode' in input.packet ? (input.packet.authorityMode ?? 'legacy_generic_prompt') : 'legacy_generic_prompt'}`,
          input.compiledGoalExplanation ?? '',
          '--- End Entry Flow Discipline Profile ---',
          '--- Compiled Human Prompt ---',
          input.compiledPromptContent,
          '--- End Compiled Human Prompt ---',
        ].join('\n')
      : '',
    `When finished, write a JSON TaskReport to: ${input.codexWritableTaskReportPath}`,
    input.codexWritableTaskReportPath === input.taskReportPath
      ? ''
      : `The BMAD evidence path is ${input.taskReportPath}; the adapter will copy your report there after Codex exits.`,
    'TaskReport schema: { packetId, status, filesChanged, validationsRun, evidence, downstreamContext, driftFlags? }.',
    'The TaskReport file must be UTF-8 without BOM and strict JSON only. Do not wrap it in Markdown.',
    'If blocked, write status=blocked and explain evidence. Do not claim completion without writing the report.',
  ].join('\n');
}

function ensureWithinProject(projectRoot: string, targetPath: string): string {
  const resolved = path.resolve(projectRoot, targetPath);
  const root = path.resolve(projectRoot);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Path escapes project root: ${targetPath}`);
  }
  return resolved;
}

function writeSmokeProof(projectRoot: string, relativePath: string, packet: Packet): void {
  const target = ensureWithinProject(projectRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(
    target,
    [
      '# Codex Worker Smoke Proof',
      '',
      `packetId: ${packet.packetId}`,
      `expectedDelta: ${packetExpectedDelta(packet)}`,
      `generatedAt: ${new Date().toISOString()}`,
      '',
    ].join('\n'),
    'utf8'
  );
}

function readTaskReport(taskReportPath: string): TaskReport {
  const parsed = JSON.parse(
    readStrictUtf8JsonText(taskReportPath, { allowUtf8Bom: false })
  ) as TaskReport;
  return normalizeTaskReport(parsed);
}

function readStrictUtf8JsonText(filePath: string, options: { allowUtf8Bom: boolean }): string {
  const raw = fs.readFileSync(filePath);
  if (raw.length >= 2 && raw[0] === 0xff && raw[1] === 0xfe) {
    throw new Error(`strict JSON must be UTF-8 no BOM: ${filePath}`);
  }
  if (raw.length >= 2 && raw[0] === 0xfe && raw[1] === 0xff) {
    throw new Error(`strict JSON must be UTF-8 no BOM: ${filePath}`);
  }
  if (raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) {
    if (!options.allowUtf8Bom) {
      throw new Error(`strict JSON must be UTF-8 no BOM: ${filePath}`);
    }
    return raw.subarray(3).toString('utf8');
  }
  return raw.toString('utf8');
}

function readJsonIfExists(filePath: string | null | undefined): Record<string, unknown> | null {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : null;
}

function nested(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readCompiledPromptProjection(input: {
  packet: Packet;
}):
  | { status: 'pass'; content: string; goalExplanation: string | null }
  | { status: 'blocked'; driftFlags: string[]; evidence: string[] } {
  if (
    !('authorityMode' in input.packet) ||
    input.packet.authorityMode !== 'compiled_implementation_confirmation'
  ) {
    return { status: 'pass', content: '', goalExplanation: null };
  }
  const ref = input.packet.compiledPromptRef;
  if (!ref) {
    return {
      status: 'blocked',
      driftFlags: ['compiled-prompt-missing'],
      evidence: ['compiledPromptRef missing for compiled_implementation_confirmation packet'],
    };
  }
  if (!fs.existsSync(ref.humanPromptPath)) {
    return {
      status: 'blocked',
      driftFlags: ['compiled-prompt-missing'],
      evidence: [`compiled human_prompt.txt missing: ${ref.humanPromptPath}`],
    };
  }
  if (sha256File(ref.humanPromptPath) !== ref.humanPromptHash) {
    return {
      status: 'blocked',
      driftFlags: ['compiled-prompt-hash-mismatch'],
      evidence: [`compiled human_prompt.txt hash mismatch: ${ref.humanPromptPath}`],
    };
  }
  if (!fs.existsSync(ref.auditReceiptPath)) {
    return {
      status: 'blocked',
      driftFlags: ['compiled-audit-receipt-missing'],
      evidence: [`compiled audit_receipt.json missing: ${ref.auditReceiptPath}`],
    };
  }
  if (sha256File(ref.auditReceiptPath) !== ref.auditReceiptHash) {
    return {
      status: 'blocked',
      driftFlags: ['compiled-audit-receipt-hash-mismatch'],
      evidence: [`compiled audit_receipt.json hash mismatch: ${ref.auditReceiptPath}`],
    };
  }
  const receipt = readJsonIfExists(ref.auditReceiptPath);
  const receiptGoalCommand = nested(receipt?.goalCommand);
  const goalMode = text(receiptGoalCommand.mode);
  if (goalMode === 'native_goal_document_ref') {
    if (!ref.goalExecutionPath || !fs.existsSync(ref.goalExecutionPath)) {
      return {
        status: 'blocked',
        driftFlags: ['compiled-goal-execution-missing'],
        evidence: ['native /goal receipt requires hash-bound goal_execution.md'],
      };
    }
    if (!ref.goalExecutionHash || sha256File(ref.goalExecutionPath) !== ref.goalExecutionHash) {
      return {
        status: 'blocked',
        driftFlags: ['compiled-goal-execution-hash-mismatch'],
        evidence: [`goal_execution.md hash mismatch: ${ref.goalExecutionPath}`],
      };
    }
  }
  if (goalMode === 'native_goal_inline') {
    return {
      status: 'blocked',
      driftFlags: ['compiled-native-goal-inline-rejected'],
      evidence: [
        'native_goal_inline is forbidden; compiler must provide goal_execution.md document ref',
      ],
    };
  }

  const packetProfile = nested((input.packet as ExecutionPacket).executionDisciplineProfile);
  const profileId = text(packetProfile.profileId);
  const profileHash = text(packetProfile.profileHash);
  const receiptProfile = nested(receipt?.executionDisciplineProfile);
  if (profileId && text(receiptProfile.profileId) && text(receiptProfile.profileId) !== profileId) {
    return {
      status: 'blocked',
      driftFlags: ['compiled-profile-id-mismatch'],
      evidence: [
        'audit_receipt.json executionDisciplineProfile.profileId differs from dispatch packet',
      ],
    };
  }
  if (
    profileHash &&
    text(receiptProfile.profileHash) &&
    text(receiptProfile.profileHash) !== profileHash
  ) {
    return {
      status: 'blocked',
      driftFlags: ['compiled-profile-hash-mismatch'],
      evidence: [
        'audit_receipt.json executionDisciplineProfile.profileHash differs from dispatch packet',
      ],
    };
  }
  const content = fs.readFileSync(ref.humanPromptPath, 'utf8');
  if (profileId && !content.includes(profileId)) {
    return {
      status: 'blocked',
      driftFlags: ['compiled-human-prompt-profile-missing'],
      evidence: ['human_prompt.txt does not include execution discipline profile id'],
    };
  }
  if (profileHash && !content.includes(profileHash)) {
    return {
      status: 'blocked',
      driftFlags: ['compiled-human-prompt-profile-hash-missing'],
      evidence: ['human_prompt.txt does not include execution discipline profile hash'],
    };
  }
  if (goalMode === 'native_goal_document_ref' && ref.goalExecutionPath) {
    const goalContent = fs.readFileSync(ref.goalExecutionPath, 'utf8');
    if (profileId && !goalContent.includes(profileId)) {
      return {
        status: 'blocked',
        driftFlags: ['compiled-goal-profile-missing'],
        evidence: ['goal_execution.md does not include execution discipline profile id'],
      };
    }
    if (profileHash && !goalContent.includes(profileHash)) {
      return {
        status: 'blocked',
        driftFlags: ['compiled-goal-profile-hash-missing'],
        evidence: ['goal_execution.md does not include execution discipline profile hash'],
      };
    }
  }
  return {
    status: 'pass',
    content,
    goalExplanation:
      goalMode === 'native_goal_document_ref'
        ? '/goal is an entry pointer only; execution scope is goal_execution.md plus model_packet.json, and model_packet.json remains machine authority.'
        : null,
  };
}

function normalizeTaskReport(report: TaskReport): TaskReport {
  const status = String(report.status);
  return {
    ...report,
    status: status === 'completed' ? 'done' : status === 'failed' ? 'blocked' : report.status,
    filesChanged: Array.isArray(report.filesChanged) ? report.filesChanged : [],
    validationsRun: Array.isArray(report.validationsRun) ? report.validationsRun : [],
    evidence: Array.isArray(report.evidence) ? report.evidence : [],
    downstreamContext: Array.isArray(report.downstreamContext) ? report.downstreamContext : [],
  };
}

function validateTaskReport(report: TaskReport, packet: Packet, scopes: string[]): string[] {
  const errors: string[] = [];
  if (report.packetId !== packet.packetId) {
    errors.push(`packetId mismatch: ${report.packetId}`);
  }
  if (!['done', 'blocked', 'partial'].includes(report.status)) {
    errors.push(`invalid status: ${String(report.status)}`);
  }
  for (const changed of report.filesChanged ?? []) {
    if (!pathMatchesScope(changed, scopes)) {
      errors.push(`file outside allowedWriteScope: ${changed}`);
    }
  }
  if (!Array.isArray(report.evidence) || report.evidence.length === 0) {
    errors.push('missing evidence');
  }
  return errors;
}

function taskReportStatusToEnvelopeStatus(status: TaskReport['status']): string {
  if (status === 'done') return 'done';
  if (status === 'partial') return 'partial';
  return 'blocked';
}

function buildNoHookTransportEnvelope(input: {
  recordId?: string;
  requirementSetId?: string;
  runId?: string;
  packet: Packet;
  taskReport: TaskReport;
}): GovernanceTransportEnvelope {
  return {
    hostKind: 'codex',
    hostMode: 'no_hook',
    entry: 'main-agent-codex-worker-adapter',
    runId: input.runId ?? input.packet.parentSessionId,
    recordId: input.recordId ?? input.packet.parentSessionId,
    requirementSetId: input.requirementSetId ?? input.recordId ?? input.packet.parentSessionId,
    stage: input.packet.phase,
    packetId: input.packet.packetId,
    eventType: 'execution_iteration_recorded',
    payloadKind: 'status',
    status: taskReportStatusToEnvelopeStatus(input.taskReport.status),
    sourceRefs: [{ sourceType: 'execution_packet', id: input.packet.packetId }],
    artifactRefs: input.taskReport.evidence.map((item) => ({
      artifactType: 'task_report_evidence',
      sourceOfTruthRole: 'evidence',
      path: item,
    })),
    payload: {
      packetId: input.packet.packetId,
      filesChanged: input.taskReport.filesChanged,
      validationsRun: input.taskReport.validationsRun,
      evidence: input.taskReport.evidence,
      downstreamContext: input.taskReport.downstreamContext,
      driftFlags: input.taskReport.driftFlags ?? [],
    },
  };
}

function listGitVisibleFiles(projectRoot: string): string[] {
  const result = spawnSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    {
      cwd: projectRoot,
      encoding: 'buffer',
      shell: process.platform === 'win32',
    }
  );
  if ((result.status ?? 1) !== 0) {
    return [];
  }
  return result.stdout
    .toString('utf8')
    .split('\0')
    .map((file) => normalizePath(file.trim()))
    .filter(Boolean);
}

function listFilesystemVisibleFiles(projectRoot: string): string[] {
  const out: string[] = [];
  const ignored = new Set(['.git', 'node_modules']);
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ignored.has(entry.name)) continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (entry.isFile()) {
        out.push(normalizePath(path.relative(projectRoot, absolute)));
      }
    }
  };
  walk(projectRoot);
  return out.sort();
}

function snapshotGitVisibleFiles(projectRoot: string): Map<string, string> {
  const snapshot = new Map<string, string>();
  const files = listGitVisibleFiles(projectRoot);
  for (const file of files.length > 0 ? files : listFilesystemVisibleFiles(projectRoot)) {
    const absolute = path.join(projectRoot, file);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
    const digest = createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');
    snapshot.set(file, digest);
  }
  return snapshot;
}

function diffFileSnapshots(before: Map<string, string>, after: Map<string, string>): string[] {
  const changed = new Set<string>();
  for (const [file, digest] of after.entries()) {
    if (before.get(file) !== digest) {
      changed.add(file);
    }
  }
  for (const file of before.keys()) {
    if (!after.has(file)) {
      changed.add(file);
    }
  }
  return [...changed].sort();
}

function isAdapterOwnedPath(
  projectRoot: string,
  candidate: string,
  ownedPaths: Array<string | null>
): boolean {
  const normalized = normalizePath(candidate);
  return ownedPaths.some((owned) => {
    if (!owned) return false;
    return normalizePath(path.relative(projectRoot, owned)) === normalized;
  });
}

function writeTaskReport(taskReportPath: string, report: TaskReport): void {
  fs.mkdirSync(path.dirname(taskReportPath), { recursive: true });
  fs.writeFileSync(taskReportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
}

function readRequirementRecord(
  projectRoot: string,
  ...recordIds: Array<string | undefined>
): Record<string, unknown> | null {
  const candidates = [...new Set(recordIds.map(text).filter(Boolean))];
  for (const recordId of candidates) {
    const recordPath = path.join(
      projectRoot,
      '_bmad-output',
      'runtime',
      'requirement-records',
      recordId,
      'requirement-record.json'
    );
    if (!fs.existsSync(recordPath)) continue;
    const parsed = JSON.parse(fs.readFileSync(recordPath, 'utf8')) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  }
  return null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => text(item)).filter(Boolean) : [];
}

function objects(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
    : [];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function implementationConfirmationFromSource(
  projectRoot: string,
  record: Record<string, unknown> | null
): Record<string, unknown> {
  const sourcePath = text(record?.sourcePath);
  if (!sourcePath) return {};
  const resolved = path.isAbsolute(sourcePath)
    ? sourcePath
    : path.resolve(projectRoot, sourcePath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return {};
  const lines = fs.readFileSync(resolved, 'utf8').replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((line) => /^implementationConfirmation:\s*$/u.test(line));
  if (start < 0) return {};
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === '') continue;
    if (/^\S/u.test(line) && !/^implementationConfirmation:\s*$/u.test(line)) {
      end = index;
      break;
    }
  }
  const parsed = yaml.load(lines.slice(start, end).join('\n')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const confirmation = (parsed as Record<string, unknown>).implementationConfirmation;
  return confirmation && typeof confirmation === 'object' && !Array.isArray(confirmation)
    ? (confirmation as Record<string, unknown>)
    : {};
}

function confirmedExecutionRefs(input: {
  projectRoot: string;
  record: Record<string, unknown> | null;
  packet: Packet;
}): { traceRows: string[]; coveredRequirementIds: string[]; taskRefs: string[] } {
  const confirmation = implementationConfirmationFromSource(input.projectRoot, input.record);
  const traceRows = uniqueStrings([
    ...strings(input.record?.traceRows),
    ...objects(confirmation.traceRows).map((row) => text(row.id)),
  ]);
  const traceCoveredIds = objects(confirmation.traceRows).flatMap((row) => strings(row.covers));
  const coveredRequirementIds = uniqueStrings([
    ...strings(input.record?.coveredRequirementIds),
    ...objects(confirmation.must).map((row) => text(row.id)),
    ...objects(confirmation.notDone).map((row) => text(row.id)),
    ...objects(confirmation.mustNot).map((row) => text(row.id)),
    ...traceCoveredIds,
  ]);
  const taskRefs = uniqueStrings([
    ...strings(input.record?.taskRefs),
    ...objects(confirmation.atomicImplementationTaskList).map((row) => text(row.id)),
    ...objects(confirmation.mustExecutionDecompositionMatrix).flatMap((row) =>
      strings(row.atomicTaskRefs)
    ),
    ...objects(confirmation.traceRows).flatMap((row) => strings(row.taskRefs)),
    input.packet.packetId,
  ]);
  return { traceRows, coveredRequirementIds, taskRefs };
}

function recordArchitectureHash(record: Record<string, unknown> | null): string {
  const state =
    record?.architectureConfirmationState &&
    typeof record.architectureConfirmationState === 'object' &&
    !Array.isArray(record.architectureConfirmationState)
      ? (record.architectureConfirmationState as Record<string, unknown>)
      : {};
  return text(state.currentArchitectureConfirmationHash);
}

function recordCloseoutAttemptId(record: Record<string, unknown> | null): string {
  const closeout =
    record?.closeout && typeof record.closeout === 'object' && !Array.isArray(record.closeout)
      ? (record.closeout as Record<string, unknown>)
      : {};
  return text(closeout.currentAttemptId);
}

function gitHead(projectRoot: string): string {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: projectRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  return (result.stdout || '').trim() || 'unknown';
}

function evidencePathFromTaskReportItem(item: string): string | null {
  const codexSmokePrefix = 'codex-smoke:';
  if (item.startsWith(codexSmokePrefix)) return item.slice(codexSmokePrefix.length);
  if (
    /^[A-Za-z]:[\\/]/u.test(item) ||
    item.startsWith('/') ||
    item.includes('/') ||
    item.includes('\\')
  ) {
    return item;
  }
  return null;
}

function taskReportArtifactRefs(input: {
  projectRoot: string;
  taskReport: TaskReport;
  fallbackRequirementIds: string[];
}): Record<string, unknown>[] {
  return input.taskReport.evidence
    .map(evidencePathFromTaskReportItem)
    .filter((item): item is string => Boolean(item))
    .map((artifactPath) =>
      artifactRefForPath({
        projectRoot: input.projectRoot,
        artifactPath,
        artifactType: 'subagent_task_report_evidence',
        producer: 'main-agent-codex-worker-adapter',
        purpose: 'TaskReport evidence promoted into subagentEvidenceEnvelope artifactRefs',
        relatedRequirementIds: input.fallbackRequirementIds.length
          ? input.fallbackRequirementIds
          : ['subagent_evidence_envelope'],
        inputVersion: 'task-report-v1',
        outputVersion: 'subagent-evidence-envelope-v1',
      })
    );
}

function resolveCodexWritableTaskReportPath(projectRoot: string, taskReportPath: string): string {
  const root = path.resolve(projectRoot);
  const requested = path.resolve(taskReportPath);
  if (requested === root || requested.startsWith(`${root}${path.sep}`)) {
    return requested;
  }
  return path.join(
    projectRoot,
    '_bmad-output',
    'runtime',
    'codex',
    'task-reports',
    path.basename(path.dirname(requested)),
    path.basename(requested)
  );
}

function copyTaskReportIfNeeded(sourcePath: string, targetPath: string): void {
  if (path.resolve(sourcePath) === path.resolve(targetPath) || !fs.existsSync(sourcePath)) {
    return;
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}

export function runCodexWorkerAdapter(input: {
  projectRoot: string;
  recordId?: string;
  requirementSetId?: string;
  runId?: string;
  parentCloseoutAttemptId?: string;
  sourceDocumentHash?: string;
  implementationConfirmationHash?: string;
  packetPath: string;
  taskReportPath?: string;
  smoke?: boolean;
  smokeTargetPath?: string;
  timeoutMs?: number;
  allowPolicyFailureForSmoke?: boolean;
  allowPolicyFailureForDeterministicShim?: boolean;
  codexBinary?: string;
  governanceEventTypeRegistryPolicy?: unknown;
  governanceEventTypeRegistryPolicyHash?: string;
  governanceEventTypeRegistry?: unknown;
  governanceEventTypeRegistryHash?: string;
  architectureConfirmationHash?: string;
  traceRows?: string[];
  coveredRequirementIds?: string[];
  taskRefs?: string[];
}): CodexWorkerAdapterReport {
  const projectRoot = path.resolve(input.projectRoot);
  const packetPath = path.resolve(input.packetPath);
  const packet = readPacket(packetPath);
  const requirementRecord = readRequirementRecord(
    projectRoot,
    input.requirementSetId,
    input.recordId,
    packet.parentSessionId
  );
  const sourceDocumentHash =
    input.sourceDocumentHash ?? text(requirementRecord?.sourceDocumentHash);
  const implementationConfirmationHash =
    input.implementationConfirmationHash ?? text(requirementRecord?.implementationConfirmationHash);
  const architectureConfirmationHash =
    input.architectureConfirmationHash ?? recordArchitectureHash(requirementRecord);
  const parentCloseoutAttemptId =
    input.parentCloseoutAttemptId ||
    recordCloseoutAttemptId(requirementRecord) ||
    `${input.runId ?? packet.parentSessionId}:current-attempt`;
  const commitBefore = gitHead(projectRoot);
  const adapterStartedAt = new Date().toISOString();
  const scopes = packetAllowedWriteScope(packet);
  const agentRole = packetRole(packet);
  const agentSpec = resolveCodexAgentSpec(projectRoot, agentRole);
  const taskReportPath = path.resolve(
    input.taskReportPath ??
      path.join(
        projectRoot,
        '_bmad-output',
        'runtime',
        'codex',
        'task-reports',
        `${packet.packetId}.json`
      )
  );
  const codexWritableTaskReportPath = resolveCodexWritableTaskReportPath(
    projectRoot,
    taskReportPath
  );
  const smokeTargetPath = input.smokeTargetPath ?? defaultSmokeTargetPath({ ...input, packet });
  const validationScopes = input.smoke ? Array.from(new Set([...scopes, smokeTargetPath])) : scopes;
  if (!agentSpec) {
    const blockedReport: TaskReport = {
      packetId: packet.packetId,
      status: 'blocked',
      filesChanged: [],
      validationsRun: ['codex-worker-adapter-agent-resolution'],
      evidence: [`missing codex agent spec for role=${agentRole}`],
      downstreamContext: [packetExpectedDelta(packet)],
      driftFlags: ['codex-agent-spec-missing'],
    };
    writeTaskReport(taskReportPath, blockedReport);
    return {
      reportType: 'main_agent_codex_worker_adapter',
      generatedAt: new Date().toISOString(),
      projectRoot,
      packetPath,
      taskReportPath,
      mode: input.smoke ? 'smoke' : 'codex_exec',
      codexCommand: input.smoke ? ['codex', 'worker-adapter-smoke'] : [],
      exitCode: 1,
      scopePassed: false,
      taskReport: blockedReport,
      stdinPath: null,
      stdoutPath: null,
      stderrPath: null,
      agentRole,
      agentSpecPath: null,
      runtimeGovernanceStatus: 'blocked',
      runtimeGovernanceError: 'codex agent spec missing',
      actualFilesChanged: [],
      transportEnvelope: null,
      transportEnvelopeValidation: { ok: false, mismatches: ['codex_agent_spec_missing'] },
      subagentEvidenceEnvelope: null,
      subagentEvidenceEnvelopeValidation: {
        ok: false,
        status: 'blocked',
        mismatches: ['codex_agent_spec_missing'],
        sourceRefs: [],
        evidenceArtifactRefs: [],
      },
    };
  }
  const runtimeGovernance = resolveRuntimeGovernanceBlock(projectRoot, {
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    runId: input.runId,
    packet,
  });
  if (
    runtimeGovernance.status === 'blocked' &&
    !(input.smoke && input.allowPolicyFailureForSmoke) &&
    !input.allowPolicyFailureForDeterministicShim
  ) {
    const blockedReport: TaskReport = {
      packetId: packet.packetId,
      status: 'blocked',
      filesChanged: [],
      validationsRun: ['codex-worker-adapter-runtime-governance'],
      evidence: [`runtime governance blocked: ${runtimeGovernance.error}`],
      downstreamContext: [packetExpectedDelta(packet)],
      driftFlags: ['codex-runtime-governance-blocked'],
    };
    writeTaskReport(taskReportPath, blockedReport);
    return {
      reportType: 'main_agent_codex_worker_adapter',
      generatedAt: new Date().toISOString(),
      projectRoot,
      packetPath,
      taskReportPath,
      mode: input.smoke ? 'smoke' : 'codex_exec',
      codexCommand: input.smoke ? ['codex', 'worker-adapter-smoke'] : [],
      exitCode: 1,
      scopePassed: false,
      taskReport: blockedReport,
      stdinPath: null,
      stdoutPath: null,
      stderrPath: null,
      agentRole,
      agentSpecPath: agentSpec.path,
      runtimeGovernanceStatus: runtimeGovernance.status,
      runtimeGovernanceError: runtimeGovernance.error,
      actualFilesChanged: [],
      transportEnvelope: null,
      transportEnvelopeValidation: { ok: false, mismatches: ['runtime_governance_blocked'] },
      subagentEvidenceEnvelope: null,
      subagentEvidenceEnvelopeValidation: {
        ok: false,
        status: 'blocked',
        mismatches: ['runtime_governance_blocked'],
        sourceRefs: [],
        evidenceArtifactRefs: [],
      },
    };
  }
  let exitCode = 0;
  let stdinPath: string | null = null;
  let stdoutPath: string | null = null;
  let stderrPath: string | null = null;
  const allowCodexBinaryOverride = process.env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE === 'true';
  if (
    !input.smoke &&
    (input.codexBinary || process.env.CODEX_WORKER_ADAPTER_BIN) &&
    !allowCodexBinaryOverride
  ) {
    const blockedReport: TaskReport = {
      packetId: packet.packetId,
      status: 'blocked',
      filesChanged: [],
      validationsRun: ['codex-worker-adapter-binary-override-denied'],
      evidence: ['Codex binary override requires MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE=true'],
      downstreamContext: [packetExpectedDelta(packet)],
      driftFlags: ['codex-binary-override-denied'],
    };
    writeTaskReport(taskReportPath, blockedReport);
    return {
      reportType: 'main_agent_codex_worker_adapter',
      generatedAt: new Date().toISOString(),
      projectRoot,
      packetPath,
      taskReportPath,
      mode: 'codex_exec',
      codexCommand: [],
      exitCode: 1,
      scopePassed: false,
      taskReport: blockedReport,
      stdinPath: null,
      stdoutPath: null,
      stderrPath: null,
      agentRole,
      agentSpecPath: agentSpec.path,
      runtimeGovernanceStatus: runtimeGovernance.status,
      runtimeGovernanceError: runtimeGovernance.error,
      actualFilesChanged: [],
      transportEnvelope: null,
      transportEnvelopeValidation: { ok: false, mismatches: ['codex_binary_override_denied'] },
      subagentEvidenceEnvelope: null,
      subagentEvidenceEnvelopeValidation: {
        ok: false,
        status: 'blocked',
        mismatches: ['codex_binary_override_denied'],
        sourceRefs: [],
        evidenceArtifactRefs: [],
      },
    };
  }
  const compiledPromptProjection = readCompiledPromptProjection({ packet });
  if (compiledPromptProjection.status === 'blocked') {
    const blockedReport: TaskReport = {
      packetId: packet.packetId,
      status: 'blocked',
      filesChanged: [],
      validationsRun: ['codex-worker-adapter-compiled-prompt'],
      evidence: compiledPromptProjection.evidence,
      downstreamContext: [packetExpectedDelta(packet)],
      driftFlags: compiledPromptProjection.driftFlags,
    };
    writeTaskReport(taskReportPath, blockedReport);
    return {
      reportType: 'main_agent_codex_worker_adapter',
      generatedAt: new Date().toISOString(),
      projectRoot,
      packetPath,
      taskReportPath,
      mode: input.smoke ? 'smoke' : 'codex_exec',
      codexCommand: input.smoke ? ['codex', 'worker-adapter-smoke'] : [],
      exitCode: 1,
      scopePassed: false,
      taskReport: blockedReport,
      stdinPath: null,
      stdoutPath: null,
      stderrPath: null,
      agentRole,
      agentSpecPath: agentSpec.path,
      runtimeGovernanceStatus: runtimeGovernance.status,
      runtimeGovernanceError: runtimeGovernance.error,
      actualFilesChanged: [],
      transportEnvelope: null,
      transportEnvelopeValidation: { ok: false, mismatches: compiledPromptProjection.driftFlags },
      subagentEvidenceEnvelope: null,
      subagentEvidenceEnvelopeValidation: {
        ok: false,
        status: 'blocked',
        mismatches: compiledPromptProjection.driftFlags,
        sourceRefs: [],
        evidenceArtifactRefs: [],
      },
    };
  }
  const prompt = buildPrompt({
    packet,
    packetPath,
    taskReportPath,
    codexWritableTaskReportPath,
    smokeTargetPath: input.smoke ? smokeTargetPath : null,
    agentRole,
    agentSpec,
    runtimeGovernance: runtimeGovernance.content,
    compiledPromptContent: compiledPromptProjection.content,
    compiledGoalExplanation: compiledPromptProjection.goalExplanation,
  });
  const codexCommand = input.smoke
    ? ['codex', 'worker-adapter-smoke']
    : [
        input.codexBinary ?? process.env.CODEX_WORKER_ADAPTER_BIN ?? 'codex',
        '-a',
        'never',
        'exec',
        '--cd',
        projectRoot,
        '--sandbox',
        'workspace-write',
        '-',
      ];

  const beforeFileSnapshot = snapshotGitVisibleFiles(projectRoot);

  if (input.smoke) {
    writeSmokeProof(projectRoot, smokeTargetPath, packet);
    writeTaskReport(taskReportPath, {
      packetId: packet.packetId,
      status: 'done',
      filesChanged: [smokeTargetPath],
      validationsRun: ['codex-worker-adapter-smoke'],
      evidence: [`codex-smoke:${smokeTargetPath}`],
      downstreamContext: [packetExpectedDelta(packet)],
    });
  } else {
    const outDir = path.join(projectRoot, '_bmad-output', 'runtime', 'codex', 'logs');
    fs.mkdirSync(outDir, { recursive: true });
    stdinPath = path.join(outDir, `${packet.packetId}.stdin.prompt.txt`);
    fs.writeFileSync(stdinPath, prompt, 'utf8');
    const result = spawnSync(codexCommand[0], codexCommand.slice(1), {
      cwd: projectRoot,
      input: prompt,
      encoding: 'utf8',
      timeout: input.timeoutMs ?? 120_000,
      shell: process.platform === 'win32',
    });
    exitCode = result.status ?? (result.error ? 1 : 0);
    stdoutPath = path.join(outDir, `${packet.packetId}.stdout.log`);
    stderrPath = path.join(outDir, `${packet.packetId}.stderr.log`);
    fs.writeFileSync(stdoutPath, result.stdout ?? '', 'utf8');
    fs.writeFileSync(stderrPath, result.stderr ?? result.error?.message ?? '', 'utf8');
  }

  copyTaskReportIfNeeded(codexWritableTaskReportPath, taskReportPath);
  let taskReportStrictJsonError: string | null = null;
  const taskReport: TaskReport = fs.existsSync(taskReportPath)
    ? (() => {
        try {
          return readTaskReport(taskReportPath);
        } catch (error) {
          taskReportStrictJsonError = error instanceof Error ? error.message : String(error);
          return {
            packetId: packet.packetId,
            status: 'blocked',
            filesChanged: [],
            validationsRun: ['codex-worker-adapter-strict-task-report'],
            evidence: [`TaskReport strict JSON validation failed: ${taskReportStrictJsonError}`],
            downstreamContext: [packetExpectedDelta(packet)],
            driftFlags: ['codex-task-report-strict-json-invalid'],
          } satisfies TaskReport;
        }
      })()
    : {
        packetId: packet.packetId,
        status: 'blocked' as const,
        filesChanged: [],
        validationsRun: ['codex-worker-adapter'],
        evidence: ['codex did not produce task report'],
        downstreamContext: [packetExpectedDelta(packet)],
      };
  const actualFilesChanged = diffFileSnapshots(
    beforeFileSnapshot,
    snapshotGitVisibleFiles(projectRoot)
  ).filter(
    (file) =>
      !isAdapterOwnedPath(projectRoot, file, [
        taskReportPath,
        codexWritableTaskReportPath,
        stdinPath,
        stdoutPath,
        stderrPath,
      ])
  );
  if (!fs.existsSync(taskReportPath)) {
    writeTaskReport(taskReportPath, taskReport);
  } else {
    writeTaskReport(taskReportPath, taskReport);
  }
  const validationErrors = [
    ...(taskReportStrictJsonError
      ? [`TaskReport strict JSON validation failed: ${taskReportStrictJsonError}`]
      : []),
    ...validateTaskReport(taskReport, packet, validationScopes),
    ...actualFilesChanged
      .filter((changed) => !pathMatchesScope(changed, validationScopes))
      .map((changed) => `actual file outside allowedWriteScope: ${changed}`),
  ];
  const scopePassed = validationErrors.length === 0;
  if (!scopePassed && taskReport.status === 'done') {
    taskReport.status = 'blocked';
    taskReport.evidence = [...taskReport.evidence, ...validationErrors];
    writeTaskReport(taskReportPath, taskReport);
  }
  if (!scopePassed && taskReport.status !== 'done') {
    taskReport.evidence = [...taskReport.evidence, ...validationErrors];
    writeTaskReport(taskReportPath, taskReport);
  }
  const transportEnvelope = buildNoHookTransportEnvelope({
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    runId: input.runId,
    packet,
    taskReport,
  });
  const transportEnvelopeValidation = validateGovernanceTransportEnvelope(transportEnvelope, {
    governanceEventTypeRegistryPolicy: input.governanceEventTypeRegistryPolicy,
    registryPolicyHash:
      input.governanceEventTypeRegistryPolicyHash ??
      (input.governanceEventTypeRegistryPolicy
        ? governanceEventTypeRegistryPolicyHash(input.governanceEventTypeRegistryPolicy)
        : undefined),
    governanceEventTypeRegistry: input.governanceEventTypeRegistry,
    registryHash:
      input.governanceEventTypeRegistryHash ??
      (input.governanceEventTypeRegistry
        ? governanceEventTypeRegistryHash(input.governanceEventTypeRegistry)
        : undefined),
    architectureConfirmationHash,
  });
  const confirmedRefs = confirmedExecutionRefs({
    projectRoot,
    record: requirementRecord,
    packet,
  });
  const traceRows = input.traceRows ?? confirmedRefs.traceRows;
  const coveredRequirementIds =
    input.coveredRequirementIds ?? confirmedRefs.coveredRequirementIds;
  const taskRefs = input.taskRefs ?? confirmedRefs.taskRefs;
  const subagentArtifactRefs = taskReportArtifactRefs({
    projectRoot,
    taskReport,
    fallbackRequirementIds: coveredRequirementIds,
  });
  const commandRun = {
    commandId: input.smoke ? 'CMD-CODEX-WORKER-ADAPTER-SMOKE' : 'CMD-CODEX-WORKER-ADAPTER',
    command: codexCommand.join(' '),
    exitCode,
    startedAt: adapterStartedAt,
    completedAt: new Date().toISOString(),
    outputSummary:
      taskReport.evidence.join('; ').slice(0, 240) || `TaskReport status ${taskReport.status}`,
    artifactRefs: subagentArtifactRefs,
    closeoutAttemptId: parentCloseoutAttemptId,
  };
  const subagentEvidenceEnvelope =
    sourceDocumentHash && implementationConfirmationHash && architectureConfirmationHash
      ? buildSubagentEvidenceEnvelopeFromTaskReport({
          packet,
          taskReport,
          recordId: input.recordId ?? input.requirementSetId ?? packet.parentSessionId,
          requirementSetId: input.requirementSetId ?? input.recordId ?? packet.parentSessionId,
          parentRunId: input.runId ?? packet.parentSessionId,
          parentCloseoutAttemptId,
          executorKind: 'codex_worker_adapter',
          executorRole: agentRole,
          sourceDocumentHash,
          implementationConfirmationHash,
          architectureConfirmationHash,
          traceRows,
          coveredRequirementIds,
          taskRefs,
          actualFilesChanged,
          diffHash: sha256Object(actualFilesChanged),
          workspaceRef: {
            kind: 'main_workspace',
            path: projectRoot,
            commitBefore,
            commitAfter: gitHead(projectRoot),
          },
          commandRuns: [commandRun],
          artifactRefs: subagentArtifactRefs,
          transportRefs: transportEnvelope
            ? [{ eventType: transportEnvelope.eventType, packetId: transportEnvelope.packetId }]
            : [],
        })
      : null;
  const subagentEvidenceEnvelopeValidation = subagentEvidenceEnvelope
    ? validateSubagentEvidenceEnvelope(subagentEvidenceEnvelope, {
        record: requirementRecord ?? undefined,
        projectRoot,
        indexedArtifactRefs: subagentArtifactRefs,
        expectedParentCloseoutAttemptId: parentCloseoutAttemptId,
      })
    : {
        ok: false,
        status: 'blocked' as const,
        mismatches: ['subagent_evidence_envelope_hash_context_missing'],
        sourceRefs: [],
        evidenceArtifactRefs: [],
      };

  return {
    reportType: 'main_agent_codex_worker_adapter',
    generatedAt: new Date().toISOString(),
    projectRoot,
    packetPath,
    taskReportPath,
    mode: input.smoke ? 'smoke' : 'codex_exec',
    codexCommand,
    exitCode,
    scopePassed,
    taskReport,
    stdinPath,
    stdoutPath,
    stderrPath,
    agentRole,
    agentSpecPath: agentSpec.path,
    runtimeGovernanceStatus: runtimeGovernance.status,
    runtimeGovernanceError: runtimeGovernance.error,
    actualFilesChanged,
    transportEnvelope,
    transportEnvelopeValidation,
    subagentEvidenceEnvelope,
    subagentEvidenceEnvelopeValidation,
  };
}

export function main(argv: string[]): number {
  const args = parseArgs(argv);
  if (!args.packetPath) {
    console.error('main-agent-codex-worker-adapter: --packetPath is required');
    return 1;
  }
  const report = runCodexWorkerAdapter({
    projectRoot: path.resolve(args.cwd ?? process.cwd()),
    recordId: args.recordId,
    requirementSetId: args.requirementSetId,
    runId: args.runId,
    parentCloseoutAttemptId: args.parentCloseoutAttemptId,
    sourceDocumentHash: args.sourceDocumentHash,
    implementationConfirmationHash: args.implementationConfirmationHash,
    packetPath: path.resolve(args.packetPath),
    taskReportPath: args.taskReportPath ? path.resolve(args.taskReportPath) : undefined,
    smoke: args.smoke === 'true',
    smokeTargetPath: args.smokeTargetPath,
    timeoutMs: Number(args.timeoutMs) > 0 ? Number(args.timeoutMs) : undefined,
    codexBinary: args.codexBinary,
    governanceEventTypeRegistry: args.governanceEventTypeRegistryPath
      ? JSON.parse(fs.readFileSync(path.resolve(args.governanceEventTypeRegistryPath), 'utf8'))
      : undefined,
    governanceEventTypeRegistryPolicy: args.governanceEventTypeRegistryPolicyPath
      ? JSON.parse(
          fs.readFileSync(path.resolve(args.governanceEventTypeRegistryPolicyPath), 'utf8')
        )
      : undefined,
    governanceEventTypeRegistryPolicyHash: args.governanceEventTypeRegistryPolicyHash,
    governanceEventTypeRegistryHash: args.governanceEventTypeRegistryHash,
    architectureConfirmationHash: args.architectureConfirmationHash,
    traceRows: args.traceRows
      ? args.traceRows
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : undefined,
    coveredRequirementIds: args.coveredRequirementIds
      ? args.coveredRequirementIds
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : undefined,
    taskRefs: args.taskRefs
      ? args.taskRefs
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : undefined,
  });
  const reportPath = path.resolve(
    args.reportPath ??
      path.join(
        report.projectRoot,
        '_bmad-output',
        'runtime',
        'codex',
        'worker-adapter-report.json'
      )
  );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ reportPath, ...report }, null, 2));
  return report.exitCode === 0 && report.scopePassed && report.taskReport.status === 'done' ? 0 : 1;
}

function isDirectMainAgentCodexWorkerAdapterCli(entry: string | undefined): boolean {
  return /(^|[\\/])main-agent-codex-worker-adapter(\.[cm]?js|\.ts)?$/iu.test(entry ?? '');
}

if (require.main === module && isDirectMainAgentCodexWorkerAdapterCli(process.argv[1])) {
  process.exitCode = main(process.argv.slice(2));
}
