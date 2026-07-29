const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  findNonDeterministicPhrase,
  validateDeterministicSourceObligations,
} = require('../src/utils/goal-contract/non-deterministic-source-validator.ts');

describe('goal-contract non-deterministic source validator', () => {
  it('accepts deterministic permissions, capability gates, and bounded optional policy', () => {
    const deterministicStatements = [
      'Either model may find implementation defects or acceptance-evidence defects.',
      'Only its assessment of sealed current bytes may support EffectivePass.',
      'The host may persist normalized score and receipts. It cannot approve finalization.',
      'Two tasks may remain parallel while one Integration Join owns fan-in.',
      'The test may not write a bundle fixture.',
      'The staged manifest is byte-identical to the artifact a later stage may publish.',
      'The publisher may write receipts at fixed paths but must never rewrite manifest semantics.',
      'The EvidenceManifest decides which frozen evidence may be used.',
      'Exactly two parent-Goal semantic invocations may pass.',
      'The initial Final Judge may approve only the unchanged clean snapshot.',
      'Deterministic repair handling may retry bounded units without creating another semantic audit.',
      'Later slices may modify generated manifests but not semantic orchestration.',
      'No actor or timeout may create a third Final Judge attempt.',
      'Exactly one PostRemediationAttemptKey is allowed after verified publication.',
      'Sequential modification is allowed; unresolved concurrent ownership is not.',
      'Validate allowed tools and readonly snapshot access.',
      'J02 closes when current deterministic evidence can produce the mechanical receipt.',
      'Require stale receipts before final integration can pass.',
      'Different source shapes can produce different counts.',
      'Any optional remediation executor is counted and cannot alter audit budgets.',
      'Add optional `--release-receipt`; otherwise use the default receipt path.',
    ];

    for (const statement of deterministicStatements) {
      assert.equal(
        findNonDeterministicPhrase(statement),
        null,
        statement
      );
    }
  });

  it('rejects unbounded discretionary and unresolved execution wording', () => {
    const ambiguousStatements = new Map([
      ['Optional internal refactor updates the compiler.', 'optional'],
      ['The allowed seam updates the compiler.', 'allowed'],
      ['The implementation might update the compiler.', 'might'],
      ['The implementation should update the compiler.', 'should'],
      ['The implementation may update the compiler.', 'may'],
      ['The implementation can update the compiler.', 'can'],
      ['Update the compiler as needed.', 'as needed'],
      ['Update the compiler where appropriate.', 'where appropriate'],
    ]);

    for (const [statement, phrase] of ambiguousStatements) {
      assert.equal(findNonDeterministicPhrase(statement), phrase, statement);
    }
  });

  it('preserves validator failure metadata for a genuine ambiguous obligation', () => {
    assert.throws(
      () =>
        validateDeterministicSourceObligations([
          {
            id: 'TASK-001',
            kind: 'heading_execution_segment',
            lineStart: 4,
            lineEnd: 4,
            text: 'The implementation can update the compiler.',
          },
        ]),
      (error) =>
        error.failureClass === 'non_deterministic_source_obligation' &&
        error.sourceId === 'TASK-001' &&
        error.matchedPhrase === 'can'
    );
  });
});
