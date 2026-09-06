import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

function canonical(sourceText: string, options: Record<string, unknown> = {}) {
  const result = spawnSync(process.execPath, [path.join(process.cwd(), 'node_modules/tsx/dist/cli.mjs'),
    'tests/acceptance/helpers/canonical-proof-probe.cjs'], { cwd: process.cwd(), input: JSON.stringify({ sourceText, ...options }),
    encoding: 'utf8', timeout: options.operation === 'real-fixture' ? 120000 : 20000, windowsHide: true, maxBuffer: 128 * 1024 });
  if (result.status !== 0) throw new Error(`test_only_canonical_probe_failed:${result.status}:${result.stderr.slice(0, 1500)}`);
  return JSON.parse(result.stdout);
}

describe('canonical source semantics protocol', () => {
  it('preserves source strength, polarity, unevaluated conditions and provenance in a versioned bundle', () => {
    const value = canonical('# Test-only source\n- PERMIT-001: MAY use a CLI cache when explicitly selected.\n- GUIDE-001: SHOULD reuse the existing CLI parser.\n- STOP-001: MUST NOT modify tests/frozen.json.\n');
    expect(value.schemaVersion).toBe('goal-contract-canonical-intent-bundle/v2');
    expect(value.compilerVersion).toBe('goal-contract-canonical-intent-compiler/v2');
    expect(value.records.find((row: any) => row.declaredSourceId === 'PERMIT-001')).toMatchObject({
      sourceRootId: 'PERMIT-001', normativeStrength: 'may', polarity: 'permitted', executionRole: 'guidance', required: false,
      conditions: [expect.objectContaining({ state: 'unevaluated' })],
    });
    expect(value.records.find((row: any) => row.declaredSourceId === 'GUIDE-001')).toMatchObject({
      normativeStrength: 'should', executionRole: 'guidance', required: false,
    });
    expect(value.records.find((row: any) => row.declaredSourceId === 'STOP-001')).toMatchObject({
      normativeStrength: 'must', polarity: 'forbidden', executionRole: 'boundary',
    });
    for (const record of value.records) {
      expect(record.sourceBlockRefs.length).toBeGreaterThan(0);
      expect(record.provenanceRefs.length).toBeGreaterThan(0);
      expect(record.normativeClauses.length).toBeGreaterThan(0);
    }
    expect(value.graphObligations).toEqual(value.records);
  });

  it('binds normative strength and conditional scope into semantic identity', () => {
    const may = canonical('# Test-only source\n- REQ-001: MAY use a CLI cache.\n');
    const must = canonical('# Test-only source\n- REQ-001: MUST use a CLI cache.\n');
    const conditional = canonical('# Test-only source\n- REQ-001: MUST use a CLI cache when explicitly selected.\n');
    expect(may.records[0].semanticOwnershipKey).not.toBe(must.records[0].semanticOwnershipKey);
    expect(must.records[0].semanticCoordinateKey).not.toBe(conditional.records[0].semanticCoordinateKey);
    expect(conditional.records[0].applicabilityCondition).not.toBe('applicable');
  });

  it('keeps the exact v1 hash preimage without accepting arbitrary historical schema hashes', () => {
    const source = '# Test-only source\n- REQ-001: MAY use a CLI cache.\n';
    const options = { operation: 'v1-protocol-fixture' };
    expect(canonical(source, options)).toEqual({ evidenceClass: 'test-only-v1-protocol-fixture', verified: true, unchanged: true });
    expect(canonical(source, { ...options, mutateSchemaHash: true })).toEqual({ error: 'compiler_identity_stale' });
    expect(canonical(source, { ...options, addV2Field: true })).toEqual({ error: 'canonical_schema_invalid' });
  });

  it.each(['permission-promoted', 'conditions-removed'])('rejects rehashed source semantic drift: %s', (mutation) => {
    const source = '# Test-only source\n- REQ-001: MAY use a CLI cache when explicitly selected.\n';
    expect(canonical(source, { operation: 'source-semantic-mutation', mutation }))
      .toEqual({ error: 'canonical_intent_source_semantics_mismatch' });
  });

  it.each(['missing-source-record', 'duplicate-source-record'])('rejects self-consistent source coverage changes: %s', (mutation) => {
    const source = '# Test-only source\n- REQ-001: MAY use a CLI cache.\n- REQ-002: MAY use local logs.\n';
    expect(canonical(source, { operation: 'source-semantic-mutation', mutation }))
      .toEqual({ error: 'canonical_intent_source_base_coverage_mismatch' });
  });

  it('does not substitute a same-name source root from another snapshot', () => {
    expect(canonical('', { operation: 'composite-source-mutation', mutation: 'same-id-other-snapshot' }))
      .toEqual({ error: 'canonical_intent_source_base_coverage_mismatch' });
  });

  it.each(['undeclared-cross-reference', 'missing-cross-reference'])('reconstructs complete declared cross-source relations: %s', (mutation) => {
    expect(canonical('', { operation: 'composite-source-mutation', mutation }))
      .toEqual({ error: 'canonical_intent_cross_source_reference_mismatch' });
  });

  it('compiles the complete frozen real source and retains only its sixteen declared WORK actions', () => {
    const result = canonical('', { operation: 'real-fixture' });
    expect(result.sourceSha256).toBe('06f1c8f44fdfea09fb0f12832cd0a319c7938c79aac91aae48f44b54dc731d4a');
    expect(result.schemaVersion).toBe('goal-contract-canonical-intent-bundle/v2');
    expect(result.executionTaskIds).toEqual(Array.from({ length: 16 }, (_, index) => `WORK-${String(index + 1).padStart(2, '0')}`));
    expect(result.missingSemantics).toBe(0);
    expect(result.semanticOnlyCount).toBe(result.recordCount - 16);
    expect(result.commandIds.length).toBe(result.commandDeclarationCount);
    expect(result.judgeDispatchCount).toBe(0);
    expect(result.fixtureOracleAccepted).toBe(false);
  }, 120000);
});
