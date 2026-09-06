import { sha256Stable, stableStringify } from '../../../main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { validateGoalContractSchema } from './schema-registry';
import type { StandaloneGoalSemanticInput, StandaloneGoalSemanticIr } from './standalone-goal-semantic-ir';
import { standaloneGoalSemanticIRHash } from './standalone-goal-semantic-hash';
import { resolveStandaloneGoalSemanticPayload } from './standalone-goal-semantic-representation';

type Row = Record<string, unknown>;

export interface StandaloneGoalInternalSemanticGate {
  schemaVersion: 'StandaloneGoalInternalSemanticGate/v1';
  gateIdentity: 'standalone-source-oracle+deterministic-semantic-validator/v1';
  sourcePlanHash: string;
  sourceSnapshotHash: string;
  standaloneGoalSemanticIRHash: string;
  decision: 'pass' | 'block';
  issueCodes: string[];
  metrics: {
    sourceObligationCount: number;
    candidateObligationCount: number;
    actionCount: number;
    atomCount: number;
    constraintCount: number;
    referenceCount: number;
    candidateBytes: number;
    edgeBudget: number;
    nonGlobalObligationUniverseCount: number;
  };
  gateHash: string;
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
const rows = (value: unknown): Row[] =>
  Array.isArray(value) ? value.filter((item): item is Row => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : [];
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const sorted = (value: string[]): string[] => [...new Set(value)].sort((a, b) => a.localeCompare(b));

function issue(code: string, issues: Set<string>): void {
  issues.add(code);
}

function sourceOracle(input: StandaloneGoalSemanticInput): {
  ids: string[];
  actionIds: string[];
  sourceRefs: Set<string>;
  dependencyMap: Map<string, string[]>;
} {
  const sourceRows = input.sourceObligations;
  const ids = sourceRows.map((row) => text(row.id));
  const typed = sourceRows.some((row) => row.executionRole !== undefined);
  const actionIds = sourceRows
    .filter((row) => !typed || row.executionRole === 'action')
    .map((row) => text(row.id));
  const sourceRefs = new Set(sourceRows.flatMap((row) => [text(row.id), ...strings(row.specSpanRefs), ...strings(row.provenanceRefs)]));
  const dependencyMap = new Map(sourceRows.map((row) => [text(row.id), sorted(strings(row.dependencyRefs))]));
  return { ids: sorted(ids), actionIds: sorted(actionIds), sourceRefs, dependencyMap };
}

function validateRelations(input: StandaloneGoalSemanticInput, candidate: StandaloneGoalSemanticIr, issues: Set<string>): number {
  const payload = resolveStandaloneGoalSemanticPayload(candidate) as Row;
  const obligations = rows(payload.obligations);
  const atoms = rows(payload.atoms);
  const constraints = rows(payload.executionConstraints);
  const oracle = sourceOracle(input);
  const candidateIds = obligations.map((row) => text(row.obligationId));
  if (JSON.stringify(sorted(candidateIds)) !== JSON.stringify(oracle.ids)) issue('source_obligation_conservation_failed', issues);
  for (const obligation of obligations) {
    const id = text(obligation.obligationId);
    if (!oracle.sourceRefs.has(id) || strings(obligation.sourceRefs).some((ref) => !oracle.sourceRefs.has(ref))) issue(`obligation_source_ref_invalid:${id}`, issues);
    if (obligation.executionRole === 'action' && (!text(obligation.oracle) || strings(obligation.atomRefs).length !== 1 || strings(obligation.atomRefs)[0] !== `${id}-A1`)) issue(`action_atom_binding_invalid:${id}`, issues);
    if (obligation.executionRole !== 'action' && strings(obligation.atomRefs).length > 0) issue(`non_action_atom_invented:${id}`, issues);
  }
  const atomByRequirement = new Map(atoms.map((atom) => [text(atom.requirementRef), atom]));
  if (JSON.stringify(sorted(atoms.map((atom) => text(atom.requirementRef)))) !== JSON.stringify(oracle.actionIds)) issue('action_atom_conservation_failed', issues);
  for (const actionId of oracle.actionIds) {
    const atom = atomByRequirement.get(actionId);
    if (!atom || text(atom.id) !== `${actionId}-A1` || text(atom.action) !== text(input.sourceObligations.find((row) => text(row.id) === actionId)?.exactText)) issue(`action_atom_semantics_mismatch:${actionId}`, issues);
    const expectedDeps = sorted((oracle.dependencyMap.get(actionId) ?? []).map((ref) => `${ref}-A1`));
    if (JSON.stringify(sorted(strings(atom?.dependencies))) !== JSON.stringify(expectedDeps)) issue(`action_dependency_mismatch:${actionId}`, issues);
  }
  const allObligationIds = new Set(oracle.ids);
  let referenceCount = 0;
  for (const constraint of constraints) {
    const mustRefs = strings(constraint.applicableMustRefs);
    const atomRefs = strings(constraint.applicableAtomRefs);
    const premiseRefs = strings(constraint.premiseRefs);
    const sourceRefs = strings(constraint.sourceRefs);
    const declarationSource = object(constraint.declarationSource);
    const externalDeclaration = declarationSource.sourceSnapshotHash === input.sourceSnapshotHash &&
      Number.isInteger(declarationSource.startByte) && Number.isInteger(declarationSource.endByteExclusive) &&
      Number(declarationSource.endByteExclusive) > Number(declarationSource.startByte);
    referenceCount += mustRefs.length + atomRefs.length + premiseRefs.length + sourceRefs.length;
    if (mustRefs.some((ref) => !allObligationIds.has(ref))) issue(`constraint_obligation_ref_invalid:${text(constraint.constraintId)}`, issues);
    const expectedAtoms = constraint.coverageRole === 'non_action_declaration' ? [] : sorted(mustRefs.flatMap((ref) => {
      const row = obligations.find((candidateRow) => text(candidateRow.obligationId) === ref);
      return strings(row?.atomRefs);
    }));
    if (JSON.stringify(sorted(atomRefs)) !== JSON.stringify(expectedAtoms)) issue(`constraint_atom_ref_invalid:${text(constraint.constraintId)}`, issues);
    if (sourceRefs.length === 0 || ((!externalDeclaration) && sourceRefs.some((ref) => !oracle.sourceRefs.has(ref))) ||
      premiseRefs.length === 0 || ((!externalDeclaration) && premiseRefs.some((ref) => !oracle.sourceRefs.has(ref)))) {
      issue(`constraint_provenance_invalid:${text(constraint.constraintId)}`, issues);
    }
    if (mustRefs.length === oracle.ids.length && constraints.length > 1 && text(constraint.scope) !== 'global') issue(`constraint_full_fanout:${text(constraint.constraintId)}`, issues);
  }
  return referenceCount;
}

export function runStandaloneGoalInternalSemanticGate(input: StandaloneGoalSemanticInput, candidate: StandaloneGoalSemanticIr): StandaloneGoalInternalSemanticGate {
  const issues = new Set<string>();
  if (candidate.sourcePlanHash !== input.sourcePlanHash ||
    (candidate.schemaVersion === 'StandaloneGoalSemanticIR/v2' && candidate.sourceSnapshotHash !== input.sourceSnapshotHash)) {
    issue('semantic_candidate_source_identity_mismatch', issues);
  }
  if (standaloneGoalSemanticIRHash(candidate) !== candidate.standaloneGoalSemanticIRHash) {
    issue('semantic_candidate_hash_mismatch', issues);
  }
  const referenceCount = validateRelations(input, candidate, issues);
  const candidateBytes = Buffer.byteLength(`${stableStringify(candidate)}\n`, 'utf8');
  const payload = resolveStandaloneGoalSemanticPayload(candidate) as Row;
  const obligations = rows(payload.obligations);
  const atoms = rows(payload.atoms);
  const constraints = rows(payload.executionConstraints);
  const nonGlobalConstraints = constraints.filter((constraint) => text(constraint.scope) !== 'global');
  const nonGlobalObligationUniverse = new Set(nonGlobalConstraints.flatMap((constraint) => strings(constraint.applicableMustRefs)));
  // Resource guard for pathological relation graphs; this is independent of transport bytes.
  const edgeBudget = Math.max(100_000, (obligations.length + constraints.length + atoms.length) * 64);
  if (referenceCount > edgeBudget) issue('semantic_relation_edge_budget_exceeded', issues);
  const metrics = {
    sourceObligationCount: input.sourceObligations.length,
    candidateObligationCount: rows(payload.obligations).length,
    actionCount: input.sourceObligations.filter((row) => row.executionRole === 'action').length,
    atomCount: rows(payload.atoms).length,
    constraintCount: rows(payload.executionConstraints).length,
    referenceCount,
    candidateBytes,
    edgeBudget,
    nonGlobalObligationUniverseCount: nonGlobalObligationUniverse.size,
  };
  const preimage = {
    schemaVersion: 'StandaloneGoalInternalSemanticGate/v1' as const,
    gateIdentity: 'standalone-source-oracle+deterministic-semantic-validator/v1' as const,
    sourcePlanHash: input.sourcePlanHash,
    sourceSnapshotHash: input.sourceSnapshotHash,
    standaloneGoalSemanticIRHash: candidate.standaloneGoalSemanticIRHash,
    decision: issues.size === 0 ? 'pass' as const : 'block' as const,
    issueCodes: [...issues].sort(),
    metrics,
  };
  const receipt = { ...preimage, gateHash: sha256Stable(preimage) };
  validateGoalContractSchema('standalone-goal-internal-semantic-gate.schema.json', receipt);
  if (receipt.decision === 'block') {
    throw Object.assign(new Error(receipt.issueCodes[0] ?? 'standalone_goal_internal_semantic_gate_failed'), {
      failureClass: 'standalone_goal_internal_semantic_gate_failed',
      issueCodes: receipt.issueCodes,
      gate: receipt,
      goalJudgeDispatchCount: 0,
    });
  }
  return Object.freeze(receipt);
}
