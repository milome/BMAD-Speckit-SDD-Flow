import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainImplementationReadinessGate } from '../../scripts/main-agent-implementation-readiness-gate';
import { resolveArchitectureConfirmationHashRecipe } from '../../scripts/architecture-confirmation-hash-recipe';

const SOURCE_HASH = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const IMPLEMENTATION_HASH = 'sha256:2222222222222222222222222222222222222222222222222222222222222222';
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
            renderReportPath: '_bmad-output/runtime/requirement-records/REQ-READINESS/confirmation/report.json',
            htmlPath: '_bmad-output/runtime/requirement-records/REQ-READINESS/confirmation/confirmation.html',
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
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return recordPath;
}

describe('implementation readiness gate activation metadata', () => {
  it('writes audit_required readiness baseline activation on pass without scoring record', () => {
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

      expect(code).toBe(0);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.gateChecks.at(-1)).toMatchObject({
        gate: 'Implementation Readiness Gate',
        decision: 'pass',
      });
      expect(record.readinessBaselineActivation).toMatchObject({
        status: 'audit_required',
        sourceGateCheckId: 'implementation-readiness:2026-05-20T00:00:00.000Z',
        readinessGateRecipeVersion: 'implementation-readiness-gate/v1',
      });
      expect(record.readinessBaselineActivation.sourceReportHash).toMatch(
        /^sha256:[a-f0-9]{64}$/u
      );
      expect(record.readinessScoringRecords ?? []).toEqual([]);
      expect(JSON.stringify(record)).not.toContain('"stage":"implementation_readiness"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
