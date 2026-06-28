import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import * as yaml from 'js-yaml';
import { describe, expect, it, vi } from 'vitest';
import {
  SHORT_FEEDBACK_WINDOW_MS,
  runMainAgentAuthoringRepair,
  runMainAgentPreConfirmationDrilldown,
  validateWrittenDeepReviewInput,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';

const PROJECTION_QUALITY_RULE_CODES = [
  'projection_per_must_acceptance_not_independent',
  'projection_shared_evidence_without_per_must_oracle',
  'required_command_all_cover_all_without_per_must_assertions',
  'target_modification_path_all_cover_all',
  'current_target_map_not_product_specific',
  'business_visual_generic_or_compressed',
];

function checkedProjectionQualityRuleCodesForRequest(input: any): string[] {
  return (
    input.requiredResponseSchema?.checkedProjectionQualityRuleCodes ??
    input.projectionQualityGate?.requiredRuleCodes ??
    PROJECTION_QUALITY_RULE_CODES
  );
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`
    )
    .join(',')}}`;
}

function sha256Text(value: string): string {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function sha256Json(value: unknown): string {
  return sha256Text(stableStringify(value));
}

function semanticConfirmationForHash(
  confirmation: Record<string, unknown>
): Record<string, unknown> {
  const bookkeeping = new Set([
    'status',
    'confirmedAt',
    'confirmedBy',
    'sourceDocumentHash',
    'implementationConfirmationHash',
    'reconfirmationRequest',
    'confirmationRender',
  ]);
  return Object.fromEntries(Object.entries(confirmation).filter(([key]) => !bookkeeping.has(key)));
}

function rootRelative(root: string, filePath: string): string {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function sourceMaterializationReceiptPath(root: string, requirementSetId: string): string {
  return path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    requirementSetId,
    'authoring',
    'source-materialization-receipt.json'
  );
}

function authoringDir(root: string, recordId: string): string {
  return path.join(root, '_bmad-output', 'runtime', 'requirement-records', recordId, 'authoring');
}

function promotionReceiptPath(root: string, recordId: string): string {
  return path.join(authoringDir(root, recordId), 'promotion-receipt.json');
}

function requestPath(root: string, recordId: string, round: number): string {
  return path.join(authoringDir(root, recordId), `critical-auditor-round-request-${round}.json`);
}

function responsePath(root: string, recordId: string, round: number): string {
  return path.join(authoringDir(root, recordId), `critical-auditor-round-response-${round}.json`);
}

function readJson(file: string): any {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function currentSourceHashes(source: string): {
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  confirmation: Record<string, unknown>;
} {
  const text = readFileSync(source, 'utf8');
  const match = text.match(/^implementationConfirmation:\n[\s\S]*$/m);
  if (!match) {
    throw new Error('implementationConfirmation block missing');
  }
  const confirmation = (yaml.load(match[0]) as any).implementationConfirmation;
  const semantic = semanticConfirmationForHash(confirmation);
  const normalizedBlock = `implementationConfirmation:${stableStringify(semantic)}`;
  return {
    sourceDocumentHash: sha256Text(text.replace(match[0], normalizedBlock)),
    implementationConfirmationHash: sha256Json(semantic),
    confirmation,
  };
}

function writeSourceWithoutConfirmation(root: string): string {
  const source = path.join(root, 'docs', 'requirements', 'source-without-confirmation.md');
  mkdirSync(path.dirname(source), { recursive: true });
  writeFileSync(
    source,
    [
      '# Source Without Confirmation',
      '',
      '- MUST: The authoring lane must write source before deep audit starts.',
      '',
    ].join('\n'),
    'utf8'
  );
  return source;
}

function writeSourceWithConfirmation(
  root: string,
  recordId: string,
  requirementSetId = recordId
): string {
  const source = path.join(root, 'docs', 'requirements', 'source-with-confirmation.md');
  mkdirSync(path.dirname(source), { recursive: true });
  writeFileSync(
    source,
    [
      '# Source With Confirmation',
      '',
      'implementationConfirmation:',
      '  contractSchemaVersion: 1',
      '  status: draft',
      `  recordId: ${recordId}`,
      `  requirementSetId: ${requirementSetId}`,
      '  confirmationLanguage: zh-CN',
      '  confirmationProfile: implementation_confirmation',
      '  requiredViewPacks: ["currentTargetMap"]',
      '  optionalViewPacks: []',
      '  must:',
      '    - id: MUST-001',
      '      text: "Deep audit starts only after the promotion receipt is current."',
      '      evidenceRefs: ["EVD-001"]',
      '      coveredByTraceRows: ["TRACE-001"]',
      '      coveredBySequenceViews: ["SEQ-001"]',
      '  evidence:',
      '    - id: EVD-001',
      '      text: "Receipt binds written source hash."',
      '      gate: "npx vitest run tests/acceptance/main-agent-source-materialization-before-audit.test.ts"',
      '      oracle: "Guard blocks stale receipts."',
      '      requiredCommandRefs: ["CMD-001"]',
      '      artifactRefs: ["ART-001"]',
      '  traceRows:',
      '    - id: TRACE-001',
      '      covers: ["MUST-001"]',
      '      taskRefs: ["TASK-001"]',
      '      evidenceRefs: ["EVD-001"]',
      '      contractValidationCommandRefs: ["CMD-001"]',
      '      acceptanceRefs: ["ACC-001"]',
      '      sequenceViewRefs: ["SEQ-001"]',
      '      artifactRefs: ["ART-001"]',
      '      status: PENDING',
      '  acceptanceTests:',
      '    - id: ACC-001',
      '      file: tests/acceptance/main-agent-source-materialization-before-audit.test.ts',
      '      covers: ["MUST-001"]',
      '      traceRows: ["TRACE-001"]',
      '      evidenceRefs: ["EVD-001"]',
      '      commandRefs: ["CMD-001"]',
      '      positiveControl: true',
      '      expectedPreImplementationState: expected_red',
      '      oracle: "Deep audit request is fail-closed before materialization."',
      '  requiredCommands:',
      '    - id: CMD-001',
      '      command: "npx vitest run tests/acceptance/main-agent-source-materialization-before-audit.test.ts"',
      '      purpose: "Validate source materialization gate."',
      '      expected: "Tests pass."',
      '      targetFiles: ["scripts/main-agent-orchestration.ts"]',
      '      traceRows: ["TRACE-001"]',
      '      evidenceRefs: ["EVD-001"]',
      '  currentTargetMap:',
      '    schemaVersion: current-target-map/v1',
      '    displayProfile: closed_loop_current_target_map',
      '    currentSummary:',
      '      - title: "Unverified audit"',
      '        detail: "Deep review has no promotion receipt."',
      '    targetSummary:',
      '      - title: "Verified audit"',
      '        detail: "Deep review is bound to the promoted source hash."',
      '',
    ].join('\n'),
    'utf8'
  );
  return source;
}

function writePromotionReceipt(input: {
  root: string;
  source: string;
  recordId: string;
  requirementSetId?: string;
  sourceDocumentHashAfter?: string;
  implementationConfirmationHash?: string;
}): string {
  const requirementSetId = input.requirementSetId ?? input.recordId;
  const hashes = currentSourceHashes(input.source);
  const sourcePath = rootRelative(input.root, input.source);
  const targetHash = sha256Text(readFileSync(input.source, 'utf8'));
  const receipt: Record<string, unknown> = {
    ok: true,
    dryRun: false,
    preflightOnly: false,
    draftPath: rootRelative(
      input.root,
      path.join(authoringDir(input.root, input.recordId), 'draft-source-preview.md')
    ),
    targetPath: sourcePath,
    promotionStage: 'authoring-draft',
    allowedStatuses: ['draft', 'draft_updated_not_confirmation_ready', 'reconfirm_required'],
    statusValue: 'draft',
    confirmationReady: false,
    safePromotionAsDraft: true,
    requiresUserConfirmationBeforeExecution: true,
    manifestPath: rootRelative(
      input.root,
      path.join(authoringDir(input.root, input.recordId), 'draft-manifest.json')
    ),
    targetHash,
    writeReceipt: {
      schemaVersion: 'large-document-writer-safe-write/v1',
      targetPath: sourcePath,
      finalHash: targetHash,
      mode: 'replace',
    },
    receiptPath: rootRelative(input.root, promotionReceiptPath(input.root, input.recordId)),
    backupPath: rootRelative(
      input.root,
      path.join(authoringDir(input.root, input.recordId), 'promotion-backup.md')
    ),
    audit: {
      status: null,
      ok: true,
      skipped: true,
      reason: 'authoring_draft_is_not_confirmation_ready',
    },
    preflight: {
      manifest: {
        targetPath: sourcePath,
        draftHash: targetHash,
        statusValue: 'draft',
        recordId: input.recordId,
        requirementSetId,
      },
    },
    authoringPromotionGate: {
      required: true,
      ok: true,
      decisions: {
        sourceMutation: {
          finalDecision: 'allow_source_materialization',
          sourceMutationAllowed: true,
          sourceDocumentExistedBefore: true,
          sourceDocumentHashBefore: hashes.sourceDocumentHash,
          sourceDocumentHashAfter: input.sourceDocumentHashAfter ?? targetHash,
        },
      },
    },
    failureClass: null,
  };
  const receiptPath = promotionReceiptPath(input.root, input.recordId);
  mkdirSync(path.dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  return receiptPath;
}

function writeLegacySourceMaterializationReceipt(input: {
  root: string;
  source: string;
  recordId: string;
  requirementSetId?: string;
}): string {
  const requirementSetId = input.requirementSetId ?? input.recordId;
  const hashes = currentSourceHashes(input.source);
  const receipt: Record<string, unknown> = {
    schemaVersion: 'source-materialization-receipt/v1',
    sourcePath: rootRelative(input.root, input.source),
    requirementSetId,
    recordId: input.recordId,
    sourceDocumentHashBefore: hashes.sourceDocumentHash,
    sourceDocumentHashAfter: hashes.sourceDocumentHash,
    implementationConfirmationHash: hashes.implementationConfirmationHash,
    writtenIdRanges: ['ACC-001', 'ART-001', 'CMD-001', 'EVD-001', 'TASK-001', 'TRACE-001'],
    draftStatus: 'confirmation_ready',
    nextAuditCommand:
      'npx vitest run tests/acceptance/main-agent-source-materialization-before-audit.test.ts',
    createdAt: '2026-06-01T00:00:00.000Z',
    createdBy: 'main-agent-source-materialization',
    receiptHash: null,
  };
  receipt.receiptHash = sha256Json({ ...receipt, receiptHash: null });
  const receiptPath = sourceMaterializationReceiptPath(input.root, requirementSetId);
  mkdirSync(path.dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  return receiptPath;
}

function writeValidatedGapResponse(request: string, response: string): void {
  const body = readJson(request);
  const projectionRefs = body.packetProjectionSummary?.projectionRefs ?? [];
  writeFileSync(
    response,
    `${JSON.stringify(
      {
        schemaVersion: 'critical-auditor-round-response/v1',
        requestHash: body.requestHash,
        recordId: body.recordId,
        roundIndex: body.roundIndex,
        sourceDocumentHash: body.sourceDocumentHash,
        implementationConfirmationHash: body.implementationConfirmationHash,
        packetHash: body.packetHash,
        gateDryRunHash: body.gateDryRun.gateDryRunHash,
        reconciliationIssueCount: body.gateDryRun.reconciliation.issueCount,
        checkedProjectionGroups: body.packetProjectionSummary.projectionGroups,
        checkedProjectionQualityRuleCodes: checkedProjectionQualityRuleCodesForRequest(body),
        verdict: 'new_valid_gap',
        reviewedMustRefs: body.mustRefs,
        reviewedProjectionRefs: projectionRefs.slice(0, 1),
        priorFindingsDisposition: [
          {
            findingRef: 'ROUND-1-GAP',
            disposition: 'new',
            evidenceRefs: [body.gateDryRun.reportPath],
          },
        ],
        validatedGaps: [
          {
            id: 'GAP-001',
            status: 'open',
            finding: 'Source lacks a materialized gap-fix row.',
            repairActions: [
              {
                actionId: 'REPAIR-GAP-001',
                type: 'add_must',
                sourceSpan: { startLine: 1, endLine: 1 },
                sourceText: 'Source gap fix must be materialized into semantic contract rows.',
                targetField: 'implementationConfirmation.must',
                newValue: {
                  id: 'MUST-GAP-FIX-001',
                  text: 'Source gap fix must be materialized into semantic contract rows.',
                },
                reason: 'Validated gap requires a source-bound semantic contract row.',
                mustRefs: body.mustRefs?.length ? [body.mustRefs[0]] : ['MUST-001'],
                requirementIds: ['REQ-GAP-FIX-001'],
              },
            ],
          },
        ],
        rejectedGapCandidates: [],
        rationale: 'A new valid gap requires source repair before the next audit round.',
      },
      null,
      2
    )}\n`,
    'utf8'
  );
}

function cleanCriticalAuditorRound(input: any) {
  return {
    verdict: 'no_new_valid_gap' as const,
    gateDryRunHash: input.gateDryRun.hash,
    reconciliationIssueCount: input.gateDryRun.reconciliation.issueCount,
    checkedProjectionGroups: input.packetProjectionSummary.projectionGroups,
    checkedProjectionQualityRuleCodes: checkedProjectionQualityRuleCodesForRequest(input),
    reviewedProjectionRefs: input.packetProjectionSummary.projectionRefs.slice(0, 1),
    priorFindingsDisposition: [
      {
        findingRef: `ROUND-${input.roundIndex}-BASELINE`,
        disposition: input.roundIndex === 1 ? 'new' : 'unchanged',
        evidenceRefs: [input.gateDryRun.reportPath],
      },
    ],
    rejectedGapCandidates: [{ id: `REJ-${input.roundIndex}`, reason: 'no new valid gap detected' }],
    rationale: `Round ${input.roundIndex} found no new valid gap.`,
  };
}

describe('source materialization before deep audit', () => {
  it('defines the short feedback window used before source promotion', () => {
    expect(SHORT_FEEDBACK_WINDOW_MS).toBe(300000);
  });

  it('does not write a legacy source-materialization receipt before staging audit convergence', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'source-materialization-receipt-'));
    try {
      const source = writeSourceWithoutConfirmation(root);
      const beforeSourceText = readFileSync(source, 'utf8');
      const result = runMainAgentPreConfirmationDrilldown(root, {
        source,
        recordId: 'REQ-SOURCE-MAT',
        requirementSetId: 'REQSET-SOURCE-MAT',
        confirmationLanguage: 'zh-CN',
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const receiptPath = sourceMaterializationReceiptPath(root, 'REQSET-SOURCE-MAT');

      expect(result.substate).not.toBe('source_materialized');
      expect(result.sourceMutationPerformed).toBe(false);
      expect(result.receiptPath).toBeNull();
      expect(existsSync(receiptPath)).toBe(false);
      expect(readFileSync(source, 'utf8')).toBe(beforeSourceText);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects unsafe requirement identifiers before deriving runtime write paths', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'source-materialization-safe-id-'));
    const escaped = path.resolve(root, '..', 'escaped-requirement-records');
    try {
      const source = writeSourceWithoutConfirmation(root);

      expect(() =>
        runMainAgentPreConfirmationDrilldown(root, {
          source,
          recordId: 'REQ-SOURCE-MAT',
          requirementSetId: '../escaped-requirement-records',
          confirmationLanguage: 'zh-CN',
          criticalAuditorRound: cleanCriticalAuditorRound,
        })
      ).toThrow(/requirementSetId must not contain path separators or traversal segments/u);
      expect(existsSync(escaped)).toBe(false);

      expect(() =>
        runMainAgentPreConfirmationDrilldown(root, {
          source,
          recordId: '../escaped-requirement-records',
          requirementSetId: 'REQSET-SOURCE-MAT',
          confirmationLanguage: 'zh-CN',
          criticalAuditorRound: cleanCriticalAuditorRound,
        })
      ).toThrow(/recordId must not contain path separators or traversal segments/u);
      expect(existsSync(escaped)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(escaped, { recursive: true, force: true });
    }
  });

  it('blocks deep audit request generation when receipt or inline confirmation is missing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'source-materialization-guard-'));
    try {
      const recordId = 'REQ-SOURCE-MAT-GUARD';
      const source = writeSourceWithConfirmation(root, recordId);

      const missingReceipt = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        mode: 'preserve-existing',
      });
      expect(missingReceipt.purpose).toBe('post_materialization_deep_audit');
      expect(missingReceipt.purposeGuard).toMatchObject({
        purpose: 'post_materialization_deep_audit',
        blockingStage: 'promotion_receipt_required_before_deep_audit',
      });
      expect(missingReceipt.blockingStage).toBe('promotion_receipt_required_before_audit');
      expect(missingReceipt.blockingIssues.map((issue: any) => issue.code)).toContain(
        'promotion_receipt_missing'
      );
      expect(existsSync(requestPath(root, recordId, 1))).toBe(false);

      const noInlineSource = writeSourceWithoutConfirmation(root);
      const missingInline = runMainAgentAuthoringRepair(root, {
        source: noInlineSource,
        recordId: 'REQ-NO-INLINE',
        mode: 'preserve-existing',
      });
      expect(missingInline.purposeGuard.blockingStage).toBe(
        'implementation_confirmation_missing'
      );
      expect(missingInline.blockingStage).toBe('implementation_confirmation_missing');
      expect(missingInline.blockingIssues.map((issue: any) => issue.code)).toContain(
        'implementation_confirmation_missing'
      );
      expect(existsSync(requestPath(root, 'REQ-NO-INLINE', 1))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not accept legacy source-materialization receipt as current promotion proof', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'source-materialization-legacy-receipt-'));
    try {
      const recordId = 'REQ-SOURCE-MAT-LEGACY';
      const source = writeSourceWithConfirmation(root, recordId);
      writeLegacySourceMaterializationReceipt({ root, source, recordId });

      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        mode: 'preserve-existing',
      });

      expect(result.purposeGuard).toMatchObject({
        requiredEvidence: [
          'current_source_hash',
          'inline_implementationConfirmation',
          'promotion_receipt',
        ],
        blockingStage: 'promotion_receipt_required_before_deep_audit',
      });
      expect(result.blockingStage).toBe('promotion_receipt_required_before_audit');
      expect(result.blockingIssues.map((issue: any) => issue.code)).toContain(
        'promotion_receipt_missing'
      );
      expect(existsSync(promotionReceiptPath(root, recordId))).toBe(false);
      expect(existsSync(requestPath(root, recordId, 1))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('refreshes the promotion receipt and resets no-new-gap counter after a valid gap fix', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'source-materialization-gap-fix-'));
    try {
      const recordId = 'REQ-SOURCE-MAT-GAP-FIX';
      const source = writeSourceWithConfirmation(root, recordId);
      const receiptPath = writePromotionReceipt({ root, source, recordId });
      const beforeReceipt = readJson(receiptPath);
      const legacyReceiptPath = sourceMaterializationReceiptPath(root, recordId);

      const first = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        mode: 'preserve-existing',
      });
      expect(first.blockingStage).toBe('critical_auditor_round_required');
      const firstRequest = readJson(requestPath(root, recordId, 1));
      expect(firstRequest).toMatchObject({
        purpose: 'critical_auditor_round',
        purposeGuard: {
          purpose: 'critical_auditor_round',
          parentPurpose: 'staging_transaction_deep_audit',
          sourceMaterializationRequiredBeforeDeepAudit: false,
        },
      });
      writeValidatedGapResponse(requestPath(root, recordId, 1), responsePath(root, recordId, 1));

      const gapResult = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        mode: 'preserve-existing',
        criticalAuditorResponse: responsePath(root, recordId, 1),
      });
      const afterReceipt = readJson(receiptPath);
      expect(gapResult.blockingStage).toBe('critical_auditor_round_required');
      expect(gapResult.consecutiveNoNewGapRounds).toBe(0);
      expect(afterReceipt.targetHash).not.toBe(beforeReceipt.targetHash);
      expect(
        afterReceipt.authoringPromotionGate.decisions.sourceMutation.sourceDocumentHashAfter
      ).toBe(afterReceipt.targetHash);
      expect(afterReceipt.promotionStage).toBe('authoring-draft');
      expect(existsSync(legacyReceiptPath)).toBe(false);
      expect(readFileSync(source, 'utf8')).toContain('sourceGapFixes:');
      expect(existsSync(requestPath(root, recordId, 1))).toBe(true);
      expect(existsSync(requestPath(root, recordId, 2))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps draft feedback in staging and does not write a legacy source-materialization receipt when the short feedback window expires', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'source-materialization-draft-window-'));
    let nowSpy: ReturnType<typeof vi.spyOn> | null = null;
    try {
      vi.useFakeTimers();
      nowSpy = vi
        .spyOn(Date, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValue(SHORT_FEEDBACK_WINDOW_MS + 1);
      const source = writeSourceWithoutConfirmation(root);
      const beforeSourceText = readFileSync(source, 'utf8');
      const result = runMainAgentPreConfirmationDrilldown(root, {
        source,
        recordId: 'REQ-SOURCE-MAT-DRAFT',
        requirementSetId: 'REQSET-SOURCE-MAT-DRAFT',
      });
      const receiptPath = sourceMaterializationReceiptPath(root, 'REQSET-SOURCE-MAT-DRAFT');

      expect(result.substate).not.toBe('source_materialized');
      expect(result.sourceMutationPerformed).toBe(false);
      expect(result.receiptPath).toBeNull();
      expect(existsSync(receiptPath)).toBe(false);
      expect(readFileSync(source, 'utf8')).toBe(beforeSourceText);
      expect(existsSync(requestPath(root, 'REQ-SOURCE-MAT-DRAFT', 1))).toBe(false);
    } finally {
      nowSpy?.mockRestore();
      vi.useRealTimers();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('requires deep review skills to bind input hash to a written file hash', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'source-materialization-review-input-'));
    try {
      const missing = validateWrittenDeepReviewInput({
        root,
        skillName: 'grill-with-docs',
      });
      expect(missing.status).toBe('written_document_path_required');

      const source = writeSourceWithoutConfirmation(root);
      const fileHash = `sha256:${crypto
        .createHash('sha256')
        .update(readFileSync(source))
        .digest('hex')}`;
      const ready = validateWrittenDeepReviewInput({
        root,
        skillName: 'docs-review',
        documentPath: rootRelative(root, source),
        inputHash: fileHash,
      });
      expect(ready).toMatchObject({
        ok: true,
        status: 'ready',
        documentPath: rootRelative(root, source),
        writtenFileHash: fileHash,
        inputHash: fileHash,
      });

      const stale = validateWrittenDeepReviewInput({
        root,
        skillName: 'docs-review',
        documentPath: rootRelative(root, source),
        inputHash: 'sha256:'.concat('1'.repeat(64)),
      });
      expect(stale.status).toBe('input_hash_mismatch');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
