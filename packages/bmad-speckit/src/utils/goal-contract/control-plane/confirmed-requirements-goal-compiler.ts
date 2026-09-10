import type { ConfirmedRequirementsAuthority } from '../../../main-agent/source-authority/scripts/requirements-contract-confirmed-authority-adapter';
import {
  sha256Stable,
  sha256Text,
} from '../../../main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { renderNormativeDetails } from './goal-normative-renderer';
import {
  canonicalRequirementGraphRef,
  lintCanonicalRequirementGraph,
  normalizeCanonicalRequirementGraph,
} from './canonical-requirement-graph';
import { probeGoalContractRenderability } from './goal-contract-renderability-probe';
import { compileGoalExecutionClosure } from './goal-execution-closure';
import {
  compileGoalExecutionIR,
  type GoalExecutionCompilerInput,
  type GoalExecutionIR,
} from './goal-execution-ir';
import {
  expandRequirementsTypedSpecSpans,
  type RequirementsSpecSpan,
} from '../../../main-agent/source-authority/scripts/requirements-contract-span-registry';
import {
  projectRequirementsTypedGoalObligations,
  requirementsTypedSemanticSource,
} from './goal-requirements-typed-bridge';

type JsonObject = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is JsonObject =>
          Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)
      )
    : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
    : [];
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function semanticArchitecture(executionConstraints: JsonObject[]): JsonObject {
  const ownership = new Map<string, JsonObject>();
  for (const constraint of executionConstraints.filter((entry) => entry.kind === 'PATH')) {
    const targetPath = text(constraint.canonicalValue);
    const actionRefs = unique(strings(constraint.applicableSourceRefs));
    for (const actionRef of actionRefs) {
      const key = `${targetPath}\u0000${actionRef}`;
      ownership.set(key, {
        targetPath,
        owner: actionRef,
        basisRefs: unique([
          text(constraint.constraintId),
          ...strings(constraint.premiseRefs),
        ]),
        obligationRefs: unique([
          actionRef,
          ...strings(constraint.applicableMustRefs),
        ]),
        atomRefs: unique(strings(constraint.applicableAtomRefs)),
        sourceRefs: unique([
          ...strings(constraint.sourceRefs),
          ...strings(constraint.sourceDeclarationRefs),
        ]),
      });
    }
  }
  if (ownership.size === 0) {
    throw new Error('requirements_goal_semantic_architecture_ownership_missing');
  }
  return {
    schemaVersion: 'ConfirmedRequirementsSemanticArchitecture/v1',
    isolation: { mode: 'canonical_requirement_graph' },
    ownership: [...ownership.values()].sort(
      (left, right) =>
        text(left.targetPath).localeCompare(text(right.targetPath)) ||
        text(left.owner).localeCompare(text(right.owner))
    ),
    architectureDecisions: [],
    logicalScope: { forbiddenPaths: [] },
  };
}

export function renderConfirmedRequirementsGoalProjection(ir: GoalExecutionIR): string {
  return [
    '# Goal Execution Contract',
    '',
    `Goal Execution IR: ${ir.goalExecutionIRHash}`,
    `Profile: ${ir.profile}`,
    '',
    '## Source Authority',
    '',
    `- Typed Source Graph: ${text(ir.requirementsLineage?.typedSourceGraphHash)}`,
    `- Canonical Requirement Graph: ${text(ir.requirementsLineage?.canonicalRequirementGraphHash)}`,
    '',
    '## Obligations',
    '',
    ...ir.obligations.flatMap((row) => [
      `- ${row.kind} ${row.obligationId}: ${row.text}`,
      ...(['GoalExecutionIR/v2', 'GoalExecutionIR/v3'].includes(ir.schemaVersion)
        ? renderNormativeDetails(row)
        : []),
    ]),
    '',
    '## Atomic Tasks',
    '',
    ...ir.atomicTasks.map(
      (row) =>
        `- ${text(row.taskId)}: ${text(row.title)} (${String(
          row.expectedEffortMinutes
        )}m expected, ${String(row.upperBoundEffortMinutes)}m max)`
    ),
    '',
  ].join('\n');
}

export interface ConfirmedRequirementsGoalSixStateContext {
  architecture: JsonObject;
  readiness: JsonObject;
  architectureConfirmationCandidateHash: string;
  implementationReadinessCandidateHash: string;
  readinessScopedInputDigest: string;
}

export interface ConfirmedRequirementsGoalCompilerDependencies {
  compileGoalExecutionIR?: typeof compileGoalExecutionIR;
}

export function compileConfirmedRequirementsGoalSemantics(
  input: {
    authority: ConfirmedRequirementsAuthority;
    sixStateContext?: ConfirmedRequirementsGoalSixStateContext;
  },
  dependencies: ConfirmedRequirementsGoalCompilerDependencies = {}
): {
  schemaVersion: 'ConfirmedRequirementsGoalSemanticCompilation/v1';
  requestId: string;
  canonicalRequirementGraph: ReturnType<typeof normalizeCanonicalRequirementGraph>;
  canonicalGraphLint: ReturnType<typeof lintCanonicalRequirementGraph>;
  goalExecutionIr: GoalExecutionIR;
  closure: ReturnType<typeof compileGoalExecutionClosure>;
  projection: {
    markdown: string;
    bytesHash: string;
    renderabilityReport: ReturnType<typeof probeGoalContractRenderability>;
  };
} {
  if (input.authority.schemaVersion !== 'ConfirmedRequirementsAuthority/v1') {
    throw new Error('requirements_goal_confirmed_authority_invalid');
  }
  const semanticIr = input.authority.semanticIr as unknown as JsonObject;
  const semanticPayload = object(semanticIr.semanticPayload);
  const semantics = object(semanticPayload.semantics);
  const semanticSource = requirementsTypedSemanticSource(semanticIr);
  const canonicalRequirementGraph = normalizeCanonicalRequirementGraph({
    sourceAuthority: {
      kind: 'requirements_semantic_ir',
      schemaVersion: text(semanticIr.schemaVersion),
      authorityId: text(semanticIr.semanticRevisionId),
      authorityHash: text(semanticIr.scopeSemanticHash),
    },
    typedSourceAuthority: input.authority.typedSourceAuthority,
    expectedTypedSourceGraphHash: input.authority.lineage.typedSourceGraphHash,
  });
  const canonicalGraphLint = lintCanonicalRequirementGraph(canonicalRequirementGraph);
  if (canonicalGraphLint.decision !== 'pass') {
    throw new Error(`canonical_requirement_graph_${canonicalGraphLint.issueCodes[0]}`);
  }
  if (
    sha256Stable(canonicalRequirementGraphRef(canonicalRequirementGraph)) !==
    sha256Stable(semanticSource.canonicalRequirementGraphRef)
  ) {
    throw new Error('canonical_requirement_graph_ref_mismatch');
  }
  const executionConstraints = objects(semanticSource.typedExecutionConstraints);
  const sixStateContext = input.sixStateContext;
  if (
    sixStateContext &&
    (text(sixStateContext.architecture.architectureConfirmationCandidateHash) !==
      sixStateContext.architectureConfirmationCandidateHash ||
      text(sixStateContext.readiness.implementationReadinessCandidateHash) !==
        sixStateContext.implementationReadinessCandidateHash ||
      text(sixStateContext.readiness.readinessScopedInputDigest) !==
        sixStateContext.readinessScopedInputDigest)
  ) {
    throw new Error('requirements_goal_six_state_context_identity_mismatch');
  }
  const requirementsLineage = {
    recordId: input.authority.requestId,
    semanticRevisionId: text(semanticIr.semanticRevisionId),
    scopeSemanticHash: text(semanticIr.scopeSemanticHash),
    executionConstraintRegistryHash: text(semanticPayload.executionConstraintRegistryHash),
    normalizedExecutionConstraintRegistryHash: sha256Stable(executionConstraints),
    sourceBindingHash: input.authority.lineage.sourceBindingHash,
    typedSourceGraphHash: input.authority.lineage.typedSourceGraphHash,
    canonicalRequirementGraphHash: canonicalRequirementGraph.graphHash,
    canonicalRequirementSemanticHash: canonicalRequirementGraph.semanticHash,
    ...(sixStateContext
      ? {
          architectureConfirmationCandidateHash:
            sixStateContext.architectureConfirmationCandidateHash,
          implementationReadinessCandidateHash:
            sixStateContext.implementationReadinessCandidateHash,
          readinessScopedInputDigest: sixStateContext.readinessScopedInputDigest,
        }
      : {}),
  };
  const technicalAuthority = {
    executionConstraintRegistryHash: requirementsLineage.executionConstraintRegistryHash,
    normalizedExecutionConstraintRegistryHash:
      requirementsLineage.normalizedExecutionConstraintRegistryHash,
    canonicalRequirementGraphHash: canonicalRequirementGraph.graphHash,
    ...(sixStateContext
      ? {
          architectureConfirmationCandidateHash:
            sixStateContext.architectureConfirmationCandidateHash,
          implementationReadinessCandidateHash:
            sixStateContext.implementationReadinessCandidateHash,
          readinessScopedInputDigest: sixStateContext.readinessScopedInputDigest,
        }
      : {}),
  };
  const logicalSpecSpans = expandRequirementsTypedSpecSpans(
    objects(semanticPayload.specSpanRegistry) as unknown as RequirementsSpecSpan[],
    input.authority.typedSourceAuthority
  ) as unknown as JsonObject[];
  const compilerInput: GoalExecutionCompilerInput = {
    profile: 'requirements_backed',
    semanticSource,
    requirementsLineage,
    technicalAuthority,
    obligations: projectRequirementsTypedGoalObligations(semanticSource, logicalSpecSpans),
    atoms: objects(semantics.atoms),
    logicalSpecSpans,
    executionConstraints,
    architecture:
      sixStateContext?.architecture ?? semanticArchitecture(executionConstraints),
    ...(sixStateContext ? { readiness: sixStateContext.readiness } : {}),
    canonicalRequirementGraph,
  };
  const goalExecutionIr = (dependencies.compileGoalExecutionIR ?? compileGoalExecutionIR)(
    compilerInput
  );
  const closure = compileGoalExecutionClosure(goalExecutionIr);
  const markdown = renderConfirmedRequirementsGoalProjection(goalExecutionIr);
  const renderabilityReport = probeGoalContractRenderability({
    goalExecutionIr,
    markdown,
  });
  if (renderabilityReport.decision !== 'pass') {
    throw new Error(renderabilityReport.issueCodes[0]);
  }
  return Object.freeze({
    schemaVersion: 'ConfirmedRequirementsGoalSemanticCompilation/v1',
    requestId: input.authority.requestId,
    canonicalRequirementGraph,
    canonicalGraphLint,
    goalExecutionIr,
    closure,
    projection: Object.freeze({
      markdown,
      bytesHash: sha256Text(markdown),
      renderabilityReport,
    }),
  });
}
