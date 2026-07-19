import Ajv2020 from 'ajv/dist/2020.js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-implementation-confirmation.schema.json'
);
const hash = (digit: string) => `sha256:${digit.repeat(64)}`;

function confirmation() {
  const domain = (applies = false) => ({ applies, reasonCode: 'not_applicable_in_fixture' });
  return {
    contractSchemaVersion: 1,
    status: 'draft',
    recordId: 'REQ-AMEND-13',
    requirementSetId: 'REQ-AMEND-13',
    entryFlow: 'standalone_tasks',
    entryFlowClass: 'task_packet_entry',
    workflowAdapter: 'direct',
    contractAuthoringRequired: true,
    confirmationLanguage: 'zh-CN',
    confirmationProfile: 'implementation_confirmation',
    requiredViewPacks: [],
    optionalViewPacks: [],
    confirmedAt: null,
    confirmedBy: null,
    sourceDocumentHash: hash('1'),
    implementationConfirmationHash: hash('2'),
    confirmationRender: {
      htmlPath: null, summaryPath: null, reportPath: null, htmlHash: null,
      confirmationPhrase: null,
    },
    preConfirmationDrilldown: {
      semanticKernelRef: { path: 'authoring/semantic-kernel.json', hash: hash('3') },
      mustDecompositionPacketRef: {
        path: 'authoring/must-decomposition.json', hash: hash('4'), status: 'synchronized',
      },
      criticalAuditor: {
        minimumRounds: 3, consecutiveNoNewGapRounds: 3,
        latestReceiptHash: hash('5'), convergenceVerdict: 'bounded_no_new_gap',
      },
      packetSourceReconciliation: { reportPath: 'authoring/reconciliation.json', verdict: 'pass' },
      preRenderGateReportPath: 'authoring/pre-render-gate.json',
    },
    applicability: {
      governanceEvents: domain(),
      runtimeRecovery: { ...domain(), requiresFunctionalResumeFailureCaseRegistry: false,
        activeRequirementResolutionRequired: false, retiredContextSurfaceForbidden: true },
      scoringDashboardSft: domain(),
      currentTargetMap: domain(),
      scriptsAndHooks: domain(),
      aiTddContractGate: domain(),
    },
    must: [{ id: 'MUST-001', text: 'Persist the authorized value.',
      evidenceRefs: ['EVD-001'], coveredByTraceRows: ['TRACE-001'] }],
    notDone: [],
    mustNot: [],
    evidence: [{ id: 'EVD-001', text: 'Observe persistence.', requiredCommandRefs: ['CMD-001'] }],
    openQuestions: [],
    failurePaths: [],
    edgeCases: [],
    acceptanceTests: [{ id: 'ACC-001', suiteType: 'acceptance',
      file: 'tests/acceptance/amend-13.test.ts', covers: ['MUST-001'],
      traceRows: ['TRACE-001'], evidenceRefs: ['EVD-001'], commandRefs: ['CMD-001'],
      oracle: 'The value is persisted.', mockOnly: false }],
    e2eSuites: [],
    traceRows: [{ id: 'TRACE-001', covers: ['MUST-001'], taskRefs: ['TASK-001'],
      evidenceRefs: ['EVD-001'], acceptanceRefs: ['ACC-001'],
      contractValidationCommandRefs: ['CMD-001'], deliveryEvidenceCommandRefs: ['CMD-001'],
      status: 'PENDING', blockingReason: null }],
    sequenceViews: [], flowViews: [], edgeCaseViews: [], boundaryViews: [],
    targetModificationPaths: [{ id: 'TARGET-001', path: 'src/target.ts',
      coverageRole: 'implementation_target', changeType: 'code', intent: 'Persist the value.',
      ownerModel: 'implementation', requirementRefs: ['MUST-001'], traceRefs: ['TRACE-001'],
      evidenceRefs: ['EVD-001'], artifactRefs: [], requiresReconfirmationOnChange: true }],
    requirementBoundary: {
      business: { requirementIds: ['MUST-001', 'EVD-001'], viewRefs: [], diagramRefs: [] },
      governance: { requirementIds: [], viewRefs: [], diagramRefs: [] },
    },
    artifactAutomationPlan: [],
    requiredCommands: [{ id: 'CMD-001', command: 'npm test', purpose: 'Verify persistence.' }],
    suggestedCommands: [],
    requiredContractChecks: [{ id: 'CC-001', gate: 'implementation_confirmation_schema',
      requiredBefore: 'implementation_readiness', decisionField: 'contractChecks[].decision' }],
    implementationTasks: [{ id: 'TASK-001', title: 'Persist the value.',
      requirementRefs: ['MUST-001'], targetPaths: ['src/target.ts'],
      traceRefs: ['TRACE-001'], evidenceRefs: ['EVD-001'] }],
    closeoutReadinessPreview: { orphanPolicy: 'block', currentAttemptPolicy: 'current_only',
      recordClosedPolicy: 'controlled_gate_only', requiredCommands: ['CMD-001'],
      blockingConditions: ['missing evidence'] },
  };
}

describe('implementation confirmation schema', () => {
  it('is closed, versioned, and enforces conditional applicability without defaults', () => {
    expect(existsSync(schemaPath), `missing ${schemaPath}`).toBe(true);
    if (!existsSync(schemaPath)) return;
    const schemaText = readFileSync(schemaPath, 'utf8');
    const schema = JSON.parse(schemaText) as object;
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    ajv.addFormat('date-time', (value: string) => !Number.isNaN(Date.parse(value)));
    const validate = ajv.compile(schema);
    expect(validate(confirmation()), JSON.stringify(validate.errors)).toBe(true);
    expect(schemaText).not.toMatch(/"default"\s*:/u);

    const unknown = { ...confirmation(), inventedBusinessTruth: true };
    expect(validate(unknown)).toBe(false);

    const missingReason = confirmation();
    delete (missingReason.applicability.governanceEvents as { reasonCode?: string }).reasonCode;
    expect(validate(missingReason)).toBe(false);

    const missingModule = confirmation();
    missingModule.applicability.currentTargetMap.applies = true;
    expect(validate(missingModule)).toBe(false);
  });
});
