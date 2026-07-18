import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { writePassingSourcePrdLintReport } from '../../helpers/source-prd-lint-fixture';

export function sha256(value: Buffer | string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

export function fileHash(filePath: string): string {
  return sha256(fs.readFileSync(filePath));
}

export function writeJson(filePath: string, value: unknown): string {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return filePath;
}

export function writeText(filePath: string, value: string): string {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
  return filePath;
}

export function materializePromptPublicationFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-transaction-publication-'));
  const seed = randomUUID();
  const token = createHash('sha256').update(seed).digest('hex').slice(0, 16);
  const schemaToken = token.toUpperCase();
  const observedAt = new Date();
  const leaseMs = 60 * 1000;
  const authority = {
    requirementSetId: `requirements-${token}`,
    implementationAttemptId: `IMPL-ATTEMPT-${schemaToken}`,
    transactionId: `TX-${schemaToken}`,
    architectureAuditAttemptId: `AUDIT-ARCH-${schemaToken}`,
    recordId: `record-${token}`,
    consumerId: `consumer-${token}`,
    bootstrapId: `bootstrap-${token}`,
    clock: {
      observedAt,
      startedAt: new Date(observedAt.getTime() - 2_000).toISOString(),
      completedAt: new Date(observedAt.getTime() - 1_000).toISOString(),
    },
    lock: {
      host: os.hostname(),
      leaseMs,
      liveOwnerProcessId: process.pid,
      liveLockId: `lock-live-${token}`,
      liveTransactionId: `transaction-live-${token}`,
      staleLockId: `lock-stale-${token}`,
      staleTransactionId: `transaction-stale-${token}`,
      currentLockId: `lock-current-${token}`,
      ownerProcessId: process.pid + Number.parseInt(token.slice(0, 4), 16) + 1,
      liveAcquiredAt: observedAt.toISOString(),
      liveLeaseExpiresAt: new Date(observedAt.getTime() + leaseMs).toISOString(),
      staleAcquiredAt: new Date(observedAt.getTime() - 2 * leaseMs).toISOString(),
      staleLeaseExpiresAt: new Date(observedAt.getTime() - leaseMs).toISOString(),
    },
  };
  const { requirementSetId, implementationAttemptId, transactionId } = authority;
  const commandNumber = String((Number.parseInt(token.slice(0, 8), 16) % 900) + 100);
  const commandScriptRelativePath = path.posix.join('tools', `verify-${token}.js`);
  writeText(
    path.join(root, ...commandScriptRelativePath.split('/')),
    'process.exitCode = 0;\n'
  );
  const commandAuthority = {
    id: `CMD-${commandNumber}`,
    command: `node ${commandScriptRelativePath}`,
    argv: ['node', commandScriptRelativePath],
    requirementRefs: [`MUST-${commandNumber}`],
    notDoneRefs: [`NOTDONE-${commandNumber}`],
    mustNotRefs: [`NEG-${commandNumber}`],
    acceptanceRefs: [`ACC-${commandNumber}`, `E2E-${commandNumber}`],
    traceRefs: [`TRACE-${commandNumber}`],
    taskRefs: [`TASK-${commandNumber}`],
    evidenceRefs: [`EVD-${commandNumber}`],
    failurePathRefs: [`FAIL-${commandNumber}`],
    edgeCaseRefs: [`EDGE-${commandNumber}`],
    artifactRefs: [`ART-${commandNumber}`],
    targetPathRefs: [`TARGET-${commandNumber}`],
    currentTargetMapRefs: [`CTM-${commandNumber}`],
    canonicalSurfaceRefs: [`SURFACE-${commandNumber}`],
  };
  const recordRoot = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    requirementSetId
  );
  const sourcePath = writeText(
    path.join(root, 'docs', 'requirements', 'prompt-transaction.md'),
    `# Prompt transaction

implementationConfirmation:
  status: user_confirmed
  must:
    - id: ${commandAuthority.requirementRefs[0]}
      text: "Publish controlled command execution descriptors."
      evidenceRefs: [${commandAuthority.evidenceRefs[0]}]
  notDone:
    - id: ${commandAuthority.notDoneRefs[0]}
      text: "Do not close the prompt transaction without complete parity."
      evidenceRefs: [${commandAuthority.evidenceRefs[0]}]
  mustNot:
    - id: ${commandAuthority.mustNotRefs[0]}
      text: "Do not publish a partial or authoritative packet."
      evidenceRefs: [${commandAuthority.evidenceRefs[0]}]
  evidence:
    - id: ${commandAuthority.evidenceRefs[0]}
      text: "Observe the controlled command descriptor projection."
      requiredCommandRefs: [${commandAuthority.id}]
      oracle: "The packet preserves exact source-derived command bindings."
  failurePaths:
    - id: ${commandAuthority.failurePathRefs[0]}
      trigger: "A source obligation is omitted from the packet."
      expectedBehavior: "Block publication."
  edgeCases:
    - id: ${commandAuthority.edgeCaseRefs[0]}
      condition: "A packet adds an unconfirmed executable binding."
      expectedBehavior: "Block publication."
  traceRows:
    - id: ${commandAuthority.traceRefs[0]}
      covers: [${commandAuthority.requirementRefs[0]}, ${commandAuthority.mustNotRefs[0]}]
      taskRefs: [${commandAuthority.taskRefs[0]}]
      evidenceRefs: [${commandAuthority.evidenceRefs[0]}]
      acceptanceRefs: [${commandAuthority.acceptanceRefs.join(', ')}]
      e2eRefs: [${commandAuthority.acceptanceRefs[1]}]
      failurePathRefs: [${commandAuthority.failurePathRefs[0]}]
      edgeCaseRefs: [${commandAuthority.edgeCaseRefs[0]}]
      artifactRefs: [${commandAuthority.artifactRefs[0]}]
      targetModificationPaths: [${commandScriptRelativePath}]
      currentTargetMapRefs: [${commandAuthority.currentTargetMapRefs[0]}]
      canonicalSurfaceRefs: [${commandAuthority.canonicalSurfaceRefs[0]}]
      contractValidationCommandRefs: [${commandAuthority.id}]
      deliveryEvidenceCommandRefs: [${commandAuthority.id}]
      status: PENDING
  atomicImplementationTaskList:
    - id: ${commandAuthority.taskRefs[0]}
      title: "Publish the prompt transaction."
      mustRefs: [${commandAuthority.requirementRefs[0]}]
      traceRefs: [${commandAuthority.traceRefs[0]}]
      evidenceRefs: [${commandAuthority.evidenceRefs[0]}]
      targetFiles: [${commandScriptRelativePath}]
  mustToAtomicTaskMap:
    ${commandAuthority.requirementRefs[0]}: [${commandAuthority.taskRefs[0]}]
  atomicTaskToTraceMap:
    ${commandAuthority.taskRefs[0]}: [${commandAuthority.traceRefs[0]}]
  acceptanceTests:
    - id: ${commandAuthority.acceptanceRefs[0]}
      commandRefs: [${commandAuthority.id}]
      covers: [${commandAuthority.requirementRefs[0]}]
      traceRows: [${commandAuthority.traceRefs[0]}]
      failurePathRefs: [${commandAuthority.failurePathRefs[0]}]
      edgeCaseRefs: [${commandAuthority.edgeCaseRefs[0]}]
  e2eSuites:
    - id: ${commandAuthority.acceptanceRefs[1]}
      commandRefs: [${commandAuthority.id}]
      covers: [${commandAuthority.requirementRefs[0]}, ${commandAuthority.mustNotRefs[0]}]
      traceRows: [${commandAuthority.traceRefs[0]}]
      failurePathRefs: [${commandAuthority.failurePathRefs[0]}]
      edgeCaseRefs: [${commandAuthority.edgeCaseRefs[0]}]
  artifactAutomationPlan:
    - id: ${commandAuthority.artifactRefs[0]}
      artifactType: json
      path: model_packet.json
      traceRows: [${commandAuthority.traceRefs[0]}]
      evidenceRefs: [${commandAuthority.evidenceRefs[0]}]
  targetModificationPaths:
    - id: ${commandAuthority.targetPathRefs[0]}
      path: ${commandScriptRelativePath}
      traceRows: [${commandAuthority.traceRefs[0]}]
      evidenceRefs: [${commandAuthority.evidenceRefs[0]}]
  requiredCommands:
    - id: ${commandAuthority.id}
      command: "${commandAuthority.command}"
      oracle: "The command exits zero under the controlled executor."
      traceRows: [${commandAuthority.traceRefs[0]}]
      evidenceRefs: [${commandAuthority.evidenceRefs[0]}]
  closeoutReadinessPreview:
    requiredCommands: [${commandAuthority.id}]
  currentTargetMap:
    schemaVersion: current-target-map/v1
    canonicalArtifacts:
      - id: ${commandAuthority.canonicalSurfaceRefs[0]}
        targetPathOrField: model_packet.json
        traceRows: [${commandAuthority.traceRefs[0]}]
        evidenceRefs: [${commandAuthority.evidenceRefs[0]}]
  aiTddContractExecutionManifestProjection:
    schemaVersion: contract-execution-manifest/v1
    atomicImplementationTaskLineage:
      requiredMaps: [atomicImplementationTaskList, mustToAtomicTaskMap, atomicTaskToTraceMap]
    currentTargetMapRefs: [${commandAuthority.currentTargetMapRefs[0]}]
    canonicalSurfaceRefs: [${commandAuthority.canonicalSurfaceRefs[0]}]
    finalGateMatrix:
      requiredCurrentAttemptGates:
        - gateId: required-commands
          commandRefs: [${commandAuthority.id}]
          passRequired: true
      stopCondition: all_required_current_attempt_gates_pass
    executionLoopProtocol:
      mode: bounded_until_final_acceptance
      stopConditions: [finalGateMatrix_allows_closeout]
    semanticGapPolicy:
      semanticGapAction: reconfirm_required
      nonSemanticGapAction: repair_and_rerun
    amend05Bindings:
      safeWriteTargetRefs:
        - ${commandAuthority.artifactRefs[0]}
        - ${commandAuthority.targetPathRefs[0]}
`
  );
  const sourceDocumentHash = fileHash(sourcePath);
  const implementationConfirmationHash = sha256(`${seed}:confirmation`);
  const semanticModelHash = sha256(`${seed}:semantic-model`);
  const sourceAmendmentHashes = [sha256(`${seed}:source-amendment`)];
  const contractHash = sha256(`${seed}:contract`);
  const universeHashes = {
    requirementUniverseHash: sha256(`${seed}:requirements`),
    acceptanceUniverseHash: sha256(`${seed}:acceptance`),
    traceUniverseHash: sha256(`${seed}:trace`),
  };
  const recordPath = writeJson(path.join(recordRoot, 'requirement-record.json'), {
    schemaVersion: 'requirement-record/v1',
    recordId: authority.recordId,
    requirementSetId,
    currentAttemptId: implementationAttemptId,
    status: 'user_confirmed',
    sourcePath,
    sourceDocumentHash,
    implementationConfirmationHash,
    semanticModelHash,
    sourceAmendmentHashes,
  });
  writePassingSourcePrdLintReport({
    requirementRecordPath: recordPath,
    sourcePath,
  });
  const evidenceRoot = path.join(root, 'docs', 'plans', 'evidence');
  const requirementsPage = writeText(path.join(evidenceRoot, 'requirements.html'), '<html>requirements</html>\n');
  const architecturePage = writeText(path.join(evidenceRoot, 'architecture.html'), '<html>architecture</html>\n');
  const receipt = (kind: 'requirements' | 'architecture', pagePath: string) => ({
    schemaVersion: 'requirements-contract-confirmation-receipt/v1',
    confirmationKind: kind,
    decision: 'pass',
    transactionId,
    requirementSetId,
    implementationAttemptId,
    sourceDocumentHash,
    semanticModelHash,
    pageRef: { path: pagePath, hash: fileHash(pagePath) },
  });
  const requirementsConfirmationReceipt = writeJson(
    path.join(evidenceRoot, 'requirements-confirmation.receipt.json'),
    receipt('requirements', requirementsPage)
  );
  const architectureConfirmationReceipt = writeJson(
    path.join(evidenceRoot, 'architecture-confirmation.receipt.json'),
    receipt('architecture', architecturePage)
  );
  const consumerRoot = path.join(root, 'consumer');
  const consumerMarker = writeJson(path.join(consumerRoot, 'bmad-speckit-consumer-project.json'), {
    schemaVersion: 'bmad-speckit-consumer-project/v1',
    projectName: authority.consumerId,
    bootstrapId: authority.bootstrapId,
  });
  const installedPackageRoot = path.join(consumerRoot, 'node_modules', 'bmad-speckit');
  const installedCliPath = writeText(
    path.join(installedPackageRoot, 'bin', 'bmad-speckit.js'),
    [
      "if (process.argv[2] !== 'requirements-contract-consumer-cli-capability-observe') process.exit(64);",
      "process.stdout.write(JSON.stringify({schemaVersion:'requirements-contract-consumer-cli-capability/v1',executionHost:'codex',goalCommandAvailable:true}));",
      '',
    ].join('\n')
  );
  const installedGeneratorPath = writeText(
    path.join(
      installedPackageRoot,
      'dist',
      'main-agent',
      'source-authority',
      '_bmad',
      'skills',
      'req-trace-matrix-prompt-generator',
      'scripts',
      'generate_prompt.js'
    ),
    '// installed prompt generator fixture\n'
  );
  const installedStageRegistryPath = writeText(
    path.join(
      installedPackageRoot,
      'dist',
      'main-agent',
      'source-authority',
      'scripts',
      'requirements-contract-stage-registry.js'
    ),
    '// installed stage registry fixture\n'
  );
  const installedRunnerPath = writeText(
    path.join(
      installedPackageRoot,
      'dist',
      'main-agent',
      'source-authority',
      'scripts',
      'main-agent-compiled-prompt-runner.js'
    ),
    '// installed compiled prompt runner fixture\n'
  );
  const actionBindingSchema = JSON.parse(
    fs.readFileSync(
      path.resolve(
        'packages',
        'bmad-speckit',
        'src',
        'main-agent',
        'source-authority',
        'schemas',
        'requirements-contract-package-runtime-action-binding-manifest.schema.json'
      ),
      'utf8'
    )
  );
  const actionIds = actionBindingSchema.properties.actions.items.properties.actionId.enum as string[];
  const actionBindings = actionIds.map((actionId) => {
    if (actionId === 'requirements-contract-prompt-transaction-publish') {
      return {
        actionId,
        capabilityActionId: 'requirements-contract-consumer-cli-capability-observe',
        sourceHandlerRef: { path: installedRunnerPath, hash: fileHash(installedRunnerPath) },
        distHandlerRef: { path: installedRunnerPath, hash: fileHash(installedRunnerPath) },
        semanticGate: {
          gateId: `${actionId}:semantic-gate`,
          sourceSymbol: 'requirementsContractPromptTransactionPublishCommand',
          distSymbol: 'requirementsContractPromptTransactionPublishCommand',
        },
        inputSchemaRefs: [{ path: installedRunnerPath, hash: fileHash(installedRunnerPath) }],
        outputSchemaRefs: [{ path: installedRunnerPath, hash: fileHash(installedRunnerPath) }],
        behaviorTestRefs: [{ path: installedRunnerPath, hash: fileHash(installedRunnerPath) }],
        packageDistRef: { path: installedRunnerPath, hash: fileHash(installedRunnerPath) },
        installedSurfaceRefs: [
          { path: installedRunnerPath, hash: fileHash(installedRunnerPath) },
        ],
        runtimeRefs: [
          {
            role: 'installed-cli',
            packagePath: path.relative(installedPackageRoot, installedCliPath),
            hash: fileHash(installedCliPath),
          },
          {
            role: 'installed-generator',
            packagePath: path.relative(installedPackageRoot, installedGeneratorPath),
            hash: fileHash(installedGeneratorPath),
          },
          {
            role: 'installed-stage-registry',
            packagePath: path.relative(installedPackageRoot, installedStageRegistryPath),
            hash: fileHash(installedStageRegistryPath),
          },
          {
            role: 'installed-runner',
            packagePath: path.relative(installedPackageRoot, installedRunnerPath),
            hash: fileHash(installedRunnerPath),
          },
        ],
        routingOnly: false,
      };
    }
    const installedActionPath = writeText(
      path.join(installedPackageRoot, 'dist', 'fixture-actions', `${actionId}.js`),
      `// ${actionId} fixture binding\n`
    );
    const installedActionRef = {
      path: installedActionPath,
      hash: fileHash(installedActionPath),
    };
    return {
      actionId,
      sourceHandlerRef: installedActionRef,
      distHandlerRef: installedActionRef,
      semanticGate: {
        gateId: `${actionId}:semantic-gate`,
        sourceSymbol: `${actionId}:source`,
        distSymbol: `${actionId}:dist`,
      },
      inputSchemaRefs: [installedActionRef],
      outputSchemaRefs: [installedActionRef],
      behaviorTestRefs: [installedActionRef],
      packageDistRef: installedActionRef,
      installedSurfaceRefs: [installedActionRef],
      runtimeRefs: [
        {
          role: 'installed-handler',
          packagePath: path.relative(installedPackageRoot, installedActionPath),
          hash: installedActionRef.hash,
        },
      ],
      routingOnly: false,
    };
  });
  const actionBindingManifest = writeJson(
    path.join(
      installedPackageRoot,
      '_bmad',
      'shared',
      'requirements-contract',
      'requirements-contract-package-runtime-action-binding-manifest.json'
    ),
    {
      schemaVersion: 'requirements-contract-package-runtime-action-binding-manifest/v2',
      actionUniverseHash: actionBindingSchema.properties.actionUniverseHash.const,
      actions: actionBindings,
      packageRuntimeRoutingOnlyActionCount: 0,
      installedPackageActionBehaviorMismatchCount: 0,
      packageActionSemanticBindingCoverage: 1,
      decision: 'pass',
    }
  );
  const consumerProjectProfile = writeJson(
    path.join(consumerRoot, '_bmad-output', 'runtime', 'context', 'consumer-project-profile.json'),
    {
      schemaVersion: 'requirements-contract-consumer-project-profile/v1',
      consumerId: authority.consumerId,
      projectName: authority.consumerId,
      executionHost: 'codex',
      hostRegistryEntryId: 'codex',
      capabilityProbeArgv: [
        process.execPath,
        installedCliPath,
        'requirements-contract-consumer-cli-capability-observe',
        '--json',
      ],
      capabilityProbeArtifactRef: { path: installedCliPath, hash: fileHash(installedCliPath) },
      packageRuntimeActionBindingManifestRef: {
        path: actionBindingManifest,
        hash: fileHash(actionBindingManifest),
      },
    }
  );
  const attemptContext = writeJson(path.join(evidenceRoot, 'attempt-context.json'), {
    schemaVersion: 'requirements-contract-attempt-context/v1',
    contractHash,
    transactionId,
    requirementSetId,
    implementationAttemptId,
    architectureAuditAttemptId: authority.architectureAuditAttemptId,
    attemptSequence: 1,
    sourceDocumentHash,
    semanticModelHash,
    universeHashes,
    requirementsConfirmationReceiptRef: {
      path: requirementsConfirmationReceipt,
      hash: fileHash(requirementsConfirmationReceipt),
    },
    architectureConfirmationReceiptRef: {
      path: architectureConfirmationReceipt,
      hash: fileHash(architectureConfirmationReceipt),
    },
    consumerMarkerRef: { path: consumerMarker, hash: fileHash(consumerMarker) },
    consumerProjectProfileRef: {
      path: consumerProjectProfile,
      hash: fileHash(consumerProjectProfile),
    },
  });
  const outDir = path.join(recordRoot, 'trace-execution', implementationAttemptId);
  return {
    root,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }),
    identity: {
      transactionId,
      requirementSetId,
      implementationAttemptId,
      sourceDocumentHash,
      implementationConfirmationHash,
      semanticModelHash,
      sourceAmendmentHashes,
      contractHash,
      universeHashes,
    },
    authority,
    commandAuthority,
    paths: {
      recordPath,
      sourcePath,
      attemptContext,
      outDir,
      consumerRoot,
      evidenceRoot,
      requirementsPage,
      architecturePage,
      consumerMarker,
      consumerProjectProfile,
      actionBindingManifest,
      installedPackageRoot,
      installedCliPath,
      installedGeneratorPath,
      installedStageRegistryPath,
      installedRunnerPath,
    },
    options: {
      cwd: root,
      requirementRecord: recordPath,
      outDir,
      promptLanguage: 'auto',
      humanPromptProfile: 'full',
      packetId: implementationAttemptId,
      taskReportPath: path.join(
        root,
        '_bmad-output',
        'runtime',
        'governance',
        'task-reports',
        requirementSetId,
        `${implementationAttemptId}.json`
      ),
      attemptContext,
      stageRegistry: path.resolve(
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-stage-registry.ts'
      ),
      requirementsConfirmationReceipt,
      architectureConfirmationReceipt,
      consumerRoot,
      currentDispatchPointer: path.join(evidenceRoot, 'current-dispatch-pointer-receipt.json'),
      evidenceOut: path.join(evidenceRoot, 'G09-prompt-transaction.json'),
      json: true,
    },
  };
}
