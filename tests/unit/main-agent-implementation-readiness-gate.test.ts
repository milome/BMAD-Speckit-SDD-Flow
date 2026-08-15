import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainImplementationReadinessGate } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-implementation-readiness-gate';
import { parseReadinessCommandInvocation } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-implementation-readiness-gate';
import { resolveArchitectureConfirmationHashRecipe } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/architecture-confirmation-hash-recipe';

const SOURCE_HASH = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const IMPLEMENTATION_HASH =
  'sha256:2222222222222222222222222222222222222222222222222222222222222222';
const PAGE_HASH = 'sha256:3333333333333333333333333333333333333333333333333333333333333333';
const ARCH_HASH = 'sha256:4444444444444444444444444444444444444444444444444444444444444444';

function writeRecord(root: string): string {
  const recipe = resolveArchitectureConfirmationHashRecipe();
  const base = path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'REQ-READINESS');
  mkdirSync(base, { recursive: true });
  const recordPath = path.join(base, 'requirement-record.json');
  writeFileSync(
    recordPath,
    `${JSON.stringify(
      {
        recordId: 'REQ-READINESS',
        requirementSetId: 'REQ-READINESS',
        status: 'user_confirmed',
        sourcePath: 'docs/requirements.md',
        sourceDocumentHash: SOURCE_HASH,
        implementationConfirmationHash: IMPLEMENTATION_HASH,
        confirmationPageHash: PAGE_HASH,
        confirmationHistory: [
          {
            eventType: 'confirmation_recorded',
            recordId: 'REQ-READINESS',
            requirementSetId: 'REQ-READINESS',
            confirmedAt: '2026-05-19T00:00:00.000Z',
            confirmedBy: 'user',
            sourcePath: 'docs/requirements.md',
            sourceDocumentHash: SOURCE_HASH,
            implementationConfirmationHash: IMPLEMENTATION_HASH,
            confirmationPageHash: PAGE_HASH,
            confirmationText: 'confirmed',
            renderReportPath:
              '_bmad-output/runtime/requirement-records/REQ-READINESS/confirmation/report.json',
            htmlPath:
              '_bmad-output/runtime/requirement-records/REQ-READINESS/confirmation/confirmation.html',
          },
        ],
        architectureConfirmationState: {
          status: 'active',
          currentArchitectureConfirmationHash: ARCH_HASH,
          resolvedRecipeHash: recipe.resolvedRecipeHash,
        },
        architectureConfirmationStateChecks: [
          {
            eventType: 'architecture_confirmation_state_checked',
            checkId: 'architecture-state:pass',
            decision: 'pass',
            resolvedRecipeHash: recipe.resolvedRecipeHash,
            stateTransition: {
              fromStatus: 'active',
              toStatus: 'active',
              reasonCode: 'hash_match',
              previousHashes: {},
              currentHashes: {
                sourceDocumentHash: SOURCE_HASH,
                implementationConfirmationHash: IMPLEMENTATION_HASH,
                architectureConfirmationHash: ARCH_HASH,
                resolvedRecipeHash: recipe.resolvedRecipeHash,
              },
              mismatchFields: [],
              recipeVersion: 'architecture-confirmation-hash/v1',
            },
            checkedAt: '2026-05-19T00:00:00.500Z',
            checkedBy: 'test',
          },
        ],
        aiTddContractGate: {},
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return recordPath;
}

describe('implementation readiness gate activation metadata', () => {
  it('treats architecture confirmation as not applicable when the record explicitly opts out', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'readiness-gate-unit-'));
    try {
      const recordPath = writeRecord(root);
      const input = JSON.parse(readFileSync(recordPath, 'utf8'));
      input.architectureConfirmationRequired = false;
      delete input.architectureConfirmationState;
      delete input.architectureConfirmationStateChecks;
      writeFileSync(recordPath, `${JSON.stringify(input, null, 2)}\n`, 'utf8');

      const code = mainImplementationReadinessGate([
        '--requirement-record',
        recordPath,
        '--evaluated-at',
        '2026-05-20T00:00:00.000Z',
        '--evaluated-by',
        'unit-test',
        '--json',
      ]);

      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      const latestGate = record.gateChecks.at(-1);
      expect(latestGate.checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'architecture-confirmation-required',
            passed: true,
            required: false,
          }),
          expect.objectContaining({
            id: 'architecture-confirmation-current',
            passed: true,
          }),
          expect.objectContaining({
            id: 'architecture-confirmation-recipe-current',
            passed: true,
          }),
          expect.objectContaining({
            id: 'architecture-confirmation-state-current',
            passed: true,
          }),
        ])
      );
      expect(latestGate.blockingReasons).not.toEqual(
        expect.arrayContaining([
          'architecture_confirmation_not_active',
          'architecture_confirmation_resolved_recipe_hash_not_current',
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks record-only readiness and does not activate baseline without mandatory stage audit and AI-TDD gate proof', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'readiness-gate-unit-'));
    try {
      const recordPath = writeRecord(root);
      const code = mainImplementationReadinessGate([
        '--requirement-record',
        recordPath,
        '--evaluated-at',
        '2026-05-20T00:00:00.000Z',
        '--evaluated-by',
        'unit-test',
        '--json',
      ]);

      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.gateChecks.at(-1)).toMatchObject({
        gate: 'Implementation Readiness Gate',
        decision: 'blocked',
      });
      expect(record.gateChecks.at(-1).blockingReasons).toEqual(
        expect.arrayContaining([
          'implementation_readiness_stage_audit_source_missing',
          'implementation_readiness_stage_audit_render_report_missing',
          'ai_tdd_contract_gate_source_missing',
        ])
      );
      expect(record.readinessBaselineActivation).toBeUndefined();
      expect(record.readinessScoringRecords ?? []).toEqual([]);
      expect(JSON.stringify(record)).not.toContain('"stage":"implementation_readiness"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('implementation readiness v2 command normalization', () => {
  it('normalizes quoted argv without introducing a shell', () => {
    expect(parseReadinessCommandInvocation('node --test "tests/refund worker.test.cjs"')).toEqual(
      expect.objectContaining({
        executable: 'node',
        args: ['--test', 'tests/refund worker.test.cjs'],
        normalizedInvocation: 'node\u0000--test\u0000tests/refund worker.test.cjs',
      })
    );
  });

  it.each([
    'node --test tests/a.test.cjs | tee output.log',
    'node --test tests/a.test.cjs > output.log',
    'node --test tests/a.test.cjs && echo done',
  ])('rejects shell syntax: %s', (invocation) => {
    expect(() => parseReadinessCommandInvocation(invocation)).toThrow(
      'implementation_readiness_shell_syntax_forbidden'
    );
  });

  it('rejects npx package-resolution options before the declared executable', () => {
    expect(() =>
      parseReadinessCommandInvocation(
        'npx --yes --package node@20 node --test tests/refund-worker.test.cjs'
      )
    ).toThrow('implementation_readiness_npx_wrapper_prefix_forbidden');
  });
});
