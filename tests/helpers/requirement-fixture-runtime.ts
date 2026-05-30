import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { resolveExecutionDisciplineProfile } from '../../scripts/execution-discipline-profiles';
import type {
  CompiledPromptRef,
  ExecutionPacket,
} from '../../scripts/orchestration-dispatch-contract';
import { packetArtifactPath } from '../../scripts/orchestration-dispatch-contract';
import {
  createDefaultOrchestrationState,
  writeOrchestrationStateAtPath,
} from '../../scripts/orchestration-state';
import { defaultRuntimeContextFile, writeRuntimeContext } from '../../scripts/runtime-context';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';

export const SIX_MODEL_HARDENING_FIXTURE_ID =
  'REQ-2026-05-29-MAIN-AGENT-SIX-MENTAL-MODEL-PRODUCTION-ORCHESTRATION-HARDENING';

export interface MaterializedRequirementFixture {
  root: string;
  fixtureId: string;
  sourcePath: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  recordPath: string;
  recordId: string;
  requirementSetId: string;
  runId: string;
}

function repoRoot(): string {
  return process.cwd();
}

function sha256Text(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function sha256File(filePath: string): string {
  return `sha256:${createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function safeSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, '-') || 'unknown';
}

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function copyProjectConfigForRuntime(root: string): void {
  for (const relativePath of [
    path.join('_bmad', '_config', 'audit-item-mapping.yaml'),
    path.join('_bmad', '_config', 'code-reviewer-config.yaml'),
  ]) {
    const source = path.join(repoRoot(), relativePath);
    const target = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`
    )
    .join(',')}}`;
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function expandSixModelResults(input: {
  rawResults?: Record<string, unknown>;
  recordId: string;
  requirementSetId: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
}): Record<string, unknown> {
  const models = input.rawResults ?? {
    requirement_confirmation: { status: 'pass' },
    architecture_confirmation: { status: 'pass' },
    implementation_readiness: { status: 'pass' },
  };
  const currentHashes = {
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
  };
  return Object.fromEntries(
    Object.entries(models).map(([model, raw]) => {
      const value = objectRecord(raw);
      return [
        model,
        {
          ...value,
          payloadKind: 'model_result',
          model,
          recordId: input.recordId,
          requirementSetId: input.requirementSetId,
          sourceDocumentHash: input.sourceDocumentHash,
          implementationConfirmationHash: input.implementationConfirmationHash,
          status: typeof value.status === 'string' ? value.status : 'pass',
          resultRecordedAt:
            typeof value.resultRecordedAt === 'string'
              ? value.resultRecordedAt
              : '2026-05-30T00:00:00.000Z',
          resultRecordedBy:
            typeof value.resultRecordedBy === 'string' ? value.resultRecordedBy : 'fixture',
          blockingReasons: Array.isArray(value.blockingReasons) ? value.blockingReasons : [],
          sourceRefs: Array.isArray(value.sourceRefs)
            ? value.sourceRefs
            : [{ sourceType: 'confirmation_history', id: 'confirmation_recorded' }],
          currentHashes: objectRecord(value.currentHashes),
          ...(Object.keys(objectRecord(value.currentHashes)).length > 0 ? {} : { currentHashes }),
        },
      ];
    })
  );
}

export function createTempRequirementWorkspace(prefix = 'requirement-fixture-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function cleanupRequirementWorkspace(root: string): void {
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

export function materializeRequirementFixture(
  input: {
    fixtureId?: string;
    root?: string;
    currentMentalModel?: string;
    sixModelResults?: Record<string, unknown>;
    orchestrationNextAction?: string | null;
    pendingPacket?: {
      packetId: string;
      packetKind?: 'execution' | 'resume' | 'recommendation';
      status?: string;
    } | null;
    lastTaskReport?: { packetId: string; status: 'done' | 'partial' | 'blocked' } | null;
  } = {}
): MaterializedRequirementFixture {
  const fixtureId = input.fixtureId ?? SIX_MODEL_HARDENING_FIXTURE_ID;
  const root = input.root ?? createTempRequirementWorkspace(`fixture-${safeSegment(fixtureId)}-`);
  copyProjectConfigForRuntime(root);
  const fixtureRoot = path.join(repoRoot(), 'tests', 'fixtures', 'requirements', fixtureId);
  const manifest = readJson(path.join(fixtureRoot, 'fixture-manifest.json'));
  const recordId = String(manifest.recordId);
  const requirementSetId = String(manifest.requirementSetId);
  const runId = String(manifest.runId);
  const sourceText = fs.readFileSync(path.join(fixtureRoot, String(manifest.sourceFile)), 'utf8');
  const sourcePath = path.join(
    root,
    'test-inputs',
    'requirements',
    fixtureId,
    'source.requirement.md'
  );
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, sourceText, 'utf8');

  const sourceDocumentHash = sha256Text(sourceText);
  const semanticConfirmation = {
    recordId,
    requirementSetId,
    flow: manifest.flow,
    stage: manifest.stage,
    traceRows: [
      'TRACE-010',
      'TRACE-011',
      'TRACE-012',
      'TRACE-013',
      'TRACE-014',
      'TRACE-015',
      'TRACE-016',
    ],
  };
  const implementationConfirmationHash = sha256Text(stableStringify(semanticConfirmation));
  const recordRoot = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    requirementSetId
  );
  const recordPath = path.join(recordRoot, 'requirement-record.json');
  const recoveryRoot = path.join(recordRoot, 'recovery');
  const runtimePolicySnapshotPath = path.join(recoveryRoot, 'runtime-policy-snapshot.json');
  writeJson(runtimePolicySnapshotPath, {
    kind: 'runtime-policy-snapshot',
    flow: manifest.flow,
    stage: manifest.stage,
    policy: { flow: manifest.flow, stage: manifest.stage },
  });
  writeJson(path.join(recoveryRoot, 'recovery-context.json'), { kind: 'recovery-context' });
  const confirmationRoot = path.join(recordRoot, 'confirmation');
  const renderReportPath = path.join(confirmationRoot, 'confirmation-render-report.json');
  const htmlPath = path.join(confirmationRoot, 'confirmation.html');
  writeJson(renderReportPath, {
    schemaVersion: 'requirement-fixture-confirmation-render-report/v1',
    recordId,
    requirementSetId,
    sourceDocumentHash,
    implementationConfirmationHash,
  });
  fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
  fs.writeFileSync(
    htmlPath,
    [
      '<!doctype html>',
      '<html>',
      '<body>',
      `<h1>${recordId}</h1>`,
      `<p>${sourceDocumentHash}</p>`,
      `<p>${implementationConfirmationHash}</p>`,
      '</body>',
      '</html>',
      '',
    ].join('\n'),
    'utf8'
  );
  const confirmationPageHash = sha256File(htmlPath);
  const sourcePathRelative = path.relative(root, sourcePath).replace(/\\/g, '/');
  const renderReportRelativePath = path.relative(root, renderReportPath).replace(/\\/g, '/');
  const htmlRelativePath = path.relative(root, htmlPath).replace(/\\/g, '/');
  const record = {
    schemaVersion: 'requirement-record/v1',
    recordId,
    requirementSetId,
    runId,
    status: 'user_confirmed',
    flow: manifest.flow,
    stage: manifest.stage,
    entryFlow: manifest.flow,
    sourceMode: 'full_bmad',
    sourcePath,
    artifactPath: sourcePath,
    sourceDocumentHash,
    implementationConfirmationHash,
    confirmationPageHash,
    currentMentalModel: input.currentMentalModel ?? 'implementation_readiness',
    sixModelResults: expandSixModelResults({
      rawResults: input.sixModelResults,
      recordId,
      requirementSetId,
      sourceDocumentHash,
      implementationConfirmationHash,
    }),
    confirmationHistory: [
      {
        eventType: 'confirmation_recorded',
        recordId,
        requirementSetId,
        confirmedAt: '2026-05-30T00:00:00.000Z',
        confirmedBy: 'fixture',
        sourcePath: sourcePathRelative,
        sourceDocumentHash,
        implementationConfirmationHash,
        confirmationPageHash,
        confirmationText: 'confirmed fixture requirement source for main-agent orchestration tests',
        renderReportPath: renderReportRelativePath,
        htmlPath: htmlRelativePath,
      },
    ],
    architectureConfirmationState: {
      status: 'active',
      currentArchitectureConfirmationRunId: `arch-${runId}`,
      currentArchitectureConfirmationHash: sha256Text(`arch-${runId}`),
      lastEventType: 'architecture_confirmation_recorded',
      updatedAt: '2026-05-30T00:00:00.000Z',
    },
    runtimePolicySnapshotRef: {
      artifactType: 'runtime_policy_snapshot',
      sourceOfTruthRole: 'projection',
      recordId,
      requirementSetId,
      path: path.relative(root, runtimePolicySnapshotPath).replace(/\\/g, '/'),
      hash: sha256File(runtimePolicySnapshotPath),
      producer: 'tests/helpers/requirement-fixture-runtime',
      purpose: 'Materialized runtime policy snapshot for production-flow tests',
      relatedRequirementIds: [recordId],
      status: 'active',
      inputVersion: 'runtime-policy-snapshot/v1',
      outputVersion: 'runtime-policy-snapshot/v1',
    },
  };
  writeJson(recordPath, record);
  writeJson(path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'index.json'), {
    version: 1,
    active: { recordId, requirementSetId, runId },
    records: [
      {
        recordId,
        requirementSetId,
        runId,
        recordPath: path.relative(root, recordPath).replace(/\\/g, '/'),
      },
    ],
  });
  writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
  writeRuntimeContext(
    root,
    defaultRuntimeContextFile({
      flow: 'standalone_tasks',
      stage: 'implement',
      runId,
      artifactPath: sourcePath,
      artifactRoot: path.dirname(sourcePath),
      contextScope: 'run',
      sourceMode: 'full_bmad',
    })
  );
  if (input.orchestrationNextAction || input.pendingPacket || input.lastTaskReport) {
    const packet = input.pendingPacket
      ? {
          packetId: input.pendingPacket.packetId,
          packetPath: packetArtifactPath(root, requirementSetId, input.pendingPacket.packetId),
          packetKind: input.pendingPacket.packetKind ?? 'execution',
          status: input.pendingPacket.status ?? 'completed',
          createdAt: '2026-05-30T00:00:00.000Z',
          claimOwner: null,
        }
      : null;
    const state = createDefaultOrchestrationState({
      sessionId: requirementSetId,
      host: 'codex',
      flow: 'standalone_tasks',
      currentPhase: 'implement',
      nextAction: (input.orchestrationNextAction ?? 'dispatch_implement') as never,
      pendingPacket: packet as never,
    });
    if (input.lastTaskReport) {
      state.lastTaskReport = {
        packetId: input.lastTaskReport.packetId,
        status: input.lastTaskReport.status,
        filesChanged: [],
        validationsRun: [],
        evidence: [],
      };
    }
    writeOrchestrationStateAtPath(
      path.join(recordRoot, 'orchestration', 'orchestration-state', `${requirementSetId}.json`),
      state
    );
  }
  return {
    root,
    fixtureId,
    sourcePath,
    sourceDocumentHash,
    implementationConfirmationHash,
    recordPath,
    recordId,
    requirementSetId,
    runId,
  };
}

export function writeFakeReqTraceSkill(root: string): string {
  const skillDir = path.join(root, '_bmad', 'skills', 'req-trace-matrix-prompt-generator');
  const scriptPath = path.join(skillDir, 'scripts', 'generate_prompt.js');
  fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
  fs.writeFileSync(
    scriptPath,
    [
      '#!/usr/bin/env node',
      "const fs = require('node:fs');",
      "const path = require('node:path');",
      "const crypto = require('node:crypto');",
      'function arg(name) { const i = process.argv.indexOf(name); return i === -1 ? null : process.argv[i + 1]; }',
      "function shaFile(file) { return 'sha256:' + crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }",
      "const outDir = arg('--out-dir');",
      "const recordPath = arg('--requirement-record');",
      "const profilePath = arg('--execution-discipline-profile-ref');",
      'fs.mkdirSync(outDir, { recursive: true });',
      "const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));",
      "const profile = profilePath ? JSON.parse(fs.readFileSync(profilePath, 'utf8')) : null;",
      "const modelPacket = { schemaVersion: 'model-packet-fixture/v1', artifactRole: 'execution_authority', sourceDocumentHash: record.sourceDocumentHash, implementationConfirmationHash: record.implementationConfirmationHash, executionDisciplineProfile: profile, traceOrder: ['TRACE-010','TRACE-011','TRACE-012','TRACE-013','TRACE-014','TRACE-015','TRACE-016'] };",
      "const modelPath = path.join(outDir, 'model_packet.json');",
      "const humanPath = path.join(outDir, 'human_prompt.txt');",
      "const goalPath = path.join(outDir, 'goal_execution.md');",
      "fs.writeFileSync(modelPath, JSON.stringify(modelPacket, null, 2) + '\\n', 'utf8');",
      "fs.writeFileSync(humanPath, `model_packet.json is the machine-readable execution authority\\nprofileId: ${profile?.profileId || 'none'}\\nprofileHash: ${profile?.profileHash || 'none'}\\n`, 'utf8');",
      "fs.writeFileSync(goalPath, `# Fixture Goal\\nprofileId: ${profile?.profileId || 'none'}\\nprofileHash: ${profile?.profileHash || 'none'}\\n`, 'utf8');",
      "const receipt = { decision: 'pass', goalCommand: { mode: 'native_goal_document_ref', documentHash: shaFile(goalPath) }, executionDisciplineProfile: { profileId: profile?.profileId, profileHash: profile?.profileHash, humanPromptProfileRendered: true, goalExecutionProfileRendered: true } };",
      "fs.writeFileSync(path.join(outDir, 'audit_receipt.json'), JSON.stringify(receipt, null, 2) + '\\n', 'utf8');",
      '',
    ].join('\n'),
    'utf8'
  );
  return skillDir;
}

export function writeCompiledImplementPacket(input: {
  root: string;
  fixture: MaterializedRequirementFixture;
  packetId?: string;
}): { packetPath: string; packet: ExecutionPacket; compiledPromptRef: CompiledPromptRef } {
  const packetId = input.packetId ?? 'implement-current';
  const outDir = path.join(
    input.root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    input.fixture.requirementSetId,
    'trace-execution',
    packetId
  );
  fs.mkdirSync(outDir, { recursive: true });
  const modelPacketPath = path.join(outDir, 'model_packet.json');
  const humanPromptPath = path.join(outDir, 'human_prompt.txt');
  const auditReceiptPath = path.join(outDir, 'audit_receipt.json');
  const goalExecutionPath = path.join(outDir, 'goal_execution.md');
  writeJson(modelPacketPath, {
    schemaVersion: 'model-packet-fixture/v1',
    artifactRole: 'execution_authority',
    sourceDocumentHash: input.fixture.sourceDocumentHash,
    implementationConfirmationHash: input.fixture.implementationConfirmationHash,
  });
  const profile = resolveExecutionDisciplineProfile('standalone_tasks');
  fs.writeFileSync(
    humanPromptPath,
    `compiled prompt fixture\nprofileId: ${profile.profileId}\nprofileHash: ${profile.profileHash}\n`,
    'utf8'
  );
  fs.writeFileSync(
    goalExecutionPath,
    `# goal fixture\nprofileId: ${profile.profileId}\nprofileHash: ${profile.profileHash}\n`,
    'utf8'
  );
  writeJson(auditReceiptPath, {
    decision: 'pass',
    goalCommand: {
      mode: 'native_goal_document_ref',
      documentHash: sha256File(goalExecutionPath),
    },
  });
  const compiledPromptRef: CompiledPromptRef = {
    modelPacketPath,
    modelPacketHash: sha256File(modelPacketPath),
    humanPromptPath,
    humanPromptHash: sha256File(humanPromptPath),
    auditReceiptPath,
    auditReceiptHash: sha256File(auditReceiptPath),
    goalExecutionPath,
    goalExecutionHash: sha256File(goalExecutionPath),
    sourceDocumentHash: input.fixture.sourceDocumentHash,
    implementationConfirmationHash: input.fixture.implementationConfirmationHash,
  };
  const packet: ExecutionPacket = {
    packetId,
    parentSessionId: input.fixture.requirementSetId,
    flow: 'standalone_tasks',
    phase: 'implement',
    taskType: 'implement',
    role: 'implementation-worker',
    inputArtifacts: [input.fixture.recordPath, input.fixture.sourcePath],
    allowedWriteScope: ['scripts/**', 'tests/**', '_bmad-output/**'],
    expectedDelta: 'fixture implementation packet',
    successCriteria: ['compiledPromptRef exists'],
    stopConditions: ['true blocker'],
    authorityMode: 'compiled_implementation_confirmation',
    compiledPromptRef,
    executionDisciplineProfile: profile,
    executionStrategy: {
      eventType: 'execution_strategy_selected',
      strategyId: 'compiled_trace_direct',
      availability: 'available',
      selectedBy: 'policy',
      strategyOptionsHash: sha256Text('fixture-options'),
      selectedOptionHash: sha256Text('fixture-option'),
      modelPacketHash: compiledPromptRef.modelPacketHash,
      sourceDocumentHash: compiledPromptRef.sourceDocumentHash,
      implementationConfirmationHash: compiledPromptRef.implementationConfirmationHash,
    },
  };
  const packetPath = packetArtifactPath(input.root, input.fixture.requirementSetId, packetId);
  writeJson(packetPath, packet);
  return { packetPath, packet, compiledPromptRef };
}
