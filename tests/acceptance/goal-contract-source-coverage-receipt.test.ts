import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

function receipt(sourceText: string, options: Record<string, unknown> = {}) {
  const request = { operation: 'source-coverage-receipt', sourceText, ...options };
  const result = spawnSync(process.execPath, [path.join(process.cwd(), 'node_modules/tsx/dist/cli.mjs'),
    'tests/acceptance/helpers/canonical-proof-probe.cjs'], { cwd: process.cwd(), input: JSON.stringify(request),
    encoding: 'utf8', timeout: 240000, windowsHide: true, maxBuffer: 128 * 1024 });
  if (result.status !== 0) throw new Error(`source_receipt_probe_failed:${result.status}:${result.stderr.slice(0, 1500)}`);
  return JSON.parse(result.stdout);
}
const source = '# Source\n- PERMIT-001: MAY use a CLI cache when explicitly selected.\n'
  + '- STOP-001: MUST NOT modify tests/frozen.json.\n';
const work = '# Source\n### FIX-01: Preserve output\n- MUST preserve expected results.\n'
  + '### WORK-01: Implement CLI output\n- Acceptance: FIX-01\n'
  + '- Verification command: `node --test tests/output.test.js`\n';

describe('source-backed role-aware coverage receipt', () => {
  it('accepts real non-action source semantics without inventing tasks, proof commands or STOP002', () => {
    expect(receipt(source)).toMatchObject({ accepted: true, preserved: true, inventedStopRefs: 0,
      evidenceClassification: 'coverage_only', runtimeEvidenceAuthority: false, actionIds: [], proofDecision: 'pass' });
  });
  it('accepts an explicitly bound mandatory action without fabricated evidence or stop references', () => {
    expect(receipt(work)).toMatchObject({ accepted: true, preserved: true, inventedStopRefs: 0, actionIds: ['WORK-01'], proofDecision: 'pass' });
  });
  it.each(['omit-source-authority', 'add-command', 'drop-condition', 'forge-text', 'strip-role'])('rejects forged source coverage: %s', mutation => {
    expect(receipt(source, { mutation }).error).toBe('source_coverage_unmapped');
  });
  it.each(['remove-action', 'downgrade-action'])('cannot bypass mandatory action coverage: %s', mutation => {
    expect(receipt(work, { mutation }).error).toBe('source_coverage_unmapped');
  });
  it('does not trust a passed audit for an action missing acceptance and command proof', () => {
    expect(receipt('# Source\n### WORK-01: Implement src/output.ts\n- MUST preserve output.\n').error).toBe('source_coverage_unmapped');
  });
  it('preserves the complete frozen real source through the official compiler receipt boundary', () => {
    const result = receipt('', { operation: 'real-source-coverage-receipt' });
    expect(result).toMatchObject({ accepted: true, preserved: true, inventedStopRefs: 0,
      sourceSha256: '06f1c8f44fdfea09fb0f12832cd0a319c7938c79aac91aae48f44b54dc731d4a', proofDecision: 'pass' });
    expect(result.actionIds).toEqual(Array.from({ length: 16 }, (_, i) => `WORK-${String(i + 1).padStart(2, '0')}`));
    // The source clause index is lossless coverage metadata, not the executable
    // obligation set. Keep both counts explicit so structural clauses cannot be
    // mistaken for generated must obligations.
    expect(result.clauseCount).toBe(2241);
    expect(result.semanticClauseCount).toBe(1705);
    expect(result.coverageArtifactSchemaVersion).toBe('goal-contract-source-coverage-receipt/v2');
    expect(result.coverageArtifactClauseCount).toBe(2241);
    expect(result.coverageArtifactHeavyFieldCount).toBe(0);
    expect(result.coverageArtifactRowKeyCount).toBeLessThanOrEqual(24);
    expect(result.coverageArtifactBytes).toBeLessThan(result.semanticReceiptBytes / 3);
  }, 240000);
  it('preserves historical untyped task authority and STOP002 defaults', () => {
    expect(receipt('', { operation: 'legacy-source-coverage-receipt' })).toMatchObject({ accepted: true,
      rows: [{ id: 'GH-R01', goalTaskRefs: ['GH-T01', 'GH-T02'], stopConditionRefs: ['STOP002'] }] });
  });
  it('continues to reject missing legacy implementation evidence', () => {
    expect(receipt('', { operation: 'legacy-source-coverage-receipt', mutation: 'missing-evidence' }))
      .toEqual({ error: 'source_coverage_unmapped', field: 'evidenceRefs' });
  });
});
