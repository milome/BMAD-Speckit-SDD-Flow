import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as adapterModule from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-governed-goal-integration';

const MODULE_PATH = path.resolve(
  __dirname,
  '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-governed-goal-integration.ts'
);
const HASHES = Array.from(
  { length: 12 },
  (_, index) => `sha256:${String(index + 1).padStart(64, '0')}`
);

async function loadAdapter(): Promise<Record<string, (...args: any[]) => any>> {
  void MODULE_PATH;
  return adapterModule as Record<string, (...args: any[]) => any>;
}

function presentFixture() {
  const implementationView = {
    tasks: [{ id: 'TASK-1' }],
    traceSlices: [{ id: 'TRACE-1' }],
    productionSymbols: ['compileMainAgentGoalSourceAuthority'],
    entryPoints: ['main-agent-governed-goal-integration'],
    allowedPaths: ['packages/bmad-speckit/src/main-agent/source-authority/scripts'],
    commands: {
      direct: ['test:direct'],
      impacted: ['test:impacted'],
      integration: ['test:integration'],
      regression: ['test:regression'],
    },
    dependencies: [],
    commitPolicy: 'one_atomic_commit',
    closeConditions: 'audited',
    synchronizationObligations: ['source-dist parity'],
  };
  const acceptanceEvidenceView = {
    acceptanceItems: [{ id: 'AC-1' }],
    negativeControls: [{ id: 'NEG-1' }],
    productionEntryPoints: ['main-agent-governed-goal-integration'],
    manualScenarios: [{ id: 'MANUAL-1' }],
    expectedEvidence: [{ id: 'EVD-1' }],
    antiCheatRules: ['no caller hashes'],
    stopConditions: ['stop on audit failure'],
  };
  const calls: string[] = [];
  const authorityInputs: Record<string, unknown>[] = [];
  const dependencies = {
    compileCanonicalIntent: (input: Record<string, unknown>) => {
      calls.push('compile-intent');
      return {
        canonicalIntentBundleHash: HASHES[4],
        canonicalIntentSemanticHash: HASHES[5],
        specSpanRegistry: {
          specSpanRegistryHash: HASHES[6],
          specSpans: [{ specSpanId: 'spec-span-1', sourceObligationIds: ['ROOT-1'] }],
        },
        canonicalIntentIR: [
          {
            intentRecordId: 'intent-1',
            declaredSourceId: 'ROOT-1',
            specSpanRefs: ['spec-span-1'],
          },
        ],
        input,
      };
    },
    projectImplementationView: () => {
      calls.push('project-implementation');
      return implementationView;
    },
    projectAcceptanceEvidenceView: () => {
      calls.push('project-acceptance');
      return acceptanceEvidenceView;
    },
    validateImplementationView: () => {
      calls.push('validate-implementation');
      return { decision: 'pass' };
    },
    validateAcceptanceEvidenceView: () => {
      calls.push('validate-acceptance');
      return { decision: 'pass' };
    },
    reconcileGoalContractViews: () => {
      calls.push('reconcile-views');
      return { graphInputHash: HASHES[7], issues: [] };
    },
    compileMainAgentGoalAuthority: (input: Record<string, unknown>) => {
      calls.push('compile-goal-authority');
      authorityInputs.push(input);
      return { goalContractBundleHash: HASHES[8] };
    },
    partitionGoalAuthority: () => {
      calls.push('partition-goal');
      return {
        partitionManifestHash: HASHES[9],
        partitionManifest: { topologicalOrder: ['partition-1'] },
      };
    },
    certifyPartition: () => {
      calls.push('certify-partition');
      return { status: 'certified', certificationHash: HASHES[10] };
    },
  };

  return {
    calls,
    authorityInputs,
    dependencies,
    input: {
      requirementRecordBinding: {
        status: 'present',
        recordId: 'REQ-1',
        requirementSetId: 'REQ-1',
        recordPathHash: HASHES[0],
      },
      sourceAuthority: {
        sourceAuthorityHash: HASHES[1],
        sourceSnapshotHash: HASHES[2],
        registeredAuthoritySnapshotHash: HASHES[3],
        sourcePath: 'requirements/source.md',
        verifiedObligationBases: [
          {
            sourceRootId: 'ROOT-1',
            declaredSourceId: 'ROOT-1',
            sourceArtifactId: 'source-1',
            sourceSnapshotHash: HASHES[2],
            sourceRole: 'primary_implementation_authority',
            namespace: 'REQ',
            sourceOrder: 0,
            kind: 'acceptance_condition',
            exactText: 'ROOT-1: MUST preserve authority.',
            headingPath: ['Requirements'],
            startByte: 0,
            endByteExclusive: 32,
            dependencyRefs: [],
          },
        ],
        orderedSourceSnapshotSet: {
          orderedSourceSnapshotSetHash: HASHES[2],
          sourceSnapshots: [],
        },
        sourceCompositionPolicy: {
          sourceCompositionPolicyHash: HASHES[3],
        },
        compositeSourceAuthorityBundle: {
          sourceAuthorityBundleHash: HASHES[4],
        },
      },
      modelPacket: {
        packetId: 'packet-1',
        implementationView,
        acceptanceEvidenceView,
      },
      dependencies,
    },
  };
}

describe('Main Agent governed Goal source-authority adapter', () => {
  it('exposes the three frozen public integration functions', async () => {
    const adapter = await loadAdapter();

    expect(typeof adapter.compileMainAgentGoalSourceAuthority).toBe('function');
    expect(typeof adapter.runMainAgentGoalSubcontractCampaign).toBe('function');
    expect(typeof adapter.projectGovernedSkillCampaignTaskReport).toBe('function');
  });

  it('returns the exact absent RequirementRecord branch without identities or side effects', async () => {
    const adapter = await loadAdapter();
    expect(typeof adapter.compileMainAgentGoalSourceAuthority).toBe('function');

    const result = adapter.compileMainAgentGoalSourceAuthority({
      requirementRecordBinding: { status: 'absent' },
      dependencies: {
        compileCanonicalIntent: () => {
          throw new Error('must not execute');
        },
      },
    });

    expect(result).toEqual({
      status: 'requirement_record_absent',
      requirementRecordBinding: { status: 'absent' },
      downstreamAction: 'main_agent_resolve_requirement_record',
    });
    expect(result.requirementRecordBinding).not.toHaveProperty('recordId');
    expect(result.requirementRecordBinding).not.toHaveProperty('requirementSetId');
    expect(result.requirementRecordBinding).not.toHaveProperty('recordPathHash');
  });

  it('compiles deterministic verified bases, views, partition, and certification', async () => {
    const adapter = await loadAdapter();
    expect(typeof adapter.compileMainAgentGoalSourceAuthority).toBe('function');
    const firstFixture = presentFixture();
    const secondFixture = presentFixture();

    const first = adapter.compileMainAgentGoalSourceAuthority(firstFixture.input);
    const second = adapter.compileMainAgentGoalSourceAuthority(secondFixture.input);

    expect(second).toEqual(first);
    expect(first.status).toBe('certified_partition_ready');
    expect(first.requirementRecordBinding.status).toBe('present');
    expect(first.sourceAuthorityCompilationReceipt).toMatchObject({
      sourceAuthorityHash: HASHES[1],
      sourceSnapshotHash: HASHES[2],
      registeredAuthoritySnapshotHash: HASHES[3],
      sourcePath: 'requirements/source.md',
    });
    expect(first.sourceRootToSpecSpanMappings).toEqual([
      {
        sourceRootId: 'ROOT-1',
        intentRecordId: 'intent-1',
        specSpanId: 'spec-span-1',
      },
    ]);
    expect(firstFixture.authorityInputs[0].requirementRecordBinding).toEqual({
      status: 'present',
      recordId: 'REQ-1',
      requirementSetId: 'REQ-1',
      recordPathHash: HASHES[0],
    });
    expect(firstFixture.calls).toEqual([
      'compile-intent',
      'project-implementation',
      'project-acceptance',
      'validate-implementation',
      'validate-acceptance',
      'reconcile-views',
      'compile-goal-authority',
      'partition-goal',
      'certify-partition',
    ]);
  });

  it('rejects unknown fields in a present RequirementRecord binding', async () => {
    const adapter = await loadAdapter();
    const fixture = presentFixture();

    expect(() =>
      adapter.compileMainAgentGoalSourceAuthority({
        ...fixture.input,
        requirementRecordBinding: {
          ...fixture.input.requirementRecordBinding,
          nested: { recordId: 'FORGED' },
        },
      })
    ).toThrowError('main_agent_goal_source_authority_mismatch');
  });

  it('invokes one campaign and audits each child result in frozen order', async () => {
    const adapter = await loadAdapter();
    expect(typeof adapter.runMainAgentGoalSubcontractCampaign).toBe('function');
    const events: string[] = [];
    const persisted: unknown[] = [];
    let controlledIngestCount = 0;
    const result = adapter.runMainAgentGoalSubcontractCampaign({
      packetId: 'packet-serial-campaign',
      children: [
        { partitionId: 'partition-1', predecessorPartitionIds: [] },
        { partitionId: 'partition-2', predecessorPartitionIds: ['partition-1'] },
      ],
      requirementRecordBinding: { status: 'absent' },
      dependencies: {
        compileExecutionPackage: () => {
          events.push('compile-package');
          return { packageManifestHash: HASHES[0] };
        },
        auditExecutionPackage: () => {
          events.push('audit-package');
          return { status: 'pass', packageManifestHash: HASHES[0] };
        },
        invokeCampaign: (campaignInput: any) => {
          events.push('invoke-campaign');
          const childInvocations = [
            { partitionId: 'partition-1' },
            { partitionId: 'partition-2' },
          ];
          for (const invocation of childInvocations) {
            expect(campaignInput.onChildInvocation(invocation)).toEqual({ authorized: true });
          }
          return {
            hostInvocationCount: 1,
            childInvocations,
          };
        },
        auditCompletedChild: ({ child }: any) => {
          events.push(`audit:${child.partitionId}`);
          return {
            status: 'closed',
            partitionId: child.partitionId,
            commitHash: HASHES[1],
          };
        },
        auditCompletedCampaign: () => {
          events.push('audit-aggregate');
          return {
            status: 'done',
            packageManifestHash: HASHES[0],
            campaignReportHash: HASHES[2],
          };
        },
        persistTaskReport: (taskReport: unknown) => {
          events.push('persist-task-report');
          persisted.push(taskReport);
        },
        ingestMainAgentTaskReport: async () => {
          controlledIngestCount += 1;
        },
      },
    });

    expect(result).not.toBeInstanceOf(Promise);
    expect(result.status).toBe('done');
    expect(result.childResults).toHaveLength(2);
    expect(events).toEqual([
      'compile-package',
      'audit-package',
      'invoke-campaign',
      'audit:partition-1',
      'audit:partition-2',
      'audit-aggregate',
      'persist-task-report',
    ]);
    expect(persisted).toHaveLength(1);
    expect(controlledIngestCount).toBe(0);
    expect(result.requirementRecordBinding).toEqual({ status: 'absent' });
    expect(result.downstreamAction).toBe('main_agent_resolve_requirement_record');
    expect(result.taskReport).toEqual({
      packetId: 'packet-serial-campaign',
      status: 'done',
      filesChanged: [],
      validationsRun: [],
      evidence: [],
      downstreamContext: [
        `campaignReportHash=${HASHES[2]}`,
        `packageManifestHash=${HASHES[0]}`,
        'requirementRecordBinding=absent',
      ],
    });
  });

  it('rejects an empty executable child set before campaign side effects', async () => {
    const adapter = await loadAdapter();
    let sideEffects = 0;

    expect(() =>
      adapter.runMainAgentGoalSubcontractCampaign({
        packetId: 'packet-empty-campaign',
        children: [],
        requirementRecordBinding: { status: 'absent' },
        dependencies: {
          compileExecutionPackage: () => {
            sideEffects += 1;
          },
          auditExecutionPackage: () => undefined,
          invokeCampaign: () => undefined,
          auditCompletedChild: () => undefined,
          auditCompletedCampaign: () => undefined,
          persistTaskReport: () => undefined,
        },
      })
    ).toThrowError('main_agent_goal_campaign_input_invalid');
    expect(sideEffects).toBe(0);
  });

  it('stops child audit authorization when the current child is not closed', async () => {
    const adapter = await loadAdapter();
    expect(typeof adapter.runMainAgentGoalSubcontractCampaign).toBe('function');
    const invoked: string[] = [];
    let persistCount = 0;
    const result = await adapter.runMainAgentGoalSubcontractCampaign({
      packetId: 'packet-blocked-child',
      children: [
        { partitionId: 'partition-1', predecessorPartitionIds: [] },
        { partitionId: 'partition-2', predecessorPartitionIds: ['partition-1'] },
      ],
      requirementRecordBinding: { status: 'present', recordId: 'REQ-1' },
      dependencies: {
        compileExecutionPackage: () => ({ packageManifestHash: HASHES[0] }),
        auditExecutionPackage: () => ({
          status: 'pass',
          packageManifestHash: HASHES[0],
        }),
        invokeCampaign: (campaignInput: any) => {
          invoked.push('campaign');
          const childInvocations = [{ partitionId: 'partition-1' }];
          expect(campaignInput.onChildInvocation(childInvocations[0])).toEqual({
            authorized: false,
          });
          return {
            hostInvocationCount: 1,
            childInvocations,
          };
        },
        auditCompletedChild: ({ child }: any) => ({
          status: 'blocked',
          partitionId: child.partitionId,
          failureClass: 'child_commit_invalid',
        }),
        auditCompletedCampaign: () => {
          throw new Error('must not execute');
        },
        persistTaskReport: () => {
          persistCount += 1;
        },
      },
    });

    expect(result.status).toBe('blocked');
    expect(invoked).toEqual(['campaign']);
    expect(result.childResults).toHaveLength(1);
    expect(result.taskReport.status).toBe('blocked');
    expect(persistCount).toBe(1);
  });

  it('persists a blocked Main Agent TaskReport when package audit fails', async () => {
    const adapter = await loadAdapter();
    const persisted: any[] = [];
    let hostInvocationCount = 0;

    const result = await adapter.runMainAgentGoalSubcontractCampaign({
      packetId: 'packet-package-blocked',
      children: [{ partitionId: 'partition-1', predecessorPartitionIds: [] }],
      requirementRecordBinding: { status: 'absent' },
      dependencies: {
        compileExecutionPackage: () => ({ packageManifestHash: HASHES[0] }),
        auditExecutionPackage: () => ({
          status: 'blocked',
          packageManifestHash: HASHES[0],
          failureClass: 'execution_package_audit_failed',
        }),
        invokeCampaign: () => {
          hostInvocationCount += 1;
        },
        auditCompletedChild: () => undefined,
        auditCompletedCampaign: () => undefined,
        persistTaskReport: (report: unknown) => {
          persisted.push(report);
        },
      },
    });

    expect(hostInvocationCount).toBe(0);
    expect(result.status).toBe('blocked');
    expect(result.taskReport.status).toBe('blocked');
    expect(result.taskReport.driftFlags).toEqual(['execution_package_audit_failed']);
    expect(persisted).toEqual([result.taskReport]);
  });

  it('fails missing dependency contracts before any side effect', async () => {
    const adapter = await loadAdapter();
    expect(typeof adapter.runMainAgentGoalSubcontractCampaign).toBe('function');
    let sideEffects = 0;

    expect(() =>
      adapter.runMainAgentGoalSubcontractCampaign({
        packetId: 'packet-missing-dependency',
        children: [{ partitionId: 'partition-1', predecessorPartitionIds: [] }],
        dependencies: {
          compileExecutionPackage: () => {
            sideEffects += 1;
          },
        },
      })
    ).toThrowError('main_agent_goal_campaign_dependency_missing');
    expect(sideEffects).toBe(0);
  });

  it('rejects TaskReport provenance from a different package run', async () => {
    const adapter = await loadAdapter();
    expect(typeof adapter.projectGovernedSkillCampaignTaskReport).toBe('function');

    expect(() =>
      adapter.projectGovernedSkillCampaignTaskReport({
        packetId: 'packet-provenance-mismatch',
        campaignResult: {
          status: 'done',
          packageManifestHash: HASHES[0],
          campaignReportHash: HASHES[1],
          childResults: [],
          aggregateAudit: { status: 'done' },
          requirementRecordBinding: { status: 'absent' },
        },
        provenance: {
          packageManifestHash: HASHES[2],
          campaignReportHash: HASHES[1],
        },
      })
    ).toThrowError('main_agent_goal_task_report_provenance_mismatch');
  });

  it('does not project done when aggregate audit is not closed', async () => {
    const adapter = await loadAdapter();
    const report = adapter.projectGovernedSkillCampaignTaskReport({
      packetId: 'packet-aggregate-open',
      campaignResult: {
        status: 'done',
        packageManifestHash: HASHES[0],
        campaignReportHash: HASHES[1],
        children: [{ partitionId: 'partition-1' }],
        childResults: [
          {
            status: 'closed',
            partitionId: 'partition-1',
            commitHash: HASHES[2],
          },
        ],
        aggregateAudit: { status: 'blocked' },
        requirementRecordBinding: { status: 'absent' },
      },
      provenance: {
        packageManifestHash: HASHES[0],
        campaignReportHash: HASHES[1],
      },
    });

    expect(report.status).toBe('partial');
  });

  it('rejects closed child results whose identities do not match the frozen child order', async () => {
    const adapter = await loadAdapter();

    expect(() =>
      adapter.projectGovernedSkillCampaignTaskReport({
        packetId: 'packet-child-order-mismatch',
        campaignResult: {
          status: 'done',
          packageManifestHash: HASHES[0],
          campaignReportHash: HASHES[1],
          packageResult: { packageManifestHash: HASHES[0] },
          packageAudit: {
            status: 'pass',
            packageManifestHash: HASHES[0],
          },
          children: [{ partitionId: 'partition-1' }],
          childResults: [
            {
              status: 'closed',
              partitionId: 'partition-forged',
              commitHash: HASHES[2],
            },
          ],
          aggregateAudit: {
            status: 'done',
            packageManifestHash: HASHES[0],
            campaignReportHash: HASHES[1],
          },
          requirementRecordBinding: { status: 'absent' },
        },
        provenance: {
          packageManifestHash: HASHES[0],
          campaignReportHash: HASHES[1],
        },
      })
    ).toThrowError('main_agent_goal_task_report_provenance_mismatch');
  });

  it('rejects aggregate provenance that replaces the audited package manifest hash', async () => {
    const adapter = await loadAdapter();
    let persistCount = 0;

    expect(() =>
      adapter.runMainAgentGoalSubcontractCampaign({
        packetId: 'packet-aggregate-mismatch',
        children: [{ partitionId: 'partition-1', predecessorPartitionIds: [] }],
        requirementRecordBinding: { status: 'absent' },
        dependencies: {
          compileExecutionPackage: () => ({
            packageManifestHash: HASHES[0],
          }),
          auditExecutionPackage: () => ({
            status: 'pass',
            packageManifestHash: HASHES[0],
          }),
          invokeCampaign: (campaignInput: any) => {
            const invocation = { partitionId: 'partition-1' };
            expect(campaignInput.onChildInvocation(invocation)).toEqual({ authorized: true });
            return { hostInvocationCount: 1, childInvocations: [invocation] };
          },
          auditCompletedChild: () => ({
            status: 'closed',
            partitionId: 'partition-1',
            commitHash: HASHES[1],
          }),
          auditCompletedCampaign: () => ({
            status: 'done',
            packageManifestHash: HASHES[3],
            campaignReportHash: HASHES[2],
          }),
          persistTaskReport: () => {
            persistCount += 1;
          },
        },
      })
    ).toThrowError('main_agent_goal_task_report_provenance_mismatch');
    expect(persistCount).toBe(0);
  });

  it('does not persist a TaskReport when aggregate audit is blocked', async () => {
    const adapter = await loadAdapter();
    let persistCount = 0;
    const result = await adapter.runMainAgentGoalSubcontractCampaign({
      packetId: 'packet-aggregate-blocked',
      children: [{ partitionId: 'partition-1', predecessorPartitionIds: [] }],
      requirementRecordBinding: { status: 'absent' },
      dependencies: {
        compileExecutionPackage: () => ({
          packageManifestHash: HASHES[0],
        }),
        auditExecutionPackage: () => ({
          status: 'pass',
          packageManifestHash: HASHES[0],
        }),
        invokeCampaign: (campaignInput: any) => {
          const invocation = { partitionId: 'partition-1' };
          expect(campaignInput.onChildInvocation(invocation)).toEqual({ authorized: true });
          return { hostInvocationCount: 1, childInvocations: [invocation] };
        },
        auditCompletedChild: () => ({
          status: 'closed',
          partitionId: 'partition-1',
          commitHash: HASHES[1],
        }),
        auditCompletedCampaign: () => ({
          status: 'blocked',
          failureClass: 'aggregate_commit_chain_invalid',
        }),
        persistTaskReport: () => {
          persistCount += 1;
        },
      },
    });

    expect(result.status).toBe('partial');
    expect(result.taskReport.status).toBe('partial');
    expect(persistCount).toBe(1);
  });

  it('rejects missing terminal TaskReport provenance hashes', async () => {
    const adapter = await loadAdapter();

    expect(() =>
      adapter.projectGovernedSkillCampaignTaskReport({
        packetId: 'packet-terminal-provenance-missing',
        campaignResult: {
          status: 'done',
          packageManifestHash: HASHES[0],
          children: [{ partitionId: 'partition-1' }],
          childResults: [
            {
              status: 'closed',
              partitionId: 'partition-1',
              commitHash: HASHES[1],
            },
          ],
          aggregateAudit: { status: 'done' },
          requirementRecordBinding: { status: 'absent' },
        },
        provenance: {
          packageManifestHash: HASHES[0],
        },
      })
    ).toThrowError('main_agent_goal_task_report_provenance_mismatch');
  });

});
