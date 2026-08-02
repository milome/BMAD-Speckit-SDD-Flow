import { describe, expect, it } from 'vitest';
import { compileRequirementContractModel } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-compiler';
import { closeRequirementContractInvariants } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-invariant-closure';
import type {
  RequirementContractBoundary,
  RequirementContractModel,
  RequirementContractRequirement,
  RequirementContractView,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-model';

function requirement(role: string, line: number): RequirementContractRequirement {
  return {
    id: `REQUIREMENT-${role.toUpperCase()}`,
    text: `${role} behavior is source authorized.`,
    sourceRequirementId: `SOURCE-${role.toUpperCase()}`,
    sourcePath: 'docs/requirements/closure-source.md',
    sourceSpan: { startLine: line, endLine: line },
  };
}

function boundary(line: number): RequirementContractBoundary {
  return {
    id: 'BOUNDARY-EXTERNAL-SYSTEM',
    text: 'External-system changes are outside this requirement set.',
    authorityState: 'source_boundary',
    provenance: {
      sourceRequirementId: 'SOURCE-BOUNDARY-EXTERNAL-SYSTEM',
      sourcePath: 'docs/requirements/closure-source.md',
      sourceSpan: { startLine: line, endLine: line },
    },
  };
}

function view(
  id: string,
  scope: RequirementContractView['scope'],
  covers: string[]
): RequirementContractView {
  return { id, title: `${id} view`, scope, covers };
}

function completeModel(): RequirementContractModel {
  const must = requirement('primary', 7);
  const negative = requirement('negative', 8);
  const outOfScope = boundary(9);
  const command = {
    id: 'VALIDATION-PRIMARY',
    command: 'npx vitest run tests/primary-behavior.test.ts',
    requirementRefs: [must.id],
  };
  const target = {
    id: 'MODIFICATION-PRIMARY',
    path: 'src/primary-behavior.ts',
    requirementRefs: [must.id],
  };
  const evidence = [
    { id: 'EVIDENCE-PRIMARY', covers: [must.id], text: 'Primary behavior observation.' },
    { id: 'EVIDENCE-NEGATIVE', covers: [negative.id], text: 'Negative behavior observation.' },
  ];
  const acceptanceCriteria = [
    { id: 'ACCEPTANCE-PRIMARY', covers: [must.id], text: 'Primary behavior oracle.' },
    { id: 'ACCEPTANCE-NEGATIVE', covers: [negative.id], text: 'Negative behavior oracle.' },
  ];
  const business = view('VIEW-BUSINESS-PRIMARY', 'business', [must.id]);
  const sequence = view('VIEW-SEQUENCE-PRIMARY', 'business', [must.id]);
  const flow = view('VIEW-FLOW-PRIMARY', 'business', [must.id]);
  const edge = view('VIEW-EDGE-NEGATIVE', 'business', [negative.id]);
  const boundaryView = view('VIEW-BOUNDARY-EXTERNAL', 'business', [outOfScope.id]);
  const compiled = compileRequirementContractModel({
    recordId: 'MODEL-COMPLETE',
    requirementSetId: 'MODEL-COMPLETE-SET',
    must: [must],
    notDone: [negative],
    outOfScope: [outOfScope],
    requiredCommands: [command],
    targetPaths: [target],
  });

  return {
    ...compiled,
    evidence,
    acceptanceCriteria,
    traceRows: [
      {
        id: 'TRACE-PRIMARY',
        covers: [must.id],
        evidenceRefs: [evidence[0].id],
        acceptanceRefs: [acceptanceCriteria[0].id],
        businessViewRefs: [business.id],
        sequenceViewRefs: [sequence.id],
        flowViewRefs: [flow.id],
        edgeCaseViewRefs: [],
        boundaryViewRefs: [],
        contractValidationCommandRefs: [command.id],
        deliveryEvidenceCommandRefs: [command.id],
      },
      {
        id: 'TRACE-NEGATIVE',
        covers: [negative.id],
        evidenceRefs: [evidence[1].id],
        acceptanceRefs: [acceptanceCriteria[1].id],
        businessViewRefs: [],
        sequenceViewRefs: [],
        flowViewRefs: [],
        edgeCaseViewRefs: [edge.id],
        boundaryViewRefs: [boundaryView.id],
      },
    ],
    businessViews: [business],
    sequenceViews: [sequence],
    flowViews: [flow],
    edgeCaseViews: [edge],
    boundaryViews: [boundaryView],
    applicability: {
      localization: {
        applies: false,
        reason: 'No localized confirmation output was requested.',
      },
    },
  };
}

describe('requirements contract measured invariant closure', () => {
  it('keeps missing semantics unresolved and derives a blocking post-model measure', () => {
    const sourceRequirement = requirement('unresolved', 7);
    const compiled = compileRequirementContractModel({
      recordId: 'MODEL-INCOMPLETE',
      requirementSetId: 'MODEL-INCOMPLETE-SET',
      must: [sourceRequirement],
    });

    const closed = closeRequirementContractInvariants(compiled);
    const issueCodes = closed.invariantClosure.issues.map((issue) => issue.code);

    expect(closed.notDone).toEqual([]);
    expect(closed.outOfScope).toEqual([]);
    expect(closed.evidence).toEqual([]);
    expect(closed.acceptanceCriteria).toEqual([]);
    expect(closed.requiredCommands).toEqual([]);
    expect(closed.traceRows).toEqual([]);
    expect(closed.targetModificationPaths).toEqual([]);
    expect(issueCodes).toEqual(
      expect.arrayContaining([
        'missing_negative_requirement_authority',
        'missing_out_of_scope_authority',
        'missing_evidence_coverage',
        'missing_acceptance_coverage',
        'missing_trace_coverage',
        'missing_validation_authority',
        'missing_target_authority',
      ])
    );
    expect(closed.invariantClosure.measureAfter?.unresolvedInvariantCount).toBeGreaterThan(0);
    expect(closed.invariantClosure.measureAfter?.missingProjectionCount).toBeGreaterThan(0);
    expect(closed.invariantClosure.remainingIssueCount).toBe(
      closed.invariantClosure.issues.length
    );
    expect(closed.invariantClosure.terminalState).toBe('blocked');
  });

  it('preserves a complete source-authorized model and measures its actual terminal state', () => {
    const model = completeModel();
    const closed = closeRequirementContractInvariants(model);

    expect(closed.evidence).toEqual(model.evidence);
    expect(closed.acceptanceCriteria).toEqual(model.acceptanceCriteria);
    expect(closed.requiredCommands).toEqual(model.requiredCommands);
    expect(closed.traceRows).toEqual(model.traceRows);
    expect(closed.businessViews).toEqual(model.businessViews);
    expect(closed.sequenceViews).toEqual(model.sequenceViews);
    expect(closed.flowViews).toEqual(model.flowViews);
    expect(closed.edgeCaseViews).toEqual(model.edgeCaseViews);
    expect(closed.boundaryViews).toEqual(model.boundaryViews);
    expect(closed.targetModificationPaths).toEqual(model.targetModificationPaths);
    expect(closed.invariantClosure.measureAfter).toEqual({
      unresolvedInvariantCount: 0,
      orphanReferenceCount: 0,
      missingProjectionCount: 0,
      localizationParityCount: 0,
      schemaValidationCount: 0,
    });
    expect(closed.invariantClosure.remainingIssueCount).toBe(0);
    expect(closed.invariantClosure.terminalState).toBe('confirmable');
  });

  it('records typed receipts only for closure passes that actually execute', () => {
    const closed = closeRequirementContractInvariants(completeModel());
    const receipts = closed.invariantClosure.roundReceipts ?? [];

    expect(receipts.length).toBeGreaterThan(0);
    expect(closed.invariantClosure.appliedPasses).toEqual(
      receipts.map((receipt) => receipt.passId)
    );
    expect(
      receipts.every(
        (receipt) =>
          receipt.executed === true &&
          Array.isArray(receipt.findings) &&
          Array.isArray(receipt.outputs.changedFields) &&
          receipt.outputs.changedFields.length === 0 &&
          receipt.measureBefore.unresolvedInvariantCount >= 0 &&
          receipt.measureAfter.unresolvedInvariantCount >= 0
      )
    ).toBe(true);
  });
});
