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

});
