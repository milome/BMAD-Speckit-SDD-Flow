import * as fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fileHash,
  materializePromptPublicationFixture,
  setPromptPublicationArchitectureNotRequired,
  setPromptPublicationReadiness,
  sha256,
  writeJson,
  writeText,
} from './helpers/prompt-transaction-publication-fixture';
import { compiledPromptRunnerFor } from './helpers/prompt-transaction-compiled-runner-fixture';

const CLI = path.join(process.cwd(), 'packages', 'bmad-speckit', 'bin', 'bmad-speckit.js');
const fixtures: Array<ReturnType<typeof materializePromptPublicationFixture>> = [];

afterEach(() => {
  while (fixtures.length > 0) fixtures.pop()?.cleanup();
});

function fixture() {
  const value = materializePromptPublicationFixture();
  fixtures.push(value);
  return value;
}

const CONTRACT_EVD_09_FIELDS = [
  'modelPacketPath',
  'modelPacketHash',
  'transactionManifestPath',
  'generationReceiptPath',
  'generationReceiptHash',
  'humanPromptPath',
  'humanPromptHash',
  'goalExecutionApplicability',
  'goalExecutionPath',
  'goalExecutionHash',
  'productionArgv',
  'productionArgvHash',
  'resolvedGeneratorPath',
  'resolvedGeneratorHash',
  'outputSetExpected',
  'outputSetObserved',
  'promptTransactionOutputSetMismatchCount',
  'promptTransactionArgvMismatchCount',
  'promptTransactionReverseHashEdgeCount',
  'safeWriteReceiptRefs',
  'modelPacketProjectionDriftCount',
  'modelPacketAuthorityClaimCount',
  'modelPacketTaskParityCount',
  'modelPacketAcceptanceParityCount',
  'modelPacketSourceObligationParityCount',
  'modelPacketCommandParityCount',
  'modelPacketStopConditionParityCount',
  'modelPacketAmendmentParityCount',
  'promptTransactionLockPath',
  'promptTransactionLockViolationCount',
  'promptTransactionStaleLockRecoveryCases',
  'promptTransactionStaleLockRecoveryMismatchCount',
  'promptTransactionQuarantineRoot',
  'promptTransactionQuarantineCases',
  'promptTransactionOrphanTransientCount',
  'promptTransactionTransientActiveReadCount',
  'transactionManifestHash',
  'sourceHashBinding',
  'sourceAmendmentHashBindings',
  'atomicPromotionCases',
  'blockedReplayCases',
  'concurrencyCases',
  'autoCommitDefault',
  'commandRunRef',
] as const;

describe('requirements contract prompt transaction production publication', () => {
  it('registers the contract-owned production publication action and exact inputs', () => {
    const result = spawnSync(
      process.execPath,
      [CLI, 'requirements-contract-prompt-transaction-publish', '--help'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: { ...process.env, RUST_BACKTRACE: '1' },
      }
    );

    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stdout).toContain('--requirement-record');
    expect(result.stdout).toContain('--attempt-context');
    expect(result.stdout).toContain('--stage-registry');
    expect(result.stdout).toContain('--requirements-confirmation-receipt');
    expect(result.stdout).toContain('--architecture-confirmation-receipt');
    expect(result.stdout).toContain('--consumer-root');
    expect(result.stdout).toContain('--current-dispatch-pointer');
    expect(result.stdout).toContain('--evidence-out');
    expect(result.stdout).not.toContain('--source-document');
    expect(result.stdout).not.toContain('--execution-host');
    expect(result.stdout).not.toContain('--goal-command-available');
    expect(result.stdout).not.toContain('--stage-five-star-matrix');
  });

  it('does not treat unknown action root help as a registered command', () => {
    const result = spawnSync(process.execPath, [CLI, 'requirements-contract-missing-action', '--help'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, RUST_BACKTRACE: '1' },
    });

    expect(result.status).not.toBe(0);
  });

  it('publishes and reads back the applicability-aware transaction, pointer, receipts, and EVD-09', async () => {
    const value = fixture();
    const module = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prompt-transaction-publisher'
    );
    const runner = compiledPromptRunnerFor(value);
    const exitCode = await module.requirementsContractPromptTransactionPublishCommand(
      value.options,
      {
        runCompiledPrompt: runner,
        now: () => value.authority.clock.observedAt.toISOString(),
      }
    );

    expect(exitCode).toBe(0);
    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner.mock.calls[0]?.[0]).toMatchObject({
      recordPath: value.paths.recordPath,
      sourcePath: value.paths.sourcePath,
      outDir: value.paths.outDir,
      packetId: value.identity.implementationAttemptId,
      taskReportPath: value.options.taskReportPath,
      executionHost: 'codex',
      goalCommandAvailable: 'true',
      reqTraceSkillDir: path.dirname(path.dirname(value.paths.installedGeneratorPath)),
    });
    const manifest = JSON.parse(
      fs.readFileSync(path.join(value.paths.outDir, 'transaction-manifest.json'), 'utf8')
    );
    const packet = JSON.parse(
      fs.readFileSync(path.join(value.paths.outDir, 'model_packet.json'), 'utf8')
    );
    const receipt = JSON.parse(
      fs.readFileSync(path.join(value.paths.outDir, 'audit_receipt.json'), 'utf8')
    );
    const pointer = JSON.parse(fs.readFileSync(value.options.currentDispatchPointer, 'utf8'));
    const evidence = JSON.parse(fs.readFileSync(value.options.evidenceOut, 'utf8'));

    expect(Object.keys(manifest.outputs)).toEqual([
      'modelPacket',
      'transactionManifestPath',
      'auditReceipt',
      'humanPrompt',
      'goalExecution',
    ]);
    expect(packet.promptTransaction).toMatchObject({
      transactionId: value.identity.transactionId,
      manifestSchemaVersion: 'requirements-contract-prompt-transaction-manifest/v1',
    });
    expect(packet.promptTransaction).not.toHaveProperty('manifestHash');
    expect(packet.artifactRole).toBe('non_authoritative_projection');
    expect(packet.authorityPolicy).toMatchObject({
      primaryAuthority: 'confirmed_source_and_requirement_record',
      modelPacketRole: 'non_authoritative_projection',
      humanPromptRole: 'non_authoritative_projection',
      executionAuthorityClaim: false,
      closeoutAuthorityClaim: false,
    });
    const humanPrompt = fs.readFileSync(path.join(value.paths.outDir, 'human_prompt.txt'), 'utf8');
    expect(humanPrompt).toContain('non-authoritative projection');
    expect(humanPrompt).not.toContain('machine-readable execution authority');
    expect(receipt.promptTransaction.manifestHash).toBe(fileHash(
      path.join(value.paths.outDir, 'transaction-manifest.json')
    ));
    expect(pointer.activationState).toBe('active');
    expect(pointer).toMatchObject({
      attemptContextRef: {
        path: value.paths.attemptContext.replace(/\\/gu, '/'),
        hash: fileHash(value.paths.attemptContext),
      },
      sourceDocumentHash: value.identity.sourceDocumentHash,
      semanticModelHash: value.identity.semanticModelHash,
      confirmationReceiptRefs: {
        requirements: {
          path: value.options.requirementsConfirmationReceipt.replace(/\\/gu, '/'),
          hash: fileHash(value.options.requirementsConfirmationReceipt),
        },
        architecture: {
          path: value.options.architectureConfirmationReceipt.replace(/\\/gu, '/'),
          hash: fileHash(value.options.architectureConfirmationReceipt),
        },
      },
      consumerRef: {
        root: value.paths.consumerRoot.replace(/\\/gu, '/'),
      },
      universeHashes: value.identity.universeHashes,
      selectionMetrics: {
        directoryScanCount: 0,
        newestFileSelectionCount: 0,
        historicalFallbackCount: 0,
        missingBindingCount: 0,
        replayRejectedCount: 0,
        casMismatchCount: 0,
        currentDispatchPointerCoverage: 1,
      },
    });
    expect(evidence.decision).toBe('PASS');
    for (const field of CONTRACT_EVD_09_FIELDS) {
      expect(evidence, `missing EVD-09 contract field: ${field}`).toHaveProperty(field);
    }
    expect(evidence).toMatchObject({
      modelPacketAuthorityClaimCount: 0,
      modelPacketProjectionDriftCount: 0,
      promptTransactionOutputSetMismatchCount: 0,
      promptTransactionArgvMismatchCount: 0,
      promptTransactionReverseHashEdgeCount: 0,
      resolvedGeneratorPath: value.paths.installedGeneratorPath.replace(/\\/gu, '/'),
      resolvedRunnerPath: value.paths.installedRunnerPath.replace(/\\/gu, '/'),
      outputSetExpected: [
        'model_packet.json',
        'transaction-manifest.json',
        'audit_receipt.json',
        'human_prompt.txt',
        'goal_execution.md',
      ],
      outputSetObserved: [
        'model_packet.json',
        'transaction-manifest.json',
        'audit_receipt.json',
        'human_prompt.txt',
        'goal_execution.md',
      ],
      autoCommitDefault: false,
    });
    expect(
      path
        .relative(value.paths.installedPackageRoot, value.paths.installedGeneratorPath)
        .replace(/\\/gu, '/')
    ).toBe('_bmad/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.js');
    expect(evidence.resolvedGeneratorPath).not.toContain(
      '/dist/main-agent/source-authority/_bmad/'
    );
    expect(evidence.capabilityObservationRef.path).not.toContain('/model_packet.json');
    expect(evidence.capabilityObservationRef.path).not.toContain('/transaction-manifest.json');
    expect(evidence.capabilityObservationRef.path).not.toContain('/audit_receipt.json');
    expect(evidence.capabilityObservationRef.path).not.toContain('/human_prompt.txt');
    expect(evidence.capabilityObservationRef.path).not.toContain('/goal_execution.md');
    for (const name of [
      'model_packet.json',
      'transaction-manifest.json',
      'audit_receipt.json',
      'human_prompt.txt',
      'goal_execution.md',
    ]) {
      expect(fs.existsSync(path.join(value.paths.outDir, `${name}.safe-write-receipt.json`))).toBe(
        true
      );
    }
    expect(JSON.stringify({ manifest, packet, receipt, pointer, evidence })).not.toMatch(
      /stageFiveStarMatrixHash|fiveStarMatrixHash|stageMatrixHash/u
    );
  });

  it('binds the controlled command execution context through runner argv and packet publication', async () => {
    const value = fixture();
    const module = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prompt-transaction-publisher'
    );
    const runner = compiledPromptRunnerFor(value);
    const commandReceiptRoot = path.join(
      value.root,
      'docs',
      'plans',
      'evidence',
      'loop-engineering-remediation',
      'command-runs',
      value.identity.transactionId,
      value.identity.implementationAttemptId,
      value.authority.architectureAuditAttemptId
    );
    const controlledExecutionContext = {
      requirementSetId: value.identity.requirementSetId,
      transactionId: value.identity.transactionId,
      implementationAttemptId: value.identity.implementationAttemptId,
      architectureAuditAttemptId: value.authority.architectureAuditAttemptId,
      activePhaseAuditAttemptId: value.authority.architectureAuditAttemptId,
      contractHash: value.identity.contractHash,
      inputSnapshotHash: fileHash(value.paths.attemptContext),
      commandCwd: path.resolve(value.root),
      commandReceiptRoot: path.resolve(commandReceiptRoot),
    };

    const exitCode = await module.requirementsContractPromptTransactionPublishCommand(
      value.options,
      {
        runCompiledPrompt: runner,
        now: () => value.authority.clock.observedAt.toISOString(),
      }
    );

    expect(exitCode).toBe(0);
    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner.mock.calls[0]?.[0]).toMatchObject(controlledExecutionContext);

    const manifest = JSON.parse(
      fs.readFileSync(path.join(value.paths.outDir, 'transaction-manifest.json'), 'utf8')
    );
    const packet = JSON.parse(
      fs.readFileSync(path.join(value.paths.outDir, 'model_packet.json'), 'utf8')
    );
    const expectedArgValues = new Map([
      ['--requirement-set-id', controlledExecutionContext.requirementSetId],
      ['--transaction-id', controlledExecutionContext.transactionId],
      ['--implementation-attempt-id', controlledExecutionContext.implementationAttemptId],
      ['--architecture-audit-attempt-id', controlledExecutionContext.architectureAuditAttemptId],
      ['--active-phase-audit-attempt-id', controlledExecutionContext.activePhaseAuditAttemptId],
      ['--contract-hash', controlledExecutionContext.contractHash],
      ['--input-snapshot-hash', controlledExecutionContext.inputSnapshotHash],
      ['--command-cwd', controlledExecutionContext.commandCwd],
      ['--command-receipt-root', controlledExecutionContext.commandReceiptRoot],
    ]);
    for (const [flag, expectedValue] of expectedArgValues) {
      const flagIndexes = manifest.productionArgv.flatMap((value: string, index: number) =>
        value === flag ? [index] : []
      );
      expect(flagIndexes, `expected one production argv binding for ${flag}`).toHaveLength(1);
      expect(manifest.productionArgv[flagIndexes[0] + 1]).toBe(expectedValue);
    }
    expect(packet.controlledExecutionContext).toEqual({
      ...controlledExecutionContext,
      commandCwd: controlledExecutionContext.commandCwd.replace(/\\/gu, '/'),
      commandReceiptRoot: controlledExecutionContext.commandReceiptRoot.replace(/\\/gu, '/'),
    });
    expect(packet.requiredCommands).toEqual([
      expect.objectContaining({
        id: value.commandAuthority.id,
        command: value.commandAuthority.command,
        normalizedCommand: value.commandAuthority.command,
        argv: value.commandAuthority.argv,
        cwd: controlledExecutionContext.commandCwd.replace(/\\/gu, '/'),
        receiptPath: path
          .join(controlledExecutionContext.commandReceiptRoot, `${value.commandAuthority.id}.json`)
          .replace(/\\/gu, '/'),
        requirementRefs: value.commandAuthority.requirementRefs,
        acceptanceRefs: value.commandAuthority.acceptanceRefs,
        traceRefs: value.commandAuthority.traceRefs,
      }),
    ]);
  });

  it('rejects caller-derived path and packet overrides before invoking the runner', async () => {
    const value = fixture();
    const module = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prompt-transaction-publisher'
    );
    const runner = compiledPromptRunnerFor(value);
    const exitCode = await module.requirementsContractPromptTransactionPublishCommand(
      { ...value.options, outDir: path.join(value.root, 'wrong-out') },
      { runCompiledPrompt: runner }
    );

    expect(exitCode).toBe(1);
    expect(runner).not.toHaveBeenCalled();
    expect(fs.existsSync(value.options.currentDispatchPointer)).toBe(false);
    expect(fs.existsSync(value.options.evidenceOut)).toBe(false);
  });

  it('rejects a missing implementation readiness PASS receipt before invoking the runner', async () => {
    const value = fixture();
    const module = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prompt-transaction-publisher'
    );
    const attempt = JSON.parse(fs.readFileSync(value.paths.attemptContext, 'utf8'));
    delete attempt.implementationReadinessReceiptRef;
    writeJson(value.paths.attemptContext, attempt);
    const runner = compiledPromptRunnerFor(value);

    expect(
      await module.requirementsContractPromptTransactionPublishCommand(value.options, {
        runCompiledPrompt: runner,
      })
    ).toBe(1);
    expect(runner).not.toHaveBeenCalled();
    expect(fs.existsSync(value.options.currentDispatchPointer)).toBe(false);
    expect(fs.existsSync(value.options.evidenceOut)).toBe(false);
  });

  it('rejects blocked, stale, and differently scoped readiness evidence before the runner', async () => {
    const module = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prompt-transaction-publisher'
    );
    const cases = [
      (value: ReturnType<typeof fixture>) =>
        setPromptPublicationReadiness(value, { decision: 'block' }),
      (value: ReturnType<typeof fixture>) =>
        setPromptPublicationReadiness(value, {
          decision: 'pass',
          implementationAttemptId: `${value.identity.implementationAttemptId}-STALE`,
        }),
      (value: ReturnType<typeof fixture>) =>
        setPromptPublicationReadiness(value, {
          decision: 'pass',
          sourceDocumentHash: sha256(`${value.identity.sourceDocumentHash}:different-scope`),
        }),
      (value: ReturnType<typeof fixture>) =>
        setPromptPublicationReadiness(value, {
          decision: 'pass',
          semanticModelHash: sha256(`${value.identity.semanticModelHash}:different-scope`),
        }),
    ];

    for (const mutate of cases) {
      const value = fixture();
      mutate(value);
      const runner = compiledPromptRunnerFor(value);
      expect(
        await module.requirementsContractPromptTransactionPublishCommand(value.options, {
          runCompiledPrompt: runner,
        })
      ).toBe(1);
      expect(runner).not.toHaveBeenCalled();
      expect(fs.existsSync(value.options.currentDispatchPointer)).toBe(false);
      expect(fs.existsSync(value.options.evidenceOut)).toBe(false);
    }
  });

  it('publishes current architecture_not_required authority without a fake architecture page', async () => {
    const value = fixture();
    setPromptPublicationArchitectureNotRequired(value);
    const module = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prompt-transaction-publisher'
    );
    const runner = compiledPromptRunnerFor(value);

    expect(
      await module.requirementsContractPromptTransactionPublishCommand(value.options, {
        runCompiledPrompt: runner,
      })
    ).toBe(0);
    expect(runner).toHaveBeenCalledOnce();
    const manifest = JSON.parse(
      fs.readFileSync(path.join(value.paths.outDir, 'transaction-manifest.json'), 'utf8')
    );
    expect(manifest.architectureAuthorityDecision).toBe('architecture_not_required');
    expect(manifest.confirmationPageRefs.architecture).toBeNull();
    const pointer = JSON.parse(
      fs.readFileSync(value.options.currentDispatchPointer, 'utf8')
    );
    expect(pointer.architectureAuthorityDecision).toBe('architecture_not_required');
    expect(pointer.confirmationPageRefs.architecture).toBeNull();
  });

  it.each([
    {
      state: 'missing',
      mutate: (record: Record<string, any>) => {
        delete record.architectureConfirmationState;
      },
    },
    {
      state: 'inactive',
      mutate: (record: Record<string, any>) => {
        record.architectureConfirmationState.status = 'stale';
      },
    },
    {
      state: 'missing_current_hash',
      mutate: (record: Record<string, any>) => {
        delete record.architectureConfirmationState.currentArchitectureConfirmationHash;
      },
    },
    {
      state: 'stale_source_binding',
      mutate: (record: Record<string, any>) => {
        const currentValue = String(
          record.architectureConfirmationState.staleInputs.sourceDocumentHash
        );
        record.architectureConfirmationState.staleInputs.sourceDocumentHash = sha256(
          `${currentValue}:mismatch`
        );
      },
    },
    {
      state: 'stale_implementation_binding',
      mutate: (record: Record<string, any>) => {
        const currentValue = String(
          record.architectureConfirmationState.staleInputs.implementationConfirmationHash
        );
        record.architectureConfirmationState.staleInputs.implementationConfirmationHash = sha256(
          `${currentValue}:mismatch`
        );
      },
    },
  ])(
    'rejects required architecture when the RequirementRecord state is $state',
    async ({ mutate }) => {
      const value = fixture();
      const record = JSON.parse(fs.readFileSync(value.paths.recordPath, 'utf8'));
      mutate(record);
      writeJson(value.paths.recordPath, record);
      const module = await import(
        '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prompt-transaction-publisher'
      );
      const runner = compiledPromptRunnerFor(value);

      expect(
        await module.requirementsContractPromptTransactionPublishCommand(value.options, {
          runCompiledPrompt: runner,
        })
      ).toBe(1);
      expect(runner).not.toHaveBeenCalled();
      expect(fs.existsSync(value.options.currentDispatchPointer)).toBe(false);
      expect(fs.existsSync(value.options.evidenceOut)).toBe(false);
    }
  );

  it('rejects mismatched architecture_not_required applicability bindings', async () => {
    const module = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prompt-transaction-publisher'
    );
    const fields = [
      'requirementSnapshotHash',
      'policyHash',
      'targetPathsHash',
      'deploymentImpactHash',
      'consumerImpactHash',
      'governanceImpactHash',
    ] as const;

    for (const field of fields) {
      const value = fixture();
      setPromptPublicationArchitectureNotRequired(value);
      const attempt = JSON.parse(fs.readFileSync(value.paths.attemptContext, 'utf8'));
      const currentValue = String(attempt.architectureApplicabilityInputs[field]);
      attempt.architectureApplicabilityInputs[field] = sha256(`${currentValue}:mismatch`);
      writeJson(value.paths.attemptContext, attempt);
      const runner = compiledPromptRunnerFor(value);

      expect(
        await module.requirementsContractPromptTransactionPublishCommand(value.options, {
          runCompiledPrompt: runner,
        })
      ).toBe(1);
      expect(runner).not.toHaveBeenCalled();
      expect(fs.existsSync(value.options.currentDispatchPointer)).toBe(false);
      expect(fs.existsSync(value.options.evidenceOut)).toBe(false);
    }
  });

  it('rejects stale confirmation hashes and Stage Five-Star matrix input edges', async () => {
    const value = fixture();
    const module = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prompt-transaction-publisher'
    );
    const stale = JSON.parse(fs.readFileSync(value.options.requirementsConfirmationReceipt, 'utf8'));
    stale.sourceDocumentHash = `sha256:${'0'.repeat(64)}`;
    writeJson(value.options.requirementsConfirmationReceipt, stale);
    const runner = compiledPromptRunnerFor(value);

    expect(
      await module.requirementsContractPromptTransactionPublishCommand(value.options, {
        runCompiledPrompt: runner,
      })
    ).toBe(1);
    const attempt = JSON.parse(fs.readFileSync(value.paths.attemptContext, 'utf8'));
    attempt.stageFiveStarMatrixHash = `sha256:${'1'.repeat(64)}`;
    writeJson(value.paths.attemptContext, attempt);
    expect(
      await module.requirementsContractPromptTransactionPublishCommand(value.options, {
        runCompiledPrompt: runner,
      })
    ).toBe(1);
    expect(runner).not.toHaveBeenCalled();
  });

  it('rejects fake generator identity and temporary-only runner success', async () => {
    const value = fixture();
    const module = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prompt-transaction-publisher'
    );
    const fakeGeneratorRunner = compiledPromptRunnerFor(value);
    fakeGeneratorRunner.mockImplementationOnce((input: Record<string, any>) => {
      const result = compiledPromptRunnerFor(value)(input);
      result.generatorRef = {
        path: path.join(value.root, 'fake-generate-prompt.js'),
        hash: `sha256:${'2'.repeat(64)}`,
      };
      return result;
    });
    expect(
      await module.requirementsContractPromptTransactionPublishCommand(value.options, {
        runCompiledPrompt: fakeGeneratorRunner,
      })
    ).toBe(1);
    for (const name of [
      'model_packet.json',
      'human_prompt.txt',
      'goal_execution.md',
    ]) {
      expect(fs.existsSync(path.join(value.paths.outDir, name))).toBe(false);
    }

    const temporaryValue = fixture();
    const temporaryOnly = vi.fn(() => ({
      ...compiledPromptRunnerFor(temporaryValue)({
        outDir: temporaryValue.paths.outDir,
      }),
      compiledPromptRef: null,
    }));
    expect(
      await module.requirementsContractPromptTransactionPublishCommand(temporaryValue.options, {
        runCompiledPrompt: temporaryOnly,
      })
    ).toBe(1);
    expect(fs.existsSync(temporaryValue.options.currentDispatchPointer)).toBe(false);
  });

  it('publishes a non-executable BLOCK transaction for post-run attestation failures', async () => {
    const value = fixture();
    const module = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prompt-transaction-publisher'
    );
    const runner = compiledPromptRunnerFor(value);
    runner.mockImplementationOnce((input: Record<string, any>) => {
      const result = compiledPromptRunnerFor(value)(input);
      result.generatorRef = {
        path: path.join(value.root, 'fake-generate-prompt.js'),
        hash: `sha256:${'2'.repeat(64)}`,
      };
      return result;
    });

    expect(
      await module.requirementsContractPromptTransactionPublishCommand(value.options, {
        runCompiledPrompt: runner,
      })
    ).toBe(1);

    const manifestPath = path.join(value.paths.outDir, 'transaction-manifest.json');
    const receiptPath = path.join(value.paths.outDir, 'audit_receipt.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
    expect(fs.existsSync(receiptPath)).toBe(true);
    expect(JSON.parse(fs.readFileSync(manifestPath, 'utf8'))).toMatchObject({
      transactionStatus: 'blocked',
      executionDisposition: 'non_executable',
      blockingReasons: ['compiled_prompt_generator_identity_mismatch'],
    });
    expect(JSON.parse(fs.readFileSync(receiptPath, 'utf8'))).toMatchObject({
      decision: 'BLOCK',
      blockingReasons: ['compiled_prompt_generator_identity_mismatch'],
    });
    expect(
      fs.existsSync(
        path.join(
          value.paths.outDir,
          '.quarantine',
          value.identity.transactionId,
          'model_packet.json'
        )
      )
    ).toBe(true);
    expect(fs.existsSync(path.join(value.paths.outDir, 'model_packet.json'))).toBe(false);
    expect(fs.existsSync(value.options.currentDispatchPointer)).toBe(false);
    expect(fs.existsSync(value.options.evidenceOut)).toBe(false);
  });

  it('blocks stale attempt replay and supports direct-prompt output applicability', async () => {
    const value = fixture();
    const module = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prompt-transaction-publisher'
    );
    const activePacket = `${JSON.stringify({
      transactionId: value.authority.lock.liveTransactionId,
    })}\n`;
    const activePacketReceipt = '{"target":"model_packet.json"}\n';
    writeText(path.join(value.paths.outDir, 'model_packet.json'), activePacket);
    writeText(
      path.join(value.paths.outDir, 'model_packet.json.safe-write-receipt.json'),
      activePacketReceipt
    );
    writeJson(value.options.currentDispatchPointer, {
      schemaVersion: 'requirements-contract-current-dispatch-pointer/v1',
      attemptSequence: 2,
      implementationAttemptId: `${value.identity.implementationAttemptId}-NEWER`,
    });
    const replayRunner = compiledPromptRunnerFor(value);
    expect(
      await module.requirementsContractPromptTransactionPublishCommand(value.options, {
        runCompiledPrompt: replayRunner,
      })
    ).toBe(1);
    expect(replayRunner).not.toHaveBeenCalled();
    expect(fs.readFileSync(path.join(value.paths.outDir, 'model_packet.json'), 'utf8')).toBe(
      activePacket
    );
    expect(
      fs.readFileSync(
        path.join(value.paths.outDir, 'model_packet.json.safe-write-receipt.json'),
        'utf8'
      )
    ).toBe(activePacketReceipt);
    expect(fs.existsSync(path.join(value.paths.outDir, '.quarantine'))).toBe(false);

    fs.rmSync(value.options.currentDispatchPointer, { force: true });
    fs.rmSync(path.join(value.paths.outDir, 'model_packet.json'), { force: true });
    fs.rmSync(path.join(value.paths.outDir, 'model_packet.json.safe-write-receipt.json'), {
      force: true,
    });
    writeText(
      value.paths.installedCliPath,
      [
        "if (process.argv[2] !== 'requirements-contract-consumer-cli-capability-observe') process.exit(64);",
        "process.stdout.write(JSON.stringify({schemaVersion:'requirements-contract-consumer-cli-capability/v1',executionHost:'codex',goalCommandAvailable:false}));",
        '',
      ].join('\n')
    );
    const actionBinding = JSON.parse(fs.readFileSync(value.paths.actionBindingManifest, 'utf8'));
    const promptActionBinding = actionBinding.actions.find((action: Record<string, any>) =>
      action.runtimeRefs?.some((ref: { role: string }) => ref.role === 'installed-cli')
    );
    expect(promptActionBinding).toBeDefined();
    const installedCliBinding = promptActionBinding.runtimeRefs.find(
      (ref: { role: string }) => ref.role === 'installed-cli'
    );
    expect(installedCliBinding).toBeDefined();
    installedCliBinding.hash = fileHash(value.paths.installedCliPath);
    writeJson(value.paths.actionBindingManifest, actionBinding);
    const profile = JSON.parse(fs.readFileSync(value.paths.consumerProjectProfile, 'utf8'));
    profile.capabilityProbeArtifactRef.hash = fileHash(value.paths.installedCliPath);
    profile.packageRuntimeActionBindingManifestRef.hash = fileHash(
      value.paths.actionBindingManifest
    );
    writeJson(value.paths.consumerProjectProfile, profile);
    const attempt = JSON.parse(fs.readFileSync(value.paths.attemptContext, 'utf8'));
    attempt.consumerProjectProfileRef.hash = fileHash(value.paths.consumerProjectProfile);
    writeJson(value.paths.attemptContext, attempt);
    const directRunner = compiledPromptRunnerFor(value, {
      goalMode: 'direct_prompt',
    });
    expect(
      await module.requirementsContractPromptTransactionPublishCommand(value.options, {
        runCompiledPrompt: directRunner,
      })
    ).toBe(0);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(value.paths.outDir, 'transaction-manifest.json'), 'utf8')
    );
    expect(manifest.hostDirective).toBe('direct_prompt');
    expect(manifest.outputs).not.toHaveProperty('goalExecution');
    expect(fs.existsSync(path.join(value.paths.outDir, 'goal_execution.md'))).toBe(false);
  });

  it('blocks pointer promotion when the frozen preimage changes before commit', async () => {
    const value = fixture();
    const module = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prompt-transaction-publisher'
    );
    const pointerModule = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-current-dispatch-pointer'
    );
    expect(
      await module.requirementsContractPromptTransactionPublishCommand(value.options, {
        runCompiledPrompt: compiledPromptRunnerFor(value),
      })
    ).toBe(0);

    const targetPath = value.options.currentDispatchPointer;
    const frozenPreimageHash = fileHash(targetPath);
    const current = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    writeJson(targetPath, {
      ...current,
      transactionId: `${current.transactionId}-CONCURRENT`,
      implementationAttemptId: `${current.implementationAttemptId}-CONCURRENT`,
      packetId: `${current.packetId}-CONCURRENT`,
      attemptSequence: current.attemptSequence + 1,
      createdAt: new Date(Date.parse(current.createdAt) + 1_000).toISOString(),
    });

    expect(() =>
      pointerModule.publishCurrentDispatchPointer({
        authorityRoot: value.root,
        targetPath,
        expectedPreimageHash: frozenPreimageHash,
        pointer: {
          ...current,
          transactionId: `${current.transactionId}-CANDIDATE`,
          implementationAttemptId: `${current.implementationAttemptId}-CANDIDATE`,
          packetId: `${current.packetId}-CANDIDATE`,
          attemptSequence: current.attemptSequence + 2,
          createdAt: new Date(Date.parse(current.createdAt) + 2_000).toISOString(),
        },
      } as any)
    ).toThrow('current_dispatch_pointer_cas_mismatch');
  });
});
