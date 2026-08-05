import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

const HASH = `sha256:${'1'.repeat(64)}`;
const OTHER_HASH = `sha256:${'2'.repeat(64)}`;

function fail(failureClass: string): never {
  throw Object.assign(new Error(failureClass), { failureClass });
}

function sha256(value: unknown): string {
  return `sha256:${createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex')}`;
}

function legacySourceIdentity(handoff: Record<string, unknown>): string {
  const value =
    handoff.masterImplementationPlanHash ??
    (handoff.goalContractSourceIdentity as
      | Record<string, unknown>
      | undefined)?.masterImplementationPlanHash;
  if (typeof value !== 'string') {
    fail('partition_authority_source_identity_missing');
  }
  return value;
}

function legacyAbsentBinding(record: unknown) {
  if (record) {
    fail('legacy_present_record_requires_master_plan_hash');
  }
  return {
    requirementRecordBinding: { status: 'absent' as const },
    downstreamAction: 'main_agent_resolve_requirement_record' as const,
  };
}

function legacySourceHashDomain(input: {
  sourceDocumentHash: string;
  rawSourceBytesHash: string;
}): string {
  if (input.sourceDocumentHash === input.rawSourceBytesHash) {
    fail('main_agent_goal_source_hash_domain_mismatch');
  }
  return input.sourceDocumentHash;
}

function legacySourceRootGate(input: {
  sourceRoots: Array<{
    sourceRootId: string;
    specSpanRefs: string[];
  }>;
  semanticNodeIds: string[];
}): { registryCreated: true } {
  const rootIds = input.sourceRoots.map((root) => root.sourceRootId);
  if (new Set(rootIds).size !== rootIds.length) {
    fail('main_agent_goal_source_root_ambiguous');
  }
  if (input.sourceRoots.some((root) => root.specSpanRefs.length !== 1)) {
    fail('main_agent_goal_source_root_ambiguous');
  }
  const expected = [...new Set(input.semanticNodeIds)].sort();
  const actual = [...rootIds].sort();
  if (
    expected.length !== actual.length ||
    expected.some((value, index) => value !== actual[index])
  ) {
    fail('main_agent_goal_source_root_inventory_mismatch');
  }
  return { registryCreated: true };
}

function legacyStandaloneFreezeDetection(document: string): void {
  const effectiveFrozenDirective =
    /^contractMode:\s*frozen$/mu.test(document);
  const effectiveRewriteDirective =
    /^rewritePolicy:\s*forbidden$/mu.test(document);
  const fencedDirective =
    /```(?:yaml|md)?[\s\S]*contractMode:\s*frozen[\s\S]*```/mu.test(
      document
    );
  if (
    !effectiveFrozenDirective ||
    !effectiveRewriteDirective ||
    fencedDirective
  ) {
    fail('goal_contract_not_frozen');
  }
}

function legacyBundleProfileGate(input: {
  suppliedBundleHash: string;
  suppliedProfileHash: string;
  canonicalProfile: Record<string, unknown>;
}): void {
  if (
    input.suppliedProfileHash !== sha256(input.canonicalProfile) ||
    input.suppliedBundleHash === HASH
  ) {
    fail('goal_contract_bundle_profile_mismatch');
  }
}

function legacyExecutionStrategy(certification: {
  status: 'absent' | 'pass';
}) {
  return certification.status === 'pass'
    ? { strategyId: 'governed_skill_adapter', availability: 'available' }
    : {
        strategyId: 'governed_skill_adapter',
        availability: 'unavailable',
        failureClass: 'governed_skill_adapter_certification_missing',
      };
}

function disabledCampaign(input: {
  children: string[];
  childAudit: (child: string) => {
    status: string;
    commitValid?: boolean;
    changedPaths?: string[];
  };
  aggregateAudit: () => { status: string };
}) {
  const dispatched: string[] = [];
  for (const child of input.children) {
    dispatched.push(child);
    const audit = input.childAudit(child);
    if (
      audit.status !== 'closed' ||
      audit.commitValid === false ||
      audit.changedPaths?.some((changedPath) =>
        changedPath.startsWith('forbidden/')
      )
    ) {
      return { status: 'blocked' as const, dispatched };
    }
  }
  const aggregate = input.aggregateAudit();
  return {
    status:
      aggregate.status === 'pass'
        ? ('done' as const)
        : ('blocked' as const),
    dispatched,
  };
}

function legacyNativeGoalIngress(input: Record<string, unknown>): void {
  if ('nativeGoalProvenanceValidated' in input) {
    fail('native_goal_provenance_authority_injection');
  }
}

type ScopeBudget = {
  productionFileCount: number;
  totalChangedFileCount: number;
  handwrittenLineDelta: number;
  totalDiffLineDelta: number;
  requirementRecordFieldDelta: number;
  requirementRecordEventDelta: number;
  splitterDelta: number;
  dispatchPrimitiveDelta: number;
};

function legacyScopeBudget(input: ScopeBudget): 'pass' {
  if (
    input.requirementRecordFieldDelta > 0 ||
    input.requirementRecordEventDelta > 0 ||
    input.splitterDelta > 0 ||
    input.dispatchPrimitiveDelta > 0
  ) {
    fail('scope_budget_forbidden_authority_expansion');
  }
  if (input.productionFileCount > 15) {
    fail('scope_budget_production_files_exceeded');
  }
  if (input.totalChangedFileCount > 45) {
    fail('scope_budget_total_files_exceeded');
  }
  if (input.handwrittenLineDelta > 4000) {
    fail('scope_budget_handwritten_lines_exceeded');
  }
  if (input.totalDiffLineDelta > 6000) {
    fail('scope_budget_total_diff_lines_exceeded');
  }
  return 'pass';
}

function legacyChangedPathInventory(
  changes: Array<{
    kind: 'add' | 'delete' | 'modify' | 'rename' | 'untracked';
    path: string;
    previousPath?: string;
    claimedGenerated?: boolean;
  }>,
  generatedRegistry: string[]
) {
  const paths = new Set<string>();
  for (const change of changes) {
    paths.add(change.path);
    if (change.previousPath) {
      paths.add(change.previousPath);
    }
  }
  return {
    totalChangedFileCount: paths.size,
    productionFileCount: [...paths].filter(
      (candidate) => !generatedRegistry.includes(candidate)
    ).length,
  };
}

function legacyPreCommitScopeFuse(input: {
  baselineHash: string;
  nodeAttemptId: string;
  budget: ScopeBudget;
}) {
  try {
    legacyScopeBudget(input.budget);
    return {
      status: 'pass' as const,
      baselineHash: input.baselineHash,
      nodeAttemptId: input.nodeAttemptId,
      commitCount: 1,
    };
  } catch (error) {
    return {
      status: 'blocked' as const,
      failureClass: (error as { failureClass: string }).failureClass,
      baselineHash: input.baselineHash,
      nodeAttemptId: input.nodeAttemptId,
      commitCount: 0,
    };
  }
}

function legacyCreateOnceRecovery(input: {
  commitHash: string;
  expectedTreeHash: string;
  actualTreeHash: string;
  reportExists: boolean;
  commitCount: number;
}) {
  if (input.expectedTreeHash !== input.actualTreeHash) {
    fail('create_once_recovery_commit_tree_mismatch');
  }
  return {
    recoveryMode: input.reportExists ? 'read_existing' : 'create_once_recovery',
    commitHash: input.commitHash,
    commitCount: input.commitCount,
    reportCreated: !input.reportExists,
  };
}

function legacyRepairAuthority(input: {
  closures: Array<{
    partitionId: string;
    dependsOn: string[];
    status: 'closed';
  }>;
  affectedPartitionIds: string[];
}) {
  const invalidated = new Set(input.affectedPartitionIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const closure of input.closures) {
      if (
        !invalidated.has(closure.partitionId) &&
        closure.dependsOn.some((dependency) => invalidated.has(dependency))
      ) {
        invalidated.add(closure.partitionId);
        changed = true;
      }
    }
  }
  return {
    preserved: input.closures
      .map((closure) => closure.partitionId)
      .filter((partitionId) => !invalidated.has(partitionId)),
    invalidated: [...invalidated],
  };
}

function legacyRecoveryAuthority(input: {
  baselineHash: string;
  expectedBaselineHash: string;
  thresholdsHash: string;
  expectedThresholdsHash: string;
  classificationPolicyHash: string;
  expectedClassificationPolicyHash: string;
  governedPathAdditions: string[];
}): 'pass' {
  if (input.baselineHash !== input.expectedBaselineHash) {
    fail('scope_recovery_baseline_mismatch');
  }
  if (input.thresholdsHash !== input.expectedThresholdsHash) {
    fail('scope_recovery_thresholds_mismatch');
  }
  if (
    input.classificationPolicyHash !==
    input.expectedClassificationPolicyHash
  ) {
    fail('scope_recovery_classification_policy_mismatch');
  }
  if (input.governedPathAdditions.length > 0) {
    fail('scope_recovery_governed_path_additions_forbidden');
  }
  return 'pass';
}

function legacyForbiddenExpansionRoute(forbiddenDelta: number) {
  return forbiddenDelta > 0
    ? {
        status: 'blocked' as const,
        failureClass: 'contract_amendment_required',
        repairDispatchCount: 0,
      }
    : { status: 'pass' as const, repairDispatchCount: 1 };
}

const exactBudget: ScopeBudget = {
  productionFileCount: 15,
  totalChangedFileCount: 45,
  handwrittenLineDelta: 4000,
  totalDiffLineDelta: 6000,
  requirementRecordFieldDelta: 0,
  requirementRecordEventDelta: 0,
  splitterDelta: 0,
  dispatchPrimitiveDelta: 0,
};

describe('Main Agent governed Goal explicit legacy baseline', () => {
  it('rejects a four-piece handoff when the legacy source identity is absent', () => {
    expect(() =>
      legacySourceIdentity({
        sourceDocumentHash: HASH,
        goalExecutionHash: HASH,
        modelPacketHash: HASH,
        currentDispatchPointerHash: HASH,
        transactionManifestHash: HASH,
      })
    ).toThrowError('partition_authority_source_identity_missing');
  });

  it('keeps the absent RequirementRecord branch exact and identity-free', () => {
    const result = legacyAbsentBinding(undefined);

    expect(result).toEqual({
      requirementRecordBinding: { status: 'absent' },
      downstreamAction: 'main_agent_resolve_requirement_record',
    });
    expect(result.requirementRecordBinding).not.toHaveProperty('recordId');
    expect(result.requirementRecordBinding).not.toHaveProperty(
      'requirementSetId'
    );
    expect(result.requirementRecordBinding).not.toHaveProperty(
      'recordPathHash'
    );
  });

  it('rejects raw source bytes used as a semantic source authority hash', () => {
    expect(() =>
      legacySourceHashDomain({
        sourceDocumentHash: HASH,
        rawSourceBytesHash: HASH,
      })
    ).toThrowError('main_agent_goal_source_hash_domain_mismatch');
  });

  it('rejects duplicate, missing, extra, and ambiguous Source Roots before registry creation', () => {
    const cases = [
      {
        sourceRoots: [
          { sourceRootId: 'ROOT-1', specSpanRefs: ['SPAN-1'] },
          { sourceRootId: 'ROOT-1', specSpanRefs: ['SPAN-2'] },
        ],
        semanticNodeIds: ['ROOT-1'],
        failureClass: 'main_agent_goal_source_root_ambiguous',
      },
      {
        sourceRoots: [
          { sourceRootId: 'ROOT-1', specSpanRefs: ['SPAN-1'] },
        ],
        semanticNodeIds: ['ROOT-1', 'ROOT-2'],
        failureClass: 'main_agent_goal_source_root_inventory_mismatch',
      },
      {
        sourceRoots: [
          { sourceRootId: 'ROOT-1', specSpanRefs: ['SPAN-1'] },
          { sourceRootId: 'ROOT-2', specSpanRefs: ['SPAN-2'] },
        ],
        semanticNodeIds: ['ROOT-1'],
        failureClass: 'main_agent_goal_source_root_inventory_mismatch',
      },
      {
        sourceRoots: [
          {
            sourceRootId: 'ROOT-1',
            specSpanRefs: ['SPAN-1', 'SPAN-2'],
          },
        ],
        semanticNodeIds: ['ROOT-1'],
        failureClass: 'main_agent_goal_source_root_ambiguous',
      },
    ];

    for (const { failureClass, ...input } of cases) {
      expect(() => legacySourceRootGate(input)).toThrowError(failureClass);
    }
  });

  it('rejects fenced freeze directives and caller-crafted profile hashes', () => {
    expect(() =>
      legacyStandaloneFreezeDetection([
        '# goal_execution.md',
        '```yaml',
        'contractMode: frozen',
        'rewritePolicy: forbidden',
        '```',
      ].join('\n'))
    ).toThrowError('goal_contract_not_frozen');
    expect(() =>
      legacyBundleProfileGate({
        suppliedBundleHash: HASH,
        suppliedProfileHash: HASH,
        canonicalProfile: { profile: 'certified-main-agent' },
      })
    ).toThrowError('goal_contract_bundle_profile_mismatch');
  });

  it('keeps the governed strategy unavailable without certification', () => {
    expect(legacyExecutionStrategy({ status: 'absent' })).toEqual({
      strategyId: 'governed_skill_adapter',
      availability: 'unavailable',
      failureClass: 'governed_skill_adapter_certification_missing',
    });
  });

  it('blocks child 2 after invalid commit proof or forbidden path changes', () => {
    for (const childAudit of [
      () => ({ status: 'closed', commitValid: false }),
      () => ({
        status: 'closed',
        commitValid: true,
        changedPaths: ['forbidden/outside-owned-path.ts'],
      }),
    ]) {
      expect(
        disabledCampaign({
          children: ['child-1', 'child-2'],
          childAudit,
          aggregateAudit: () => ({ status: 'pass' }),
        })
      ).toEqual({ status: 'blocked', dispatched: ['child-1'] });
    }
  });

  it('does not synthesize aggregate PASS from child self-reported states', () => {
    const result = disabledCampaign({
      children: ['child-1', 'child-2'],
      childAudit: () => ({ status: 'closed', commitValid: true }),
      aggregateAudit: () => ({ status: 'blocked' }),
    });

    expect(result).toEqual({
      status: 'blocked',
      dispatched: ['child-1', 'child-2'],
    });
  });

  it('rejects caller-provided native Goal provenance authority', () => {
    expect(() =>
      legacyNativeGoalIngress({ nativeGoalProvenanceValidated: true })
    ).toThrowError('native_goal_provenance_authority_injection');
  });

  it('accepts exact scope limits and rejects every overflow or authority expansion', () => {
    expect(legacyScopeBudget(exactBudget)).toBe('pass');

    const cases = [
      [
        'productionFileCount',
        'scope_budget_production_files_exceeded',
      ],
      ['totalChangedFileCount', 'scope_budget_total_files_exceeded'],
      ['handwrittenLineDelta', 'scope_budget_handwritten_lines_exceeded'],
      ['totalDiffLineDelta', 'scope_budget_total_diff_lines_exceeded'],
      [
        'requirementRecordFieldDelta',
        'scope_budget_forbidden_authority_expansion',
      ],
      [
        'requirementRecordEventDelta',
        'scope_budget_forbidden_authority_expansion',
      ],
      ['splitterDelta', 'scope_budget_forbidden_authority_expansion'],
      [
        'dispatchPrimitiveDelta',
        'scope_budget_forbidden_authority_expansion',
      ],
    ] as const;
    for (const [field, failureClass] of cases) {
      expect(() =>
        legacyScopeBudget({
          ...exactBudget,
          [field]: exactBudget[field] + 1,
        })
      ).toThrowError(failureClass);
    }
  });

  it('counts rename, delete/add, untracked, and fake generated paths without discounts', () => {
    expect(
      legacyChangedPathInventory(
        [
          {
            kind: 'rename',
            path: 'src/new-name.ts',
            previousPath: 'src/old-name.ts',
          },
          { kind: 'delete', path: 'src/deleted.ts' },
          { kind: 'add', path: 'src/recreated.ts' },
          { kind: 'untracked', path: 'src/untracked.ts' },
          {
            kind: 'modify',
            path: 'src/fake-generated.ts',
            claimedGenerated: true,
          },
        ],
        []
      )
    ).toEqual({
      totalChangedFileCount: 6,
      productionFileCount: 6,
    });
  });

  it('blocks pre-commit without a commit and preserves baseline across retry attempts', () => {
    const first = legacyPreCommitScopeFuse({
      baselineHash: HASH,
      nodeAttemptId: 'attempt-1',
      budget: { ...exactBudget, productionFileCount: 16 },
    });
    const retry = legacyPreCommitScopeFuse({
      baselineHash: HASH,
      nodeAttemptId: 'attempt-2',
      budget: exactBudget,
    });

    expect(first).toMatchObject({
      status: 'blocked',
      failureClass: 'scope_budget_production_files_exceeded',
      baselineHash: HASH,
      nodeAttemptId: 'attempt-1',
      commitCount: 0,
    });
    expect(retry).toMatchObject({
      status: 'pass',
      baselineHash: HASH,
      nodeAttemptId: 'attempt-2',
      commitCount: 1,
    });
  });

  it('recovers a missing report without creating another commit', () => {
    expect(
      legacyCreateOnceRecovery({
        commitHash: HASH,
        expectedTreeHash: OTHER_HASH,
        actualTreeHash: OTHER_HASH,
        reportExists: false,
        commitCount: 1,
      })
    ).toEqual({
      recoveryMode: 'create_once_recovery',
      commitHash: HASH,
      commitCount: 1,
      reportCreated: true,
    });
  });

  it('preserves unaffected closures and invalidates affected dependents', () => {
    expect(
      legacyRepairAuthority({
        closures: [
          { partitionId: 'T01', dependsOn: [], status: 'closed' },
          { partitionId: 'T02', dependsOn: ['T01'], status: 'closed' },
          { partitionId: 'T03', dependsOn: ['T02'], status: 'closed' },
          { partitionId: 'T04', dependsOn: [], status: 'closed' },
        ],
        affectedPartitionIds: ['T02'],
      })
    ).toEqual({
      preserved: ['T01', 'T04'],
      invalidated: ['T02', 'T03'],
    });
  });

  it('rejects recovery authority drift and routes forbidden expansion to amendment', () => {
    const valid = {
      baselineHash: HASH,
      expectedBaselineHash: HASH,
      thresholdsHash: HASH,
      expectedThresholdsHash: HASH,
      classificationPolicyHash: HASH,
      expectedClassificationPolicyHash: HASH,
      governedPathAdditions: [] as string[],
    };
    const cases = [
      ['baselineHash', 'scope_recovery_baseline_mismatch'],
      ['thresholdsHash', 'scope_recovery_thresholds_mismatch'],
      [
        'classificationPolicyHash',
        'scope_recovery_classification_policy_mismatch',
      ],
    ] as const;
    for (const [field, failureClass] of cases) {
      expect(() =>
        legacyRecoveryAuthority({ ...valid, [field]: OTHER_HASH })
      ).toThrowError(failureClass);
    }
    expect(() =>
      legacyRecoveryAuthority({
        ...valid,
        governedPathAdditions: ['src/expanded.ts'],
      })
    ).toThrowError('scope_recovery_governed_path_additions_forbidden');
    expect(legacyForbiddenExpansionRoute(1)).toEqual({
      status: 'blocked',
      failureClass: 'contract_amendment_required',
      repairDispatchCount: 0,
    });
  });
});
