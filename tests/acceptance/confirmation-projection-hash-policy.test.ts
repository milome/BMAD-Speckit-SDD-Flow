import { execFileSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import yaml from 'js-yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveArchitectureConfirmationHashRecipe } from '../../scripts/architecture-confirmation-hash-recipe';
import { mainImplementationReadinessGate } from '../../scripts/main-agent-implementation-readiness-gate';

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

function semanticConfirmationForHash(confirmation: Record<string, unknown>): Record<string, unknown> {
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

function writeSource(): string {
  const source = path.join(tempDir, 'source.md');
  fs.writeFileSync(
    source,
    `# Confirmation Projection Policy

implementationConfirmation:
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
  confirmationProfile: implementation_confirmation
  requiredViewPacks: []
  optionalViewPacks: []
  must:
    - id: MUST-050
      text: "Only semantic source or implementation hash drift can require demand reconfirmation."
      evidenceRefs: ["EVD-049"]
    - id: MUST-051
      text: "Only architecture or recipe hash drift can require architecture reconfirmation."
      evidenceRefs: ["EVD-050"]
    - id: MUST-052
      text: "Projection hash refresh must not mutate semantic confirmation authority."
      evidenceRefs: ["EVD-051"]
  notDone:
    - id: NEG-039
      text: "Confirmation page hash drift alone must not mark reconfirm_required."
      evidenceRefs: ["EVD-049"]
    - id: NEG-040
      text: "Projection refresh must not weaken source, implementation, architecture, or recipe hard stops."
      evidenceRefs: ["EVD-050"]
  mustNot:
    - id: OUT-001
      text: "Projection refresh is not a closeout decision."
  evidence:
    - id: EVD-049
      text: "Projection hash drift fixture."
      gate: "npx vitest run tests/acceptance/confirmation-projection-hash-policy.test.ts"
      oracle: "projection refresh does not mutate semantic confirmation authority"
    - id: EVD-050
      text: "Runtime authority hash boundary fixture."
      gate: "npx vitest run tests/acceptance/confirmation-projection-hash-policy.test.ts"
      oracle: "semantic and architecture hash drift remain hard stops"
    - id: EVD-051
      text: "Controlled projection refresh ingest fixture."
      gate: "npx vitest run tests/acceptance/confirmation-projection-hash-policy.test.ts"
      oracle: "projection event writes projection ledger only"
  openQuestions: []
  traceRows:
    - id: TRACE-039
      covers: ["MUST-050", "MUST-051", "MUST-052", "NEG-039", "NEG-040", "OUT-001"]
      taskRefs: ["TASK-CONFIRMATION-PROJECTION-HASH-POLICY"]
      evidenceRefs: ["EVD-049", "EVD-050", "EVD-051"]
      contractValidationCommandRefs: ["CMD-RENDER-CONFIRMATION"]
      deliveryEvidenceCommandRefs: ["CMD-CONFIRMATION-PROJECTION-HASH-POLICY"]
      status: PENDING
`,
    'utf8'
  );
  return source;
}

function writeRenderReport(source: string, pageHash: string, suffix = ''): {
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
  const report = {
    recordId: 'REQ-PROJECTION-POLICY',
    requirementSetId: 'REQ-PROJECTION-POLICY',
    confirmability: 'confirmable',
    sourceDocumentHash: hashes.sourceDocumentHash,
    sourceDocumentHashScope: 'semantic_source_excluding_confirmation_bookkeeping',
    implementationConfirmationHash: hashes.implementationConfirmationHash,
    implementationConfirmationHashScope:
      'semantic_implementation_confirmation_excluding_bookkeeping',
    confirmationPageHash: pageHash,
    actualReportHash: sha256(`report:${pageHash}:${suffix}`),
    outPath: htmlPath,
    artifactRef: {
      artifactType: 'confirmation_view',
      sourceOfTruthRole: 'projection',
      path: htmlPath,
      hash: pageHash,
    },
  };
  const confirmText = [
    '确认以上范围进入下一阶段',
    `sourceDocumentHash=${hashes.sourceDocumentHash}`,
    `implementationConfirmationHash=${hashes.implementationConfirmationHash}`,
    `confirmationPageHash=${pageHash}`,
  ].join('\n');
  const confirmTextPath = path.join(confirmationDir, `confirm${suffix}.txt`);
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

function runNode(script: string, args: string[]): { stdout: string; stderr: string; status: number } {
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
    const stdout = execFileSync('python', [
      REQ_TRACE_PROMPT,
      '--source-document',
      source,
      '--requirement-record',
      requirementRecord,
    ], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
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
    path.join(tempDir, '_bmad-output/runtime/requirement-records/REQ-PROJECTION-POLICY/data/mentor-events.jsonl'),
    '--artifact-index',
    path.join(tempDir, '_bmad-output/runtime/requirement-records/REQ-PROJECTION-POLICY/artifact-index.jsonl'),
    '--confirmed-at',
    '2026-05-20T00:00:00.000Z',
    '--json',
  ]);
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

    const projectionRefresh = ingestConfirmation(source, refreshed.reportPath, first.confirmTextPath);
    expect(projectionRefresh.status, `${projectionRefresh.stdout}\n${projectionRefresh.stderr}`).toBe(0);
    const refreshedRecord = JSON.parse(fs.readFileSync(recordPath(), 'utf8'));

    expect(fs.readFileSync(source, 'utf8')).toBe(afterSemanticConfirmationSource);
    expect(refreshedRecord.status).toBe('user_confirmed');
    expect(refreshedRecord.confirmationHistory).toEqual(beforeProjectionWithArchitecture.confirmationHistory);
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
      event: null,
      sourceUpdated: false,
      projectionEvent: {
        eventType: 'confirmation_projection_refreshed',
      },
    });

    const readiness = mainImplementationReadinessGate([
      '--requirement-record',
      recordPath(),
      '--evaluated-at',
      '2026-05-20T00:01:00.000Z',
      '--json',
    ]);
    expect(readiness).toBe(0);
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
      fs.readFileSync(source, 'utf8').replace(
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
