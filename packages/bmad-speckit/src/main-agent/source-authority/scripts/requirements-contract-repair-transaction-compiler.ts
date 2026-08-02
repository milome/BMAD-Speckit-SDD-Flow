import {
  isRecord,
  requireHash,
  requireNonEmptyUniqueStrings,
  requireText,
  stableHash,
  strings,
  text,
} from './requirements-contract-verification-evidence-normalizer';
import type {
  RequirementsContractCampaignFindingPreservationRow,
  RequirementsContractCampaignRemediationLedger,
} from './requirements-contract-campaign-finding-merge';

export interface RequirementsContractRepairUnit {
  schemaVersion: 'requirements-contract-repair-unit/v1';
  unitId: string;
  originIds: string[];
  dependencyUnitIds: string[];
  conflictUnitIds: string[];
  rootCauseRef: string;
  semanticRegionRef: string;
  rollbackBoundaryRef: string;
  postconditionRef: string;
  atomicGroupId: string;
  authorizedPaths: string[];
  preconditionHashes: string[];
  closurePredicates: string[];
  verificationRefs: string[];
  modelSuggestionRefs: string[];
  selfHash: string;
}

export interface RequirementsContractRepairTransactionGraph {
  unitIds: string[];
  edges: Array<{ fromUnitId: string; toUnitId: string }>;
  atomicGroups: Array<{ atomicGroupId: string; unitIds: string[]; originIds: string[] }>;
  cycleDetected: false;
  decision: 'pass';
  graphHash: string;
}

export interface RequirementsContractRepairTransactionManifest {
  schemaVersion: 'requirements-contract-repair-transaction-manifest/v1';
  campaignId: string;
  campaignLineageKey: string;
  initialReviewAttemptKey: string;
  remediationLedgerHash: string;
  originSetHash: string;
  repairUnits: RequirementsContractRepairUnit[];
  graph: RequirementsContractRepairTransactionGraph;
  permutationHashes: string[];
  decision: 'pass';
  manifestHash: string;
}

export class RequirementsContractRepairTransactionCompilerError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'RequirementsContractRepairTransactionCompilerError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new RequirementsContractRepairTransactionCompilerError(code);
}

function requireLedger(value: unknown): RequirementsContractCampaignRemediationLedger {
  if (!isRecord(value)) fail('repair_transaction_ledger_invalid');
  const ledger = value as unknown as RequirementsContractCampaignRemediationLedger;
  if (
    ledger.schemaVersion !== 'requirements-contract-campaign-remediation-ledger/v1' ||
    ledger.decision !== 'pass'
  ) {
    fail('repair_transaction_ledger_invalid');
  }
  return ledger;
}

function originRows(ledger: RequirementsContractCampaignRemediationLedger) {
  const rows = Array.isArray(ledger.originPreservationMatrix)
    ? ledger.originPreservationMatrix
    : [];
  if (rows.length === 0) fail('repair_transaction_origin_uncovered');
  return rows as RequirementsContractCampaignFindingPreservationRow[];
}

function atomicGroupIdFor(input: {
  rootCauseRef: string;
  semanticRegionRef: string;
  rollbackBoundaryRef: string;
  postconditionRef: string;
}): string {
  return stableHash(input);
}

function requireRepairUnit(value: unknown): Omit<
  RequirementsContractRepairUnit,
  'schemaVersion' | 'selfHash' | 'atomicGroupId'
> & {
  atomicGroupId: string;
} {
  if (!isRecord(value)) fail('repair_transaction_unit_invalid');
  const rootCauseRef = requireText(value, 'rootCauseRef', 'repair_transaction_unit_invalid');
  const semanticRegionRef = requireText(
    value,
    'semanticRegionRef',
    'repair_transaction_unit_invalid'
  );
  const rollbackBoundaryRef = requireText(
    value,
    'rollbackBoundaryRef',
    'repair_transaction_unit_invalid'
  );
  const postconditionRef = requireText(
    value,
    'postconditionRef',
    'repair_transaction_unit_invalid'
  );
  const authorizedPaths = requireNonEmptyUniqueStrings(
    value.authorizedPaths,
    'repair_transaction_scope_ambiguous'
  );
  return {
    unitId: requireText(value, 'unitId', 'repair_transaction_unit_invalid'),
    originIds: requireNonEmptyUniqueStrings(value.originIds, 'repair_transaction_origin_uncovered'),
    dependencyUnitIds: strings(value.dependencyUnitIds).sort((left, right) =>
      left.localeCompare(right)
    ),
    conflictUnitIds: strings(value.conflictUnitIds).sort((left, right) =>
      left.localeCompare(right)
    ),
    rootCauseRef,
    semanticRegionRef,
    rollbackBoundaryRef,
    postconditionRef,
    atomicGroupId: atomicGroupIdFor({
      rootCauseRef,
      semanticRegionRef,
      rollbackBoundaryRef,
      postconditionRef,
    }),
    authorizedPaths,
    preconditionHashes: requireNonEmptyUniqueStrings(
      value.preconditionHashes,
      'repair_transaction_precondition_missing'
    ).map((hash) => {
      requireHash({ hash }, 'hash', 'repair_transaction_precondition_missing');
      return hash;
    }),
    closurePredicates: requireNonEmptyUniqueStrings(
      value.closurePredicates,
      'repair_transaction_closure_predicate_missing'
    ),
    verificationRefs: requireNonEmptyUniqueStrings(
      value.verificationRefs,
      'repair_transaction_verification_missing'
    ),
    modelSuggestionRefs: [...new Set(strings(value.modelSuggestionRefs))].sort((left, right) =>
      left.localeCompare(right)
    ),
  };
}

function canonicalRepairUnit(value: unknown): RequirementsContractRepairUnit {
  const unit = requireRepairUnit(value);
  const payload = {
    schemaVersion: 'requirements-contract-repair-unit/v1' as const,
    ...unit,
  };
  return { ...payload, selfHash: stableHash(payload) };
}

function verifyOrigins(
  units: readonly RequirementsContractRepairUnit[],
  originIdSet: ReadonlySet<string>
): void {
  const seen = new Set<string>();
  for (const unit of units) {
    for (const originId of unit.originIds) {
      if (!originIdSet.has(originId)) fail('repair_transaction_origin_unknown');
      if (seen.has(originId)) fail('repair_transaction_origin_duplicate');
      seen.add(originId);
    }
  }
  if (originIdSet.size !== seen.size) fail('repair_transaction_origin_uncovered');
}

function verifySharedFindingsAreAtomic(
  units: readonly RequirementsContractRepairUnit[],
  ledger: RequirementsContractCampaignRemediationLedger
): void {
  const unitByOrigin = new Map<string, RequirementsContractRepairUnit>();
  for (const unit of units) {
    for (const originId of unit.originIds) unitByOrigin.set(originId, unit);
  }
  for (const finding of ledger.mergedFindings) {
    if (!Array.isArray(finding.origins) || finding.origins.length < 2) continue;
    const originUnits = finding.origins.map((origin) => unitByOrigin.get(origin.originId));
    if (originUnits.some((unit) => !unit)) fail('repair_transaction_origin_uncovered');
    const first = originUnits[0];
    if (!first || originUnits.some((unit) => unit?.unitId !== first.unitId)) {
      fail('repair_transaction_atomic_group_missing');
    }
  }
}

function verifyUnitReferences(units: readonly RequirementsContractRepairUnit[]): void {
  const unitIds = new Set(units.map((unit) => unit.unitId));
  for (const unit of units) {
    for (const dependencyId of unit.dependencyUnitIds) {
      if (!unitIds.has(dependencyId)) fail('repair_transaction_dependency_unknown');
    }
    for (const conflictId of unit.conflictUnitIds) {
      if (!unitIds.has(conflictId)) fail('repair_transaction_conflict_unknown');
      fail('repair_transaction_conflict_unresolved');
    }
  }
}

function detectCycle(units: readonly RequirementsContractRepairUnit[]): boolean {
  const byUnit = new Map(units.map((unit) => [unit.unitId, unit]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(unitId: string): boolean {
    if (visiting.has(unitId)) return true;
    if (visited.has(unitId)) return false;
    visiting.add(unitId);
    const unit = byUnit.get(unitId);
    if (!unit) return false;
    for (const dependencyId of unit.dependencyUnitIds) {
      if (visit(dependencyId)) return true;
    }
    visiting.delete(unitId);
    visited.add(unitId);
    return false;
  }

  return [...byUnit.keys()].some(visit);
}

function compileGraph(
  units: readonly RequirementsContractRepairUnit[]
): RequirementsContractRepairTransactionGraph {
  if (detectCycle(units)) fail('repair_transaction_graph_cycle');
  const sortedUnits = [...units].sort((left, right) => left.unitId.localeCompare(right.unitId));
  const edges = sortedUnits
    .flatMap((unit) =>
      unit.dependencyUnitIds.map((dependencyUnitId) => ({
        fromUnitId: dependencyUnitId,
        toUnitId: unit.unitId,
      }))
    )
    .sort(
      (left, right) =>
        left.fromUnitId.localeCompare(right.fromUnitId) ||
        left.toUnitId.localeCompare(right.toUnitId)
    );
  const groupMap = new Map<
    string,
    { atomicGroupId: string; unitIds: string[]; originIds: string[] }
  >();
  for (const unit of sortedUnits) {
    const group = groupMap.get(unit.atomicGroupId) ?? {
      atomicGroupId: unit.atomicGroupId,
      unitIds: [],
      originIds: [],
    };
    group.unitIds.push(unit.unitId);
    group.originIds.push(...unit.originIds);
    group.unitIds.sort((left, right) => left.localeCompare(right));
    group.originIds = [...new Set(group.originIds)].sort((left, right) =>
      left.localeCompare(right)
    );
    groupMap.set(unit.atomicGroupId, group);
  }
  const payload = {
    unitIds: sortedUnits.map((unit) => unit.unitId),
    edges,
    atomicGroups: [...groupMap.values()].sort((left, right) =>
      left.atomicGroupId.localeCompare(right.atomicGroupId)
    ),
    cycleDetected: false as const,
    decision: 'pass' as const,
  };
  return { ...payload, graphHash: stableHash(payload) };
}

export function compileRequirementsContractRepairTransactionManifest(
  input: unknown
): RequirementsContractRepairTransactionManifest {
  if (!isRecord(input)) fail('repair_transaction_input_invalid');
  if (input.callerWritePermission === true) fail('repair_transaction_write_permission_forbidden');
  const ledger = requireLedger(input.remediationLedger);
  const campaignId = requireText(input, 'campaignId', 'repair_transaction_identity_invalid');
  const campaignLineageKey = requireHash(
    input,
    'campaignLineageKey',
    'repair_transaction_identity_invalid'
  );
  const initialReviewAttemptKey = requireHash(
    input,
    'initialReviewAttemptKey',
    'repair_transaction_identity_invalid'
  );
  if (
    ledger.campaignId !== campaignId ||
    ledger.campaignLineageKey !== campaignLineageKey ||
    ledger.initialReviewAttemptKey !== initialReviewAttemptKey
  ) {
    fail('repair_transaction_ledger_stale');
  }
  const rows = originRows(ledger);
  const originIdSet = new Set(rows.map((row) => row.originId));
  const units = (Array.isArray(input.repairUnits) ? input.repairUnits : [])
    .map(canonicalRepairUnit)
    .sort((left, right) => {
      const sharedDelta = right.originIds.length - left.originIds.length;
      return sharedDelta || left.unitId.localeCompare(right.unitId);
    });
  if (units.length === 0) fail('repair_transaction_origin_uncovered');
  verifyOrigins(units, originIdSet);
  verifySharedFindingsAreAtomic(units, ledger);
  verifyUnitReferences(units);
  const graph = compileGraph(units);
  const payload = {
    schemaVersion: 'requirements-contract-repair-transaction-manifest/v1' as const,
    campaignId,
    campaignLineageKey,
    initialReviewAttemptKey,
    remediationLedgerHash: requireHash(
      ledger as unknown as Record<string, unknown>,
      'ledgerHash',
      'repair_transaction_ledger_stale'
    ),
    originSetHash: stableHash({
      originIds: [...originIdSet].sort((left, right) => left.localeCompare(right)),
    }),
    repairUnits: units,
    graph,
    permutationHashes: [
      stableHash({ repairUnitIds: units.map((unit) => unit.unitId) }),
      stableHash({ originSetHash: ledger.completeOriginSetHash, graphHash: graph.graphHash }),
    ],
    decision: 'pass' as const,
  };
  return { ...payload, manifestHash: stableHash(payload) };
}

export function validateRequirementsContractRepairTransactionManifest(
  value: unknown,
  currentAuthority: unknown
): RequirementsContractRepairTransactionManifest {
  if (!isRecord(value) || !isRecord(currentAuthority)) fail('repair_transaction_manifest_invalid');
  const manifest = value as unknown as RequirementsContractRepairTransactionManifest;
  const { manifestHash, ...payload } = manifest;
  if (manifestHash !== stableHash(payload)) fail('repair_transaction_manifest_hash_mismatch');
  if (
    manifest.schemaVersion !== 'requirements-contract-repair-transaction-manifest/v1' ||
    manifest.decision !== 'pass'
  ) {
    fail('repair_transaction_manifest_invalid');
  }
  for (const field of [
    'campaignId',
    'campaignLineageKey',
    'initialReviewAttemptKey',
    'manifestHash',
  ] as const) {
    if (text(manifest[field]) !== text(currentAuthority[field])) {
      fail('repair_transaction_manifest_stale');
    }
  }
  return manifest;
}
