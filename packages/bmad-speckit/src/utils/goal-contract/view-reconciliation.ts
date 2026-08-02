const { createHash } = require('node:crypto');
const { assertViewIsolation } = require(
  __filename.endsWith('.ts') ? './dual-view-derivation.ts' : './dual-view-derivation'
);

export type GoalContractViewReconciliationModule = never;

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

function assertNoWeakerResolution({ issueId, requiredStrength, selectedStrength }) {
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
    ['direct', 'impacted', 'integration', 'regression'].flatMap((kind) =>
      (commands?.[kind] || []).map((command) =>
        typeof command === 'string' ? command : command?.id
      )
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

function canonicalizeValue(value) {
  if (Array.isArray(value)) {
    return value
      .map(canonicalizeValue)
      .sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalizeValue(value[key])])
    );
  }
  return value;
}

function validateDerivationAuthorityFields(derivation) {
  const forbidden = new Set(['partitionId', 'partitionCount', 'atomicTaskId', 'closureDecision']);
  const findings = [];
  function visit(value, currentPath) {
    if (Array.isArray(value)) {
      value.forEach((child, index) => visit(child, `${currentPath}[${index}]`));
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const childPath = currentPath ? `${currentPath}.${key}` : key;
      if (forbidden.has(key)) findings.push(childPath);
      visit(child, childPath);
    }
  }
  visit(derivation, 'derivation');
  if (findings.length > 0) {
    throw failure('reconciliation_authority_field_forbidden', {
      forbiddenFields: findings,
    });
  }
}

function validateStructuredDerivationReceipts(derivation, sourceSnapshotHash) {
  const receipts = [derivation?.implementation?.receipt, derivation?.acceptanceEvidence?.receipt];
  if (
    receipts.some(
      (receipt) =>
        receipt?.inputHash !== sourceSnapshotHash || receipt?.persistedViewAuthorityFiles !== 0
    )
  ) {
    throw failure('structured_derivation_receipt_invalid');
  }
}

function collectSourceBoundIssues({
  sourceObligations,
  implementationView,
  acceptanceEvidenceView,
}) {
  const issues = [];
  const add = (failureClass, details) =>
    issues.push({
      issueId: `ISSUE-${String(issues.length + 1).padStart(3, '0')}`,
      failureClass,
      material: true,
      status: 'unresolved',
      ...details,
    });
  const applicableSources = new Set(
    sourceObligations
      .filter((item) => item.applicabilityState === 'applicable')
      .map((item) => item.id)
  );
  const referencedSources = new Set();
  for (const record of [
    ...(implementationView.tasks || []),
    ...(implementationView.traceSlices || []),
    ...(acceptanceEvidenceView.acceptanceItems || []),
    ...(acceptanceEvidenceView.expectedEvidence || []),
  ]) {
    for (const sourceId of record.sourceIds || []) referencedSources.add(sourceId);
  }
  for (const sourceId of applicableSources) {
    if (!referencedSources.has(sourceId)) {
      add('reconciliation_source_obligation_omitted', { sourceId });
    }
  }
  const implementationTasks = implementationView.tasks || [];
  const taskMap = new Map<string, { id: string; atomicGroupRefs?: string[] }>(
    implementationTasks.map((task) => [task.id, task])
  );
  for (const task of implementationView.tasks || []) {
    const sourceIds = task.sourceIds || [];
    if (sourceIds.length === 0 || sourceIds.some((sourceId) => !applicableSources.has(sourceId))) {
      add('reconciliation_task_without_source', { taskId: task.id, sourceIds });
    }
  }
  const implementationDependencies = new Set(
    (implementationView.dependencies || []).map((edge) => `${edge.from}->${edge.to}`)
  );
  for (const acceptance of acceptanceEvidenceView.acceptanceItems || []) {
    for (const edge of acceptance.dependencyAssertions || []) {
      if (implementationDependencies.has(`${edge.to}->${edge.from}`)) {
        add('reconciliation_dependency_conflict', { edge });
      }
    }
    for (const taskId of acceptance.goalIds || acceptance.taskIds || []) {
      const expected = [...(taskMap.get(taskId)?.atomicGroupRefs || [])].sort();
      const observed = [...(acceptance.atomicGroupRefs || [])].sort();
      if (observed.length > 0 && stableStringify(expected) !== stableStringify(observed)) {
        add('reconciliation_atomic_group_conflict', {
          taskId,
          expected,
          observed,
        });
      }
    }
    if (
      (acceptance.goalIds || acceptance.taskIds || []).length === 0 &&
      (acceptance.requiredCommands || []).length === 0 &&
      (acceptance.expectedEvidenceIds || []).length === 0
    ) {
      add('reconciliation_acceptance_unreachable', {
        acceptanceId: acceptance.id,
      });
    }
  }
  const commands = commandSet(implementationView.commands);
  for (const acceptance of acceptanceEvidenceView.acceptanceItems || []) {
    for (const commandId of acceptance.requiredCommands || []) {
      const requiredStrength = acceptance.requiredEvidenceStrength;
      const selectedStrength =
        implementationView.commandEvidenceStrength?.[commandId] || 'coverage';
      if (
        !commands.has(commandId) ||
        (EVIDENCE_STRENGTH[selectedStrength] || 0) < (EVIDENCE_STRENGTH[requiredStrength] || 0)
      ) {
        add('reconciliation_strength_mismatch', {
          acceptanceId: acceptance.id,
          commandId,
          requiredStrength,
          selectedStrength,
        });
      }
    }
  }
  return issues;
}

function reconcileGoalContractViews({
  sourceSnapshot,
  sourceObligationGraph,
  sourceObligationGraphHash,
  methodologyProfileHash,
  semanticModelHash,
  derivation,
}) {
  validateDerivationAuthorityFields(derivation);
  if (derivation?.mode === 'semantic_completion') {
    assertViewIsolation(derivation.implementation, derivation.acceptanceEvidence);
  } else {
    validateStructuredDerivationReceipts(derivation, sourceSnapshot?.aggregateHash);
  }
  const implementationView = derivation?.implementation?.view || {};
  const acceptanceEvidenceView = derivation?.acceptanceEvidence?.view || {};
  const issues = collectSourceBoundIssues({
    sourceObligations: sourceObligationGraph?.obligations || [],
    implementationView,
    acceptanceEvidenceView,
  });
  const blocking = issues.filter((issue) => issue.material && issue.status === 'unresolved');
  if (blocking.length > 0) {
    throw failure(blocking[0].failureClass, { issues: blocking });
  }
  const graphInput = canonicalizeValue({
    schemaVersion: 'goal-contract-reconciled-graph-input/v2',
    sourceSnapshotHash: sourceSnapshot.aggregateHash,
    sourceObligationGraphHash,
    methodologyProfileHash,
    semanticModelHash,
    semanticDerivationMode: derivation.mode,
    sourceObligations: sourceObligationGraph.obligations,
    tasks: implementationView.tasks,
    traceSlices: implementationView.traceSlices,
    productionSymbols: implementationView.productionSymbols,
    allowedPaths: implementationView.allowedPaths,
    commands: implementationView.commands,
    dependencies: implementationView.dependencies,
    commitPolicy: implementationView.commitPolicy,
    closeConditions: implementationView.closeConditions,
    synchronizationObligations: implementationView.synchronizationObligations,
    acceptanceItems: acceptanceEvidenceView.acceptanceItems,
    negativeControls: acceptanceEvidenceView.negativeControls,
    productionEntryPoints: acceptanceEvidenceView.productionEntryPoints,
    manualScenarios: acceptanceEvidenceView.manualScenarios,
    expectedEvidence: acceptanceEvidenceView.expectedEvidence,
    antiCheatRules: acceptanceEvidenceView.antiCheatRules,
    stopConditions: acceptanceEvidenceView.stopConditions,
  });
  return Object.freeze({
    graphInput,
    graphInputHash: sha256(Buffer.from(stableStringify(graphInput), 'utf8')),
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
  });
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

  const strengthIssues = issues.filter((issue) => issue.issueType === 'strength_mismatch');
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
  const graphInputHash = sha256(Buffer.from(stableStringify(graphInput), 'utf8'));
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
  reconcileGoalContractViews,
  reconcileStandaloneViews,
};
