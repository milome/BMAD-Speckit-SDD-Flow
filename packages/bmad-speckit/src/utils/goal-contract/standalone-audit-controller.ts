const { createHash } = require('node:crypto');

const STANDALONE_AUDIT_PERSPECTIVES = Object.freeze([
  'goal_semantics_boundaries',
  'execution_acceptance',
  'change_paths_project_practice',
]);

const PERSPECTIVE_GOVERNED_SLICES = Object.freeze({
  goal_semantics_boundaries: [
    'acceptance',
    'authority',
    'evidence',
    'goal',
    'non_goal',
    'scope',
    'traceability',
  ],
  execution_acceptance: [
    'acceptance',
    'commands',
    'evidence',
    'execution_order',
    'file_paths',
    'installation',
    'release',
    'schema',
    'security_boundary',
    'tests',
    'traceability',
  ],
  change_paths_project_practice: [
    'commands',
    'file_paths',
    'installation',
    'release',
    'schema',
    'security_boundary',
    'tests',
  ],
});

function failure(failureClass, details = {}) {
  const error = new Error(failureClass);
  Object.assign(error, { failureClass, ...details });
  return error;
}

function stableHash(value) {
  return `sha256:${createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex')}`;
}

function runStandaloneDeterministicPreflight({
  checks = [],
  startedAt,
  completedAt,
}) {
  const checkReceipts = checks.map((check) => {
    const output = check.run();
    const issues = (output?.issues || []).map((item) => ({
      checkId: check.id,
      ...item,
    }));
    return {
      checkId: check.id,
      decision:
        output?.decision === 'pass' && issues.length === 0 ? 'pass' : 'block',
      issues,
    };
  });
  const issues = checkReceipts.flatMap((receipt) => receipt.issues);
  const passed = checkReceipts.every(
    (receipt) => receipt.decision === 'pass'
  );

  return {
    schemaVersion: 'standalone-deterministic-preflight/v1',
    startedAt,
    completedAt,
    checkCount: checkReceipts.length,
    issueCount: issues.length,
    checkReceipts,
    issues,
    decision: passed ? 'pass' : 'block',
    auditEpochAllowed: passed,
  };
}

function freezeAuditEpoch({
  preflight,
  cycleId,
  epochNumber,
  targetHash,
  sourceHash,
  repositoryIdentity,
  openedAt,
}) {
  if (preflight?.decision !== 'pass' || preflight.auditEpochAllowed !== true) {
    throw failure('deterministic_preflight_incomplete');
  }
  if (!Number.isInteger(epochNumber) || epochNumber < 1 || epochNumber > 2) {
    throw failure('audit_epoch_limit_exceeded', { epochNumber });
  }
  for (const [field, value] of Object.entries({
    cycleId,
    targetHash,
    sourceHash,
    repositoryIdentity,
    openedAt,
  })) {
    if (!String(value || '').trim()) {
      throw failure('audit_epoch_identity_incomplete', { field });
    }
  }
  const auditEpochId = stableHash({
    cycleId,
    epochNumber,
    targetHash,
    sourceHash,
    repositoryIdentity,
  });
  return Object.freeze({
    schemaVersion: 'standalone-audit-epoch/v1',
    auditEpochId,
    cycleId,
    epochNumber,
    targetHash,
    sourceHash,
    repositoryIdentity,
    perspectiveSet: STANDALONE_AUDIT_PERSPECTIVES,
    openedAt,
    status: 'frozen',
  });
}

function findingKey(finding) {
  return JSON.stringify([
    finding.code,
    finding.severity,
    finding.location,
    finding.message,
  ]);
}

function mergeAuditFindings({ epoch, receipts = [] }) {
  const receiptByPerspective = new Map();
  for (const receipt of receipts) {
    if (
      receipt.auditEpochId !== epoch.auditEpochId ||
      receipt.targetHash !== epoch.targetHash
    ) {
      throw failure('audit_receipt_binding_mismatch', {
        perspective: receipt.perspective,
      });
    }
    if (
      !STANDALONE_AUDIT_PERSPECTIVES.includes(receipt.perspective) ||
      receiptByPerspective.has(receipt.perspective)
    ) {
      throw failure('audit_perspective_receipt_invalid', {
        perspective: receipt.perspective,
      });
    }
    receiptByPerspective.set(receipt.perspective, receipt);
  }
  const missingPerspectives = STANDALONE_AUDIT_PERSPECTIVES.filter(
    (perspective) => !receiptByPerspective.has(perspective)
  );
  if (missingPerspectives.length > 0) {
    throw failure('audit_perspective_receipt_incomplete', {
      missingPerspectives,
    });
  }

  const merged = new Map();
  for (const receipt of receipts) {
    for (const finding of receipt.findings || []) {
      const key = findingKey(finding);
      const current = merged.get(key) || {
        ...finding,
        perspectives: [],
      };
      current.perspectives.push(receipt.perspective);
      merged.set(key, current);
    }
  }
  const findings = [...merged.values()].map((finding) => ({
    ...finding,
    perspectives: [...new Set(finding.perspectives)].sort(),
  }));
  return {
    schemaVersion: 'standalone-audit-findings/v1',
    auditEpochId: epoch.auditEpochId,
    targetHash: epoch.targetHash,
    perspectiveReceiptCount: receipts.length,
    timeoutTakeoverCount: receipts.filter(
      (receipt) => receipt.executionMode === 'local_timeout_fallback'
    ).length,
    findings,
    findingCount: findings.length,
  };
}

function closeAuditEpoch({ epoch, mergedFindings, closedAt }) {
  if (
    epoch?.status !== 'frozen' ||
    mergedFindings?.auditEpochId !== epoch.auditEpochId ||
    mergedFindings?.targetHash !== epoch.targetHash
  ) {
    throw failure('audit_epoch_close_binding_mismatch');
  }
  return {
    ...epoch,
    status: 'closed',
    closedAt,
    mergedFindings,
  };
}

function perspectivesForSlice(slice) {
  if (
    ['formatting', 'heading', 'spelling', 'table_layout'].includes(slice)
  ) {
    return [];
  }
  const selected = STANDALONE_AUDIT_PERSPECTIVES.filter((perspective) =>
    PERSPECTIVE_GOVERNED_SLICES[perspective].includes(slice)
  );
  return selected.length > 0
    ? selected
    : STANDALONE_AUDIT_PERSPECTIVES;
}

function selectInvalidatedPerspectives({
  changedSlices = [],
  previousReceipts = [],
  previousHash,
  currentHash,
}) {
  const normalizedSlices = [...new Set(changedSlices.map(String))].sort();
  const selected = new Set(
    normalizedSlices.flatMap((slice) => perspectivesForSlice(slice))
  );
  const selectedPerspectives = [...selected].sort();
  const carriedForwardPerspectives = STANDALONE_AUDIT_PERSPECTIVES.filter(
    (perspective) => !selected.has(perspective)
  ).sort();
  const previousByPerspective = new Map(
    previousReceipts.map((receipt) => [receipt.perspective, receipt])
  );
  const carryForwardReceipts = carriedForwardPerspectives.map(
    (perspective) => {
      const previous = previousByPerspective.get(perspective);
      if (
        previous?.decision !== 'pass' ||
        previous?.targetHash !== previousHash
      ) {
        throw failure('audit_carry_forward_unproven', { perspective });
      }
      return {
        schemaVersion: 'standalone-audit-carry-forward/v1',
        perspective,
        previousHash,
        currentHash,
        changedSlices: normalizedSlices,
        governedSlices: PERSPECTIVE_GOVERNED_SLICES[perspective],
        preservationReason:
          'Changed slices do not intersect this perspective governance.',
        decision: 'carry_forward',
      };
    }
  );
  return {
    selectedPerspectives,
    carriedForwardPerspectives,
    carryForwardReceipts,
    finalDocsReviewRequired: false,
  };
}

function standaloneConvergenceDecision({
  closedEpochs = [],
  unresolvedFindings = [],
}) {
  if (closedEpochs.length > 2) {
    throw failure('audit_epoch_limit_exceeded', {
      epochCount: closedEpochs.length,
    });
  }
  const materialFindings = unresolvedFindings.filter(
    (finding) =>
      ['blocker', 'major'].includes(finding.severity) &&
      finding.disposition !== 'rejected'
  );
  if (materialFindings.length === 0) {
    return {
      action: 'complete',
      userPromptRequired: false,
      finalDocsReviewRequired: false,
    };
  }
  const deterministicallyRepairable = materialFindings.every(
    (finding) => finding.repairClass === 'deterministic'
  );
  if (!deterministicallyRepairable) {
    return {
      action: 'reconfirm_required',
      failureClass: 'RECONFIRM_REQUIRED',
      userPromptRequired: true,
      finalDocsReviewRequired: false,
    };
  }
  return {
    action:
      closedEpochs.length >= 2
        ? 'start_next_internal_cycle'
        : 'batch_repair_and_open_next_epoch',
    userPromptRequired: false,
    finalDocsReviewRequired: false,
  };
}

function resolveAuditProfile(entryScenario) {
  return {
    schemaVersion: 'goal-contract-audit-profile/v1',
    entryScenario,
    requiredPerspectives: STANDALONE_AUDIT_PERSPECTIVES,
    auditPerspectiveCount: STANDALONE_AUDIT_PERSPECTIVES.length,
    finalDocsReviewRequired:
      entryScenario !== 'standalone_goal_contract',
  };
}

module.exports = {
  STANDALONE_AUDIT_PERSPECTIVES,
  closeAuditEpoch,
  freezeAuditEpoch,
  mergeAuditFindings,
  resolveAuditProfile,
  runStandaloneDeterministicPreflight,
  selectInvalidatedPerspectives,
  standaloneConvergenceDecision,
};
