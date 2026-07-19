import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const scripts = path.resolve('packages/bmad-speckit/src/main-agent/source-authority/scripts');
const hash = (digit: string) => `sha256:${digit.repeat(64)}`;

async function load(name: string) {
  const file = path.join(scripts, name);
  expect(existsSync(file), `missing ${file}`).toBe(true);
  if (!existsSync(file)) return null;
  return import(/* @vite-ignore */ pathToFileURL(file).href) as Promise<Record<string, any>>;
}

function semanticValues() {
  const domain = (applies = false) => ({ applies, reasonCode: 'not_applicable_in_fixture' });
  return {
    status: 'draft', entryFlow: 'standalone_tasks', entryFlowClass: 'task_packet_entry',
    workflowAdapter: 'direct', contractAuthoringRequired: true, confirmationLanguage: 'zh-CN',
    confirmationProfile: 'implementation_confirmation', requiredViewPacks: [], optionalViewPacks: [],
    confirmedAt: null, confirmedBy: null,
    confirmationRender: { htmlPath: null, summaryPath: null, reportPath: null,
      htmlHash: null, confirmationPhrase: null },
    preConfirmationDrilldown: {
      semanticKernelRef: { path: 'authoring/kernel.json', hash: hash('3') },
      mustDecompositionPacketRef: { path: 'authoring/packet.json', hash: hash('4'),
        status: 'synchronized' },
      criticalAuditor: { minimumRounds: 3, consecutiveNoNewGapRounds: 3,
        latestReceiptHash: hash('5'), convergenceVerdict: 'bounded_no_new_gap' },
      packetSourceReconciliation: { reportPath: 'authoring/reconcile.json', verdict: 'pass' },
      preRenderGateReportPath: 'authoring/pre-render.json',
    },
    applicability: {
      governanceEvents: domain(),
      runtimeRecovery: { ...domain(), requiresFunctionalResumeFailureCaseRegistry: false,
        activeRequirementResolutionRequired: false, retiredContextSurfaceForbidden: true },
      scoringDashboardSft: domain(), currentTargetMap: domain(),
      scriptsAndHooks: domain(), aiTddContractGate: domain(),
    },
    must: [{ id: 'MUST-001', text: 'Persist value.', evidenceRefs: ['EVD-001'],
      coveredByTraceRows: ['TRACE-001'] }],
    notDone: [], mustNot: [],
    evidence: [{ id: 'EVD-001', text: 'Persistence evidence.', requiredCommandRefs: ['CMD-001'] }],
    openQuestions: [], failurePaths: [], edgeCases: [],
    acceptanceTests: [{ id: 'ACC-001', suiteType: 'acceptance', file: 'tests/a.test.ts',
      covers: ['MUST-001'], traceRows: ['TRACE-001'], evidenceRefs: ['EVD-001'],
      commandRefs: ['CMD-001'], oracle: 'Persisted.', mockOnly: false }],
    e2eSuites: [],
    traceRows: [{ id: 'TRACE-001', covers: ['MUST-001'], taskRefs: ['TASK-001'],
      evidenceRefs: ['EVD-001'], acceptanceRefs: ['ACC-001'],
      contractValidationCommandRefs: ['CMD-001'], deliveryEvidenceCommandRefs: ['CMD-001'],
      status: 'PENDING', blockingReason: null }],
    sequenceViews: [], flowViews: [], edgeCaseViews: [], boundaryViews: [],
    targetModificationPaths: [{ id: 'TARGET-001', path: 'src/target.ts',
      coverageRole: 'implementation_target', changeType: 'code', intent: 'Persist value.',
      ownerModel: 'implementation', requirementRefs: ['MUST-001'], traceRefs: ['TRACE-001'],
      evidenceRefs: ['EVD-001'], artifactRefs: [], requiresReconfirmationOnChange: true }],
    requirementBoundary: { business: { requirementIds: ['MUST-001', 'EVD-001'],
      viewRefs: [], diagramRefs: [] }, governance: { requirementIds: [], viewRefs: [], diagramRefs: [] } },
    artifactAutomationPlan: [],
    requiredCommands: [{ id: 'CMD-001', command: 'npm test', purpose: 'Verify.' }],
    suggestedCommands: [],
    requiredContractChecks: [{ id: 'CC-001', gate: 'implementation_confirmation_schema',
      requiredBefore: 'implementation_readiness', decisionField: 'contractChecks[].decision' }],
    implementationTasks: [{ id: 'TASK-001', title: 'Persist value.',
      requirementRefs: ['MUST-001'], targetPaths: ['src/target.ts'],
      traceRefs: ['TRACE-001'], evidenceRefs: ['EVD-001'] }],
    closeoutReadinessPreview: { orphanPolicy: 'block', currentAttemptPolicy: 'current_only',
      recordClosedPolicy: 'controlled_only', requiredCommands: ['CMD-001'],
      blockingConditions: ['missing evidence'] },
  };
}

function projectionInput() {
  const semanticModelHash = hash('b');
  const values = semanticValues();
  return {
    mode: 'confirmation-ready',
    source: { recordId: 'REQ-AMEND-13', requirementSetId: 'REQ-AMEND-13',
      sourceDocumentHash: hash('a') },
    semanticIr: { semanticModelHash,
      fields: Object.entries(values).map(([fieldRef, value]) => ({ fieldRef, value })) },
    provenance: Object.keys(values).map((fieldRef) => ({ fieldRef,
      authorityClass: 'source_grounded', provenanceRefs: [`source:${fieldRef}`],
      decisionReceiptRef: null })),
    decisionReceipts: [],
    context: {
      mode: 'confirmation-ready', sourceDocumentHash: hash('a'), semanticModelHash,
      attemptBindings: { transactionId: 'TX-001', implementationAttemptId: 'IMP-001',
        auditAttemptId: 'AUD-001' },
      conservation: { decision: 'pass', sourceDocumentHash: hash('a'), semanticModelHash,
        implementationAttemptId: 'IMP-001', receiptRefs: ['receipt:conservation'] },
      auditReconciliation: { required: true, auditDecision: 'pass',
        reconciliationDecision: 'pass', implementationAttemptId: 'IMP-001',
        auditAttemptId: 'AUD-001', receiptRefs: ['receipt:audit', 'receipt:reconciliation'] },
      expectedSets: { requirements: ['MUST-001'], evidence: ['EVD-001'],
        acceptance: ['ACC-001'], traces: ['TRACE-001'], failures: [], edges: [],
        targets: ['TARGET-001'], commands: ['CMD-001'] },
    },
  };
}

describe('implementation confirmation projector and validator', () => {
  it('projects only authorized fields and fails rather than falling back', async () => {
    const projector = await load('requirements-contract-implementation-confirmation-projector.ts');
    if (!projector) return;
    const input = projectionInput();
    const projected = projector.projectRequirementsContractImplementationConfirmation(input);
    expect(projected).toMatchObject({ contractSchemaVersion: 1, recordId: 'REQ-AMEND-13',
      requirementSetId: 'REQ-AMEND-13', sourceDocumentHash: hash('a') });
    expect(projected.implementationConfirmationHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(projector.projectRequirementsContractImplementationConfirmation(input)).toEqual(projected);

    const missing = structuredClone(input);
    missing.semanticIr.fields = missing.semanticIr.fields.filter(
      (field: { fieldRef: string }) => field.fieldRef !== 'must'
    );
    expect(() => projector.projectRequirementsContractImplementationConfirmation(missing))
      .toThrow(/missing_required_semantic_value:must/u);
  });

  it('keeps structural and semantic decisions separate and requires the full receipt hash chain', async () => {
    const projector = await load('requirements-contract-implementation-confirmation-projector.ts');
    const validator = await load('requirements-contract-implementation-confirmation-validator.ts');
    if (!projector || !validator) return;
    const input = projectionInput();
    const projected = projector.projectRequirementsContractImplementationConfirmation(input);
    expect(validator.validateRequirementsContractImplementationConfirmation(
      projected, input.context
    )).toMatchObject({
      structural: { decision: 'pass' }, semantic: { decision: 'pass' },
      promotionDecision: 'pass',
    });

    const stale = structuredClone(input.context);
    stale.sourceDocumentHash = hash('c');
    expect(validator.validateRequirementsContractImplementationConfirmation(
      projected, stale
    )).toMatchObject({
      structural: { decision: 'pass' }, semantic: { decision: 'block' },
      promotionDecision: 'block',
    });

    const bindings = Object.fromEntries(
      validator.CONFIRMATION_PROJECTION_RECEIPT_HASH_FIELDS.map(
        (field: string, index: number) => [field, hash(((index % 6) + 1).toString(16))]
      )
    );
    expect(validator.validateConfirmationProjectionReceiptBindings(bindings).decision).toBe('pass');
    delete bindings.confirmationPageHash;
    expect(validator.validateConfirmationProjectionReceiptBindings(bindings).decision).toBe('block');
  });
});
