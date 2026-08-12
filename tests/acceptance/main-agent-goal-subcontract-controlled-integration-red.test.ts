import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';

import { describe, expect, it } from 'vitest';
import {
  ingestMainAgentControlledCloseout,
  materializeCollectionEvidenceFromManifest,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-governed-goal-integration';
import {
  createJudgeStageStatusReceipt,
  materializeMainAgentControlledCloseoutAcceptanceRequest,
  persistAcceptedControlledTaskReport,
  mainMainAgentOrchestrationAsync,
  resumeJudgeStage,
  runMainAgentConfirmCloseoutAcceptance,
  runMainAgentControlledCloseout,
  runMainAgentControlledCloseoutCli,
  runMainAgentControlledCloseoutFromNativeHost,
  runMainAgentExecutionFinalJudgeCampaign,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import { compileMainAgentExecutionFinalJudgeCampaignInput } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-execution-final-judge-campaign-input';

const HASH = `sha256:${'1'.repeat(64)}`;
const OTHER_HASH = `sha256:${'2'.repeat(64)}`;

function fail(failureClass: string): never {
  throw Object.assign(new Error(failureClass), { failureClass });
}

function sha256(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function stableHash(value: unknown): string {
  const canonicalize = (input: unknown): unknown =>
    Array.isArray(input)
      ? input.map(canonicalize)
      : input && typeof input === 'object'
        ? Object.fromEntries(
            Object.keys(input as Record<string, unknown>)
              .sort()
              .map((key) => [key, canonicalize((input as Record<string, unknown>)[key])])
          )
        : input;
  return `sha256:${createHash('sha256')
    .update(`${JSON.stringify(canonicalize(value), null, 2)}\n`)
    .digest('hex')}`;
}

function compactStableHash(value: unknown): string {
  const stable = (input: unknown): string =>
    Array.isArray(input)
      ? `[${input.map(stable).join(',')}]`
      : input && typeof input === 'object'
        ? `{${Object.keys(input as Record<string, unknown>)
            .sort()
            .map(
              (key) => `${JSON.stringify(key)}:${stable((input as Record<string, unknown>)[key])}`
            )
            .join(',')}}`
        : (JSON.stringify(input) ?? String(input));
  return `sha256:${createHash('sha256').update(stable(value), 'utf8').digest('hex')}`;
}

function materializeInjectedCodexJudgeConfig(projectRoot: string, attemptRoot: string): string {
  const canonicalConfig = yaml.load(
    fs.readFileSync(
      path.join(projectRoot, '_bmad', '_config', 'governance-remediation.yaml'),
      'utf8'
    )
  ) as Record<string, unknown>;
  const judgeRuntime = canonicalConfig.judgeRuntime as Record<string, unknown>;
  const providerRef = String(judgeRuntime.activeProviderRef);
  const providers = judgeRuntime.providers as Record<string, Record<string, unknown>>;
  const provider = providers[providerRef];
  const authentication = provider.authentication as Record<string, unknown>;
  const credentialRef = String(provider.credentialRef);
  const configRoot = path.join(attemptRoot, 'judge-config');
  const privateRoot = path.join(configRoot, 'private');
  const configPath = path.join(configRoot, 'governance-remediation.yaml');
  const credentialPath = path.join(privateRoot, 'judge-provider.credentials.yaml');
  const relativePath = (value: string) => path.relative(projectRoot, value).replace(/\\/gu, '/');

  fs.mkdirSync(privateRoot, { recursive: true });
  judgeRuntime.credentialConfig = {
    ...(judgeRuntime.credentialConfig as Record<string, unknown>),
    path: relativePath(credentialPath),
    allowedRoot: relativePath(privateRoot),
  };
  fs.writeFileSync(
    configPath,
    yaml.dump({ judgeRuntime }, { lineWidth: 120, noRefs: true }),
    'utf8'
  );
  fs.writeFileSync(
    credentialPath,
    yaml.dump(
      {
        schemaVersion: 'requirements-contract-judge-credentials/v1',
        credentialRevision: 1,
        providers: {
          [credentialRef]: {
            authenticationType: String(authentication.type),
            apiKey: 'test-only-injected-codex-transport',
          },
        },
      },
      { lineWidth: 120, noRefs: true }
    ),
    'utf8'
  );
  return relativePath(configPath);
}

function createStandaloneGoalCloseoutFixture() {
  const artifactsRoot = path.join(process.cwd(), '.artifacts');
  fs.mkdirSync(artifactsRoot, { recursive: true });
  const root = fs.mkdtempSync(path.join(artifactsRoot, 'standalone-goal-confirm-'));
  const closeoutAttemptId = 'standalone-goal-attempt-001';
  const candidatePath = path.join(root, 'task-report-candidate.json');
  const finalTaskReportPath = path.join(root, 'task-report.json');
  const completionReceiptPath = path.join(root, 'completion-receipt.json');
  const markerPath = path.join(root, 'main-agent-controlled-closeout.json');
  const requestPath = path.join(root, 'closeout-acceptance-request.json');
  const candidateBytes = Buffer.from('{"status":"done","source":"standalone-goal"}\n', 'utf8');
  const candidateBytesHash = `sha256:${createHash('sha256').update(candidateBytes).digest('hex')}`;
  fs.writeFileSync(candidatePath, candidateBytes);
  fs.writeFileSync(
    markerPath,
    `${JSON.stringify(
      {
        status: 'awaiting_user_acceptance',
        closeoutAttemptId,
        contextHash: HASH,
        candidateBytesHash,
        producerReceipt: {
          status: 'campaign_closed',
          closeoutAttemptId,
          contextHash: HASH,
          compileReceiptHash: HASH,
          childClosureSetHash: HASH,
          campaignReportHash: HASH,
          receiptHash: HASH,
          taskReportCandidatePath: candidatePath,
          taskReportArtifactHash: candidateBytesHash,
        },
        executionFinalJudgeCampaign: {
          closeoutAttemptId,
          candidateBytesHash,
          aggregateHash: HASH,
        },
        effectivePassReceipt: {
          effectivePass: true,
          effectivePassReceiptHash: HASH,
        },
        deliveryGateReceipt: {
          status: 'awaiting_user_acceptance',
          closeoutAttemptId,
          receiptHash: HASH,
        },
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  const request = materializeMainAgentControlledCloseoutAcceptanceRequest({
    projectRoot: process.cwd(),
    markerPath,
    candidatePath,
    outputPath: requestPath,
    finalTaskReportPath,
    completionReceiptPath,
  });
  return {
    root,
    closeoutAttemptId,
    candidateBytes,
    candidateBytesHash,
    finalTaskReportPath,
    completionReceiptPath,
    requestPath,
    request,
  };
}

function legacySourceIdentity(handoff: Record<string, unknown>): string {
  const value =
    handoff.masterImplementationPlanHash ??
    (handoff.goalContractSourceIdentity as Record<string, unknown> | undefined)
      ?.masterImplementationPlanHash;
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
  const effectiveFrozenDirective = /^contractMode:\s*frozen$/mu.test(document);
  const effectiveRewriteDirective = /^rewritePolicy:\s*forbidden$/mu.test(document);
  const fencedDirective = /```(?:yaml|md)?[\s\S]*contractMode:\s*frozen[\s\S]*```/mu.test(document);
  if (!effectiveFrozenDirective || !effectiveRewriteDirective || fencedDirective) {
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

function legacyExecutionStrategy(certification: { status: 'absent' | 'pass' }) {
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
      audit.changedPaths?.some((changedPath) => changedPath.startsWith('forbidden/'))
    ) {
      return { status: 'blocked' as const, dispatched };
    }
  }
  const aggregate = input.aggregateAudit();
  return {
    status: aggregate.status === 'pass' ? ('done' as const) : ('blocked' as const),
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
  it('routes controlled-closeout through the package orchestration runtime', () => {
    const runtimeSource = fs.readFileSync(
      path.resolve('packages/bmad-speckit/src/main-agent/runtime.ts'),
      'utf8'
    );
    const actionSetStart = runtimeSource.indexOf('const ORCHESTRATION_ACTIONS = new Set([');
    const actionSetEnd = runtimeSource.indexOf(']);', actionSetStart);
    expect(actionSetStart).toBeGreaterThanOrEqual(0);
    expect(actionSetEnd).toBeGreaterThan(actionSetStart);
    expect(runtimeSource.slice(actionSetStart, actionSetEnd)).toContain("'controlled-closeout'");
  });

  it('ships a configurable Final Judge prompt that permits exact read-only evidence inspection', () => {
    const prompt = fs.readFileSync(
      path.resolve(
        '_bmad/shared/requirements-contract/judge-prompts/audit-review-final-acceptance-judge.prompt.md'
      ),
      'utf8'
    );

    expect(prompt).toContain('Read-only inspection of the exact snapshot allowlist is required');
    expect(prompt).not.toContain('Do not request tools, execute commands');
    expect(prompt).toContain('`decision`: `pass`, `block`, or `inconclusive`');
    expect(prompt).toContain('`evidenceRefs`');
  });

  it('runs the product closeout caller with configurable prompt and wires Judge to delivery gate', async () => {
    const projectRoot = process.cwd();
    const attemptRoot = fs.mkdtempSync(path.join(projectRoot, '.tmp-main-agent-closeout-'));
    const outputRoot = path.join(attemptRoot, 'main-agent-closeout');
    const contextPath = path.join(attemptRoot, 'closeout-context.json');
    const closureRoot = path.join(attemptRoot, 'attempt');
    const closureReceiptPath = path.join(closureRoot, 'goal-campaign-closure-receipt.json');
    const candidatePath = path.join(closureRoot, 'task-report-candidate.json');
    const campaignReportPath = path.join(closureRoot, 'campaign-report.json');
    const candidateBytes = Buffer.from(
      '{"schemaVersion":"goal-subcontract-campaign-task-report/v3","status":"done"}\n',
      'utf8'
    );
    const candidateBytesHash = `sha256:${createHash('sha256').update(candidateBytes).digest('hex')}`;
    const closureCore = {
      schemaVersion: 'goal-campaign-closure-receipt/v1',
      closeoutAttemptId: 'product-closeout-attempt-001',
      priorAttemptHash: null,
      contextHash: HASH,
      compileReceiptHash: HASH,
      childClosureSetHash: HASH,
      campaignReportPath: 'campaign-report.json',
      campaignReportHash: HASH,
      taskReportCandidatePath: 'task-report-candidate.json',
      taskReportArtifactHash: candidateBytesHash,
      status: 'campaign_closed',
    };
    const contextCore = {
      schemaVersion: 'campaign-closeout-context/v1',
      closeoutAttemptId: 'product-closeout-attempt-001',
      priorAttemptHash: null,
      sourcePlanHash: HASH,
      package: {
        root: attemptRoot,
        packageId: 'standalone-goal-product-campaign',
        manifestPath: 'package-manifest.json',
        manifestSelfHash: HASH,
        manifestArtifactHash: HASH,
      },
      compileReceipt: {
        path: 'compile-receipt.json',
        documentHash: HASH,
        commandId: 'compile',
        packageId: 'standalone-goal-product-campaign',
        manifestHash: HASH,
        validationHead: 'head',
        validationTree: 'tree',
        attemptId: 'product-closeout-attempt-001',
      },
      campaign: {
        activationHash: HASH,
        activePointerPath: 'active-pointer.json',
        activePointerDocumentHash: HASH,
      },
      repairAuthority: {
        attemptId: 'product-closeout-attempt-001',
        receiptPath: 'repair-authority.json',
        receiptHash: HASH,
        artifactHash: HASH,
      },
      childClosures: [],
      childClosureSetHash: HASH,
      finalValidationEvidence: [],
      finalValidationEvidenceSetHash: HASH,
      collectionEvidence: [],
      collectionVerificationSetHash: HASH,
      validationMaterialization: {
        head: 'head',
        tree: 'tree',
        algorithm: 'raw-tracked-v1',
        hash: HASH,
      },
      allowedWritePaths: [attemptRoot],
      allowedWritePathSetHash: HASH,
    };
    const context = { ...contextCore, contextHash: stableHash(contextCore) };
    const boundClosureCore = { ...closureCore, contextHash: context.contextHash };
    const closureReceipt = {
      ...boundClosureCore,
      receiptHash: stableHash(boundClosureCore),
    };
    fs.mkdirSync(closureRoot, { recursive: true });
    fs.writeFileSync(candidatePath, candidateBytes);
    fs.writeFileSync(campaignReportPath, '{}\n');
    fs.writeFileSync(closureReceiptPath, `${JSON.stringify(closureReceipt, null, 2)}\n`);
    fs.writeFileSync(contextPath, `${JSON.stringify(context, null, 2)}\n`);
    const judgeConfigPath = materializeInjectedCodexJudgeConfig(projectRoot, attemptRoot);

    let reviewerCalls = 0;
    let finalJudgeCalls = 0;
    let observedPrompt = '';
    try {
      const executeCodexCliCommand = async (invocation: { outputPath: string; stdin: string }) => {
        finalJudgeCalls += 1;
        observedPrompt = invocation.stdin;
        fs.writeFileSync(
          invocation.outputPath,
          JSON.stringify({
            decision: 'pass',
            findings: [],
            challengeRequests: [],
            evidenceRefs: [],
          })
        );
        return {
          exitCode: 0,
          stdout: `${JSON.stringify({ type: 'thread.started', thread_id: 'product-thread-001' })}\n`,
          stderr: '',
        };
      };
      const input = {
        projectRoot,
        contextPath,
        expectedContextHash: context.contextHash,
        closureReceiptPath,
        outputRoot,
        judgeConfigPath,
        judgePrompt: { systemPrompt: 'Return only the structured final acceptance decision.' },
        invokeReviewer: async () => {
          reviewerCalls += 1;
          return {
            sourceLedgerHash: HASH,
            terminalOutcome: 'clean' as const,
            findingIds: [],
          };
        },
        executeCodexCliCommand,
      };
      const result = await runMainAgentControlledCloseout(input);
      expect(result).toMatchObject({ status: 'awaiting_user_acceptance' });
      expect(reviewerCalls).toBe(1);
      expect(finalJudgeCalls).toBe(1);
      expect(observedPrompt).toContain('Return only the structured final acceptance decision.');
      expect(observedPrompt).toContain('"judgeRole":"final_acceptance_judge"');
      expect(observedPrompt).toContain('"actorClass":"final_acceptance_judge"');
      expect(
        fs.existsSync(path.join(outputRoot, 'execution-final-judge-campaign-input.json'))
      ).toBe(true);
      expect(
        fs.existsSync(path.join(outputRoot, 'execution-final-judge-campaign-aggregate.json'))
      ).toBe(true);
      expect(fs.existsSync(path.join(outputRoot, 'judge-review-campaign-input.json'))).toBe(false);
      expect(result.effectivePassReceipt?.effectivePass).toBe(true);

      const repeated = await runMainAgentControlledCloseout(input);
      expect(repeated.status).toBe('awaiting_user_acceptance');
      expect(reviewerCalls).toBe(1);
      expect(finalJudgeCalls).toBe(1);

      await expect(
        runMainAgentControlledCloseout({
          ...input,
          outputRoot: path.join(attemptRoot, 'stale-context'),
          expectedContextHash: OTHER_HASH,
        })
      ).rejects.toThrow('campaign_closeout_context_mismatch');

      await expect(
        runMainAgentControlledCloseout({
          ...input,
          outputRoot: path.join(attemptRoot, 'missing-prompt'),
          judgePrompt: { systemPrompt: '' },
        })
      ).rejects.toThrow('main_agent_judge_system_prompt_missing');

      let nativeReviewerDispatches = 0;
      const productionTransportResult = await runMainAgentControlledCloseout({
        ...input,
        outputRoot: path.join(attemptRoot, 'production-native-reviewer'),
        invokeReviewer: undefined,
        nativeReviewerHost: 'codex',
        dispatchNativeReviewer: async (request) => {
          nativeReviewerDispatches += 1;
          expect(request).toMatchObject({
            schemaVersion: 'main-agent-native-reviewer-dispatch/v1',
            role: 'bounded_code_reviewer',
            host: 'codex',
            route: { tool: 'codex', subtypeOrExecutor: 'main-session:audit' },
          });
          return {
            sourceLedgerHash: HASH,
            terminalOutcome: 'clean',
            findingIds: [],
          };
        },
      });
      expect(productionTransportResult.status).toBe('awaiting_user_acceptance');
      expect(nativeReviewerDispatches).toBe(1);

      const hostCallerResult = await runMainAgentControlledCloseoutFromNativeHost({
        ...input,
        outputRoot: path.join(attemptRoot, 'formal-native-host-caller'),
        invokeReviewer: undefined,
        nativeReviewerHost: 'claude-code-cli',
        nativeReviewerDispatch: async (request) => {
          expect(request.route).toEqual({ tool: 'Agent', subtypeOrExecutor: 'code-reviewer' });
          return {
            sourceLedgerHash: HASH,
            terminalOutcome: 'clean',
            findingIds: [],
          };
        },
      });
      expect(hostCallerResult.status).toBe('awaiting_user_acceptance');

      let recoveryReviewerCalls = 0;
      let recoveryFinalJudgeCalls = 0;
      const partialOutputRoot = path.join(attemptRoot, 'reviewer-timeout-partial');
      const recoveryInput = {
        ...input,
        outputRoot: partialOutputRoot,
        invokeReviewer: async () => {
          recoveryReviewerCalls += 1;
          if (recoveryReviewerCalls === 1) throw new Error('native_reviewer_host_bridge_timeout');
          return {
            sourceLedgerHash: HASH,
            terminalOutcome: 'clean' as const,
            findingIds: [],
          };
        },
        executeCodexCliCommand: async (invocation: { outputPath: string }) => {
          recoveryFinalJudgeCalls += 1;
          fs.writeFileSync(
            invocation.outputPath,
            JSON.stringify({
              decision: 'pass',
              findings: [],
              challengeRequests: [],
              evidenceRefs: [],
            })
          );
          return {
            exitCode: 0,
            stdout: `${JSON.stringify({ type: 'thread.started', thread_id: 'recovery-thread' })}\n`,
            stderr: '',
          };
        },
      };
      const reviewerUnavailable = await runMainAgentControlledCloseout(recoveryInput);
      expect(reviewerUnavailable).toMatchObject({
        status: 'not_produced',
        reviewerStageStatusReceipt: {
          phase: 'reviewer',
          actorClass: 'bounded_code_reviewer',
          auditDecision: 'not_produced',
          sourceErrorCode: 'PROVIDER_TIMEOUT',
        },
        judgeStageStatusReceipt: null,
      });
      expect(reviewerUnavailable.receiptPaths).toHaveProperty('finalJudgeResult');
      expect(recoveryReviewerCalls).toBe(1);
      expect(recoveryFinalJudgeCalls).toBe(1);

      const resumedReviewer = await runMainAgentControlledCloseout({
        ...recoveryInput,
        outputRoot: path.join(attemptRoot, 'reviewer-timeout-resumed'),
        resumeFrom: String(reviewerUnavailable.reviewerStageStatusReceipt?.receiptHash),
        resumeFromOutputRoot: partialOutputRoot,
      });
      expect(resumedReviewer).toMatchObject({
        status: 'awaiting_user_acceptance',
        finalJudgeReused: true,
      });
      expect(recoveryReviewerCalls).toBe(2);
      expect(recoveryFinalJudgeCalls).toBe(1);

      const missingReviewerTransport = await runMainAgentControlledCloseout({
        ...input,
        outputRoot: path.join(attemptRoot, 'missing-native-reviewer'),
        invokeReviewer: undefined,
        nativeReviewerHost: 'codex',
        dispatchNativeReviewer: undefined,
      });
      expect(missingReviewerTransport).toMatchObject({
        status: 'not_produced',
        reviewerStageStatusReceipt: {
          actorClass: 'bounded_code_reviewer',
          auditDecision: 'not_produced',
          sourceErrorCode: 'NATIVE_REVIEWER_TRANSPORT_NOT_CONFIGURED',
        },
        judgeStageStatusReceipt: null,
      });
      expect(finalJudgeCalls).toBe(3);

      const unavailable = await runMainAgentControlledCloseout({
        ...input,
        outputRoot: path.join(attemptRoot, 'provider-unavailable'),
        judgeConfigPath: '_bmad/_config/missing-judge-provider.yaml',
      });
      expect(unavailable).toMatchObject({
        status: 'not_produced',
        judgeStageStatusReceipt: {
          auditDecision: 'not_produced',
          executionStatus: 'awaiting_provider_configuration',
          sourceErrorCode: 'PROVIDER_NOT_CONFIGURED',
        },
      });
    } finally {
      fs.rmSync(attemptRoot, { recursive: true, force: true });
    }
  });

  it('loads a formal controlled-closeout dispatch and configurable judge prompt from the CLI', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-controlled-closeout-cli-'));
    try {
      const promptPath = path.join(root, 'final-judge.prompt.md');
      const dispatchPath = path.join(root, 'controlled-closeout-dispatch.json');
      fs.writeFileSync(promptPath, 'Configurable final judge prompt.\n', 'utf8');
      fs.writeFileSync(
        dispatchPath,
        `${JSON.stringify({
          schemaVersion: 'main-agent-controlled-closeout-dispatch/v1',
          contextPath: 'context.json',
          expectedContextHash: HASH,
          closureReceiptPath: 'closure.json',
          outputRoot: 'closeout-output',
          judgeConfigPath: '_bmad/_config/governance-remediation.yaml',
          judgePromptPath: path.basename(promptPath),
          nativeReviewerHost: 'codex',
          nativeReviewerTimeoutMs: 1_800_000,
        })}\n`,
        'utf8'
      );
      let observed: Record<string, unknown> | null = null;

      const result = await runMainAgentControlledCloseoutCli(
        root,
        { input: dispatchPath },
        {
          runCloseout: async (input) => {
            observed = input as unknown as Record<string, unknown>;
            return {
              status: 'awaiting_user_acceptance',
              closeoutAttemptId: 'closeout-attempt-001',
              contextHash: HASH,
              candidateBytesHash: HASH,
              producerReceipt: {},
              executionFinalJudgeCampaign: {},
              effectivePassReceipt: {},
              deliveryGateReceipt: {},
              judgeStageStatusReceipt: null,
              receiptPaths: {},
            };
          },
        }
      );

      expect(result.status).toBe('awaiting_user_acceptance');
      expect(observed).toMatchObject({
        projectRoot: root,
        contextPath: 'context.json',
        expectedContextHash: HASH,
        closureReceiptPath: 'closure.json',
        outputRoot: 'closeout-output',
        nativeReviewerHost: 'codex',
        nativeReviewerTimeoutMs: 1_800_000,
        judgePrompt: { systemPrompt: 'Configurable final judge prompt.\n' },
      });
      expect(observed).not.toHaveProperty('deliveryTruthGateReceipt');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not require a global delivery truth receipt before Goal closeout', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-controlled-closeout-goal-'));
    try {
      fs.writeFileSync(path.join(root, 'final-judge.prompt.md'), 'Judge prompt.\n', 'utf8');
      const dispatchPath = path.join(root, 'dispatch.json');
      fs.writeFileSync(
        dispatchPath,
        `${JSON.stringify({
          schemaVersion: 'main-agent-controlled-closeout-dispatch/v1',
          contextPath: 'context.json',
          expectedContextHash: HASH,
          closureReceiptPath: 'closure.json',
          outputRoot: 'closeout-output',
          judgeConfigPath: '_bmad/_config/governance-remediation.yaml',
          judgePromptPath: 'final-judge.prompt.md',
          nativeReviewerHost: 'codex',
        })}\n`,
        'utf8'
      );
      let semanticCalls = 0;

      const result = await runMainAgentControlledCloseoutCli(
        root,
        { input: dispatchPath },
        {
          runCloseout: async () => {
            semanticCalls += 1;
            return {
              status: 'awaiting_user_acceptance',
              closeoutAttemptId: 'closeout-attempt-001',
              contextHash: HASH,
              candidateBytesHash: HASH,
              producerReceipt: {},
              executionFinalJudgeCampaign: {},
              effectivePassReceipt: {},
              deliveryGateReceipt: {},
              judgeStageStatusReceipt: null,
              receiptPaths: {},
            };
          },
        }
      );
      expect(result.status).toBe('awaiting_user_acceptance');
      expect(semanticCalls).toBe(1);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('ingests producer and EffectivePass once without rerunning audit or semantic judges', () => {
    const candidateBytes = Buffer.from(
      '{"schemaVersion":"goal-subcontract-campaign-task-report/v3"}\n',
      'utf8'
    );
    const candidateBytesHash = `sha256:${createHash('sha256').update(candidateBytes).digest('hex')}`;
    let producerAuditCalls = 0;
    let reviewerCalls = 0;
    let finalJudgeCalls = 0;
    const result = ingestMainAgentControlledCloseout({
      closeoutAttemptId: 'closeout-attempt-001',
      contextHash: HASH,
      producerReceipt: {
        schemaVersion: 'goal-campaign-closure-receipt/v1',
        status: 'campaign_closed',
        closeoutAttemptId: 'closeout-attempt-001',
        contextHash: HASH,
        taskReportArtifactHash: candidateBytesHash,
        receiptHash: HASH,
      },
      candidateBytes,
      executionFinalJudgeCampaign: {
        campaignId: 'dynamic-goal-campaign',
        closeoutAttemptId: 'closeout-attempt-001',
        candidateBytesHash,
        decision: 'pass',
        aggregateHash: HASH,
      },
      effectivePassReceipt: {
        schemaVersion: 'main-agent-execution-final-judge-effective-pass-receipt/v1',
        campaignId: 'dynamic-goal-campaign',
        effectivePass: true,
        closeoutAttemptId: 'closeout-attempt-001',
        effectivePassReceiptHash: HASH,
      },
      dependencies: {
        auditCompletedCampaign: () => {
          producerAuditCalls += 1;
          return { status: 'pass' };
        },
        invokeReviewer: () => {
          reviewerCalls += 1;
          return { terminalOutcome: 'clean' };
        },
        invokeFinalJudge: () => {
          finalJudgeCalls += 1;
          return { verdict: 'coverage_satisfied' };
        },
      },
    });

    expect(result).toMatchObject({
      status: 'awaiting_user_acceptance',
      closeoutAttemptId: 'closeout-attempt-001',
      candidateBytesHash,
    });
    expect(producerAuditCalls).toBe(0);
    expect(reviewerCalls).toBe(0);
    expect(finalJudgeCalls).toBe(0);
  });

  it('records unavailable providers as not_produced and resumes only the bound Judge stage', async () => {
    const failureCases = [
      ['PROVIDER_NOT_CONFIGURED', 'awaiting_provider_configuration'],
      ['HTTP_401', 'provider_auth_required'],
      ['HTTP_403', 'provider_auth_required'],
      ['HTTP_429', 'provider_temporarily_unavailable'],
      ['HTTP_503', 'provider_temporarily_unavailable'],
      ['PROVIDER_TIMEOUT', 'provider_temporarily_unavailable'],
      ['EMPTY_RESPONSE', 'provider_execution_error'],
      ['SCHEMA_INVALID', 'provider_execution_error'],
    ] as const;
    for (const [sourceErrorCode, executionStatus] of failureCases) {
      expect(
        createJudgeStageStatusReceipt({
          closeoutAttemptId: 'closeout-attempt-001',
          providerRef: 'gateway-managed-judge',
          logicalAttemptOrdinal: 1,
          maxAttempts: 3,
          sourceErrorCode,
          resumeFrom: null,
        })
      ).toMatchObject({ executionStatus, auditDecision: 'not_produced', sourceErrorCode });
    }

    const paused = createJudgeStageStatusReceipt({
      closeoutAttemptId: 'closeout-attempt-001',
      providerRef: 'gateway-managed-judge',
      actorClass: 'bounded_code_reviewer',
      logicalAttemptOrdinal: 2,
      maxAttempts: 3,
      sourceErrorCode: 'HTTP_503',
      resumeFrom: null,
    });
    expect(paused).toMatchObject({
      schemaVersion: 'main-agent-goal-judge-stage-status-receipt/v1',
      phase: 'reviewer',
      actorClass: 'bounded_code_reviewer',
      executionStatus: 'provider_temporarily_unavailable',
      auditDecision: 'not_produced',
    });

    let judgeCalls = 0;
    const resumed = await resumeJudgeStage('closeout-attempt-001', HASH, {
      loadContext: () => ({ closeoutAttemptId: 'closeout-attempt-001', contextHash: HASH }),
      loadClosureReceipt: () => ({ status: 'campaign_closed', contextHash: HASH }),
      invokeFinalJudge: async () => {
        judgeCalls += 1;
        return { verdict: 'coverage_satisfied' };
      },
    });
    expect(resumed).toMatchObject({ verdict: 'coverage_satisfied' });
    expect(judgeCalls).toBe(1);
    await expect(
      resumeJudgeStage('closeout-attempt-001', OTHER_HASH, {
        loadContext: () => ({ closeoutAttemptId: 'closeout-attempt-001', contextHash: HASH }),
        loadClosureReceipt: () => ({ status: 'campaign_closed', contextHash: HASH }),
        invokeFinalJudge: async () => ({ verdict: 'coverage_satisfied' }),
      })
    ).rejects.toThrow('main_agent_goal_task_report_provenance_mismatch');
  });

  it('turns a campaign-owned unavailable Final Judge into a resumable Main Agent stage receipt', async () => {
    const campaignInput = compileMainAgentExecutionFinalJudgeCampaignInput({
      campaignId: 'standalone-goal-dynamic-campaign',
      campaignLineageKey: stableHash({ kind: 'standalone-lineage' }),
      closureReceiptHash: stableHash({ kind: 'closure' }),
      candidateBytesHash: stableHash({ kind: 'candidate' }),
      currentImplementationHash: stableHash({ kind: 'implementation' }),
      currentEvidenceHash: stableHash({ kind: 'evidence' }),
      initialReviewAttemptKey: stableHash({ kind: 'attempt' }),
      providerRef: 'gateway-managed-judge',
    });
    let reviewerCalls = 0;
    let finalJudgeCalls = 0;

    const result = await runMainAgentExecutionFinalJudgeCampaign(
      {
        campaignInput,
        finalAcceptanceState: {},
        closeoutAttemptId: 'dynamic-closeout-attempt',
        logicalAttemptOrdinal: 1,
        maxAttempts: 3,
        resumeFrom: null,
      },
      {
        invokeReviewer: async () => {
          reviewerCalls += 1;
          return {
            sourceLedgerHash: stableHash({ kind: 'reviewer-ledger' }),
            terminalOutcome: 'clean',
            findingIds: [],
          };
        },
        invokeFinalJudge: async () => {
          finalJudgeCalls += 1;
          return {
            auditDecision: 'not_produced',
            sourceErrorCode: 'HTTP_503',
          };
        },
      }
    );

    expect(reviewerCalls).toBe(1);
    expect(finalJudgeCalls).toBe(1);
    expect(result).toMatchObject({
      status: 'not_produced',
      effectivePassReceipt: null,
      judgeStageStatusReceipt: {
        closeoutAttemptId: 'dynamic-closeout-attempt',
        executionStatus: 'provider_temporarily_unavailable',
        auditDecision: 'not_produced',
        sourceErrorCode: 'HTTP_503',
      },
    });
  });

  it('converts thrown Final Judge provider failures into not_produced stage receipts', async () => {
    const failureCases = [
      [
        Object.assign(new Error('provider is not configured'), { code: 'PROVIDER_NOT_CONFIGURED' }),
        'PROVIDER_NOT_CONFIGURED',
        'awaiting_provider_configuration',
      ],
      [
        Object.assign(new Error('unauthorized'), { statusCode: 401 }),
        'HTTP_401',
        'provider_auth_required',
      ],
      [
        Object.assign(new Error('forbidden'), { status: 403 }),
        'HTTP_403',
        'provider_auth_required',
      ],
      [
        Object.assign(new Error('rate limited'), { statusCode: 429 }),
        'HTTP_429',
        'provider_temporarily_unavailable',
      ],
      [
        Object.assign(new Error('service unavailable'), { statusCode: 503 }),
        'HTTP_503',
        'provider_temporarily_unavailable',
      ],
      [
        Object.assign(new Error('request timed out'), { code: 'ETIMEDOUT' }),
        'PROVIDER_TIMEOUT',
        'provider_temporarily_unavailable',
      ],
      [
        new Error('provider process failed'),
        'PROVIDER_EXECUTION_ERROR',
        'provider_execution_error',
      ],
    ] as const;
    for (const [providerError, sourceErrorCode, executionStatus] of failureCases) {
      const campaignInput = compileMainAgentExecutionFinalJudgeCampaignInput({
        campaignId: `provider-error-${sourceErrorCode}`,
        campaignLineageKey: stableHash({ sourceErrorCode, kind: 'lineage' }),
        closureReceiptHash: stableHash({ sourceErrorCode, kind: 'closure' }),
        candidateBytesHash: stableHash({ sourceErrorCode, kind: 'candidate' }),
        currentImplementationHash: stableHash({ sourceErrorCode, kind: 'implementation' }),
        currentEvidenceHash: stableHash({ sourceErrorCode, kind: 'evidence' }),
        initialReviewAttemptKey: stableHash({ sourceErrorCode, kind: 'attempt' }),
        providerRef: 'gateway-managed-judge',
      });
      const result = await runMainAgentExecutionFinalJudgeCampaign(
        {
          campaignInput,
          finalAcceptanceState: {},
          closeoutAttemptId: `closeout-${sourceErrorCode}`,
          logicalAttemptOrdinal: 1,
          maxAttempts: 3,
          resumeFrom: null,
        },
        {
          invokeReviewer: async () => ({
            sourceLedgerHash: stableHash({ sourceErrorCode, kind: 'reviewer-ledger' }),
            terminalOutcome: 'clean',
            findingIds: [],
          }),
          invokeFinalJudge: async () => {
            throw providerError;
          },
        }
      );

      expect(result).toMatchObject({
        status: 'not_produced',
        effectivePassReceipt: null,
        judgeStageStatusReceipt: {
          auditDecision: 'not_produced',
          sourceErrorCode,
          executionStatus,
        },
      });
    }
  });

  it('materializes exactly 15 T09 bindings in manifest order without rerunning cleanup', () => {
    const fixtureCommandIds = (contract: 'T07' | 'T08' | 'T09', count: number) =>
      Array.from(
        { length: count },
        (_, index) => `CMD-MA-GS-${contract}-${String(index + 1).padStart(2, '0')}`
      );
    const commandIds = [
      ...fixtureCommandIds('T08', 4),
      ...fixtureCommandIds('T07', 2),
      ...fixtureCommandIds('T09', 9),
    ];
    const collectionVerificationCommands = commandIds.map((id, index) => ({
      id,
      command: `fixture-command-${index + 1}`,
    }));
    const packageManifestCore = { collectionVerificationCommands };
    const packageManifest = {
      ...packageManifestCore,
      packageManifestHash: stableHash(packageManifestCore),
    };
    const evidenceByCommandId = Object.fromEntries(
      collectionVerificationCommands.map((command) => [
        command.id,
        {
          immutablePath: `.artifacts/t09/${command.id}.receipt.json`,
          documentByteHash: sha256({ receipt: command.id }),
          schemaVersion: 'ma-gs-command-receipt/v1',
          decision: 'pass',
          sourceAttempt: 't09-current',
          provenance:
            command.id === 'CMD-MA-GS-T09-05'
              ? 'fresh'
              : command.id === 'CMD-MA-GS-T09-09'
                ? 'reused_no_run'
                : 'reused',
        },
      ])
    );
    const result = materializeCollectionEvidenceFromManifest({
      selectedManifestHash: packageManifest.packageManifestHash,
      packageManifest,
      evidenceByCommandId,
    });

    expect(result).toHaveLength(15);
    expect(result.map((binding) => binding.commandId)).toEqual(commandIds);
    expect(result[0].commandDefinitionHash).toBe(stableHash(collectionVerificationCommands[0]));
    expect(result[10].provenance).toBe('fresh');
    expect(result[13].provenance).toBe('reused');
    expect(result[14].provenance).toBe('reused_no_run');
    expect(() =>
      materializeCollectionEvidenceFromManifest({
        selectedManifestHash:
          'sha256:50092f9ee3e699dfbf01594cb4d8f41a6bba5b7ef1e173ab125421bd0a6a0169',
        packageManifest,
        evidenceByCommandId,
      })
    ).toThrow('campaign_closeout_compile_binding_mismatch');
    expect(() =>
      materializeCollectionEvidenceFromManifest({
        selectedManifestHash: packageManifest.packageManifestHash,
        packageManifest,
        evidenceByCommandId: { ...evidenceByCommandId, 'CMD-MA-GS-T09-09': undefined },
      })
    ).toThrow('campaign_closeout_evidence_mismatch');
    expect(() =>
      materializeCollectionEvidenceFromManifest({
        selectedManifestHash: packageManifest.packageManifestHash,
        packageManifest: {
          ...packageManifest,
          collectionVerificationCommands: [
            ...collectionVerificationCommands.slice(1),
            collectionVerificationCommands[0],
          ],
        },
        evidenceByCommandId,
      })
    ).toThrow('campaign_closeout_compile_binding_mismatch');
  });

  it('materializes a manifest-defined collection without contract-specific ids or counts', () => {
    const collectionVerificationCommands = [
      { id: 'VERIFY-ALPHA', command: 'node verify-alpha.js' },
      { id: 'QUALITY-BETA', command: 'node quality-beta.js' },
    ];
    const manifestCore = { collectionVerificationCommands };
    const packageManifest = {
      ...manifestCore,
      packageManifestHash: stableHash(manifestCore),
    };
    const evidenceByCommandId = Object.fromEntries(
      collectionVerificationCommands.map(({ id }) => [
        id,
        {
          immutablePath: `.artifacts/fixture/${id}.json`,
          documentByteHash: sha256({ id }),
          schemaVersion: 'command-evidence/v1',
          decision: 'pass',
          sourceAttempt: 'fixture-attempt',
          provenance: 'fresh',
        },
      ])
    );

    const result = materializeCollectionEvidenceFromManifest({
      selectedManifestHash: packageManifest.packageManifestHash,
      packageManifest,
      evidenceByCommandId,
    });

    expect(result.map(({ commandId }) => commandId)).toEqual(['VERIFY-ALPHA', 'QUALITY-BETA']);
  });

  it('persists accepted TaskReport candidate bytes exactly once for the latest attempt', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'controlled-task-report-'));
    try {
      const candidatePath = path.join(root, 'task-report-candidate.json');
      const finalPath = path.join(root, 'task-report.json');
      const completionReceiptPath = path.join(root, 'completion-receipt.json');
      const candidateBytes = Buffer.from('{"z":1,"a":2}\n', 'utf8');
      fs.writeFileSync(candidatePath, candidateBytes);
      const recordClosedPayload = {
        schemaVersion: 'requirements-contract-record-closed-receipt/v1',
        status: 'user_accepted_closeout',
        eventType: 'record_closed',
        closeoutAttemptId: 'closeout-attempt-002',
      };
      const recordClosedReceipt = {
        ...recordClosedPayload,
        receiptHash: compactStableHash(recordClosedPayload),
      };
      const provenanceHashes = {
        contextHash: HASH,
        compileReceiptHash: HASH,
        childClosureSetHash: HASH,
        campaignReportHash: HASH,
        closureReceiptHash: HASH,
        executionFinalJudgeCampaignHash: HASH,
        effectivePassReceiptHash: HASH,
        deliveryCloseoutGateReceiptHash: HASH,
      };
      const completion = persistAcceptedControlledTaskReport({
        closeoutAttemptId: 'closeout-attempt-002',
        latestCloseoutAttemptId: 'closeout-attempt-002',
        candidatePath,
        candidateBytesHash: `sha256:${createHash('sha256').update(candidateBytes).digest('hex')}`,
        finalTaskReportPath: finalPath,
        completionReceiptPath,
        recordClosedReceipt,
        provenanceHashes,
      });
      expect(fs.readFileSync(finalPath)).toEqual(candidateBytes);
      expect(completion).toMatchObject({
        status: 'done',
        closeoutAttemptId: 'closeout-attempt-002',
      });
      expect(JSON.parse(fs.readFileSync(completionReceiptPath, 'utf8'))).toEqual(completion);
      expect(() =>
        persistAcceptedControlledTaskReport({
          closeoutAttemptId: 'closeout-attempt-001',
          latestCloseoutAttemptId: 'closeout-attempt-002',
          candidatePath,
          candidateBytesHash: `sha256:${createHash('sha256').update(candidateBytes).digest('hex')}`,
          finalTaskReportPath: path.join(root, 'stale-task-report.json'),
          completionReceiptPath: path.join(root, 'stale-completion-receipt.json'),
          recordClosedReceipt: {
            ...recordClosedReceipt,
            closeoutAttemptId: 'closeout-attempt-001',
          },
          provenanceHashes,
        })
      ).toThrow('main_agent_goal_task_report_provenance_mismatch');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('confirms a standalone Goal closeout without a RequirementRecord', () => {
    const artifactsRoot = path.join(process.cwd(), '.artifacts');
    fs.mkdirSync(artifactsRoot, { recursive: true });
    const root = fs.mkdtempSync(path.join(artifactsRoot, 'standalone-goal-confirm-'));
    try {
      const closeoutAttemptId = 'standalone-goal-attempt-001';
      const candidatePath = path.join(root, 'task-report-candidate.json');
      const finalTaskReportPath = path.join(root, 'task-report.json');
      const completionReceiptPath = path.join(root, 'completion-receipt.json');
      const markerPath = path.join(root, 'main-agent-controlled-closeout.json');
      const requestPath = path.join(root, 'closeout-acceptance-request.json');
      const candidateBytes = Buffer.from('{"status":"done","source":"standalone-goal"}\n', 'utf8');
      const candidateBytesHash = `sha256:${createHash('sha256').update(candidateBytes).digest('hex')}`;
      fs.writeFileSync(candidatePath, candidateBytes);
      fs.writeFileSync(
        markerPath,
        `${JSON.stringify(
          {
            status: 'awaiting_user_acceptance',
            closeoutAttemptId,
            contextHash: HASH,
            candidateBytesHash,
            producerReceipt: {
              status: 'campaign_closed',
              closeoutAttemptId,
              contextHash: HASH,
              compileReceiptHash: HASH,
              childClosureSetHash: HASH,
              campaignReportHash: HASH,
              receiptHash: HASH,
              taskReportCandidatePath: candidatePath,
              taskReportArtifactHash: candidateBytesHash,
            },
            executionFinalJudgeCampaign: {
              closeoutAttemptId,
              candidateBytesHash,
              aggregateHash: HASH,
            },
            effectivePassReceipt: {
              effectivePass: true,
              effectivePassReceiptHash: HASH,
            },
            deliveryGateReceipt: {
              status: 'awaiting_user_acceptance',
              closeoutAttemptId,
              receiptHash: HASH,
            },
          },
          null,
          2
        )}\n`,
        'utf8'
      );
      const request = materializeMainAgentControlledCloseoutAcceptanceRequest({
        projectRoot: process.cwd(),
        markerPath,
        candidatePath,
        outputPath: requestPath,
        finalTaskReportPath,
        completionReceiptPath,
      });
      expect(request.rejectionConfirmationText).toContain('拒绝当前 Goal closeout 并保持阻塞');
      const stale = runMainAgentConfirmCloseoutAcceptance(process.cwd(), {
        controlledCloseoutRequest: requestPath,
        confirmationText: request.confirmationText.replace(
          request.acceptanceRequestHash,
          OTHER_HASH
        ),
        confirmedBy: 'test-user',
      });
      expect(stale.ok).toBe(false);
      expect(stale.exitCode).toBe(3);
      expect(fs.existsSync(finalTaskReportPath)).toBe(false);
      expect(fs.existsSync(completionReceiptPath)).toBe(false);

      const result = runMainAgentConfirmCloseoutAcceptance(process.cwd(), {
        controlledCloseoutRequest: requestPath,
        confirmationText: request.confirmationText,
        confirmedBy: 'test-user',
      });

      expect(result.ok).toBe(true);
      expect(result.delegatedEntry).toBe('main-agent-controlled-closeout-confirmation');
      expect((result.stdout as Record<string, unknown>).status).toBe('done');
      expect(fs.readFileSync(finalTaskReportPath)).toEqual(candidateBytes);
      expect(JSON.parse(fs.readFileSync(completionReceiptPath, 'utf8'))).toMatchObject({
        status: 'done',
        closeoutAttemptId,
        taskReportArtifactHash: candidateBytesHash,
      });
      const resumed = runMainAgentConfirmCloseoutAcceptance(process.cwd(), {
        controlledCloseoutRequest: requestPath,
        confirmationText: request.confirmationText,
        confirmedBy: 'test-user',
      });
      expect(resumed.ok).toBe(true);
      expect((resumed.stdout as Record<string, unknown>).status).toBe('done');
      expect(fs.readFileSync(finalTaskReportPath)).toEqual(candidateBytes);
      const requirementsIngest = fs.readFileSync(
        path.join(
          process.cwd(),
          '_bmad',
          'skills',
          'requirements-contract-authoring',
          'scripts',
          'ingest-confirmation-event.js'
        ),
        'utf8'
      );
      expect(requirementsIngest).not.toContain('controlledCloseoutRequest');
      expect(requirementsIngest).not.toContain('executionFinalJudgeCampaignHash');
    } finally {
      fs.rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    }
  });

  it('materializes a user-facing confirmation page for a standalone Goal closeout', () => {
    const fixture = createStandaloneGoalCloseoutFixture();
    try {
      const confirmationPagePath = path.join(
        fixture.root,
        'confirmation',
        'closeout-confirmation-current.html'
      );

      expect(fs.existsSync(confirmationPagePath)).toBe(true);
      const html = fs.readFileSync(confirmationPagePath, 'utf8');
      expect(html).toContain('Goal 交付确认');
      expect(html).toContain(fixture.closeoutAttemptId);
      expect(html).toContain(fixture.request.acceptanceRequestHash);
      expect(html).toContain('确认当前 Goal closeout 并关闭记录');
      expect(html).toContain('拒绝当前 Goal closeout 并保持阻塞');
      expect(html).toContain('复制确认文本');
      expect(html).toContain('复制拒绝文本');
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    }
  });

  it('accepts a standalone Goal closeout through the formal CLI action', async () => {
    const fixture = createStandaloneGoalCloseoutFixture();
    try {
      const exitCode = await mainMainAgentOrchestrationAsync([
        '--cwd',
        process.cwd(),
        '--action',
        'confirm-closeout-acceptance',
        '--controlled-closeout-request',
        fixture.requestPath,
        '--confirmation-text',
        fixture.request.confirmationText,
        '--confirmed-by',
        'test-user',
      ]);

      expect(exitCode).toBe(0);
      expect(fs.readFileSync(fixture.finalTaskReportPath)).toEqual(fixture.candidateBytes);
      expect(JSON.parse(fs.readFileSync(fixture.completionReceiptPath, 'utf8'))).toMatchObject({
        status: 'done',
        closeoutAttemptId: fixture.closeoutAttemptId,
      });
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    }
  });

  it('rejects a standalone Goal closeout without persisting final TaskReport bytes', () => {
    const fixture = createStandaloneGoalCloseoutFixture();
    try {
      const result = runMainAgentConfirmCloseoutAcceptance(process.cwd(), {
        controlledCloseoutRequest: fixture.requestPath,
        confirmationText: fixture.request.rejectionConfirmationText,
        confirmedBy: 'test-user',
      });

      expect(result.ok).toBe(true);
      expect((result.stdout as Record<string, unknown>).status).toBe('blocked');
      expect(fs.existsSync(fixture.finalTaskReportPath)).toBe(false);
      expect(fs.existsSync(fixture.completionReceiptPath)).toBe(false);
      expect(fs.existsSync(path.join(fixture.root, 'user-closeout-rejection-receipt.json'))).toBe(
        true
      );
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    }
  });

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
    expect(result.requirementRecordBinding).not.toHaveProperty('requirementSetId');
    expect(result.requirementRecordBinding).not.toHaveProperty('recordPathHash');
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
        sourceRoots: [{ sourceRootId: 'ROOT-1', specSpanRefs: ['SPAN-1'] }],
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
      legacyStandaloneFreezeDetection(
        [
          '# goal_execution.md',
          '```yaml',
          'contractMode: frozen',
          'rewritePolicy: forbidden',
          '```',
        ].join('\n')
      )
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
    expect(() => legacyNativeGoalIngress({ nativeGoalProvenanceValidated: true })).toThrowError(
      'native_goal_provenance_authority_injection'
    );
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
