import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createGoalFinalizationActorResolver } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-goal-finalization-actor-resolver';
import {
  computeMainAgentExecutionActorIsolationPolicyHash,
  validateMainAgentExecutionActorIsolationReceipt,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-execution-final-judge-campaign';
import { readGovernanceRemediationConfig } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/governance-remediation-config';
import { stableHash } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-verification-evidence-normalizer';

const HASH = `sha256:${'a'.repeat(64)}`;
const intent = {
  actorClass: 'final_acceptance_judge' as const,
  dispatchMode: 'parallel' as const,
  invocationMode: 'native' as const,
  dispatchGroupId: HASH,
  preparedBeforeDispatch: true as const,
  blindInput: { executionFinalCandidateHash: HASH },
  blindInputHash: HASH,
  invocationIntentHash: HASH,
};
const providerResult = {
  schemaVersion: 'ExecutionFinalJudgeResult/v1' as const,
  auditDecision: 'pass' as const,
  verdict: 'coverage_satisfied' as const,
  findingIds: [],
  coveredDimensionIds: ['implementation'],
  coveredArtifactIds: ['artifact:a'],
  coveredObligationIds: ['obligation:a'],
  coveredExecutionResultIds: ['result:a'],
  coveredCommandIds: ['command:a'],
  coveredEvidenceIds: ['evidence:a'],
  coveredDeliveryClaimIds: ['delivery:a'],
  findings: [],
};
const reviewerResult = {
  schemaVersion: 'BoundedCodeReviewerResult/v1' as const,
  terminalOutcome: 'clean' as const,
  findingIds: [],
};

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function codexTranscript(structuredOutput: unknown): string {
  return [
    { type: 'thread.started', thread_id: 'goal-finalization-test-thread' },
    {
      type: 'item.completed',
      item: { type: 'agent_message', text: JSON.stringify(structuredOutput) },
    },
    { type: 'turn.completed' },
  ]
    .map(JSON.stringify)
    .join('\n');
}

function projectFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'bmad-goal-finalization-resolver-'));
  temporaryRoots.push(root);
  mkdirSync(join(root, 'artifacts'), { recursive: true });
  mkdirSync(join(root, 'evidence'), { recursive: true });
  writeFileSync(join(root, 'artifacts', 'result.txt'), 'real implementation bytes\n', 'utf8');
  writeFileSync(join(root, 'evidence', 'observed.json'), '{"passed":true}\n', 'utf8');
  return root;
}

function actorIntent(projectRoot: string, actorClass = intent.actorClass) {
  const blindInput = {
    executionFinalCandidateHash: HASH,
    executionFinalCandidate: {
      artifacts: [
        {
          artifactId: 'artifact:a',
          path: 'artifacts/result.txt',
          hash: sha256(readFileSync(join(projectRoot, 'artifacts', 'result.txt'), 'utf8')),
        },
      ],
      evidence: [
        {
          evidenceId: 'evidence:a',
          path: 'evidence/observed.json',
          hash: sha256(readFileSync(join(projectRoot, 'evidence', 'observed.json'), 'utf8')),
        },
      ],
    },
  };
  return {
    ...intent,
    actorClass,
    blindInput,
    blindInputHash: stableHash(blindInput),
  };
}

function config(projectRoot = process.cwd()) {
  const current = readGovernanceRemediationConfig(process.cwd());
  const judgeRuntime = structuredClone(current.judgeRuntime!);
  judgeRuntime.providers['local-codex-judge'].requestPolicy.timeoutMs = 1234;
  return { ...current, judgeRuntime, projectRoot };
}

function claudeConfig(projectRoot: string) {
  const current = config(projectRoot);
  current.judgeRuntime.activeProviderRef = 'local-claude-judge';
  current.judgeRuntime.providers = {
    'local-claude-judge': {
      ...current.judgeRuntime.providers['local-codex-judge'],
      transport: 'claude-code-cli',
      adapterRef: 'ClaudeCodeCliJudgeAdapter',
      model: 'claude-test-final-judge',
      endpoint: {
        command: 'claude',
        resolutionMode: 'path_search',
        routingOwnership: 'transport_adapter',
        upstreamVersioning: 'cli_managed',
        explicitOperationPath: null,
      },
      authentication: {
        type: 'claude_code_session',
        sensitivity: 'host_managed',
        arbitraryNonEmptyValueAllowed: false,
        sessionRevision: 3,
      },
    },
  } as any;
  return current;
}

function credential() {
  const credentialHandle = {
    schemaVersion: 'requirements-contract-judge-credential-handle/v1',
    providerRef: 'local-codex-judge',
    credentialRef: 'local-sonnet-judge',
    authenticationType: 'bearer',
    credentialRevision: 7,
  };
  return {
    providerRef: 'local-codex-judge',
    credentialRef: 'local-sonnet-judge',
    authenticationType: 'bearer',
    credentialRevision: 7,
    credentialHandle,
  };
}

describe('goal finalization production actor resolver', () => {
  it('rejects missing, misbound, forged, and re-signed non-canonical isolation receipts', () => {
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
    const valid = { ...payload, isolationReceiptHash: stableHash(payload) };
    expect(validateMainAgentExecutionActorIsolationReceipt(intent, valid)).toEqual(valid);
    expect(() => validateMainAgentExecutionActorIsolationReceipt(intent, undefined)).toThrow(
      'main_agent_execution_final_judge_actor_isolation_invalid'
    );
    for (const mutation of [
      { ...valid, dispatchGroupId: `sha256:${'b'.repeat(64)}` },
      { ...valid, isolationReceiptHash: HASH },
      { ...valid, policyHash: HASH },
    ]) {
      const { isolationReceiptHash: _oldHash, ...mutatedPayload } = mutation;
      const resigned =
        mutation.isolationReceiptHash === HASH && mutation.policyHash !== HASH
          ? mutation
          : { ...mutatedPayload, isolationReceiptHash: stableHash(mutatedPayload) };
      expect(() => validateMainAgentExecutionActorIsolationReceipt(intent, resigned)).toThrow(
        'main_agent_execution_final_judge_actor_isolation_invalid'
      );
    }
  });

  it('keeps provider selection lazy so accepted-result reuse needs no current provider', () => {
    let reads = 0;
    const resolver = createGoalFinalizationActorResolver(
      { projectRoot: process.cwd() },
      {
        readConfig() {
          reads += 1;
          throw new Error('provider_unavailable');
        },
      }
    );
    expect(reads).toBe(0);
    expect(() => resolver.resolveProviderRef()).toThrow('provider_unavailable');
    expect(reads).toBe(1);
  });

  it('binds both actors to one registry-selected Codex command and isolated snapshot', async () => {
    const projectRoot = projectFixture();
    const current = config(projectRoot);
    const invocations: Array<Record<string, any>> = [];
    const resolver = createGoalFinalizationActorResolver(
      { projectRoot },
      {
        readConfig: () => current,
        resolveCredential: async () => credential(),
        readCredentialSecret: () => 'test-secret',
        async executeCodexCliCommand(invocation) {
          invocations.push({
            ...invocation,
            snapshotEntries: readdirSync(invocation.cwd).sort(),
            runtimeConfig: readFileSync(join(invocation.env.CODEX_HOME, 'config.toml'), 'utf8'),
            evidenceManifest: readFileSync(join(invocation.cwd, 'evidence-manifest.json'), 'utf8'),
          });
          const result = invocation.stdin.includes('bounded_code_reviewer')
            ? reviewerResult
            : providerResult;
          return {
            exitCode: 0,
            stdout: codexTranscript(result),
            stderr: 'transport-stderr',
          };
        },
      }
    );
    expect(resolver.resolveProviderRef()).toBe('local-codex-judge');
    const reviewed = await resolver.invokeReviewer(
      actorIntent(projectRoot, 'bounded_code_reviewer')
    );
    const judged = await resolver.invokeFinalJudge(actorIntent(projectRoot));
    expect(invocations).toHaveLength(2);
    for (const invocation of invocations) {
      expect(invocation.command).toBe('codex');
      expect(invocation.args).toEqual(expect.arrayContaining(['--strict-config']));
      expect(invocation.args).not.toContain('--model');
      expect(invocation.args).not.toContain('--sandbox');
      expect(relative(projectRoot, invocation.cwd)).toMatch(/^\.\./u);
      expect(invocation.env.CODEX_HOME).toBeTruthy();
      expect(relative(invocation.cwd, invocation.env.CODEX_HOME)).not.toMatch(/^\.\./u);
      expect(invocation.env.BMAD_CODEX_JUDGE_API_KEY).toBe('test-secret');
      expect(invocation.runtimeConfig).toContain('default_permissions = "goal-finalization-actor"');
      expect(invocation.snapshotEntries).toEqual([
        'blind-input.json',
        'codex-home',
        'evidence',
        'evidence-manifest.json',
        'structured-output.schema.json',
      ]);
      const schemaPath = invocation.args[invocation.args.indexOf('--output-schema') + 1];
      expect(relative(invocation.cwd, schemaPath)).not.toMatch(/^\.\./u);
      expect(invocation.stdoutPath).toBeUndefined();
      expect(invocation.stderrPath).toBeUndefined();
      expect(invocation.transcriptPath).toBeUndefined();
      expect(invocation.stdin).not.toContain(projectRoot);
      expect(invocation.stdin).not.toContain(invocation.outputPath);
      expect(invocation.evidenceManifest).not.toContain(projectRoot);
      expect(invocation.evidenceManifest).not.toContain('_bmad-output');
    }
    expect(invocations[0].cwd).not.toBe(invocations[1].cwd);
    expect(reviewed).toMatchObject({
      actorIsolationReceipt: {
        schemaVersion: 'GoalFinalizationActorIsolationReceipt/v1',
        peerOutputMaterialization: 'none',
      },
    });
    expect(judged).toMatchObject(providerResult);
    expect(judged).toMatchObject({
      actorIsolationReceipt: {
        schemaVersion: 'GoalFinalizationActorIsolationReceipt/v1',
        peerOutputMaterialization: 'none',
      },
    });
    expect(judged.sourceLedgerHash).toMatch(/^sha256:[0-9a-f]{64}$/u);
  });

  it('binds Claude session, configured model, transcript, and isolated read-only tools', async () => {
    const projectRoot = projectFixture();
    const current = claudeConfig(projectRoot);
    let credentialReads = 0;
    let captured: Record<string, any> | undefined;
    const resolver = createGoalFinalizationActorResolver(
      { projectRoot },
      {
        readConfig: () => current,
        resolveCredential: async () => {
          credentialReads += 1;
          return credential();
        },
        async executeClaudeCodeCliCommand(invocation) {
          captured = invocation;
          const events = [
            { type: 'system', subtype: 'init', model: 'claude-test-final-judge' },
            {
              type: 'assistant',
              message: {
                model: 'claude-test-final-judge',
                content: [{ type: 'tool_use', name: 'StructuredOutput' }],
              },
            },
            {
              type: 'result',
              subtype: 'success',
              is_error: false,
              session_id: '12345678-1234-4123-8123-123456789abc',
              permission_denials: [],
              modelUsage: { 'claude-test-final-judge': {} },
              structured_output: providerResult,
            },
          ];
          return { exitCode: 0, stdout: events.map(JSON.stringify).join('\n'), stderr: '' };
        },
      }
    );
    const claudeJudged = await resolver.invokeFinalJudge(actorIntent(projectRoot));
    expect(claudeJudged).toMatchObject(providerResult);
    expect(claudeJudged).toMatchObject({
      actorIsolationReceipt: {
        schemaVersion: 'GoalFinalizationActorIsolationReceipt/v1',
        enforcement: 'claude_tool_free_inline_evidence',
        peerOutputMaterialization: 'none',
      },
    });
    expect(credentialReads).toBe(0);
    expect(captured?.command).toBe(
      current.judgeRuntime.providers['local-claude-judge'].endpoint.command
    );
    expect(captured?.args).toEqual(
      expect.arrayContaining([
        '--model',
        'claude-test-final-judge',
        '--tools',
        '',
        '--no-session-persistence',
        '--strict-mcp-config',
      ])
    );
    expect(captured?.stdoutPath).toBeUndefined();
    expect(captured?.stderrPath).toBeUndefined();
    expect(captured?.transcriptPath).toBeUndefined();
    expect(captured?.stdin).toContain('real implementation bytes');
    expect(captured?.stdin).toContain('\\"passed\\":true');
    expect(captured?.stdin).not.toContain(projectRoot);
    expect(relative(projectRoot, captured!.cwd)).toMatch(/^\.\./u);
  });

  it('rejects contradictory configured, init, and StructuredOutput Claude models', async () => {
    const projectRoot = projectFixture();
    const resolver = createGoalFinalizationActorResolver(
      { projectRoot },
      {
        readConfig: () => claudeConfig(projectRoot),
        async executeClaudeCodeCliCommand() {
          const events = [
            { type: 'system', subtype: 'init', model: 'claude-test-final-judge' },
            {
              type: 'assistant',
              message: {
                model: 'claude-other-model',
                content: [{ type: 'tool_use', name: 'StructuredOutput' }],
              },
            },
            {
              type: 'result',
              subtype: 'success',
              is_error: false,
              session_id: '12345678-1234-4123-8123-123456789abc',
              permission_denials: [],
              modelUsage: {
                'claude-test-final-judge': {},
                'claude-other-model': {},
              },
              structured_output: providerResult,
            },
          ];
          return { exitCode: 0, stdout: events.map(JSON.stringify).join('\n'), stderr: '' };
        },
      }
    );
    await expect(resolver.invokeFinalJudge(actorIntent(projectRoot))).rejects.toThrow(
      'goal_finalization_final_judge_response_invalid'
    );
  });

  it('rejects additional Claude assistant or usage models outside the bound model', async () => {
    const projectRoot = projectFixture();
    const resolver = createGoalFinalizationActorResolver(
      { projectRoot },
      {
        readConfig: () => claudeConfig(projectRoot),
        async executeClaudeCodeCliCommand() {
          const events = [
            { type: 'system', subtype: 'init', model: 'claude-test-final-judge' },
            {
              type: 'assistant',
              message: {
                model: 'claude-test-final-judge',
                content: [{ type: 'tool_use', name: 'StructuredOutput' }],
              },
            },
            {
              type: 'assistant',
              message: { model: 'claude-other-model', content: [{ type: 'text', text: 'peer' }] },
            },
            {
              type: 'result',
              subtype: 'success',
              is_error: false,
              session_id: '12345678-1234-4123-8123-123456789abc',
              permission_denials: [],
              modelUsage: {
                'claude-test-final-judge': {},
                'claude-other-model': {},
              },
              structured_output: providerResult,
            },
          ];
          return { exitCode: 0, stdout: events.map(JSON.stringify).join('\n'), stderr: '' };
        },
      }
    );
    await expect(resolver.invokeFinalJudge(actorIntent(projectRoot))).rejects.toThrow(
      'goal_finalization_final_judge_response_invalid'
    );
  });

  it('rejects a blind-input hash that does not match the frozen snapshot bytes', async () => {
    const projectRoot = projectFixture();
    let dispatches = 0;
    const resolver = createGoalFinalizationActorResolver(
      { projectRoot },
      {
        readConfig: () => config(projectRoot),
        resolveCredential: async () => credential(),
        readCredentialSecret: () => 'test-secret',
        async executeCodexCliCommand(_invocation) {
          dispatches += 1;
          return { exitCode: 0, stdout: codexTranscript(providerResult), stderr: '' };
        },
      }
    );
    await expect(
      resolver.invokeFinalJudge({ ...actorIntent(projectRoot), blindInputHash: HASH })
    ).rejects.toThrow('goal_finalization_final_judge_response_invalid');
    expect(dispatches).toBe(0);
  });

  it('rejects actor-class confusion before dispatch', async () => {
    const projectRoot = projectFixture();
    let dispatches = 0;
    const resolver = createGoalFinalizationActorResolver(
      { projectRoot },
      {
        readConfig: () => config(projectRoot),
        resolveCredential: async () => credential(),
        readCredentialSecret: () => 'test-secret',
        async executeCodexCliCommand() {
          dispatches += 1;
          throw new Error('unexpected_dispatch');
        },
      }
    );
    await expect(resolver.invokeReviewer(actorIntent(projectRoot))).rejects.toThrow(
      'goal_finalization_reviewer_actor_class_invalid'
    );
    await expect(
      resolver.invokeFinalJudge(actorIntent(projectRoot, 'bounded_code_reviewer'))
    ).rejects.toThrow('goal_finalization_final_judge_actor_class_invalid');
    expect(dispatches).toBe(0);
  });

  it('rejects provider-forged ledger hashes and isolates retry attempts', async () => {
    const projectRoot = projectFixture();
    const snapshotRoots: string[] = [];
    const resolver = createGoalFinalizationActorResolver(
      { projectRoot },
      {
        readConfig: () => config(projectRoot),
        resolveCredential: async () => credential(),
        readCredentialSecret: () => 'test-secret',
        async executeCodexCliCommand(invocation) {
          snapshotRoots.push(invocation.cwd);
          return {
            exitCode: 0,
            stdout: codexTranscript({ ...providerResult, sourceLedgerHash: HASH }),
            stderr: '',
          };
        },
      }
    );
    await expect(resolver.invokeFinalJudge(actorIntent(projectRoot))).rejects.toThrow(
      'goal_finalization_final_judge_response_invalid'
    );
    await expect(resolver.invokeFinalJudge(actorIntent(projectRoot))).rejects.toThrow(
      'goal_finalization_final_judge_response_invalid'
    );
    expect(snapshotRoots[0]).not.toBe(snapshotRoots[1]);
  });
});
