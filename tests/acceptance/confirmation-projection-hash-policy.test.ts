import { execFileSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import yaml from 'js-yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveArchitectureConfirmationHashRecipe } from '../../scripts/architecture-confirmation-hash-recipe';
import { mainImplementationReadinessGate } from '../../scripts/main-agent-implementation-readiness-gate';
import { runMainAgentConfirmationDriftRoute } from '../../scripts/main-agent-orchestration';

const ROOT = process.cwd();
const INGEST = path.join(
  ROOT,
  '_bmad',
  'skills',
  'requirements-contract-authoring',
  'scripts',
  'ingest-confirmation-event.js'
);
const REQ_TRACE_PROMPT = path.join(
  ROOT,
  '_bmad',
  'skills',
  'req-trace-matrix-prompt-generator',
  'scripts',
  'generate_prompt.py'
);
const OLD_PAGE_HASH = 'sha256:3333333333333333333333333333333333333333333333333333333333333333';
const NEW_PAGE_HASH = 'sha256:4444444444444444444444444444444444444444444444444444444444444444';
const ARCH_HASH = 'sha256:5555555555555555555555555555555555555555555555555555555555555555';

let tempDir: string;

const BOOKKEEPING_FIELDS = new Set([
  'status',
  'confirmedAt',
  'confirmedBy',
  'sourceDocumentHash',
  'implementationConfirmationHash',
  'reconfirmationRequest',
  'confirmationRender',
]);

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'confirmation-projection-policy-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function sha256(content: string): string {
  return `sha256:${crypto.createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function semanticConfirmationForHash(
  confirmation: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(confirmation).filter(([key]) => !BOOKKEEPING_FIELDS.has(key))
  );
}

function extractConfirmation(sourceText: string): {
  blockText: string;
  confirmation: Record<string, unknown>;
} {
  const lines = sourceText.replace(/\r\n/gu, '\n').split('\n');
  const start = lines.findIndex((line) => /^implementationConfirmation:\s*$/u.test(line));
  if (start < 0) throw new Error('missing implementationConfirmation');
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === '') continue;
    if (/^\S/u.test(line)) {
      end = index;
      break;
    }
  }
  const blockText = lines.slice(start, end).join('\n');
  const parsed = yaml.load(blockText) as { implementationConfirmation?: Record<string, unknown> };
  if (!parsed?.implementationConfirmation) throw new Error('invalid implementationConfirmation');
  return { blockText, confirmation: parsed.implementationConfirmation };
}

function currentHashes(sourcePath: string): {
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
} {
  const sourceText = fs.readFileSync(sourcePath, 'utf8');
  const { blockText, confirmation } = extractConfirmation(sourceText);
  const semantic = semanticConfirmationForHash(confirmation);
  return {
    sourceDocumentHash: sha256(
      sourceText.replace(blockText, `implementationConfirmation:${stableStringify(semantic)}`)
    ),
    implementationConfirmationHash: sha256(stableStringify(semantic)),
  };
}

function writeText(filePath: string, value: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

function portablePath(filePath: string): string {
  return filePath.replace(/\\/gu, '/');
}

function writeSource(): string {
  const source = path.join(tempDir, 'source.md');
  const acceptancePath = path.join(
    tempDir,
    'tests',
    'acceptance',
    'confirmation-projection-hash-policy.test.ts'
  );
  const e2ePath = path.join(tempDir, 'tests', 'e2e', 'confirmation-projection-policy.e2e.test.ts');
  writeText(
    acceptancePath,
    'import { it } from "vitest"; it("projection policy red fixture", () => {});\n'
  );
  writeText(
    e2ePath,
    'import { it } from "vitest"; it("projection policy e2e red fixture", () => {});\n'
  );
  writeText(
    source,
    `# Confirmation Projection Policy

Must Not Count As Completion: page hash refresh, stdout-only proof, HTTP 200, page render, and mock calls cannot satisfy implementation readiness.

implementationConfirmation:
  contractSchemaVersion: 1
  status: draft
  recordId: REQ-PROJECTION-POLICY
  requirementSetId: REQ-PROJECTION-POLICY
  entryFlow: standalone_tasks
  entryFlowClass: task_packet_entry
  workflowAdapter: direct
  contractAuthoringRequired: true
  confirmationLanguage: zh-CN
  confirmedAt: null
  confirmedBy: null
  sourceDocumentHash: null
  implementationConfirmationHash: null
  confirmationProfile: implementation_confirmation
  requiredViewPacks: ["currentTargetMap"]
  optionalViewPacks: []
  confirmationRender:
    htmlPath: null
    summaryPath: null
    reportPath: null
    htmlHash: null
    confirmationPhrase: null
  applicability:
    currentTargetMap:
      applies: true
      reasonCode: projection_policy_requires_visible_current_target_map
    aiTddContractGate:
      applies: true
      reasonCode: projection_policy_requires_ai_tdd_readiness_gate
  must:
    - id: MUST-050
      text: "Only semantic source or implementation hash drift can require demand reconfirmation."
      evidenceRefs: ["EVD-049"]
      coveredByTraceRows: ["TRACE-039"]
    - id: MUST-051
      text: "Only architecture or recipe hash drift can require architecture reconfirmation."
      evidenceRefs: ["EVD-050"]
      coveredByTraceRows: ["TRACE-039"]
    - id: MUST-052
      text: "Projection hash refresh must not mutate semantic confirmation authority."
      evidenceRefs: ["EVD-051"]
      coveredByTraceRows: ["TRACE-039"]
  notDone:
    - id: NEG-039
      text: "Confirmation page hash drift alone must not mark reconfirm_required."
      evidenceRefs: ["EVD-049"]
      coveredByTraceRows: ["TRACE-039"]
      oracle: "projection hash drift alone remains a projection refresh"
    - id: NEG-040
      text: "Projection refresh must not weaken source, implementation, architecture, or recipe hard stops."
      evidenceRefs: ["EVD-050"]
      coveredByTraceRows: ["TRACE-039"]
      oracle: "semantic and architecture drift remain hard stops"
  mustNot:
    - id: OUT-001
      text: "Projection refresh is not a closeout decision."
  evidence:
    - id: EVD-049
      text: "Projection hash drift fixture."
      gate: "npx vitest run tests/acceptance/confirmation-projection-hash-policy.test.ts"
      oracle: "projection refresh does not mutate semantic confirmation authority"
      requiredCommandRefs: ["CMD-CONFIRMATION-PROJECTION-HASH-POLICY"]
      artifactRefs: ["CANONICAL-001"]
    - id: EVD-050
      text: "Runtime authority hash boundary fixture."
      gate: "npx vitest run tests/acceptance/confirmation-projection-hash-policy.test.ts"
      oracle: "semantic and architecture hash drift remain hard stops"
      requiredCommandRefs: ["CMD-CONFIRMATION-PROJECTION-HASH-POLICY"]
      artifactRefs: ["CANONICAL-001"]
    - id: EVD-051
      text: "Controlled projection refresh ingest fixture."
      gate: "npx vitest run tests/acceptance/confirmation-projection-hash-policy.test.ts"
      oracle: "projection event writes projection ledger only"
      requiredCommandRefs: ["CMD-CONFIRMATION-PROJECTION-HASH-POLICY"]
      artifactRefs: ["CANONICAL-001"]
  openQuestions: []
  failurePaths:
    - id: FAIL-039
      title: "Projection refresh weakens semantic authority"
      trigger: "Only confirmationPageHash changes after a confirmed source."
      expectedBehavior: "Record a projection refresh without changing user confirmed semantic scope."
      forbiddenBehavior: "Mark reconfirm_required or mutate implementationConfirmation semantics."
      blocksCompletionWhenViolated: true
      linkedNegIds: ["NEG-039", "NEG-040"]
      linkedEvidenceIds: ["EVD-049", "EVD-050", "EVD-051"]
      viewRefs: ["EDGEVIEW-039"]
      requiredAssertions: ["Projection-only refresh cannot satisfy closeout."]
  edgeCases:
    - id: EDGE-039
      category: projection_hash_only_drift
      condition: "The refreshed confirmation page hash differs while semantic hashes match."
      expectedBehavior: "Keep status user_confirmed and append confirmationProjectionHistory."
      forbiddenBehavior: "Demand semantic reconfirmation or architecture reconfirmation."
      linkedFailurePathIds: ["FAIL-039"]
      linkedEvidenceIds: ["EVD-049", "EVD-050", "EVD-051"]
  traceRows:
    - id: TRACE-039
      covers: ["MUST-050", "MUST-051", "MUST-052", "NEG-039", "NEG-040"]
      taskRefs: ["TASK-CONFIRMATION-PROJECTION-HASH-POLICY"]
      evidenceRefs: ["EVD-049", "EVD-050", "EVD-051"]
      boundaryViewRefs: ["BOUNDARY-001"]
      contractValidationCommandRefs: ["CMD-RENDER-CONFIRMATION"]
      deliveryEvidenceCommandRefs: ["CMD-CONFIRMATION-PROJECTION-HASH-POLICY"]
      acceptanceRefs: ["ACC-039", "E2E-039"]
      artifactRefs: ["CANONICAL-001"]
      status: PENDING
  requiredCommands:
    - id: CMD-RENDER-CONFIRMATION
      commandRef:
        skill: requirements-contract-authoring
        script: scripts/render-requirements-confirmation-html.ts
      command: "node <skill-dir>/scripts/render-requirements-confirmation-html.ts --source source.md"
      purpose: "Render and validate the confirmation projection."
      oracle: "renderer emits current confirmation projection without mutating semantic authority"
      traceRows: ["TRACE-039"]
      evidenceRefs: ["EVD-049"]
    - id: CMD-CONFIRMATION-PROJECTION-HASH-POLICY
      command: "npx vitest run tests/acceptance/confirmation-projection-hash-policy.test.ts"
      purpose: "Validate projection hash policy behavior."
      oracle: "projection hash refresh preserves semantic and architecture hard stops"
      traceRows: ["TRACE-039"]
      evidenceRefs: ["EVD-049", "EVD-050", "EVD-051"]
  acceptanceTests:
    - id: ACC-039
      file: "tests/acceptance/confirmation-projection-hash-policy.test.ts"
      covers: ["MUST-050", "MUST-051", "MUST-052"]
      failurePathRefs: ["FAIL-039"]
      edgeCaseRefs: ["EDGE-039"]
      traceRows: ["TRACE-039"]
      evidenceRefs: ["EVD-049", "EVD-051"]
      commandRefs: ["CMD-CONFIRMATION-PROJECTION-HASH-POLICY"]
      expectedPreImplementationState: expected_red
      oracle: "Projection refresh does not mutate source authority."
  e2eSuites:
    - id: E2E-039
      file: "tests/e2e/confirmation-projection-policy.e2e.test.ts"
      covers: ["NEG-039", "NEG-040"]
      failurePathRefs: ["FAIL-039"]
      edgeCaseRefs: ["EDGE-039"]
      traceRows: ["TRACE-039"]
      evidenceRefs: ["EVD-049", "EVD-050"]
      commandRefs: ["CMD-CONFIRMATION-PROJECTION-HASH-POLICY"]
      negativeControls: ["NEG-039", "NEG-040"]
      expectedPreImplementationState: expected_red
      oracle: "Projection refresh does not bypass semantic or architecture hard stops."
  sequenceViews:
    - id: SEQ-039
      title: "Projection refresh sequence"
      covers: ["MUST-050", "MUST-052", "NEG-039"]
  flowViews:
    - id: FLOW-039
      title: "Projection refresh flow"
      covers: ["MUST-050", "MUST-051", "MUST-052"]
  edgeCaseViews:
    - id: EDGEVIEW-039
      title: "Projection-only drift edge case"
      covers: ["NEG-039", "NEG-040"]
      cases: ["EDGE-039", "FAIL-039"]
  artifactAutomationPlan:
    - id: CANONICAL-001
      artifactType: code
      path: tests/acceptance/confirmation-projection-hash-policy.test.ts
      producer: confirmation-projection-policy-test
      sourceOfTruthRole: implementation
      traceRows: ["TRACE-039"]
      evidenceRefs: ["EVD-049", "EVD-050", "EVD-051"]
  currentTargetMap:
    schemaVersion: current-target-map/v1
    displayProfile: closed_loop_current_target_map
    currentSummary:
      - id: CUR-039
        text: "Confirmation projection can drift independently from semantic scope."
        traceRows: ["TRACE-039"]
        evidenceRefs: ["EVD-049"]
    targetSummary:
      - id: TAR-039
        text: "Projection refresh records read-model drift while semantic and architecture hashes remain authoritative."
        traceRows: ["TRACE-039"]
        evidenceRefs: ["EVD-049", "EVD-050"]
    diffRows:
      - id: DIFF-039
        current: "Projection hash changed."
        target: "Only confirmationProjectionHistory changes when semantic hashes match."
        traceRows: ["TRACE-039"]
        evidenceRefs: ["EVD-049", "EVD-051"]
    process:
      - id: PROC-039
        from: "confirmation render report"
        to: "controlled projection ledger"
        action: "ingest projection refresh without source mutation"
        traceRows: ["TRACE-039"]
        evidenceRefs: ["EVD-051"]
    artifactPaths:
      - id: PATH-039
        path: tests/acceptance/confirmation-projection-hash-policy.test.ts
        traceRows: ["TRACE-039"]
        evidenceRefs: ["EVD-049"]
    canonicalArtifacts:
      - id: CANONICAL-001
        targetPathOrField: tests/acceptance/confirmation-projection-hash-policy.test.ts
        traceRows: ["TRACE-039"]
        evidenceRefs: ["EVD-049", "EVD-050", "EVD-051"]
    existingArtifacts:
      - id: LEGACY-039
        currentPath: confirmationPageHash-only-green
        completionProofPolicy: legacy_only
        traceRows: ["TRACE-039"]
        evidenceRefs: ["EVD-049"]
  targetModificationPaths:
    - id: TARGET-MOD-039
      path: tests/acceptance/confirmation-projection-hash-policy.test.ts
      traceRows: ["TRACE-039"]
      evidenceRefs: ["EVD-049", "EVD-050", "EVD-051"]
  closeoutReadinessPreview:
    requiredCommands: ["CMD-RENDER-CONFIRMATION", "CMD-CONFIRMATION-PROJECTION-HASH-POLICY"]
    orphanPolicy: "No orphan projection proof may satisfy readiness."
    currentAttemptPolicy: "Current attempt proof is required after implementation."
    recordClosedPolicy: "Projection refresh is never a closeout decision."
  boundaryViews:
    - id: BOUNDARY-001
      title: "Projection refresh boundary"
      covers: ["OUT-001"]

## Reverse Audit Report

Verdict: PASS

### implementationConfirmation Findings
### HTML Confirmation Findings
### Reconfirmation Findings
### ID Reference Findings
### Diagram And Step Findings
### Artifact Automation Plan Findings
### traceRows Findings
### Row Quality Findings
### E2E Anti-Smoke Findings
### Open Findings

## Definition of Done

- Projection hash-only drift is recorded as projection refresh, not semantic reconfirmation.
`
  );
  return source;
}

function writeRenderReport(
  source: string,
  pageHash: string,
  suffix = '',
  expectedHtmlHash = pageHash
): {
  reportPath: string;
  report: Record<string, unknown>;
  confirmTextPath: string;
  confirmText: string;
} {
  const confirmationDir = path.join(
    tempDir,
    '_bmad-output',
    'runtime',
    'requirement-records',
    'REQ-PROJECTION-POLICY',
    'confirmation'
  );
  fs.mkdirSync(confirmationDir, { recursive: true });
  const hashes = currentHashes(source);
  const reportPath = path.join(confirmationDir, `confirmation-render-report${suffix}.json`);
  const htmlPath = path.join(confirmationDir, `confirmation${suffix}.html`);
  const drilldownReportPath = path.join(
    tempDir,
    '_bmad-output',
    'runtime',
    'requirement-records',
    'REQ-PROJECTION-POLICY',
    'authoring',
    `pre-render-must-decomposition-gate-report${suffix}.json`
  );
  fs.mkdirSync(path.dirname(drilldownReportPath), { recursive: true });
  fs.writeFileSync(
    htmlPath,
    '<!doctype html><title>confirmation projection policy</title>\n',
    'utf8'
  );
  const confirmText = [
    '确认以上范围进入下一阶段',
    `sourceDocumentHash=${hashes.sourceDocumentHash}`,
    `implementationConfirmationHash=${hashes.implementationConfirmationHash}`,
    `confirmationPageHash=${pageHash}`,
  ].join('\n');
  const report = {
    recordId: 'REQ-PROJECTION-POLICY',
    requirementSetId: 'REQ-PROJECTION-POLICY',
    sourcePath: portablePath(source),
    confirmability: 'confirmable',
    sourceDocumentHash: hashes.sourceDocumentHash,
    sourceDocumentHashScope: 'semantic_source_excluding_confirmation_bookkeeping',
    implementationConfirmationHash: hashes.implementationConfirmationHash,
    implementationConfirmationHashScope:
      'semantic_implementation_confirmation_excluding_bookkeeping',
    confirmationPageHash: pageHash,
    actualHtmlFileHash: expectedHtmlHash,
    generatedAt: '2026-05-20T00:00:00.000Z',
    language: 'zh-CN',
    deliveryReadiness: { ready: false, status: 'delivery_not_ready_before_implementation' },
    blockingIssues: [],
    warnings: [],
    diagramCoverage: {},
    traceCoverage: {},
    artifactAutomationCoverage: {},
    confirmInstruction: confirmText,
    renderedSections: ['pre-confirmation-semantic-drilldown'],
    preConfirmationSemanticDrilldown: {
      reportPath: portablePath(drilldownReportPath),
    },
    actualReportHash: sha256(`report:${pageHash}:${suffix}`),
    outPath: htmlPath,
    artifactRef: {
      artifactType: 'confirmation_view',
      sourceOfTruthRole: 'projection',
      path: portablePath(htmlPath),
      hash: pageHash,
    },
  };
  const confirmTextPath = path.join(confirmationDir, `confirm${suffix}.txt`);
  fs.writeFileSync(
    drilldownReportPath,
    `${JSON.stringify(
      {
        schemaVersion: 'pre-render-must-decomposition-gate/v1',
        verdict: 'PASS',
        confirmability: 'confirmable',
        sourceDocumentHash: hashes.sourceDocumentHash,
        implementationConfirmationHash: hashes.implementationConfirmationHash,
        failedChecks: [],
        blockingIssues: [],
        criticalAuditor: {
          minimumRounds: 3,
          consecutiveNoNewGapRounds: 3,
          convergenceVerdict: 'bounded_no_new_gap',
        },
        packetSourceReconciliation: {
          verdict: 'pass',
        },
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(confirmTextPath, confirmText, 'utf8');
  return { reportPath, report, confirmTextPath, confirmText };
}

function recordPath(): string {
  return path.join(
    tempDir,
    '_bmad-output',
    'runtime',
    'requirement-records',
    'REQ-PROJECTION-POLICY',
    'requirement-record.json'
  );
}

function runNode(
  script: string,
  args: string[]
): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execFileSync(process.execPath, [script, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', status: 0 };
  } catch (error: any) {
    return {
      stdout: String(error.stdout ?? ''),
      stderr: String(error.stderr ?? ''),
      status: error.status ?? 1,
    };
  }
}

function runPrompt(source: string, requirementRecord: string): { stdout: string; status: number } {
  try {
    const stdout = execFileSync(
      'python',
      [REQ_TRACE_PROMPT, '--source-document', source, '--requirement-record', requirementRecord],
      {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    return { stdout, status: 0 };
  } catch (error: any) {
    return { stdout: String(error.stdout ?? ''), status: error.status ?? 1 };
  }
}

function addActiveArchitectureState(requirementRecord: string): Record<string, unknown> {
  const recipe = resolveArchitectureConfirmationHashRecipe();
  const record = JSON.parse(fs.readFileSync(requirementRecord, 'utf8'));
  const architectureState = {
    status: 'active',
    currentArchitectureConfirmationRunId: 'arch-run-001',
    currentArchitectureConfirmationHash: ARCH_HASH,
    resolvedRecipeHash: recipe.resolvedRecipeHash,
    staleInputs: {
      sourceDocumentHash: record.sourceDocumentHash,
      implementationConfirmationHash: record.implementationConfirmationHash,
      currentArtifactHash: ARCH_HASH,
      resolvedRecipeHash: recipe.resolvedRecipeHash,
    },
  };
  record.architectureConfirmationState = architectureState;
  record.architectureConfirmationStateChecks = [
    {
      eventType: 'architecture_confirmation_state_checked',
      checkId: 'architecture-state:fixture',
      decision: 'pass',
      resolvedRecipeHash: recipe.resolvedRecipeHash,
      stateTransition: {
        fromStatus: 'active',
        toStatus: 'active',
        reasonCode: 'hash_match',
        previousHashes: architectureState.staleInputs,
        currentHashes: architectureState.staleInputs,
        mismatchFields: [],
        recipeVersion: recipe.recipeVersion,
      },
    },
  ];
  record.contractSummary = { openQuestions: [] };
  record.aiTddContractGate = {
    preImplementationRedProofs: [
      {
        proofId: 'projection-policy-proof-acc',
        acceptanceId: 'ACC-039',
        commandId: 'CMD-CONFIRMATION-PROJECTION-HASH-POLICY',
        state: 'expected_red',
        oracle: 'projection refresh cannot mutate semantic authority',
        failureClass: 'oracle_failure',
        recordedAt: '2026-05-20T00:00:30.000Z',
        recordedBy: 'test-agent',
      },
      {
        proofId: 'projection-policy-proof-e2e',
        acceptanceId: 'E2E-039',
        commandId: 'CMD-CONFIRMATION-PROJECTION-HASH-POLICY',
        state: 'expected_red',
        oracle: 'projection refresh cannot bypass semantic or architecture hard stops',
        failureClass: 'oracle_failure',
        recordedAt: '2026-05-20T00:00:31.000Z',
        recordedBy: 'test-agent',
      },
    ],
  };
  fs.writeFileSync(requirementRecord, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  return JSON.parse(JSON.stringify(architectureState));
}

function ingestConfirmation(source: string, reportPath: string, confirmTextPath: string) {
  return runNode(INGEST, [
    '--source',
    source,
    '--render-report',
    reportPath,
    '--confirmation-text-file',
    confirmTextPath,
    '--confirmed-by',
    'test-user',
    '--record-id',
    'REQ-PROJECTION-POLICY',
    '--requirement-record',
    recordPath(),
    '--event-log',
    path.join(
      tempDir,
      '_bmad-output/runtime/requirement-records/REQ-PROJECTION-POLICY/data/mentor-events.jsonl'
    ),
    '--artifact-index',
    path.join(
      tempDir,
      '_bmad-output/runtime/requirement-records/REQ-PROJECTION-POLICY/artifact-index.jsonl'
    ),
    '--confirmed-at',
    '2026-05-20T00:00:00.000Z',
    '--json',
  ]);
}

function routeConfirmationDriftWithMainAgent(source: string, renderReport?: string) {
  const result = runMainAgentConfirmationDriftRoute(ROOT, {
    source,
    requirementRecord: recordPath(),
    ...(renderReport ? { renderReport } : {}),
    eventLog: path.join(
      tempDir,
      '_bmad-output/runtime/requirement-records/REQ-PROJECTION-POLICY/data/mentor-events.jsonl'
    ),
    artifactIndex: path.join(
      tempDir,
      '_bmad-output/runtime/requirement-records/REQ-PROJECTION-POLICY/artifact-index.jsonl'
    ),
    confirmedBy: 'main-agent-orchestration',
  });
  return {
    stdout: JSON.stringify(result, null, 2),
    stderr: result.stderr ?? '',
    status: result.ok ? 0 : result.exitCode,
  };
}

describe('confirmation projection hash policy', () => {
  it('records confirmationPageHash-only drift as projection refresh without semantic mutation or readiness block', () => {
    const source = writeSource();
    const first = writeRenderReport(source, OLD_PAGE_HASH);
    const initialIngest = ingestConfirmation(source, first.reportPath, first.confirmTextPath);
    expect(initialIngest.status, `${initialIngest.stdout}\n${initialIngest.stderr}`).toBe(0);
    const afterSemanticConfirmationSource = fs.readFileSync(source, 'utf8');
    const beforeProjectionRecord = JSON.parse(fs.readFileSync(recordPath(), 'utf8'));
    const architectureState = addActiveArchitectureState(recordPath());
    const beforeProjectionWithArchitecture = JSON.parse(fs.readFileSync(recordPath(), 'utf8'));
    const refreshed = writeRenderReport(source, NEW_PAGE_HASH, '-refreshed');

    const projectionRefresh = routeConfirmationDriftWithMainAgent(source, refreshed.reportPath);
    expect(
      projectionRefresh.status,
      `${projectionRefresh.stdout}\n${projectionRefresh.stderr}`
    ).toBe(0);
    const refreshedRecord = JSON.parse(fs.readFileSync(recordPath(), 'utf8'));

    expect(fs.readFileSync(source, 'utf8')).toBe(afterSemanticConfirmationSource);
    expect(refreshedRecord.status).toBe('user_confirmed');
    expect(refreshedRecord.confirmationHistory).toEqual(
      beforeProjectionWithArchitecture.confirmationHistory
    );
    expect(refreshedRecord.confirmationHistory).toEqual(beforeProjectionRecord.confirmationHistory);
    expect(refreshedRecord.confirmationProjectionHistory.at(-1)).toMatchObject({
      eventType: 'confirmation_projection_refreshed',
      oldProjectionHash: OLD_PAGE_HASH,
      newProjectionHash: NEW_PAGE_HASH,
      sourceDocumentHash: first.report.sourceDocumentHash,
      implementationConfirmationHash: first.report.implementationConfirmationHash,
    });
    expect(refreshedRecord.architectureConfirmationState).toEqual(architectureState);
    expect(refreshedRecord.reconfirmationRequest ?? null).toBeNull();
    expect(JSON.parse(projectionRefresh.stdout)).toMatchObject({
      ok: true,
      action: 'route-confirmation-drift',
      route: 'projection_refresh',
      classification: {
        kind: 'projection_refresh_required',
        requiresUserReconfirmation: false,
      },
      delegatedResult: {
        stdout: {
          event: null,
          sourceUpdated: false,
          projectionEvent: {
            eventType: 'confirmation_projection_refreshed',
          },
        },
      },
    });

    const sourceSkill = path.join(ROOT, '_bmad', 'skills', 'requirements-contract-authoring');
    const targetSkill = path.join(tempDir, '.cursor', 'skills', 'requirements-contract-authoring');
    fs.mkdirSync(path.dirname(targetSkill), { recursive: true });
    fs.cpSync(sourceSkill, targetSkill, { recursive: true });
    fs.cpSync(path.join(ROOT, '_bmad', '_config'), path.join(tempDir, '_bmad', '_config'), {
      recursive: true,
    });
    expect(
      fs.existsSync(
        path.join(tempDir, 'tests', 'acceptance', 'confirmation-projection-hash-policy.test.ts')
      )
    ).toBe(true);
    const previousCwd = process.cwd();
    let readiness = 1;
    try {
      process.chdir(tempDir);
      readiness = mainImplementationReadinessGate([
        '--requirement-record',
        recordPath(),
        '--evaluated-at',
        '2026-05-20T00:01:00.000Z',
        '--json',
      ]);
    } finally {
      process.chdir(previousCwd);
    }
    const readinessRecord = JSON.parse(fs.readFileSync(recordPath(), 'utf8'));
    const fixtureTestPath = path.join(
      tempDir,
      'tests',
      'acceptance',
      'confirmation-projection-hash-policy.test.ts'
    );
    const fixtureE2ePath = path.join(
      tempDir,
      'tests',
      'e2e',
      'confirmation-projection-policy.e2e.test.ts'
    );
    const readinessReportPath = path.join(
      tempDir,
      '_bmad-output',
      'runtime',
      'requirement-records',
      'REQ-PROJECTION-POLICY',
      'implementation-readiness-report.json'
    );
    const readinessReport = JSON.parse(fs.readFileSync(readinessReportPath, 'utf8'));
    expect(
      readiness,
      JSON.stringify(
        {
          gateCheck: readinessRecord.gateChecks?.at(-1),
          aiTddCheck: readinessReport.checks.find(
            (check: Record<string, unknown>) =>
              check.id === 'ai-tdd-contract-gate-pre-implementation'
          ),
          fixtureExistsAfterGate: {
            acceptance: fs.existsSync(fixtureTestPath),
            e2e: fs.existsSync(fixtureE2ePath),
            acceptancePath: fixtureTestPath,
            e2ePath: fixtureE2ePath,
          },
          redGreenMatrix: readinessReport.checks.find(
            (check: Record<string, unknown>) =>
              check.id === 'ai-tdd-contract-gate-pre-implementation'
          )?.redGreenMatrix,
        },
        null,
        2
      )
    ).toBe(0);
    expect(
      readinessReport.checks.find(
        (check: Record<string, unknown>) => check.id === 'ai-tdd-contract-gate-pre-implementation'
      ),
      JSON.stringify(readinessReport, null, 2)
    ).toMatchObject({ passed: true });
    const stageAuditCheck = readinessRecord.gateChecks
      .at(-1)
      .checks.find(
        (check: Record<string, unknown>) => check.id === 'implementation-readiness-stage-audit'
      );
    expect(portablePath(String(stageAuditCheck.scriptPath))).toContain(
      '.cursor/skills/requirements-contract-authoring/scripts/audit_implementation_readiness.js'
    );
    const prompt = runPrompt(source, recordPath());
    expect(prompt.status).toBe(0);
    expect(prompt.stdout).toContain('TRACE-039');
  });

  it('keeps source and implementation semantic hash drift as demand reconfirmation hard stops', () => {
    const source = writeSource();
    const first = writeRenderReport(source, OLD_PAGE_HASH);
    expect(ingestConfirmation(source, first.reportPath, first.confirmTextPath).status).toBe(0);
    fs.writeFileSync(
      source,
      fs
        .readFileSync(source, 'utf8')
        .replace(
          'Only semantic source or implementation hash drift can require demand reconfirmation.',
          'Changed semantic requirement text requires demand reconfirmation.'
        ),
      'utf8'
    );

    const prompt = runPrompt(source, recordPath());
    expect(prompt.status).toBe(3);
    expect(prompt.stdout).toContain('BLOCK: CONFIRMATION_RECORD_HASH_MISMATCH');
    expect(prompt.stdout).toContain('sourceDocumentHash');
    expect(prompt.stdout).toContain('implementationConfirmationHash');
  });

  it('repairs stale source reconfirmation bookkeeping through the main agent without semantic reconfirmation', () => {
    const source = writeSource();
    const first = writeRenderReport(source, OLD_PAGE_HASH);
    expect(ingestConfirmation(source, first.reportPath, first.confirmTextPath).status).toBe(0);
    const sourceBeforeStalePatch = fs.readFileSync(source, 'utf8');
    const staleSource = sourceBeforeStalePatch
      .replace('status: user_confirmed', 'status: reconfirm_required')
      .replace(
        'reconfirmationRequest: null',
        `reconfirmationRequest:
    required: true
    reason: false_positive_bookkeeping_drift
    previousSourceDocumentHash: ${first.report.sourceDocumentHash}
    currentSourceDocumentHash: ${first.report.sourceDocumentHash}
    previousImplementationConfirmationHash: ${first.report.implementationConfirmationHash}
    currentImplementationConfirmationHash: ${first.report.implementationConfirmationHash}
    diffSummary: []
    impactedIds: ["MUST-039"]
    allowedUserActions: ["confirm_current_version"]`
      );
    fs.writeFileSync(source, staleSource, 'utf8');
    const beforeRecord = JSON.parse(fs.readFileSync(recordPath(), 'utf8'));
    const confirmationCount = beforeRecord.confirmationHistory.filter(
      (event: Record<string, unknown>) => event.eventType === 'confirmation_recorded'
    ).length;

    const repair = routeConfirmationDriftWithMainAgent(source);

    expect(repair.status, `${repair.stdout}\n${repair.stderr}`).toBe(0);
    const repairPayload = JSON.parse(repair.stdout);
    expect(repairPayload).toMatchObject({
      ok: true,
      action: 'route-confirmation-drift',
      route: 'bookkeeping_repair',
      classification: {
        kind: 'stale_bookkeeping_repair_required',
        requiresUserReconfirmation: false,
      },
      delegatedResult: {
        action: 'repair-confirmation-bookkeeping',
        stdout: {
          repairEvent: {
            eventType: 'confirmation_bookkeeping_repaired',
            classifier: {
              kind: 'stale_bookkeeping_repair_required',
              requiresUserReconfirmation: false,
            },
          },
          internalSteps: [
            {
              label: 'controlled_confirmation_bookkeeping_repair',
              status: 0,
              eventType: 'confirmation_bookkeeping_repaired',
            },
          ],
        },
      },
    });
    const repairedSource = fs.readFileSync(source, 'utf8');
    expect(repairedSource).toContain('status: user_confirmed');
    expect(repairedSource).toContain('reconfirmationRequest: null');
    expect(repairedSource).toContain(`htmlHash: ${OLD_PAGE_HASH}`);
    const repairedRecord = JSON.parse(fs.readFileSync(recordPath(), 'utf8'));
    expect(
      repairedRecord.confirmationHistory.filter(
        (event: Record<string, unknown>) => event.eventType === 'confirmation_recorded'
      ).length
    ).toBe(confirmationCount);
    expect(repairedRecord.bookkeepingRepairHistory.at(-1)).toMatchObject({
      eventType: 'confirmation_bookkeeping_repaired',
      classifier: {
        kind: 'stale_bookkeeping_repair_required',
      },
    });
    const prompt = runPrompt(source, recordPath());
    expect(prompt.status).toBe(0);
    expect(prompt.stdout).toContain('TRACE-039');
  });

  it('routes true semantic drift to confirmation-required blocker without repair', () => {
    const source = writeSource();
    const first = writeRenderReport(source, OLD_PAGE_HASH);
    expect(ingestConfirmation(source, first.reportPath, first.confirmTextPath).status).toBe(0);
    const beforeRecord = fs.readFileSync(recordPath(), 'utf8');
    const beforeSource = fs.readFileSync(source, 'utf8');
    fs.writeFileSync(
      source,
      beforeSource.replace(
        'Only semantic source or implementation hash drift can require demand reconfirmation.',
        'Semantic scope changes must require demand reconfirmation before implementation.'
      ),
      'utf8'
    );

    const route = routeConfirmationDriftWithMainAgent(source);

    expect(route.status, `${route.stdout}\n${route.stderr}`).toBe(3);
    expect(JSON.parse(route.stdout)).toMatchObject({
      ok: false,
      action: 'route-confirmation-drift',
      route: 'semantic_reconfirmation_required',
      block: 'CONFIRMATION_REQUIRED',
      nextRequiredAction: 'author_reconfirmation_evidence_and_render_confirmation_page',
      classification: {
        kind: 'semantic_reconfirmation_required',
        requiresUserReconfirmation: true,
      },
    });
    expect(fs.readFileSync(recordPath(), 'utf8')).toBe(beforeRecord);
  });

  it('keeps architecture and recipe drift as architecture readiness hard stops', () => {
    const source = writeSource();
    const first = writeRenderReport(source, OLD_PAGE_HASH);
    expect(ingestConfirmation(source, first.reportPath, first.confirmTextPath).status).toBe(0);
    addActiveArchitectureState(recordPath());
    const record = JSON.parse(fs.readFileSync(recordPath(), 'utf8'));
    record.architectureConfirmationState.currentArchitectureConfirmationHash =
      'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    record.architectureConfirmationState.resolvedRecipeHash =
      'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    fs.writeFileSync(recordPath(), `${JSON.stringify(record, null, 2)}\n`, 'utf8');

    const readiness = mainImplementationReadinessGate([
      '--requirement-record',
      recordPath(),
      '--evaluated-at',
      '2026-05-20T00:02:00.000Z',
      '--json',
    ]);
    expect(readiness).toBe(1);
    const blocked = JSON.parse(fs.readFileSync(recordPath(), 'utf8'));
    expect(blocked.gateChecks.at(-1)).toMatchObject({
      gate: 'Implementation Readiness Gate',
      decision: 'blocked',
    });
    expect(blocked.gateChecks.at(-1).blockingReasons).toContain(
      'architecture_confirmation_resolved_recipe_hash_not_current'
    );
  });
});
