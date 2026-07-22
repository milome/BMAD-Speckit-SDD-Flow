import fs from 'node:fs';
import path from 'node:path';
import {
  createRuntimeStatusProjectionUpdate,
  runtimeStatusProjectionArtifactWrites,
  runtimeStatusProjectionRecordPatch,
} from '../../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-runtime-status-decision-receipt';
import {
  fileHash,
  materializePromptPublicationFixture,
  writeJson,
} from './prompt-transaction-publication-fixture';

export function prepareAuditDispatchRuntime(
  fixture: ReturnType<typeof materializePromptPublicationFixture>,
  options: {
    executionClosureStatus?: 'pass' | 'not_established';
  } = {}
) {
  for (const relativePath of [
    path.join('_bmad', '_config', 'audit-item-mapping.yaml'),
    path.join('_bmad', '_config', 'code-reviewer-config.yaml'),
    path.join('_bmad', '_config', 'governance-remediation.yaml'),
  ]) {
    const targetPath = path.join(fixture.root, relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(path.resolve(relativePath), targetPath);
  }

  const record = JSON.parse(fs.readFileSync(fixture.paths.recordPath, 'utf8'));
  const implementationReadinessReceipt = JSON.parse(
    fs.readFileSync(fixture.paths.implementationReadinessReceipt, 'utf8')
  ) as { receiptHash?: unknown };
  const implementationReadinessReceiptHash = String(
    implementationReadinessReceipt.receiptHash ?? ''
  );
  if (!implementationReadinessReceiptHash.startsWith('sha256:')) {
    throw new Error('audit_dispatch_fixture_readiness_receipt_hash_missing');
  }
  const executionClosureBlocked = options.executionClosureStatus === 'not_established';
  const taskReportPath = writeJson(fixture.options.taskReportPath, {
    packetId: fixture.identity.implementationAttemptId,
    status: executionClosureBlocked ? 'blocked' : 'done',
    filesChanged: [],
    validationsRun: [],
    evidence: [fixture.paths.implementationReadinessReceipt],
    downstreamContext: ['audit review dispatch fixture'],
  });
  const executionClosureUpdate = createRuntimeStatusProjectionUpdate({
    recordId: fixture.authority.recordId,
    requirementSetId: fixture.identity.requirementSetId,
    modelId: 'execution_closure',
    implementationAttemptId: fixture.identity.implementationAttemptId,
    sourceDocumentHash: fixture.identity.sourceDocumentHash,
    implementationConfirmationHash: fixture.identity.implementationConfirmationHash,
    semanticModelHash: fixture.identity.semanticModelHash,
    stageInputs: [
      {
        role: 'implementation_readiness_receipt',
        path: fixture.paths.implementationReadinessReceipt,
        hash: implementationReadinessReceiptHash,
      },
    ],
    deterministicGateOutputs: [
      {
        role: 'task_report',
        path: taskReportPath,
        hash: fileHash(taskReportPath),
      },
    ],
    blockerRefs: executionClosureBlocked ? ['execution_closure_not_established'] : [],
    evidenceRefs: [fixture.paths.implementationReadinessReceipt, taskReportPath],
    authorityClass: 'controlled_closeout',
    decision: executionClosureBlocked ? 'block' : 'pass',
    effectiveStatus: executionClosureBlocked ? 'not_established' : 'pass',
    createdAt: '2026-07-18T00:00:00.000Z',
    receiptPath: path.join(
      path.dirname(fixture.paths.recordPath),
      'runtime',
      'status-decisions',
      fixture.identity.implementationAttemptId,
      'execution_closure.json'
    ),
    projection: {
      payloadKind: 'model_result',
      model: 'execution_closure',
      recordId: fixture.authority.recordId,
      requirementSetId: fixture.identity.requirementSetId,
      sourceDocumentHash: fixture.identity.sourceDocumentHash,
      implementationConfirmationHash: fixture.identity.implementationConfirmationHash,
      semanticModelHash: fixture.identity.semanticModelHash,
      currentAttemptId: fixture.identity.implementationAttemptId,
      status: executionClosureBlocked ? 'not_established' : 'pass',
      resultRecordedAt: '2026-07-18T00:00:00.000Z',
      resultRecordedBy: 'prompt-transaction-audit-dispatch-fixture',
      blockingReasons: executionClosureBlocked ? ['execution_closure_not_established'] : [],
      sourceRefs: [{ sourceType: 'task_report', id: taskReportPath }],
      currentHashes: {
        sourceDocumentHash: fixture.identity.sourceDocumentHash,
        implementationConfirmationHash: fixture.identity.implementationConfirmationHash,
      },
    },
  });
  for (const artifactWrite of runtimeStatusProjectionArtifactWrites(executionClosureUpdate)) {
    fs.mkdirSync(path.dirname(artifactWrite.path), { recursive: true });
    fs.writeFileSync(artifactWrite.path, artifactWrite.content, 'utf8');
  }
  writeJson(fixture.paths.recordPath, {
    ...record,
    transactionId: fixture.identity.transactionId,
    runId: fixture.identity.implementationAttemptId,
    currentAttemptId: fixture.identity.implementationAttemptId,
    flow: 'standalone_tasks',
    stage: 'implement',
    entryFlow: 'standalone_tasks',
    sourceMode: 'full_bmad',
    currentMentalModel: 'execution_closure',
    ...runtimeStatusProjectionRecordPatch({
      record,
      modelId: 'execution_closure',
      update: executionClosureUpdate,
    }),
    confirmationPageHash: fileHash(fixture.paths.requirementsPage),
    confirmationHistory: [
      {
        eventType: 'confirmation_recorded',
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        confirmedAt: '2026-07-18T00:00:00.000Z',
        confirmedBy: 'fixture',
        sourcePath: fixture.paths.sourcePath,
        sourceDocumentHash: fixture.identity.sourceDocumentHash,
        implementationConfirmationHash: fixture.identity.implementationConfirmationHash,
        confirmationPageHash: fileHash(fixture.paths.requirementsPage),
        confirmationText: `confirmed ${fixture.identity.requirementSetId}`,
        renderReportPath: fixture.options.requirementsConfirmationReceipt,
        htmlPath: fixture.paths.requirementsPage,
      },
    ],
    architectureConfirmationState: {
      ...(record.architectureConfirmationState || {}),
      status: 'active',
      currentArchitectureConfirmationRunId: fixture.authority.architectureAuditAttemptId,
      currentArchitectureConfirmationHash: fileHash(fixture.paths.architecturePage),
      lastEventType: 'architecture_confirmation_recorded',
      updatedAt: '2026-07-18T00:00:00.000Z',
    },
  });
  writeJson(
    path.join(fixture.root, '_bmad-output', 'runtime', 'requirement-records', 'index.json'),
    {
      version: 1,
      active: {
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
      },
      records: [
        {
          recordId: fixture.authority.recordId,
          requirementSetId: fixture.identity.requirementSetId,
          runId: fixture.identity.implementationAttemptId,
          recordPath: path
            .relative(fixture.root, fixture.paths.recordPath)
            .replace(/\\/g, '/'),
        },
      ],
    }
  );
}
