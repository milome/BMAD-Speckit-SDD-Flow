import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';
import { afterEach, describe, expect, it } from 'vitest';

import { materializeGoalRunExecutionAdapter } from '../helpers/goal-run-execution-adapter-fixture';
import { startOpenAICompatibleJudgeProvider } from './helpers/openai-compatible-judge-provider';
import {
  advanceToUserConfirmable,
  createRequirementsConsumerRoot,
  installJudgeRuntime,
  removeRequirementsConsumerRoot,
  REPOSITORY_ROOT,
  REQUIREMENTS_CLI,
} from './helpers/requirements-contract-production-harness';

type JsonRecord = Record<string, any>;

const temporaryRoots: string[] = [];
const SIX_MODEL_ORDER = [
  'requirement_confirmation',
  'architecture_confirmation',
  'implementation_readiness',
  'execution_closure',
  'audit_review',
  'delivery_confirmation',
];

function createConsumerRoot(): string {
  const root = createRequirementsConsumerRoot();
  temporaryRoots.push(root);
  return root;
}

function writeJson(targetPath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson(targetPath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(targetPath, 'utf8')) as JsonRecord;
}

function projectPath(root: string, projectRelativePath: string): string {
  return path.resolve(root, ...projectRelativePath.replaceAll('\\', '/').split('/'));
}

function addAuthoritySource(
  document: JsonRecord,
  source: {
    path: string;
    rootClass: string;
    proposedAuthorityClass: string;
    bodySchemaVersion: string;
  }
): void {
  const sources = document.authoritySources as JsonRecord[];
  if (!sources.some((entry) => entry.path === source.path)) sources.push(source);
}

function installPartitionedRedWorkload(root: string): void {
  const intakePath = path.join(root, 'requirements.md');
  const intakeBytes = fs.readFileSync(intakePath, 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/u.exec(intakeBytes);
  if (!match) throw new Error('full_chain_intake_frontmatter_missing');
  const intake = yaml.load(match[1]) as JsonRecord;
  const retainedAuthorityPaths = new Set([
    'repo/refund-batch-contract.json',
    'repo/refund-idempotency-requirement.json',
    'architecture/refund-queue-architecture.json',
    'architecture/repository-premise-authority.json',
    'policy/architecture-premise-authority.json',
    'tests/refund-batch-contract-test.json',
  ]);
  intake.authoritySources = (intake.authoritySources as JsonRecord[]).filter((source) =>
    retainedAuthorityPaths.has(source.path)
  );
  addAuthoritySource(intake, {
    path: 'repo/refund-audit-contract.json',
    rootClass: 'idempotency',
    proposedAuthorityClass: 'derived',
    bodySchemaVersion: 'requirements-contract-idempotency-root/v1',
  });
  addAuthoritySource(intake, {
    path: 'repo/refund-audit-requirement.json',
    rootClass: 'functional_requirement',
    proposedAuthorityClass: 'source_grounded',
    bodySchemaVersion: 'requirement-contract-requirement/v2',
  });
  addAuthoritySource(intake, {
    path: 'tests/refund-audit-contract-test.json',
    rootClass: 'acceptance',
    proposedAuthorityClass: 'derived',
    bodySchemaVersion: 'requirements-contract-acceptance-root/v1',
  });
  fs.writeFileSync(
    intakePath,
    [
      '---',
      yaml.dump(intake, { lineWidth: -1 }).trimEnd(),
      '---',
      '',
      '# Partitioned batch refund execution',
      '',
      'The service must execute each accepted refund once and persist one audit entry.',
      '',
    ].join('\n'),
    'utf8'
  );

  writeJson(path.join(root, 'repo', 'refund-audit-contract.json'), {
    schemaVersion: 'requirements-contract-authority-source/v1',
    sourceRootId: 'AUDIT-BATCH-REFUND',
    semanticBody: {
      policy: 'Every accepted refund batch writes exactly one durable audit entry.',
      key: 'batchRequestKey',
      executionConstraints: [
        {
          kind: 'PATH',
          id: 'refund-audit-owner',
          value: 'src/refunds/refund-audit-service.ts',
        },
      ],
    },
  });
  writeJson(path.join(root, 'repo', 'refund-audit-requirement.json'), {
    schemaVersion: 'requirements-contract-authority-source/v1',
    sourceRootId: 'MUST-FR-BATCH-REFUND-AUDIT-EXECUTION',
    semanticBody: {
      text: 'Every accepted refund batch must write exactly one durable audit entry.',
      oracle: 'The audit contract observes one persisted entry for the accepted batch.',
      executionConstraintRefs: [
        'ART:refund-audit-target',
        'CMD:refund-audit-contract',
        'CTM:refund-audit-vertical-slice',
        'EVDREQ:refund-audit-evidence',
        'PATH:refund-audit-owner',
      ],
    },
  });
  writeJson(path.join(root, 'tests', 'refund-audit-contract-test.json'), {
    schemaVersion: 'requirements-contract-authority-source/v1',
    sourceRootId: 'ACC-BATCH-REFUND-AUDIT',
    semanticBody: {
      target: 'MUST-FR-BATCH-REFUND-AUDIT-EXECUTION',
      oracle: 'The audit contract observes one persisted entry for the accepted batch.',
      requiredEvidence: 'Consumer audit contract result for an accepted refund batch.',
      executionConstraints: [
        {
          kind: 'CMD',
          id: 'refund-audit-contract',
          value: 'npm test -- tests/refund-audit-contract.test.cjs',
        },
        {
          kind: 'EVDREQ',
          id: 'refund-audit-evidence',
          value: 'Contract evidence proves one persisted audit entry.',
        },
      ],
    },
    relatedRequirementRefs: ['MUST-FR-BATCH-REFUND-AUDIT-EXECUTION'],
  });

  const structurePath = path.join(root, 'architecture', 'refund-queue-architecture.json');
  const structure = readJson(structurePath);
  const batchArtifact = structure.semanticBody.executionConstraints.find(
    (constraint: JsonRecord) => constraint.kind === 'ART'
  );
  if (!batchArtifact) throw new Error('full_chain_batch_artifact_missing');
  batchArtifact.value = 'src/refunds/batch-refund-service.ts';
  structure.semanticBody.executionConstraints.push({
    kind: 'ART',
    id: 'refund-audit-target',
    value: 'src/refunds/refund-audit-service.ts',
  });
  structure.semanticBody.executionConstraints.push({
    kind: 'CTM',
    id: 'refund-audit-vertical-slice',
    value: 'refund audit vertical slice',
  });
  writeJson(structurePath, structure);
  const batchRequirementPath = path.join(root, 'repo', 'refund-idempotency-requirement.json');
  const batchRequirement = readJson(batchRequirementPath);
  batchRequirement.semanticBody.executionConstraintRefs.push(
    'ART:refund-batch-contract-results',
    'CTM:refund-queue-vertical-slice',
    'STOP:refund-queue-forbidden-scope'
  );
  writeJson(batchRequirementPath, batchRequirement);

  const repositoryPremisePath = path.join(
    root,
    'architecture',
    'repository-premise-authority.json'
  );
  const repositoryPremise = readJson(repositoryPremisePath);
  repositoryPremise.semanticBody.allowedTargetPaths.push('src/refunds/refund-audit-service.ts');
  writeJson(repositoryPremisePath, repositoryPremise);
  const policyPremisePath = path.join(root, 'policy', 'architecture-premise-authority.json');
  const policyPremise = readJson(policyPremisePath);
  policyPremise.semanticBody.ownershipRules.push({
    targetPath: 'src/refunds/refund-audit-service.ts',
    owner: 'refund_audit_owner',
  });
  writeJson(policyPremisePath, policyPremise);

  const batchContractPath = path.join(root, 'tests', 'refund-batch-contract-test.json');
  const batchContract = readJson(batchContractPath);
  const batchCommand = batchContract.semanticBody.executionConstraints.find(
    (constraint: JsonRecord) => constraint.kind === 'CMD'
  );
  if (!batchCommand) throw new Error('full_chain_batch_command_missing');
  batchCommand.value = 'npm test -- tests/refund-batch-contract.test.cjs';
  writeJson(batchContractPath, batchContract);

  writeJson(path.join(root, 'package.json'), {
    name: 'requirements-to-record-closed-fixture',
    version: '1.0.0',
    private: true,
    scripts: { test: 'node --test' },
  });
  fs.mkdirSync(path.join(root, 'src', 'refunds'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'src', 'refunds', 'batch-refund-service.ts'),
    "module.exports = { processBatchRefund: () => 'pending' };\n",
    'utf8'
  );
  fs.writeFileSync(
    path.join(root, 'src', 'refunds', 'refund-audit-service.ts'),
    "module.exports = { persistRefundAudit: () => 'pending' };\n",
    'utf8'
  );
  fs.writeFileSync(
    path.join(root, 'tests', 'refund-batch-contract.test.cjs'),
    [
      "const test = require('node:test');",
      "const assert = require('node:assert/strict');",
      "const service = require('../src/refunds/batch-refund-service.ts');",
      "test('CMD-refund-batch-contract executes each refund once', () => {",
      "  assert.equal(service.processBatchRefund(), 'accepted', 'The contract test submits the same batchRequestKey concurrently and observes one task ID and one execution per refund.');",
      '});',
      '',
    ].join('\n'),
    'utf8'
  );
  fs.writeFileSync(
    path.join(root, 'tests', 'refund-audit-contract.test.cjs'),
    [
      "const test = require('node:test');",
      "const assert = require('node:assert/strict');",
      "const service = require('../src/refunds/refund-audit-service.ts');",
      "test('CMD-refund-audit-contract ACC-BATCH-REFUND-AUDIT one persisted audit entry', () => {",
      "  assert.equal(service.persistRefundAudit(), 'persisted', 'The audit contract observes one persisted entry for the accepted batch.');",
      '});',
      '',
    ].join('\n'),
    'utf8'
  );
}

function installExecutionAdapter(outRoot: string): void {
  materializeGoalRunExecutionAdapter(outRoot, {
    adapterId: 'requirements-full-chain-worker',
    executableSource: [
      "const fs = require('node:fs');",
      "const path = require('node:path');",
      "let input = '';",
      "process.stdin.setEncoding('utf8');",
      "process.stdin.on('data', (chunk) => (input += chunk));",
      "process.stdin.on('end', () => {",
      '  const request = JSON.parse(input);',
      '  const implementations = {',
      "    'src/refunds/batch-refund-service.ts': \"module.exports = { processBatchRefund: () => 'accepted' };\\n\",",
      "    'src/refunds/refund-audit-service.ts': \"module.exports = { persistRefundAudit: () => 'persisted' };\\n\",",
      '  };',
      '  for (const ownedPath of request.ownedPaths) {',
      '    if (!implementations[ownedPath]) throw new Error(`unexpected owned path: ${ownedPath}`);',
      '    fs.writeFileSync(path.join(request.projectRoot, ...ownedPath.split("/")), implementations[ownedPath], "utf8");',
      '  }',
      "  process.stdout.write(JSON.stringify({ schemaVersion: 'GoalRunMutationResult/v1', exitCode: 0, changedPaths: request.ownedPaths }));",
      '});',
      '',
    ].join('\n'),
  });
}

function git(root: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  expect(result.status, result.stderr || result.stdout).toBe(0);
  return result.stdout.trim();
}

function runJson(
  root: string,
  args: string[],
  options: { env?: NodeJS.ProcessEnv } = {}
): Promise<JsonRecord> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [REQUIREMENTS_CLI, ...args], {
      cwd: REPOSITORY_ROOT,
      env: options.env,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.once('error', reject);
    child.once('close', (code) => {
      if (code !== 0) {
        reject(new Error(`CLI exited ${code}: ${stderr || stdout}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout) as JsonRecord);
      } catch (error) {
        reject(new Error(`CLI returned invalid JSON: ${stderr || stdout}`, { cause: error }));
      }
    });
  });
}

function installGoalFinalizationActor(root: string): NodeJS.ProcessEnv {
  const configPath = path.join(root, '_bmad', '_config', 'governance-remediation.yaml');
  const config = yaml.load(fs.readFileSync(configPath, 'utf8')) as JsonRecord;
  config.judgeRuntime.activeProviderRef = 'local-codex-judge';
  config.judgeRuntime.selectionPolicy.cliTransportAllowed = true;
  config.judgeRuntime.providers = {
    'local-codex-judge': {
      enabled: true,
      transport: 'cli',
      adapterRef: 'CodexCliJudgeAdapter',
      apiStyle: 'cli',
      credentialRef: 'local-goal-finalizer',
      endpoint: {
        command: 'codex',
        baseUrl: 'http://127.0.0.1:9',
        resolutionMode: 'path_search',
        routingOwnership: 'transport_adapter',
        upstreamVersioning: 'gateway_managed',
        explicitOperationPath: null,
      },
      authentication: {
        type: 'bearer',
        sensitivity: 'secret',
        arbitraryNonEmptyValueAllowed: false,
      },
      auditPolicy: {
        independenceClass: 'deterministic_protocol',
        blindReview: true,
        allowPassAuthority: false,
        toolsAllowed: true,
        allowedTools: ['Read'],
        implementationWritesAllowed: false,
      },
      requestPolicy: {
        timeoutMs: 30_000,
        maximumAttempts: 1,
        structuredResponseRequired: true,
      },
    },
  };
  fs.writeFileSync(configPath, yaml.dump(config, { lineWidth: -1 }), 'utf8');
  writeJson(
    path.join(root, '_bmad-output', 'config', 'private', 'judge-provider.credentials.yaml'),
    {
      schemaVersion: 'requirements-contract-judge-credentials/v1',
      credentialRevision: 1,
      providers: {
        'local-goal-finalizer': {
          authenticationType: 'bearer',
          apiKey: 'deterministic-goal-finalizer-secret',
        },
      },
    }
  );

  const fakeBin = path.join(root, '.e2e-bin');
  const fakeEntry = path.join(fakeBin, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
  fs.mkdirSync(path.dirname(fakeEntry), { recursive: true });
  fs.writeFileSync(path.join(fakeBin, 'codex.cmd'), '@echo off\r\n', 'utf8');
  fs.writeFileSync(
    fakeEntry,
    [
      "const fs = require('node:fs');",
      "const path = require('node:path');",
      "let input = '';",
      "process.stdin.setEncoding('utf8');",
      "process.stdin.on('data', (chunk) => (input += chunk));",
      "process.stdin.on('end', () => {",
      "  const blind = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'blind-input.json'), 'utf8'));",
      "  const reviewer = input.includes('bounded_code_reviewer');",
      '  const candidate = blind.executionFinalCandidate;',
      '  const output = reviewer',
      "    ? { schemaVersion: 'BoundedCodeReviewerResult/v1', terminalOutcome: 'clean', findingIds: [] }",
      '    : {',
      "        schemaVersion: 'ExecutionFinalJudgeResult/v1',",
      "        auditDecision: 'pass',",
      "        verdict: 'coverage_satisfied',",
      '        findingIds: [],',
      '        coveredDimensionIds: candidate.requiredDimensionIds,',
      '        coveredArtifactIds: candidate.requiredArtifactIds,',
      '        coveredObligationIds: candidate.requiredObligationIds,',
      '        coveredExecutionResultIds: candidate.requiredExecutionResultIds,',
      '        coveredCommandIds: candidate.requiredCommandIds,',
      '        coveredEvidenceIds: candidate.requiredEvidenceIds,',
      '        coveredDeliveryClaimIds: candidate.requiredDeliveryClaimIds,',
      '        findings: [],',
      '      };',
      '  const events = [',
      "    { type: 'thread.started', thread_id: 'requirements-full-chain' },",
      "    { type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify(output) } },",
      "    { type: 'turn.completed' },",
      '  ];',
      "  process.stdout.write(events.map(JSON.stringify).join('\\n'));",
      '});',
      '',
    ].join('\n'),
    'utf8'
  );
  const env = { ...process.env };
  delete env.Path;
  env.PATH = `${fakeBin}${path.delimiter}${process.env.PATH ?? process.env.Path ?? ''}`;
  return env;
}

describe('requirements-backed Goal source-to-closeout production chain', () => {
  afterEach(() => {
    for (const root of temporaryRoots.splice(0)) removeRequirementsConsumerRoot(root);
  });

  it('runs one raw partitioned consumer through record_closed without derived-authority injection', async () => {
    const root = createConsumerRoot();
    installPartitionedRedWorkload(root);
    const provider = await startOpenAICompatibleJudgeProvider();
    installJudgeRuntime(root, provider.baseUrl);
    try {
      const confirmable = await advanceToUserConfirmable(root, provider);
      const requestId = confirmable.data.requestId as string;
      const recordRoot = path.join(
        root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        requestId
      );
      const sourceRecordPath = path.join(recordRoot, 'record', 'requirement-record.json');
      const runtimeRecordPath = path.join(recordRoot, 'requirement-record.json');
      const preArchitectureRecord = readJson(sourceRecordPath);
      const semanticIrPath = path.join(
        recordRoot,
        ...preArchitectureRecord.activeAuthority.activeSemanticIrPath.split('/')
      );
      const semanticIrBytes = fs.readFileSync(semanticIrPath);

      const confirmed = await runJson(root, [
        'main-agent',
        'confirm-scope',
        '--cwd',
        root,
        '--request-id',
        requestId,
        '--exact-confirmation-text',
        confirmable.data.confirmation.exactConfirmationText,
        '--json',
      ]);
      expect(confirmed.status).toBe('user_confirmed');
      const prepared = await runJson(root, [
        'main-agent',
        'prepare-architecture-confirmation',
        '--cwd',
        root,
        '--request-id',
        requestId,
        '--json',
      ]);
      const architecture = prepared.data.result as JsonRecord;
      const ingested = await runJson(root, [
        'main-agent',
        'ingest-architecture-confirmation',
        '--cwd',
        root,
        '--request-id',
        requestId,
        '--architecture-confirmation-candidate-hash',
        architecture.architectureConfirmationCandidateHash,
        '--exact-confirmation-text',
        architecture.exactConfirmationText,
        '--json',
      ]);
      expect(ingested.data.result.status).toMatch(/^architecture_confirmation_/u);
      expect(fs.readFileSync(semanticIrPath)).toEqual(semanticIrBytes);

      const readiness = await runJson(root, [
        'main-agent',
        'implementation-readiness-gate',
        '--cwd',
        root,
        '--request-id',
        requestId,
        '--execute-red-proof',
        '--json',
      ]);
      expect(readiness.data.result).toMatchObject({
        status: 'implementation_readiness_pass',
        commandExecutionCount: 2,
      });

      git(root, ['init']);
      git(root, ['config', 'user.name', 'Requirements Full Chain']);
      git(root, ['config', 'user.email', 'requirements-full-chain@example.invalid']);
      git(root, ['config', 'core.longpaths', 'true']);
      git(root, ['commit', '--allow-empty', '-m', 'test: establish full-chain baseline']);
      const baseline = git(root, ['rev-parse', 'HEAD']);

      const goal = await runJson(root, [
        'main-agent',
        'compile-goal-execution-ir',
        '--cwd',
        root,
        '--entry',
        'requirements_backed_goal',
        '--requirements-record',
        path.relative(root, runtimeRecordPath).replaceAll('\\', '/'),
        '--out',
        'goal-run',
        '--json',
      ]);
      expect(goal.data).toMatchObject({
        profile: 'requirements_backed',
        goalJudgeDispatchCount: 0,
        activeAuthorityRef: { path: expect.any(String), hash: expect.any(String) },
      });
      installExecutionAdapter(path.join(root, 'goal-run'));
      const activation = await runJson(root, [
        'goal-contract',
        'activate',
        '--cwd',
        root,
        '--goal-authority',
        goal.data.activeAuthorityRef.path,
        '--json',
      ]);
      expect(activation).toMatchObject({
        status: 'activated',
        executionMode: 'partitioned_goal',
        partitionOutcome: expect.stringMatching(/^(?:complete_valid|bounded_valid)$/u),
      });
      const activeRunArtifact = activation.artifacts.find(
        (artifact: JsonRecord) => artifact.role === 'active_run_pointer'
      );
      const activeRun = path.relative(root, activeRunArtifact.artifactRef).replaceAll('\\', '/');

      const executed = await runJson(root, [
        'main-agent',
        'execute-goal-run',
        '--cwd',
        root,
        '--active-run',
        activeRun,
        '--json',
      ]);
      expect(executed).toMatchObject({
        status: 'closed',
        issueCode: null,
        attemptPointer: { phase: 'closed' },
        campaignClosure: { artifactRef: expect.any(String), artifactHash: expect.any(String) },
      });
      expect(executed.validClosures).toHaveLength(2);
      for (const closureRef of executed.validClosures) {
        const closure = readJson(projectPath(root, closureRef.artifactRef));
        expect(closure.commitProof).toMatchObject({ kind: 'owned_path_commit', commitCount: 1 });
      }
      expect(git(root, ['rev-list', '--count', `${baseline}..HEAD`])).toBe('2');

      const actorEnv = installGoalFinalizationActor(root);
      const finalized = await runJson(
        root,
        [
          'main-agent',
          'finalize-goal-run',
          '--cwd',
          root,
          '--campaign-closure',
          executed.campaignClosure.artifactRef,
          '--json',
        ],
        { env: actorEnv }
      );
      expect(finalized).toMatchObject({
        status: 'awaiting_user_acceptance',
        candidateRef: { path: expect.any(String), hash: expect.any(String) },
        acceptedResultRef: { path: expect.any(String), hash: expect.any(String) },
        aggregateRef: { path: expect.any(String), hash: expect.any(String) },
        effectivePassRef: { path: expect.any(String), hash: expect.any(String) },
        closeoutRequestRef: { path: expect.any(String), hash: expect.any(String) },
      });
      const taskReportProjection = executed.projections.find(
        (projection: JsonRecord) => projection.role === 'task_report'
      );
      expect(taskReportProjection).toBeDefined();
      expect(finalized.candidateRef.path).not.toBe(taskReportProjection?.artifactRef);
      expect(readJson(projectPath(root, finalized.candidateRef.path))).toMatchObject({
        schemaVersion: 'ExecutionFinalCandidate/v1',
        executionFinalCandidateHash: finalized.candidateRef.hash,
      });
      expect(readJson(projectPath(root, taskReportProjection!.artifactRef)).schemaVersion).not.toBe(
        'ExecutionFinalCandidate/v1'
      );
      const aggregate = readJson(projectPath(root, finalized.aggregateRef.path));
      expect(aggregate.invocationCountReceipt).toEqual({
        reviewerCalls: 1,
        finalJudgeCalls: 1,
        semanticInvocationCount: 2,
      });
      const reused = await runJson(
        root,
        [
          'main-agent',
          'finalize-goal-run',
          '--cwd',
          root,
          '--campaign-closure',
          executed.campaignClosure.artifactRef,
          '--json',
        ],
        { env: actorEnv }
      );
      expect(reused).toMatchObject({
        status: 'finalization_reused',
        acceptedResultRef: finalized.acceptedResultRef,
        aggregateRef: finalized.aggregateRef,
      });

      const closeoutRequest = readJson(projectPath(root, finalized.closeoutRequestRef.path));
      const closed = await runJson(root, [
        'main-agent',
        'controlled-closeout',
        '--cwd',
        root,
        '--request-id',
        requestId,
        '--exact-confirmation-text',
        closeoutRequest.exactAcceptText,
        '--json',
      ]);
      expect(closed.status).toBe('record_closed');
      const record = readJson(runtimeRecordPath);
      expect(record.lastEventType).toBe('record_closed');
      expect(Object.keys(record.sixModelResults)).toEqual(SIX_MODEL_ORDER);
      expect(SIX_MODEL_ORDER.map((model) => record.sixModelResults[model].status)).toEqual(
        SIX_MODEL_ORDER.map(() => 'pass')
      );
      expect(fs.readFileSync(semanticIrPath)).toEqual(semanticIrBytes);
      expect(provider.requests).toHaveLength(1);
    } finally {
      await provider.close();
    }
  }, 360_000);
});
