import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';
import yaml from 'js-yaml';
import { vi } from 'vitest';
import {
  fileHash,
  writeJson,
  writeText,
} from './prompt-transaction-publication-fixture';

type PublicationFixture = ReturnType<
  typeof import('./prompt-transaction-publication-fixture').materializePromptPublicationFixture
>;
type CompiledPromptRunnerInput = Parameters<
  typeof import('../../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-compiled-prompt-runner').runMainAgentCompiledPrompt
>[0];
type CompiledPromptRunResult =
  import('../../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-compiled-prompt-runner').CompiledPromptRunResult;
// Test fixtures mirror schema-driven production packets with dynamic JSON fields.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonRecord = Record<string, any>;
const require = createRequire(import.meta.url);
const { controlledRequiredCommandDescriptor } = require(
  path.resolve(
    '_bmad',
    'skills',
    'req-trace-matrix-prompt-generator',
    'scripts',
    'generate_prompt.js'
  )
) as {
  controlledRequiredCommandDescriptor: (
    confirmation: JsonRecord,
    command: JsonRecord,
    args: JsonRecord
  ) => JsonRecord;
};

export function compiledPromptRunnerFor(
  value: PublicationFixture,
  options: {
    artifactRole?: string;
    extraPacket?: Record<string, unknown>;
    extraOutputName?: string;
    goalMode?: 'native_goal_document_ref' | 'direct_prompt';
    packetTransform?: (packet: JsonRecord, confirmation: JsonRecord) => JsonRecord;
    runnerPath?: string;
  } = {}
) {
  return vi.fn((input: CompiledPromptRunnerInput): CompiledPromptRunResult => {
    const outDir = String(input.outDir);
    const goalMode = options.goalMode ?? 'native_goal_document_ref';
    const runnerControlledExecutionContext = {
      requirementSetId: String(input.requirementSetId),
      transactionId: String(input.transactionId),
      implementationAttemptId: String(input.implementationAttemptId),
      architectureAuditAttemptId: String(input.architectureAuditAttemptId),
      activePhaseAuditAttemptId: String(input.activePhaseAuditAttemptId),
      contractHash: String(input.contractHash),
      inputSnapshotHash: String(input.inputSnapshotHash),
      commandCwd: String(input.commandCwd),
      commandReceiptRoot: String(input.commandReceiptRoot),
    };
    const controlledExecutionContext = {
      ...runnerControlledExecutionContext,
      commandCwd: runnerControlledExecutionContext.commandCwd.replace(/\\/gu, '/'),
      commandReceiptRoot: runnerControlledExecutionContext.commandReceiptRoot.replace(/\\/gu, '/'),
    };
    const source = yaml.load(fs.readFileSync(value.paths.sourcePath, 'utf8')) as JsonRecord;
    const confirmation = source.implementationConfirmation as JsonRecord;
    const manifestProjection =
      (confirmation.aiTddContractExecutionManifestProjection as JsonRecord | undefined) ?? {};
    const requiredCommands = (confirmation.requiredCommands as JsonRecord[]).map((command) =>
      controlledRequiredCommandDescriptor(confirmation, command, controlledExecutionContext)
    );
    const packet = {
      artifactRole: options.artifactRole ?? 'execution_authority',
      sourceDocumentHash: value.identity.sourceDocumentHash,
      implementationConfirmationHash: value.identity.implementationConfirmationHash,
      controlledExecutionContext,
      traceOrder: (confirmation.traceRows as JsonRecord[]).map((row) => String(row.id)),
      atomicImplementationTaskList: confirmation.atomicImplementationTaskList,
      mustToAtomicTaskMap: confirmation.mustToAtomicTaskMap,
      atomicTaskToTraceMap: confirmation.atomicTaskToTraceMap,
      requirements: {
        must: confirmation.must,
        notDone: confirmation.notDone,
        mustNot: confirmation.mustNot,
        evidence: confirmation.evidence,
      },
      errorCaseCoverage: {
        failurePaths: confirmation.failurePaths,
        edgeCases: confirmation.edgeCases,
        acceptanceTests: confirmation.acceptanceTests,
        e2eSuites: confirmation.e2eSuites,
      },
      executionHandoff: {
        packetId: String(input.packetId),
        taskReportPath: value.options.taskReportPath,
        requiredValidationCommandRefs: requiredCommands.map((command) => command.id),
        stopConditions: [
          'reconfirm_required_on_semantic_gap',
          'scope_expansion_requires_reconfirmation',
          'validation_unavailable_requires_blocked_TaskReport',
          'write_strict_TaskReport_before_returning_to_main_agent',
        ],
      },
      requiredCommands,
      finalGateMatrix: manifestProjection.finalGateMatrix,
      executionLoopProtocol: manifestProjection.executionLoopProtocol,
      semanticGapPolicy: manifestProjection.semanticGapPolicy,
      contractExecutionManifest: {
        atomicImplementationTaskLineage: manifestProjection.atomicImplementationTaskLineage,
        requirements: [
          ...(confirmation.must as JsonRecord[]).map((row) => ({ ...row, kind: 'must' })),
          ...(confirmation.notDone as JsonRecord[]).map((row) => ({ ...row, kind: 'not_done' })),
          ...(confirmation.mustNot as JsonRecord[]).map((row) => ({ ...row, kind: 'must_not' })),
        ],
        evidence: confirmation.evidence,
        traceRows: (confirmation.traceRows as JsonRecord[]).map((row) => ({
          id: row.id,
          covers: row.covers,
          evidenceRefs: row.evidenceRefs,
          commandRefs: [
            ...new Set([
              ...(row.commandRefs ?? []),
              ...(row.contractValidationCommandRefs ?? []),
              ...(row.deliveryEvidenceCommandRefs ?? []),
            ]),
          ],
          artifactRefs: row.artifactRefs,
          canonicalSurfaceRefs: row.canonicalSurfaceRefs,
          currentTargetMapRefs: row.currentTargetMapRefs,
          targetModificationPaths: row.targetModificationPaths,
          acceptanceRefs: row.acceptanceRefs,
          status: row.status,
        })),
        requiredCommands: confirmation.requiredCommands,
        acceptanceTests: confirmation.acceptanceTests,
        e2eSuites: confirmation.e2eSuites,
        targetArtifacts: [
          ...(confirmation.artifactAutomationPlan as JsonRecord[]),
          ...((confirmation.currentTargetMap?.canonicalArtifacts as JsonRecord[] | undefined) ?? []),
          ...(
            (confirmation.currentTargetMap?.existingArtifacts as JsonRecord[] | undefined) ?? []
          ).filter((row) => Boolean(row.completionProofPolicy)),
        ],
        targetModificationPaths: confirmation.targetModificationPaths,
        currentTargetMap: confirmation.currentTargetMap,
        currentTargetMapRefs: manifestProjection.currentTargetMapRefs,
        canonicalSurfaceRefs: manifestProjection.canonicalSurfaceRefs,
        finalGateMatrix: manifestProjection.finalGateMatrix,
        executionLoopProtocol: manifestProjection.executionLoopProtocol,
        semanticGapPolicy: manifestProjection.semanticGapPolicy,
        safeWriteBindings: manifestProjection.safeWriteBindings,
      },
      ...options.extraPacket,
    };
    const packetPath = writeJson(
      path.join(outDir, 'model_packet.json'),
      options.packetTransform?.(structuredClone(packet), confirmation) ?? packet
    );
    const promptPath = writeText(
      path.join(outDir, 'human_prompt.txt'),
      'model_packet.json is the machine-readable execution authority.\ncompiled prompt\n'
    );
    const goalPath =
      goalMode === 'native_goal_document_ref'
        ? writeText(path.join(outDir, 'goal_execution.md'), '# Goal execution\n')
        : null;
    const goalCommandText =
      goalPath && goalMode === 'native_goal_document_ref'
        ? `/goal Execute ${String(input.packetId)} by following ${goalPath}; use ${packetPath} as authority.`
        : null;
    const receiptPath = writeJson(path.join(outDir, 'audit_receipt.json'), {
      decision: 'pass',
      blockingReasons: [],
      goalCommand:
        goalMode === 'native_goal_document_ref'
          ? {
              mode: goalMode,
              commandText: goalCommandText,
              chars: Array.from(goalCommandText as string).length,
              documentPath: goalPath,
              documentHash: fileHash(goalPath as string),
              taskReportPath: value.options.taskReportPath,
              packetId: String(input.packetId),
              nativeGoalCommandUsed: true,
            }
          : { mode: goalMode },
      continuationDirective:
        goalMode === 'native_goal_document_ref'
          ? {
              directive: goalCommandText,
              nativeGoalCommandUsed: true,
            }
          : null,
    });
    if (options.extraOutputName) {
      writeJson(path.join(outDir, options.extraOutputName), { unexpected: true });
    }
    const productionArgv = [
      process.execPath,
      value.paths.installedGeneratorPath,
      '--requirement-record',
      value.paths.recordPath,
      '--source-document',
      value.paths.sourcePath,
      '--out-dir',
      outDir,
      '--execution-host',
      'codex',
      '--prompt-language',
      'auto',
      '--human-prompt-profile',
      'full',
      '--json',
      '--goal-command-available',
      goalMode === 'native_goal_document_ref' ? 'true' : 'false',
      '--packet-id',
      value.identity.implementationAttemptId,
      '--task-report-path',
      value.options.taskReportPath,
      '--requirement-set-id',
      runnerControlledExecutionContext.requirementSetId,
      '--transaction-id',
      runnerControlledExecutionContext.transactionId,
      '--implementation-attempt-id',
      runnerControlledExecutionContext.implementationAttemptId,
      '--architecture-audit-attempt-id',
      runnerControlledExecutionContext.architectureAuditAttemptId,
      '--active-phase-audit-attempt-id',
      runnerControlledExecutionContext.activePhaseAuditAttemptId,
      '--contract-hash',
      runnerControlledExecutionContext.contractHash,
      '--input-snapshot-hash',
      runnerControlledExecutionContext.inputSnapshotHash,
      '--command-cwd',
      runnerControlledExecutionContext.commandCwd,
      '--command-receipt-root',
      runnerControlledExecutionContext.commandReceiptRoot,
    ];
    const stdoutPath = writeText(path.join(outDir, 'compiler.stdout.log'), '{"decision":"pass"}\n');
    const stderrPath = writeText(path.join(outDir, 'compiler.stderr.log'), '');
    const runnerPath =
      options.runnerPath ?? value.paths.installedRunnerPath;
    return {
      status: 'pass',
      confirmedSource: {
        status: 'confirmed',
        recordPath: value.paths.recordPath,
        sourcePath: value.paths.sourcePath,
        sourceDocumentHash: value.identity.sourceDocumentHash,
        implementationConfirmationHash: value.identity.implementationConfirmationHash,
      },
      outDir,
      compiledPromptRef: {
        modelPacketPath: packetPath,
        modelPacketHash: fileHash(packetPath),
        humanPromptPath: promptPath,
        humanPromptHash: fileHash(promptPath),
        auditReceiptPath: receiptPath,
        auditReceiptHash: fileHash(receiptPath),
        goalExecutionPath: goalPath,
        goalExecutionHash: goalPath ? fileHash(goalPath) : null,
        taskReportPath: value.options.taskReportPath,
        sourceDocumentHash: value.identity.sourceDocumentHash,
        implementationConfirmationHash: value.identity.implementationConfirmationHash,
      },
      blockingReasons: [],
      stdoutPath,
      stderrPath,
      auditReceiptPath: receiptPath,
      productionArgv,
      productionArgvHash: `sha256:${createHash('sha256')
        .update(JSON.stringify(productionArgv))
        .digest('hex')}`,
      generatorRef: {
        path: value.paths.installedGeneratorPath,
        hash: fileHash(value.paths.installedGeneratorPath),
      },
      runnerRef: { path: runnerPath, hash: fileHash(runnerPath) },
      executionReceipt: {
        exitCode: 0,
        stdoutHash: fileHash(stdoutPath),
        stderrHash: fileHash(stderrPath),
        startedAt: value.authority.clock.startedAt,
        completedAt: value.authority.clock.completedAt,
      },
    };
  });
}
