import {
  createRequirementsContractSemanticIr,
  validateRequirementsContractSemanticIr,
  type RequirementsContractSemanticIr,
} from './requirements-contract-semantic-ir';
import { sha256Stable } from './requirements-contract-semantic-resolver';

type JsonRecord = Record<string, unknown>;
type RepairOperation = 'replace_atom' | 'split_atom' | 'rebind_constraint' | 'replace_oracle';

export interface RequirementsSemanticRepairStep {
  findingId: string;
  classification: 'compiler_gap' | 'projection_repair';
  operation: RepairOperation;
  targetNodeId: string;
  expectedBeforeHash: string;
  replacement: unknown;
  affectedMustRefs?: string[];
  affectedArtifactRefs?: string[];
}

export interface RequirementsSemanticRepairMaterializationResult {
  decision: 'publish' | 'blocked' | 'no_progress';
  beforeSemanticHash: string;
  afterSemanticHash: string | null;
  changedSemanticNodeIds: string[];
  candidateSemanticIr: RequirementsContractSemanticIr | null;
  issueCodes: string[];
}

function record(value: unknown, code: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as JsonRecord;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function blocked(beforeSemanticHash: string, code = 'requirements_remediation_not_materializable'):
  RequirementsSemanticRepairMaterializationResult {
  return {
    decision: 'blocked',
    beforeSemanticHash,
    afterSemanticHash: null,
    changedSemanticNodeIds: [],
    candidateSemanticIr: null,
    issueCodes: [code],
  };
}

function replaceRefs(refs: unknown, from: string, to: string[]): string[] {
  const values = Array.isArray(refs) ? refs.map(String) : [];
  return [...new Set(values.flatMap((value) => value === from ? to : [value]))].sort();
}

function updateOracle(
  semantics: JsonRecord,
  targetNodeId: string,
  oracle: string
): boolean {
  const requirements = Array.isArray(semantics.requirements) ? semantics.requirements as JsonRecord[] : [];
  const atoms = Array.isArray(semantics.atoms) ? semantics.atoms as JsonRecord[] : [];
  const requirement = requirements.find((entry) => entry.id === targetNodeId);
  if (requirement) {
    requirement.oracle = oracle;
    for (const atom of atoms) {
      if (atom.requirementRef === targetNodeId) atom.oracle = oracle;
    }
    return true;
  }
  const atom = atoms.find((entry) => entry.id === targetNodeId);
  if (!atom) return false;
  atom.oracle = oracle;
  return true;
}

function updateOracleEvidence(
  payload: RequirementsContractSemanticIr['semanticPayload'],
  affectedNodeId: string
): void {
  const semantics = payload.semantics as JsonRecord;
  const requirements = Array.isArray(semantics.requirements) ? semantics.requirements as JsonRecord[] : [];
  const requirement = requirements.find((entry) => entry.id === affectedNodeId);
  const requirementId = requirement
    ? String(requirement.id)
    : (Array.isArray(semantics.atoms)
      ? (semantics.atoms as JsonRecord[]).find((entry) => entry.id === affectedNodeId)?.requirementRef
      : undefined);
  if (typeof requirementId !== 'string') return;
  const target = requirements.find((entry) => entry.id === requirementId);
  if (!target) return;
  const normalizedClaimHash = sha256Stable({
    text: target.text,
    oracle: target.oracle,
  });
  for (const claim of payload.evidenceClaims) {
    if (claim.evidenceClaimId === `EVIDENCE-CLAIM-${requirementId}`) {
      claim.normalizedClaimHash = normalizedClaimHash;
    }
  }
  for (const span of payload.specSpanRegistry) {
    if (span.boundSemanticNodeIds.includes(requirementId)) span.normalizedClaimHash = normalizedClaimHash;
  }
}

function applyStep(
  payload: RequirementsContractSemanticIr['semanticPayload'],
  step: RequirementsSemanticRepairStep
): string[] | null {
  const semantics = payload.semantics as JsonRecord;
  const atoms = Array.isArray(semantics.atoms) ? semantics.atoms as JsonRecord[] : [];
  const constraints = payload.executionConstraints as JsonRecord[];
  const replacement = record(step.replacement, 'requirements_remediation_replacement_invalid');
  if (step.operation === 'replace_atom') {
    const index = atoms.findIndex((entry) => entry.id === step.targetNodeId);
    if (index < 0 || sha256Stable(atoms[index]) !== step.expectedBeforeHash) return null;
    const current = atoms[index];
    const next = { ...current };
    for (const key of ['action', 'oracle', 'dependencies']) {
      if (Object.hasOwn(replacement, key)) next[key] = clone(replacement[key]);
    }
    atoms[index] = next;
    if (Object.hasOwn(replacement, 'oracle')) updateOracleEvidence(payload, step.targetNodeId);
    return [step.targetNodeId];
  }
  if (step.operation === 'replace_oracle') {
    const oracle = typeof step.replacement === 'string'
      ? step.replacement
      : typeof replacement.oracle === 'string' ? replacement.oracle : null;
    if (!oracle || !updateOracle(semantics, step.targetNodeId, oracle)) return null;
    updateOracleEvidence(payload, step.targetNodeId);
    return [step.targetNodeId];
  }
  if (step.operation === 'rebind_constraint') {
    const index = constraints.findIndex((entry) => entry.constraintId === step.targetNodeId);
    if (index < 0 || sha256Stable(constraints[index]) !== step.expectedBeforeHash) return null;
    const current = constraints[index];
    const next = { ...current };
    for (const key of ['constraintId', 'applicableMustRefs', 'applicableAtomRefs', 'premiseRefs']) {
      if (Object.hasOwn(replacement, key)) next[key] = clone(replacement[key]);
    }
    const nextId = String(next.constraintId);
    if (!nextId || constraints.some((entry, entryIndex) => entryIndex !== index && entry.constraintId === nextId)) return null;
    constraints[index] = next;
    for (const atom of atoms) {
      atom.executionConstraintRefs = replaceRefs(atom.executionConstraintRefs, step.targetNodeId, [nextId]);
    }
    return [step.targetNodeId, nextId];
  }
  if (step.operation === 'split_atom') {
    const index = atoms.findIndex((entry) => entry.id === step.targetNodeId);
    if (index < 0 || sha256Stable(atoms[index]) !== step.expectedBeforeHash || !Array.isArray(replacement.atoms)) return null;
    const current = atoms[index];
    const childAtoms = replacement.atoms.map((value) => {
      const child = record(value, 'requirements_remediation_split_atom_invalid');
      if (typeof child.id !== 'string' || !child.id || typeof child.action !== 'string' || typeof child.oracle !== 'string') {
        throw new Error('requirements_remediation_split_atom_invalid');
      }
      return {
        ...clone(child),
        requirementRef: current.requirementRef,
        authorityRefs: clone(current.authorityRefs ?? [current.requirementRef]),
        executionConstraintRefs: clone(child.executionConstraintRefs ?? current.executionConstraintRefs ?? []),
        dependencies: clone(child.dependencies ?? []),
      } as JsonRecord;
    });
    const existingIds = new Set(atoms.map((entry) => String(entry.id)));
    if (childAtoms.some((child) => existingIds.has(String(child.id)))) return null;
    atoms.splice(index, 1, ...childAtoms);
    for (const atom of atoms) {
      atom.dependencies = replaceRefs(atom.dependencies, step.targetNodeId, childAtoms.map((child) => String(child.id)));
    }
    for (const constraint of constraints) {
      constraint.applicableAtomRefs = replaceRefs(
        constraint.applicableAtomRefs,
        step.targetNodeId,
        childAtoms.map((child) => String(child.id))
      );
    }
    return [step.targetNodeId, ...childAtoms.map((child) => String(child.id))];
  }
  return null;
}

export function materializeRequirementsSemanticRepair(input: {
  currentSemanticIr: RequirementsContractSemanticIr;
  repairSteps: unknown[];
}): RequirementsSemanticRepairMaterializationResult {
  const validation = validateRequirementsContractSemanticIr(input.currentSemanticIr);
  if (validation.decision === 'block' || !Array.isArray(input.repairSteps) || input.repairSteps.length === 0) {
    return blocked(input.currentSemanticIr.scopeSemanticHash);
  }
  const next = clone(input.currentSemanticIr);
  const changedSemanticNodeIds: string[] = [];
  try {
    for (const value of input.repairSteps) {
      const step = record(value, 'requirements_remediation_step_invalid') as unknown as RequirementsSemanticRepairStep;
      if (!step.findingId || !step.targetNodeId || !step.expectedBeforeHash ||
        !['compiler_gap', 'projection_repair'].includes(step.classification) ||
        !['replace_atom', 'split_atom', 'rebind_constraint', 'replace_oracle'].includes(step.operation)) {
        return blocked(input.currentSemanticIr.scopeSemanticHash);
      }
      const changed = applyStep(next.semanticPayload, step);
      if (!changed) return blocked(input.currentSemanticIr.scopeSemanticHash);
      changedSemanticNodeIds.push(...changed);
    }
    const candidate = createRequirementsContractSemanticIr({
      recordId: next.recordId,
      requestId: next.requestId,
      parentSemanticRevisionId: input.currentSemanticIr.semanticRevisionId,
      compilerVersion: next.compilerVersion,
      semantics: next.semanticPayload.semantics,
      evidenceClaims: next.semanticPayload.evidenceClaims,
      specSpanRegistry: next.semanticPayload.specSpanRegistry,
      executionConstraints: next.semanticPayload.executionConstraints,
      semanticProvenance: next.semanticPayload.semanticProvenance,
    });
    if (candidate.scopeSemanticHash === input.currentSemanticIr.scopeSemanticHash) {
      return {
        decision: 'no_progress',
        beforeSemanticHash: input.currentSemanticIr.scopeSemanticHash,
        afterSemanticHash: candidate.scopeSemanticHash,
        changedSemanticNodeIds: [...new Set(changedSemanticNodeIds)].sort(),
        candidateSemanticIr: candidate,
        issueCodes: ['judge_remediation_no_semantic_progress'],
      };
    }
    return {
      decision: 'publish',
      beforeSemanticHash: input.currentSemanticIr.scopeSemanticHash,
      afterSemanticHash: candidate.scopeSemanticHash,
      changedSemanticNodeIds: [...new Set(changedSemanticNodeIds)].sort(),
      candidateSemanticIr: candidate,
      issueCodes: [],
    };
  } catch {
    return blocked(input.currentSemanticIr.scopeSemanticHash);
  }
}
