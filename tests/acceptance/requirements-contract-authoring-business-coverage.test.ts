import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import {
  artifacts,
  cleanCriticalAuditorRound,
  createTempRoot,
  createTestAuthoringExecutionOptions,
  installJudgeRuntimeConfig,
  issueCodes,
  readJson,
  readImplementationConfirmation,
} from './helpers/requirements-contract-authoring-fixture';
import {
  runMainAgentAuthoringRepair,
  runMainAgentPreConfirmationDrilldown,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';

function createJudgeReadyTempRoot(prefix: string): string {
  const root = createTempRoot(prefix);
  installJudgeRuntimeConfig(root);
  return root;
}

const fixtureRelativePath =
  'tests/acceptance/fixtures/requirements-contract/multi-timeframe-display-settings.real.md';
const metadataRelativePath =
  'tests/acceptance/fixtures/requirements-contract/multi-timeframe-display-settings.real.metadata.json';
const PROJECTION_QUALITY_RULE_CODES = [
  'projection_per_must_acceptance_not_independent',
  'projection_shared_evidence_without_per_must_oracle',
  'required_command_all_cover_all_without_per_must_assertions',
  'target_modification_path_all_cover_all',
  'current_target_map_not_product_specific',
  'business_visual_generic_or_compressed',
];
const requiredCheckpointIds = [
  'cp-00-semantic-kernel',
  'cp-01-must-decomposition-packet',
  'cp-02-atomic-decomposition-loop-convergence',
  'cp-03-packet-to-source-materialization',
  'cp-04-id-freeze',
  'cp-05-implementation-confirmation-core',
  'cp-06-projections',
  'cp-07-human-readable-views',
  'cp-08-pre-render-global-reconciliation',
];
const requireForProjectionGate = createRequire(import.meta.url);
const { collectProjectionQualityIssues } = requireForProjectionGate(
  '../../_bmad/skills/requirements-contract-authoring/scripts/projection_quality_gate.js'
) as {
  collectProjectionQualityIssues: (
    confirmation: Record<string, unknown>,
    options?: Record<string, unknown>
  ) => Array<{ code: string; refs: string[] }>;
};

function readUtf8(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function sha256Text(text: string): string {
  return createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
}

function sha256PrefixedText(text: string): string {
  return `sha256:${sha256Text(text)}`;
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

function sha256Json(value: unknown): string {
  return sha256PrefixedText(stableStringify(value));
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
  const semantic = Object.fromEntries(
    Object.entries(confirmation).filter(([key]) => !bookkeeping.has(key))
  );
  const drilldown =
    semantic.preConfirmationDrilldown &&
    typeof semantic.preConfirmationDrilldown === 'object' &&
    !Array.isArray(semantic.preConfirmationDrilldown)
      ? { ...(semantic.preConfirmationDrilldown as Record<string, unknown>) }
      : {};
  const semanticKernelRef =
    drilldown.semanticKernelRef &&
    typeof drilldown.semanticKernelRef === 'object' &&
    !Array.isArray(drilldown.semanticKernelRef)
      ? { ...(drilldown.semanticKernelRef as Record<string, unknown>) }
      : {};
  const mustDecompositionPacketRef =
    drilldown.mustDecompositionPacketRef &&
    typeof drilldown.mustDecompositionPacketRef === 'object' &&
    !Array.isArray(drilldown.mustDecompositionPacketRef)
      ? { ...(drilldown.mustDecompositionPacketRef as Record<string, unknown>) }
      : {};
  if (Object.keys(semanticKernelRef).length > 0) {
    delete semanticKernelRef.hash;
    drilldown.semanticKernelRef = semanticKernelRef;
  }
  if (Object.keys(mustDecompositionPacketRef).length > 0) {
    delete mustDecompositionPacketRef.hash;
    drilldown.mustDecompositionPacketRef = mustDecompositionPacketRef;
  }
  const criticalAuditor =
    drilldown.criticalAuditor &&
    typeof drilldown.criticalAuditor === 'object' &&
    !Array.isArray(drilldown.criticalAuditor)
      ? { ...(drilldown.criticalAuditor as Record<string, unknown>) }
      : {};
  if (Object.keys(criticalAuditor).length > 0) {
    delete criticalAuditor.consecutiveNoNewGapRounds;
    delete criticalAuditor.latestReceiptHash;
    delete criticalAuditor.convergenceVerdict;
    drilldown.criticalAuditor = criticalAuditor;
  }
  if (Object.keys(drilldown).length > 0) {
    semantic.preConfirmationDrilldown = drilldown;
  }
  return semantic;
}

function currentSourceHashes(sourcePath: string): {
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
} {
  const text = readFileSync(sourcePath, 'utf8');
  const match = text.match(/^implementationConfirmation:\n[\s\S]*$/m);
  if (!match) {
    throw new Error(`implementationConfirmation block missing: ${sourcePath}`);
  }
  const parsed = yaml.load(match[0]) as { implementationConfirmation?: Record<string, unknown> };
  if (!parsed.implementationConfirmation) {
    throw new Error(`implementationConfirmation block invalid: ${sourcePath}`);
  }
  const semantic = semanticConfirmationForHash(parsed.implementationConfirmation);
  const normalizedBlock = `implementationConfirmation:${stableStringify(semantic)}`;
  return {
    sourceDocumentHash: sha256PrefixedText(text.replace(match[0], normalizedBlock)),
    implementationConfirmationHash: sha256Json(semantic),
  };
}

function byteLength(text: string): number {
  return Buffer.byteLength(text, 'utf8');
}

function lineCount(text: string): number {
  return text.split(/\r?\n/).length;
}

function sectionBetween(text: string, startHeading: string, nextHeading: string): string {
  const start = text.indexOf(startHeading);
  const end = text.indexOf(nextHeading, start + startHeading.length);
  expect(start, `${startHeading} must exist`).toBeGreaterThanOrEqual(0);
  expect(end, `${nextHeading} must exist after ${startHeading}`).toBeGreaterThan(start);
  return text.slice(start, end);
}

function writeRealFixtureToTempRoot(root: string, fixture: string): string {
  const sourcePath = path.join(root, 'docs/plans/multi-timeframe-display-settings.real.md');
  mkdirSync(path.dirname(sourcePath), { recursive: true });
  writeFileSync(sourcePath, fixture, 'utf8');
  return sourcePath;
}

function stringify(value: unknown): string {
  return JSON.stringify(value);
}

function expectTextContainsAll(value: unknown, tokens: string[]): void {
  const text = stringify(value);
  for (const token of tokens) {
    expect(text).toContain(token);
  }
}

function writePromotionReceiptForDraft(input: {
  root: string;
  sourcePath: string;
  recordId: string;
  requirementSetId: string;
}): string {
  const receiptPath = path.join(
    input.root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    input.recordId,
    'authoring',
    'promotion-receipt.json'
  );
  mkdirSync(path.dirname(receiptPath), { recursive: true });
  const hashes = currentSourceHashes(input.sourcePath);
  const targetHash = sha256PrefixedText(readFileSync(input.sourcePath, 'utf8'));
  const sourcePath = path.relative(input.root, input.sourcePath).replace(/\\/g, '/');
  const receipt: Record<string, unknown> = {
    ok: true,
    dryRun: false,
    preflightOnly: false,
    draftPath: `_bmad-output/runtime/requirement-records/${input.recordId}/authoring/draft-source-preview.md`,
    targetPath: sourcePath,
    promotionStage: 'authoring-draft',
    allowedStatuses: ['draft', 'draft_updated_not_confirmation_ready', 'reconfirm_required'],
    statusValue: 'draft',
    confirmationReady: false,
    safePromotionAsDraft: true,
    requiresUserConfirmationBeforeExecution: true,
    manifestPath: `_bmad-output/runtime/requirement-records/${input.recordId}/authoring/draft-manifest.json`,
    targetHash,
    writeReceipt: {
      schemaVersion: 'large-document-writer-safe-write/v1',
      targetPath: sourcePath,
      finalHash: targetHash,
      mode: 'replace',
    },
    backupPath: `_bmad-output/runtime/requirement-records/${input.recordId}/authoring/promotion-backup.md`,
    preflight: {
      manifest: {
        targetPath: sourcePath,
        draftHash: targetHash,
        statusValue: 'draft',
        recordId: input.recordId,
        requirementSetId: input.requirementSetId,
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
          sourceDocumentHashAfter: targetHash,
        },
      },
    },
    receiptPath: path.relative(input.root, receiptPath).replace(/\\/g, '/'),
    failureClass: null,
  };
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  return receiptPath;
}

function writeMultiTimeframeRepairResponse(requestPath: string, responsePath: string): void {
  const request = readJson<any>(requestPath);
  const projectionRefs = request.packetProjectionSummary?.projectionRefs ?? [];
  const actionBase = {
    sourceSpan: { startLine: 142, endLine: 149 },
    sourceText: '15m/30m/45m/D 默认隐藏，1m 是主时间轴且不属于叠加周期。',
    reason: 'Critical Auditor found a missing multi-timeframe business projection.',
    mustRefs: request.mustRefs?.length ? [request.mustRefs[0]] : ['MUST-001'],
    requirementIds: ['FR-3', 'DEFAULT-HIDDEN-PERIODS', 'NON-GOAL-1M'],
  };
  const response = {
    schemaVersion: 'critical-auditor-round-response/v1',
    requestHash: request.requestHash,
    recordId: request.recordId,
    roundIndex: request.roundIndex,
    sourceDocumentHash: request.sourceDocumentHash,
    implementationConfirmationHash: request.implementationConfirmationHash,
    packetHash: request.packetHash,
    gateDryRunHash: request.gateDryRun.gateDryRunHash,
    reconciliationIssueCount: request.gateDryRun.reconciliation.issueCount,
    checkedProjectionGroups: request.packetProjectionSummary?.projectionGroups ?? [],
    checkedProjectionQualityRuleCodes:
      request.requiredResponseSchema?.checkedProjectionQualityRuleCodes ??
      request.projectionQualityGate?.requiredRuleCodes ??
      PROJECTION_QUALITY_RULE_CODES,
    verdict: 'new_valid_gap',
    reviewedMustRefs: request.mustRefs,
    reviewedProjectionRefs: projectionRefs.length ? [projectionRefs[0]] : [],
    priorFindingsDisposition: [
      {
        findingRef: 'ROUND-1-MULTI-TIMEFRAME-GAP',
        disposition: 'new',
        evidenceRefs: [request.gateDryRun.reportPath],
      },
    ],
    gapCandidates: [{ id: 'GAP-MULTI-TIMEFRAME-BUSINESS-COVERAGE' }],
    validatedGaps: [
      {
        id: 'VALID-GAP-MULTI-TIMEFRAME-BUSINESS-COVERAGE',
        status: 'open',
        repairActions: [
          {
            actionId: 'REPAIR-MTF-ADD-MUST',
            type: 'add_must',
            targetField: 'implementationConfirmation.must',
            newValue: {
              id: 'MUST-MTF-DEFAULT-HIDDEN',
              text: '15m、30m、45m、D 默认隐藏，用户可在设置中按需启用。',
            },
            ...actionBase,
          },
          {
            actionId: 'REPAIR-MTF-ADD-OUT',
            type: 'add_out',
            targetField: 'implementationConfirmation.outOfScope',
            newValue: {
              id: 'OUT-MTF-1M',
              text: '1m 是主时间轴，不属于叠加周期，不能作为实现目标路径。',
            },
            ...actionBase,
          },
          {
            actionId: 'REPAIR-MTF-ADD-EVD',
            type: 'add_evidence',
            targetField: 'implementationConfirmation.evidence',
            newValue: {
              id: 'EVD-MTF-DEFAULT-HIDDEN',
              text: '默认隐藏周期 15m、30m、45m、D 必须由真实 fixture 来源行证明。',
            },
            ...actionBase,
          },
          {
            actionId: 'REPAIR-MTF-ADD-TRACE',
            type: 'add_trace',
            targetField: 'implementationConfirmation.traceRows',
            newValue: {
              id: 'TRACE-MTF-DEFAULT-HIDDEN',
              covers: ['MUST-MTF-DEFAULT-HIDDEN', 'OUT-MTF-1M'],
            },
            ...actionBase,
          },
          {
            actionId: 'REPAIR-MTF-ADD-ACC',
            type: 'add_acc',
            targetField: 'implementationConfirmation.acceptanceCriteria',
            newValue: {
              id: 'ACC-MTF-DEFAULT-HIDDEN',
              text: '默认进入多周期图表时 15m、30m、45m、D 不显示。',
            },
            ...actionBase,
          },
          {
            actionId: 'REPAIR-MTF-ADD-E2E',
            type: 'add_e2e',
            targetField: 'implementationConfirmation.e2eScenarios',
            newValue: {
              id: 'E2E-MTF-DEFAULT-HIDDEN',
              text: '用户打开图表、启用 15m、隐藏 15m、调整 30m 透明度的 UI 行为可追踪。',
            },
            ...actionBase,
          },
          {
            actionId: 'REPAIR-MTF-ADD-BUSINESS',
            type: 'add_business_view',
            targetField: 'implementationConfirmation.businessViews',
            newValue: {
              id: 'BUSINESS-VIEW-MTF-DEFAULT-HIDDEN',
              requirementId: 'DEFAULT-HIDDEN-PERIODS',
              title: 'Default hidden periods from real fixture',
              text: '15m、30m、45m、D 默认隐藏；1m 是主时间轴。',
            },
            ...actionBase,
          },
          {
            actionId: 'REPAIR-MTF-ADD-BUSINESS-VISUAL',
            type: 'add_business_visual',
            targetField: 'implementationConfirmation.flowViews',
            newValue: {
              id: 'FLOW-BUSINESS-MTF-DEFAULT-HIDDEN',
              title: 'Default hidden multi-timeframe business flow',
              visualKind: 'flow',
              scope: 'business',
              covers: ['MUST-MTF-DEFAULT-HIDDEN'],
              perMustRows: [
                {
                  mustRef: 'MUST-MTF-DEFAULT-HIDDEN',
                  traceRows: ['TRACE-MTF-DEFAULT-HIDDEN'],
                  evidenceRefs: ['EVD-MTF-DEFAULT-HIDDEN'],
                  acceptanceRefs: ['ACC-MTF-DEFAULT-HIDDEN', 'E2E-MTF-DEFAULT-HIDDEN'],
                  assertion:
                    'MUST-MTF-DEFAULT-HIDDEN has an independent business visual boundary for default hidden periods.',
                },
              ],
              mermaid:
                'flowchart TD\n  User[User opens chart] --> Hidden[15m 30m 45m D hidden by default]\n  Hidden --> Settings[User enables overlays intentionally]',
            },
            ...actionBase,
          },
        ],
      },
    ],
    rejectedGapCandidates: [],
    rationale: 'Multi-timeframe repair actions materialize business coverage.',
  };
  writeFileSync(responsePath, `${JSON.stringify(response, null, 2)}\n`, 'utf8');
}

describe('requirements contract sanitized real fixture coverage', () => {
  it('fails generic current-target rows and partial business visual coverage per business MUST', () => {
    const issues = collectProjectionQualityIssues({
      must: [
        {
          id: 'MUST-001',
          text: 'Business timeframe selector must preserve hidden period defaults.',
        },
        {
          id: 'MUST-002',
          text: 'Business timeframe selector must apply explicit visible period settings.',
        },
      ],
      traceRows: [
        { id: 'TRACE-001', covers: ['MUST-001'] },
        { id: 'TRACE-002', covers: ['MUST-002'] },
      ],
      requirementBoundary: {
        business: {
          requirementIds: ['MUST-001', 'MUST-002'],
        },
      },
      currentTargetMap: {
        currentSummary: [
          {
            id: 'CTM-001',
            requirementRefs: ['MUST-001', 'MUST-002'],
            current: 'source-derived current state for all requirements',
            target: 'generic target state for all requirements',
          },
        ],
      },
      businessVisuals: [
        {
          id: 'BUS-001',
          covers: ['MUST-001'],
          title: 'Hidden period default flow',
          mermaid: 'flowchart TD\nUser-->Settings\nSettings-->HiddenPeriods',
        },
      ],
    });
    const currentTargetIssue = issues.find(
      (issue) => issue.code === 'current_target_map_not_product_specific'
    );
    const visualIssue = issues.find(
      (issue) => issue.code === 'business_visual_generic_or_compressed'
    );

    expect(currentTargetIssue?.refs).toEqual(['currentTargetMap', 'MUST-001', 'MUST-002']);
    expect(visualIssue?.refs).toEqual(['businessVisuals', 'MUST-002']);
  });

  it('does not classify exact Source MUST payload as generic current-target boilerplate', () => {
    const sourceMustText =
      'Critical Auditor can inspect all source-derived MUST references before promotion.';
    const issues = collectProjectionQualityIssues({
      must: [
        {
          id: 'MUST-001',
          text: 'Preserve each authored MUST as an independently traceable product behavior.',
        },
        {
          id: 'MUST-002',
          text: sourceMustText,
        },
      ],
      traceRows: [
        { id: 'TRACE-001', covers: ['MUST-001'] },
        { id: 'TRACE-002', covers: ['MUST-002'] },
      ],
      requirementBoundary: {
        business: {
          requirementIds: ['MUST-001', 'MUST-002'],
        },
      },
      currentTargetMap: {
        diffRows: [
          {
            id: 'CT-MUST-001',
            requirementRefs: ['MUST-001'],
            derivedFromMustRef: 'MUST-001',
            currentState: 'Current product behavior remains independently traceable.',
            targetState:
              'Target product behavior preserves each authored MUST as an independently traceable product behavior.',
            targetFiles: ['src/product.ts'],
            traceRows: ['TRACE-001'],
          },
          {
            id: 'CT-MUST-002',
            requirementRefs: ['MUST-002'],
            derivedFromMustRef: 'MUST-002',
            currentState: 'Current auditor visibility is incomplete.',
            targetState: `Target product behavior: ${sourceMustText}`,
            targetFiles: ['src/auditor.ts'],
            traceRows: ['TRACE-002'],
          },
        ],
      },
    });

    expect(issues.find((issue) => issue.code === 'current_target_map_not_product_specific')).toBe(
      undefined
    );
  });

  it('projects currentTargetMap from explicit source current and target state sections', () => {
    const root = createJudgeReadyTempRoot('requirements-contract-source-state-sections-');
    try {
      const source = path.join(root, 'docs/requirements/widget-settings.md');
      mkdirSync(path.dirname(source), { recursive: true });
      writeFileSync(
        source,
        [
          '# Widget Settings Source',
          '',
          '## Source Current State',
          '',
          '- CURRENT-STATE-ANCHOR: The existing widget exposes all controls in one dense row.',
          '- CURRENT-LIMIT-ANCHOR: Operators cannot distinguish pending values from saved values.',
          '',
          '## Source Target State',
          '',
          '- TARGET-STATE-ANCHOR: The widget shows a compact status summary and opens a dedicated settings surface.',
          '- TARGET-MUST-ANCHOR: Apply, cancel, and reset semantics are explicit after every confirmed MUST is implemented.',
          '',
          'Implementation evidence from current code reading:',
          '',
          '- CURRENT-EVIDENCE-NOISE: Existing code still uses the dense row and must stay out of targetRows.',
          '- CURRENT-EVIDENCE-DETAIL: Existing reset handling is only source evidence, not a target state.',
          '',
          '## Default Visibility',
          '',
          '| Entry | Default Visible |',
          '| --- | --- |',
          '| Compact Summary | yes |',
          '| Advanced Panel | no |',
          '| Legacy Dense Row | no |',
          '',
          '## Noisy Governance Notes',
          '',
          '- NOISE-ANCHOR: target current must validation wording here is commentary only and must not drive the current/target map.',
          '',
          '## Functional Requirements',
          '',
          '| ID | Requirement | Source rationale | Acceptance link |',
          '| --- | --- | --- | --- |',
           '| FR-001 | The widget MUST show the compact status summary. | Operators need a clear current settings summary. | ACC-001 |',
           '| FR-002 | The widget MUST preserve cancel rollback semantics. | Operators need safe rollback before applying changes. | ACC-002 |',
           '',
           '## Negative Requirements And Not Done Conditions',
           '',
           '| ID | Not-done condition | Negative assertion | Blocks completion when | Failure refs | Evidence refs |',
           '| --- | --- | --- | --- | --- | --- |',
           '| NEG-001 | Reporting success without rollback safety is not complete. | The widget must not discard pending values on cancel. | Cancel mutates saved settings. | FAIL-001 | ACC-002 |',
           '',
           '## Out Of Scope',
           '',
           '| ID | Forbidden scope | Boundary assertion | Evidence |',
           '| --- | --- | --- | --- |',
           '| OUT-001 | Replacing the widget framework is outside this change. | Preserve the current widget framework. | ACC-001 |',
           '',
           '## Failure Matrix',
           '',
           '| ID | Failure condition | Required system behavior | Negative requirement refs | Evidence |',
           '| --- | --- | --- | --- | --- |',
           '| FAIL-001 | The compact summary cannot represent the saved widget settings. | Keep the prior summary visible and report a recoverable rendering failure. | none | ACC-001 |',
           '| FAIL-002 | Cancel would discard or persist the wrong pending values. | Restore the saved settings snapshot and keep the settings surface open for correction. | NEG-001 | ACC-002 |',
           '',
           '## Acceptance Evidence',
           '',
           '| ID | Evidence target | Covers | Required evidence | Oracle | Assertion source | Responsibility mapping |',
           '| --- | --- | --- | --- | --- | --- | --- |',
           '| ACC-001 | Compact status summary | MUST-FR-001 | npm run test -- settings-panel | Given saved settings, when the widget renders, then the compact summary reflects those settings. | CMD-001 TRACE-001; tests/widgets/settings-panel.test.ts | PATH-001 owns remediation. |',
           '| ACC-002 | Cancel rollback semantics | MUST-FR-002 NEG-001 | npm run test -- settings-panel | Given pending changes, when cancel is selected, then saved settings remain unchanged and pending values are restored. | CMD-002 TRACE-002; tests/widgets/settings-panel.test.ts | PATH-002 owns remediation. |',
           '',
           '## Test And Verification Paths',
           '',
           '| ID | Type | Covers | Command or evidence path | Completion rule | Per-MUST oracle | Assertion source | Responsibility mapping | Target files |',
           '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
           '| E2E-001 | e2e | MUST-FR-001 | npm run test -- settings-panel | Exit code 0. | Given saved settings, when the widget renders, then the compact summary reflects those settings. | ACC-001 CMD-001 TRACE-001 | PATH-001 owns remediation. | tests/widgets/settings-panel.test.ts src/widgets/settings-panel.ts |',
           '| E2E-002 | e2e | MUST-FR-002 | npm run test -- settings-panel | Exit code 0. | Given pending changes, when cancel is selected, then saved settings remain unchanged and pending values are restored. | ACC-002 CMD-002 TRACE-002 | PATH-002 owns remediation. | tests/widgets/settings-panel.test.ts src/widgets/settings-state.ts |',
           '| CMD-001 | delivery-evidence | MUST-FR-001 | npm run test -- settings-panel | Exit code 0. | Given saved settings, when the widget renders, then the compact summary reflects those settings. | ACC-001 TRACE-001 | PATH-001 owns remediation. | tests/widgets/settings-panel.test.ts src/widgets/settings-panel.ts |',
           '| CMD-002 | delivery-evidence | MUST-FR-002 | npm run test -- settings-panel | Exit code 0. | Given pending changes, when cancel is selected, then saved settings remain unchanged and pending values are restored. | ACC-002 TRACE-002 | PATH-002 owns remediation. | tests/widgets/settings-panel.test.ts src/widgets/settings-state.ts |',
           '| CMD-999 | contract-validation | source structure only; no MUST coverage | node scripts/lint-source.js --source docs/requirements/widget-settings.md | Source structure passes. | This command validates source structure only. | TRACE-001 TRACE-002 | Requirements owner owns remediation. | docs/requirements/widget-settings.md |',
           '',
           '## Trace Matrix Source',
           '',
           '| ID | Covers | Evidence refs | Acceptance refs | Contract validation command refs | Delivery evidence command refs | View refs | Artifact refs | Boundary refs | Per-MUST oracle | Per-MUST closure assertion | Responsibility mapping |',
           '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
           '| TRACE-001 | MUST-FR-001 | ACC-001 | ACC-001 E2E-001 | CMD-999 | CMD-001 | none | PATH-001 | OUT-001 | Given saved settings, when the widget renders, then the compact summary reflects those settings. | MUST-FR-001 closes only through ACC-001 and CMD-001. | PATH-001 owns implementation and rollback. |',
           '| TRACE-002 | MUST-FR-002 NEG-001 | ACC-002 | ACC-002 E2E-002 | CMD-999 | CMD-002 | none | PATH-002 | none | Given pending changes, when cancel is selected, then saved settings remain unchanged and pending values are restored. | MUST-FR-002 and NEG-001 close only through ACC-002 and CMD-002. | PATH-002 owns implementation and rollback. |',
           '',
           '## Implementation Path Map',
           '',
           '| ID | Repository path | Ownership | Required change | Requirement refs | Per-MUST oracle | Assertion source | Responsibility mapping |',
           '| --- | --- | --- | --- | --- | --- | --- | --- |',
           '| PATH-001 | `src/widgets/settings-panel.ts` | Widget presentation owner | Render the compact saved-settings summary. | FR-001 | Given saved settings, when the widget renders, then the compact summary reflects those settings. | ACC-001 CMD-001 TRACE-001 | Widget presentation owner owns implementation, rollback and remediation. |',
           '| PATH-002 | `src/widgets/settings-state.ts` | Widget state owner | Preserve cancel rollback semantics for pending values. | FR-002 | Given pending changes, when cancel is selected, then saved settings remain unchanged and pending values are restored. | ACC-002 CMD-002 TRACE-002 | Widget state owner owns implementation, rollback and remediation. |',
           '',
           '## Target Files',
          '',
          '- src/widgets/settings-panel.ts',
          '- src/widgets/settings-state.ts',
          '',
          '## Validation',
          '',
          '- npm run test -- settings-panel',
          '',
        ].join('\n'),
        'utf8'
      );

      const result = runMainAgentPreConfirmationDrilldown(root, {
        source,
        recordId: 'REQ-SOURCE-STATE-SECTIONS',
        requirementSetId: 'REQ-SOURCE-STATE-SECTIONS-SET',
        targetPath: ['src/widgets/settings-panel.ts'],
        requiredCommand: 'npm run test -- settings-panel',
      });
      expect(issueCodes(result)).toEqual(['critical_auditor_provider_mode_required']);
      const draft = readJson<{ implementationConfirmation: Record<string, unknown> }>(
        artifacts(root, 'REQ-SOURCE-STATE-SECTIONS', 'REQ-SOURCE-STATE-SECTIONS-SET')
          .draftImplementationConfirmation
      ).implementationConfirmation;
      const currentTargetMap = draft.currentTargetMap as Record<string, unknown>;
      const currentTargetMapText = stringify(currentTargetMap);
      const currentTargetMapWithDefaults = currentTargetMap as {
        diffRows?: Array<Record<string, unknown>>;
        targetSummary?: Array<Record<string, unknown>>;
        sourceDefaultVisibility?: {
          visible?: string[];
          hidden?: string[];
          rows?: Array<Record<string, unknown>>;
        };
      };
      const defaultVisibilityDiff = currentTargetMapWithDefaults.diffRows?.find(
        (row) => row.id === 'CT-DIFF-002'
      );

      expect(issueCodes(result)).toContain('critical_auditor_provider_mode_required');
      expect(currentTargetMap).toMatchObject({
        schemaVersion: 'current-target-map/v1',
        displayProfile: 'closed_loop_current_target_map',
        sourceStateProjection: {
          mode: 'source_current_target_sections',
        },
      });
      expect(defaultVisibilityDiff, 'CT-DIFF-002 must describe default visibility').toBeTruthy();
      expect(currentTargetMapWithDefaults.sourceDefaultVisibility?.visible).toEqual([
        'Compact Summary',
      ]);
      expect(currentTargetMapWithDefaults.sourceDefaultVisibility?.hidden).toEqual([
        'Advanced Panel',
        'Legacy Dense Row',
      ]);
      expect(currentTargetMapText).toContain('CURRENT-STATE-ANCHOR');
      expect(currentTargetMapText).toContain('CURRENT-LIMIT-ANCHOR');
      expect(currentTargetMapText).toContain('TARGET-STATE-ANCHOR');
      expect(currentTargetMapText).toContain('TARGET-MUST-ANCHOR');
      expect(currentTargetMapText).not.toContain('NOISE-ANCHOR');
      expect(currentTargetMapText).not.toContain('CURRENT-EVIDENCE-NOISE');
      expect(currentTargetMapText).not.toContain('CURRENT-EVIDENCE-DETAIL');
      const targetSummaryText = stringify(currentTargetMapWithDefaults.targetSummary);
      const defaultVisibilityTargetState = stringify(defaultVisibilityDiff?.targetState);
      expect(targetSummaryText).toContain('TARGET-STATE-ANCHOR');
      expect(targetSummaryText).toContain('TARGET-MUST-ANCHOR');
      expect(targetSummaryText).not.toContain('CURRENT-EVIDENCE-NOISE');
      expect(targetSummaryText).not.toContain('CURRENT-EVIDENCE-DETAIL');
      expect(defaultVisibilityTargetState).toContain('TARGET-STATE-ANCHOR');
      expect(defaultVisibilityTargetState).toContain('TARGET-MUST-ANCHOR');
      expect(defaultVisibilityTargetState).not.toContain('CURRENT-EVIDENCE-NOISE');
      expect(defaultVisibilityTargetState).not.toContain('CURRENT-EVIDENCE-DETAIL');
      const sourceProjection = currentTargetMap.sourceStateProjection as {
        currentRows?: Array<{ text?: string }>;
        targetRows?: Array<{ text?: string }>;
      };
      expect(sourceProjection.currentRows?.map((row) => row.text)).toEqual([
        'CURRENT-STATE-ANCHOR: The existing widget exposes all controls in one dense row.',
        'CURRENT-LIMIT-ANCHOR: Operators cannot distinguish pending values from saved values.',
      ]);
      expect(sourceProjection.targetRows?.map((row) => row.text)).toEqual([
        'TARGET-STATE-ANCHOR: The widget shows a compact status summary and opens a dedicated settings surface.',
        'TARGET-MUST-ANCHOR: Apply, cancel, and reset semantics are explicit after every confirmed MUST is implemented.',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  }, 60_000);

  it('records source provenance and sanitized fixture integrity', () => {
    const fixture = readUtf8(fixtureRelativePath);
    const metadata = JSON.parse(readUtf8(metadataRelativePath)) as {
      fixturePath: string;
      sourceClassification: string;
      sourceBackup: { bytes: number; lines: number; sha256: string };
      sourceProject: string;
      currentSource: { path: string; bytes: number; lines: number; sha256: string };
      sanitizedFixture: { bytes: number; lines: number; sha256: string };
      sanitization: { removedBlock: string; removedLineCount: number };
      externalConsumerProjectAccessed: boolean;
    };

    expect(metadata.fixturePath).toBe(fixtureRelativePath);
    expect(metadata.sourceClassification).toBe('sanitized-real-consumer-requirements');
    expect(metadata.sourceProject).toBe('REDACTED_CONSUMER_PROJECT');
    expect(metadata.sourceBackup).toMatchObject({
      bytes: 59946,
      lines: 1470,
      sha256: '4663d96263a67491b977e9555065d520ad720f5ffe00442b95eda69f9bd2d6e8',
    });
    expect(metadata.currentSource).toMatchObject({
      bytes: 53267,
      lines: 1384,
      sha256: '008846a38b07adf6113dc5d932ea1d51c75a9600bafc8d7d70edec3869cdcf40',
    });
    expect(metadata.sanitizedFixture).toMatchObject({
      bytes: 27762,
      lines: 541,
      sha256: '4e71bf5f1766f81bbd6f11b5052d3ae7f3c8ced7059606a23480998a579acc06',
    });
    expect(byteLength(fixture)).toBe(metadata.sanitizedFixture.bytes);
    expect(lineCount(fixture)).toBe(metadata.sanitizedFixture.lines);
    expect(sha256Text(fixture)).toBe(metadata.sanitizedFixture.sha256);
    expect(fixture).toContain('sourceBackupBytes: 59946');
    expect(fixture).toContain('sourceBackupLines: 1470');
    expect(fixture).toContain(`sourceBackupSha256: ${metadata.sourceBackup.sha256}`);
    expect(fixture).toContain('sourceProject: REDACTED_CONSUMER_PROJECT');
    expect(fixture).not.toMatch(/[A-Za-z]:[\\/]/);
    expect(stringify(metadata)).not.toMatch(/[A-Za-z]:[\\/]/);
    expect(metadata.sanitizedFixture.path).toBe(fixtureRelativePath);
    expect(metadata.currentSource.path).toBe(
      '<redacted-consumer-project>/docs/plans/multi_timeframe_display_settings_requirements.md'
    );
    expect(fixture).not.toMatch(/^implementationConfirmation:\s*$/m);
    expect(metadata.sanitization).toMatchObject({
      removedBlock: 'implementationConfirmation',
      removedLineCount: 1007,
    });
    expect(metadata.externalConsumerProjectAccessed).toBe(false);
  });

  it('clean-source multi-timeframe authoring materializes business coverage from the sanitized real fixture anchors', () => {
    const fixture = readUtf8(fixtureRelativePath);
    const metadata = JSON.parse(readUtf8(metadataRelativePath)) as {
      requiredBusinessAnchors: {
        frIds: string[];
        hiddenByDefaultPeriods: string[];
        outOfScopeTimeline: string;
        targetPaths: string[];
        testSuggestionAnchors: string[];
      };
    };

    expect(metadata.requiredBusinessAnchors.frIds).toEqual([
      'FR-1',
      'FR-2',
      'FR-3',
      'FR-4',
      'FR-5',
      'FR-6',
      'FR-7',
      'FR-8',
      'FR-9',
    ]);
    for (const frId of metadata.requiredBusinessAnchors.frIds) {
      expect(fixture).toMatch(new RegExp(`^### ${frId}(?:\\s|$)`, 'm'));
    }

    const defaultStrategy = sectionBetween(fixture, '## 7. 默认显示策略', '## 8. 信息架构');
    for (const period of metadata.requiredBusinessAnchors.hiddenByDefaultPeriods) {
      expect(defaultStrategy).toContain(`| ${period} | 否 |`);
    }

    const nonGoals = sectionBetween(fixture, '## 5. 非目标', '## 6. 用户与场景');
    expect(nonGoals).toContain(metadata.requiredBusinessAnchors.outOfScopeTimeline);
    expect(defaultStrategy).toContain(
      '`1m` 是主时间轴，不属于叠加周期，不在多周期显示设置中提供显示开关。'
    );

    for (const targetPath of metadata.requiredBusinessAnchors.targetPaths) {
      expect(fixture).toContain(targetPath);
    }
    for (const anchor of metadata.requiredBusinessAnchors.testSuggestionAnchors) {
      expect(fixture).toContain(anchor);
    }
    expect(fixture).not.toContain('tests/acceptance/main-agent');
    expect(fixture).not.toContain('node_modules/bmad-speckit-sdd-flow');
  });

  it('binds FR-1 through FR-9 acceptance to the generated contract from the sanitized real fixture', () => {
    const root = createJudgeReadyTempRoot('requirements-contract-real-business-');
    try {
      const fixture = readUtf8(fixtureRelativePath);
      const metadata = JSON.parse(readUtf8(metadataRelativePath)) as {
        requiredBusinessAnchors: {
          frIds: string[];
          hiddenByDefaultPeriods: string[];
          outOfScopeTimeline: string;
          targetPaths: string[];
        };
      };
      const source = writeRealFixtureToTempRoot(root, fixture);

      const result = runMainAgentPreConfirmationDrilldown(root, {
        source,
        recordId: 'REQ-REAL-BUSINESS-COVERAGE',
        requirementSetId: 'REQ-REAL-BUSINESS-COVERAGE-SET',
        targetPath: metadata.requiredBusinessAnchors.targetPaths,
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
      });
      const paths = artifacts(root, 'REQ-REAL-BUSINESS-COVERAGE', 'REQ-REAL-BUSINESS-COVERAGE-SET');
      const draft = readJson<{ implementationConfirmation: Record<string, unknown> }>(
        paths.draftImplementationConfirmation
      ).implementationConfirmation;
      const targetAuthority = readJson<{ accepted: Array<{ path: string }> }>(
        paths.targetAuthorityReport
      );

      expect(issueCodes(result)).toContain('critical_auditor_provider_mode_required');
      expect(result.sourceMutationPerformed).toBe(false);

      const mustRows = draft.must as Array<{
        id: string;
        text: string;
        sourcePath: string;
        sourceSpan: { startLine: number; endLine: number };
        headingPath: string[];
      }>;
      const businessRequirementIds =
        ((draft.requirementBoundary as any).business.requirementIds as string[]) ?? [];
      const businessViews = (draft.businessViews as Array<Record<string, unknown>>) ?? [];
      const expectedMustIds = metadata.requiredBusinessAnchors.frIds.map(
        (frId) => `MUST-FR-${frId.split('-')[1].padStart(3, '0')}`
      );

      expect(mustRows.map((row) => row.id)).toEqual(expectedMustIds);
      expect(new Set(mustRows.map((row) => row.id)).size).toBe(mustRows.length);
      expect(mustRows.every((row) => /^MUST-(?:FR|NFR)-[0-9]{3}$/u.test(row.id))).toBe(true);
      expect(mustRows.some((row) => /^MUST-.*-L[0-9]+-[0-9]+$/u.test(row.id))).toBe(false);
      expect(businessRequirementIds).toEqual(metadata.requiredBusinessAnchors.frIds);

      for (const frId of metadata.requiredBusinessAnchors.frIds) {
        expect(
          mustRows.some(
            (row) =>
              row.headingPath?.some((heading) => heading.includes(frId)) &&
              typeof row.sourcePath === 'string' &&
              row.sourcePath.endsWith('multi-timeframe-display-settings.real.md') &&
              typeof row.sourceSpan?.startLine === 'number' &&
              row.sourceSpan.startLine > 0
          ),
          `${frId} must be materialized from the sanitized real fixture`
        ).toBe(true);
        expect(businessRequirementIds).toContain(frId);
        expect(stringify(businessViews)).toContain(frId);
      }

      expect(businessRequirementIds.some((id) => id.startsWith('DEFAULT-'))).toBe(false);
      expect(businessRequirementIds.some((id) => id.startsWith('ACCEPTANCE-'))).toBe(false);
      expect(businessRequirementIds.some((id) => id.startsWith('NON-GOAL-'))).toBe(false);
      expect(businessRequirementIds.some((id) => id.startsWith('BUSINESS-'))).toBe(false);

      for (const period of metadata.requiredBusinessAnchors.hiddenByDefaultPeriods) {
        expectTextContainsAll(draft.must, [period]);
        expectTextContainsAll(draft.evidence, [period]);
        expectTextContainsAll(draft.traceRows, [period]);
        expectTextContainsAll(draft.acceptanceCriteria, [period]);
        expectTextContainsAll(draft.e2eScenarios, [period]);
      }

      const traceRows = (draft.traceRows as Array<Record<string, unknown>>) ?? [];
      const mustToAtomicTaskMap = draft.mustToAtomicTaskMap as Record<string, string[]>;
      const atomicTaskToTraceMap = draft.atomicTaskToTraceMap as Record<string, string[]>;
      const atomicTaskToAcceptanceMap = draft.atomicTaskToAcceptanceMap as Record<string, string[]>;
      const atomicTaskToEvidenceMap = draft.atomicTaskToEvidenceMap as Record<string, string[]>;
      const atomicTaskToTargetPathMap = draft.atomicTaskToTargetPathMap as Record<string, string[]>;
      const atomicTaskToCommandMap = draft.atomicTaskToCommandMap as Record<string, string[]>;
      const manifest = draft.aiTddContractExecutionManifestProjection as Record<string, any>;

      expect(traceRows.length).toBeGreaterThanOrEqual(mustRows.length);
      expect(
        traceRows.some(
          (row) => row.id === 'TRACE-001' && (row.covers as string[]).length === mustRows.length + 1
        )
      ).toBe(false);
      for (const must of mustRows) {
        const coveringRows = traceRows.filter((row) =>
          ((row.covers as string[]) ?? []).includes(must.id)
        );
        expect(
          coveringRows.length,
          `${must.id} requires an independent TRACE row`
        ).toBeGreaterThanOrEqual(1);
        expect(
          coveringRows.some((row) => ((row.covers as string[]) ?? []).length < mustRows.length)
        ).toBe(true);
        expect(
          mustToAtomicTaskMap[must.id]?.length,
          `${must.id} mustToAtomicTaskMap`
        ).toBeGreaterThan(0);
      }
      for (const trace of traceRows) {
        expect(
          (trace.failurePathRefs as string[])?.length,
          `${trace.id} failurePathRefs`
        ).toBeGreaterThan(0);
        expect(
          (trace.edgeCaseRefs as string[])?.length,
          `${trace.id} edgeCaseRefs`
        ).toBeGreaterThan(0);
      }
      for (const taskId of Object.values(mustToAtomicTaskMap).flat()) {
        expect(
          atomicTaskToTraceMap[taskId]?.length,
          `${taskId} atomicTaskToTraceMap`
        ).toBeGreaterThan(0);
        expect(
          atomicTaskToAcceptanceMap[taskId]?.length,
          `${taskId} atomicTaskToAcceptanceMap`
        ).toBeGreaterThan(0);
        expect(
          atomicTaskToEvidenceMap[taskId]?.length,
          `${taskId} atomicTaskToEvidenceMap`
        ).toBeGreaterThan(0);
        expect(
          atomicTaskToTargetPathMap[taskId]?.length,
          `${taskId} atomicTaskToTargetPathMap`
        ).toBeGreaterThan(0);
        expect(
          atomicTaskToCommandMap[taskId]?.length,
          `${taskId} atomicTaskToCommandMap`
        ).toBeGreaterThan(0);
      }
      for (const acceptanceRow of [
        ...((draft.acceptanceTests as Array<Record<string, unknown>>) ?? []),
        ...((draft.e2eSuites as Array<Record<string, unknown>>) ?? []),
      ]) {
        expect(
          String(acceptanceRow.redProofPlan ?? '').trim(),
          `${acceptanceRow.id} redProofPlan`
        ).not.toBe('');
      }
      expect(manifest.requiredSections).toEqual(
        expect.arrayContaining([
          'atomicImplementationTaskLineage',
          'finalGateMatrix',
          'executionLoopProtocol',
          'semanticGapPolicy',
          'hostExecutionHints',
          'commandTargetCollection',
          'traceClosureAssertions',
          'currentTargetMap',
          'targetModificationPathCoverage',
          'canonicalSurfaceReconciliation',
          'legacyDenial',
          'closeoutProof',
          'evidenceTrustStates',
        ])
      );
      expect(manifest.atomicImplementationTaskLineage.requiredMaps).toEqual(
        expect.arrayContaining([
          'mustToAtomicTaskMap',
          'atomicTaskToTraceMap',
          'atomicTaskToAcceptanceMap',
          'atomicTaskToEvidenceMap',
          'atomicTaskToTargetPathMap',
          'atomicTaskToCommandMap',
        ])
      );

      const outOfScopeRows = (draft.outOfScope as Array<Record<string, unknown>>) ?? [];
      expect(stringify(outOfScopeRows)).toContain(
        metadata.requiredBusinessAnchors.outOfScopeTimeline
      );
      expect(
        ((draft.targetModificationPaths as Array<{ path: string }>) ?? []).some((row) =>
          row.path.includes(metadata.requiredBusinessAnchors.outOfScopeTimeline)
        )
      ).toBe(false);

      for (const targetPath of metadata.requiredBusinessAnchors.targetPaths) {
        expect(targetAuthority.accepted.map((row) => row.path)).toContain(targetPath);
        expect(stringify(draft)).toContain(targetPath);
      }
      const currentTargetMapText = stringify(draft.currentTargetMap);
      const currentTargetMap = draft.currentTargetMap as Record<string, unknown>;
      expect(currentTargetMap).toMatchObject({
        schemaVersion: 'current-target-map/v1',
        displayProfile: 'closed_loop_current_target_map',
        sourceStateProjection: {
          mode: expect.stringMatching(
            /^(?:source_current_target_sections|heuristic_highlights_fallback)$/u
          ),
        },
      });
      expect(currentTargetMapText).toContain('source-authorized product code targets');
      expect(currentTargetMapText).toContain('MUST-FR-001');
      expect(currentTargetMapText).toContain('MUST-FR-009');
      expect(currentTargetMapText).not.toMatch(/(?:^|[^A-Z0-9-])MUST-\d{3}\b/u);
      expect(currentTargetMapText).not.toMatch(/\bMUST-.*-L[0-9]+-[0-9]+\b/u);
      expect(currentTargetMapText).not.toContain('reconfirm_required');
      expect(currentTargetMapText).not.toContain('req-trace');
      expect(currentTargetMapText).not.toContain('controlled confirm-scope ingest');
      expect(currentTargetMapText).not.toMatch(
        /source document hash|sourceDocumentHash|implementation readiness/iu
      );
      expect(currentTargetMapText).not.toMatch(/current-attempt product implementation evidence/iu);
      expect(currentTargetMapText).not.toMatch(
        /source describes behavior|source defines current behavior/iu
      );
      expect(currentTargetMapText).toContain(metadata.requiredBusinessAnchors.outOfScopeTimeline);
      for (const targetPath of metadata.requiredBusinessAnchors.targetPaths) {
        expect(currentTargetMapText).toContain(targetPath);
      }
      for (const period of metadata.requiredBusinessAnchors.hiddenByDefaultPeriods) {
        expect(currentTargetMapText).toContain(period);
      }
      expect(currentTargetMapText).not.toContain(
        'Pre-confirmation drilldown remains inside requirement_confirmation'
      );
      expect(currentTargetMapText).not.toContain('Draft requirement');
      expect(currentTargetMapText).not.toContain('User-confirmable requirement');
      expect(currentTargetMapText).not.toContain('requirement_confirmation draft');
      expect(currentTargetMapText).not.toContain('requirement_confirmation user_confirmable');
      expect(stringify(draft)).not.toContain('node_modules/bmad-speckit-sdd-flow');
      expect(stringify(draft)).not.toContain('tests/acceptance/main-agent');
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  });

  it('runs author-confirmation-ready-source end-to-end with checkpoint receipts, summary, promotion, and real fixture coverage', () => {
    const root = createJudgeReadyTempRoot('requirements-contract-real-e2e-');
    try {
      const fixture = readUtf8(fixtureRelativePath);
      const metadata = JSON.parse(readUtf8(metadataRelativePath)) as {
        requiredBusinessAnchors: {
          frIds: string[];
          hiddenByDefaultPeriods: string[];
          outOfScopeTimeline: string;
          targetPaths: string[];
        };
      };
      const recordId = 'REQ-REAL-BUSINESS-E2E';
      const requirementSetId = `${recordId}-SET`;
      const execution = createTestAuthoringExecutionOptions(recordId);
      const source = writeRealFixtureToTempRoot(root, fixture);
      let stderr = '';
      let result: ReturnType<typeof runMainAgentPreConfirmationDrilldown> | null = null;
      const originalStderrWrite = process.stderr.write;
      process.stderr.write = ((chunk: string | Uint8Array) => {
        stderr += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
        return true;
      }) as typeof process.stderr.write;
      try {
        result = runMainAgentPreConfirmationDrilldown(root, {
          source,
          recordId,
          requirementSetId,
          ...execution,
          targetPath: metadata.requiredBusinessAnchors.targetPaths,
          requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
          criticalAuditorRound: cleanCriticalAuditorRound,
        });
      } finally {
        process.stderr.write = originalStderrWrite;
      }

      const paths = artifacts(root, recordId, requirementSetId);
      const progress = readJson<Record<string, unknown>>(paths.progress);
      const evidence = readJson<Record<string, unknown>>(paths.checkpointPersistenceEvidence);
      const summary = evidence.checkpointPersistenceRef as Record<string, unknown>;
      const promotion = readJson<Record<string, unknown>>(paths.promotionReceipt);
      const confirmation = readImplementationConfirmation(source);
      const targetAuthority = readJson<{ accepted: Array<{ path: string }> }>(
        paths.targetAuthorityReport
      );

      expect(result?.sourceMutationPerformed).toBe(true);
      expect(result?.blockingIssues.map((issue) => issue.code)).not.toContain(
        'critical_auditor_provider_mode_required'
      );
      expect(result?.blockingIssues.map((issue) => issue.code)).not.toContain(
        'checkpoint_required_before_source_materialization'
      );
      expect(existsSync(paths.sourceMaterializationReceipt)).toBe(false);

      expect(progress.resumeLedger).toMatchObject({
        schemaVersion: 'requirements-contract-checkpoint-resume-ledger/v1',
        completedCheckpointIds: requiredCheckpointIds,
      });
      expect(progress.lastCompletedCheckpoint).toBe('cp-08-pre-render-global-reconciliation');
      expect(progress.currentCheckpoint).toBe(null);
      expect(progress.next).toBe(null);

      expect(evidence).toMatchObject({
        schemaVersion: 'semantic-checkpoint-persistence-evidence/v1',
        checkpointPersistenceSatisfiedCandidate: true,
      });
      expect(evidence).not.toHaveProperty('completedCheckpointIds');
      expect(summary.completedCheckpointIds).toEqual(requiredCheckpointIds);
      expect(summary.checkpointReceiptRefs).toHaveLength(requiredCheckpointIds.length);
      expect(String(summary.progressHash)).toMatch(/^sha256:/u);
      expect(String(summary.preRenderMustDecompositionGateHash)).toMatch(/^sha256:/u);
      expect(String(summary.preRenderGlobalConsistencyHash)).toMatch(/^sha256:/u);
      expect(String(summary.packetSourceReconciliationHash)).toMatch(/^sha256:/u);

      for (const [index, checkpointId] of requiredCheckpointIds.entries()) {
        const receiptPath = paths.checkpointReceiptPaths[index];
        expect(existsSync(receiptPath)).toBe(true);
        const receipt = readJson<Record<string, unknown>>(receiptPath);
        expect(receipt).toMatchObject({
          schemaVersion: 'requirements-contract-checkpoint-semantic-validation-receipt/v1',
          checkpointId,
          recordId,
          requirementSetId,
          implementationAttemptId: execution.implementationAttemptId,
          persistenceStatus: 'committed',
          semanticValidationStatus: 'pass',
          blockers: [],
          decision: 'pass',
        });
        expect(String(receipt.receiptHash)).toMatch(/^sha256:/u);
      }

      expect(promotion).toMatchObject({
        ok: true,
        promotionStage: 'authoring-draft',
        statusValue: 'draft',
        confirmationReady: false,
        safePromotionAsDraft: true,
        requiresUserConfirmationBeforeExecution: true,
      });
      expect((promotion.authoringPromotionGate as Record<string, unknown>).ok).toBe(true);
      expect(promotion.targetHash).toBe(sha256PrefixedText(readFileSync(source, 'utf8')));
      expect(stringify(promotion)).toContain('checkpointPersistence');

      const businessRequirementIds =
        ((confirmation.requirementBoundary as any).business.requirementIds as string[]) ?? [];
      const businessViews = (confirmation.businessViews as Array<Record<string, unknown>>) ?? [];
      const mustRows = confirmation.must as Array<{
        id: string;
        sourcePath?: string;
        sourceSpan?: { startLine: number };
        headingPath?: string[];
      }>;
      const expectedMustIds = metadata.requiredBusinessAnchors.frIds.map(
        (frId) => `MUST-FR-${frId.split('-')[1].padStart(3, '0')}`
      );
      expect(mustRows.map((row) => row.id)).toEqual(expectedMustIds);
      expect(new Set(mustRows.map((row) => row.id)).size).toBe(mustRows.length);
      expect(mustRows.every((row) => /^MUST-(?:FR|NFR)-[0-9]{3}$/u.test(row.id))).toBe(true);
      expect(mustRows.some((row) => /^MUST-.*-L[0-9]+-[0-9]+$/u.test(row.id))).toBe(false);
      expect(businessRequirementIds).toEqual(metadata.requiredBusinessAnchors.frIds);
      for (const frId of metadata.requiredBusinessAnchors.frIds) {
        expect(businessRequirementIds).toContain(frId);
        expect(stringify(businessViews)).toContain(frId);
        expect(
          mustRows.some(
            (row) =>
              row.headingPath?.some((heading) => heading.includes(frId)) &&
              row.sourcePath?.endsWith('multi-timeframe-display-settings.real.md') &&
              (row.sourceSpan?.startLine ?? 0) > 0
          ),
          `${frId} must stay source-span bound after promotion`
        ).toBe(true);
      }
      expect(businessRequirementIds.some((id) => id.startsWith('DEFAULT-'))).toBe(false);
      expect(businessRequirementIds.some((id) => id.startsWith('ACCEPTANCE-'))).toBe(false);
      expect(businessRequirementIds.some((id) => id.startsWith('NON-GOAL-'))).toBe(false);
      expect(businessRequirementIds.some((id) => id.startsWith('BUSINESS-'))).toBe(false);

      for (const period of metadata.requiredBusinessAnchors.hiddenByDefaultPeriods) {
        expectTextContainsAll(confirmation.must, [period]);
        expectTextContainsAll(confirmation.evidence, [period]);
        expectTextContainsAll(confirmation.traceRows, [period]);
        expectTextContainsAll(confirmation.acceptanceCriteria, [period]);
        expectTextContainsAll(confirmation.e2eScenarios, [period]);
      }

      expect(stringify(confirmation.outOfScope)).toContain(
        metadata.requiredBusinessAnchors.outOfScopeTimeline
      );
      expect(
        ((confirmation.targetModificationPaths as Array<{ path: string }>) ?? []).some((row) =>
          row.path.includes(metadata.requiredBusinessAnchors.outOfScopeTimeline)
        )
      ).toBe(false);

      for (const targetPath of metadata.requiredBusinessAnchors.targetPaths) {
        expect(targetAuthority.accepted.map((row) => row.path)).toContain(targetPath);
        expect(stringify(confirmation)).toContain(targetPath);
      }
      expect(stringify(confirmation.requiredCommands)).toContain(
        'pytest tests/test_multi_timeframe_settings.py'
      );
      expect(stringify(confirmation)).not.toContain('node_modules/bmad-speckit-sdd-flow');
      expect(stringify(confirmation)).not.toContain('tests/acceptance/main-agent');
      expect(stderr).toContain('[requirements-contract-authoring] checkpoint trace start');
      for (const checkpointId of requiredCheckpointIds) {
        expect(stderr).toContain(`checkpoint phase=start id=${checkpointId}`);
        expect(stderr).toContain(`checkpoint phase=result id=${checkpointId} result=passed`);
      }
      expect(stderr).toContain('checkpoint-persistence summary');
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  });

  it('authoring-repair materializes multi-timeframe Critical Auditor repair actions', () => {
    const root = createJudgeReadyTempRoot('requirements-contract-real-repair-');
    try {
      const fixture = readUtf8(fixtureRelativePath);
      const metadata = JSON.parse(readUtf8(metadataRelativePath)) as {
        externalConsumerProjectAccessed: boolean;
        sourceBackup: { bytes: number; lines: number; sha256: string };
        sanitizedFixture: { bytes: number; lines: number; sha256: string };
        requiredBusinessAnchors: {
          hiddenByDefaultPeriods: string[];
          outOfScopeTimeline: string;
          targetPaths: string[];
        };
      };
      const recordId = 'REQ-REAL-BUSINESS-REPAIR';
      const requirementSetId = `${recordId}-SET`;
      const execution = createTestAuthoringExecutionOptions(recordId);
      const source = writeRealFixtureToTempRoot(root, fixture);

      const authoring = runMainAgentPreConfirmationDrilldown(root, {
        source,
        recordId,
        requirementSetId,
        ...execution,
        targetPath: metadata.requiredBusinessAnchors.targetPaths,
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
      });
      expect(authoring.blockingStage, stringify(authoring.blockingIssues)).toBe(
        'critical_auditor_provider_mode_required'
      );
      const authoringPaths = artifacts(root, recordId, requirementSetId);
      const draftPreview = readFileSync(authoringPaths.draftSourcePreview, 'utf8');
      writeFileSync(source, draftPreview, 'utf8');
      writePromotionReceiptForDraft({
        root,
        sourcePath: source,
        recordId,
        requirementSetId,
      });

      const firstRepair = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId,
        implementationAttemptId: execution.implementationAttemptId,
        mode: 'preserve-existing',
      });
      expect(firstRepair.blockingStage, stringify(firstRepair.blockingIssues)).toBe(
        'critical_auditor_round_required'
      );
      const requestPath = path.join(
        root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        recordId,
        'authoring',
        'critical-auditor-round-request-1.json'
      );
      const responsePath = path.join(
        root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        recordId,
        'authoring',
        'critical-auditor-round-response-1.json'
      );
      const beforeRequest = readJson<any>(requestPath);
      writeMultiTimeframeRepairResponse(requestPath, responsePath);

      const repaired = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId,
        implementationAttemptId: execution.implementationAttemptId,
        mode: 'preserve-existing',
        criticalAuditorResponse: responsePath,
      });
      expect(repaired.blockingStage).toBe('critical_auditor_round_required');
      expect(repaired.consecutiveNoNewGapRounds).toBe(0);
      const sourceText = readFileSync(source, 'utf8');
      const repairedConfirmation = readImplementationConfirmation(source);
      const repairedMustRows = repairedConfirmation.must as Array<Record<string, unknown>>;
      const repairedMust = repairedMustRows.find(
        (row) => row.id === 'MUST-MTF-DEFAULT-HIDDEN'
      );
      const canonicalMust = repairedMustRows.find((row) => row.source === 'canonical_semantic_ir');
      expect(sourceText).toContain('MUST-MTF-DEFAULT-HIDDEN');
      expect(repairedMust).toMatchObject({
        source: 'critical_auditor_validated_gap',
        sourcePath: canonicalMust?.sourcePath,
        sourceDocumentHash: canonicalMust?.sourceDocumentHash,
        sourceRequirementId: 'FR-3',
        sourceSpan: {
          startLine: 142,
          endLine: 149,
        },
      });
      expect(sourceText).toContain('OUT-MTF-1M');
      expect(sourceText).toContain('boundaryType: non_goal_scope_boundary');
      expect(sourceText).toContain('conflictResolution: out_of_scope_boundary_only');
      expect(sourceText).toContain('EVD-MTF-DEFAULT-HIDDEN');
      expect(sourceText).toContain('TRACE-MTF-DEFAULT-HIDDEN');
      expect(sourceText).toContain('ACC-MTF-DEFAULT-HIDDEN');
      expect(sourceText).toContain('E2E-MTF-DEFAULT-HIDDEN');
      expect(sourceText).toContain('BUSINESS-VIEW-MTF-DEFAULT-HIDDEN');
      expect(sourceText).toContain('sourceGapFixes');
      for (const period of metadata.requiredBusinessAnchors.hiddenByDefaultPeriods) {
        expect(sourceText).toContain(period);
      }
      expect(sourceText).toContain(metadata.requiredBusinessAnchors.outOfScopeTimeline);
      for (const targetPath of metadata.requiredBusinessAnchors.targetPaths) {
        expect(sourceText).toContain(targetPath);
      }
      expect(sourceText).not.toContain('node_modules/bmad-speckit-sdd-flow');
      expect(sourceText).not.toContain('tests/acceptance/main-agent');

      const afterRequest = readJson<any>(requestPath);
      const rebuiltPacket = readJson<any>(
        path.join(authoringPaths.authoring, 'must_decomposition_packet.json')
      ).must_decomposition_packet;
      expect(afterRequest.roundIndex).toBe(1);
      expect(afterRequest.packetHash).toBe(rebuiltPacket.packetHash);
      expect(afterRequest.packetHash).not.toBe(beforeRequest.packetHash);
      expect(afterRequest.previousReceipts).toEqual([]);
      expect(repaired.artifacts.some((artifact: string) => artifact.includes('/archive/'))).toBe(
        true
      );
      expect(metadata.externalConsumerProjectAccessed).toBe(false);
      expect(metadata.sourceBackup).toMatchObject({
        bytes: 59946,
        lines: 1470,
        sha256: '4663d96263a67491b977e9555065d520ad720f5ffe00442b95eda69f9bd2d6e8',
      });
      expect(metadata.sanitizedFixture).toMatchObject({
        bytes: 27762,
        lines: 541,
        sha256: '4e71bf5f1766f81bbd6f11b5052d3ae7f3c8ced7059606a23480998a579acc06',
      });
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  }, 60_000);
});
