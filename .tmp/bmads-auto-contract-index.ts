export type ConsumerExposure = 'internal' | 'runtime' | 'ci' | 'debug';

export interface ContractIndexEntry {
  contractId: string;
  sourceSectionRefs: string[];
  requirementRefs: string[];
  gapRefs: string[];
  fixtureRefs: string[];
  runtimeArtifacts: string[];
  blockingResultCodes: string[];
  implementationTargets: string[];
  testTargets: string[];
  verifyResponsibilities: {
    verifyDesign: boolean;
    verifyRun: boolean;
  };
  consumerExposure: ConsumerExposure;
}

export interface ContractIndexReport {
  schemaVersion: 'bmads_auto_contract_index/v1';
  generatedBy: 'bmads-auto contract-index';
  scope: ContractIndexScope;
  contractCount: number;
  contracts: ContractIndexEntry[];
  resultCode: 'OK' | 'BLOCKED_CONTRACT_INDEX_INVALID';
  blockers: string[];
}

const commonVerify = { verifyDesign: true, verifyRun: true };
export type ContractIndexScope = 'runtime' | 'product-design';

const runtimeTargets = {
  cli: ['scripts/bmads-auto-cli.ts'],
  planner: ['scripts/bmads-auto-planner.ts'],
  dispatch: ['scripts/bmads-auto-dispatch.ts'],
  gaps: ['scripts/bmads-auto-gaps.ts'],
  traceability: ['scripts/bmads-auto-traceability.ts'],
  closeout: ['scripts/bmads-auto-closeout.ts'],
  verify: ['scripts/bmads-auto-verify.ts'],
  contractIndex: ['scripts/bmads-auto-contract-index.ts'],
};

export const requiredContractIds = [
  'CONTRACT-CLI-API',
  'CONTRACT-ORCHESTRATION-RUNTIME',
  'CONTRACT-5-SIGNAL',
  'CONTRACT-ROUTING-AUTHORITY',
  'CONTRACT-READINESS-NORMALIZATION',
  'CONTRACT-RERUN-GATES',
  'CONTRACT-AUDIT-LOOP',
  'CONTRACT-REPAIR-LOOP',
  'CONTRACT-DISPATCH-ELIGIBILITY',
  'CONTRACT-HOST-ASSIGNMENT-FALLBACK',
  'CONTRACT-TASKREPORT-INGEST',
  'CONTRACT-LEASE-LIFECYCLE',
  'CONTRACT-DRIFT-CHECKPOINT',
  'CONTRACT-GAP-REGISTRY',
  'CONTRACT-TRACEABILITY',
  'CONTRACT-FIXTURE-REGISTRY',
  'CONTRACT-WAVE-CLOSEOUT',
  'CONTRACT-FINAL-CLOSEOUT',
  'CONTRACT-SPRINT-STATUS-AUTHORIZATION',
  'CONTRACT-RELEASE-GATE',
  'CONTRACT-DELIVERY-TRUTH',
  'CONTRACT-PROVENANCE-SAME-RUN',
  'CONTRACT-RISK-OPEN-QUESTIONS',
] as const;

export function buildContractIndex(): ContractIndexEntry[] {
  return buildProductDesignContractIndex();
}

export function buildProductDesignContractIndex(): ContractIndexEntry[] {
  return [
    entry('CONTRACT-CLI-API', ['7.3', '7.8', '20'], ['REQ-023', 'REQ-026', 'REQ-027'], ['G4', 'G54', 'G55'], ['E2E-19', 'E2E-29', 'E2E-30'], ['bmads-auto stdout json', 'verify-design-report.json', 'verify-run-report.json'], ['BLOCKED_UNKNOWN_COMMAND', 'BLOCKED_INVALID_MODE'], runtimeTargets.cli, ['tests/acceptance/bmads-auto-cli-contract.test.ts', 'tests/acceptance/bmads-auto-contract-index.test.ts'], 'runtime'),
    entry('CONTRACT-ORCHESTRATION-RUNTIME', ['3.0', '23.0'], ['REQ-002', 'REQ-006', 'REQ-008', 'REQ-026'], ['G9', 'G15', 'G54'], ['E2E-20', 'E2E-21', 'E2E-30'], ['run-manifest.json', 'execution-plan.json'], ['BLOCKED_RUN_NOT_FOUND', 'BLOCKED_STATE_TRANSITION'], [...runtimeTargets.cli, ...runtimeTargets.planner], ['tests/acceptance/bmads-auto-state-machine.test.ts'], 'runtime'),
    entry('CONTRACT-5-SIGNAL', ['3.1', '8'], ['REQ-017', 'REQ-026'], ['G43', 'G52', 'G54'], ['E2E-13', 'E2E-29'], ['contractHashes.governance', 'stage evidence index'], ['BLOCKED_CONTRACT_MISMATCH'], [...runtimeTargets.cli, ...runtimeTargets.contractIndex], ['tests/acceptance/bmads-auto-contract-index.test.ts'], 'runtime'),
    entry('CONTRACT-ROUTING-AUTHORITY', ['3.0', '7.5'], ['REQ-020', 'REQ-026'], ['G49', 'G54'], ['E2E-08', 'E2E-29', 'E2E-30'], ['authority-binding receipt', 'run-manifest.json'], ['BLOCKED_ROUTE_MISMATCH'], [...runtimeTargets.cli, ...runtimeTargets.dispatch], ['tests/acceptance/bmads-auto-dispatch-taskreport.test.ts'], 'runtime'),
    entry('CONTRACT-READINESS-NORMALIZATION', ['5', '6'], ['REQ-003', 'REQ-026'], ['G7', 'G8', 'G54'], ['E2E-03', 'E2E-05', 'E2E-29'], ['artifact-preflight-report.json'], ['BLOCKED_READINESS_STALE', 'BLOCKED_MISSING_RUNTIME'], [...runtimeTargets.cli, ...runtimeTargets.planner], ['tests/acceptance/bmads-auto-cli-contract.test.ts'], 'runtime'),
    entry('CONTRACT-RERUN-GATES', ['10', '22.1'], ['REQ-011', 'REQ-025', 'REQ-026'], ['G26', 'G27', 'G54'], ['E2E-14', 'E2E-29'], ['rerun-log.json', 'repair receipt'], ['BLOCKED_RERUN_BUDGET_EXCEEDED'], [runtimeTargets.gaps[0]], ['tests/acceptance/bmads-auto-gap-registry.test.ts'], 'runtime'),
    entry('CONTRACT-AUDIT-LOOP', ['10', '25'], ['REQ-011', 'REQ-026'], ['G23', 'G24', 'G54'], ['E2E-06', 'E2E-14', 'E2E-29'], ['audit-report.json', 'post-audit-report.json'], ['BLOCKED_AUDIT_MISSING'], [runtimeTargets.closeout[0]], ['tests/acceptance/bmads-auto-baseline-closeout.test.ts'], 'runtime'),
    entry('CONTRACT-REPAIR-LOOP', ['21'], ['REQ-021', 'REQ-025', 'REQ-026'], ['G31', 'G32', 'G33', 'G34', 'G35', 'G54'], ['E2E-16', 'E2E-29'], ['requirement-repair-task.json', 'workflow-bridge-receipt.json', 'preserved-evidence-adoption-receipt.json'], ['BLOCKED_REPAIR_OPEN'], [runtimeTargets.gaps[0]], ['tests/acceptance/bmads-auto-gap-registry.test.ts'], 'runtime'),
    entry('CONTRACT-DISPATCH-ELIGIBILITY', ['7.5', '12'], ['REQ-008', 'REQ-018', 'REQ-026'], ['G16', 'G20', 'G54'], ['E2E-07', 'E2E-21', 'E2E-30'], ['dispatch-packet.json', 'dispatch-ack.json'], ['BLOCKED_DISPATCH_PROVENANCE', 'BLOCKED_WRITE_SCOPE'], [runtimeTargets.dispatch[0]], ['tests/acceptance/bmads-auto-dispatch-taskreport.test.ts'], 'runtime'),
    entry('CONTRACT-HOST-ASSIGNMENT-FALLBACK', ['13'], ['REQ-020', 'REQ-023', 'REQ-026'], ['G19', 'G20', 'G21', 'G22', 'G54'], ['E2E-11', 'E2E-17', 'E2E-30'], ['host-assignment-plan.json'], ['BLOCKED_UNSUPPORTED_HOST'], [runtimeTargets.planner[0]], ['tests/acceptance/bmads-auto-planner.test.ts'], 'runtime'),
    entry('CONTRACT-TASKREPORT-INGEST', ['14'], ['REQ-018', 'REQ-026', 'REQ-027'], ['G23', 'G24', 'G54', 'G55'], ['E2E-07', 'E2E-22', 'E2E-30'], ['taskreport-ingest-receipt.json'], ['BLOCKED_TASKREPORT_INVALID', 'BLOCKED_TASKREPORT_STALE'], [runtimeTargets.dispatch[0]], ['tests/acceptance/bmads-auto-dispatch-taskreport.test.ts'], 'runtime'),
    entry('CONTRACT-LEASE-LIFECYCLE', ['14', '23.0'], ['REQ-018', 'REQ-026'], ['G24', 'G54'], ['E2E-21', 'E2E-22', 'E2E-30'], ['lease-log.jsonl', 'openLeases'], ['BLOCKED_OPEN_LEASES'], [runtimeTargets.dispatch[0]], ['tests/acceptance/bmads-auto-dispatch-taskreport.test.ts'], 'runtime'),
    entry('CONTRACT-DRIFT-CHECKPOINT', ['15'], ['REQ-024', 'REQ-026'], ['G43', 'G54'], ['E2E-16', 'E2E-21', 'E2E-30'], ['drift-checkpoints.json', 'run-manifest.json'], ['BLOCKED_DRIFT_DETECTED'], [runtimeTargets.dispatch[0]], ['tests/acceptance/bmads-auto-dispatch-taskreport.test.ts'], 'runtime'),
    entry('CONTRACT-GAP-REGISTRY', ['21', '22'], ['REQ-025', 'REQ-026', 'REQ-027'], ['G28', 'G29', 'G30', 'G54', 'G55'], ['E2E-25', 'E2E-26', 'E2E-29', 'E2E-30'], ['gap-registry.json'], ['BLOCKED_OPEN_GAPS'], [runtimeTargets.gaps[0]], ['tests/acceptance/bmads-auto-gap-registry.test.ts'], 'runtime'),
    entry('CONTRACT-TRACEABILITY', ['22.2'], ['REQ-020', 'REQ-026', 'REQ-027'], ['G44', 'G54', 'G55'], ['E2E-27', 'E2E-29', 'E2E-30'], ['traceability-matrix.json'], ['BLOCKED_TRACEABILITY_INCOMPLETE'], [runtimeTargets.traceability[0]], ['tests/acceptance/bmads-auto-traceability.test.ts'], 'runtime'),
    entry('CONTRACT-FIXTURE-REGISTRY', ['22.1'], ['REQ-026', 'REQ-027'], ['G53', 'G54', 'G55'], ['E2E-28', 'E2E-29', 'E2E-30'], ['fixture-registry.json'], ['BLOCKED_FIXTURE_ORPHAN'], [runtimeTargets.traceability[0]], ['tests/acceptance/bmads-auto-traceability.test.ts'], 'ci'),
    entry('CONTRACT-WAVE-CLOSEOUT', ['12', '25'], ['REQ-012', 'REQ-026'], ['G15', 'G16', 'G54'], ['E2E-21', 'E2E-30'], ['wave-closeout-receipt.json'], ['BLOCKED_WAVE_NOT_TERMINAL'], [runtimeTargets.closeout[0]], ['tests/acceptance/bmads-auto-baseline-closeout.test.ts'], 'runtime'),
    entry('CONTRACT-FINAL-CLOSEOUT', ['19', '25'], ['REQ-013', 'REQ-014', 'REQ-026'], ['G28', 'G29', 'G30', 'G45', 'G54'], ['E2E-12', 'E2E-28', 'E2E-30'], ['completion-receipt.json'], ['BLOCKED_CLOSEOUT'], [runtimeTargets.closeout[0]], ['tests/acceptance/bmads-auto-baseline-closeout.test.ts'], 'runtime'),
    entry('CONTRACT-SPRINT-STATUS-AUTHORIZATION', ['19', '25'], ['REQ-013', 'REQ-026', 'REQ-VERIFY-003'], ['G30', 'G54', 'G55'], ['E2E-12', 'E2E-30'], ['sprint-authorization.json', 'sprint-audit.json'], ['BLOCKED_SPRINT_STATUS_AUTHORIZATION'], [runtimeTargets.closeout[0]], ['tests/acceptance/bmads-auto-baseline-closeout.test.ts'], 'runtime'),
    entry('CONTRACT-RELEASE-GATE', ['19', '25'], ['REQ-013', 'REQ-025', 'REQ-026'], ['G28', 'G29', 'G54'], ['E2E-12', 'E2E-30'], ['release-gate-report.json'], ['BLOCKED_RELEASE_GATE'], [runtimeTargets.closeout[0]], ['tests/acceptance/bmads-auto-baseline-closeout.test.ts'], 'runtime'),
    entry('CONTRACT-DELIVERY-TRUTH', ['20', '25'], ['REQ-013', 'REQ-014', 'REQ-022', 'REQ-VERIFY-003'], ['G30', 'G51', 'G54', 'G55'], ['E2E-18', 'E2E-28', 'E2E-30'], ['delivery-truth-report.json'], ['BLOCKED_DELIVERY_TRUTH', 'BLOCKED_REAL_8H_EVIDENCE_MISSING'], [runtimeTargets.closeout[0]], ['tests/acceptance/bmads-auto-baseline-closeout.test.ts'], 'runtime'),
    entry('CONTRACT-PROVENANCE-SAME-RUN', ['3.3', '7.7'], ['REQ-020', 'REQ-026'], ['G43', 'G44', 'G54'], ['E2E-12', 'E2E-27', 'E2E-30'], ['contractHashes', 'gateReportHashes'], ['BLOCKED_PROVENANCE_DRIFT'], [runtimeTargets.traceability[0], runtimeTargets.closeout[0]], ['tests/acceptance/bmads-auto-traceability.test.ts'], 'runtime'),
    entry('CONTRACT-RISK-OPEN-QUESTIONS', ['26'], ['REQ-025', 'REQ-026'], ['G54', 'G55'], ['E2E-23', 'E2E-30'], ['risk-register.json'], ['BLOCKED_OPEN_RISKS'], [runtimeTargets.closeout[0]], ['tests/acceptance/bmads-auto-baseline-closeout.test.ts'], 'debug'),
  ];
}

export function buildRuntimeProtocolContractIndex(): ContractIndexEntry[] {
  return [
    runtimeEntry('CONTRACT-CLI-API', ['bmads-auto CLI stdout json'], ['BLOCKED_UNKNOWN_COMMAND', 'BLOCKED_INVALID_MODE'], 'runtime'),
    runtimeEntry('CONTRACT-ORCHESTRATION-RUNTIME', ['run-manifest.json', 'execution-plan.json'], ['BLOCKED_RUN_NOT_FOUND', 'BLOCKED_STATE_TRANSITION'], 'runtime'),
    runtimeEntry('CONTRACT-5-SIGNAL', ['contractHashes.governance', 'stage evidence index'], ['BLOCKED_CONTRACT_MISMATCH'], 'runtime'),
    runtimeEntry('CONTRACT-ROUTING-AUTHORITY', ['authority-binding receipt', 'run-manifest.json'], ['BLOCKED_ROUTE_MISMATCH'], 'runtime'),
    runtimeEntry('CONTRACT-READINESS-NORMALIZATION', ['artifact-preflight-report.json'], ['BLOCKED_READINESS_STALE', 'BLOCKED_MISSING_RUNTIME'], 'runtime'),
    runtimeEntry('CONTRACT-RERUN-GATES', ['rerun-log.json', 'repair receipt'], ['BLOCKED_RERUN_BUDGET_EXCEEDED'], 'runtime'),
    runtimeEntry('CONTRACT-AUDIT-LOOP', ['audit-report.json', 'post-audit-report.json'], ['BLOCKED_AUDIT_MISSING'], 'runtime'),
    runtimeEntry('CONTRACT-REPAIR-LOOP', ['requirement-repair-task.json', 'workflow-bridge-receipt.json', 'preserved-evidence-adoption-receipt.json'], ['BLOCKED_REPAIR_OPEN'], 'runtime'),
    runtimeEntry('CONTRACT-DISPATCH-ELIGIBILITY', ['dispatch-packet.json', 'dispatch-ack.json'], ['BLOCKED_DISPATCH_PROVENANCE', 'BLOCKED_WRITE_SCOPE'], 'runtime'),
    runtimeEntry('CONTRACT-HOST-ASSIGNMENT-FALLBACK', ['host-assignment-plan.json'], ['BLOCKED_UNSUPPORTED_HOST'], 'runtime'),
    runtimeEntry('CONTRACT-TASKREPORT-INGEST', ['taskreport-ingest-receipt.json'], ['BLOCKED_TASKREPORT_INVALID', 'BLOCKED_TASKREPORT_STALE'], 'runtime'),
    runtimeEntry('CONTRACT-LEASE-LIFECYCLE', ['lease-log.jsonl', 'openLeases'], ['BLOCKED_OPEN_LEASES'], 'runtime'),
    runtimeEntry('CONTRACT-DRIFT-CHECKPOINT', ['drift-checkpoints.json', 'run-manifest.json'], ['BLOCKED_DRIFT_DETECTED'], 'runtime'),
    runtimeEntry('CONTRACT-GAP-REGISTRY', ['gap-registry.json'], ['BLOCKED_OPEN_GAPS'], 'runtime'),
    runtimeEntry('CONTRACT-TRACEABILITY', ['traceability-matrix.json'], ['BLOCKED_TRACEABILITY_INCOMPLETE'], 'runtime'),
    runtimeEntry('CONTRACT-FIXTURE-REGISTRY', ['fixture-registry.json'], ['BLOCKED_FIXTURE_ORPHAN'], 'ci'),
    runtimeEntry('CONTRACT-WAVE-CLOSEOUT', ['wave-closeout-receipt.json'], ['BLOCKED_WAVE_NOT_TERMINAL'], 'runtime'),
    runtimeEntry('CONTRACT-FINAL-CLOSEOUT', ['completion-receipt.json'], ['BLOCKED_CLOSEOUT'], 'runtime'),
    runtimeEntry('CONTRACT-SPRINT-STATUS-AUTHORIZATION', ['sprint-authorization.json', 'sprint-audit.json'], ['BLOCKED_SPRINT_STATUS_AUTHORIZATION'], 'runtime'),
    runtimeEntry('CONTRACT-RELEASE-GATE', ['release-gate-report.json'], ['BLOCKED_RELEASE_GATE'], 'runtime'),
    runtimeEntry('CONTRACT-DELIVERY-TRUTH', ['delivery-truth-report.json'], ['BLOCKED_DELIVERY_TRUTH', 'BLOCKED_REAL_8H_EVIDENCE_MISSING'], 'runtime'),
    runtimeEntry('CONTRACT-PROVENANCE-SAME-RUN', ['contractHashes', 'gateReportHashes'], ['BLOCKED_PROVENANCE_DRIFT'], 'runtime'),
    runtimeEntry('CONTRACT-RISK-OPEN-QUESTIONS', ['risk-register.json'], ['BLOCKED_OPEN_RISKS'], 'debug'),
  ];
}

function runtimeEntry(
  contractId: string,
  runtimeArtifacts: string[],
  blockingResultCodes: string[],
  consumerExposure: ConsumerExposure
): ContractIndexEntry {
  return {
    contractId,
    sourceSectionRefs: ['runtime-protocol'],
    requirementRefs: ['RUN-SPECIFIC'],
    gapRefs: [],
    fixtureRefs: ['RUN-SPECIFIC'],
    runtimeArtifacts,
    blockingResultCodes,
    implementationTargets: ['bmads-auto-runtime-protocol'],
    testTargets: ['consumer-project-ci-or-debug'],
    verifyResponsibilities: {
      verifyDesign: false,
      verifyRun: true,
    },
    consumerExposure,
  };
}

function entry(
  contractId: string,
  sourceSectionRefs: string[],
  requirementRefs: string[],
  gapRefs: string[],
  fixtureRefs: string[],
  runtimeArtifacts: string[],
  blockingResultCodes: string[],
  implementationTargets: string[],
  testTargets: string[],
  consumerExposure: ConsumerExposure
): ContractIndexEntry {
  return {
    contractId,
    sourceSectionRefs,
    requirementRefs,
    gapRefs,
    fixtureRefs,
    runtimeArtifacts,
    blockingResultCodes,
    implementationTargets,
    testTargets,
    verifyResponsibilities: commonVerify,
    consumerExposure,
  };
}

export function validateContractIndex(contracts: ContractIndexEntry[]): {
  resultCode: 'OK' | 'BLOCKED_CONTRACT_INDEX_INVALID';
  blockers: string[];
} {
  const blockers: string[] = [];
  const byId = new Map<string, number>();
  for (const contract of contracts) {
    byId.set(contract.contractId, (byId.get(contract.contractId) ?? 0) + 1);
    if (contract.sourceSectionRefs.length === 0) blockers.push(`${contract.contractId}:sourceSectionRefs`);
    if (contract.requirementRefs.length === 0) blockers.push(`${contract.contractId}:requirementRefs`);
    if (contract.gapRefs.length === 0 && contract.fixtureRefs.length === 0) {
      blockers.push(`${contract.contractId}:gapOrFixtureRefs`);
    }
    if (contract.runtimeArtifacts.length === 0) blockers.push(`${contract.contractId}:runtimeArtifacts`);
    if (contract.blockingResultCodes.length === 0) blockers.push(`${contract.contractId}:blockingResultCodes`);
    if (contract.implementationTargets.length === 0) blockers.push(`${contract.contractId}:implementationTargets`);
    if (contract.testTargets.length === 0) blockers.push(`${contract.contractId}:testTargets`);
    if (!contract.verifyResponsibilities.verifyDesign && !contract.verifyResponsibilities.verifyRun) {
      blockers.push(`${contract.contractId}:verifyResponsibilities`);
    }
    const joined = [
      ...contract.runtimeArtifacts,
      ...contract.implementationTargets,
      ...contract.testTargets,
    ].join('\n').toLowerCase();
    for (const forbidden of ['vibe', 'xl plan', 'child-agent', 'phase receipt', 'cleanup receipt']) {
      if (joined.includes(forbidden)) blockers.push(`${contract.contractId}:forbidden_${forbidden.replace(/\s+/g, '_')}`);
    }
  }
  for (const contractId of requiredContractIds) {
    const count = byId.get(contractId) ?? 0;
    if (count === 0) blockers.push(`${contractId}:missing`);
    if (count > 1) blockers.push(`${contractId}:duplicate`);
  }
  return {
    resultCode: blockers.length === 0 ? 'OK' : 'BLOCKED_CONTRACT_INDEX_INVALID',
    blockers,
  };
}

export function buildContractIndexReport(): ContractIndexReport {
  return buildContractIndexReportForScope('runtime');
}

export function buildContractIndexReportForScope(scope: ContractIndexScope): ContractIndexReport {
  const contracts = scope === 'product-design' ? buildProductDesignContractIndex() : buildRuntimeProtocolContractIndex();
  const validation = validateContractIndex(contracts);
  return {
    schemaVersion: 'bmads_auto_contract_index/v1',
    generatedBy: 'bmads-auto contract-index',
    scope,
    contractCount: contracts.length,
    contracts,
    resultCode: validation.resultCode,
    blockers: validation.blockers,
  };
}
