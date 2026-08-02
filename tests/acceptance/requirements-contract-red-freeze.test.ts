import { describe, expect, it } from 'vitest';
import {
  freezeQualifiedRequirementsContractRed,
  qualifyRequirementsContractRed,
  validateQualifiedRequirementsContractRedFreeze,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-red-qualification';

const HASH_A = `sha256:${'6'.repeat(64)}`;
const HASH_B = `sha256:${'7'.repeat(64)}`;

function qualified() {
  return qualifyRequirementsContractRed({
    requirementId: 'MUST-FR-001',
    testId: 'RED-001',
    semanticModelHash: HASH_A,
    baselineSnapshotHash: HASH_A,
    testSourceHash: HASH_A,
    fixtureHash: HASH_A,
    oracleHash: HASH_A,
    sequenceContractHash: HASH_B,
    exitCode: 1,
    failurePhase: 'assertion',
    assertionSiteMatched: true,
    expectedFailure: 'expected operation',
    observedFailure: 'operation missing',
  });
}

describe('requirements contract qualified RED freeze', () => {
  it('freezes every qualification input under one immutable hash', () => {
    const freeze = freezeQualifiedRequirementsContractRed(qualified());

    expect(freeze.schemaVersion).toBe('requirements-contract-red-freeze/v1');
    expect(freeze.freezeHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(
      validateQualifiedRequirementsContractRedFreeze(freeze, {
        semanticModelHash: HASH_A,
        baselineSnapshotHash: HASH_A,
        testSourceHash: HASH_A,
        fixtureHash: HASH_A,
        oracleHash: HASH_A,
        sequenceContractHash: HASH_B,
      })
    ).toEqual({ ok: true, issues: [] });
  });

  it('invalidates the freeze when any semantic or baseline input changes', () => {
    const freeze = freezeQualifiedRequirementsContractRed(qualified());
    const result = validateQualifiedRequirementsContractRedFreeze(freeze, {
      semanticModelHash: HASH_B,
      baselineSnapshotHash: HASH_A,
      testSourceHash: HASH_A,
      fixtureHash: HASH_A,
      oracleHash: HASH_A,
      sequenceContractHash: HASH_B,
    });

    expect(result).toEqual({
      ok: false,
      issues: ['red_freeze_semantic_model_hash_mismatch'],
    });
  });

  it('refuses to freeze invalid, inconclusive, or already-green outcomes', () => {
    expect(() =>
      freezeQualifiedRequirementsContractRed({
        ...qualified(),
        classification: 'INVALID_RED',
      })
    ).toThrow('red_freeze_expected_red_required');
  });
});
