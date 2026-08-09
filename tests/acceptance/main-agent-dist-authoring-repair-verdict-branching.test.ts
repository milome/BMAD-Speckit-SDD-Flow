import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { runMainAgentAuthoringRepair } = require('../../packages/bmad-speckit/dist/main-agent/source-authority/scripts/main-agent-orchestration.js') as {
  runMainAgentAuthoringRepair: (root: string, options: Record<string, unknown>) => any;
};
const { criticalAuditorIndependentProviderRunHash } = require('../../packages/bmad-speckit/dist/main-agent/source-authority/scripts/requirements-contract-critical-auditor-independence.js') as {
  criticalAuditorIndependentProviderRunHash: (value: Record<string, unknown>) => string;
};

function sha256Text(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function readJson(file: string): any {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function ensureCriticalAuditorProviderConfig(root: string): void {
  const target = path.join(root, '_bmad', '_config', 'governance-remediation.yaml');
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(
    target,
    readFileSync(path.join(process.cwd(), '_bmad', '_config', 'governance-remediation.yaml'), 'utf8'),
    'utf8'
  );
}

function withIndependentProviderEvidence(
  request: Record<string, any>,
  response: Record<string, unknown>
): Record<string, unknown> {
  const binding = request.independentProviderBinding;
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
    throw new Error('critical auditor request does not contain independentProviderBinding');
  }
  const evidenceWithoutRunHash = Object.fromEntries(
    Object.entries({
      ...binding,
      requestedModel: binding.model,
      transactionId: request.transactionId,
      auditAttemptId: request.auditAttemptId,
      providerRunId: `critical-auditor-run/${String(request.requestHash).slice(-24)}`,
      requestHash: request.requestHash,
      responseHash: sha256Text(JSON.stringify(response)),
      sourceDocumentHash: request.sourceDocumentHash,
      semanticModelHash: request.semanticModelHash,
      projectionSetHash: request.projectionSetHash,
    }).filter(([, value]) => value !== undefined)
  );
  return {
    ...response,
    independentProviderEvidence: {
      ...evidenceWithoutRunHash,
      runHash: criticalAuditorIndependentProviderRunHash(evidenceWithoutRunHash),
    },
  };
}

function authoringPaths(root: string, recordId: string) {
  const dir = path.join(root, '_bmad-output', 'runtime', 'requirement-records', recordId, 'authoring');
  return {
    dir,
    request: (round: number) => path.join(dir, `critical-auditor-round-request-${round}.json`),
    response: (round: number) => path.join(dir, `critical-auditor-round-response-${round}.json`),
    receipt: (round: number) => path.join(dir, `critical-auditor-receipt-round-${round}.json`),
  };
}

function writeSource(root: string, recordId: string): string {
  const source = path.join(root, 'docs', 'requirements', 'dist-source.md');
  mkdirSync(path.dirname(source), { recursive: true });
  const text = [
    '# Dist Runtime Existing Source',
    '',
    'implementationConfirmation:',
    '  contractSchemaVersion: 1',
    '  status: draft',
    `  recordId: ${recordId}`,
    `  requirementSetId: ${recordId}-SET`,
    '  must:',
    '    - id: MUST-001',
    '      text: "Preserve existing source while authoring repair handles Critical Auditor verdicts."',
    '      evidenceRefs: ["EVD-001"]',
    '      coveredByTraceRows: ["TRACE-001"]',
    '  notDone:',
    '    - id: NEG-001',
    '      text: "Do not treat a blocked Critical Auditor repair as a completed source change."',
    '      evidenceRefs: ["EVD-001"]',
    '      whyItBlocksCompletion: "A blocked repair must preserve the existing source contract."',
    '      negativeAssertionRequired: true',
    '      coveredByFailurePath: ["FAIL-001"]',
    '  mustNot:',
    '    - id: OUT-001',
    '      text: "Do not claim implementation readiness from a blocked authoring repair."',
    '      scopeBoundary: authoring_only',
    '      userApprovalRequiredIfChanged: true',
    '  evidence:',
    '    - id: EVD-001',
    '      text: "Dist runtime must write audit receipts without mutating source for blockers."',
    '      requiredCommandRefs: ["CMD-001"]',
    '  failurePaths:',
    '    - id: FAIL-001',
    '      title: "Critical Auditor repair is blocked"',
    '      trigger: "The provider response is insufficient or semantically invalid."',
    '      expectedBehavior: "Preserve the existing source and emit governed repair evidence."',
    '      forbiddenBehavior: "Do not fabricate a completed implementation contract."',
    '      blocksCompletionWhenViolated: true',
    '      linkedNegIds: ["NEG-001"]',
    '      linkedEvidenceIds: ["EVD-001"]',
    '  traceRows:',
    '    - id: TRACE-001',
    '      covers: ["MUST-001"]',
    '      evidenceRefs: ["EVD-001"]',
    '      contractValidationCommandRefs: ["CMD-001"]',
    '  acceptanceTests:',
    '    - id: ACC-001',
    '      file: tests/acceptance/main-agent-dist-authoring-repair-verdict-branching.test.ts',
    '      covers: ["MUST-001"]',
    '      evidenceRefs: ["EVD-001"]',
    '      commandRefs: ["CMD-001"]',
    '  e2eSuites: []',
    '  targetModificationPaths:',
    '    - id: TARGET-MOD-001',
    '      path: packages/bmad-speckit/dist/main-agent/source-authority/scripts/main-agent-orchestration.js',
    '      coverageRole: validate',
    '      requirementRefs: ["MUST-001"]',
    '      traceRefs: ["TRACE-001"]',
    '      evidenceRefs: ["EVD-001"]',
    '  requiredCommands:',
    '    - id: CMD-001',
    '      command: "npx vitest run tests/acceptance/main-agent-dist-authoring-repair-verdict-branching.test.ts"',
    '      purpose: "Validate dist runtime Critical Auditor verdict branching."',
    '      expected: "All tests pass."',
    '',
  ].join('\n');
  writeFileSync(source, text, 'utf8');
  return source;
}

function writePromotionReceipt(root: string, source: string, recordId: string): void {
  const dir = authoringPaths(root, recordId).dir;
  mkdirSync(dir, { recursive: true });
  const sourceText = readFileSync(source, 'utf8');
  const targetHash = sha256Text(sourceText);
  const targetPath = path.relative(root, source).replace(/\\/g, '/');
  const receiptPath = path.join(dir, 'promotion-receipt.json');
  writeFileSync(
    receiptPath,
    `${JSON.stringify(
      {
        ok: true,
        dryRun: false,
        preflightOnly: false,
        draftPath: targetPath,
        promotionStage: 'authoring-draft',
        allowedStatuses: ['draft'],
        statusValue: 'draft',
        confirmationReady: false,
        safePromotionAsDraft: true,
        requiresUserConfirmationBeforeExecution: true,
        manifestPath: `${targetPath}.manifest.json`,
        targetPath,
        targetHash,
        writeReceipt: {
          backupPath: null,
          finalHash: targetHash,
        },
        receiptPath: path.relative(root, receiptPath).replace(/\\/g, '/'),
        backupPath: null,
        audit: {
          status: null,
          ok: true,
          skipped: true,
          reason: 'authoring_draft_is_not_confirmation_ready',
        },
        preflight: {
          manifest: {
            ok: true,
            draftHash: targetHash,
            statusValue: 'draft',
          },
        },
        authoringPromotionGate: {
          required: true,
          ok: true,
          decisions: {
            sourceMutation: {
              finalDecision: 'allow_source_materialization',
              sourceDocumentHashAfter: targetHash,
            },
          },
        },
      },
      null,
      2
    )}\n`,
    'utf8'
  );
}

function writeResponse(
  requestPath: string,
  responsePath: string,
  verdict: 'blocked' | 'insufficient_audit' | 'new_valid_gap',
  overrides: Record<string, unknown> = {}
): void {
  const request = readJson(requestPath);
  const projectionRefs = request.packetProjectionSummary?.projectionRefs ?? [];
  const checkedProjectionGroups = request.packetProjectionSummary?.projectionGroups ?? [];
  const checkedProjectionQualityRuleCodes =
    request.requiredResponseSchema?.checkedProjectionQualityRuleCodes ??
    request.projectionQualityGate?.requiredRuleCodes ??
    [];
  const base = {
    schemaVersion: 'critical-auditor-round-response/v1',
    requestHash: request.requestHash,
    recordId: request.recordId,
    roundIndex: request.roundIndex,
    transactionId: request.transactionId,
    auditAttemptId: request.auditAttemptId,
    namespaceVersion: request.namespaceVersion,
    sourceHash: request.sourceHash,
    sourceDocumentHash: request.sourceDocumentHash,
    sourceBytesHash: request.sourceBytesHash,
    semanticModelHash: request.semanticModelHash,
    implementationConfirmationHash: request.implementationConfirmationHash,
    packetHash: request.packetHash,
    projectionSetHash: request.projectionSetHash,
    gateDryRunHash: request.gateDryRun.gateDryRunHash,
    reconciliationIssueCount: request.gateDryRun.reconciliation.issueCount,
    checkedProjectionGroups,
    checkedProjectionQualityRuleCodes,
    verdict,
    reviewedMustRefs: request.mustRefs,
    reviewedProjectionRefs: projectionRefs.length ? [projectionRefs[0]] : [],
    priorFindingsDisposition: [
      {
        findingRef: `ROUND-${request.roundIndex}-${verdict}`,
        disposition: 'new',
        evidenceRefs: [request.gateDryRun.reportPath],
      },
    ],
    validatedGaps: [],
    rationale: `Dist runtime ${verdict} fixture.`,
  };
  const verdictFields =
    verdict === 'blocked'
      ? {
          sourceMaterializationFindings: [
            {
              code: 'audit_dependency_unavailable',
              message: 'Audit dependency unavailable; external audit input is not ready.',
            },
          ],
        }
      : verdict === 'insufficient_audit'
        ? {
            invalidProofFindings: [
              {
                code: 'audit_evidence_incomplete',
                message: 'Audit response lacks enough evidence for convergence.',
              },
            ],
          }
        : {};
  const response = withIndependentProviderEvidence(request, {
    ...base,
    ...verdictFields,
    ...overrides,
  });
  writeFileSync(responsePath, `${JSON.stringify(response, null, 2)}\n`, 'utf8');
}

function prepareRequest(root: string, recordId: string) {
  ensureCriticalAuditorProviderConfig(root);
  const source = writeSource(root, recordId);
  writePromotionReceipt(root, source, recordId);
  const paths = authoringPaths(root, recordId);
  const implementationAttemptId = `${recordId}-ATTEMPT-1`;
  const firstResult = runMainAgentAuthoringRepair(root, {
    source,
    recordId,
    requirementSetId: `${recordId}-SET`,
    implementationAttemptId,
    mode: 'preserve-existing',
  });
  expect(
    existsSync(paths.request(1)),
    JSON.stringify({
      blockingStage: firstResult.blockingStage,
      nextRequiredAction: firstResult.nextRequiredAction,
      blockingIssues: firstResult.blockingIssues?.map((issue: any) => issue.code),
      authoringFiles: existsSync(paths.dir) ? require('node:fs').readdirSync(paths.dir) : [],
    })
  ).toBe(true);
  const currentSourceText = readFileSync(source, 'utf8');
  expect(currentSourceText).toContain('implementationConfirmation:');
  return { source, currentSourceHash: sha256Text(currentSourceText), paths, implementationAttemptId };
}

function expectReceiptBinding(paths: ReturnType<typeof authoringPaths>, verdict: string): void {
  const request = readJson(paths.request(1));
  const receiptEnvelope = readJson(paths.receipt(1));
  const receipt = receiptEnvelope.criticalAuditorReceipt;
  expect(receipt).toMatchObject({
    roundIndex: 1,
    requestHash: request.requestHash,
    sourceDocumentHash: request.sourceDocumentHash,
    implementationConfirmationHash: request.implementationConfirmationHash,
    packetHash: request.packetHash,
    gateDryRunHash: request.gateDryRun.gateDryRunHash,
  });
  expect(receipt.responseHash).toEqual(expect.stringMatching(/^sha256:[a-f0-9]{64}$/));
  expect(receipt.convergenceDecision.verdict).toBe(verdict);
  expect(receipt.sourceGapFixes ?? []).toEqual([]);
}

describe('compiled dist authoring-repair verdict branching', () => {
  it('routes blocked without semantic gap materialization in package dist runtime', () => {
      const root = mkdtempSync(path.join(os.tmpdir(), 'dist-authoring-repair-blocked-'));
    try {
      const recordId = 'REQ-DIST-AUTHORING-REPAIR-BLOCKED';
      const { source, currentSourceHash, paths, implementationAttemptId } = prepareRequest(
        root,
        recordId
      );
      writeResponse(paths.request(1), paths.response(1), 'blocked');

      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        implementationAttemptId,
        mode: 'preserve-existing',
      });

      expect(
        result.blockingStage,
        JSON.stringify(
          {
            blockingStage: result.blockingStage,
            nextRequiredAction: result.nextRequiredAction,
            blockingIssues: result.blockingIssues?.map((issue: any) => issue.code),
            artifacts: result.artifacts,
            authoringFiles: existsSync(paths.dir) ? require('node:fs').readdirSync(paths.dir) : [],
          },
          null,
          2
        )
      ).toBe('critical_auditor_blocked');
      expect(result.nextRequiredAction).toBe('resolve_critical_auditor_blocker');
      expect(existsSync(paths.receipt(1))).toBe(true);
      expectReceiptBinding(paths, 'blocked');
      expect(sha256Text(readFileSync(source, 'utf8'))).toBe(currentSourceHash);
      expect(result.blockingIssues.map((issue: any) => issue.code)).not.toContain(
        'source_gap_fix_materialization_required'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('routes insufficient_audit to response rewrite in package dist runtime', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'dist-authoring-repair-insufficient-'));
    try {
      const recordId = 'REQ-DIST-AUTHORING-REPAIR-INSUFFICIENT';
      const { source, currentSourceHash, paths, implementationAttemptId } = prepareRequest(
        root,
        recordId
      );
      writeResponse(paths.request(1), paths.response(1), 'insufficient_audit');

      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        implementationAttemptId,
        mode: 'preserve-existing',
      });

      expect(result.blockingStage).toBe('critical_auditor_insufficient_audit');
      expect(result.nextRequiredAction).toBe('rewrite_current_critical_auditor_round_response');
      expect(existsSync(paths.receipt(1))).toBe(true);
      expectReceiptBinding(paths, 'insufficient_audit');
      expect(sha256Text(readFileSync(source, 'utf8'))).toBe(currentSourceHash);
      expect(result.blockingIssues.map((issue: any) => issue.code)).not.toContain(
        'source_gap_fix_materialization_required'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps new_valid_gap strict in package dist runtime', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'dist-authoring-repair-new-gap-'));
    try {
      const recordId = 'REQ-DIST-AUTHORING-REPAIR-NEW-GAP';
      const { source, currentSourceHash, paths, implementationAttemptId } = prepareRequest(
        root,
        recordId
      );
      writeResponse(paths.request(1), paths.response(1), 'new_valid_gap', {
        validatedGaps: [{ id: 'VALID-GAP-NO-ACTIONS', status: 'open' }],
      });

      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        implementationAttemptId,
        mode: 'preserve-existing',
      });

      expect(result.blockingIssues.map((issue: any) => issue.code)).toContain(
        'critical_auditor_validated_gap_repair_actions_missing'
      );
      expect(existsSync(paths.receipt(1))).toBe(false);
      expect(sha256Text(readFileSync(source, 'utf8'))).toBe(currentSourceHash);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
