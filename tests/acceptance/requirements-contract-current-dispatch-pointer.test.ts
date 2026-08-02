import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  publishCurrentDispatchPointer,
  resolveCurrentDispatchPointer,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-current-dispatch-pointer';
import { runtimeModeDir } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/host-runtime-mode';
import {
  writeGovernedJson,
  writeGovernedText,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-governed-write';
import {
  requirementsContractPromptTransactionPublishCommand,
  type PromptTransactionPublisherDeps,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prompt-transaction-publisher';
import {
  fileHash,
  materializePromptPublicationFixture,
  setPromptPublicationGoalAvailability,
  setPromptPublicationReadiness,
  writeJson,
} from './helpers/prompt-transaction-publication-fixture';
import { compiledPromptRunnerFor } from './helpers/prompt-transaction-compiled-runner-fixture';
import { prepareAuditDispatchRuntime } from './helpers/prompt-transaction-audit-dispatch-fixture';

const fixtures: Array<ReturnType<typeof materializePromptPublicationFixture>> = [];
const externalRoots: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  while (fixtures.length > 0) fixtures.pop()?.cleanup();
  while (externalRoots.length > 0) {
    fs.rmSync(externalRoots.pop()!, { recursive: true, force: true });
  }
});

async function publishedPointerFixture(
  configure?: (fixture: ReturnType<typeof materializePromptPublicationFixture>) => void,
  goalMode: 'native_goal_document_ref' | 'direct_prompt' = 'native_goal_document_ref',
  packetTransform?: (
    packet: Record<string, any>,
    confirmation: Record<string, any>
  ) => Record<string, any>
) {
  const fixture = materializePromptPublicationFixture();
  fixtures.push(fixture);
  setPromptPublicationReadiness(fixture, { decision: 'pass' });
  configure?.(fixture);
  const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  const runCompiledPrompt = compiledPromptRunnerFor(fixture, {
    goalMode,
    extraPacket: {
      packetId: fixture.identity.implementationAttemptId,
    },
    packetTransform,
  }) as unknown as NonNullable<PromptTransactionPublisherDeps['runCompiledPrompt']>;
  const code = await requirementsContractPromptTransactionPublishCommand(fixture.options, {
    runCompiledPrompt,
  }).finally(() => stdout.mockRestore());
  expect(code).toBe(0);
  const pointer = JSON.parse(
    fs.readFileSync(fixture.options.currentDispatchPointer, 'utf8')
  );
  return { fixture, pointer };
}

async function publishedImplementationPointerFixture() {
  return publishedPointerFixture((value) => {
    value.options.currentDispatchPointer = canonicalPointerPath(value.root);
    prepareAuditDispatchRuntime(value);
    const record = JSON.parse(fs.readFileSync(value.paths.recordPath, 'utf8'));
    writeJson(value.paths.recordPath, {
      ...record,
      currentMentalModel: 'implementation_readiness',
      stage: 'implement',
      confirmationHistory: (record.confirmationHistory ?? []).map(
        (event: Record<string, unknown>) =>
          event.eventType === 'confirmation_recorded'
            ? {
                ...event,
                confirmationText:
                  event.confirmationText ?? `confirmed ${value.identity.requirementSetId}`,
                renderReportPath:
                  event.renderReportPath ?? value.options.requirementsConfirmationReceipt,
                htmlPath: event.htmlPath ?? value.paths.requirementsPage,
              }
            : event
      ),
    });
  });
}

function expectedIdentity(pointer: Record<string, any>) {
  return {
    requirementSetId: pointer.requirementSetId,
    implementationAttemptId: pointer.implementationAttemptId,
    transactionId: pointer.transactionId,
  };
}

function canonicalPointerPath(root: string): string {
  return path.join(
    root,
    'docs',
    'plans',
    'evidence',
    'loop-engineering-remediation',
    'current-dispatch-pointer-receipt.json'
  );
}

function publishPointerVariant(
  fixture: ReturnType<typeof materializePromptPublicationFixture>,
  pointer: Record<string, any>,
  name: string,
  overrides: Record<string, unknown>
): string {
  const targetPath = path.join(fixture.paths.evidenceRoot, name);
  writeGovernedJson(targetPath, { ...pointer, ...overrides });
  return targetPath;
}

function writeLegacyDecoyPacket(
  fixture: ReturnType<typeof materializePromptPublicationFixture>,
  pointer: Record<string, any>
) {
  const packetDir = path.join(
    fixture.root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    fixture.identity.requirementSetId,
    'prompts',
    'prompt-packets'
  );
  const decoyModelPacketPath = writeJson(path.join(packetDir, 'newer-decoy-model-packet.json'), {
    packetId: 'legacy-decoy',
    sourceDocumentHash: fixture.identity.sourceDocumentHash,
    implementationConfirmationHash: fixture.identity.implementationConfirmationHash,
  });
  writeJson(path.join(packetDir, 'legacy-decoy-execution-packet.json'), {
    taskType: 'implement',
    authorityMode: 'compiled_implementation_confirmation',
    compiledPromptRef: {
      modelPacketPath: decoyModelPacketPath,
      modelPacketHash: fileHash(decoyModelPacketPath),
      humanPromptPath: pointer.humanPromptRef.path,
      humanPromptHash: pointer.humanPromptRef.hash,
      auditReceiptPath: pointer.auditReceiptRef.path,
      auditReceiptHash: pointer.auditReceiptRef.hash,
      goalExecutionPath: pointer.goalExecutionRef.path,
      goalExecutionHash: pointer.goalExecutionRef.hash,
      sourceDocumentHash: fixture.identity.sourceDocumentHash,
      implementationConfirmationHash: fixture.identity.implementationConfirmationHash,
    },
  });
  return decoyModelPacketPath;
}

async function resolverForTest() {
  const module = await import(
    '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-current-dispatch-pointer'
  );
  const resolver = (
    module as typeof module & {
      resolveCurrentDispatchPointer?: (input: {
        authorityRoot: string;
        pointerPath: string;
        expected: {
          requirementSetId: string;
          implementationAttemptId: string;
          transactionId: string;
        };
      }) => {
        pointer: Record<string, unknown>;
        modelPacket: Record<string, unknown>;
        transactionManifest: Record<string, unknown>;
      };
    }
  ).resolveCurrentDispatchPointer;
  expect(
    typeof resolver,
    'current_dispatch_pointer_resolver_missing'
  ).toBe('function');
  return resolver!;
}

describe('requirements contract current dispatch pointer', () => {
  it('resolves the executable packet only through the exact current pointer', async () => {
    const resolver = await resolverForTest();
    const { fixture, pointer } = await publishedPointerFixture();
    const resolution = resolver!({
      authorityRoot: fixture.root,
      pointerPath: fixture.options.currentDispatchPointer,
      expected: expectedIdentity(pointer),
    });

    expect(resolution.pointer).toEqual(pointer);
    expect(resolution.modelPacket).toEqual(
      JSON.parse(fs.readFileSync(pointer.modelPacketRef.path, 'utf8'))
    );
    expect(resolution.transactionManifest).toEqual(
      JSON.parse(fs.readFileSync(pointer.transactionManifestRef.path, 'utf8'))
    );
  });

  it('does not scan or select a decoy packet when the exact pointer is missing', async () => {
    const resolver = await resolverForTest();
    const { fixture, pointer } = await publishedPointerFixture();
    fs.writeFileSync(
      path.join(fixture.paths.outDir, 'newer-decoy-model-packet.json'),
      `${JSON.stringify({ packetId: 'decoy' })}\n`,
      'utf8'
    );

    expect(() =>
      resolver({
        authorityRoot: fixture.root,
        pointerPath: path.join(fixture.paths.evidenceRoot, 'missing-current-pointer.json'),
        expected: expectedIdentity(pointer),
      })
    ).toThrow('current_dispatch_pointer_missing');
  });

  it('binds the main-agent dispatch consumer to the exact pointer instead of a newer packet', async () => {
    const orchestration = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration'
    );
    const consumer = (
      orchestration as typeof orchestration & {
        resolveCurrentCompiledPromptRefFromDispatchPointer?: (input: {
          authorityRoot: string;
          pointerPath: string;
          expected: {
            requirementSetId: string;
            implementationAttemptId: string;
            transactionId: string;
          };
        }) => Record<string, unknown>;
      }
    ).resolveCurrentCompiledPromptRefFromDispatchPointer;
    expect(
      typeof consumer,
      'current_dispatch_pointer_main_agent_consumer_missing'
    ).toBe('function');

    const { fixture, pointer } = await publishedPointerFixture();
    const decoyPath = path.join(
      fixture.paths.outDir,
      'newer-historical-model-packet.json'
    );
    fs.writeFileSync(
      decoyPath,
      `${JSON.stringify({
        packetId: 'newer-historical-packet',
        sourceDocumentHash: pointer.sourceDocumentHash,
        implementationConfirmationHash: 'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      })}\n`,
      'utf8'
    );
    const future = new Date(Date.now() + 60_000);
    fs.utimesSync(decoyPath, future, future);

    const compiledPromptRef = consumer!({
      authorityRoot: fixture.root,
      pointerPath: fixture.options.currentDispatchPointer,
      expected: expectedIdentity(pointer),
    });
    expect(compiledPromptRef).toMatchObject({
      modelPacketPath: pointer.modelPacketRef.path,
      modelPacketHash: pointer.modelPacketRef.hash,
      humanPromptPath: pointer.humanPromptRef.path,
      humanPromptHash: pointer.humanPromptRef.hash,
      auditReceiptPath: pointer.auditReceiptRef.path,
      auditReceiptHash: pointer.auditReceiptRef.hash,
      goalExecutionPath: pointer.goalExecutionRef.path,
      goalExecutionHash: pointer.goalExecutionRef.hash,
      sourceDocumentHash: pointer.sourceDocumentHash,
    });
    expect(compiledPromptRef.modelPacketPath).not.toBe(decoyPath);
  });

  it('returns null goal bindings for a direct-prompt current pointer', async () => {
    const orchestration = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration'
    );
    const { fixture, pointer } = await publishedPointerFixture(
      (value) => setPromptPublicationGoalAvailability(value, false),
      'direct_prompt'
    );

    expect(pointer.goalExecutionRef).toBeNull();
    expect(
      (orchestration.resolveCurrentCompiledPromptRefFromDispatchPointer as any)({
        authorityRoot: fixture.root,
        pointerPath: fixture.options.currentDispatchPointer,
        expected: expectedIdentity(pointer),
      })
    ).toMatchObject({
      modelPacketPath: pointer.modelPacketRef.path,
      goalExecutionPath: null,
      goalExecutionHash: null,
    });
  });

  it('fails closed when the frozen model packet omits its task report path', async () => {
    const { fixture, pointer } = await publishedPointerFixture(
      undefined,
      'native_goal_document_ref',
      (packet) => {
        delete packet.executionHandoff.taskReportPath;
        return packet;
      }
    );
    const orchestration = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration'
    );

    expect(() =>
      orchestration.resolveCurrentCompiledPromptRefFromDispatchPointer({
        authorityRoot: fixture.root,
        pointerPath: fixture.options.currentDispatchPointer,
        expected: expectedIdentity(pointer),
      })
    ).toThrow(
      'current_dispatch_pointer_model_packet_mismatch:executionHandoff.taskReportPath'
    );
  });

  it('fails audit dispatch closed when the exact pointer is missing instead of selecting a legacy packet', async () => {
    const { fixture, pointer } = await publishedPointerFixture((value) => {
      value.options.currentDispatchPointer = canonicalPointerPath(value.root);
      prepareAuditDispatchRuntime(value);
    });
    writeLegacyDecoyPacket(fixture, pointer);
    fs.rmSync(fixture.options.currentDispatchPointer);
    fs.rmSync(`${fixture.options.currentDispatchPointer}.safe-write-receipt.json`);

    const orchestration = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration'
    );
    expect(() =>
      orchestration.ensureMainAgentDispatchPacket({
        projectRoot: fixture.root,
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        flow: 'standalone_tasks',
        stage: 'implement',
        host: 'codex',
        preferredPacketId: 'audit-current',
      })
    ).toThrow('current_dispatch_pointer_missing');
  });

  it('revalidates the current pointer before reusing an existing ready audit packet', async () => {
    const { fixture } = await publishedPointerFixture((value) => {
      value.options.currentDispatchPointer = canonicalPointerPath(value.root);
      prepareAuditDispatchRuntime(value);
    });
    const orchestration = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration'
    );
    const input = {
      projectRoot: fixture.root,
      recordId: fixture.authority.recordId,
      requirementSetId: fixture.identity.requirementSetId,
      runId: fixture.identity.implementationAttemptId,
      flow: 'standalone_tasks' as const,
      stage: 'implement',
      host: 'codex' as const,
      preferredPacketId: 'audit-current',
    };

    expect(orchestration.ensureMainAgentDispatchPacket(input).pendingPacketStatus).toBe(
      'ready_for_main_agent'
    );
    fs.rmSync(fixture.options.currentDispatchPointer);
    fs.rmSync(`${fixture.options.currentDispatchPointer}.safe-write-receipt.json`);

    expect(() => orchestration.ensureMainAgentDispatchPacket(input)).toThrow(
      'current_dispatch_pointer_missing'
    );
    expect(() =>
      orchestration.buildMainAgentDispatchInstruction({
        ...input,
        hydratePacket: false,
      })
    ).toThrow('current_dispatch_pointer_missing');
  });

  it('hydrates audit dispatch from the exact pointer instead of a legacy decoy packet', async () => {
    const { fixture, pointer } = await publishedPointerFixture((value) => {
      value.options.currentDispatchPointer = path.join(
        value.root,
        'docs',
        'plans',
        'evidence',
        'loop-engineering-remediation',
        'current-dispatch-pointer-receipt.json'
      );
      prepareAuditDispatchRuntime(value);
    });
    const decoyModelPacketPath = writeLegacyDecoyPacket(fixture, pointer);
    const orchestration = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration'
    );

    const surface = orchestration.ensureMainAgentDispatchPacket({
      projectRoot: fixture.root,
      recordId: fixture.authority.recordId,
      requirementSetId: fixture.identity.requirementSetId,
      runId: fixture.identity.implementationAttemptId,
      flow: 'standalone_tasks',
      stage: 'implement',
      host: 'codex',
      preferredPacketId: 'audit-current',
    });

    expect(surface.pendingPacket).toMatchObject({
      taskType: 'audit',
      compiledPromptRef: {
        modelPacketPath: pointer.modelPacketRef.path,
        modelPacketHash: pointer.modelPacketRef.hash,
        implementationConfirmationHash: fixture.identity.implementationConfirmationHash,
      },
    });
    expect((surface.pendingPacket as any).compiledPromptRef.modelPacketPath).not.toBe(
      decoyModelPacketPath
    );
  });

  it('hydrates implementation dispatch from the exact published pointer without recompiling a preferred packet', async () => {
    const { fixture, pointer } = await publishedImplementationPointerFixture();
    const orchestration = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration'
    );
    const preferredPacketId = `${pointer.implementationAttemptId}-dispatch`;

    let surface: ReturnType<typeof orchestration.ensureMainAgentDispatchPacket> | null = null;
    expect(() => {
      surface = orchestration.ensureMainAgentDispatchPacket({
        projectRoot: fixture.root,
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        flow: 'standalone_tasks',
        stage: 'implement',
        host: 'codex',
        preferredPacketId,
      });
    }).not.toThrow();

    expect(surface!.mainAgentNextAction).toBe('dispatch_implement');
    expect(surface!.pendingPacket).toMatchObject({
      packetId: preferredPacketId,
      taskType: 'implement',
      authorityMode: 'compiled_implementation_confirmation',
      legacyPromptFallbackReason: null,
      compiledPromptRef: {
        modelPacketPath: pointer.modelPacketRef.path,
        modelPacketHash: pointer.modelPacketRef.hash,
        humanPromptPath: pointer.humanPromptRef.path,
        humanPromptHash: pointer.humanPromptRef.hash,
        auditReceiptPath: pointer.auditReceiptRef.path,
        auditReceiptHash: pointer.auditReceiptRef.hash,
        goalExecutionPath: pointer.goalExecutionRef.path,
        goalExecutionHash: pointer.goalExecutionRef.hash,
        sourceDocumentHash: pointer.sourceDocumentHash,
        implementationConfirmationHash: fixture.identity.implementationConfirmationHash,
      },
    });
    expect((surface!.pendingPacket as any).compiledPromptRef.modelPacketPath).not.toContain(
      preferredPacketId
    );
  });

  it('binds active-record remediation dispatch to the exact current pointer', async () => {
    const { fixture, pointer } = await publishedImplementationPointerFixture();
    const record = JSON.parse(fs.readFileSync(fixture.paths.recordPath, 'utf8'));
    writeJson(fixture.paths.recordPath, {
      ...record,
      currentMentalModel: 'implementation_readiness',
      sixModelResults: {
        ...record.sixModelResults,
        implementation_readiness: {
          ...record.sixModelResults.implementation_readiness,
          status: 'blocked',
          blockingReasons: ['implementation_readiness_blocked'],
        },
      },
    });
    const orchestration = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration'
    );
    const input = {
      projectRoot: fixture.root,
      recordId: fixture.authority.recordId,
      requirementSetId: fixture.identity.requirementSetId,
      runId: fixture.identity.implementationAttemptId,
      flow: 'standalone_tasks' as const,
      stage: 'implement',
      host: 'codex' as const,
      preferredPacketId: `${pointer.implementationAttemptId}-remediation`,
    };

    const surface = orchestration.ensureMainAgentDispatchPacket(input);

    expect(surface.mainAgentNextAction).toBe('dispatch_remediation');
    expect(surface.pendingPacket).toMatchObject({
      taskType: 'remediate',
      authorityMode: 'compiled_implementation_confirmation',
      legacyPromptFallbackReason: null,
      compiledPromptRef: {
        modelPacketPath: pointer.modelPacketRef.path,
        modelPacketHash: pointer.modelPacketRef.hash,
      },
    });

    fs.rmSync(fixture.options.currentDispatchPointer);
    fs.rmSync(`${fixture.options.currentDispatchPointer}.safe-write-receipt.json`);
    expect(() =>
      orchestration.buildMainAgentDispatchInstruction({
        ...input,
        hydratePacket: false,
      })
    ).toThrow('current_dispatch_pointer_missing');
  });

  it('revalidates the current pointer before active-record lifecycle transitions', async () => {
    const { fixture, pointer } = await publishedImplementationPointerFixture();
    const orchestration = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration'
    );
    const ready = orchestration.ensureMainAgentDispatchPacket({
      projectRoot: fixture.root,
      recordId: fixture.authority.recordId,
      requirementSetId: fixture.identity.requirementSetId,
      runId: fixture.identity.implementationAttemptId,
      flow: 'standalone_tasks',
      stage: 'implement',
      host: 'codex',
      preferredPacketId: `${pointer.implementationAttemptId}-lifecycle-guard`,
    });
    const sessionId = ready.sessionId!;
    const packetId = ready.orchestrationState!.pendingPacket!.packetId;
    fs.rmSync(fixture.options.currentDispatchPointer);
    fs.rmSync(`${fixture.options.currentDispatchPointer}.safe-write-receipt.json`);

    expect(() =>
      orchestration.claimMainAgentPendingPacket(fixture.root, sessionId)
    ).toThrow('current_dispatch_pointer_missing');
    expect(() =>
      orchestration.markMainAgentPacketDispatched(fixture.root, sessionId, packetId)
    ).toThrow('current_dispatch_pointer_missing');
    expect(() =>
      orchestration.completeMainAgentPendingPacket(fixture.root, sessionId, packetId)
    ).toThrow('current_dispatch_pointer_missing');
  });

  it('fails closed when an active lifecycle packet payload is missing or invalid', async () => {
    const orchestration = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration'
    );
    for (const corruption of ['missing', 'invalid'] as const) {
      const { fixture, pointer } = await publishedImplementationPointerFixture();
      const ready = orchestration.ensureMainAgentDispatchPacket({
        projectRoot: fixture.root,
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        flow: 'standalone_tasks',
        stage: 'implement',
        host: 'codex',
        preferredPacketId: `${pointer.implementationAttemptId}-${corruption}-payload`,
      });
      const sessionId = ready.sessionId!;
      const pending = ready.orchestrationState!.pendingPacket!;
      if (corruption === 'missing') {
        fs.rmSync(pending.packetPath);
      } else {
        fs.writeFileSync(pending.packetPath, '{invalid-json', 'utf8');
      }

      expect(() =>
        orchestration.claimMainAgentPendingPacket(fixture.root, sessionId)
      ).toThrow('pending_packet_payload_missing_or_invalid');
      expect(() =>
        orchestration.markMainAgentPacketDispatched(fixture.root, sessionId, pending.packetId)
      ).toThrow('pending_packet_payload_missing_or_invalid');
      expect(() =>
        orchestration.completeMainAgentPendingPacket(fixture.root, sessionId, pending.packetId)
      ).toThrow('pending_packet_payload_missing_or_invalid');
    }
  });

  it('revalidates the current pointer before TaskReport completion mutates lifecycle state', async () => {
    const { fixture, pointer } = await publishedImplementationPointerFixture();
    const orchestration = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration'
    );
    const ready = orchestration.ensureMainAgentDispatchPacket({
      projectRoot: fixture.root,
      recordId: fixture.authority.recordId,
      requirementSetId: fixture.identity.requirementSetId,
      runId: fixture.identity.implementationAttemptId,
      flow: 'standalone_tasks',
      stage: 'implement',
      host: 'codex',
      preferredPacketId: `${pointer.implementationAttemptId}-task-report-completion`,
    });
    const sessionId = ready.sessionId!;
    const packetId = ready.orchestrationState!.pendingPacket!.packetId;
    fs.rmSync(fixture.options.currentDispatchPointer);
    fs.rmSync(`${fixture.options.currentDispatchPointer}.safe-write-receipt.json`);

    expect(() =>
      orchestration.ingestMainAgentTaskReport(fixture.root, sessionId, {
        packetId,
        status: 'done',
        filesChanged: [],
        validationsRun: [],
        evidence: [],
        downstreamContext: [],
      }, {
        nativeGoalProvenanceValidated: true,
      })
    ).toThrow('current_dispatch_pointer_missing');
  });

  it('fails closed when a compiled remediation packet loses its active record binding', async () => {
    const { fixture, pointer } = await publishedImplementationPointerFixture();
    const record = JSON.parse(fs.readFileSync(fixture.paths.recordPath, 'utf8'));
    writeJson(fixture.paths.recordPath, {
      ...record,
      currentMentalModel: 'implementation_readiness',
      sixModelResults: {
        ...record.sixModelResults,
        implementation_readiness: {
          ...record.sixModelResults.implementation_readiness,
          status: 'blocked',
          blockingReasons: ['implementation_readiness_blocked'],
        },
      },
    });
    const orchestration = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration'
    );
    const ready = orchestration.ensureMainAgentDispatchPacket({
      projectRoot: fixture.root,
      recordId: fixture.authority.recordId,
      requirementSetId: fixture.identity.requirementSetId,
      runId: fixture.identity.implementationAttemptId,
      flow: 'standalone_tasks',
      stage: 'implement',
      host: 'codex',
      preferredPacketId: `${pointer.implementationAttemptId}-missing-record`,
    });
    fs.rmSync(
      path.join(
        fixture.root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        'index.json'
      )
    );

    expect(() =>
      orchestration.claimMainAgentPendingPacket(fixture.root, ready.sessionId!)
    ).toThrow('current_dispatch_pointer_expected_identity_missing:requirementRecord');
  });

  it('accepts the publisher-wrapped generator audit when validating native goal readiness', async () => {
    const { fixture, pointer } = await publishedImplementationPointerFixture();
    const orchestration = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration'
    );
    const preferredPacketId = `${pointer.implementationAttemptId}-native-readiness`;

    orchestration.ensureMainAgentDispatchPacket({
      projectRoot: fixture.root,
      recordId: fixture.authority.recordId,
      requirementSetId: fixture.identity.requirementSetId,
      runId: fixture.identity.implementationAttemptId,
      flow: 'standalone_tasks',
      stage: 'implement',
      host: 'codex',
      preferredPacketId,
    });

    expect(
      fs.existsSync(
        path.join(
          runtimeModeDir(fixture.root, fixture.authority.recordId, preferredPacketId),
          'runtime-blocker.json'
        )
      )
    ).toBe(false);
  });

  it('routes a publisher-wrapped native goal receipt through the production run loop', async () => {
    const { fixture } = await publishedImplementationPointerFixture();
    const orchestration = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration'
    );

    const result = orchestration.runMainAgentAutomaticLoop({
      projectRoot: fixture.root,
      recordId: fixture.authority.recordId,
      requirementSetId: fixture.identity.requirementSetId,
      runId: fixture.identity.implementationAttemptId,
      flow: 'standalone_tasks',
      stage: 'implement',
      host: 'codex',
    });

    expect(result.steps.some((step) => step.step === 'native-goal-invocation')).toBe(true);
    const dispatchPacketId = result.dispatchInstruction!.packetId;
    const invocationReceipt = JSON.parse(
      fs.readFileSync(
        path.join(
          runtimeModeDir(fixture.root, fixture.authority.recordId, dispatchPacketId),
          'native-goal-invocation-receipt.json'
        ),
        'utf8'
      )
    );
    expect(invocationReceipt.taskReportPath).toBe(fixture.options.taskReportPath);
  });

  it('keeps the current pointer valid while building the implementation dispatch instruction', async () => {
    const { fixture, pointer } = await publishedImplementationPointerFixture();
    const orchestration = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration'
    );
    const input = {
      projectRoot: fixture.root,
      recordId: fixture.authority.recordId,
      requirementSetId: fixture.identity.requirementSetId,
      runId: fixture.identity.implementationAttemptId,
      flow: 'standalone_tasks' as const,
      stage: 'implement',
      host: 'codex' as const,
      preferredPacketId: `${pointer.implementationAttemptId}-instruction`,
    };

    expect(orchestration.ensureMainAgentDispatchPacket(input).pendingPacketStatus).toBe(
      'ready_for_main_agent'
    );
    expect(() =>
      orchestration.buildMainAgentDispatchInstruction({
        ...input,
        hydratePacket: false,
      })
    ).not.toThrow();
  });

  it('keeps the frozen dispatch pointer valid after live requirement runtime evidence changes', async () => {
    const { fixture, pointer } = await publishedImplementationPointerFixture();
    const liveRecord = JSON.parse(fs.readFileSync(fixture.paths.recordPath, 'utf8'));
    writeJson(fixture.paths.recordPath, {
      ...liveRecord,
      nativeGoalHandoff: {
        schemaVersion: 'native-goal-handoff/v1',
        packetId: fixture.identity.implementationAttemptId,
        imported: true,
        importStatus: 'task_report_done',
      },
      executionIterations: [
        ...((liveRecord.executionIterations as Record<string, unknown>[] | undefined) ?? []),
        {
          eventType: 'execution_iteration_recorded',
          executionIterationId: fixture.identity.implementationAttemptId,
          authorityClass: 'untrusted_claim',
        },
      ],
    });

    expect(path.resolve(pointer.requirementRecordRef.path)).not.toBe(
      path.resolve(fixture.paths.recordPath)
    );
    const resolved = resolveCurrentDispatchPointer({
      authorityRoot: fixture.root,
      pointerPath: fixture.options.currentDispatchPointer,
      expected: expectedIdentity(pointer),
    });
    expect(resolved.pointer.transactionId).toBe(fixture.identity.transactionId);
    const frozenRecord = JSON.parse(
      fs.readFileSync(pointer.requirementRecordRef.path, 'utf8')
    );
    expect(frozenRecord).not.toHaveProperty('nativeGoalHandoff');
    expect(frozenRecord).not.toHaveProperty('executionIterations');
  });

  it('replaces a reusable implementation packet whose task report binding is stale', async () => {
    const { fixture, pointer } = await publishedImplementationPointerFixture();
    const orchestration = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration'
    );
    const input = {
      projectRoot: fixture.root,
      recordId: fixture.authority.recordId,
      requirementSetId: fixture.identity.requirementSetId,
      runId: fixture.identity.implementationAttemptId,
      flow: 'standalone_tasks' as const,
      stage: 'implement',
      host: 'codex' as const,
      preferredPacketId: `${pointer.implementationAttemptId}-task-report-binding`,
    };
    const ready = orchestration.ensureMainAgentDispatchPacket(input);
    const packetPath = ready.orchestrationState!.pendingPacket!.packetPath;
    const packet = JSON.parse(fs.readFileSync(packetPath, 'utf8'));
    packet.compiledPromptRef.taskReportPath = path.join(fixture.root, 'stale-task-report.json');
    writeJson(packetPath, packet);

    const rebound = orchestration.ensureMainAgentDispatchPacket(input);

    expect((rebound.pendingPacket as any).compiledPromptRef.taskReportPath).toBe(
      fixture.options.taskReportPath
    );
  });

  it('replaces an implementation resume packet with a pointer-bound execution packet', async () => {
    const { fixture, pointer } = await publishedImplementationPointerFixture();
    const orchestration = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration'
    );
    const input = {
      projectRoot: fixture.root,
      recordId: fixture.authority.recordId,
      requirementSetId: fixture.identity.requirementSetId,
      runId: fixture.identity.implementationAttemptId,
      flow: 'standalone_tasks' as const,
      stage: 'implement',
      host: 'codex' as const,
      preferredPacketId: `${pointer.implementationAttemptId}-resume`,
    };
    const ready = orchestration.ensureMainAgentDispatchPacket(input);
    const statePath = ready.orchestrationStatePath!;
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const packetPath = state.pendingPacket.packetPath;
    writeJson(packetPath, {
      packetId: state.pendingPacket.packetId,
      parentSessionId: fixture.identity.requirementSetId,
      originalExecutionPacketId: state.pendingPacket.packetId,
      flow: 'standalone_tasks',
      phase: 'implement',
      role: 'implementation-worker',
      resumeReason: 'resume the implementation packet',
      inputArtifacts: [],
      allowedWriteScope: ['src/**', 'tests/**'],
      expectedDelta: 'resume implementation',
      successCriteria: ['implementation completes'],
      stopConditions: ['blocked'],
    });
    writeJson(statePath, {
      ...state,
      originalExecutionPacketId: state.pendingPacket.packetId,
      pendingPacket: {
        ...state.pendingPacket,
        packetKind: 'resume',
      },
    });

    const rebound = orchestration.ensureMainAgentDispatchPacket({
      ...input,
      preferredPacketId: `${pointer.implementationAttemptId}-resume-rebound`,
    });

    expect(rebound.orchestrationState?.pendingPacket?.packetKind).toBe('execution');
    expect(rebound.pendingPacket).toMatchObject({
      taskType: 'implement',
      authorityMode: 'compiled_implementation_confirmation',
      compiledPromptRef: {
        modelPacketPath: pointer.modelPacketRef.path,
        modelPacketHash: pointer.modelPacketRef.hash,
        taskReportPath: fixture.options.taskReportPath,
      },
    });
  });

  it('does not dispatch a ready audit packet whose compiled prompt ref is stale', async () => {
    const { fixture } = await publishedPointerFixture((value) => {
      value.options.currentDispatchPointer = canonicalPointerPath(value.root);
      prepareAuditDispatchRuntime(value);
    });
    const orchestration = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration'
    );
    const input = {
      projectRoot: fixture.root,
      recordId: fixture.authority.recordId,
      requirementSetId: fixture.identity.requirementSetId,
      runId: fixture.identity.implementationAttemptId,
      flow: 'standalone_tasks' as const,
      stage: 'implement',
      host: 'codex' as const,
      preferredPacketId: 'audit-stale',
    };
    const ready = orchestration.ensureMainAgentDispatchPacket(input);
    const packetPath = ready.orchestrationState!.pendingPacket!.packetPath;
    const packet = JSON.parse(fs.readFileSync(packetPath, 'utf8'));
    packet.compiledPromptRef.modelPacketHash = `sha256:${'f'.repeat(64)}`;
    writeJson(packetPath, packet);

    expect(() =>
      orchestration.buildMainAgentDispatchInstruction({
        ...input,
        hydratePacket: false,
      })
    ).toThrow('audit_pending_packet_current_dispatch_pointer_mismatch:modelPacketHash');
  });

  it('replaces a ready audit resume packet with a pointer-bound execution packet', async () => {
    const { fixture, pointer } = await publishedPointerFixture((value) => {
      value.options.currentDispatchPointer = canonicalPointerPath(value.root);
      prepareAuditDispatchRuntime(value);
    });
    const orchestration = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration'
    );
    const input = {
      projectRoot: fixture.root,
      recordId: fixture.authority.recordId,
      requirementSetId: fixture.identity.requirementSetId,
      runId: fixture.identity.implementationAttemptId,
      flow: 'standalone_tasks' as const,
      stage: 'implement',
      host: 'codex' as const,
      preferredPacketId: 'audit-resume',
    };
    const ready = orchestration.ensureMainAgentDispatchPacket(input);
    const statePath = ready.orchestrationStatePath!;
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const packetPath = state.pendingPacket.packetPath;
    writeJson(packetPath, {
      packetId: state.pendingPacket.packetId,
      parentSessionId: fixture.identity.requirementSetId,
      originalExecutionPacketId: 'implement-original',
      flow: 'standalone_tasks',
      phase: 'implement',
      role: 'auditor',
      resumeReason: 'legacy audit resume',
      inputArtifacts: [],
      allowedWriteScope: ['docs/**'],
      expectedDelta: 'resume audit',
      successCriteria: ['audit complete'],
      stopConditions: ['blocked'],
    });
    writeJson(statePath, {
      ...state,
      originalExecutionPacketId: 'implement-original',
      pendingPacket: { ...state.pendingPacket, packetKind: 'resume' },
    });

    const rebound = orchestration.ensureMainAgentDispatchPacket({
      ...input,
      preferredPacketId: 'audit-rebound',
    });
    expect(rebound.orchestrationState?.pendingPacket?.packetKind).toBe('execution');
    expect(rebound.pendingPacket).toMatchObject({
      taskType: 'audit',
      authorityMode: 'compiled_implementation_confirmation',
      compiledPromptRef: {
        modelPacketPath: pointer.modelPacketRef.path,
        modelPacketHash: pointer.modelPacketRef.hash,
      },
    });
  });

  it.each([
    ['requirementSetId', ['requirementSetId']],
    ['implementationAttemptId', ['currentAttemptId', 'implementationAttemptId']],
    ['transactionId', ['transactionId']],
  ] as const)('fails audit dispatch closed when the active record lacks %s', async (
    expectedField,
    deletedFields
  ) => {
    const { fixture } = await publishedPointerFixture((value) => {
      value.options.currentDispatchPointer = canonicalPointerPath(value.root);
      prepareAuditDispatchRuntime(value);
    });
    const record = JSON.parse(fs.readFileSync(fixture.paths.recordPath, 'utf8'));
    for (const field of deletedFields) delete record[field];
    writeJson(fixture.paths.recordPath, record);
    const orchestration = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration'
    );

    expect(() =>
      orchestration.ensureMainAgentDispatchPacket({
        projectRoot: fixture.root,
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        flow: 'standalone_tasks',
        stage: 'implement',
        host: 'codex',
        preferredPacketId: `audit-missing-${expectedField}`,
      })
    ).toThrow(`current_dispatch_pointer_expected_identity_missing:${expectedField}`);
  });

  it.each([
    ['requirementSetId', 'other-requirement-set'],
    ['implementationAttemptId', 'other-implementation-attempt'],
    ['transactionId', 'other-transaction'],
  ] as const)('rejects a cross-context %s', async (field, value) => {
    const resolver = await resolverForTest();
    const { fixture, pointer } = await publishedPointerFixture();

    expect(() =>
      resolver({
        authorityRoot: fixture.root,
        pointerPath: fixture.options.currentDispatchPointer,
        expected: {
          ...expectedIdentity(pointer),
          [field]: value,
        },
      })
    ).toThrow(`current_dispatch_pointer_identity_mismatch:${field}`);
  });

  it('rejects an authority reference outside the explicit authority root', async () => {
    const resolver = await resolverForTest();
    const { fixture, pointer } = await publishedPointerFixture();
    const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-pointer-authority-'));
    externalRoots.push(outsideRoot);
    const escapedRecord = path.join(outsideRoot, 'requirement-record.json');
    fs.copyFileSync(pointer.requirementRecordRef.path, escapedRecord);
    const pointerPath = publishPointerVariant(
      fixture,
      pointer,
      'authority-ref-escape.json',
      {
        requirementRecordRef: {
          path: escapedRecord,
          hash: fileHash(escapedRecord),
        },
      }
    );

    expect(() =>
      resolver({
        authorityRoot: fixture.root,
        pointerPath,
        expected: expectedIdentity(pointer),
      })
    ).toThrow('current_dispatch_pointer_reference_outside_authority_root:requirementRecordRef');
  });

  it('rejects a consumer reference outside the pointer consumer root', async () => {
    const resolver = await resolverForTest();
    const { fixture, pointer } = await publishedPointerFixture();
    const escapedMarker = writeJson(
      path.join(fixture.root, 'escaped-consumer-marker.json'),
      JSON.parse(fs.readFileSync(pointer.consumerRef.marker.path, 'utf8'))
    );
    const pointerPath = publishPointerVariant(
      fixture,
      pointer,
      'consumer-ref-escape.json',
      {
        consumerRef: {
          ...pointer.consumerRef,
          marker: { path: escapedMarker, hash: fileHash(escapedMarker) },
        },
      }
    );

    expect(() =>
      resolver({
        authorityRoot: fixture.root,
        pointerPath,
        expected: expectedIdentity(pointer),
      })
    ).toThrow('current_dispatch_pointer_reference_outside_consumer_root:consumerRef.marker');
  });

  it('rejects a symlink that lexically stays in the authority root but resolves outside it', async () => {
    const resolver = await resolverForTest();
    const { fixture, pointer } = await publishedPointerFixture();
    const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-pointer-symlink-'));
    externalRoots.push(outsideRoot);
    const escapedRecord = path.join(outsideRoot, 'requirement-record.json');
    fs.copyFileSync(pointer.requirementRecordRef.path, escapedRecord);
    const linkRoot = path.join(fixture.root, 'linked-authority');
    fs.symlinkSync(outsideRoot, linkRoot, process.platform === 'win32' ? 'junction' : 'dir');
    const linkedRecord = path.join(linkRoot, 'requirement-record.json');
    const pointerPath = publishPointerVariant(
      fixture,
      pointer,
      'authority-symlink-escape.json',
      {
        requirementRecordRef: {
          path: linkedRecord,
          hash: fileHash(linkedRecord),
        },
      }
    );

    expect(() =>
      resolver({
        authorityRoot: fixture.root,
        pointerPath,
        expected: expectedIdentity(pointer),
      })
    ).toThrow('current_dispatch_pointer_reference_outside_authority_root:requirementRecordRef');
  });

  it('rejects a packet whose published hash no longer matches', async () => {
    const resolver = await resolverForTest();
    const { fixture, pointer } = await publishedPointerFixture();
    fs.appendFileSync(pointer.modelPacketRef.path, '\n', 'utf8');

    expect(() =>
      resolver({
        authorityRoot: fixture.root,
        pointerPath: fixture.options.currentDispatchPointer,
        expected: expectedIdentity(pointer),
      })
    ).toThrow('current_dispatch_pointer_reference_hash_mismatch:modelPacketRef');
  });

  it('rejects a tampered non-readback reference', async () => {
    const resolver = await resolverForTest();
    const { fixture, pointer } = await publishedPointerFixture();
    fs.appendFileSync(pointer.requirementRecordRef.path, '\n', 'utf8');

    expect(() =>
      resolver({
        authorityRoot: fixture.root,
        pointerPath: fixture.options.currentDispatchPointer,
        expected: expectedIdentity(pointer),
      })
    ).toThrow('current_dispatch_pointer_reference_hash_mismatch:requirementRecordRef');
  });

  it('rejects a manifest whose internal transaction identity differs from the pointer', async () => {
    const resolver = await resolverForTest();
    const { fixture, pointer } = await publishedPointerFixture();
    const manifest = JSON.parse(
      fs.readFileSync(pointer.transactionManifestRef.path, 'utf8')
    );
    const manifestWrite = writeGovernedJson(pointer.transactionManifestRef.path, {
      ...manifest,
      transactionId: 'TX-OTHER',
    });
    const targetPath = path.join(
      fixture.paths.evidenceRoot,
      'cross-transaction-current-pointer.json'
    );
    publishCurrentDispatchPointer({
      authorityRoot: fixture.root,
      targetPath,
      expectedPreimageHash: null,
      pointer: {
        ...pointer,
        transactionManifestRef: manifestWrite.targetRef,
      },
    });

    expect(() =>
      resolver({
        authorityRoot: fixture.root,
        pointerPath: targetPath,
        expected: expectedIdentity(pointer),
      })
    ).toThrow('current_dispatch_pointer_transaction_manifest_mismatch:transactionId');
  });

  it('rejects a manifest whose core authority ref differs from the pointer', async () => {
    const resolver = await resolverForTest();
    const { fixture, pointer } = await publishedPointerFixture();
    const manifest = JSON.parse(
      fs.readFileSync(pointer.transactionManifestRef.path, 'utf8')
    );
    manifest.requirementRecordRef.hash = `sha256:${'e'.repeat(64)}`;
    const manifestWrite = writeGovernedJson(pointer.transactionManifestRef.path, manifest);
    const auditReceipt = JSON.parse(fs.readFileSync(pointer.auditReceiptRef.path, 'utf8'));
    auditReceipt.promptTransaction.manifestHash = manifestWrite.targetRef.hash;
    const auditWrite = writeGovernedJson(pointer.auditReceiptRef.path, auditReceipt);
    const pointerPath = publishPointerVariant(
      fixture,
      pointer,
      'manifest-core-ref-mismatch.json',
      {
        transactionManifestRef: manifestWrite.targetRef,
        auditReceiptRef: auditWrite.targetRef,
      }
    );

    expect(() =>
      resolver({
        authorityRoot: fixture.root,
        pointerPath,
        expected: expectedIdentity(pointer),
      })
    ).toThrow('current_dispatch_pointer_transaction_manifest_mismatch:requirementRecordRef');
  });

  it('rejects a model packet that restores an execution authority claim', async () => {
    const resolver = await resolverForTest();
    const { fixture, pointer } = await publishedPointerFixture();
    const modelPacket = JSON.parse(fs.readFileSync(pointer.modelPacketRef.path, 'utf8'));
    modelPacket.authorityPolicy.executionAuthorityClaim = true;
    const modelWrite = writeGovernedJson(pointer.modelPacketRef.path, modelPacket);
    const manifest = JSON.parse(
      fs.readFileSync(pointer.transactionManifestRef.path, 'utf8')
    );
    manifest.outputs.modelPacket.hash = modelWrite.targetRef.hash;
    const manifestWrite = writeGovernedJson(pointer.transactionManifestRef.path, manifest);
    const auditReceipt = JSON.parse(fs.readFileSync(pointer.auditReceiptRef.path, 'utf8'));
    auditReceipt.promptTransaction.manifestHash = manifestWrite.targetRef.hash;
    auditReceipt.promptTransaction.modelPacketHash = modelWrite.targetRef.hash;
    const auditWrite = writeGovernedJson(pointer.auditReceiptRef.path, auditReceipt);
    const pointerPath = publishPointerVariant(
      fixture,
      pointer,
      'model-packet-authority-policy-mismatch.json',
      {
        modelPacketRef: modelWrite.targetRef,
        transactionManifestRef: manifestWrite.targetRef,
        auditReceiptRef: auditWrite.targetRef,
      }
    );

    expect(() =>
      resolver({
        authorityRoot: fixture.root,
        pointerPath,
        expected: expectedIdentity(pointer),
      })
    ).toThrow('current_dispatch_pointer_model_packet_authority_policy_invalid');
  });

  it('rejects a tampered pointer safe-write receipt', async () => {
    const resolver = await resolverForTest();
    const { fixture, pointer } = await publishedPointerFixture();
    const receiptPath = `${fixture.options.currentDispatchPointer}.safe-write-receipt.json`;
    const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
    fs.writeFileSync(
      receiptPath,
      `${JSON.stringify({ ...receipt, finalHash: pointer.sourceDocumentHash }, null, 2)}\n`,
      'utf8'
    );

    expect(() =>
      resolver({
        authorityRoot: fixture.root,
        pointerPath: fixture.options.currentDispatchPointer,
        expected: expectedIdentity(pointer),
      })
    ).toThrow('current_dispatch_pointer_safe_write_receipt_invalid');
  });

  it.each([
    ['missing required field', (receipt: Record<string, unknown>) => {
      delete receipt.mode;
    }],
    ['unexpected field', (receipt: Record<string, unknown>) => {
      receipt.unexpected = true;
    }],
  ])('rejects a malformed pointer safe-write receipt with %s', async (_label, mutate) => {
    const resolver = await resolverForTest();
    const { fixture, pointer } = await publishedPointerFixture();
    const receiptPath = `${fixture.options.currentDispatchPointer}.safe-write-receipt.json`;
    const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
    mutate(receipt);
    fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');

    expect(() =>
      resolver({
        authorityRoot: fixture.root,
        pointerPath: fixture.options.currentDispatchPointer,
        expected: expectedIdentity(pointer),
      })
    ).toThrow('current_dispatch_pointer_safe_write_receipt_invalid');
  });

  it.each([
    ['humanPromptRef', 'humanPrompt'],
    ['auditReceiptRef', 'auditReceipt'],
    ['goalExecutionRef', 'goalExecution'],
  ] as const)('rejects a %s path that disagrees with the transaction manifest output', async (
    pointerRefName,
    manifestOutputName
  ) => {
    const resolver = await resolverForTest();
    const { fixture, pointer } = await publishedPointerFixture();
    const sourceRef = pointer[pointerRefName];
    const mismatchPath = path.join(
      fixture.paths.outDir,
      `mismatched-${path.basename(sourceRef.path)}`
    );
    const mismatchWrite =
      pointerRefName === 'auditReceiptRef'
        ? writeGovernedJson(
            mismatchPath,
            JSON.parse(fs.readFileSync(sourceRef.path, 'utf8'))
          )
        : writeGovernedText(mismatchPath, fs.readFileSync(sourceRef.path, 'utf8'));
    const pointerPath = publishPointerVariant(
      fixture,
      pointer,
      `${manifestOutputName}-output-mismatch.json`,
      { [pointerRefName]: mismatchWrite.targetRef }
    );

    expect(() =>
      resolver({
        authorityRoot: fixture.root,
        pointerPath,
        expected: expectedIdentity(pointer),
      })
    ).toThrow(
      `current_dispatch_pointer_transaction_manifest_output_mismatch:${manifestOutputName}`
    );
  });

  it('rejects publication when the pointer packet reference is absent', async () => {
    const { fixture, pointer } = await publishedPointerFixture();
    const targetPath = path.join(
      fixture.paths.evidenceRoot,
      'invalid-current-dispatch-pointer.json'
    );
    const missingPacketPath = path.join(
      fixture.paths.outDir,
      'missing-model-packet.json'
    );

    expect(() =>
      publishCurrentDispatchPointer({
        authorityRoot: fixture.root,
        targetPath,
        expectedPreimageHash: null,
        pointer: {
          ...pointer,
          modelPacketRef: {
            ...pointer.modelPacketRef,
            path: missingPacketPath,
          },
        },
      })
    ).toThrow('current_dispatch_pointer_reference_missing:modelPacketRef');
    expect(fs.existsSync(targetPath)).toBe(false);
  });
});
