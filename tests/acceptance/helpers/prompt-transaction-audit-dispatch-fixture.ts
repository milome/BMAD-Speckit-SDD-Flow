import fs from 'node:fs';
import path from 'node:path';
import { expandSixModelAuthority } from '../../helpers/requirement-fixture-runtime';
import {
  fileHash,
  materializePromptPublicationFixture,
  writeJson,
} from './prompt-transaction-publication-fixture';

export function prepareAuditDispatchRuntime(
  fixture: ReturnType<typeof materializePromptPublicationFixture>
) {
  for (const relativePath of [
    path.join('_bmad', '_config', 'audit-item-mapping.yaml'),
    path.join('_bmad', '_config', 'code-reviewer-config.yaml'),
  ]) {
    const targetPath = path.join(fixture.root, relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(path.resolve(relativePath), targetPath);
  }

  const record = JSON.parse(fs.readFileSync(fixture.paths.recordPath, 'utf8'));
  const sixModelAuthority = expandSixModelAuthority({
    rawResults: {
      requirement_confirmation: { status: 'pass' },
      architecture_confirmation: { status: 'pass' },
      implementation_readiness: { status: 'pass' },
      execution_closure: { status: 'pass' },
    },
    recordId: fixture.authority.recordId,
    requirementSetId: fixture.identity.requirementSetId,
    implementationAttemptId: fixture.identity.implementationAttemptId,
    sourceDocumentHash: fixture.identity.sourceDocumentHash,
    implementationConfirmationHash: fixture.identity.implementationConfirmationHash,
    semanticModelHash: fixture.identity.semanticModelHash,
  });
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
    sixModelResults: sixModelAuthority.sixModelResults,
    runtimeStatusDecisionReceipts: sixModelAuthority.runtimeStatusDecisionReceipts,
    artifactIndex: sixModelAuthority.artifactIndex,
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
      },
    ],
    architectureConfirmationState: {
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
