import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import * as yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import {
  SHORT_FEEDBACK_WINDOW_MS,
  SOURCE_MATERIALIZATION_RECEIPT_SCHEMA_VERSION,
  runMainAgentAuthoringRepair,
  runMainAgentPreConfirmationDrilldown,
  validateWrittenDeepReviewInput,
} from '../../scripts/main-agent-orchestration';

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
      '      text: "Deep audit starts only after source materialization receipt is current."',
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
      '        detail: "Deep review has no written source receipt."',
      '    targetSummary:',
      '      - title: "Verified audit"',
      '        detail: "Deep review is bound to written source hash."',
      '',
    ].join('\n'),
    'utf8'
  );
  return source;
}

function writeMaterializationReceipt(input: {
  root: string;
  source: string;
  recordId: string;
  requirementSetId?: string;
  draftStatus?: 'confirmation_ready' | 'draft_updated_not_confirmation_ready';
  sourceDocumentHashAfter?: string;
  implementationConfirmationHash?: string;
}): string {
  const requirementSetId = input.requirementSetId ?? input.recordId;
  const hashes = currentSourceHashes(input.source);
  const receipt: Record<string, unknown> = {
    schemaVersion: SOURCE_MATERIALIZATION_RECEIPT_SCHEMA_VERSION,
    sourcePath: rootRelative(input.root, input.source),
    requirementSetId,
    recordId: input.recordId,
    sourceDocumentHashBefore: hashes.sourceDocumentHash,
    sourceDocumentHashAfter: input.sourceDocumentHashAfter ?? hashes.sourceDocumentHash,
    implementationConfirmationHash:
      input.implementationConfirmationHash ?? hashes.implementationConfirmationHash,
    writtenIdRanges: ['ACC-001', 'ART-001', 'CMD-001', 'EVD-001', 'TASK-001', 'TRACE-001'],
    draftStatus: input.draftStatus ?? 'confirmation_ready',
    nextAuditCommand:
      'pwsh.exe -NoLogo -NoProfile -Command "& { npx vitest run tests/acceptance/main-agent-source-materialization-before-audit.test.ts; npx vitest run tests/acceptance/main-agent-authoring-repair-preserve-existing.test.ts }"',
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
  it('defines source materialization constants', () => {
    expect(SOURCE_MATERIALIZATION_RECEIPT_SCHEMA_VERSION).toBe('source-materialization-receipt/v1');
    expect(SHORT_FEEDBACK_WINDOW_MS).toBe(300000);
  });

  it('writes a materialization receipt with hashes after pre-confirmation source materialization', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'source-materialization-receipt-'));
    try {
      const source = writeSourceWithoutConfirmation(root);
      const result = runMainAgentPreConfirmationDrilldown(root, {
        source,
        recordId: 'REQ-SOURCE-MAT',
        requirementSetId: 'REQSET-SOURCE-MAT',
        confirmationLanguage: 'zh-CN',
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const receiptPath = sourceMaterializationReceiptPath(root, 'REQSET-SOURCE-MAT');
      const receipt = readJson(receiptPath);
      const hashes = currentSourceHashes(source);

      expect(result.receiptPath).toBe(rootRelative(root, receiptPath));
      expect(receipt.schemaVersion).toBe(SOURCE_MATERIALIZATION_RECEIPT_SCHEMA_VERSION);
      expect(receipt.sourcePath).toBe(rootRelative(root, source));
      expect(receipt.requirementSetId).toBe('REQSET-SOURCE-MAT');
      expect(receipt.recordId).toBe('REQ-SOURCE-MAT');
      expect(receipt.sourceDocumentHashBefore).toMatch(/^sha256:/);
      expect(receipt.sourceDocumentHashAfter).toBe(hashes.sourceDocumentHash);
      expect(receipt.implementationConfirmationHash).toBe(hashes.implementationConfirmationHash);
      expect(receipt.writtenIdRanges).toEqual(
        expect.arrayContaining([
          'ACC-001',
          'ART-001',
          'CMD-001',
          'EVD-001',
          'TASK-001',
          'TRACE-001',
        ])
      );
      expect(receipt.draftStatus).toBe('confirmation_ready');
      expect(receipt.nextAuditCommand).toContain('pwsh.exe -NoLogo -NoProfile -Command');
      expect(receipt.createdBy).toBe('main-agent-source-materialization');
      expect(Number.isFinite(Date.parse(receipt.createdAt))).toBe(true);
      expect(receipt.receiptHash).toBe(sha256Json({ ...receipt, receiptHash: null }));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks deep audit request generation when receipt is missing, stale, draft, or inline confirmation is missing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'source-materialization-guard-'));
    try {
      const recordId = 'REQ-SOURCE-MAT-GUARD';
      const source = writeSourceWithConfirmation(root, recordId);

      const missingReceipt = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        mode: 'preserve-existing',
      });
      expect(missingReceipt.blockingStage).toBe('source_materialization_required_before_audit');
      expect(missingReceipt.blockingIssues.map((issue: any) => issue.code)).toContain(
        'source_materialization_receipt_missing'
      );
      expect(existsSync(requestPath(root, recordId, 1))).toBe(false);

      writeMaterializationReceipt({
        root,
        source,
        recordId,
        sourceDocumentHashAfter: 'sha256:'.concat('0'.repeat(64)),
      });
      const staleReceipt = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        mode: 'preserve-existing',
      });
      expect(staleReceipt.blockingStage).toBe('source_materialization_required_before_audit');
      expect(staleReceipt.blockingIssues.map((issue: any) => issue.code)).toContain(
        'source_materialization_receipt_source_hash_stale'
      );
      expect(existsSync(requestPath(root, recordId, 1))).toBe(false);

      writeMaterializationReceipt({
        root,
        source,
        recordId,
        draftStatus: 'draft_updated_not_confirmation_ready',
      });
      const draftReceipt = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        mode: 'preserve-existing',
      });
      expect(draftReceipt.blockingStage).toBe('source_materialization_required_before_audit');
      expect(draftReceipt.blockingIssues.map((issue: any) => issue.code)).toContain(
        'source_materialization_receipt_not_confirmation_ready'
      );
      expect(existsSync(requestPath(root, recordId, 1))).toBe(false);

      const noInlineSource = writeSourceWithoutConfirmation(root);
      const missingInline = runMainAgentAuthoringRepair(root, {
        source: noInlineSource,
        recordId: 'REQ-NO-INLINE',
        mode: 'preserve-existing',
      });
      expect(missingInline.blockingStage).toBe('source_materialization_required_before_audit');
      expect(missingInline.blockingIssues.map((issue: any) => issue.code)).toContain(
        'implementation_confirmation_missing'
      );
      expect(existsSync(requestPath(root, 'REQ-NO-INLINE', 1))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('refreshes the materialization receipt and resets no-new-gap counter after a valid gap fix', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'source-materialization-gap-fix-'));
    try {
      const recordId = 'REQ-SOURCE-MAT-GAP-FIX';
      const source = writeSourceWithConfirmation(root, recordId);
      const receiptPath = writeMaterializationReceipt({ root, source, recordId });
      const beforeReceipt = readJson(receiptPath);

      const first = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        mode: 'preserve-existing',
      });
      expect(first.blockingStage).toBe('critical_auditor_round_required');
      writeValidatedGapResponse(requestPath(root, recordId, 1), responsePath(root, recordId, 1));

      const gapResult = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        mode: 'preserve-existing',
        criticalAuditorResponse: responsePath(root, recordId, 1),
      });
      const afterReceipt = readJson(receiptPath);
      expect(gapResult.blockingStage).toBe('source_packet_repair_required');
      expect(gapResult.consecutiveNoNewGapRounds).toBe(0);
      expect(afterReceipt.sourceDocumentHashAfter).not.toBe(beforeReceipt.sourceDocumentHashAfter);
      expect(afterReceipt.receiptHash).toBe(sha256Json({ ...afterReceipt, receiptHash: null }));
      expect(readFileSync(source, 'utf8')).toContain('sourceGapFixes:');
      expect(existsSync(requestPath(root, recordId, 2))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes draft_updated_not_confirmation_ready feedback before deep audit when the short feedback window expires', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'source-materialization-draft-window-'));
    const originalNow = Date.now;
    let calls = 0;
    try {
      Date.now = () => {
        calls += 1;
        return calls === 1 ? 0 : SHORT_FEEDBACK_WINDOW_MS + 1;
      };
      const source = writeSourceWithoutConfirmation(root);
      const result = runMainAgentPreConfirmationDrilldown(root, {
        source,
        recordId: 'REQ-SOURCE-MAT-DRAFT',
        requirementSetId: 'REQSET-SOURCE-MAT-DRAFT',
      });
      const receiptPath = sourceMaterializationReceiptPath(root, 'REQSET-SOURCE-MAT-DRAFT');
      const receipt = readJson(receiptPath);

      expect(result.substate).toBe('source_materialized');
      expect(receipt.draftStatus).toBe('draft_updated_not_confirmation_ready');
      expect(result.updatedSourceSections).toEqual(expect.arrayContaining(['TASK-001']));
      expect(result.blockingNextAction).toBe(
        'continue_author_confirmation_ready_source_materialization'
      );
      expect(result.sourceDocumentHash).toBe(receipt.sourceDocumentHashAfter);
      expect(result.receiptPath).toBe(rootRelative(root, receiptPath));
      expect(result.receiptHash).toBe(receipt.receiptHash);
      expect(existsSync(requestPath(root, 'REQ-SOURCE-MAT-DRAFT', 1))).toBe(false);
    } finally {
      Date.now = originalNow;
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
