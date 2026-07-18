const { createHash } = require('node:crypto');
const { assertViewIsolation } = require(
  __filename.endsWith('.ts')
    ? './dual-view-derivation.ts'
    : './dual-view-derivation'
);

const EVIDENCE_STRENGTH = Object.freeze({
  coverage: 1,
  static: 2,
  behavior: 3,
  integration: 4,
  release: 5,
});

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function failure(failureClass, extra = {}) {
  const error = new Error(failureClass);
  Object.assign(error, { failureClass, ...extra });
  return error;
}

function assertNoWeakerResolution({
  issueId,
  requiredStrength,
  selectedStrength,
}) {
  const required = EVIDENCE_STRENGTH[requiredStrength] || 0;
  const selected = EVIDENCE_STRENGTH[selectedStrength] || 0;
  if (selected < required) {
    throw failure('weaker_resolution_forbidden', {
      issueId,
      requiredStrength,
      selectedStrength,
    });
  }
  return { decision: 'pass', issueId, requiredStrength, selectedStrength };
}

function commandSet(commands) {
  return new Set(
    ['direct', 'impacted', 'integration', 'regression'].flatMap(
      (kind) => commands?.[kind] || []
    )
  );
}

function issueFactory() {
  const issues = [];
  function add(issueType, details) {
    const issue = {
      issueId: `ISSUE-${String(issues.length + 1).padStart(3, '0')}`,
      issueType,
      material: true,
      status: 'unresolved',
      ...details,
    };
    issues.push(issue);
    return issue;
  }
  return { issues, add };
}

function reconcileStandaloneViews({ implementation, acceptanceEvidence }) {
  const isolation = assertViewIsolation(implementation, acceptanceEvidence);
  const implementationView = implementation.view;
  const acceptanceView = acceptanceEvidence.view;
  const commands = commandSet(implementationView.commands);
  const { issues, add } = issueFactory();

  for (const acceptance of acceptanceView.acceptanceItems || []) {
    for (const commandId of acceptance.requiredCommands || []) {
      if (!commands.has(commandId)) {
        add('omission', {
          acceptanceId: acceptance.id,
          missingCommandId: commandId,
        });
        continue;
      }
      const requiredStrength = acceptance.requiredEvidenceStrength;
      const selectedStrength =
        implementationView.commandEvidenceStrength?.[commandId] || 'coverage';
      try {
        assertNoWeakerResolution({
          issueId: `strength:${acceptance.id}:${commandId}`,
          requiredStrength,
          selectedStrength,
        });
      } catch {
        add('strength_mismatch', {
          acceptanceId: acceptance.id,
          commandId,
          requiredStrength,
          selectedStrength,
        });
      }
    }
  }

  const productionSymbols = new Set(implementationView.productionSymbols || []);
  for (const entryPoint of acceptanceView.productionEntryPoints || []) {
    if (!productionSymbols.has(entryPoint)) {
      add('conflict', {
        field: 'productionEntryPoints',
        acceptanceValue: entryPoint,
        implementationValues: [...productionSymbols],
      });
    }
  }

  for (const evidence of acceptanceView.expectedEvidence || []) {
    if (evidence.producer && !commands.has(evidence.producer)) {
      add('omission', {
        evidenceId: evidence.id,
        missingCommandId: evidence.producer,
      });
    }
  }

  const strengthIssues = issues.filter(
    (issue) => issue.issueType === 'strength_mismatch'
  );
  if (strengthIssues.length > 0) {
    throw failure('reconciliation_strength_mismatch', {
      issues: strengthIssues,
    });
  }
  const unresolvedMaterial = issues.filter(
    (issue) => issue.material && issue.status === 'unresolved'
  );
  if (unresolvedMaterial.length > 0) {
    throw failure('reconciliation_material_conflict', {
      issues: unresolvedMaterial,
    });
  }

  const graphInput = Object.freeze({
    schemaVersion: 'goal-contract-reconciled-graph-input/v1',
    sourceSnapshotHash: isolation.snapshotHash,
    tasks: implementationView.tasks,
    traceSlices: implementationView.traceSlices,
    productionSymbols: implementationView.productionSymbols,
    allowedPaths: implementationView.allowedPaths,
    commands: implementationView.commands,
    dependencies: implementationView.dependencies,
    commitPolicy: implementationView.commitPolicy,
    closeConditions: implementationView.closeConditions,
    synchronizationObligations: implementationView.synchronizationObligations,
    acceptanceItems: acceptanceView.acceptanceItems,
    negativeControls: acceptanceView.negativeControls,
    productionEntryPoints: acceptanceView.productionEntryPoints,
    manualScenarios: acceptanceView.manualScenarios,
    expectedEvidence: acceptanceView.expectedEvidence,
    antiCheatRules: acceptanceView.antiCheatRules,
    stopConditions: acceptanceView.stopConditions,
  });
  const graphInputHash = sha256(
    Buffer.from(stableStringify(graphInput), 'utf8')
  );
  return {
    graphInput,
    graphInputHash,
    issues,
    metrics: {
      reconciliationCount: 1,
      issueCount: issues.length,
      unresolvedMaterialCount: 0,
      weakerResolutionCount: 0,
    },
    outputInventory: {
      graphInputs: 1,
      markdownAuthorities: 1,
      persistedViewFiles: 0,
      persistedReconciliationFiles: 0,
    },
  };
}

module.exports = {
  assertNoWeakerResolution,
  reconcileStandaloneViews,
};
