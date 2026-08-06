import { describe, expect, it } from 'vitest';
import {
  expectedSetsFromConfirmation,
  projectProductionImplementationConfirmation,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-confirmation-projection-facade';

const hash = (digit: string) => `sha256:${digit.repeat(64)}`;

function confirmationFixture(): Record<string, unknown> {
  const domain = (applies = false) => ({ applies, reasonCode: 'fixture' });
  return {
    status: 'draft',
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
    confirmationRender: {
      htmlPath: null,
      summaryPath: null,
      reportPath: null,
      htmlHash: null,
      confirmationPhrase: null,
    },
    preConfirmationDrilldown: {
      semanticKernelRef: { path: 'kernel.json', hash: hash('3') },
      mustDecompositionPacketRef: {
        path: 'packet.json',
        hash: hash('4'),
        status: 'synchronized',
      },
      criticalAuditor: {
        minimumRounds: 3,
        consecutiveNoNewGapRounds: 3,
        latestReceiptHash: hash('5'),
        convergenceVerdict: 'bounded_no_new_gap',
      },
      packetSourceReconciliation: { reportPath: 'reconcile.json', verdict: 'pass' },
      preRenderGateReportPath: 'pre-render.json',
    },
    applicability: {
      governanceEvents: domain(),
      runtimeRecovery: {
        ...domain(),
        requiresFunctionalResumeFailureCaseRegistry: false,
        activeRequirementResolutionRequired: false,
        retiredContextSurfaceForbidden: true,
      },
      scoringDashboardSft: domain(),
      currentTargetMap: domain(),
      scriptsAndHooks: domain(),
      aiTddContractGate: domain(),
    },
    must: [
      {
        id: 'MUST-001',
        text: 'Persist value.',
        evidenceRefs: ['EVD-001'],
        coveredByTraceRows: ['TRACE-001'],
      },
    ],
    notDone: [],
    mustNot: [],
    evidence: [
      {
        id: 'EVD-001',
        text: 'Persistence evidence.',
        requiredCommandRefs: ['CMD-001'],
      },
    ],
    openQuestions: [],
    failurePaths: [],
    edgeCases: [],
    acceptanceTests: [
      {
        id: 'ACC-001',
        suiteType: 'acceptance',
        file: 'tests/a.test.ts',
        covers: ['MUST-001'],
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
        commandRefs: ['CMD-001'],
        oracle: 'Persisted.',
        mockOnly: false,
      },
    ],
    e2eSuites: [],
    traceRows: [
      {
        id: 'TRACE-001',
        covers: ['MUST-001'],
        taskRefs: ['TASK-001'],
        evidenceRefs: ['EVD-001'],
        acceptanceRefs: ['ACC-001'],
        contractValidationCommandRefs: ['CMD-001'],
        deliveryEvidenceCommandRefs: ['CMD-001'],
        status: 'PENDING',
        blockingReason: null,
        targetStateAssertion: 'Requirement remains pending.',
        acceptanceSummary: 'Acceptance evidence is linked.',
      },
    ],
    sequenceViews: [],
    flowViews: [],
    edgeCaseViews: [],
    boundaryViews: [],
    targetModificationPaths: [
      {
        id: 'TARGET-001',
        path: 'src/target.ts',
        coverageRole: 'implementation_target',
        changeType: 'code',
        intent: 'Persist value.',
        ownerModel: 'implementation',
        requirementRefs: ['MUST-001'],
        traceRefs: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
        artifactRefs: [],
        perMustResponsibilities: { 'MUST-001': 'Persist the requirement-owned value.' },
        perMustRows: [
          {
            mustRef: 'MUST-001',
            traceRows: ['TRACE-001'],
            evidenceRefs: ['EVD-001'],
            responsibility: 'Persist the requirement-owned value.',
          },
        ],
        requiresReconfirmationOnChange: true,
      },
    ],
    requirementBoundary: {
      business: { requirementIds: ['MUST-001'], viewRefs: [], diagramRefs: [] },
      governance: { requirementIds: [], viewRefs: [], diagramRefs: [] },
    },
    artifactAutomationPlan: [],
    requiredCommands: [
      {
        id: 'CMD-001',
        command: 'npm test',
        purpose: 'Verify.',
        perMustAssertions: { 'MUST-001': 'The current attempt proves persistence.' },
        perMustRows: [
          {
            mustRef: 'MUST-001',
            traceRows: ['TRACE-001'],
            evidenceRefs: ['EVD-001'],
            assertion: 'The current attempt proves persistence.',
          },
        ],
      },
    ],
    suggestedCommands: [],
    requiredContractChecks: [],
    implementationTasks: [
      {
        id: 'TASK-001',
        title: 'Persist value.',
        requirementRefs: ['MUST-001'],
        targetPaths: ['src/target.ts'],
        traceRefs: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
      },
    ],
    closeoutReadinessPreview: {
      requiredCommands: ['CMD-001'],
      orphanPolicy: 'block',
      currentAttemptPolicy: 'current_only',
      recordClosedPolicy: 'controlled_only',
      blockingConditions: ['missing evidence'],
    },
  };
}

function projectFixture(confirmation: Record<string, unknown>) {
  return projectProductionImplementationConfirmation({
    source: {
      recordId: 'REQ-FACADE',
      requirementSetId: 'REQ-FACADE',
      sourceDocumentHash: hash('a'),
    },
    semanticModelHash: hash('b'),
    confirmation,
    decisionReceipts: [{ receiptId: 'semantic:001', receiptHash: hash('c') }],
    attemptBindings: {
      transactionId: 'TX-FACADE',
      implementationAttemptId: 'IMP-FACADE',
      auditAttemptId: 'AUD-FACADE',
    },
    expectedSets: expectedSetsFromConfirmation(confirmation),
    conservationReceiptRefs: ['semantic:001'],
    auditReceiptRefs: ['semantic:001'],
  });
}

describe('production confirmation projection facade', () => {
  it('preserves localized semantic projections and expected-red acceptance metadata', () => {
    const confirmation = confirmationFixture();
    const must = (confirmation.must as Record<string, unknown>[])[0];
    must.textZh = '持久化该值。';
    must.localized = { 'zh-CN': { text: '持久化该值。' } };
    const trace = (confirmation.traceRows as Record<string, unknown>[])[0];
    trace.acceptanceSummaryZh = '验收证据已绑定。';
    trace.localized = { 'zh-CN': { acceptanceSummary: '验收证据已绑定。' } };
    const acceptance = (confirmation.acceptanceTests as Record<string, unknown>[])[0];
    acceptance.expectedPreImplementationState = 'expected_red';
    acceptance.redProofPlan = 'Implementation must begin from a failing acceptance proof.';
    acceptance.positiveControl = true;
    acceptance.negativeControls = ['NEG-001'];

    const result = projectFixture(confirmation);

    expect(result.confirmation.must[0]).toMatchObject({
      textZh: '持久化该值。',
      localized: { 'zh-CN': { text: '持久化该值。' } },
    });
    expect(result.confirmation.traceRows[0]).toMatchObject({
      acceptanceSummaryZh: '验收证据已绑定。',
      localized: { 'zh-CN': { acceptanceSummary: '验收证据已绑定。' } },
    });
    expect(result.confirmation.acceptanceTests[0]).toMatchObject({
      expectedPreImplementationState: 'expected_red',
      redProofPlan: 'Implementation must begin from a failing acceptance proof.',
      positiveControl: true,
      negativeControls: ['NEG-001'],
    });
  });

  it('preserves source-derived side-effect safety and failure linkage', () => {
    const confirmation = confirmationFixture();
    const must = (confirmation.must as Record<string, unknown>[])[0];
    const evidence = (confirmation.evidence as Record<string, unknown>[])[0];
    const mustId = String(must.id);
    const evidenceId = String(evidence.id);
    const failureId = mustId.replace(/^MUST-/u, 'FAIL-');
    const sideEffectSafety = {
      timeoutPolicy: `${mustId} fails closed on timeout.`,
      failurePolicy: `${mustId} records failure before external publication.`,
      idempotencyPolicy: `${mustId} retries the current attempt idempotently.`,
      recoveryPolicy: `${mustId} restores the prior valid state on recovery.`,
      assertionEvidence: `${mustId} requires current-attempt assertion evidence.`,
    };
    must.coveredByFailurePath = [failureId];
    must.sideEffectSafety = sideEffectSafety;
    evidence.sideEffectSafety = `${evidenceId} proves timeout, failure, idempotency, recovery, and assertion behavior.`;
    confirmation.failurePaths = [
      {
        id: failureId,
        title: `${mustId} external side effect failure`,
        trigger: `${mustId} cannot publish safely.`,
        expectedBehavior: 'Fail closed and retain the prior valid state.',
        forbiddenBehavior: 'Do not publish a partial result.',
        blocksCompletionWhenViolated: true,
        linkedNegIds: [],
        linkedEvidenceIds: [evidenceId],
        ownerMustRefs: [mustId],
        requiredAssertions: [`${failureId} blocks completion until recovery evidence exists.`],
      },
    ];

    const result = projectFixture(confirmation);

    expect(result.confirmation.must[0]).toMatchObject({
      id: mustId,
      coveredByFailurePath: [failureId],
      sideEffectSafety,
    });
    expect(result.confirmation.evidence[0]).toMatchObject({
      id: evidenceId,
      sideEffectSafety: expect.stringContaining(mustId.replace(/^MUST-/u, 'EVD-')),
    });
  });

  it('accepts not_selected as the canonical draft language before rendering', () => {
    const confirmation = confirmationFixture();
    confirmation.confirmationLanguage = 'not_selected';

    const result = projectFixture(confirmation);

    expect(result.confirmation.confirmationLanguage).toBe('not_selected');
  });

  it('projects and validates an audited semantic confirmation deterministically', () => {
    const result = projectProductionImplementationConfirmation({
      source: {
        recordId: 'REQ-FACADE',
        requirementSetId: 'REQ-FACADE',
        sourceDocumentHash: hash('a'),
      },
      semanticModelHash: hash('b'),
      confirmation: confirmationFixture(),
      decisionReceipts: [
        { receiptId: 'semantic:001', receiptHash: hash('c') },
        { receiptId: 'audit:001', receiptHash: hash('d') },
      ],
      attemptBindings: {
        transactionId: 'TX-FACADE',
        implementationAttemptId: 'IMP-FACADE',
        auditAttemptId: 'AUD-FACADE',
      },
      expectedSets: {
        requirements: ['MUST-001'],
        evidence: ['EVD-001'],
        acceptance: ['ACC-001'],
        traces: ['TRACE-001'],
        failures: [],
        edges: [],
        targets: ['TARGET-001'],
        commands: ['CMD-001'],
      },
      conservationReceiptRefs: ['semantic:001'],
      auditReceiptRefs: ['audit:001'],
    });

    expect(result.confirmation.recordId).toBe('REQ-FACADE');
    expect(result.confirmation.implementationConfirmationHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(result.projectionReceipt).toMatchObject({
      schemaVersion: 'requirements-contract-confirmation-projection-receipt/v1',
      validationDecision: 'pass',
      sourceDocumentHash: hash('a'),
      semanticModelHash: hash('b'),
    });
    expect(result.projectionReceipt.projectionRecipeVersion).toBe(
      'confirmation-projection-contract/v1'
    );
    expect(result.confirmation.targetModificationPaths[0]).toMatchObject({
      perMustResponsibilities: { 'MUST-001': 'Persist the requirement-owned value.' },
      perMustRows: [{ mustRef: 'MUST-001' }],
    });
    expect(result.confirmation.requiredCommands[0]).toMatchObject({
      perMustAssertions: { 'MUST-001': 'The current attempt proves persistence.' },
      perMustRows: [{ mustRef: 'MUST-001' }],
    });
  });

  it('fails closed when the canonical semantic fields are incomplete', () => {
    const confirmation = confirmationFixture();
    delete confirmation.must;

    expect(() =>
      projectProductionImplementationConfirmation({
        source: {
          recordId: 'REQ-FACADE',
          requirementSetId: 'REQ-FACADE',
          sourceDocumentHash: hash('a'),
        },
        semanticModelHash: hash('b'),
        confirmation,
        decisionReceipts: [{ receiptId: 'semantic:001', receiptHash: hash('c') }],
        attemptBindings: {
          transactionId: 'TX-FACADE',
          implementationAttemptId: 'IMP-FACADE',
          auditAttemptId: 'AUD-FACADE',
        },
        expectedSets: {
          requirements: ['MUST-001'],
          evidence: ['EVD-001'],
          acceptance: ['ACC-001'],
          traces: ['TRACE-001'],
          failures: [],
          edges: [],
          targets: ['TARGET-001'],
          commands: ['CMD-001'],
        },
        conservationReceiptRefs: ['semantic:001'],
        auditReceiptRefs: ['semantic:001'],
      })
    ).toThrow(/missing_required_semantic_value:must/u);
  });

  it('projects the known staging envelope without promoting aliases or inapplicable fields', () => {
    const confirmation = confirmationFixture();
    const mustNot = structuredClone(confirmation.mustNot);
    confirmation.outOfScope = structuredClone(mustNot);
    confirmation.governanceEventTypeRegistryPolicy = {
      controlFieldVocabulary: ['confirmationHistory'],
    };
    confirmation.mustExecutionDecompositionMatrix = [{ id: 'MDM-001' }];
    confirmation.atomicImplementationTaskList = [
      {
        id: 'TASK-001',
        text: 'Persist value.',
        derivedFromMustRef: 'MUST-001',
        targetFiles: ['src/target.ts'],
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
      },
    ];
    delete confirmation.implementationTasks;
    confirmation.mustToAtomicTaskMap = { 'MUST-001': ['TASK-001'] };
    confirmation.atomicTaskToTraceMap = { 'TASK-001': ['TRACE-001'] };
    confirmation.atomicTaskToAcceptanceMap = { 'TASK-001': ['ACC-001'] };
    confirmation.atomicTaskToEvidenceMap = { 'TASK-001': ['EVD-001'] };
    confirmation.atomicTaskToTargetPathMap = { 'TASK-001': ['TARGET-001'] };
    confirmation.atomicTaskToCommandMap = { 'TASK-001': ['CMD-001'] };
    confirmation.acceptanceCriteria = structuredClone(confirmation.acceptanceTests);
    confirmation.e2eScenarios = [];
    confirmation.businessViews = [];
    confirmation.architectureImpacts = [];
    (confirmation.acceptanceTests as Record<string, unknown>[])[0].perMustAssertions = {
      'MUST-001': 'The primary source acceptance independently verifies MUST-001.',
    };
    confirmation.acceptanceTests = [
      ...(confirmation.acceptanceTests as Record<string, unknown>[]),
      {
        ...(confirmation.acceptanceTests as Record<string, unknown>[])[0],
        oracle: 'A second proof surface remains bound to the same source acceptance.',
        perMustAssertions: {
          'MUST-002': 'The shared source acceptance independently verifies MUST-002.',
        },
      },
    ];

    const result = projectProductionImplementationConfirmation({
      source: {
        recordId: 'REQ-FACADE',
        requirementSetId: 'REQ-FACADE',
        sourceDocumentHash: hash('a'),
      },
      semanticModelHash: hash('b'),
      confirmation,
      decisionReceipts: [{ receiptId: 'semantic:001', receiptHash: hash('c') }],
      attemptBindings: {
        transactionId: 'TX-FACADE',
        implementationAttemptId: 'IMP-FACADE',
        auditAttemptId: 'AUD-FACADE',
      },
      expectedSets: {
        requirements: ['MUST-001'],
        evidence: ['EVD-001'],
        acceptance: ['ACC-001'],
        traces: ['TRACE-001'],
        failures: [],
        edges: [],
        targets: ['TARGET-001'],
        commands: ['CMD-001'],
      },
      conservationReceiptRefs: ['semantic:001'],
      auditReceiptRefs: ['semantic:001'],
    });

    expect(result.confirmation.mustNot).toEqual(mustNot);
    expect(result.confirmation).not.toHaveProperty('outOfScope');
    expect(result.confirmation).not.toHaveProperty('governanceEventTypeRegistryPolicy');
    expect(result.confirmation).not.toHaveProperty('mustExecutionDecompositionMatrix');
    expect(result.confirmation).not.toHaveProperty('atomicImplementationTaskList');
    expect(result.confirmation).not.toHaveProperty('mustToAtomicTaskMap');
    expect(result.confirmation).not.toHaveProperty('acceptanceCriteria');
    expect(result.confirmation.implementationTasks).toEqual([
      {
        id: 'TASK-001',
        title: 'Persist value.',
        requirementRefs: ['MUST-001'],
        targetPaths: ['src/target.ts'],
        traceRefs: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
      },
    ]);
    expect(result.confirmation.acceptanceTests).toHaveLength(1);
    expect(result.confirmation.acceptanceTests[0].oracle).toContain(
      'A second proof surface remains bound to the same source acceptance.'
    );
    expect(result.confirmation.acceptanceTests[0].perMustAssertions).toEqual({
      'MUST-001': 'The primary source acceptance independently verifies MUST-001.',
      'MUST-002': 'The shared source acceptance independently verifies MUST-002.',
    });
    expect(result.projectionReceipt).toMatchObject({
      stagingOnlyFields: expect.arrayContaining([
        'outOfScope',
        'mustExecutionDecompositionMatrix',
        'atomicImplementationTaskList',
      ]),
      omittedInapplicableFields: ['governanceEventTypeRegistryPolicy'],
    });
  });

  it('normalizes staging reference arrays and target classifications into canonical values', () => {
    const confirmation = confirmationFixture();
    confirmation.sequenceViews = [
      {
        id: 'SEQ-001',
        acceptanceRefs: ['ACC-001', 'ACC-001'],
      },
    ];
    confirmation.flowViews = [
      {
        id: 'FLOW-001',
        acceptanceRefs: ['ACC-001', 'ACC-001'],
      },
    ];
    (confirmation.targetModificationPaths as Record<string, unknown>[])[0].changeType =
      'validation';

    const result = projectProductionImplementationConfirmation({
      source: {
        recordId: 'REQ-FACADE',
        requirementSetId: 'REQ-FACADE',
        sourceDocumentHash: hash('a'),
      },
      semanticModelHash: hash('b'),
      confirmation,
      decisionReceipts: [{ receiptId: 'semantic:001', receiptHash: hash('c') }],
      attemptBindings: {
        transactionId: 'TX-FACADE',
        implementationAttemptId: 'IMP-FACADE',
        auditAttemptId: 'AUD-FACADE',
      },
      expectedSets: {
        requirements: ['MUST-001'],
        evidence: ['EVD-001'],
        acceptance: ['ACC-001'],
        traces: ['TRACE-001'],
        failures: [],
        edges: [],
        targets: ['TARGET-001'],
        commands: ['CMD-001'],
      },
      conservationReceiptRefs: ['semantic:001'],
      auditReceiptRefs: ['semantic:001'],
    });

    expect(result.confirmation.sequenceViews[0].acceptanceRefs).toEqual(['ACC-001']);
    expect(result.confirmation.flowViews[0].acceptanceRefs).toEqual(['ACC-001']);
    expect(result.confirmation.targetModificationPaths[0].changeType).toBe('test');
  });

  it('fails closed for an undeclared staging field', () => {
    const confirmation = confirmationFixture();
    confirmation.inventedBusinessTruth = true;

    expect(() =>
      projectProductionImplementationConfirmation({
        source: {
          recordId: 'REQ-FACADE',
          requirementSetId: 'REQ-FACADE',
          sourceDocumentHash: hash('a'),
        },
        semanticModelHash: hash('b'),
        confirmation,
        decisionReceipts: [{ receiptId: 'semantic:001', receiptHash: hash('c') }],
        attemptBindings: {
          transactionId: 'TX-FACADE',
          implementationAttemptId: 'IMP-FACADE',
          auditAttemptId: 'AUD-FACADE',
        },
        expectedSets: {
          requirements: ['MUST-001'],
          evidence: ['EVD-001'],
          acceptance: ['ACC-001'],
          traces: ['TRACE-001'],
          failures: [],
          edges: [],
          targets: ['TARGET-001'],
          commands: ['CMD-001'],
        },
        conservationReceiptRefs: ['semantic:001'],
        auditReceiptRefs: ['semantic:001'],
      })
    ).toThrow(/confirmation_projection_undeclared_field:inventedBusinessTruth/u);
  });
});
