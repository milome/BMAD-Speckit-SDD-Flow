const { describe, it } = require('node:test');
const assert = require('node:assert');

let controller = {};
try {
  controller = require(
    '../src/utils/goal-contract/standalone-audit-controller.ts'
  );
} catch {
  // The first RED proves the production controller does not exist yet.
}

describe('standalone goal-contract audit controller', () => {
  it('blocks audit dispatch until every deterministic preflight check passes', () => {
    assert.equal(
      typeof controller.runStandaloneDeterministicPreflight,
      'function'
    );

    const executedChecks = [];
    const result = controller.runStandaloneDeterministicPreflight({
      checks: [
        {
          id: 'structure',
          run() {
            executedChecks.push('structure');
            return { decision: 'pass', issues: [] };
          },
        },
        {
          id: 'placeholder',
          run() {
            executedChecks.push('placeholder');
            return {
              decision: 'block',
              issues: [
                {
                  code: 'placeholder_unresolved',
                  location: 'completion_evidence',
                },
              ],
            };
          },
        },
        {
          id: 'command_portability',
          run() {
            executedChecks.push('command_portability');
            return { decision: 'pass', issues: [] };
          },
        },
      ],
      startedAt: '2026-07-18T05:00:00.000Z',
      completedAt: '2026-07-18T05:00:01.000Z',
    });

    assert.deepEqual(executedChecks, [
      'structure',
      'placeholder',
      'command_portability',
    ]);
    assert.equal(result.decision, 'block');
    assert.equal(result.auditEpochAllowed, false);
    assert.deepEqual(result.issues, [
      {
        checkId: 'placeholder',
        code: 'placeholder_unresolved',
        location: 'completion_evidence',
      },
    ]);
  });

  it('merges only same-epoch same-hash perspective receipts', () => {
    assert.equal(typeof controller.freezeAuditEpoch, 'function');
    assert.equal(typeof controller.mergeAuditFindings, 'function');
    assert.equal(typeof controller.closeAuditEpoch, 'function');

    const preflight = controller.runStandaloneDeterministicPreflight({
      checks: [
        {
          id: 'structure',
          run: () => ({ decision: 'pass', issues: [] }),
        },
      ],
      startedAt: '2026-07-18T05:01:00.000Z',
      completedAt: '2026-07-18T05:01:01.000Z',
    });
    const epoch = controller.freezeAuditEpoch({
      preflight,
      cycleId: 'cycle-current',
      epochNumber: 1,
      targetHash: 'sha256:target-current',
      sourceHash: 'sha256:source-current',
      repositoryIdentity: 'tree-current',
      openedAt: '2026-07-18T05:01:02.000Z',
    });
    const receipts = controller.STANDALONE_AUDIT_PERSPECTIVES.map(
      (perspective, index) => ({
        perspective,
        auditEpochId: epoch.auditEpochId,
        targetHash: epoch.targetHash,
        decision: 'pass',
        executionMode:
          index === 2 ? 'local_timeout_fallback' : 'independent_reviewer',
        findings:
          index < 2
            ? [
                {
                  code: 'scope_ambiguity',
                  severity: 'major',
                  location: 'scope',
                  message: 'Scope boundary is ambiguous.',
                  disposition: 'accepted',
                },
              ]
            : [],
      })
    );

    const merged = controller.mergeAuditFindings({ epoch, receipts });
    const closed = controller.closeAuditEpoch({
      epoch,
      mergedFindings: merged,
      closedAt: '2026-07-18T05:01:03.000Z',
    });

    assert.equal(merged.findings.length, 1);
    assert.equal(merged.findings[0].perspectives.length, 2);
    assert.equal(merged.timeoutTakeoverCount, 1);
    assert.equal(closed.status, 'closed');
    assert.equal(closed.targetHash, epoch.targetHash);

    assert.throws(
      () =>
        controller.mergeAuditFindings({
          epoch,
          receipts: receipts.map((receipt, index) =>
            index === 0
              ? { ...receipt, targetHash: 'sha256:target-stale' }
              : receipt
          ),
        }),
      (error) => error.failureClass === 'audit_receipt_binding_mismatch'
    );
  });

  it('selectively revalidates changed semantics and continues internal cycles automatically', () => {
    assert.equal(
      typeof controller.selectInvalidatedPerspectives,
      'function'
    );
    assert.equal(
      typeof controller.standaloneConvergenceDecision,
      'function'
    );

    const previousReceipts = controller.STANDALONE_AUDIT_PERSPECTIVES.map(
      (perspective) => ({
        perspective,
        targetHash: 'sha256:target-previous',
        decision: 'pass',
      })
    );
    const selection = controller.selectInvalidatedPerspectives({
      changedSlices: ['acceptance'],
      previousReceipts,
      previousHash: 'sha256:target-previous',
      currentHash: 'sha256:target-current',
    });

    assert.deepEqual(selection.selectedPerspectives, [
      'execution_acceptance',
      'goal_semantics_boundaries',
    ]);
    assert.deepEqual(selection.carriedForwardPerspectives, [
      'change_paths_project_practice',
    ]);
    assert.equal(selection.carryForwardReceipts.length, 1);
    assert.deepEqual(
      selection.carryForwardReceipts[0].changedSlices,
      ['acceptance']
    );

    const formattingOnly = controller.selectInvalidatedPerspectives({
      changedSlices: ['formatting'],
      previousReceipts,
      previousHash: 'sha256:target-previous',
      currentHash: 'sha256:target-current',
    });
    assert.deepEqual(formattingOnly.selectedPerspectives, []);
    assert.equal(formattingOnly.finalDocsReviewRequired, false);

    const decision = controller.standaloneConvergenceDecision({
      closedEpochs: [{ epochNumber: 1 }, { epochNumber: 2 }],
      unresolvedFindings: [
        {
          severity: 'major',
          disposition: 'accepted',
          repairClass: 'deterministic',
        },
      ],
    });
    assert.equal(decision.action, 'start_next_internal_cycle');
    assert.equal(decision.userPromptRequired, false);
    assert.equal(decision.finalDocsReviewRequired, false);
  });

  it('scopes the final docs-review exception to standalone goal contracts', () => {
    assert.equal(typeof controller.resolveAuditProfile, 'function');

    const standalone = controller.resolveAuditProfile(
      'standalone_goal_contract'
    );
    const unrelated = controller.resolveAuditProfile(
      'requirements_document'
    );

    assert.equal(standalone.finalDocsReviewRequired, false);
    assert.equal(standalone.auditPerspectiveCount, 3);
    assert.equal(unrelated.finalDocsReviewRequired, true);
    assert.equal(unrelated.auditPerspectiveCount, 3);
  });
});
