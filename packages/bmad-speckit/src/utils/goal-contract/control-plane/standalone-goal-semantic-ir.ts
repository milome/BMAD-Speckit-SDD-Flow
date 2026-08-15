import { sha256Stable } from '../../../main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { compileGoalExecutionClosure } from './goal-execution-closure';
import { compileGoalExecutionIR, type GoalExecutionObligation } from './goal-execution-ir';
import { validateGoalContractSchema } from './schema-registry';

type JsonObject = Record<string, unknown>;

export interface StandaloneGoalSemanticIr extends JsonObject {
  schemaVersion: 'StandaloneGoalSemanticIR/v1';
  sourcePlanHash: string;
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
  };
}

export interface StandaloneGoalAuthoringJudgeRequest {
  role: 'goal_full';
  candidate: StandaloneGoalSemanticIr;
  candidateHash: string;
}

export interface StandaloneGoalAuthoringJudgeResult {
  authoringEffectivePass: JsonObject;
  goalJudgeDispatchCount: 0 | 1;
  aggregate?: JsonObject;
  publicationStatus?: string;
  writeCount?: number;
  refs?: Record<string, { path: string; hash: unknown }>;
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
  if (
    sourceRows.length === 0 ||
    ids.some((id) => !id) ||
    new Set(ids).size !== ids.length ||
    sourceRows.some((row) => !text(row.exactText) || !text(row.requiredOutcome))
  ) {
    throw new Error('standalone_goal_successor_required:semantic_obligations');
  }
  const obligations: GoalExecutionObligation[] = sourceRows.map((row) => ({
    obligationId: text(row.id),
    kind: obligationKind(row),
    text: text(row.exactText),
    oracle: text(row.requiredOutcome),
    sourceRefs: sortedUnique([text(row.id), ...strings(row.specSpanRefs)]),
    atomRefs: [`${text(row.id)}-A1`],
    evidenceClaimRefs: [],
  }));
  const atoms = obligations.map((obligation) => ({
    id: `${obligation.obligationId}-A1`,
    requirementRef: obligation.obligationId,
    action: obligation.text,
    oracle: obligation.oracle,
  }));
  const technical = input.technicalSnapshot;
  if (
    technical.targetPaths.length === 0 ||
    technical.commandRecords.length === 0 ||
    technical.artifactRecords.length === 0 ||
    technical.evidenceRecords.length === 0 ||
    technical.forbiddenPaths.length === 0 ||
    !technical.isolationMode
  ) {
    throw new Error('standalone_goal_successor_required:technical_snapshot');
  }
  const obligationRefs = obligations.map((row) => row.obligationId);
  const atomRefs = atoms.map((row) => row.id);
  const base = (constraintId: string, kind: string, canonicalValue: string) => ({
    constraintId,
    kind,
    canonicalValue,
    applicableMustRefs: obligationRefs,
    applicableAtomRefs: atomRefs,
    premiseRefs: obligationRefs,
    derivationReceiptRefs: [],
    disposition: 'proven',
  });
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
    base('CTM-standalone-1', 'CTM', 'standalone vertical trace slices'),
    ...[...technical.evidenceRecords]
      .sort((left, right) => left.evidenceContractId.localeCompare(right.evidenceContractId))
      .map((record) => base(record.evidenceContractId, 'EVDREQ', record.requirement)),
    ...sortedUnique(technical.forbiddenPaths).map((forbiddenPath, index) =>
      base(`STOP-standalone-${index + 1}`, 'STOP', forbiddenPath)
    ),
  ];
  const ownership = sortedUnique(technical.targetPaths).map((targetPath) => ({
    targetPath,
    owner: 'standalone_goal_executor',
    basisRefs: executionConstraints
      .filter(
        (constraint) => constraint.kind === 'PATH' && constraint.canonicalValue === targetPath
      )
      .map((constraint) => constraint.constraintId),
  }));
  const architecture = {
    isolation: { mode: technical.isolationMode },
    ownership,
    architectureDecisions: [
      {
        decisionId: 'ARCH-STANDALONE-ISOLATION-1',
        decisionType: 'isolation',
        selection: technical.isolationMode,
        basisRefs: executionConstraints
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

export async function compileStandaloneGoalExecution(
  input: StandaloneGoalSemanticInput,
  deps: {
    authoringJudge: (
      request: StandaloneGoalAuthoringJudgeRequest
    ) => Promise<StandaloneGoalAuthoringJudgeResult>;
  }
) {
  const payload = semanticPayload(input);
  const semanticCandidate = {
    schemaVersion: 'StandaloneGoalSemanticIR/v1' as const,
    sourcePlanHash: input.sourcePlanHash,
    semanticPayload: payload,
    standaloneGoalSemanticIRHash: '',
  };
  const standaloneGoalSemanticIr: StandaloneGoalSemanticIr = Object.freeze({
    ...semanticCandidate,
    standaloneGoalSemanticIRHash: sha256Stable({
      sourcePlanHash: input.sourcePlanHash,
      semanticPayload: payload,
    }),
  });
  validateGoalContractSchema('standalone-goal-semantic-ir.schema.json', standaloneGoalSemanticIr);
  const judgeResult = await deps.authoringJudge({
    role: 'goal_full',
    candidate: standaloneGoalSemanticIr,
    candidateHash: standaloneGoalSemanticIr.standaloneGoalSemanticIRHash,
  });
  if (
    !judgeResult ||
    ![0, 1].includes(judgeResult.goalJudgeDispatchCount) ||
    !judgeResult.authoringEffectivePass
  ) {
    throw new Error('standalone_goal_authoring_judge_response_invalid');
  }
  const authoringEffectivePass = judgeResult.authoringEffectivePass;
  validateGoalContractSchema(
    'standalone-goal-authoring-effective-pass.schema.json',
    authoringEffectivePass
  );
  const effectivePassPayload = { ...authoringEffectivePass };
  delete effectivePassPayload.authoringEffectivePassHash;
  if (
    authoringEffectivePass.standaloneGoalSemanticIRHash !==
      standaloneGoalSemanticIr.standaloneGoalSemanticIRHash ||
    authoringEffectivePass.decision !== 'pass' ||
    authoringEffectivePass.authoringEffectivePassHash !== sha256Stable(effectivePassPayload)
  ) {
    throw new Error('standalone_goal_authoring_effective_pass_invalid');
  }
  const standaloneLineage = {
    sourcePlanHash: input.sourcePlanHash,
    sourceSnapshotHash: input.sourceSnapshotHash,
    standaloneGoalSemanticIRHash: standaloneGoalSemanticIr.standaloneGoalSemanticIRHash,
    authoringEffectivePassHash: authoringEffectivePass.authoringEffectivePassHash,
  };
  const goalExecutionIr = compileGoalExecutionIR({
    profile: 'standalone',
    semanticSource: {
      kind: 'standalone_goal_semantic_ir',
      standaloneGoalSemanticIRHash: standaloneGoalSemanticIr.standaloneGoalSemanticIRHash,
    },
    standaloneLineage,
    technicalAuthority: {
      standaloneGoalSemanticIRHash: standaloneGoalSemanticIr.standaloneGoalSemanticIRHash,
      authoringEffectivePassHash: authoringEffectivePass.authoringEffectivePassHash,
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
    authoringEffectivePass,
    authoringJudge: judgeResult,
    goalExecutionIr,
    closure,
    goalJudgeDispatchCount: judgeResult.goalJudgeDispatchCount,
  });
}
