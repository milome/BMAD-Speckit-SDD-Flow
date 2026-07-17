import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const TRANSITIONS = [
  'confirmation-ready',
  'architecture-confirmation',
  'implementation-readiness',
  'packet-dispatch',
  'execution-closure',
  'audit-review',
  'delivery-confirmation',
  'closeout',
] as const;

const CONSUMER_FILES = [
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts',
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/ingest-architecture-confirmation.ts',
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-implementation-readiness-gate.ts',
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prompt-transaction-publisher.ts',
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-execution-closure-gate.ts',
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-audit-review-gate.ts',
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-delivery-closeout-gate.ts',
] as const;

const SOURCE_PATH = 'docs/requirements/current-source-prd.md';
const SOURCE_HASH = `sha256:${createHash('sha256').update('current source', 'utf8').digest('hex')}`;

function passingLintReport() {
  return {
    schemaVersion: 'requirements-contract-source-prd-instance-lint-report/v1',
    sourcePath: SOURCE_PATH,
    sourceHash: SOURCE_HASH,
    sourcePrdDraftReady: true,
    status: 'source_prd_draft_ready',
    blockedReason: null,
    ok: true,
    counts: {
      requirementRows: 1,
      traceRows: 1,
      negativeRows: 1,
      pathRows: 1,
      currentTargetRows: 1,
    },
    issues: [],
  };
}

async function transitionGate() {
  const module = await import(
    '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-validation-facade'
  );
  const gate = (module as Record<string, unknown>).validateSourcePrdLintTransition;
  expect(
    typeof gate,
    'canonical Source PRD lint transition Gate is missing'
  ).toBe('function');
  return gate as (input: {
    transition: (typeof TRANSITIONS)[number];
    lintReport: unknown;
    currentSourceRef: { path: string; hash: string };
  }) => {
    decision: 'pass' | 'block';
    issueCodes: string[];
  };
}

describe('requirements contract Source PRD lint state machine', () => {
  it('blocks missing, invalid, stale, and non-PASS lint authority for every downstream transition', async () => {
    const validate = await transitionGate();
    const cases = [
      {
        name: 'missing',
        lintReport: null,
        issueCode: 'source_prd_lint_report_missing',
      },
      {
        name: 'invalid',
        lintReport: { schemaVersion: 'forged/v1', ok: true },
        issueCode: 'source_prd_lint_report_invalid',
      },
      {
        name: 'stale',
        lintReport: { ...passingLintReport(), sourceHash: `sha256:${'0'.repeat(64)}` },
        issueCode: 'source_prd_lint_report_stale',
      },
      {
        name: 'non-PASS',
        lintReport: {
          ...passingLintReport(),
          sourcePrdDraftReady: false,
          status: 'source_prd_draft_blocked',
          blockedReason: 'source_prd_instance_lint_failed',
          ok: false,
          issues: [{ code: 'source_prd_instance_lint_failed' }],
        },
        issueCode: 'source_prd_lint_non_pass',
      },
    ] as const;

    for (const transition of TRANSITIONS) {
      for (const candidate of cases) {
        const result = validate({
          transition,
          lintReport: candidate.lintReport,
          currentSourceRef: { path: SOURCE_PATH, hash: SOURCE_HASH },
        });
        expect(result.decision, `${transition} accepted ${candidate.name} lint authority`).toBe(
          'block'
        );
        expect(result.issueCodes).toContain(candidate.issueCode);
      }
    }
  });

  it('permits every downstream transition only for the current schema-valid PASS lint report', async () => {
    const validate = await transitionGate();
    for (const transition of TRANSITIONS) {
      expect(
        validate({
          transition,
          lintReport: passingLintReport(),
          currentSourceRef: { path: SOURCE_PATH, hash: SOURCE_HASH },
        })
      ).toMatchObject({
        transition,
        decision: 'pass',
        issueCodes: [],
      });
    }
  });

  it('routes every production transition Consumer through the canonical lint Gate', () => {
    for (const filePath of CONSUMER_FILES) {
      const source = readFileSync(path.join(process.cwd(), filePath), 'utf8');
      expect(source, `${filePath} bypasses Source PRD lint transition validation`).toContain(
        'validateSourcePrdLintTransition'
      );
    }
  });
});
