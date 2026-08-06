import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  cleanCriticalAuditorRound,
  runPreConfirmationWithGovernedCriticalAuditorFixture,
} from './helpers/requirements-contract-authoring-fixture';

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
      '## Negative Requirements And Not Done Conditions',
      '',
      '| ID | Not-done condition | Negative assertion | Blocks completion when | Failure refs | Evidence refs |',
      '| --- | --- | --- | --- | --- | --- |',
      '| NEG-001 | Skipping the staging draft is not allowed. | Source materialization must not run before staging. | The target source is created before the staging draft. | FAIL-001 | ACC-001 |',
      '',
      '## Failure Matrix',
      '',
      '| ID | Failure condition | Required system behavior | Negative requirement refs | Evidence | Requirement refs |',
      '| --- | --- | --- | --- | --- | --- |',
      '| FAIL-001 | Staging draft generation fails. | Keep the target source absent and report the blocking failure. | NEG-001 | ACC-001 | MUST-FR-001 |',
      '',
      '## Out Of Scope',
      '',
      '| ID | Forbidden scope | Boundary assertion | Evidence |',
      '| --- | --- | --- | --- |',
      '| OUT-001 | Replacing cp-01 or cp-02 decomposition authority. | Existing checkpoint decomposition ownership remains unchanged. | ACC-001 |',
      '',
    ].join('\n'),
    'utf8'
  );
  return source;
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

      const result = runPreConfirmationWithGovernedCriticalAuditorFixture(root, recordId, {
        source,
        entrySource,
        recordId,
        requirementSetId: `${recordId}-SET`,
        targetPath: 'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts',
        requiredCommand: 'npx vitest run tests/acceptance/source-prd-authoring-entry-source-lint.test.ts',
        criticalAuditorRound: cleanCriticalAuditorRound,
      });

      const dir = authoringDir(root, recordId);
      const reportPath = path.join(dir, 'source-prd-instance-lint-report.json');
      expect(
        existsSync(reportPath),
        JSON.stringify({
          substate: result.substate,
          blockingStage: result.blockingStage,
          blockingIssues: result.blockingIssues,
        })
      ).toBe(true);
      const report = readJson(reportPath);
      const transaction = readJson(path.join(dir, 'authoring-transaction.json'));

      expect(result.entrySource).toBe(entrySource);
      expect(result.sourcePrdInstanceLintReportPath).toBe(
        `_bmad-output/runtime/requirement-records/${recordId}/authoring/source-prd-instance-lint-report.json`
      );
      expect(report).toMatchObject({
        stage: 'post_staging_draft',
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

      const result = runPreConfirmationWithGovernedCriticalAuditorFixture(root, recordId, {
        intakeSource: intake,
        targetSource: target,
        entrySource: 'session_requirements',
        recordId,
        requirementSetId: `${recordId}-SET`,
        sessionId: 'session-source-prd-lint',
        sessionTurnId: 'turn-source-prd-lint',
        sessionMessageId: 'message-source-prd-lint',
        sessionActorIdentityClass: 'requesting_user',
        sessionBranch: 'test-source-prd-lint',
        sessionCapturedAt: '2026-07-14T00:00:00.000Z',
        targetPath: 'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts',
        requiredCommand: 'npx vitest run tests/acceptance/source-prd-authoring-entry-source-lint.test.ts',
        criticalAuditorRound: cleanCriticalAuditorRound,
      });

      const dir = authoringDir(root, recordId);
      const reportPath = path.join(dir, 'source-prd-instance-lint-report.json');
      expect(
        existsSync(reportPath),
        JSON.stringify({
          substate: result.substate,
          blockingStage: result.blockingStage,
          blockingIssues: result.blockingIssues,
        })
      ).toBe(true);
      const report = readJson(reportPath);
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
      expect(transaction.nextRequiredAction).toBe(
        'continue_staging_repair_without_ready_claim'
      );
      const previewPath = path.join(dir, 'draft-source-preview.md');
      expect(existsSync(previewPath)).toBe(true);
      const previewText = readFileSync(previewPath, 'utf8');
      expect(previewText).toBe(readFileSync(intake, 'utf8'));
      expect(previewText).not.toContain('implementationConfirmation:');
      expect(existsSync(target)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not treat an existing source as session intake from an explicit entry-source claim', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'source-prd-entry-existing-source-'));
    try {
      const source = writeSessionRequirements(root);
      const recordId = 'REQ-SOURCE-PRD-EXISTING-SOURCE';

      const result = runPreConfirmationWithGovernedCriticalAuditorFixture(root, recordId, {
        source,
        entrySource: 'session_requirements',
        recordId,
        requirementSetId: `${recordId}-SET`,
        sessionId: 'session-existing-source',
        sessionTurnId: 'turn-existing-source',
        sessionMessageId: 'message-existing-source',
        sessionActorIdentityClass: 'requesting_user',
        sessionBranch: 'test-existing-source',
        sessionCapturedAt: '2026-07-17T00:00:00.000Z',
        targetPath: 'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts',
        requiredCommand: 'npx vitest run tests/acceptance/source-prd-authoring-entry-source-lint.test.ts',
        criticalAuditorRound: cleanCriticalAuditorRound,
      });

      const dir = authoringDir(root, recordId);
      expect(result.entrySource).toBeUndefined();
      expect(existsSync(path.join(dir, 'source-prd-instance-lint-report.json'))).toBe(false);
      expect(existsSync(path.join(dir, 'intake-receipt.json'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
