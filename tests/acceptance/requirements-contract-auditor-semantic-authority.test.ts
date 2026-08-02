import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { validateRequirementAuditorSemanticRepair } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-authoring-repair-registry';

function hash(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

const source = [
  '# Requirement',
  '',
  'The service writes src/payments/ledger.ts.',
  'Validation command: npm test -- payments-ledger.',
  '',
].join('\n');

describe('requirements contract auditor semantic authority', () => {
  it('accepts an exact source-grounded target repair', () => {
    const result = validateRequirementAuditorSemanticRepair({
      sourceDocument: source,
      sourceHash: hash(source),
      action: 'replace_target_path',
      sourceSpan: { startLine: 3, endLine: 3 },
      sourceText: 'The service writes src/payments/ledger.ts.',
      proposedValue: 'src/payments/ledger.ts',
    });

    expect(result).toEqual({
      ok: true,
      issues: [],
      authorityClass: 'source_grounded',
    });
  });

  it('rejects stale source slices and semantic expansion', () => {
    const stale = validateRequirementAuditorSemanticRepair({
      sourceDocument: source,
      sourceHash: hash(source),
      action: 'replace_target_path',
      sourceSpan: { startLine: 3, endLine: 3 },
      sourceText: 'The service writes src/payments/other.ts.',
      proposedValue: 'src/payments/other.ts',
    });
    const expanded = validateRequirementAuditorSemanticRepair({
      sourceDocument: source,
      sourceHash: hash(source),
      action: 'replace_validation_command',
      sourceSpan: { startLine: 4, endLine: 4 },
      sourceText: 'Validation command: npm test -- payments-ledger.',
      proposedValue: 'npm test -- all-payments',
    });

    expect(stale.issues).toContain('auditor_source_text_mismatch');
    expect(expanded.issues).toContain('auditor_semantic_entailment_missing');
  });

  it('requires a hash-bound decision receipt for values absent from source authority', () => {
    const result = validateRequirementAuditorSemanticRepair({
      sourceDocument: source,
      sourceHash: hash(source),
      action: 'add_must',
      sourceSpan: { startLine: 3, endLine: 3 },
      sourceText: 'The service writes src/payments/ledger.ts.',
      proposedValue: 'The service must retry failed writes.',
      decisionReceiptRef: {
        path: 'docs/decisions/payment-retry.json',
        hash: `sha256:${'a'.repeat(64)}`,
        verified: true,
      },
    });

    expect(result).toEqual({
      ok: true,
      issues: [],
      authorityClass: 'decision_grounded',
    });
  });
});
