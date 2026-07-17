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
    confirmation: Record<string, any>,
    command: Record<string, any>,
    args: Record<string, any>
  ) => Record<string, any>;
};

export function compiledPromptRunnerFor(
  value: PublicationFixture,
  options: {
    artifactRole?: string;
    extraPacket?: Record<string, unknown>;
    extraOutputName?: string;
    goalMode?: 'native_goal_document_ref' | 'direct_prompt';
    runnerPath?: string;
  } = {}
) {
  return vi.fn((input: Record<string, any>) => {
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
    const source = yaml.load(fs.readFileSync(value.paths.sourcePath, 'utf8')) as Record<
      string,
      any
    >;
    const confirmation = source.implementationConfirmation as Record<string, any>;
    const requiredCommands = confirmation.requiredCommands.map((command: Record<string, any>) =>
      controlledRequiredCommandDescriptor(confirmation, command, controlledExecutionContext)
    );
    const packetPath = writeJson(path.join(outDir, 'model_packet.json'), {
      artifactRole: options.artifactRole ?? 'execution_authority',
      sourceDocumentHash: value.identity.sourceDocumentHash,
      implementationConfirmationHash: value.identity.implementationConfirmationHash,
      controlledExecutionContext,
      requiredCommands,
      ...options.extraPacket,
    });
    const promptPath = writeText(
      path.join(outDir, 'human_prompt.txt'),
      'model_packet.json is the machine-readable execution authority.\ncompiled prompt\n'
    );
    const goalPath =
      goalMode === 'native_goal_document_ref'
        ? writeText(path.join(outDir, 'goal_execution.md'), '# Goal execution\n')
        : null;
    const receiptPath = writeJson(path.join(outDir, 'audit_receipt.json'), {
      decision: 'pass',
      blockingReasons: [],
      goalCommand:
        goalMode === 'native_goal_document_ref'
          ? { mode: goalMode, documentHash: fileHash(goalPath as string) }
          : { mode: goalMode },
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
