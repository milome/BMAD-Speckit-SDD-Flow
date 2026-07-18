const {
  EVIDENCE_STRENGTH,
} = require(
  __filename.endsWith('.ts')
    ? './evidence-registry.ts'
    : './evidence-registry'
);

const EvidenceTerminalState = Object.freeze({
  BLOCKED_ENVIRONMENT: 'BLOCKED_ENVIRONMENT',
  CONVERGENCE_REQUIRED: 'CONVERGENCE_REQUIRED',
  FINAL_PASS: 'FINAL_PASS',
});

const observedEvidenceIssueCodes = Object.freeze({
  requiredFieldMissing: 'observed_evidence_required_field_missing',
  contractMismatch: 'observed_evidence_contract_mismatch',
  commitMismatch: 'observed_evidence_commit_mismatch',
  treeMismatch: 'observed_evidence_tree_mismatch',
  producerMismatch: 'observed_evidence_producer_mismatch',
  stale: 'observed_evidence_stale',
  fixtureOnly: 'observed_evidence_fixture_only',
  selfAuthored: 'observed_evidence_self_authored',
  unauthorizedSeam: 'observed_evidence_unauthorized_seam',
  strengthInsufficient: 'observed_evidence_strength_insufficient',
  negativeControlMissing: 'observed_evidence_negative_control_missing',
  realEntryMissing: 'observed_evidence_real_entry_missing',
  commandFailed: 'observed_evidence_command_failed',
  artifactMissing: 'observed_evidence_artifact_missing',
});

function issue(code, details = {}) {
  return { code, ...details };
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') {
    return Object.keys(value).length > 0;
  }
  return value !== undefined && value !== null && value !== '';
}

function validateObservedEvidence({ expected, observed, context }) {
  const issues = [];
  for (const field of expected.requiredFields || []) {
    if (!hasValue(observed?.[field])) {
      issues.push(
        issue(observedEvidenceIssueCodes.requiredFieldMissing, { field })
      );
    }
  }
  if (observed?.contractHash !== context.contractHash) {
    issues.push(issue(observedEvidenceIssueCodes.contractMismatch));
  }
  if (
    context.commitSha &&
    observed?.commitSha !== context.commitSha
  ) {
    issues.push(issue(observedEvidenceIssueCodes.commitMismatch));
  }
  if (
    context.treeIdentity &&
    observed?.treeIdentity !== context.treeIdentity
  ) {
    issues.push(issue(observedEvidenceIssueCodes.treeMismatch));
  }
  if (
    observed?.producer !== expected.producer ||
    observed?.commandId !== expected.commandId ||
    observed?.productionEntryPoint !== expected.productionEntryPoint
  ) {
    issues.push(issue(observedEvidenceIssueCodes.producerMismatch));
  }

  const completedAt = Date.parse(observed?.completedAt);
  const startedAt = Date.parse(observed?.startedAt);
  const now = context.now instanceof Date ? context.now.getTime() : Date.parse(context.now);
  if (
    !Number.isFinite(startedAt) ||
    !Number.isFinite(completedAt) ||
    !Number.isFinite(now) ||
    startedAt > completedAt ||
    completedAt > now ||
    now - completedAt > expected.freshness.maxAgeMs ||
    observed?.freshnessDecision !== 'current_execution_pass'
  ) {
    issues.push(issue(observedEvidenceIssueCodes.stale));
  }

  const originKind = String(observed?.originKind || '');
  if (['fixture', 'contract_fixture'].includes(originKind)) {
    issues.push(issue(observedEvidenceIssueCodes.fixtureOnly));
  }
  if (
    ['self_authored_pass', 'generated_prose', 'generated_contract'].includes(
      originKind
    )
  ) {
    issues.push(issue(observedEvidenceIssueCodes.selfAuthored));
  }
  if (
    ['mock', 'stub', 'fake_executor', 'replay', 'heartbeat_only'].includes(
      originKind
    )
  ) {
    issues.push(issue(observedEvidenceIssueCodes.unauthorizedSeam));
  }

  const expectedStrength = EVIDENCE_STRENGTH[expected.minimumStrength] || 0;
  const observedStrength = EVIDENCE_STRENGTH[observed?.evidenceStrength] || 0;
  if (
    !(expected.admissibleObservedEvidenceTypes || []).includes(
      observed?.evidenceType
    ) ||
    observedStrength < expectedStrength ||
    ['coverage', 'projection'].includes(observed?.evidenceType)
  ) {
    issues.push(issue(observedEvidenceIssueCodes.strengthInsufficient));
  }
  if (
    expected.productionEntryPoint &&
    observed?.realProductionEntry !== true
  ) {
    issues.push(issue(observedEvidenceIssueCodes.realEntryMissing));
  }
  if (observed?.exitCode !== 0) {
    issues.push(issue(observedEvidenceIssueCodes.commandFailed));
  }
  if (!hasValue(observed?.artifactHashes)) {
    issues.push(issue(observedEvidenceIssueCodes.artifactMissing));
  }

  if (expected.negativeControl?.required) {
    const acceptedBlockers = new Set(
      expected.negativeControl.acceptedBlockerClasses || []
    );
    const negativeControlPassed = (
      observed?.negativeControlResults || []
    ).some(
      (negative) =>
        negative.expectedNonZero ===
          expected.negativeControl.expectedNonZero &&
        Number(negative.exitCode) !== 0 &&
        acceptedBlockers.has(negative.blockerClass)
    );
    if (!negativeControlPassed) {
      issues.push(
        issue(observedEvidenceIssueCodes.negativeControlMissing)
      );
    }
  }

  return {
    decision: issues.length === 0 ? 'pass' : 'block',
    evidenceId: expected.id,
    issues,
  };
}

function evaluateEvidenceClosure({
  registry,
  observedEvidence,
  context,
  environment = {},
}) {
  const missingCapabilities = new Set(
    environment.missingCapabilities || []
  );
  const environmentBlocked = registry.items.filter((item) =>
    missingCapabilities.has(item.requiredCapability)
  );
  if (environmentBlocked.length > 0) {
    return {
      decision: 'block',
      terminalState: EvidenceTerminalState.BLOCKED_ENVIRONMENT,
      expectedEvidenceCount: registry.itemCount,
      closedEvidenceCount: 0,
      blockedCapabilities: [
        ...new Set(
          environmentBlocked.map((item) => item.requiredCapability)
        ),
      ],
      closures: [],
    };
  }

  const observedById = new Map(
    (observedEvidence || []).map((observed) => [
      observed.evidenceId,
      observed,
    ])
  );
  const closures = registry.items.map((expected) => {
    const observed = observedById.get(expected.id);
    if (!observed) {
      return {
        decision: 'block',
        evidenceId: expected.id,
        issues: [{ code: 'observed_evidence_missing' }],
      };
    }
    return validateObservedEvidence({ expected, observed, context });
  });
  const closedEvidenceCount = closures.filter(
    (closure) => closure.decision === 'pass'
  ).length;
  const complete =
    closedEvidenceCount === registry.itemCount && registry.itemCount > 0;
  return {
    decision: complete ? 'pass' : 'converge',
    terminalState: complete
      ? EvidenceTerminalState.FINAL_PASS
      : EvidenceTerminalState.CONVERGENCE_REQUIRED,
    expectedEvidenceCount: registry.itemCount,
    closedEvidenceCount,
    closures,
  };
}

module.exports = {
  EvidenceTerminalState,
  evaluateEvidenceClosure,
  observedEvidenceIssueCodes,
  validateObservedEvidence,
};
