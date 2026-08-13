import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  buildRequirementsContractSuccessorJudgeRequest,
  compileRequirementsContractRemediationPlan,
  requirementsContractAutomaticRepairSteps,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-remediation-delta-finalizer';
import * as judgeLifecycle from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-lifecycle';
import { runRequirementsContractProductionJudgePipeline } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-judge-pipeline';
import type { PreparedRequirementsContractJudgeInvocation } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-invocation';

const HASH = (digit: string) => `sha256:${digit.repeat(64)}`;

function successorInput() {
  return {
    authority: { activeSemanticRevisionId: 'SEM-2', activeScopeSemanticHash: HASH('1') },
    providerSelection: { providerSelectionHash: HASH('2') },
    prompt: {
      systemPrompt: 'Audit the repaired complete contract.', rubric: {},
      structuredOutputSchema: {}, outputTokenReserve: 4096,
    },
    auditPacket: { body: { requirementIds: ['MUST-001'] } },
    auditPacketArtifactManifest: [],
  };
}

function readJson(filePath: string): Record<string, any> {
  return JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, any>;
}

function treeDigest(root: string): string {
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory).sort()) {
      const absolute = path.join(directory, entry);
      if (statSync(absolute).isDirectory()) visit(absolute);
      else files.push(absolute);
    }
  };
  visit(root);
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(path.relative(root, file).replace(/\\/gu, '/'));
    hash.update(readFileSync(file));
  }
  return `sha256:${hash.digest('hex')}`;
}

describe('requirements contract deterministic Judge repair orchestration', () => {
  it('halts on a Judge finding that does not produce a verified projection delta', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-repair-no-progress-'));
    try {
      mkdirSync(path.join(root, 'docs'), { recursive: true });
      const intakePath = path.join(root, 'intake.md');
      const targetPath = path.join(root, 'requirements.md');
      writeFileSync(intakePath, [
        '---',
        'authoritySources:',
        '  - path: docs/functional.json',
        '    rootClass: functional_requirement',
        '    proposedAuthorityClass: source_authority',
        '    bodySchemaVersion: requirement-contract-requirement/v2',
        '---',
        '# Requirements',
        '',
      ].join('\n'), 'utf8');
      writeFileSync(path.join(root, 'docs', 'functional.json'), JSON.stringify({
        schemaVersion: 'requirements-contract-authority-source/v1',
        sourceRootId: 'MUST-FR-REPAIR-001',
        semanticBody: {
          text: 'System MUST preserve the approved refund request during deterministic compilation.',
          oracle: 'The production acceptance test proves the approved refund request is preserved.',
          executionConstraints: [
            { kind: 'CMD', id: 'repair-test', value: 'npm test -- repair.test.ts' },
            { kind: 'PATH', id: 'repair-owner', value: 'src/refund-repair.ts' },
          ],
          executionConstraintRefs: ['CMD:repair-test', 'PATH:repair-owner'],
        },
      }), 'utf8');
      const runAction = (action: string, args: string[]) => spawnSync(process.execPath, [
        path.resolve('packages/bmad-speckit/bin/bmad-speckit.js'),
        'main-agent', action, '--cwd', root, ...args, '--json',
      ], { cwd: process.cwd(), encoding: 'utf8', windowsHide: true });
      const author = runAction('author-confirmation-ready-source', [
        '--intake-source', intakePath,
        '--target-source', targetPath,
        '--confirmation-language', 'en-US',
      ]);
      expect(author.status, author.stderr || author.stdout).toBe(0);
      const authorEnvelope = JSON.parse(author.stdout) as Record<string, any>;
      expect(authorEnvelope.data.status).toBe('audit_pending');
      const requestId = authorEnvelope.data.authoringRequestId as string;
      const authoringAttemptId = authorEnvelope.data.authoringAttemptId as string;
      const recordRoot = path.join(root, '_bmad-output', 'runtime', 'requirement-records', requestId);
      const requirementRecordPath = path.join(recordRoot, 'record', 'requirement-record.json');
      const pointerPath = path.join(recordRoot, 'record', 'active-authoring-request.json');
      const requirementRecord = readJson(requirementRecordPath);
      const activeAuthority = requirementRecord.activeAuthority;
      const buildManifest = readJson(path.join(
        recordRoot,
        ...String(activeAuthority.activeBuildManifestPath).split('/')
      ));
      const auditPacket = readJson(path.join(
        recordRoot,
        ...String(buildManifest.auditPacketRef.path).split('/')
      ));
      const invoke = vi.fn(async ({ request }: { request: Record<string, any> }) => {
        const body = request.auditPacket.body;
        const finding = {
          findingId: 'F-PROJECTION-REPAIR-001',
          severity: 'Major',
          summary: 'The frozen refund rule is not represented in the final projection.',
          affectedMustRefs: ['MUST-FR-REPAIR-001'],
          affectedArtifactRefs: ['final-markdown'],
          logicalEvidenceRefs: ['EVIDENCE-CLAIM-MUST-FR-REPAIR-001'],
        };
        return {
          schemaVersion: 'requirements-contract-judge-response/v2',
          judgeRequestHash: request.judgeRequestHash,
          verdict: 'fail',
          findings: [finding],
          advisoryObservations: [],
          checkedDimensionIds: body.mandatoryDimensionIds,
          dimensionResults: body.mandatoryDimensionIds.map((dimensionId: string) => ({
            dimensionId,
            decision: 'fail',
            findingRefs: [finding.findingId],
          })),
          reviewedArtifactRefs: body.artifactIds,
          reviewedMustRefs: body.requirementIds,
          insufficientAuditReasons: [],
        };
      });
      const provider = {
        transport: 'openai-compatible',
        apiStyle: 'chat_completions',
        model: 'deterministic-test-judge',
        requestPolicy: { maximumAttempts: 1 },
      };
      const preparedInvocation = {
        configPath: 'test-config',
        judgeRuntime: {},
        providerRef: 'deterministic-test-judge',
        provider,
        providerRegistryHash: HASH('9'),
        credentialProviderRef: 'deterministic-test-judge',
        credentialRevision: 1,
        invoke,
      } as PreparedRequirementsContractJudgeInvocation;
      const judged = await runRequirementsContractProductionJudgePipeline({
        authoringRequestId: requestId,
        recordRoot,
        activeAuthority,
        buildManifest,
        auditPacket,
        judgePrompt: {
          systemPrompt: 'Audit the complete frozen Requirements contract.',
          rubric: { mandatoryDimensionIds: auditPacket.body.mandatoryDimensionIds },
          structuredOutputSchema: { type: 'object' },
          outputTokenReserve: 4096,
        },
        providerSelection: {
          providerRef: 'deterministic-test-judge',
          provider,
          adapterRef: 'OpenAICompatibleJudgeAdapter',
          providerRegistryHash: HASH('9'),
        },
        preparedInvocation,
      });
      expect(judged.status).toBe('repair_planned');
      expect(invoke).toHaveBeenCalledTimes(1);
      const authorityBeforeResume = readFileSync(requirementRecordPath);
      const pointerBeforeResume = readFileSync(pointerPath);
      const requestHash = judged.request.judgeRequestHash;

      const resume = runAction('resume-author-confirmation-ready-source', [
        '--request-id', requestId,
        '--authoring-attempt-id', authoringAttemptId,
      ]);
      expect(resume.status, resume.stderr || resume.stdout).toBe(0);
      const resumeEnvelope = JSON.parse(resume.stdout) as Record<string, any>;
      expect(resumeEnvelope.data).toMatchObject({
        status: 'authoring_blocked',
        issueCode: 'judge_remediation_no_progress',
        exitCode: 0,
        judgeRequestHash: requestHash,
        resumable: false,
      });
      expect(readFileSync(requirementRecordPath)).toEqual(authorityBeforeResume);
      expect(readFileSync(pointerPath)).toEqual(pointerBeforeResume);
      expect(invoke).toHaveBeenCalledTimes(1);
      const deltaPath = path.join(
        recordRoot,
        'quality',
        'requests',
        requestHash.replace(':', '-'),
        'remediation-delta.json'
      );
      expect(existsSync(deltaPath)).toBe(false);
      const digestAfterHalt = treeDigest(recordRoot);

      const repeated = runAction('resume-author-confirmation-ready-source', [
        '--request-id', requestId,
        '--authoring-attempt-id', authoringAttemptId,
      ]);
      expect(repeated.status, repeated.stderr || repeated.stdout).toBe(0);
      expect(JSON.parse(repeated.stdout).data).toEqual(resumeEnvelope.data);
      expect(treeDigest(recordRoot)).toBe(digestAfterHalt);
      expect(invoke).toHaveBeenCalledTimes(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 60_000);

  it('resumes the first validated repair commit instead of treating it as a second remediation', () => {
    const classifyAcceptedJudgeFailureContinuation =
      (judgeLifecycle as Record<string, any>).classifyAcceptedJudgeFailureContinuation;
    expect(classifyAcceptedJudgeFailureContinuation({
      request: { remediation: null },
      activeRequest: { remediationDeltaRef: null },
    })).toBe('compile');
    expect(classifyAcceptedJudgeFailureContinuation({
      request: { remediation: null },
      activeRequest: {
        remediationDeltaRef: {
          path: 'quality/requests/sha256-request/remediation-delta.json',
          hash: HASH('7'),
        },
      },
    })).toBe('resume_commit');
    expect(classifyAcceptedJudgeFailureContinuation({
      request: {
        remediation: {
          remediatesRequestHash: HASH('1'),
          remediationAggregateHash: HASH('2'),
          remediationDeltaHash: HASH('3'),
        },
      },
      activeRequest: { remediationDeltaRef: null },
    })).toBe('limit');
  });

  it('blocks a Judge-requested business decision when no source-grounded Grill frontier exists', () => {
    expect(() => requirementsContractAutomaticRepairSteps({
      state: 'business_decision_required',
      repairSteps: [{
        findingId: 'F-BUSINESS-001',
        classification: 'new_business_decision',
        summary: 'Judge prose is not decision authority.',
      }],
    })).toThrow('requirements_contract_remediation_blocked');
  });

  it.each([
    'judge_remediation_no_progress',
    'judge_remediation_limit_reached',
    'requirements_contract_remediation_blocked',
  ])('projects %s as a durable non-resumable CLI halt', (issueCode) => {
    const closedRemediationHaltResult =
      (judgeLifecycle as Record<string, any>).closedRemediationHaltResult;
    const result = closedRemediationHaltResult({
      issueCode,
      authoringRequestId: 'REQ-REPAIR-HALT',
      authoringAttemptId: 'ATTEMPT-REPAIR-HALT',
      judgeRequestHash: HASH('8'),
      automaticRemediationCount: issueCode === 'judge_remediation_limit_reached' ? 1 : 0,
    });

    expect(result).toMatchObject({
      schemaVersion: 'requirements-contract-cli-result/v1',
      status: 'authoring_blocked',
      issueCode,
      authoringRequestId: 'REQ-REPAIR-HALT',
      authoringAttemptId: 'ATTEMPT-REPAIR-HALT',
      judgeRequestHash: HASH('8'),
      exitCode: 0,
      resumable: false,
      nextAction: null,
      errors: [],
    });
    expect(result.resultHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(closedRemediationHaltResult({
      issueCode,
      authoringRequestId: 'REQ-REPAIR-HALT',
      authoringAttemptId: 'ATTEMPT-REPAIR-HALT',
      judgeRequestHash: HASH('8'),
      automaticRemediationCount: issueCode === 'judge_remediation_limit_reached' ? 1 : 0,
    })).toEqual(result);
  });

  it('builds one different successor request only after an actual validated delta', () => {
    const currentJudgeRequestHash = HASH('3');
    const plan = compileRequirementsContractRemediationPlan({
      judgeRequestHash: currentJudgeRequestHash,
      findings: [{
        findingId: 'F-1', severity: 'Major', summary: 'Frozen rule missing from projection',
        affectedMustRefs: ['MUST-001'], affectedArtifactRefs: ['final-markdown'],
        authorityBasis: 'frozen_ir_contains_required_semantics',
        earliestAffectedStage: 'cp05',
      }],
    });
    const result = buildRequirementsContractSuccessorJudgeRequest({
      currentJudgeRequestHash,
      remediationAggregateHash: HASH('4'),
      plan,
      beforeAuthority: { buildManifestHash: HASH('5') },
      afterAuthority: { buildManifestHash: HASH('6') },
      executedRepairStepRefs: ['F-1'], deferredRepairStepRefs: [],
      changedArtifactRoles: ['final_markdown'], changedArtifactRefs: ['final-markdown'],
      automaticRemediationCount: 0,
      maxAutomaticRemediations: 1,
      successorRequestInput: successorInput(),
    });
    expect(result.successorRequest.judgeRequestHash).not.toBe(currentJudgeRequestHash);
    expect(result.successorRequest.remediation).toEqual({
      remediatesRequestHash: currentJudgeRequestHash,
      remediationAggregateHash: HASH('4'),
      remediationDeltaHash: result.delta.remediationDeltaHash,
    });
  });

  it('blocks a second automatic remediation and an unchanged compiler result', () => {
    const currentJudgeRequestHash = HASH('3');
    const plan = compileRequirementsContractRemediationPlan({
      judgeRequestHash: currentJudgeRequestHash,
      findings: [{
        findingId: 'F-1', severity: 'Major', summary: 'Projection gap',
        affectedMustRefs: ['MUST-001'], affectedArtifactRefs: ['final-markdown'],
        authorityBasis: 'frozen_ir_contains_required_semantics',
        earliestAffectedStage: 'cp05',
      }],
    });
    const base = {
      currentJudgeRequestHash, remediationAggregateHash: HASH('4'), plan,
      beforeAuthority: { buildManifestHash: HASH('5') },
      afterAuthority: { buildManifestHash: HASH('6') },
      executedRepairStepRefs: ['F-1'], deferredRepairStepRefs: [],
      changedArtifactRoles: ['final_markdown'], changedArtifactRefs: ['final-markdown'],
      maxAutomaticRemediations: 1,
      successorRequestInput: successorInput(),
    };
    expect(() => buildRequirementsContractSuccessorJudgeRequest({
      ...base, automaticRemediationCount: 1,
    })).toThrow('judge_remediation_limit_reached');
    expect(() => buildRequirementsContractSuccessorJudgeRequest({
      ...base, automaticRemediationCount: 0, afterAuthority: base.beforeAuthority,
    })).toThrow('judge_remediation_no_progress');
  });
});
