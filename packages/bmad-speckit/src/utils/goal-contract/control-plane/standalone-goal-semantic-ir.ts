import { compileGoalExecutionClosure } from './goal-execution-closure';
import { compileGoalExecutionIR, type GoalExecutionObligation } from './goal-execution-ir';
import { validateGoalContractSchema } from './schema-registry';
import { declaredConstraintBuilder, preflightStandaloneRelationGraph, type StandaloneGoalConstraintBinding } from './standalone-goal-constraint-bindings';
import { runStandaloneGoalInternalSemanticGate } from './standalone-goal-internal-semantic-gate';
import { typedSourceObligation, validateTypedObligationSources } from './standalone-goal-normative-roles';
import { standaloneGoalSemanticIRHash } from './standalone-goal-semantic-hash';
import { normalizeStandaloneGoalSemanticPayload, resolveStandaloneGoalSemanticPayload } from './standalone-goal-semantic-representation';
export type { StandaloneGoalConstraintBinding } from './standalone-goal-constraint-bindings';

type JsonObject = Record<string, unknown>;

export interface StandaloneGoalSemanticIr extends JsonObject {
  schemaVersion: 'StandaloneGoalSemanticIR/v1' | 'StandaloneGoalSemanticIR/v2';
  sourcePlanHash: string;
  sourceSnapshotHash?: string;
  semanticPayload: JsonObject;
  standaloneGoalSemanticIRHash: string;
}

export interface StandaloneGoalSemanticInput {
  sourcePlanHash: string;
  sourceSnapshotHash: string;
  sourceObligations: JsonObject[];
  logicalSpecSpans: JsonObject[];
  technicalSnapshot: {
    targetPaths: string[];
    commandRecords: Array<{ commandId: string; invocation: string }>;
    artifactRecords: Array<{ artifactId: string; logicalPath: string }>;
    evidenceRecords: Array<{ evidenceContractId: string; requirement: string }>;
    forbiddenPaths: string[];
    isolationMode: string;
    constraintBindings?: StandaloneGoalConstraintBinding[];
  };
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function obligationKind(value: JsonObject): GoalExecutionObligation['kind'] {
  const id = text(value.id).toUpperCase();
  const classification = text(value.classification);
  if (id.startsWith('OUT-') || classification === 'boundary') return 'OUT';
  if (id.startsWith('NEG-') || classification === 'negative') return 'NEG';
  if (id.startsWith('NFR-')) return 'NFR';
  if (id.startsWith('FR-')) return 'FR';
  if (classification === 'evidence') return 'ACCEPTANCE';
  return 'MUST';
}

function semanticPayload(input: StandaloneGoalSemanticInput) {
  const sourceRows = [...input.sourceObligations].sort((left, right) =>
    text(left.id).localeCompare(text(right.id))
  );
  const ids = sourceRows.map((row) => text(row.id));
  const typed = sourceRows.some((row) => row.executionRole !== undefined);
  if (
    sourceRows.length === 0 ||
    ids.some((id) => !id) ||
    new Set(ids).size !== ids.length ||
    sourceRows.some((row) => !text(row.exactText) || ((!typed || row.executionRole === 'action') && !text(row.requiredOutcome)))
  ) {
    throw new Error('standalone_goal_successor_required:semantic_obligations');
  }
  const obligations: GoalExecutionObligation[] = sourceRows.map((row) => typed ? typedSourceObligation(row) : ({
    obligationId: text(row.id),
    kind: obligationKind(row),
    text: text(row.exactText),
    oracle: text(row.requiredOutcome),
    sourceRefs: sortedUnique([text(row.id), ...strings(row.specSpanRefs)]),
    atomRefs: [`${text(row.id)}-A1`],
    evidenceClaimRefs: [],
  }));
  if (typed) validateTypedObligationSources(obligations);
  const sourceById = new Map(sourceRows.map((row) => [text(row.id), row]));
  const actionIds = new Set(obligations.filter((row) => !typed || row.executionRole === 'action').map((row) => row.obligationId));
  const dependenciesFor = (obligationId: string) => {
    const refs = strings(sourceById.get(obligationId)?.dependencyRefs);
    if (refs.some((ref) => !actionIds.has(ref) || ref === obligationId)) {
      throw new Error('standalone_goal_action_dependency_invalid');
    }
    return sortedUnique(refs.map((ref) => `${ref}-A1`));
  };
  const atoms = obligations.filter((obligation) => !typed || obligation.executionRole === 'action').map((obligation) => ({
    id: `${obligation.obligationId}-A1`,
    requirementRef: obligation.obligationId,
    action: obligation.text,
    oracle: obligation.oracle,
    ...(typed ? { dependencies: dependenciesFor(obligation.obligationId) } : {}),
  }));
  const technical = input.technicalSnapshot;
  if (
    (atoms.length > 0 && technical.targetPaths.length === 0) ||
    (atoms.length > 0 && technical.commandRecords.length === 0) ||
    !technical.isolationMode
  ) {
    throw new Error('standalone_goal_successor_required:technical_snapshot');
  }
  const bindings = declaredConstraintBuilder(input, obligations);
  const base = bindings.make;
  const executionConstraints = [
    ...sortedUnique(technical.targetPaths).map((targetPath, index) =>
      base(`PATH-standalone-${index + 1}`, 'PATH', targetPath)
    ),
    ...[...technical.commandRecords]
      .sort((left, right) => left.commandId.localeCompare(right.commandId))
      .map((record) => base(record.commandId, 'CMD', record.invocation)),
    ...[...technical.artifactRecords]
      .sort((left, right) => left.artifactId.localeCompare(right.artifactId))
      .map((record) => base(record.artifactId, 'ART', record.logicalPath)),
    ...[...technical.evidenceRecords]
      .sort((left, right) => left.evidenceContractId.localeCompare(right.evidenceContractId))
      .map((record) => base(record.evidenceContractId, 'EVDREQ', record.requirement)),
    ...sortedUnique(technical.forbiddenPaths).map((forbiddenPath, index) =>
      base(`STOP-standalone-${index + 1}`, 'STOP', forbiddenPath)
    ),
  ];
  bindings.finish();
  const pathConstraints = new Map(executionConstraints.filter((row) => row.kind === 'PATH')
    .map((row) => [row.canonicalValue, row]));
  const ownership = sortedUnique(technical.targetPaths).map((targetPath) => ({
    targetPath,
    owner: 'standalone_goal_executor',
    basisRefs: [pathConstraints.get(targetPath)!.constraintId],
    ...(typed ? { obligationRefs: pathConstraints.get(targetPath)!.applicableMustRefs,
      atomRefs: pathConstraints.get(targetPath)!.applicableAtomRefs, sourceRefs: pathConstraints.get(targetPath)!.sourceRefs } : {}),
  }));
  const architecture = {
    isolation: { mode: technical.isolationMode, forbiddenPaths: typed
      ? sortedUnique(executionConstraints.filter((row) => row.kind === 'STOP' && row.scope === 'global').map((row) => row.canonicalValue))
      : sortedUnique(technical.forbiddenPaths) },
    ownership,
    architectureDecisions: [
      {
        decisionId: 'ARCH-STANDALONE-ISOLATION-1',
        decisionType: 'isolation',
        selection: technical.isolationMode,
        ...(typed ? { selectionStatus: 'compiler_default_not_source_derived' } : {}),
        basisRefs: typed ? [] : executionConstraints
          .filter((constraint) => constraint.kind === 'STOP')
          .map((constraint) => constraint.constraintId),
      },
    ],
  };
  return {
    obligations,
    atoms,
    logicalSpecSpans: [...input.logicalSpecSpans].sort((left, right) =>
      text(left.specSpanId).localeCompare(text(right.specSpanId))
    ),
    executionConstraints,
    architecture,
  };
}

export function compileStandaloneGoalSemanticIR(input: StandaloneGoalSemanticInput): StandaloneGoalSemanticIr {
  preflightStandaloneRelationGraph(input);
  const payload = semanticPayload(input);
  const semanticCandidate = {
    schemaVersion: payload.obligations.some((row) => row.executionRole !== undefined)
      ? 'StandaloneGoalSemanticIR/v2' as const : 'StandaloneGoalSemanticIR/v1' as const,
    sourcePlanHash: input.sourcePlanHash,
    ...(payload.obligations.some((row) => row.executionRole !== undefined) ? { sourceSnapshotHash: input.sourceSnapshotHash } : {}),
    semanticPayload: payload.obligations.some((row) => row.executionRole !== undefined)
      ? normalizeStandaloneGoalSemanticPayload(payload) : payload,
    standaloneGoalSemanticIRHash: '',
  };
  const standaloneGoalSemanticIr: StandaloneGoalSemanticIr = Object.freeze({
    ...semanticCandidate,
    standaloneGoalSemanticIRHash: standaloneGoalSemanticIRHash(semanticCandidate),
  });
  validateGoalContractSchema('standalone-goal-semantic-ir.schema.json', standaloneGoalSemanticIr);
  return standaloneGoalSemanticIr;
}

export function compileStandaloneGoalExecution(input: StandaloneGoalSemanticInput) {
  const standaloneGoalSemanticIr = compileStandaloneGoalSemanticIR(input);
  const payload = resolveStandaloneGoalSemanticPayload(standaloneGoalSemanticIr) as ReturnType<typeof semanticPayload>;
  if (!payload.atoms.length) throw new Error('standalone_goal_no_executable_actions');
  const internalSemanticGate = runStandaloneGoalInternalSemanticGate(input, standaloneGoalSemanticIr);
  const standaloneLineage = {
    sourcePlanHash: input.sourcePlanHash,
    sourceSnapshotHash: input.sourceSnapshotHash,
    standaloneGoalSemanticIRHash: standaloneGoalSemanticIr.standaloneGoalSemanticIRHash,
    internalSemanticGateHash: internalSemanticGate.gateHash,
  };
  const goalExecutionIr = compileGoalExecutionIR({
    profile: 'standalone',
    semanticSource: {
      kind: 'standalone_goal_semantic_ir',
      ...(standaloneGoalSemanticIr.schemaVersion === 'StandaloneGoalSemanticIR/v2' ? { schemaVersion: standaloneGoalSemanticIr.schemaVersion } : {}),
      standaloneGoalSemanticIRHash: standaloneGoalSemanticIr.standaloneGoalSemanticIRHash,
    },
    standaloneLineage,
    technicalAuthority: {
      standaloneGoalSemanticIRHash: standaloneGoalSemanticIr.standaloneGoalSemanticIRHash,
      internalSemanticGateHash: internalSemanticGate.gateHash,
    },
    obligations: payload.obligations,
    atoms: payload.atoms,
    logicalSpecSpans: payload.logicalSpecSpans,
    executionConstraints: payload.executionConstraints,
    architecture: payload.architecture,
  });
  const closure = compileGoalExecutionClosure(goalExecutionIr);
  return Object.freeze({
    standaloneGoalSemanticIr,
    internalSemanticGate,
    goalExecutionIr,
    closure,
    goalJudgeDispatchCount: 0 as const,
  });
}
