import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fsDefault, {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { produceImplementationReadiness } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-implementation-readiness-v2';
import {
  finalizeCommittedGoalRun,
  type GoalFinalizationResult,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-goal-run-finalizer';
import type { ExecutionFinalCandidate } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-execution-final-candidate';
import type {
  MainAgentExecutionActorIsolationReceipt,
  MainAgentExecutionFinalJudgeActorIntent,
  MainAgentExecutionFinalJudgeResult,
  MainAgentExecutionReviewerResult,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-execution-final-judge-campaign';
import { computeMainAgentExecutionActorIsolationPolicyHash } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-execution-final-judge-campaign';
import { stableHash } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-verification-evidence-normalizer';
import {
  hashControlPlaneValue,
  stableControlPlaneStringify,
} from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/canonical-hash';
import { materializeImplementationReadinessFixture } from '../helpers/implementation-readiness-fixture';

const ROOT = process.cwd();
const TSX = path.join(ROOT, 'node_modules/tsx/dist/cli.mjs');
const GOAL_COMMAND = path.join(ROOT, 'packages/bmad-speckit/src/commands/goal-contract.ts');
const RUNTIME = path.join(ROOT, 'packages/bmad-speckit/src/main-agent/runtime.ts');
const GOAL_RUNNER = `const {goalContractCommand}=require(process.argv[1]);Promise.resolve(goalContractCommand({},process.argv.slice(2))).then(code=>{process.exitCode=code;}).catch(error=>{console.error(error);process.exitCode=2;});`;
const RUNTIME_RUNNER = `const {mainAgentRuntimeCommand}=require(process.argv[1]);Promise.resolve(mainAgentRuntimeCommand(process.argv.slice(2))).then(code=>{process.exitCode=code;}).catch(error=>{console.error(error);process.exitCode=2;});`;
const HASH = `sha256:${'a'.repeat(64)}`;
const TEST_PROVIDER_REF = 'test-goal-finalization-provider';

type JsonRecord = Record<string, any>;
type ArtifactRef = { path: string; hash: string };
type LeafAdapters = {
  resolveProviderRef(): string;
  invokeReviewer(
    intent: MainAgentExecutionFinalJudgeActorIntent
  ): Promise<MainAgentExecutionReviewerResult>;
  invokeFinalJudge(
    intent: MainAgentExecutionFinalJudgeActorIntent
  ): Promise<MainAgentExecutionFinalJudgeResult>;
  claimLeaseMs?: number;
  onStaleClaimObserved?: () => Promise<void>;
  onStaleClaimTakeoverCriticalSection?: () => Promise<void>;
};
type Finalize = (
  input: { projectRoot: string; campaignClosurePath: string },
  dependencies?: LeafAdapters
) => Promise<GoalFinalizationResult>;

function runJson(modulePath: string, runner: string, args: string[], cwd: string): JsonRecord {
  const completed = spawnSync(process.execPath, [TSX, '-e', runner, modulePath, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 120_000,
  });
  if (completed.status !== 0) throw new Error(String(completed.stderr || completed.stdout));
  return JSON.parse(String(completed.stdout)) as JsonRecord;
}

function git(root: string, args: string[]): void {
  const completed = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (completed.status !== 0) throw new Error(String(completed.stderr || completed.stdout));
}

function createClosedCampaignFixture() {
  const fixture = materializeImplementationReadinessFixture();
  produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
  const outRoot = path.join(fixture.root, 'goal-run');
  runJson(
    GOAL_COMMAND,
    GOAL_RUNNER,
    [
      'generate',
      '--entry',
      'requirements_backed_goal',
      '--requirements-record',
      fixture.runtimeRecordPath,
      '--out',
      outRoot,
      '--json',
    ],
    fixture.root
  );
  const adapterRoot = path.join(outRoot, 'goal/execution-adapter');
  const executableBytes = Buffer.from(
    [
      "const fs=require('node:fs'),path=require('node:path');let input='';",
      "process.stdin.setEncoding('utf8');process.stdin.on('data',chunk=>input+=chunk);",
      "process.stdin.on('end',()=>{const request=JSON.parse(input),owned=request.ownedPaths[0];",
      "fs.writeFileSync(path.join(request.projectRoot,...owned.split('/')),\"module.exports={refundStatus:()=> 'accepted'};\\n\",'utf8');",
      "process.stdout.write(JSON.stringify({schemaVersion:'GoalRunMutationResult/v1',exitCode:0,changedPaths:[owned]}));});",
      '',
    ].join('\n'),
    'utf8'
  );
  const executableHash = `sha256:${createHash('sha256').update(executableBytes).digest('hex')}`;
  const authorityPayload = {
    schemaVersion: 'GoalRunExecutionAdapterAuthority/v1',
    adapterId: 'finalizer-integration-fixture',
    protocol: 'GoalRunMutationProtocol/v1',
    executableRef: { path: 'executor.cjs', hash: executableHash },
    args: [],
    timeoutMs: 30_000,
  };
  mkdirSync(adapterRoot, { recursive: true });
  writeFileSync(path.join(adapterRoot, 'executor.cjs'), executableBytes);
  writeFileSync(
    path.join(adapterRoot, 'authority.json'),
    `${stableControlPlaneStringify({
      ...authorityPayload,
      adapterAuthorityHash: hashControlPlaneValue(authorityPayload),
    })}\n`,
    'utf8'
  );
  const activated = runJson(
    GOAL_COMMAND,
    GOAL_RUNNER,
    [
      'activate',
      '--cwd',
      fixture.root,
      '--goal-authority',
      path.join(outRoot, 'goal/active-authority.json'),
      '--json',
    ],
    fixture.root
  );
  for (const args of [
    ['init'],
    ['config', 'user.name', 'Finalizer Fixture'],
    ['config', 'user.email', 'finalizer-fixture@example.invalid'],
    ['config', 'core.longpaths', 'true'],
    ['add', '--all'],
    ['commit', '-m', 'test: freeze finalizer fixture'],
  ])
    git(fixture.root, args);
  const pointer = activated.artifacts.find(
    (artifact: JsonRecord) => artifact.role === 'active_run_pointer'
  );
  if (!pointer) throw new Error('active run pointer missing');
  const activeRun = path.relative(fixture.root, pointer.artifactRef).replaceAll('\\', '/');
  const execution = runJson(
    RUNTIME,
    RUNTIME_RUNNER,
    ['execute-goal-run', '--cwd', fixture.root, '--active-run', activeRun, '--json'],
    fixture.root
  );
  const campaignClosurePath = String(execution.campaignClosure.artifactRef);
  const campaignPath = path.resolve(fixture.root, ...campaignClosurePath.split('/'));
  const runRoot = path.dirname(path.dirname(path.dirname(campaignPath)));
  const candidateRun = JSON.parse(
    readFileSync(path.join(runRoot, 'candidate-run.json'), 'utf8')
  ) as JsonRecord;
  return {
    root: fixture.root,
    requestId: fixture.requestId,
    runtimeRecordPath: fixture.runtimeRecordPath,
    campaignClosurePath,
    goalExecutionIrPath: path.resolve(
      outRoot,
      ...String(candidateRun.goalExecutionAuthorityRef.path).split('/')
    ),
    projections: execution.projections as Array<{
      role: string;
      artifactRef: string;
      artifactHash: string;
    }>,
    cleanup: fixture.cleanup,
  };
}

function ref(value: unknown): ArtifactRef {
  expect(value).toEqual({
    path: expect.any(String),
    hash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
  });
  return value as ArtifactRef;
}

function readArtifact(root: string, artifact: string | ArtifactRef): JsonRecord {
  const relativePath = typeof artifact === 'string' ? artifact : artifact.path;
  return JSON.parse(readFileSync(path.resolve(root, ...relativePath.split('/')), 'utf8'));
}

function sha256(bytes: Buffer): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function candidateFrom(intent: MainAgentExecutionFinalJudgeActorIntent): ExecutionFinalCandidate {
  expect(intent.preparedBeforeDispatch).toBe(true);
  expect(intent.blindInput.executionFinalCandidate).toMatchObject({
    schemaVersion: 'ExecutionFinalCandidate/v1',
    executionFinalCandidateHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
  });
  return intent.blindInput.executionFinalCandidate as ExecutionFinalCandidate;
}

function actorIsolationReceipt(
  intent: MainAgentExecutionFinalJudgeActorIntent
): MainAgentExecutionActorIsolationReceipt {
  const payload = {
    schemaVersion: 'GoalFinalizationActorIsolationReceipt/v1' as const,
    actorClass: intent.actorClass,
    dispatchGroupId: intent.dispatchGroupId,
    enforcement: 'codex_permission_profile' as const,
    snapshotHash: HASH,
    peerOutputMaterialization: 'none' as const,
    controlPlaneMaterialization: 'memory_only' as const,
    transportPathsExposed: false as const,
    policyHash: computeMainAgentExecutionActorIsolationPolicyHash('codex_permission_profile'),
  };
  return { ...payload, isolationReceiptHash: stableHash(payload) };
}

function resignActorIsolationReceipt(
  receipt: MainAgentExecutionActorIsolationReceipt,
  changes: Partial<MainAgentExecutionActorIsolationReceipt>
): MainAgentExecutionActorIsolationReceipt {
  const { isolationReceiptHash: _previousHash, ...payload } = { ...receipt, ...changes };
  return { ...payload, isolationReceiptHash: stableHash(payload) };
}

function passingFinalJudge(
  intent: MainAgentExecutionFinalJudgeActorIntent,
  candidate: ExecutionFinalCandidate = candidateFrom(intent)
): MainAgentExecutionFinalJudgeResult {
  return {
    sourceLedgerHash: HASH,
    actorIsolationReceipt: actorIsolationReceipt(intent),
    auditDecision: 'pass',
    verdict: 'coverage_satisfied',
    findingIds: [],
    coveredDimensionIds: [...candidate.requiredDimensionIds],
    coveredArtifactIds: [...candidate.requiredArtifactIds],
    coveredObligationIds: [...candidate.requiredObligationIds],
    coveredExecutionResultIds: [...candidate.requiredExecutionResultIds],
    coveredCommandIds: [...candidate.requiredCommandIds],
    coveredEvidenceIds: [...candidate.requiredEvidenceIds],
    coveredDeliveryClaimIds: [...candidate.requiredDeliveryClaimIds],
    findings: [],
  };
}

describe('committed goal-run finalizer composition', () => {
  let fixture: ReturnType<typeof createClosedCampaignFixture>;

  beforeAll(() => {
    fixture = createClosedCampaignFixture();
  }, 120_000);

  afterAll(() => fixture?.cleanup());

  it('returns a blocked envelope for a re-signed non-canonical isolation policy', async () => {
    const finalize = finalizeCommittedGoalRun as unknown as Finalize;
    const isolated = createClosedCampaignFixture();
    try {
      await expect(
        finalize(
          { projectRoot: isolated.root, campaignClosurePath: isolated.campaignClosurePath },
          {
            resolveProviderRef: () => TEST_PROVIDER_REF,
            async invokeReviewer(intent) {
              const base = actorIsolationReceipt(intent);
              const actorIsolationReceipt = resignActorIsolationReceipt(base, {
                policyHash: HASH,
              });
              return {
                sourceLedgerHash: HASH,
                actorIsolationReceipt,
                terminalOutcome: 'clean',
                findingIds: [],
              } as MainAgentExecutionReviewerResult;
            },
            async invokeFinalJudge(intent) {
              return passingFinalJudge(intent);
            },
          }
        )
      ).resolves.toMatchObject({
        status: 'blocked',
        issueCode: 'execution_final_judge_not_produced',
        acceptedResultRef: null,
        aggregateRef: null,
        effectivePassRef: null,
      });
    } finally {
      isolated.cleanup();
    }
  }, 120_000);

  it('publishes a candidate-keyed accepted result and direct EffectivePass, then reuses it without actors', async () => {
    const finalize = finalizeCommittedGoalRun as unknown as Finalize;
    const closure = readArtifact(fixture.root, fixture.campaignClosurePath);
    let reviewerCalls = 0;
    let finalJudgeCalls = 0;
    let reviewerCandidate: ExecutionFinalCandidate | null = null;
    let judgeCandidate: ExecutionFinalCandidate | null = null;
    const dependencies: LeafAdapters = {
      resolveProviderRef: () => TEST_PROVIDER_REF,
      async invokeReviewer(intent) {
        reviewerCalls += 1;
        reviewerCandidate = candidateFrom(intent);
        expect(intent.actorClass).toBe('bounded_code_reviewer');
        return {
          sourceLedgerHash: HASH,
          actorIsolationReceipt: actorIsolationReceipt(intent),
          terminalOutcome: 'clean',
          findingIds: [],
        };
      },
      async invokeFinalJudge(intent) {
        finalJudgeCalls += 1;
        judgeCandidate = candidateFrom(intent);
        expect(intent.actorClass).toBe('final_acceptance_judge');
        const candidate = judgeCandidate;
        return passingFinalJudge(intent, candidate);
      },
    };

    const concurrentResults = await Promise.all([
      finalize(
        { projectRoot: fixture.root, campaignClosurePath: fixture.campaignClosurePath },
        dependencies
      ),
      finalize(
        { projectRoot: fixture.root, campaignClosurePath: fixture.campaignClosurePath },
        dependencies
      ),
    ]);
    expect(concurrentResults.map((result) => result.status).sort()).toEqual([
      'awaiting_user_acceptance',
      'finalization_reused',
    ]);
    const first = concurrentResults.find((result) => result.status === 'awaiting_user_acceptance');
    const concurrentReuse = concurrentResults.find(
      (result) => result.status === 'finalization_reused'
    );
    expect(first).toBeDefined();
    expect(concurrentReuse).toBeDefined();
    if (!first || !concurrentReuse) throw new Error('concurrent finalization result missing');

    expect(first.status).toBe('awaiting_user_acceptance');
    expect([reviewerCalls, finalJudgeCalls]).toEqual([1, 1]);
    const runtimeRecord = JSON.parse(readFileSync(fixture.runtimeRecordPath, 'utf8')) as JsonRecord;
    expect(runtimeRecord.sixModelResults).toMatchObject({
      execution_closure: {
        status: 'pass',
        currentAttemptId: runtimeRecord.currentAttemptId,
      },
      audit_review: {
        status: 'pass',
        currentAttemptId: runtimeRecord.currentAttemptId,
      },
      delivery_confirmation: {
        status: 'awaiting_user_acceptance',
        currentAttemptId: runtimeRecord.currentAttemptId,
      },
    });
    const campaignRef = ref(first.campaignClosureRef);
    const candidateRef = ref(first.candidateRef);
    const aggregateRef = ref(first.aggregateRef);
    const acceptedRef = ref(first.acceptedResultRef);
    const effectivePassRef = ref(first.effectivePassRef);
    const deliveryGateReceiptRef = ref(first.deliveryGateReceiptRef);
    const closeoutRequestRef = ref(first.closeoutRequestRef);
    const pageRef = ref(first.pageRef);
    const candidate = readArtifact(fixture.root, candidateRef) as ExecutionFinalCandidate;
    const authority = readArtifact(fixture.root, closure.orderedClosureRefs[0]);
    const evidence = readArtifact(fixture.root, closure.orderedEvidenceRefs[0]);
    expect(campaignRef).toEqual({
      path: fixture.campaignClosurePath,
      hash: closure.campaignClosureHash,
    });
    expect(reviewerCandidate).toEqual(candidate);
    expect(judgeCandidate).toEqual(candidate);
    expect(candidate).toMatchObject({
      profile: closure.profile,
      goalId: closure.goalId,
      goalExecutionIRHash: closure.goalExecutionIRHash,
      activeRunPointerHash: closure.activeRunPointerHash,
      activationRecordHash: closure.activationRecordHash,
      campaignClosureHash: closure.campaignClosureHash,
      executionPackageHashes: [authority.executionPackageHash],
      requiredCommandIds: evidence.commandObservations
        .map((command: JsonRecord) => command.commandId)
        .sort(),
      executionResults: [
        {
          executionAuthorityId: authority.executionAuthorityId,
          closureHash: authority.closureHash,
        },
      ],
    });
    expect(candidateRef.hash).toBe(candidate.executionFinalCandidateHash);
    const goalExecutionIr = JSON.parse(
      readFileSync(fixture.goalExecutionIrPath, 'utf8')
    ) as JsonRecord;
    expect(candidate.requirementsLineage).toEqual({
      requirementsSemanticIRHash: goalExecutionIr.requirementsLineage.scopeSemanticHash,
      architecturePremiseAuthorityHash:
        goalExecutionIr.technicalAuthority.architectureConfirmationCandidateHash,
      readinessDecisionHash:
        goalExecutionIr.technicalAuthority.implementationReadinessCandidateHash,
    });
    const observedEvidenceBytesHash = sha256(
      readFileSync(path.resolve(fixture.root, ...closure.orderedEvidenceRefs[0].path.split('/')))
    );
    expect(observedEvidenceBytesHash).not.toBe(closure.orderedEvidenceRefs[0].hash);
    expect(candidate.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: closure.orderedEvidenceRefs[0].path,
          hash: observedEvidenceBytesHash,
        }),
      ])
    );
    expect(candidate.artifacts).toEqual(
      expect.arrayContaining(
        evidence.ownedPathStates.map((state: JsonRecord) =>
          expect.objectContaining({ path: state.path, hash: state.hash })
        )
      )
    );
    const taskReportProjection = fixture.projections.find(
      (projection) => projection.role === 'task_report'
    );
    expect(taskReportProjection).toBeDefined();
    if (!taskReportProjection) throw new Error('task report projection missing');
    const taskReportBytes = readFileSync(
      path.resolve(fixture.root, ...taskReportProjection.artifactRef.split('/'))
    );
    expect(taskReportProjection.artifactHash).toBe(sha256(taskReportBytes));
    expect(candidate.artifacts).toContainEqual({
      artifactId: `artifact:${taskReportProjection.artifactRef}`,
      artifactKind: 'task_report',
      path: taskReportProjection.artifactRef,
      hash: taskReportProjection.artifactHash,
    });

    const aggregate = readArtifact(fixture.root, aggregateRef);
    const acceptedBytes = readFileSync(path.resolve(fixture.root, ...acceptedRef.path.split('/')));
    const accepted = JSON.parse(acceptedBytes.toString('utf8')) as JsonRecord;
    expect(aggregate.invocationCountReceipt).toEqual({
      reviewerCalls: 1,
      finalJudgeCalls: 1,
      semanticInvocationCount: 2,
    });
    expect(aggregate).toMatchObject({
      campaignId: `execution-final:${candidate.executionFinalCandidateHash}`,
      campaignLineageKey: hashControlPlaneValue({
        campaignClosureHash: closure.campaignClosureHash,
        executionFinalCandidateHash: candidate.executionFinalCandidateHash,
      }),
      closureReceiptHash: closure.campaignClosureHash,
      candidateBytesHash: sha256(
        Buffer.from(`${stableControlPlaneStringify(candidate)}\n`, 'utf8')
      ),
      executionFinalCandidate: candidate,
      executionFinalCandidateHash: candidate.executionFinalCandidateHash,
      campaignClosureHash: closure.campaignClosureHash,
      actorBindingHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      campaignInputHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
    });
    expect(aggregate).not.toHaveProperty('authorityStateHash');
    expect(aggregate).not.toHaveProperty('ledgerHeadHash');
    expect(aggregateRef.hash).toBe(aggregate.aggregateHash);
    expect(acceptedRef.path).toBe(
      `goal/runtime/execution-final/accepted/sha256-${candidate.executionFinalCandidateHash.slice(
        'sha256:'.length
      )}.json`
    );
    expect(acceptedRef.hash).toBe(sha256(acceptedBytes));
    expect(concurrentReuse.acceptedResultRef).toEqual(acceptedRef);
    expect(concurrentReuse.aggregateRef).toEqual(aggregateRef);
    expect(concurrentReuse.deliveryGateReceiptRef).toEqual(deliveryGateReceiptRef);
    expect(concurrentReuse.closeoutRequestRef).toEqual(closeoutRequestRef);
    expect(concurrentReuse.pageRef).toEqual(pageRef);
    expect(accepted).toEqual({
      schemaVersion: 'ExecutionFinalAcceptedResult/v1',
      executionFinalCandidateHash: candidate.executionFinalCandidateHash,
      candidateRef,
      requestRef: expect.objectContaining({
        hash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      }),
      responseRef: expect.objectContaining({
        hash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      }),
      aggregateRef,
      campaignClosureHash: closure.campaignClosureHash,
      decision: 'pass',
      coverageDisposition: 'coverage_satisfied',
    });
    const effectivePass = readArtifact(fixture.root, effectivePassRef);
    expect(effectivePass).toEqual({
      schemaVersion: 'main-agent-execution-final-judge-effective-pass-receipt/v1',
      effectivePass: true,
      executionFinalCandidateHash: candidate.executionFinalCandidateHash,
      aggregateHash: aggregateRef.hash,
      campaignClosureHash: closure.campaignClosureHash,
      decision: 'pass',
      effectivePassReceiptHash: effectivePassRef.hash,
    });
    const deliveryGateReceipt = readArtifact(fixture.root, deliveryGateReceiptRef);
    expect(deliveryGateReceipt).toMatchObject({
      schemaVersion: 'GoalDeliveryCloseoutGateReceipt/v1',
      status: 'pass',
      executionFinalCandidateHash: candidate.executionFinalCandidateHash,
      taskReportRef: {
        path: taskReportProjection.artifactRef,
        hash: taskReportProjection.artifactHash,
      },
      deliveryCloseoutGateReceiptHash: deliveryGateReceiptRef.hash,
    });
    const closeoutRequest = readArtifact(fixture.root, closeoutRequestRef);
    expect(closeoutRequest).toMatchObject({
      schemaVersion: 'ControlledCloseoutRequest/v1',
      status: 'awaiting_user_acceptance',
      recordId: fixture.requestId,
      executionFinalCandidateHash: candidate.executionFinalCandidateHash,
      deliveryGateReceiptRef,
      pageRef,
      controlledCloseoutRequestHash: closeoutRequestRef.hash,
    });
    expect(closeoutRequest.closeoutAcceptanceRequestHash).not.toBe(closeoutRequestRef.hash);
    expect(runtimeRecord.closeout).toMatchObject({
      currentAttemptId: closeoutRequest.requestId,
      decision: 'pass',
      acceptanceRequest: {
        status: 'awaiting_user_acceptance',
        closeoutAttemptId: closeoutRequest.requestId,
        requestId: closeoutRequest.requestId,
        requestRef: closeoutRequestRef,
        deliveryGateReceiptRef,
        pageRef,
        executionFinalCandidateHash: candidate.executionFinalCandidateHash,
        currentImplementationAttemptId: runtimeRecord.currentAttemptId,
        expectedRecordRevision: runtimeRecord.recordRevision,
      },
    });
    const pageBytes = readFileSync(path.resolve(fixture.root, ...pageRef.path.split('/')));
    expect(pageRef.hash).toBe(sha256(pageBytes));
    expect(pageBytes.toString('utf8')).toContain(String(closeoutRequest.exactAcceptText));
    expect(pageBytes.toString('utf8')).toContain(String(closeoutRequest.exactRejectText));

    const reused = await finalize(
      { projectRoot: fixture.root, campaignClosurePath: fixture.campaignClosurePath },
      {
        resolveProviderRef() {
          throw new Error('provider_must_not_resolve_on_reuse');
        },
        async invokeReviewer() {
          reviewerCalls += 1;
          throw new Error('reviewer_must_not_run_on_reuse');
        },
        async invokeFinalJudge() {
          finalJudgeCalls += 1;
          throw new Error('final_judge_must_not_run_on_reuse');
        },
      }
    );
    expect(reused.status).toBe('finalization_reused');
    expect([reviewerCalls, finalJudgeCalls]).toEqual([1, 1]);
    expect(reused.acceptedResultRef).toEqual(acceptedRef);
    expect(reused.effectivePassRef).toEqual(effectivePassRef);
    expect(reused.deliveryGateReceiptRef).toEqual(deliveryGateReceiptRef);
    expect(reused.closeoutRequestRef).toEqual(closeoutRequestRef);
    expect(reused.pageRef).toEqual(pageRef);
    expect(readFileSync(path.resolve(fixture.root, ...acceptedRef.path.split('/')))).toEqual(
      acceptedBytes
    );

    unlinkSync(path.resolve(fixture.root, ...effectivePassRef.path.split('/')));
    const repaired = await finalize({
      projectRoot: fixture.root,
      campaignClosurePath: fixture.campaignClosurePath,
    });
    expect(repaired.status).toBe('finalization_reused');
    expect([reviewerCalls, finalJudgeCalls]).toEqual([1, 1]);
    expect(repaired.effectivePassRef).toEqual(effectivePassRef);
    expect(existsSync(path.resolve(fixture.root, ...effectivePassRef.path.split('/')))).toBe(true);

    for (const artifact of [deliveryGateReceiptRef, closeoutRequestRef, pageRef]) {
      unlinkSync(path.resolve(fixture.root, ...artifact.path.split('/')));
    }
    const repairedCloseout = await finalize({
      projectRoot: fixture.root,
      campaignClosurePath: fixture.campaignClosurePath,
    });
    expect(repairedCloseout.status).toBe('finalization_reused');
    expect([reviewerCalls, finalJudgeCalls]).toEqual([1, 1]);
    expect(repairedCloseout.deliveryGateReceiptRef).toEqual(deliveryGateReceiptRef);
    expect(repairedCloseout.closeoutRequestRef).toEqual(closeoutRequestRef);
    expect(repairedCloseout.pageRef).toEqual(pageRef);
    for (const artifact of [deliveryGateReceiptRef, closeoutRequestRef, pageRef]) {
      expect(existsSync(path.resolve(fixture.root, ...artifact.path.split('/')))).toBe(true);
    }
  }, 120_000);

  it('fails before publishing candidate or claim when actor adapters are absent', async () => {
    const isolated = createClosedCampaignFixture();
    try {
      const finalize = finalizeCommittedGoalRun as unknown as Finalize;
      await expect(
        finalize({
          projectRoot: isolated.root,
          campaignClosurePath: isolated.campaignClosurePath,
        })
      ).rejects.toThrow('goal_finalization_actor_adapters_required');
      expect(existsSync(path.join(isolated.root, 'goal/runtime/execution-final'))).toBe(false);
    } finally {
      isolated.cleanup();
    }
  }, 120_000);

  it('does not release a replacement owner through a reusable mutex path', async () => {
    const isolated = createClosedCampaignFixture();
    const originalRename = fsDefault.renameSync;
    let interleavingInjected = false;
    fsDefault.renameSync = ((oldPath, newPath) => {
      const source = String(oldPath);
      const target = String(newPath);
      if (
        !interleavingInjected &&
        source.endsWith('.lock.mutex') &&
        target.includes('.lock.mutex.release-')
      ) {
        interleavingInjected = true;
        const displacedOwnerPath = `${source}.displaced-owner`;
        originalRename(source, displacedOwnerPath);
        mkdirSync(source);
        writeFileSync(
          path.join(source, 'owner.json'),
          `${stableControlPlaneStringify({ ownerId: 'replacement-owner' })}\n`,
          'utf8'
        );
        originalRename(source, target);
        mkdirSync(source);
        writeFileSync(
          path.join(source, 'owner.json'),
          `${stableControlPlaneStringify({ ownerId: 'third-owner' })}\n`,
          'utf8'
        );
        return;
      }
      originalRename(oldPath, newPath);
    }) as typeof fsDefault.renameSync;
    syncBuiltinESMExports();
    try {
      const finalize = finalizeCommittedGoalRun as unknown as Finalize;
      const result = await finalize(
        { projectRoot: isolated.root, campaignClosurePath: isolated.campaignClosurePath },
        {
          resolveProviderRef: () => TEST_PROVIDER_REF,
          async invokeReviewer(intent) {
            return {
              sourceLedgerHash: HASH,
              actorIsolationReceipt: actorIsolationReceipt(intent),
              terminalOutcome: 'clean',
              findingIds: [],
            };
          },
          async invokeFinalJudge(intent) {
            return passingFinalJudge(intent);
          },
        }
      );
      expect(result.status).toBe('awaiting_user_acceptance');
      expect(interleavingInjected).toBe(false);
    } finally {
      fsDefault.renameSync = originalRename;
      syncBuiltinESMExports();
      isolated.cleanup();
    }
  }, 120_000);

  it.runIf(process.platform === 'win32')(
    'uses one canonical claim mutex across Win32 extended-path aliases',
    async () => {
      const isolated = createClosedCampaignFixture();
      const aliasRoot = `\\\\?\\${isolated.root}`;
      const originalLink = fsDefault.linkSync;
      const guardPaths = new Set<string>();
      let guardPublications = 0;
      let guardObserved!: () => void;
      const twoGuardPublications = new Promise<void>((resolve) => {
        guardObserved = resolve;
      });
      fsDefault.linkSync = ((existingPath, newPath) => {
        const target = String(newPath);
        if (/[/\\]\.claim-mutex-[0-9a-f]{32}$/u.test(target)) {
          guardPaths.add(path.resolve(target));
          guardPublications += 1;
          if (guardPublications === 2) guardObserved();
        }
        originalLink(existingPath, newPath);
      }) as typeof fsDefault.linkSync;
      syncBuiltinESMExports();
      let releaseActors!: () => void;
      const actorGate = new Promise<void>((resolve) => {
        releaseActors = resolve;
      });
      let actorsStarted!: () => void;
      const started = new Promise<void>((resolve) => {
        actorsStarted = resolve;
      });
      let actorCalls = 0;
      const adapters: LeafAdapters = {
        resolveProviderRef: () => TEST_PROVIDER_REF,
        async invokeReviewer(intent) {
          actorCalls += 1;
          if (actorCalls === 2) actorsStarted();
          await actorGate;
          return {
            sourceLedgerHash: HASH,
            actorIsolationReceipt: actorIsolationReceipt(intent),
            terminalOutcome: 'clean',
            findingIds: [],
          };
        },
        async invokeFinalJudge(intent) {
          actorCalls += 1;
          if (actorCalls === 2) actorsStarted();
          await actorGate;
          return passingFinalJudge(intent);
        },
      };
      const finalize = finalizeCommittedGoalRun as unknown as Finalize;
      let originalRun!: Promise<GoalFinalizationResult>;
      let aliasRun!: Promise<GoalFinalizationResult>;
      try {
        originalRun = finalize(
          { projectRoot: isolated.root, campaignClosurePath: isolated.campaignClosurePath },
          adapters
        );
        await started;
        aliasRun = finalize(
          { projectRoot: aliasRoot, campaignClosurePath: isolated.campaignClosurePath },
          adapters
        );
        await twoGuardPublications;
        expect(guardPaths.size).toBe(1);
        releaseActors();
        const results = await Promise.all([originalRun, aliasRun]);
        expect(results.map((result) => result.status).sort()).toEqual([
          'awaiting_user_acceptance',
          'finalization_reused',
        ]);
        expect(actorCalls).toBe(2);
      } finally {
        releaseActors();
        if (originalRun && aliasRun) await Promise.allSettled([originalRun, aliasRun]);
        fsDefault.linkSync = originalLink;
        syncBuiltinESMExports();
        isolated.cleanup();
      }
    },
    120_000
  );

  it('renews an owned claim while actors run beyond the original lease', async () => {
    const isolated = createClosedCampaignFixture();
    const realNow = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(realNow);
    let releaseActors!: () => void;
    const actorGate = new Promise<void>((resolve) => {
      releaseActors = resolve;
    });
    let actorsStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      actorsStarted = resolve;
    });
    let reviewerCalls = 0;
    let finalJudgeCalls = 0;
    const adapters: LeafAdapters = {
      resolveProviderRef: () => TEST_PROVIDER_REF,
      claimLeaseMs: 60,
      async invokeReviewer(intent) {
        reviewerCalls += 1;
        if (reviewerCalls + finalJudgeCalls === 2) actorsStarted();
        await actorGate;
        return {
          sourceLedgerHash: HASH,
          actorIsolationReceipt: actorIsolationReceipt(intent),
          terminalOutcome: 'clean',
          findingIds: [],
        };
      },
      async invokeFinalJudge(intent) {
        finalJudgeCalls += 1;
        if (reviewerCalls + finalJudgeCalls === 2) actorsStarted();
        await actorGate;
        return passingFinalJudge(intent);
      },
    };
    const finalize = finalizeCommittedGoalRun as unknown as Finalize;
    let first!: Promise<GoalFinalizationResult>;
    let second!: Promise<GoalFinalizationResult>;
    try {
      first = finalize(
        { projectRoot: isolated.root, campaignClosurePath: isolated.campaignClosurePath },
        adapters
      );
      await started;
      vi.setSystemTime(realNow + 300_001);
      await vi.advanceTimersByTimeAsync(20);
      second = finalize(
        { projectRoot: isolated.root, campaignClosurePath: isolated.campaignClosurePath },
        adapters
      );
      await Promise.resolve();
      await Promise.resolve();
      expect([reviewerCalls, finalJudgeCalls]).toEqual([1, 1]);
    } finally {
      releaseActors();
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(20);
      if (first && second) await Promise.allSettled([first, second]);
      vi.useRealTimers();
      isolated.cleanup();
    }
  }, 120_000);

  it('fences stale takeover when the live owner renews before validation', async () => {
    const isolated = createClosedCampaignFixture();
    const realNow = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(realNow);
    let releaseActors!: () => void;
    const actorGate = new Promise<void>((resolve) => {
      releaseActors = resolve;
    });
    let actorsStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      actorsStarted = resolve;
    });
    let staleObserved!: () => void;
    const observed = new Promise<void>((resolve) => {
      staleObserved = resolve;
    });
    let releaseStaleObserver!: () => void;
    const staleObserverGate = new Promise<void>((resolve) => {
      releaseStaleObserver = resolve;
    });
    let takeoverEntered!: () => void;
    const takeoverCriticalSection = new Promise<void>((resolve) => {
      takeoverEntered = resolve;
    });
    let releaseTakeover!: () => void;
    const takeoverGate = new Promise<void>((resolve) => {
      releaseTakeover = resolve;
    });
    let reviewerCalls = 0;
    let finalJudgeCalls = 0;
    let staleObserverCalls = 0;
    const adapters: LeafAdapters = {
      resolveProviderRef: () => TEST_PROVIDER_REF,
      claimLeaseMs: 60,
      async onStaleClaimObserved() {
        staleObserverCalls += 1;
        if (staleObserverCalls === 1) {
          staleObserved();
          await staleObserverGate;
        }
      },
      async onStaleClaimTakeoverCriticalSection() {
        takeoverEntered();
        await takeoverGate;
      },
      async invokeReviewer(intent) {
        reviewerCalls += 1;
        if (reviewerCalls + finalJudgeCalls === 2) actorsStarted();
        await actorGate;
        return {
          sourceLedgerHash: HASH,
          actorIsolationReceipt: actorIsolationReceipt(intent),
          terminalOutcome: 'clean',
          findingIds: [],
        };
      },
      async invokeFinalJudge(intent) {
        finalJudgeCalls += 1;
        if (reviewerCalls + finalJudgeCalls === 2) actorsStarted();
        await actorGate;
        return passingFinalJudge(intent);
      },
    };
    const finalize = finalizeCommittedGoalRun as unknown as Finalize;
    let original!: Promise<GoalFinalizationResult>;
    let recoveryA!: Promise<GoalFinalizationResult>;
    let recoveryB!: Promise<GoalFinalizationResult>;
    try {
      original = finalize(
        { projectRoot: isolated.root, campaignClosurePath: isolated.campaignClosurePath },
        adapters
      );
      await started;
      vi.setSystemTime(realNow + 300_001);
      recoveryA = finalize(
        { projectRoot: isolated.root, campaignClosurePath: isolated.campaignClosurePath },
        adapters
      );
      await observed;
      await vi.advanceTimersByTimeAsync(20);
      releaseStaleObserver();
      await takeoverCriticalSection;
      recoveryB = finalize(
        { projectRoot: isolated.root, campaignClosurePath: isolated.campaignClosurePath },
        adapters
      );
      await vi.advanceTimersByTimeAsync(0);
      expect([reviewerCalls, finalJudgeCalls]).toEqual([1, 1]);
      releaseTakeover();
      releaseActors();
      await vi.advanceTimersByTimeAsync(100);
      const [originalResult, recoveryAResult, recoveryBResult] = await Promise.all([
        original,
        recoveryA,
        recoveryB,
      ]);
      expect(originalResult.status).toBe('awaiting_user_acceptance');
      expect([recoveryAResult.status, recoveryBResult.status]).toEqual([
        'finalization_reused',
        'finalization_reused',
      ]);
      expect([reviewerCalls, finalJudgeCalls]).toEqual([1, 1]);
    } finally {
      releaseStaleObserver();
      releaseTakeover();
      releaseActors();
      await vi.advanceTimersByTimeAsync(100);
      if (original && recoveryA && recoveryB) {
        await Promise.allSettled([original, recoveryA, recoveryB]);
      }
      vi.useRealTimers();
      isolated.cleanup();
    }
  }, 120_000);

  it('recovers an expired candidate claim before invoking one fresh campaign', async () => {
    const isolated = createClosedCampaignFixture();
    try {
      const finalize = finalizeCommittedGoalRun as unknown as Finalize;
      let candidate: ExecutionFinalCandidate | null = null;
      const blocked = await finalize(
        { projectRoot: isolated.root, campaignClosurePath: isolated.campaignClosurePath },
        {
          resolveProviderRef: () => TEST_PROVIDER_REF,
          async invokeReviewer(intent) {
            candidate = candidateFrom(intent);
            throw new Error('simulated_owner_crash');
          },
          async invokeFinalJudge(intent) {
            return passingFinalJudge(intent);
          },
        }
      );
      expect(blocked.status).toBe('blocked');
      expect(candidate).not.toBeNull();
      if (!candidate) throw new Error('candidate missing after interrupted campaign');
      const lockPath = path.join(
        isolated.root,
        'goal/runtime/execution-final/claims',
        `sha256-${candidate.executionFinalCandidateHash.slice('sha256:'.length)}.lock`
      );
      mkdirSync(path.dirname(lockPath), { recursive: true });
      writeFileSync(
        lockPath,
        `${stableControlPlaneStringify({
          schemaVersion: 'main-agent-goal-finalization-claim/v1',
          executionFinalCandidateHash: candidate.executionFinalCandidateHash,
          campaignClosureHash: HASH,
          ownerId: 'expired-owner',
          acquiredAt: 0,
          expiresAt: 0,
        })}\n`,
        'utf8'
      );
      utimesSync(lockPath, new Date(0), new Date(0));
      let reviewerCalls = 0;
      let finalJudgeCalls = 0;
      let staleObservers = 0;
      let releaseObservers!: () => void;
      const observerGate = new Promise<void>((resolve) => {
        releaseObservers = resolve;
      });
      const adapters: LeafAdapters = {
        resolveProviderRef: () => TEST_PROVIDER_REF,
        claimLeaseMs: 60,
        async onStaleClaimObserved() {
          staleObservers += 1;
          if (staleObservers === 2) releaseObservers();
          await observerGate;
        },
        async invokeReviewer(intent) {
          reviewerCalls += 1;
          return {
            sourceLedgerHash: HASH,
            actorIsolationReceipt: actorIsolationReceipt(intent),
            terminalOutcome: 'clean',
            findingIds: [],
          };
        },
        async invokeFinalJudge(intent) {
          finalJudgeCalls += 1;
          return passingFinalJudge(intent);
        },
      };
      const recovered = await Promise.all([
        finalize(
          { projectRoot: isolated.root, campaignClosurePath: isolated.campaignClosurePath },
          adapters
        ),
        finalize(
          { projectRoot: isolated.root, campaignClosurePath: isolated.campaignClosurePath },
          adapters
        ),
      ]);
      expect(recovered.map((result) => result.status).sort()).toEqual([
        'awaiting_user_acceptance',
        'finalization_reused',
      ]);
      expect(staleObservers).toBe(2);
      expect([reviewerCalls, finalJudgeCalls]).toEqual([1, 1]);
      expect(existsSync(lockPath)).toBe(false);
    } finally {
      isolated.cleanup();
    }
  }, 120_000);

  it('rejects re-signed aggregate and response artifacts with inconsistent actor bindings', async () => {
    const finalize = finalizeCommittedGoalRun as unknown as Finalize;
    for (const mutation of [
      'aggregate_binding',
      'response_ledger',
      'aggregate_isolation_policy',
      'aggregate_isolation_hash_set',
    ] as const) {
      const isolated = createClosedCampaignFixture();
      try {
        const finalized = await finalize(
          { projectRoot: isolated.root, campaignClosurePath: isolated.campaignClosurePath },
          {
            resolveProviderRef: () => TEST_PROVIDER_REF,
            async invokeReviewer(intent) {
              return {
                sourceLedgerHash: HASH,
                actorIsolationReceipt: actorIsolationReceipt(intent),
                terminalOutcome: 'clean',
                findingIds: [],
              };
            },
            async invokeFinalJudge(intent) {
              return passingFinalJudge(intent);
            },
          }
        );
        const acceptedRef = ref(finalized.acceptedResultRef);
        const accepted = readArtifact(isolated.root, acceptedRef);
        if (mutation === 'aggregate_binding') {
          const aggregateRef = ref(accepted.aggregateRef);
          const aggregate = readArtifact(isolated.root, aggregateRef);
          const reviewerReceipt = (aggregate.actorReceipts as JsonRecord[]).find(
            (receipt) => receipt.actorClass === 'bounded_code_reviewer'
          );
          if (!reviewerReceipt) throw new Error('reviewer receipt missing');
          reviewerReceipt.blindInputHash = `sha256:${'b'.repeat(64)}`;
          reviewerReceipt.dispatchGroupId = `sha256:${'c'.repeat(64)}`;
          const { actorReceiptHash: _receiptHash, ...receiptPayload } = reviewerReceipt;
          reviewerReceipt.actorReceiptHash = hashControlPlaneValue(receiptPayload);
          aggregate.providerRef = 'tampered-provider';
          aggregate.actorBindingHash = `sha256:${'d'.repeat(64)}`;
          const { aggregateHash: _aggregateHash, ...aggregatePayload } = aggregate;
          aggregate.aggregateHash = hashControlPlaneValue(aggregatePayload);
          writeFileSync(
            path.resolve(isolated.root, ...aggregateRef.path.split('/')),
            `${stableControlPlaneStringify(aggregate)}\n`,
            'utf8'
          );
          accepted.aggregateRef.hash = aggregate.aggregateHash;
        } else if (mutation === 'response_ledger') {
          const responseRef = ref(accepted.responseRef);
          const response = readArtifact(isolated.root, responseRef);
          response.result.sourceLedgerHash = `sha256:${'e'.repeat(64)}`;
          const { responseHash: _responseHash, ...responsePayload } = response;
          response.responseHash = hashControlPlaneValue(responsePayload);
          writeFileSync(
            path.resolve(isolated.root, ...responseRef.path.split('/')),
            `${stableControlPlaneStringify(response)}\n`,
            'utf8'
          );
          accepted.responseRef.hash = response.responseHash;
        } else if (mutation === 'aggregate_isolation_policy') {
          const aggregateRef = ref(accepted.aggregateRef);
          const aggregate = readArtifact(isolated.root, aggregateRef);
          const reviewerReceipt = (aggregate.actorReceipts as JsonRecord[]).find(
            (receipt) => receipt.actorClass === 'bounded_code_reviewer'
          );
          if (!reviewerReceipt || !reviewerReceipt.actorIsolationReceipt) {
            throw new Error('reviewer isolation receipt missing');
          }
          reviewerReceipt.actorIsolationReceipt = resignActorIsolationReceipt(
            reviewerReceipt.actorIsolationReceipt as MainAgentExecutionActorIsolationReceipt,
            { policyHash: HASH }
          );
          reviewerReceipt.actorIsolationReceiptHash =
            reviewerReceipt.actorIsolationReceipt.isolationReceiptHash;
          const { actorReceiptHash: _receiptHash, ...receiptPayload } = reviewerReceipt;
          reviewerReceipt.actorReceiptHash = stableHash(receiptPayload);
          aggregate.blindnessProof.actorIsolationReceiptHashes = (
            aggregate.actorReceipts as JsonRecord[]
          )
            .map((receipt) => receipt.actorIsolationReceiptHash)
            .sort();
          const { aggregateHash: _aggregateHash, ...aggregatePayload } = aggregate;
          aggregate.aggregateHash = stableHash(aggregatePayload);
          writeFileSync(
            path.resolve(isolated.root, ...aggregateRef.path.split('/')),
            `${stableControlPlaneStringify(aggregate)}\n`,
            'utf8'
          );
          accepted.aggregateRef.hash = aggregate.aggregateHash;
        } else {
          const aggregateRef = ref(accepted.aggregateRef);
          const aggregate = readArtifact(isolated.root, aggregateRef);
          aggregate.blindnessProof.actorIsolationReceiptHashes = [HASH, `sha256:${'f'.repeat(64)}`];
          const { aggregateHash: _aggregateHash, ...aggregatePayload } = aggregate;
          aggregate.aggregateHash = stableHash(aggregatePayload);
          writeFileSync(
            path.resolve(isolated.root, ...aggregateRef.path.split('/')),
            `${stableControlPlaneStringify(aggregate)}\n`,
            'utf8'
          );
          accepted.aggregateRef.hash = aggregate.aggregateHash;
        }
        writeFileSync(
          path.resolve(isolated.root, ...acceptedRef.path.split('/')),
          `${stableControlPlaneStringify(accepted)}\n`,
          'utf8'
        );
        await expect(
          finalize({
            projectRoot: isolated.root,
            campaignClosurePath: isolated.campaignClosurePath,
          })
        ).rejects.toThrow('goal_finalization_recovery_binding_invalid');
      } finally {
        isolated.cleanup();
      }
    }
  }, 120_000);
});
