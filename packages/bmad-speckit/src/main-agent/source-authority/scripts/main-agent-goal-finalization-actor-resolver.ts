import * as fs from 'node:fs';
import * as path from 'node:path';

import Ajv2020 from 'ajv/dist/2020.js';

import {
  type ClaudeCodeCliCommandInvocation,
  type ClaudeCodeCliCommandResult,
} from './requirements-contract-claude-code-cli-judge-adapter';
import {
  type CodexCliCommandInvocation,
  type CodexCliCommandResult,
} from './requirements-contract-codex-cli-judge-adapter';
import {
  readGovernanceRemediationConfig,
  type GovernanceRemediationConfig,
} from './governance-remediation-config';
import type { GoalFinalizationDependencies } from './main-agent-goal-run-finalizer';
import type {
  MainAgentExecutionFinalJudgeActorIntent,
  MainAgentExecutionFinalJudgeProducedResult,
  MainAgentExecutionReviewerResult,
} from './main-agent-execution-final-judge-campaign';
import {
  createBoundedStructuredActorTransport,
  type BoundedStructuredActorProviderSelection,
} from './main-agent-bounded-structured-actor-transport';
import { resolveRequirementsContractJudgeCredential } from './requirements-contract-judge-credential-resolver';
import { createRequirementsContractJudgeProviderRegistry } from './requirements-contract-judge-provider-registry';

type JsonRecord = Record<string, unknown>;
type ActorHost = 'codex' | 'claude';

export interface GoalFinalizationActorResolverDependencies {
  readConfig?: (projectRoot: string) => GovernanceRemediationConfig;
  resolveCredential?: (input: {
    projectRoot: string;
    config: string;
    selection: ProviderSelection;
  }) => Promise<unknown>;
  readCredentialSecret?: (credentialHandle: unknown) => string;
  executeCodexCliCommand?: (
    invocation: CodexCliCommandInvocation
  ) => Promise<CodexCliCommandResult>;
  executeClaudeCodeCliCommand?: (
    invocation: ClaudeCodeCliCommandInvocation
  ) => Promise<ClaudeCodeCliCommandResult>;
  env?: NodeJS.ProcessEnv;
}

type ProviderSelection = BoundedStructuredActorProviderSelection;

const FINAL_JUDGE_OUTPUT_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  properties: {
    schemaVersion: { type: 'string', const: 'ExecutionFinalJudgeResult/v1' },
    auditDecision: { type: 'string', enum: ['pass', 'fail'] },
    verdict: {
      type: 'string',
      enum: ['coverage_satisfied', 'findings_present', 'insufficient_evidence', 'blocked'],
    },
    findingIds: { type: 'array', items: { type: 'string', minLength: 1 }, uniqueItems: true },
    coveredDimensionIds: { type: 'array', items: { type: 'string' }, uniqueItems: true },
    coveredArtifactIds: { type: 'array', items: { type: 'string' }, uniqueItems: true },
    coveredObligationIds: { type: 'array', items: { type: 'string' }, uniqueItems: true },
    coveredExecutionResultIds: { type: 'array', items: { type: 'string' }, uniqueItems: true },
    coveredCommandIds: { type: 'array', items: { type: 'string' }, uniqueItems: true },
    coveredEvidenceIds: { type: 'array', items: { type: 'string' }, uniqueItems: true },
    coveredDeliveryClaimIds: { type: 'array', items: { type: 'string' }, uniqueItems: true },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          findingId: { type: 'string', minLength: 1 },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          dimensionId: { type: 'string', minLength: 1 },
          subjectKind: {
            type: 'string',
            enum: [
              'dimension',
              'artifact',
              'obligation',
              'execution_result',
              'command',
              'evidence',
              'delivery_claim',
            ],
          },
          subjectId: { type: 'string', minLength: 1 },
          evidenceRefs: { type: 'array', items: { type: 'string', minLength: 1 } },
          issueCode: { type: 'string', pattern: '^[a-z][a-z0-9_]+$' },
          remediationOwner: {
            type: 'string',
            enum: [
              'requirements_successor',
              'architecture_successor',
              'readiness_recheck',
              'execution_authority',
              'campaign_closure',
              'delivery_claim',
            ],
          },
        },
        required: [
          'findingId',
          'severity',
          'dimensionId',
          'subjectKind',
          'subjectId',
          'evidenceRefs',
          'issueCode',
          'remediationOwner',
        ],
      },
    },
  },
  required: [
    'schemaVersion',
    'auditDecision',
    'verdict',
    'findingIds',
    'coveredDimensionIds',
    'coveredArtifactIds',
    'coveredObligationIds',
    'coveredExecutionResultIds',
    'coveredCommandIds',
    'coveredEvidenceIds',
    'coveredDeliveryClaimIds',
    'findings',
  ],
});

const REVIEWER_OUTPUT_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  properties: {
    schemaVersion: { type: 'string', const: 'BoundedCodeReviewerResult/v1' },
    terminalOutcome: { type: 'string', enum: ['clean', 'findings', 'blocked'] },
    findingIds: { type: 'array', items: { type: 'string', minLength: 1 }, uniqueItems: true },
  },
  required: ['schemaVersion', 'terminalOutcome', 'findingIds'],
});

const validateFinalJudgeOutput = new Ajv2020({ allErrors: true, strict: false }).compile(
  FINAL_JUDGE_OUTPUT_SCHEMA
);
const validateCompleteFinalJudgeOutput = new Ajv2020({ allErrors: true, strict: false }).compile(
  JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        '..',
        'schemas',
        'main-agent-execution-final-judge-result.schema.json'
      ),
      'utf8'
    )
  ) as object
);

function record(value: unknown, code: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as JsonRecord;
}

function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(code);
  return value.trim();
}

function resolveProvider(config: GovernanceRemediationConfig): ProviderSelection {
  const runtime = record(config.judgeRuntime, 'goal_finalization_actor_provider_invalid');
  if (runtime.enabled !== true) throw new Error('goal_finalization_actor_provider_disabled');
  const registry = createRequirementsContractJudgeProviderRegistry({ judgeRuntime: runtime });
  const binding = record(
    registry.providers[registry.activeProviderRef],
    'goal_finalization_actor_provider_invalid'
  );
  const provider = record(binding.provider, 'goal_finalization_actor_provider_invalid');
  if (provider.enabled !== true) throw new Error('goal_finalization_actor_provider_disabled');
  const adapterRef = text(binding.adapterRef, 'goal_finalization_actor_provider_invalid');
  let host: ActorHost;
  if (adapterRef === 'CodexCliJudgeAdapter') host = 'codex';
  else if (adapterRef === 'ClaudeCodeCliJudgeAdapter') host = 'claude';
  else throw new Error('goal_finalization_actor_provider_unsupported');
  return {
    providerRef: registry.activeProviderRef,
    registryHash: registry.registryHash,
    adapterRef,
    host,
    provider,
  };
}

function finalJudgePrompt(): string {
  return [
    'You are the unique Execution Final Judge for one frozen Goal execution candidate.',
    'Perform a read-only semantic judgment using only the exact frozen snapshot allowlist.',
    'Do not inspect peer actor output and do not modify project files.',
    'Explicitly report every covered ID set. Do not infer or auto-fill coverage.',
    'A pass requires exact seven-set coverage, no findings, and verdict coverage_satisfied.',
    'The result schemaVersion must be ExecutionFinalJudgeResult/v1.',
    'Do not provide sourceLedgerHash; the transport derives it from the real invocation.',
    'Return only JSON matching the supplied output schema.',
  ].join('\n');
}

function reviewerPrompt(): string {
  return [
    'You are the bounded code reviewer for one frozen Goal execution candidate.',
    'Perform a read-only implementation and evidence audit using only the exact snapshot allowlist.',
    'Do not inspect peer actor output, parent directories, networks, or modify files.',
    'Return terminalOutcome=clean only when no blocking implementation or evidence finding remains.',
    'The result schemaVersion must be BoundedCodeReviewerResult/v1.',
    'Do not provide sourceLedgerHash; the transport derives it from the real invocation.',
  ].join('\n');
}

function normalizeTransportError(error: unknown, code: string): never {
  if (error instanceof Error && error.message === 'goal_finalization_actor_class_invalid') {
    throw error;
  }
  throw new Error(code);
}

export function createGoalFinalizationActorResolver(
  input: { projectRoot: string },
  dependencies: GoalFinalizationActorResolverDependencies = {}
): GoalFinalizationDependencies {
  const projectRoot = path.resolve(input.projectRoot);
  let cachedSelection: ProviderSelection | null = null;
  const selection = () => {
    cachedSelection ??= resolveProvider(
      (dependencies.readConfig ?? readGovernanceRemediationConfig)(projectRoot)
    );
    return cachedSelection;
  };
  let cachedCredential: Promise<unknown> | null = null;
  const credential = (current: ProviderSelection): Promise<unknown> => {
    const authentication = record(
      current.provider.authentication,
      'goal_finalization_actor_provider_invalid'
    );
    if (authentication.type === 'claude_code_session') return Promise.resolve(undefined);
    cachedCredential ??= dependencies.resolveCredential
      ? dependencies.resolveCredential({
          projectRoot,
          config: '_bmad/_config/governance-remediation.yaml',
          selection: current,
        })
      : resolveRequirementsContractJudgeCredential({
          cwd: projectRoot,
          config: '_bmad/_config/governance-remediation.yaml',
        });
    return cachedCredential;
  };
  const transport = async (
    intent: MainAgentExecutionFinalJudgeActorIntent,
    current: ProviderSelection
  ) =>
    createBoundedStructuredActorTransport(
      {
        projectRoot,
        selection: current,
        credential: await credential(current),
      },
      {
        env: dependencies.env,
        readCredentialSecret: dependencies.readCredentialSecret,
        executeCodexCliCommand: dependencies.executeCodexCliCommand,
        executeClaudeCodeCliCommand: dependencies.executeClaudeCodeCliCommand,
      }
    );
  return {
    resolveProviderRef: () => selection().providerRef,
    async invokeReviewer(intent) {
      if (intent.actorClass !== 'bounded_code_reviewer') {
        throw new Error('goal_finalization_reviewer_actor_class_invalid');
      }
      const current = selection();
      try {
        const result = await (
          await transport(intent, current)
        ).invoke({
          intent,
          expectedActorClass: 'bounded_code_reviewer',
          systemPrompt: reviewerPrompt(),
          structuredOutputSchema: REVIEWER_OUTPUT_SCHEMA,
        });
        const output = result.structuredOutput;
        return {
          sourceLedgerHash: result.sourceLedgerHash,
          actorIsolationReceipt: result.actorIsolationReceipt,
          terminalOutcome: output.terminalOutcome,
          findingIds: output.findingIds,
        } as MainAgentExecutionReviewerResult;
      } catch (error) {
        normalizeTransportError(error, 'goal_finalization_reviewer_response_invalid');
      }
    },
    async invokeFinalJudge(intent) {
      if (intent.actorClass !== 'final_acceptance_judge') {
        throw new Error('goal_finalization_final_judge_actor_class_invalid');
      }
      const current = selection();
      try {
        const result = await (
          await transport(intent, current)
        ).invoke({
          intent,
          expectedActorClass: 'final_acceptance_judge',
          systemPrompt: finalJudgePrompt(),
          structuredOutputSchema: FINAL_JUDGE_OUTPUT_SCHEMA,
        });
        if (!validateFinalJudgeOutput(result.structuredOutput)) {
          throw new Error('goal_finalization_final_judge_response_invalid');
        }
        const completed = {
          sourceLedgerHash: result.sourceLedgerHash,
          actorIsolationReceipt: result.actorIsolationReceipt,
          ...result.structuredOutput,
        };
        if (!validateCompleteFinalJudgeOutput(completed)) {
          throw new Error('goal_finalization_final_judge_response_invalid');
        }
        return completed as MainAgentExecutionFinalJudgeProducedResult;
      } catch (error) {
        normalizeTransportError(error, 'goal_finalization_final_judge_response_invalid');
      }
    },
  };
}
