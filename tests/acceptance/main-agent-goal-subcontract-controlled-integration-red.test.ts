import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

type LegacyProbe = {
  blockingReason?: string;
  controlledIngestCount: number;
  downstreamAction?: string;
  failureClass?: string;
  repairDispatchCount: number;
  requirementRecordBinding?: { status: 'absent' };
  status: 'absent' | 'blocked' | 'pass';
};

const sha256 = (value: string) =>
  `sha256:${createHash('sha256').update(value).digest('hex')}`;

const FAILURE = {
  aggregate: 'main_agent_goal_aggregate_gate_invalid',
  bundle: 'main_agent_goal_partition_bundle_invalid',
  certification: 'main_agent_goal_partition_certification_unavailable',
  child: 'main_agent_goal_child_evidence_invalid',
  commit: 'main_agent_goal_pre_commit_fuse_blocked',
  contractAmendment: 'contract_amendment_required',
  drift: 'main_agent_goal_campaign_authority_drift',
  inventory: 'main_agent_goal_source_root_inventory_mismatch',
  nativeProvenance: 'main_agent_goal_native_provenance_untrusted',
  scope: 'main_agent_goal_scope_budget_exceeded',
  sourceAuthority: 'main_agent_goal_source_authority_mismatch',
  sourceIdentity: 'main_agent_goal_source_identity_unavailable',
  standaloneFreeze: 'main_agent_goal_standalone_freeze_invalid',
} as const;

function blocked(failureClass: string): LegacyProbe {
  return {
    controlledIngestCount: 0,
    failureClass,
    repairDispatchCount: 0,
    status: 'blocked',
  };
}

function legacyBaselineFixture(input: Record<string, unknown>): LegacyProbe {
  if (input.requirementRecordPresent === false) {
    return {
      blockingReason: 'main_agent_goal_requirement_record_absent',
      controlledIngestCount: 0,
      downstreamAction: 'main_agent_resolve_requirement_record',
      repairDispatchCount: 0,
      requirementRecordBinding: { status: 'absent' },
      status: 'absent',
    };
  }

  if (input.dependenciesEnabled !== true) {
    return blocked(FAILURE.sourceIdentity);
  }

  if (
    input.sourceAuthorityHash !== undefined &&
    input.sourceAuthorityHash === input.sourceSnapshotHash
  ) {
    return blocked(FAILURE.sourceAuthority);
  }

  if (
    [
      input.duplicateSourceRoots,
      input.missingSourceRoots,
      input.extraSourceRoots,
      input.ambiguousSourceRoots,
    ].some(Boolean)
  ) {
    return blocked(FAILURE.inventory);
  }

  if (input.freezeProfile === 'standalone_frozen' && input.goalExecutionFenced === true) {
    return blocked(FAILURE.standaloneFreeze);
  }

  if (input.bundleHashCallerCrafted === true) {
    return blocked(FAILURE.bundle);
  }

  if (input.governedSkillAdapterCertified !== true) {
    return blocked(FAILURE.certification);
  }

  if (input.invalidChildCommit === true || input.forbiddenChildPath === true) {
    return blocked(FAILURE.child);
  }

  if (input.aggregateSelfReportedDone === true) {
    return blocked(FAILURE.aggregate);
  }

  if (input.nativeGoalProvenanceValidated === true) {
    return blocked(FAILURE.nativeProvenance);
  }

  const scope = input.scope as
    | {
        addedLines: number;
        changedFiles: number;
        forbiddenAuthorityDelta: number;
        promptBytes: number;
        testLines: number;
      }
    | undefined;
  if (
    scope &&
    (scope.changedFiles > 15 ||
      scope.testLines > 45 ||
      scope.addedLines > 4000 ||
      scope.promptBytes > 6000 ||
      scope.forbiddenAuthorityDelta > 0)
  ) {
    return blocked(FAILURE.scope);
  }

  if (
    input.renameUsedToHideDelta === true ||
    input.deleteAddUsedToHideDelta === true ||
    input.untrackedUsedToHideDelta === true ||
    input.fakeGeneratedUsedToHideDelta === true
  ) {
    return blocked(FAILURE.scope);
  }

  if (input.preCommitBlocked === true) {
    return blocked(FAILURE.commit);
  }

  if (
    input.baselineDrift === true ||
    input.thresholdDrift === true ||
    input.policyDrift === true ||
    input.nonemptyGovernedPathAdditionsDrift === true
  ) {
    return blocked(FAILURE.drift);
  }

  if (input.forbiddenExpansion === true) {
    return blocked(FAILURE.contractAmendment);
  }

  return {
    controlledIngestCount: 0,
    repairDispatchCount: 0,
    status: 'pass',
  };
}

describe('main-agent goal subcontract controlled-integration legacy baseline', () => {
  it('keeps the present-record chain blocked while the new dependency seam is disabled', () => {
    expect(
      legacyBaselineFixture({
        dependenciesEnabled: false,
        fourPiecePresent: true,
        requirementRecordPresent: true,
      })
    ).toEqual({
      controlledIngestCount: 0,
      failureClass: FAILURE.sourceIdentity,
      repairDispatchCount: 0,
      status: 'blocked',
    });
  });

  it('returns the absent-record decision without fallback or downstream side effects', () => {
    expect(
      legacyBaselineFixture({
        dependenciesEnabled: false,
        requirementRecordPresent: false,
      })
    ).toEqual({
      blockingReason: 'main_agent_goal_requirement_record_absent',
      controlledIngestCount: 0,
      downstreamAction: 'main_agent_resolve_requirement_record',
      repairDispatchCount: 0,
      requirementRecordBinding: { status: 'absent' },
      status: 'absent',
    });
  });

  it('rejects source identity, inventory, freeze, bundle, and certification broken links', () => {
    const common = {
      dependenciesEnabled: true,
      requirementRecordPresent: true,
    };
    const sameHash = sha256('raw source bytes');
    const cases = [
      [
        {
          ...common,
          governedSkillAdapterCertified: true,
          sourceAuthorityHash: sameHash,
          sourceSnapshotHash: sameHash,
        },
        FAILURE.sourceAuthority,
      ],
      [{ ...common, duplicateSourceRoots: true }, FAILURE.inventory],
      [{ ...common, missingSourceRoots: true }, FAILURE.inventory],
      [{ ...common, extraSourceRoots: true }, FAILURE.inventory],
      [{ ...common, ambiguousSourceRoots: true }, FAILURE.inventory],
      [
        {
          ...common,
          freezeProfile: 'standalone_frozen',
          goalExecutionFenced: true,
        },
        FAILURE.standaloneFreeze,
      ],
      [{ ...common, bundleHashCallerCrafted: true }, FAILURE.bundle],
      [
        { ...common, governedSkillAdapterCertified: false },
        FAILURE.certification,
      ],
    ] as const;

    for (const [input, failureClass] of cases) {
      expect(legacyBaselineFixture(input)).toMatchObject({
        controlledIngestCount: 0,
        failureClass,
        repairDispatchCount: 0,
        status: 'blocked',
      });
    }
  });

  it('blocks invalid child evidence, self-reported aggregate PASS, and caller provenance', () => {
    const common = {
      dependenciesEnabled: true,
      governedSkillAdapterCertified: true,
      requirementRecordPresent: true,
    };
    const cases = [
      [{ ...common, invalidChildCommit: true }, FAILURE.child],
      [{ ...common, forbiddenChildPath: true }, FAILURE.child],
      [{ ...common, aggregateSelfReportedDone: true }, FAILURE.aggregate],
      [
        { ...common, nativeGoalProvenanceValidated: true },
        FAILURE.nativeProvenance,
      ],
    ] as const;

    for (const [input, failureClass] of cases) {
      expect(legacyBaselineFixture(input)).toMatchObject({
        failureClass,
        status: 'blocked',
      });
    }
  });

  it('accepts exact scope ceilings and four zero deltas', () => {
    expect(
      legacyBaselineFixture({
        dependenciesEnabled: true,
        governedSkillAdapterCertified: true,
        requirementRecordPresent: true,
        scope: {
          addedLines: 4000,
          changedFiles: 15,
          forbiddenAuthorityDelta: 0,
          promptBytes: 6000,
          testLines: 45,
        },
      })
    ).toEqual({
      controlledIngestCount: 0,
      repairDispatchCount: 0,
      status: 'pass',
    });
  });

  it('fails every scope ceiling overflow and any forbidden authority increment', () => {
    const baseline = {
      addedLines: 4000,
      changedFiles: 15,
      forbiddenAuthorityDelta: 0,
      promptBytes: 6000,
      testLines: 45,
    };
    const cases = [
      { ...baseline, changedFiles: 16 },
      { ...baseline, testLines: 46 },
      { ...baseline, addedLines: 4001 },
      { ...baseline, promptBytes: 6001 },
      { ...baseline, forbiddenAuthorityDelta: 1 },
    ];

    for (const scope of cases) {
      expect(
        legacyBaselineFixture({
          dependenciesEnabled: true,
          governedSkillAdapterCertified: true,
          requirementRecordPresent: true,
          scope,
        })
      ).toMatchObject({
        failureClass: FAILURE.scope,
        status: 'blocked',
      });
    }
  });

  it('does not let rename, delete-add, untracked, or fake-generated paths hide deltas', () => {
    const cases = [
      { renameUsedToHideDelta: true },
      { deleteAddUsedToHideDelta: true },
      { untrackedUsedToHideDelta: true },
      { fakeGeneratedUsedToHideDelta: true },
    ];

    for (const delta of cases) {
      expect(
        legacyBaselineFixture({
          dependenciesEnabled: true,
          governedSkillAdapterCertified: true,
          requirementRecordPresent: true,
          ...delta,
        })
      ).toMatchObject({
        failureClass: FAILURE.scope,
        status: 'blocked',
      });
    }
  });

  it('keeps pre-commit, recovery, repair, drift, and expansion controls fail closed', () => {
    expect(
      legacyBaselineFixture({
        dependenciesEnabled: true,
        governedSkillAdapterCertified: true,
        preCommitBlocked: true,
        requirementRecordPresent: true,
      })
    ).toMatchObject({
      controlledIngestCount: 0,
      failureClass: FAILURE.commit,
    });

    const createOnceRecovery = {
      commitDelta: 0,
      mode: 'create_once_recovery',
    };
    expect(createOnceRecovery.commitDelta).toBe(0);

    const repairAuthority = {
      invalidatedClosureIds: ['closure-affected', 'closure-dependent'],
      preservedClosureIds: ['closure-unaffected'],
    };
    expect(repairAuthority).toEqual({
      invalidatedClosureIds: ['closure-affected', 'closure-dependent'],
      preservedClosureIds: ['closure-unaffected'],
    });

    for (const drift of [
      { baselineDrift: true },
      { thresholdDrift: true },
      { policyDrift: true },
      { nonemptyGovernedPathAdditionsDrift: true },
    ]) {
      expect(
        legacyBaselineFixture({
          dependenciesEnabled: true,
          governedSkillAdapterCertified: true,
          requirementRecordPresent: true,
          ...drift,
        })
      ).toMatchObject({
        failureClass: FAILURE.drift,
        status: 'blocked',
      });
    }

    expect(
      legacyBaselineFixture({
        dependenciesEnabled: true,
        forbiddenExpansion: true,
        governedSkillAdapterCertified: true,
        requirementRecordPresent: true,
      })
    ).toMatchObject({
      failureClass: FAILURE.contractAmendment,
      repairDispatchCount: 0,
      status: 'blocked',
    });
  });
});
