import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  runMainAgentPreConfirmationDrilldown,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';

const goldenFixturePath = path.join(
  process.cwd(),
  'packages',
  'bmad-speckit',
  'src',
  'main-agent',
  'source-authority',
  'tests',
  'fixtures',
  'source-prd',
  'golden-source-prd.md'
);

function readJson(filePath: string): any {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function authoringDir(root: string, recordId: string): string {
  return path.join(root, '_bmad-output', 'runtime', 'requirement-records', recordId, 'authoring');
}

function writeSourcePrdFixture(root: string, name: string): string {
  const source = path.join(root, 'docs', 'requirements', name);
  mkdirSync(path.dirname(source), { recursive: true });
  writeFileSync(source, readFileSync(goldenFixturePath, 'utf8'), 'utf8');
  return source;
}

function writeSessionRequirements(root: string): string {
  const source = path.join(root, 'docs', 'requirements', 'session-intake.md');
  mkdirSync(path.dirname(source), { recursive: true });
  writeFileSync(
    source,
    [
      '# Session Requirements',
      '',
      '## Functional Requirements',
      '',
      '| ID | Requirement | Source rationale | Acceptance link |',
      '| --- | --- | --- | --- |',
      '| FR-001 | The authoring flow must produce a staging draft from a session requirement before materializing source. | Session entry must stay staging-first. | ACC-001 |',
      '',
    ].join('\n'),
    'utf8'
  );
  return source;
}

function cleanCriticalAuditorRound(input: any) {
  return {
    verdict: 'no_new_gap',
    transactionId: input.transactionId,
    namespaceVersion: input.namespaceVersion,
    requestHash: input.requestHash,
    sourceHash: input.sourceHash,
    packetHash: input.packetHash,
    gapCandidates: [],
    validatedGaps: [],
    rejectedGapCandidates: [],
    mutationPressureFindings: [],
    overBroadTaskFindings: [],
    missingProjectionFindings: [],
    invalidProofFindings: [],
    legacyBypassFindings: [],
    sourceMaterializationFindings: [],
    reviewedMustRefs: input.mustRefs,
    reviewedProjectionRefs: input.mustRefs,
    gateDryRunHash: input.gateDryRunHash,
    reconciliationIssueCount: 0,
    checkedProjectionGroups: [
      'must',
      'notDone',
      'mustNot',
      'evidence',
      'traceRows',
      'acceptanceTests',
      'requiredCommands',
      'targetModificationPaths',
      'currentTargetMap',
      'businessViews',
    ],
    checkedProjectionQualityRuleCodes:
      input.gateDryRun?.projectionQualityGate?.requiredRuleCodes ?? [],
    rationale: 'No new valid source PRD lint gaps.',
  };
}

describe('source PRD authoring entry-source lint gate', () => {
  it.each([
    ['bmad_prd', 'bmad-output.md'],
    ['source_prd_draft', 'user-source-prd.md'],
  ] as const)('runs the shared instance lint before staging for %s entries', (entrySource, name) => {
    const root = mkdtempSync(path.join(os.tmpdir(), `source-prd-entry-${entrySource}-`));
    try {
      const source = writeSourcePrdFixture(root, name);
      const recordId = `REQ-SOURCE-PRD-${entrySource.toUpperCase().replace(/_/gu, '-')}`;

      const result = runMainAgentPreConfirmationDrilldown(root, {
        source,
        entrySource,
        recordId,
        requirementSetId: `${recordId}-SET`,
        targetPath: 'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts',
        requiredCommand: 'npx vitest run tests/acceptance/source-prd-authoring-entry-source-lint.test.ts',
        criticalAuditorRound: cleanCriticalAuditorRound,
      });

      const dir = authoringDir(root, recordId);
      const report = readJson(path.join(dir, 'source-prd-instance-lint-report.json'));
      const transaction = readJson(path.join(dir, 'authoring-transaction.json'));

      expect(result.entrySource).toBe(entrySource);
      expect(result.sourcePrdInstanceLintReportPath).toBe(
        `_bmad-output/runtime/requirement-records/${recordId}/authoring/source-prd-instance-lint-report.json`
      );
      expect(report).toMatchObject({
        stage: 'pre_staging_source',
        entrySource,
        ok: true,
        status: 'source_prd_draft_ready',
        sourcePrdDraftReady: true,
      });
      expect(report.readyStateBoundary).toMatchObject({
        sourcePrdDraftReadyIsNotConfirmationReady: true,
        sourcePrdDraftReadyIsNotImplementationReady: true,
        sourcePrdDraftReadyIsNotDeliveryReady: true,
      });
      expect(transaction.sourcePrdEntrySource).toBe(entrySource);
      expect(existsSync(path.join(dir, 'staging'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('runs lint after initial session draft generation and keeps failed lint in staging repair', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'source-prd-entry-session-'));
    try {
      const intake = writeSessionRequirements(root);
      const target = path.join(root, 'docs', 'requirements', 'session-source-prd.md');
      const recordId = 'REQ-SOURCE-PRD-SESSION-REQUIREMENTS';

      const result = runMainAgentPreConfirmationDrilldown(root, {
        intakeSource: intake,
        targetSource: target,
        entrySource: 'session_requirements',
        recordId,
        requirementSetId: `${recordId}-SET`,
        targetPath: 'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts',
        requiredCommand: 'npx vitest run tests/acceptance/source-prd-authoring-entry-source-lint.test.ts',
        criticalAuditorRound: cleanCriticalAuditorRound,
      });

      const dir = authoringDir(root, recordId);
      const report = readJson(path.join(dir, 'source-prd-instance-lint-report.json'));
      const transaction = readJson(path.join(dir, 'authoring-transaction.json'));

      expect(result.entrySource).toBe('session_requirements');
      expect(report).toMatchObject({
        stage: 'post_initial_session_draft',
        entrySource: 'session_requirements',
        ok: false,
        status: 'source_prd_draft_blocked',
        sourcePrdDraftReady: false,
        nextRequiredAction: 'continue_staging_repair_without_ready_claim',
      });
      expect(report.issues.length).toBeGreaterThan(0);
      expect(transaction.sourcePrdInstanceLint).toMatchObject({
        ok: false,
        status: 'source_prd_draft_blocked',
        sourcePrdDraftReady: false,
      });
      expect(transaction.nextRequiredAction).not.toBe('source_prd_draft_ready');
      expect(existsSync(path.join(dir, 'draft-source-preview.md'))).toBe(true);
      expect(existsSync(target)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
