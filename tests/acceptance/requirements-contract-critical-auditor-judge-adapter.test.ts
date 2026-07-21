import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import * as orchestration from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import { buildCriticalAuditorJudgeRuntimeBinding } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-critical-auditor-independence';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

type JsonRecord = Record<string, unknown>;

type JudgeAdapterCommand = (options: {
  cwd?: string;
  projectRoot: string;
  config: string;
  request: string;
  round: number;
  json?: boolean;
  fetch?: typeof fetch;
}) => Promise<JsonRecord>;

const ACTION_SOURCE = path.resolve(
  process.cwd(),
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-critical-auditor-judge-adapter.ts'
);
const PACKAGE_CLI_SOURCE = path.resolve(process.cwd(), 'packages/bmad-speckit/bin/bmad-speckit.js');

function record(value: unknown, code: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as JsonRecord;
}

function createFixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'critical-auditor-judge-adapter-'));
  const configRelativePath = path.join('_bmad', '_config', 'governance-remediation.yaml');
  const configPath = path.join(root, configRelativePath);
  mkdirSync(path.dirname(configPath), { recursive: true });
  const configText = readFileSync(
    path.join(process.cwd(), '_bmad', '_config', 'governance-remediation.yaml'),
    'utf8'
  );
  writeFileSync(configPath, configText, 'utf8');

  const config = record(yaml.load(configText), 'test_governance_config_invalid');
  const judgeRuntime = record(config.judgeRuntime, 'test_judge_runtime_missing');
  const credentialConfig = record(
    judgeRuntime.credentialConfig,
    'test_judge_credential_config_missing'
  );
  const providerRef = String(judgeRuntime.activeProviderRef);
  const credentialsPath = path.join(root, String(credentialConfig.path));
  mkdirSync(path.dirname(credentialsPath), { recursive: true });
  writeFileSync(
    credentialsPath,
    [
      `schemaVersion: ${String(credentialConfig.schemaVersion)}`,
      'credentialRevision: 1',
      'providers:',
      `  ${providerRef}:`,
      '    authenticationType: bearer',
      `    apiKey: test-placeholder-${randomUUID()}`,
      '',
    ].join('\n'),
    'utf8'
  );

  const runtimeBinding = buildCriticalAuditorJudgeRuntimeBinding(judgeRuntime);
  if (!runtimeBinding.binding || runtimeBinding.issueCodes.length > 0) {
    throw new Error(`test_judge_runtime_binding_invalid:${runtimeBinding.issueCodes.join(',')}`);
  }
  const requestSeed = randomUUID();
  const projectionGroups = [`projection-group/${randomUUID()}`];
  const projectionRefs = [`projection-ref/${randomUUID()}`];
  const qualityRuleCodes = [`quality-rule/${randomUUID()}`];
  const mustRefs = [`must/${randomUUID()}`];
  const request = {
    schemaVersion: 'critical-auditor-round-request/v1',
    roundIndex: 1,
    transactionId: `transaction/${randomUUID()}`,
    namespaceVersion: `namespace/${randomUUID()}`,
    auditAttemptId: `audit-attempt/${randomUUID()}`,
    requestHash: sha256Stable({ requestSeed }),
    sourceHash: sha256Stable({ requestSeed, role: 'source' }),
    sourceDocumentHash: sha256Stable({ requestSeed, role: 'source-document' }),
    semanticModelHash: sha256Stable({ requestSeed, role: 'semantic-model' }),
    implementationConfirmationHash: sha256Stable({
      requestSeed,
      role: 'implementation-confirmation',
    }),
    packetHash: sha256Stable({ requestSeed, role: 'packet' }),
    projectionSetHash: sha256Stable({ requestSeed, projectionRefs }),
    independentProviderBinding: runtimeBinding.binding,
    independentProviderBindingIssueCodes: [],
    mustRefs,
    packetProjectionSummary: {
      projectionGroups,
      projectionRefs,
    },
    projectionQualityGate: {
      requiredRuleCodes: qualityRuleCodes,
    },
    gateDryRun: {
      reportPath: `gate-report/${randomUUID()}.json`,
      gateDryRunHash: sha256Stable({ requestSeed, role: 'gate-dry-run' }),
      reconciliation: {
        issueCount: 0,
      },
      actionableBlockingIssues: [],
    },
    previousReceipts: [],
  };
  const requestRelativePath = path.join('runtime', 'critical-auditor-request.json');
  const requestPath = path.join(root, requestRelativePath);
  mkdirSync(path.dirname(requestPath), { recursive: true });
  writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`, 'utf8');

  return {
    root,
    configRelativePath,
    requestRelativePath,
    request,
    runtimeBinding: runtimeBinding.binding,
  };
}

async function loadCommand(): Promise<JudgeAdapterCommand> {
  const actionModule = (await import(/* @vite-ignore */ pathToFileURL(ACTION_SOURCE).href)) as {
    requirementsContractCriticalAuditorJudgeAdapterCommand?: JudgeAdapterCommand;
  };
  if (typeof actionModule.requirementsContractCriticalAuditorJudgeAdapterCommand !== 'function') {
    throw new Error('critical_auditor_judge_adapter_command_missing');
  }
  return actionModule.requirementsContractCriticalAuditorJudgeAdapterCommand;
}

function semanticAssessmentFromRequest(request: JsonRecord): JsonRecord {
  const projectionSummary = record(
    request.packetProjectionSummary,
    'test_packet_projection_summary_missing'
  );
  const qualityGate = record(request.projectionQualityGate, 'test_projection_quality_gate_missing');
  const gateDryRun = record(request.gateDryRun, 'test_gate_dry_run_missing');
  return {
    schemaVersion: 'critical-auditor-judge-assessment/v1',
    verdict: 'no_new_valid_gap',
    gapCandidates: [],
    validatedGaps: [],
    rejectedGapCandidates: [],
    mutationPressureFindings: [],
    overBroadTaskFindings: [],
    missingProjectionFindings: [],
    invalidProofFindings: [],
    legacyBypassFindings: [],
    sourceMaterializationFindings: [],
    reviewedMustRefs: request.mustRefs,
    reviewedProjectionRefs: projectionSummary.projectionRefs,
    checkedProjectionGroups: projectionSummary.projectionGroups,
    checkedProjectionQualityRuleCodes: qualityGate.requiredRuleCodes,
    priorFindingsDisposition: [
      {
        findingRef: `round/${String(request.roundIndex)}/baseline`,
        disposition: 'new',
        evidenceRefs: [String(gateDryRun.reportPath)],
      },
    ],
    falsePositiveProofs: [],
    rationale: `Judge reviewed request ${String(request.requestHash)}.`,
  };
}

function fakeJudgeFetch(options: { includeAssessment: boolean }): typeof fetch {
  return (async (_input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      model?: string;
      messages?: Array<{ role?: string; content?: string }>;
    };
    const userMessage = body.messages?.find((message) => message.role === 'user');
    const request = record(
      JSON.parse(String(userMessage?.content ?? '{}')),
      'test_judge_request_missing'
    );
    const findings = options.includeAssessment ? [semanticAssessmentFromRequest(request)] : [];
    return new Response(
      JSON.stringify({
        id: `provider-run/${randomUUID()}`,
        model: body.model,
        choices: [
          {
            message: {
              content: JSON.stringify({
                decision: 'pass',
                findings,
                challengeRequests: [],
                evidenceRefs: [String(record(request.gateDryRun, 'test_gate_missing').reportPath)],
              }),
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }
    );
  }) as typeof fetch;
}

describe('requirements contract Critical Auditor Judge adapter', () => {
  it('uses the package-controlled CLI action when no explicit adapter argv is injected', () => {
    const resolveCommand = (
      orchestration as unknown as {
        resolveCriticalAuditorExternalAdapterCommand?: (value: unknown) => string[];
      }
    ).resolveCriticalAuditorExternalAdapterCommand;

    expect(typeof resolveCommand).toBe('function');
    const command = resolveCommand?.(undefined) ?? [];
    expect(command[0]).toBe(process.execPath);
    expect(command[1]?.replace(/\\/gu, '/')).toMatch(
      /packages\/bmad-speckit\/bin\/bmad-speckit\.js$/u
    );
    expect(command[2]).toBe('requirements-contract-critical-auditor-judge-adapter');
    expect(readFileSync(PACKAGE_CLI_SOURCE, 'utf8')).toContain(
      ".command('requirements-contract-critical-auditor-judge-adapter')"
    );
  });

  it('derives identity from the request and semantic claims from the configured Judge response', async () => {
    const fixture = createFixture();
    try {
      const command = await loadCommand();
      const result = await command({
        cwd: fixture.root,
        projectRoot: fixture.root,
        config: fixture.configRelativePath,
        request: fixture.requestRelativePath,
        round: Number(fixture.request.roundIndex),
        json: false,
        fetch: fakeJudgeFetch({ includeAssessment: true }),
      });
      const providerRun = record(result.providerRun, 'test_provider_run_missing');
      const response = record(result.response, 'test_response_missing');
      const assessment = semanticAssessmentFromRequest(fixture.request);
      const { schemaVersion: _assessmentSchemaVersion, ...semanticAssessment } = assessment;

      expect(result.schemaVersion).toBe('critical-auditor-external-adapter-result/v1');
      expect(providerRun).toMatchObject(fixture.runtimeBinding);
      expect(String(providerRun.providerRunId)).not.toBe('');
      expect(response).toMatchObject({
        schemaVersion: 'critical-auditor-round-response/v1',
        roundIndex: fixture.request.roundIndex,
        transactionId: fixture.request.transactionId,
        requestHash: fixture.request.requestHash,
        sourceDocumentHash: fixture.request.sourceDocumentHash,
        semanticModelHash: fixture.request.semanticModelHash,
        projectionSetHash: fixture.request.projectionSetHash,
        ...semanticAssessment,
      });
      expect(JSON.stringify(result)).not.toContain('test-placeholder-');
      expect(response).not.toHaveProperty('independentProviderEvidence');
      const actionSource = readFileSync(ACTION_SOURCE, 'utf8');
      expect(actionSource).not.toContain('E2E-001');
      expect(actionSource).not.toContain('tests/e2e/persist.e2e.test.ts');
      expect(actionSource).not.toContain('Persist value.');
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('fails closed instead of synthesizing semantic audit claims when Judge assessment is absent', async () => {
    const fixture = createFixture();
    try {
      const command = await loadCommand();
      await expect(
        command({
          cwd: fixture.root,
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round: Number(fixture.request.roundIndex),
          json: false,
          fetch: fakeJudgeFetch({ includeAssessment: false }),
        })
      ).rejects.toThrow('critical_auditor_judge_assessment_missing');
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });
});
