import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { vi } from 'vitest';
import {
  requirementsContractPromptTransactionPublishCommand,
  type PromptTransactionPublisherDeps,
} from '../../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prompt-transaction-publisher';
import { prepareAuditDispatchRuntime } from './prompt-transaction-audit-dispatch-fixture';
import { compiledPromptRunnerFor } from './prompt-transaction-compiled-runner-fixture';
import {
  materializePromptPublicationFixture,
  setPromptPublicationReadiness,
  writeJson,
} from './prompt-transaction-publication-fixture';
import { requiredCommandExecutionDescriptorsFromModelPacket } from '../../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-command-execution-receipt';

type PublicationFixture = ReturnType<typeof materializePromptPublicationFixture>;

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function sha256Stable(value: unknown): string {
  return `sha256:${createHash('sha256').update(stableStringify(value), 'utf8').digest('hex')}`;
}

function sha256File(filePath: string): string {
  return `sha256:${createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

export function canonicalCurrentDispatchPointerPath(root: string): string {
  return path.join(
    root,
    'docs',
    'plans',
    'evidence',
    'loop-engineering-remediation',
    'current-dispatch-pointer-receipt.json'
  );
}

export function executeRequiredCommandsForPublishedFixture(input: {
  fixture: PublicationFixture;
  pointer: Record<string, unknown>;
}): void {
  const modelPacketRef = input.pointer.modelPacketRef as Record<string, unknown>;
  const modelPacket = JSON.parse(
    fs.readFileSync(String(modelPacketRef.path), 'utf8')
  ) as Record<string, unknown>;
  const descriptors = requiredCommandExecutionDescriptorsFromModelPacket(modelPacket);
  if (descriptors.issueCodes.length > 0 || descriptors.descriptors.length === 0) {
    throw new Error(
      `published_fixture_required_command_invalid:${descriptors.issueCodes.join(',') || 'missing'}`
    );
  }
  const context = modelPacket.controlledExecutionContext as Record<string, unknown>;
  for (const descriptor of descriptors.descriptors) {
    const startedAt = new Date().toISOString();
    const run = spawnSync(descriptor.argv[0], descriptor.argv.slice(1), {
      cwd: descriptor.cwd,
      encoding: 'utf8',
      shell: false,
    });
    const endedAt = new Date().toISOString();
    const outputDir = path.dirname(descriptor.receiptPath);
    const stdoutPath = path.join(outputDir, `${descriptor.id}.stdout.log`);
    const stderrPath = path.join(outputDir, `${descriptor.id}.stderr.log`);
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(stdoutPath, run.stdout ?? '', 'utf8');
    fs.writeFileSync(stderrPath, run.stderr ?? '', 'utf8');
    const publishedAt = new Date().toISOString();
    const payload = {
      schemaVersion: 'requirements-contract-command-execution-receipt/v1',
      commandRunId: `RUN-${descriptor.id}-${Date.now()}`,
      commandId: descriptor.id,
      command: descriptor.command,
      normalizedCommand: descriptor.normalizedCommand,
      argv: descriptor.argv,
      argvHash: sha256Stable(descriptor.argv),
      cwd: descriptor.cwd,
      executorIdentity: {
        class: 'goal_controlled_executor',
        id: 'main-agent-controlled-native-goal-test-host',
      },
      hostIdentity: {
        platform: process.platform,
        architecture: process.arch,
        nodeVersion: process.version,
      },
      requirementSetId: String(context.requirementSetId),
      requirementRefs: descriptor.requirementRefs,
      transactionId: String(context.transactionId),
      implementationAttemptId: String(context.implementationAttemptId),
      architectureAuditAttemptId: String(context.architectureAuditAttemptId),
      activePhaseAuditAttemptId: String(context.activePhaseAuditAttemptId),
      contractHash: String(context.contractHash),
      inputSnapshotHash: String(context.inputSnapshotHash),
      startedAt,
      endedAt,
      exitCode: run.status ?? 1,
      signal: run.signal,
      stdoutPath,
      stdoutHash: sha256File(stdoutPath),
      stderrPath,
      stderrHash: sha256File(stderrPath),
      acceptanceRefs: descriptor.acceptanceRefs,
      traceRefs: descriptor.traceRefs,
      publication: {
        writer: 'main-agent-controlled-native-goal-test-host',
        targetPath: descriptor.receiptPath,
        publishedAt,
        readbackAt: new Date().toISOString(),
        explicitUtf8: true,
        createOnly: true,
        readbackVerified: true,
      },
      decision: run.status === 0 ? 'pass' : 'block',
    };
    writeJson(descriptor.receiptPath, {
      ...payload,
      receiptHash: sha256Stable(payload),
    });
  }
}

export async function publishImplementationPromptFixture(options: {
  configureFixture?: (fixture: PublicationFixture) => void;
  configureRecord?: (
    record: Record<string, unknown>,
    fixture: PublicationFixture
  ) => Record<string, unknown> | void;
  fixture?: PublicationFixture;
  prepareRuntime?: boolean;
} = {}) {
  const fixture = options.fixture ?? materializePromptPublicationFixture();
  fixture.options.currentDispatchPointer = canonicalCurrentDispatchPointerPath(fixture.root);
  options.configureFixture?.(fixture);
  if (options.prepareRuntime !== false) {
    prepareAuditDispatchRuntime(fixture, {
      executionClosureStatus: 'not_established',
    });
  }

  const record = JSON.parse(
    fs.readFileSync(fixture.paths.recordPath, 'utf8')
  ) as Record<string, unknown>;
  const configuredRecord = options.configureRecord?.(record, fixture) ?? record;
  const confirmationHistory = Array.isArray(configuredRecord.confirmationHistory)
    ? configuredRecord.confirmationHistory
    : [];
  writeJson(fixture.paths.recordPath, {
    ...configuredRecord,
    currentMentalModel: 'implementation_readiness',
    stage: 'implement',
    confirmationHistory: confirmationHistory.map((event) => {
      if (
        !event ||
        typeof event !== 'object' ||
        Array.isArray(event) ||
        (event as Record<string, unknown>).eventType !== 'confirmation_recorded'
      ) {
        return event;
      }
      const confirmationEvent = event as Record<string, unknown>;
      return {
        ...confirmationEvent,
        confirmationText:
          confirmationEvent.confirmationText ??
          `confirmed ${fixture.identity.requirementSetId}`,
        renderReportPath:
          confirmationEvent.renderReportPath ??
          fixture.options.requirementsConfirmationReceipt,
        htmlPath: confirmationEvent.htmlPath ?? fixture.paths.requirementsPage,
      };
    }),
  });
  setPromptPublicationReadiness(fixture, { decision: 'pass' });

  const publisherOutput: string[] = [];
  const stdout = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    publisherOutput.push(String(chunk));
    return true;
  });
  const runCompiledPrompt = compiledPromptRunnerFor(fixture, {
    goalMode: 'native_goal_document_ref',
    extraPacket: {
      packetId: fixture.identity.implementationAttemptId,
    },
  }) as unknown as NonNullable<PromptTransactionPublisherDeps['runCompiledPrompt']>;
  const publishCode = await requirementsContractPromptTransactionPublishCommand(
    fixture.options,
    { runCompiledPrompt }
  ).finally(() => stdout.mockRestore());
  if (publishCode !== 0) {
    fixture.cleanup();
    throw new Error(
      `implementation_prompt_publication_fixture_failed:${publisherOutput.join('')}`
    );
  }

  const pointer = JSON.parse(
    fs.readFileSync(fixture.options.currentDispatchPointer, 'utf8')
  ) as Record<string, unknown>;
  const auditReceipt = JSON.parse(
    fs.readFileSync(
      String((pointer.auditReceiptRef as Record<string, unknown>).path),
      'utf8'
    )
  ) as Record<string, unknown>;
  const generatorAudit = auditReceipt.generatorAudit as Record<string, unknown>;
  const continuationDirective = generatorAudit.continuationDirective as Record<
    string,
    unknown
  >;
  const goalCommandText = String(continuationDirective.directive || '');
  if (!goalCommandText) {
    fixture.cleanup();
    throw new Error('implementation_prompt_publication_goal_command_missing');
  }
  return { fixture, pointer, goalCommandText };
}
