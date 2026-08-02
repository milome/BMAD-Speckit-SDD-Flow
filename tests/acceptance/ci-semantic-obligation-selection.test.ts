import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { canonicalJsonBytes } = require('../../tools/test-portfolio-audit/canonical.cjs');

type SelectionInput = {
  obligations: Array<Record<string, unknown>>;
  candidates: Array<Record<string, unknown>>;
  defaultDurationMs: number;
};

type SelectionResult = {
  schemaVersion: string;
  candidateEvidence: Array<{
    identityKey: string;
    obligationEvidence: Record<string, 'direct' | 'indirect' | 'ambiguous'>;
    oracleIndependence: 'independent' | 'dependent';
    obligationOracleIndependence: Record<string, 'independent' | 'dependent'>;
  }>;
  selected: Array<{
    identityKey: string;
    obligationEvidence: Record<string, 'direct' | 'indirect' | 'ambiguous'>;
    oracleIndependence: 'independent' | 'dependent';
    obligationOracleIndependence: Record<string, 'independent' | 'dependent'>;
    estimatedDurationMs: number;
    timingProvenance: string;
    timingFreshness: 'fresh' | 'stale' | 'fallback';
    flakePenaltyMs: number;
    fragileFixturePenaltyMs: number;
    redundancyPenaltyMs: number;
    directEvidenceQualityBonusMs: number;
    independentOracleBonusMs: number;
    stabilityScore: number;
    grossCostMs: number;
    totalCostMs: number;
    coveredObligationIds: string[];
  }>;
  coverage: Array<{
    obligationId: string;
    applicability: 'applicable' | 'not_applicable';
    minimumEvidenceKind: 'direct' | 'indirect';
    status: string;
    selectedEvidence: Array<{ identityKey: string; evidenceKind: string }>;
    evidenceDiagnostics: Array<{
      identityKey: string;
      evidenceKind: 'direct' | 'indirect' | 'ambiguous';
      oracleIndependence: 'independent' | 'dependent';
      meetsMinimumEvidenceKind: boolean;
      eligibleForCoverage: boolean;
    }>;
  }>;
  gates: {
    unmappedApplicableObligationCount: number;
    selectionDuplicateCount: number;
    redundantSelectedTestCount: number;
  };
};

type SelectorApi = {
  selectMinimalTestCover: (input: SelectionInput) => SelectionResult;
  validateMinimalTestCoverResult: (result: SelectionResult) => SelectionResult;
};

function selector(): SelectorApi {
  return require('../../tools/ci/select-minimal-test-cover.cjs') as SelectorApi;
}

function obligation(
  obligationId: string,
  minimumEvidenceKind: 'direct' | 'indirect' = 'direct',
  applicability: 'applicable' | 'not_applicable' = 'applicable'
) {
  return { obligationId, applicability, minimumEvidenceKind };
}

function candidate(
  identityKey: string,
  obligationEvidence: Record<string, 'direct' | 'indirect' | 'ambiguous'>,
  overrides: Record<string, unknown> = {}
) {
  return {
    identityKey,
    obligationEvidence,
    oracleIndependence: 'independent',
    estimatedDurationMs: 1,
    timingProvenance: 'declared',
    timingFreshness: 'fallback',
    ...overrides,
  };
}

function selectedIds(result: SelectionResult) {
  return result.selected.map((item) => item.identityKey);
}

function captureError(run: () => unknown) {
  try {
    run();
  } catch (error) {
    return error as Error & {
      code?: string;
      details?: { coverage?: Array<{ obligationId: string; status: string }> };
    };
  }
  throw new Error('Expected selection to fail');
}

describe('semantic obligation minimal test cover', () => {
  it('selects by weighted total cost per newly covered obligation', () => {
    const result = selector().selectMinimalTestCover({
      obligations: [obligation('A'), obligation('B')],
      candidates: [
        candidate('bundle', { A: 'direct', B: 'direct' }, { estimatedDurationMs: 5 }),
        candidate('single-a', { A: 'direct' }, { estimatedDurationMs: 2 }),
        candidate('single-b', { B: 'direct' }, { estimatedDurationMs: 2 }),
        candidate(
          'penalized',
          { A: 'direct', B: 'direct' },
          {
            estimatedDurationMs: 1,
            flakePenaltyMs: 3,
            fragileFixturePenaltyMs: 3,
            redundancyPenaltyMs: 3,
          }
        ),
      ],
      defaultDurationMs: 50,
    });

    expect(selectedIds(result)).toEqual(['single-a', 'single-b']);
    expect(result.gates).toEqual({
      unmappedApplicableObligationCount: 0,
      selectionDuplicateCount: 0,
      redundantSelectedTestCount: 0,
    });
  });

  it('uses the default duration and all penalties in total cost', () => {
    const result = selector().selectMinimalTestCover({
      obligations: [obligation('A')],
      candidates: [
        candidate(
          'defaulted',
          { A: 'direct' },
          {
            estimatedDurationMs: undefined,
            flakePenaltyMs: 1,
            fragileFixturePenaltyMs: 2,
            redundancyPenaltyMs: 3,
          }
        ),
      ],
      defaultDurationMs: 5,
    });

    expect(result.selected[0]).toMatchObject({
      identityKey: 'defaulted',
      estimatedDurationMs: 5,
      grossCostMs: 11,
      directEvidenceQualityBonusMs: 0,
      independentOracleBonusMs: 0,
      totalCostMs: 11,
    });
  });

  it('uses direct and independent bonuses to lower effective selection cost', () => {
    const result = selector().selectMinimalTestCover({
      obligations: [obligation('A')],
      candidates: [
        candidate('baseline', { A: 'direct' }, { estimatedDurationMs: 3 }),
        candidate(
          'bonus-backed',
          { A: 'direct' },
          {
            estimatedDurationMs: 8,
            directEvidenceQualityBonusMs: 4,
            independentOracleBonusMs: 3,
          }
        ),
      ],
      defaultDurationMs: 10,
    });

    expect(selectedIds(result)).toEqual(['bonus-backed']);
    expect(result.selected[0]).toMatchObject({
      grossCostMs: 8,
      directEvidenceQualityBonusMs: 4,
      independentOracleBonusMs: 3,
      totalCostMs: 1,
    });
  });

  it('clamps effective cost at zero and preserves zero-cost deterministic ranking', () => {
    const result = selector().selectMinimalTestCover({
      obligations: [obligation('A'), obligation('B')],
      candidates: [
        candidate('zero-single', { A: 'direct' }, { estimatedDurationMs: 0 }),
        candidate(
          'clamped-bundle',
          { A: 'direct', B: 'direct' },
          {
            estimatedDurationMs: 2,
            directEvidenceQualityBonusMs: 5,
            independentOracleBonusMs: 7,
          }
        ),
      ],
      defaultDurationMs: 10,
    });

    expect(selectedIds(result)).toEqual(['clamped-bundle']);
    expect(result.selected[0]).toMatchObject({
      grossCostMs: 2,
      directEvidenceQualityBonusMs: 5,
      independentOracleBonusMs: 7,
      totalCostMs: 0,
    });
  });

  it('applies the complete deterministic tie-break order', () => {
    const select = selector().selectMinimalTestCover;

    expect(
      selectedIds(
        select({
          obligations: [obligation('A', 'indirect')],
          candidates: [
            candidate('indirect', { A: 'indirect' }),
            candidate('direct', { A: 'direct' }),
          ],
          defaultDurationMs: 10,
        })
      )
    ).toEqual(['direct']);

    expect(
      selectedIds(
        select({
          obligations: [obligation('A', 'indirect'), obligation('B', 'indirect')],
          candidates: [
            candidate('single', { A: 'direct' }),
            candidate('wider', { A: 'direct', B: 'indirect' }, { estimatedDurationMs: 2 }),
          ],
          defaultDurationMs: 10,
        })
      )
    ).toEqual(['wider']);

    expect(
      selectedIds(
        select({
          obligations: [obligation('A')],
          candidates: [
            candidate('less-stable', { A: 'direct' }, { stabilityScore: 2 }),
            candidate('more-stable', { A: 'direct' }, { stabilityScore: 9 }),
          ],
          defaultDurationMs: 10,
        })
      )
    ).toEqual(['more-stable']);

    expect(
      selectedIds(
        select({
          obligations: [obligation('A')],
          candidates: [
            candidate(
              'stale-observed',
              { A: 'direct' },
              {
                timingProvenance: 'observed',
                timingFreshness: 'stale',
              }
            ),
            candidate(
              'fresh-declared',
              { A: 'direct' },
              {
                timingProvenance: 'declared',
                timingFreshness: 'fresh',
              }
            ),
          ],
          defaultDurationMs: 10,
        })
      )
    ).toEqual(['fresh-declared']);

    expect(
      selectedIds(
        select({
          obligations: [obligation('A')],
          candidates: [
            candidate('long-duration', { A: 'direct' }, { estimatedDurationMs: 4 }),
            candidate(
              'short-duration',
              { A: 'direct' },
              {
                estimatedDurationMs: 2,
                flakePenaltyMs: 2,
              }
            ),
          ],
          defaultDurationMs: 10,
        })
      )
    ).toEqual(['short-duration']);

    expect(
      selectedIds(
        select({
          obligations: [obligation('A')],
          candidates: [candidate('z-test', { A: 'direct' }), candidate('a-test', { A: 'direct' })],
          defaultDurationMs: 10,
        })
      )
    ).toEqual(['a-test']);
  });

  it('requires an independent Oracle before evidence can cover an obligation', () => {
    const result = selector().selectMinimalTestCover({
      obligations: [obligation('A')],
      candidates: [
        candidate(
          'dependent',
          { A: 'direct' },
          {
            estimatedDurationMs: 0,
            oracleIndependence: 'dependent',
          }
        ),
        candidate('independent', { A: 'direct' }, { estimatedDurationMs: 5 }),
      ],
      defaultDurationMs: 10,
    });

    expect(selectedIds(result)).toEqual(['independent']);
  });

  it('allows assertion-backed Oracle authority to cover only its bound obligation', () => {
    const result = selector().selectMinimalTestCover({
      obligations: [obligation('A'), obligation('B')],
      candidates: [
        candidate(
          'scoped-authority',
          { A: 'direct', B: 'direct' },
          {
            oracleIndependence: 'dependent',
            obligationOracleIndependence: {
              A: 'independent',
            },
          }
        ),
        candidate('independent-b', { B: 'direct' }, { estimatedDurationMs: 5 }),
      ],
      defaultDurationMs: 10,
    });

    expect(selectedIds(result)).toEqual(['independent-b', 'scoped-authority']);
    expect(
      result.coverage.find((item) => item.obligationId === 'A')?.evidenceDiagnostics
    ).toContainEqual(
      expect.objectContaining({
        identityKey: 'scoped-authority',
        oracleIndependence: 'independent',
        eligibleForCoverage: true,
      })
    );
    expect(
      result.coverage.find((item) => item.obligationId === 'B')?.evidenceDiagnostics
    ).toContainEqual(
      expect.objectContaining({
        identityKey: 'scoped-authority',
        oracleIndependence: 'dependent',
        eligibleForCoverage: false,
      })
    );
  });

  it('enforces minimum evidence kind and reports indirect coverage distinctly', () => {
    const result = selector().selectMinimalTestCover({
      obligations: [obligation('direct-required'), obligation('indirect-allowed', 'indirect')],
      candidates: [
        candidate('indirect-only', {
          'direct-required': 'indirect',
          'indirect-allowed': 'indirect',
        }),
        candidate('direct-proof', { 'direct-required': 'direct' }, { estimatedDurationMs: 2 }),
      ],
      defaultDurationMs: 10,
    });

    expect(selectedIds(result)).toEqual(['direct-proof', 'indirect-only']);
    expect(result.coverage.map(({ obligationId, status }) => ({ obligationId, status }))).toEqual([
      { obligationId: 'direct-required', status: 'covered' },
      { obligationId: 'indirect-allowed', status: 'indirectly_covered' },
    ]);
  });

  it('fails closed with coverage diagnostics for ambiguous and missing obligations', () => {
    const error = captureError(() =>
      selector().selectMinimalTestCover({
        obligations: [obligation('ambiguous'), obligation('missing')],
        candidates: [candidate('uncertain', { ambiguous: 'ambiguous' })],
        defaultDurationMs: 10,
      })
    );

    expect(error.code).toBe('SEMANTIC_OBLIGATION_UNMAPPED');
    expect(
      error.details?.coverage?.map(({ obligationId, status }) => ({ obligationId, status }))
    ).toEqual([
      { obligationId: 'ambiguous', status: 'ambiguous' },
      { obligationId: 'missing', status: 'missing_test' },
    ]);
  });

  it('does not require tests for not-applicable obligations', () => {
    const result = selector().selectMinimalTestCover({
      obligations: [obligation('platform-specific', 'direct', 'not_applicable')],
      candidates: [],
      defaultDurationMs: 10,
    });

    expect(result.schemaVersion).toBe('test-minimal-cover/v1');
    expect(result.selected).toEqual([]);
    expect(result.coverage).toMatchObject([
      {
        obligationId: 'platform-specific',
        status: 'not_applicable',
        selectedEvidence: [],
      },
    ]);
    expect(result.gates.unmappedApplicableObligationCount).toBe(0);
  });

  it('produces identical canonical bytes for reversed inputs', () => {
    const obligations = [obligation('B', 'indirect'), obligation('A')];
    const candidates = [
      candidate('z-test', { B: 'indirect' }, { estimatedDurationMs: 2 }),
      candidate('a-test', { A: 'direct' }, { timingProvenance: 'observed' }),
    ];
    const select = selector().selectMinimalTestCover;

    const forward = select({ obligations, candidates, defaultDurationMs: 10 });
    const reversed = select({
      obligations: [...obligations].reverse(),
      candidates: [...candidates].reverse(),
      defaultDurationMs: 10,
    });

    expect(canonicalJsonBytes(forward)).toEqual(canonicalJsonBytes(reversed));
  });

  it('eliminates redundant greedy selections and leaves a locally minimal cover', () => {
    const result = selector().selectMinimalTestCover({
      obligations: [obligation('A'), obligation('B'), obligation('C'), obligation('D')],
      candidates: [
        candidate('early-ab', { A: 'direct', B: 'direct' }, { estimatedDurationMs: 2 }),
        candidate('later-ac', { A: 'direct', C: 'direct' }, { estimatedDurationMs: 3 }),
        candidate('later-bd', { B: 'direct', D: 'direct' }, { estimatedDurationMs: 3 }),
      ],
      defaultDurationMs: 10,
    });

    expect(selectedIds(result)).toEqual(['later-ac', 'later-bd']);
    const required = new Set(['A', 'B', 'C', 'D']);
    for (const removed of result.selected) {
      const coveredWithout = new Set(
        result.selected
          .filter((item) => item.identityKey !== removed.identityKey)
          .flatMap((item) => item.coveredObligationIds)
      );
      expect([...required].some((obligationId) => !coveredWithout.has(obligationId))).toBe(true);
    }
    expect(result.gates.redundantSelectedTestCount).toBe(0);
  });

  it('rejects duplicate and invalid input before selection', () => {
    const duplicateObligation = captureError(() =>
      selector().selectMinimalTestCover({
        obligations: [obligation('A'), obligation('A')],
        candidates: [],
        defaultDurationMs: 10,
      })
    );
    const duplicateCandidate = captureError(() =>
      selector().selectMinimalTestCover({
        obligations: [obligation('A')],
        candidates: [candidate('same', { A: 'direct' }), candidate('same', { A: 'direct' })],
        defaultDurationMs: 10,
      })
    );
    const invalidPenalty = captureError(() =>
      selector().selectMinimalTestCover({
        obligations: [obligation('A')],
        candidates: [candidate('bad-cost', { A: 'direct' }, { flakePenaltyMs: -1 })],
        defaultDurationMs: 10,
      })
    );
    const invalidBonus = captureError(() =>
      selector().selectMinimalTestCover({
        obligations: [obligation('A')],
        candidates: [candidate('bad-bonus', { A: 'direct' }, { directEvidenceQualityBonusMs: -1 })],
        defaultDurationMs: 10,
      })
    );
    const invalidOracle = captureError(() =>
      selector().selectMinimalTestCover({
        obligations: [obligation('A')],
        candidates: [
          candidate('unknown-oracle', { A: 'direct' }, { oracleIndependence: 'unknown' }),
        ],
        defaultDurationMs: 10,
      })
    );
    const invalidFreshness = captureError(() =>
      selector().selectMinimalTestCover({
        obligations: [obligation('A')],
        candidates: [
          candidate('unknown-freshness', { A: 'direct' }, { timingFreshness: 'recent' }),
        ],
        defaultDurationMs: 10,
      })
    );

    expect(duplicateObligation.code).toBe('MINIMAL_TEST_COVER_INPUT_INVALID');
    expect(duplicateCandidate.code).toBe('MINIMAL_TEST_COVER_INPUT_INVALID');
    expect(invalidPenalty.code).toBe('MINIMAL_TEST_COVER_INPUT_INVALID');
    expect(invalidBonus.code).toBe('MINIMAL_TEST_COVER_INPUT_INVALID');
    expect(invalidOracle.code).toBe('MINIMAL_TEST_COVER_INPUT_INVALID');
    expect(invalidFreshness.code).toBe('MINIMAL_TEST_COVER_INPUT_INVALID');
  });

  it('exports a validator that accepts the result and rejects non-canonical duplicates', () => {
    const api = selector();
    const result = api.selectMinimalTestCover({
      obligations: [obligation('A')],
      candidates: [candidate('only', { A: 'direct' })],
      defaultDurationMs: 10,
    });

    expect(api.validateMinimalTestCoverResult(result)).toBe(result);
    expect(() =>
      api.validateMinimalTestCoverResult({
        ...result,
        selected: [...result.selected, result.selected[0]],
      })
    ).toThrow('MINIMAL_TEST_COVER_RESULT_INVALID');
    expect(() =>
      api.validateMinimalTestCoverResult({
        ...result,
        selected: [{ ...result.selected[0], coveredObligationIds: [] }],
      })
    ).toThrow('MINIMAL_TEST_COVER_RESULT_INVALID');
    expect(() =>
      api.validateMinimalTestCoverResult({
        ...result,
        selected: [{ ...result.selected[0], coveredObligationIds: ['A', 'B'] }],
      })
    ).toThrow('MINIMAL_TEST_COVER_RESULT_INVALID');
    expect(() =>
      api.validateMinimalTestCoverResult({
        ...result,
        selected: [{ ...result.selected[0], obligationEvidence: {} }],
      })
    ).toThrow('MINIMAL_TEST_COVER_RESULT_INVALID');
    expect(() =>
      api.validateMinimalTestCoverResult({
        ...result,
        selected: [null as unknown as SelectionResult['selected'][number]],
      })
    ).toThrow('MINIMAL_TEST_COVER_RESULT_INVALID');
    expect(() =>
      api.validateMinimalTestCoverResult({
        ...result,
        coverage: [
          {
            ...result.coverage[0],
            selectedEvidence: [
              null as unknown as SelectionResult['coverage'][number]['selectedEvidence'][number],
            ],
          },
        ],
      })
    ).toThrow('MINIMAL_TEST_COVER_RESULT_INVALID');
    expect(() =>
      api.validateMinimalTestCoverResult({
        ...result,
        selected: [{ ...result.selected[0], grossCostMs: result.selected[0].grossCostMs + 1 }],
      })
    ).toThrow('MINIMAL_TEST_COVER_RESULT_INVALID');
    expect(() =>
      api.validateMinimalTestCoverResult({
        ...result,
        selected: [
          {
            ...result.selected[0],
            directEvidenceQualityBonusMs: result.selected[0].directEvidenceQualityBonusMs + 1,
          },
        ],
      })
    ).toThrow('MINIMAL_TEST_COVER_RESULT_INVALID');
    expect(() =>
      api.validateMinimalTestCoverResult({
        ...result,
        selected: [{ ...result.selected[0], totalCostMs: result.selected[0].totalCostMs + 1 }],
      })
    ).toThrow('MINIMAL_TEST_COVER_RESULT_INVALID');
  });

  it('validates evidence diagnostics as canonical derived coverage evidence', () => {
    const api = selector();
    const result = api.selectMinimalTestCover({
      obligations: [obligation('A')],
      candidates: [
        candidate('a-selected', { A: 'direct' }),
        candidate('z-unselected', { A: 'direct' }, { estimatedDurationMs: 5 }),
      ],
      defaultDurationMs: 10,
    });
    const diagnostics = result.coverage[0].evidenceDiagnostics;

    expect(diagnostics.map((item) => item.identityKey)).toEqual(['a-selected', 'z-unselected']);
    expect(() =>
      api.validateMinimalTestCoverResult({
        ...result,
        coverage: [{ ...result.coverage[0], evidenceDiagnostics: undefined as never }],
      })
    ).toThrow('MINIMAL_TEST_COVER_RESULT_INVALID');
    expect(() =>
      api.validateMinimalTestCoverResult({
        ...result,
        coverage: [{ ...result.coverage[0], evidenceDiagnostics: [...diagnostics].reverse() }],
      })
    ).toThrow('MINIMAL_TEST_COVER_RESULT_INVALID');
    expect(() =>
      api.validateMinimalTestCoverResult({
        ...result,
        coverage: [
          {
            ...result.coverage[0],
            evidenceDiagnostics: [diagnostics[0], diagnostics[0]],
          },
        ],
      })
    ).toThrow('MINIMAL_TEST_COVER_RESULT_INVALID');
    expect(() =>
      api.validateMinimalTestCoverResult({
        ...result,
        coverage: [
          {
            ...result.coverage[0],
            evidenceDiagnostics: [
              { ...diagnostics[0], eligibleForCoverage: false },
              diagnostics[1],
            ],
          },
        ],
      })
    ).toThrow('MINIMAL_TEST_COVER_RESULT_INVALID');
    expect(() =>
      api.validateMinimalTestCoverResult({
        ...result,
        coverage: [
          {
            ...result.coverage[0],
            evidenceDiagnostics: [
              null as unknown as SelectionResult['coverage'][number]['evidenceDiagnostics'][number],
            ],
          },
        ],
      })
    ).toThrow('MINIMAL_TEST_COVER_RESULT_INVALID');
  });

  it('rejects diagnostics that omit an unselected candidate', () => {
    const api = selector();
    const result = api.selectMinimalTestCover({
      obligations: [obligation('A')],
      candidates: [
        candidate('a-selected', { A: 'direct' }),
        candidate('z-unselected', { A: 'direct' }, { estimatedDurationMs: 5 }),
      ],
      defaultDurationMs: 10,
    });

    expect(() =>
      api.validateMinimalTestCoverResult({
        ...result,
        coverage: [
          {
            ...result.coverage[0],
            evidenceDiagnostics: result.coverage[0].evidenceDiagnostics.filter(
              (item) => item.identityKey !== 'z-unselected'
            ),
          },
        ],
      })
    ).toThrow('MINIMAL_TEST_COVER_RESULT_INVALID');
  });

  it('rejects diagnostics that invent an unselected candidate', () => {
    const api = selector();
    const result = api.selectMinimalTestCover({
      obligations: [obligation('A')],
      candidates: [
        candidate('a-selected', { A: 'direct' }),
        candidate('z-unselected', { A: 'direct' }, { estimatedDurationMs: 5 }),
      ],
      defaultDurationMs: 10,
    });

    expect(() =>
      api.validateMinimalTestCoverResult({
        ...result,
        coverage: [
          {
            ...result.coverage[0],
            evidenceDiagnostics: [
              ...result.coverage[0].evidenceDiagnostics,
              {
                identityKey: 'zz-phantom',
                evidenceKind: 'direct',
                oracleIndependence: 'independent',
                meetsMinimumEvidenceKind: true,
                eligibleForCoverage: true,
              },
            ],
          },
        ],
      })
    ).toThrow('MINIMAL_TEST_COVER_RESULT_INVALID');
  });
});
