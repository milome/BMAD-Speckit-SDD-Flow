import type { RequirementContractSemanticNodeType } from './requirements-contract-model';
import { sha256Stable } from './requirements-contract-semantic-resolver';

export const SOURCE_ROOT_CLASS_REGISTRY_VERSION =
  'requirements-contract-source-root-class-registry/v2' as const;

export interface SourceRootFieldMapping {
  bodyField: string;
  sourceColumns: readonly string[];
  required: boolean;
}

export interface SourceRootReferenceMapping {
  relation: string;
  sourceColumns: readonly string[];
}

export interface RequirementsContractSourceRootClassDefinition {
  registryId: string;
  rootClass: string;
  sourceSection: string;
  sourceIdPrefix: string;
  rootIdPrefix: string;
  nodeType: RequirementContractSemanticNodeType;
  bodySchemaVersion: string;
  projectionKind: 'generic' | 'requirement_v2';
  requirementKind?: 'functional' | 'nonfunctional' | 'negative' | 'out_of_scope';
  fields: readonly SourceRootFieldMapping[];
  relatedRefColumns: readonly SourceRootReferenceMapping[];
}

const field = (
  bodyField: string,
  sourceColumns: readonly string[],
  required = true
): SourceRootFieldMapping => ({ bodyField, sourceColumns, required });

const refs = (
  relation: string,
  sourceColumns: readonly string[]
): SourceRootReferenceMapping => ({ relation, sourceColumns });

export const REQUIREMENTS_CONTRACT_SOURCE_ROOT_CLASS_REGISTRY = [
  {
    registryId: 'success-criterion',
    rootClass: 'goal_outcome',
    sourceSection: 'Success Criteria',
    sourceIdPrefix: 'SC',
    rootIdPrefix: 'SC',
    nodeType: 'scenario',
    bodySchemaVersion: 'requirements-contract-goal-root/v1',
    projectionKind: 'generic',
    fields: [field('criterion', ['Criterion']), field('verification', ['Verification'], false)],
    relatedRefColumns: [refs('verified_by', ['Verification'])],
  },
  {
    registryId: 'journey-actor',
    rootClass: 'actor',
    sourceSection: 'User Journeys',
    sourceIdPrefix: 'UJ',
    rootIdPrefix: 'ACTOR-UJ',
    nodeType: 'participant',
    bodySchemaVersion: 'requirements-contract-actor-root/v1',
    projectionKind: 'generic',
    fields: [field('actor', ['Actor'])],
    relatedRefColumns: [],
  },
  {
    registryId: 'journey-trigger',
    rootClass: 'trigger',
    sourceSection: 'User Journeys',
    sourceIdPrefix: 'UJ',
    rootIdPrefix: 'TRIGGER-UJ',
    nodeType: 'scenario',
    bodySchemaVersion: 'requirements-contract-trigger-root/v1',
    projectionKind: 'generic',
    fields: [field('trigger', ['Trigger'])],
    relatedRefColumns: [],
  },
  {
    registryId: 'user-journey',
    rootClass: 'user_journey',
    sourceSection: 'User Journeys',
    sourceIdPrefix: 'UJ',
    rootIdPrefix: 'UJ',
    nodeType: 'scenario',
    bodySchemaVersion: 'requirements-contract-user-journey-root/v1',
    projectionKind: 'generic',
    fields: [
      field('actor', ['Actor']),
      field('trigger', ['Trigger']),
      field('requiredFlow', ['Required flow']),
      field('completionState', ['Completion state']),
    ],
    relatedRefColumns: [refs('bounded_by', ['Requirement refs', 'Covers'])],
  },
  {
    registryId: 'functional-requirement',
    rootClass: 'functional_requirement',
    sourceSection: 'Functional Requirements',
    sourceIdPrefix: 'FR',
    rootIdPrefix: 'MUST-FR',
    nodeType: 'requirement',
    bodySchemaVersion: 'requirement-contract-requirement/v2',
    projectionKind: 'requirement_v2',
    requirementKind: 'functional',
    fields: [
      field('text', ['Requirement']),
      field('rationale', ['Source rationale'], false),
      field('oracle', ['Per-MUST oracle'], false),
    ],
    relatedRefColumns: [
      refs('verified_by', ['Acceptance link', 'Assertion source']),
      refs('implemented_in', ['Responsibility mapping']),
    ],
  },
  {
    registryId: 'non-functional-requirement',
    rootClass: 'non_functional_requirement',
    sourceSection: 'Non-Functional Requirements',
    sourceIdPrefix: 'NFR',
    rootIdPrefix: 'MUST-NFR',
    nodeType: 'requirement',
    bodySchemaVersion: 'requirement-contract-requirement/v2',
    projectionKind: 'requirement_v2',
    requirementKind: 'nonfunctional',
    fields: [
      field('qualityAttribute', ['Quality attribute'], false),
      field('text', ['Requirement']),
      field('measurement', ['Measurement'], false),
      field('oracle', ['Per-MUST oracle'], false),
    ],
    relatedRefColumns: [
      refs('verified_by', ['Assertion source']),
      refs('implemented_in', ['Responsibility mapping']),
    ],
  },
  {
    registryId: 'negative-requirement',
    rootClass: 'negative_requirement',
    sourceSection: 'Negative Requirements And Not Done Conditions',
    sourceIdPrefix: 'NEG',
    rootIdPrefix: 'NEG',
    nodeType: 'requirement',
    bodySchemaVersion: 'requirement-contract-requirement/v2',
    projectionKind: 'requirement_v2',
    requirementKind: 'negative',
    fields: [
      field('text', ['Not-done condition', 'Not done condition']),
      field('negativeAssertion', ['Negative assertion']),
      field('blockingCondition', ['Blocks completion when']),
    ],
    relatedRefColumns: [
      refs('bounded_by', ['Failure refs']),
      refs('verified_by', ['Evidence refs']),
    ],
  },
  {
    registryId: 'scope-constraint',
    rootClass: 'constraint',
    sourceSection: 'In Scope',
    sourceIdPrefix: 'SCOPE',
    rootIdPrefix: 'SCOPE',
    nodeType: 'scenario',
    bodySchemaVersion: 'requirements-contract-constraint-root/v1',
    projectionKind: 'generic',
    fields: [field('constraint', ['In-scope capability'])],
    relatedRefColumns: [refs('bounded_by', ['Requirement refs'])],
  },
  {
    registryId: 'out-of-scope-boundary',
    rootClass: 'out_of_scope_boundary',
    sourceSection: 'Out Of Scope',
    sourceIdPrefix: 'OUT',
    rootIdPrefix: 'OUT',
    nodeType: 'requirement',
    bodySchemaVersion: 'requirement-contract-requirement/v2',
    projectionKind: 'requirement_v2',
    requirementKind: 'out_of_scope',
    fields: [
      field('text', ['Forbidden scope', 'Out of scope']),
      field('boundaryAssertion', ['Boundary assertion', 'Scope boundary']),
    ],
    relatedRefColumns: [refs('verified_by', ['Evidence'])],
  },
  {
    registryId: 'architecture-rule',
    rootClass: 'rule',
    sourceSection: 'Architecture Decision Records',
    sourceIdPrefix: 'ADR',
    rootIdPrefix: 'ADR',
    nodeType: 'scenario',
    bodySchemaVersion: 'requirements-contract-rule-root/v1',
    projectionKind: 'generic',
    fields: [
      field('decision', ['Decision']),
      field('requirementImpact', ['Requirement impact'], false),
      field('rejectedAlternatives', ['Rejected alternatives'], false),
    ],
    relatedRefColumns: [refs('bounded_by', ['Requirement impact'])],
  },
  {
    registryId: 'non-functional-threshold',
    rootClass: 'threshold',
    sourceSection: 'Non-Functional Requirements',
    sourceIdPrefix: 'NFR',
    rootIdPrefix: 'THRESHOLD-NFR',
    nodeType: 'scenario',
    bodySchemaVersion: 'requirements-contract-threshold-root/v1',
    projectionKind: 'generic',
    fields: [field('threshold', ['Measurement'])],
    relatedRefColumns: [],
  },
  {
    registryId: 'sequence-condition',
    rootClass: 'condition',
    sourceSection: 'Sequence Branches',
    sourceIdPrefix: 'BRANCH',
    rootIdPrefix: 'COND-BRANCH',
    nodeType: 'branch',
    bodySchemaVersion: 'requirements-contract-condition-root/v1',
    projectionKind: 'generic',
    fields: [field('condition', ['Condition'])],
    relatedRefColumns: [refs('verified_by', ['Test scenario refs'])],
  },
  {
    registryId: 'current-state',
    rootClass: 'state',
    sourceSection: 'Source Current State',
    sourceIdPrefix: 'CUR',
    rootIdPrefix: 'CUR',
    nodeType: 'scenario',
    bodySchemaVersion: 'requirements-contract-state-root/v1',
    projectionKind: 'generic',
    fields: [
      field('behavior', ['Current behavior']),
      field('owner', ['Current owner or path'], false),
      field('limitation', ['Current limitation'], false),
    ],
    relatedRefColumns: [refs('verified_by', ['Evidence'])],
  },
  {
    registryId: 'target-state',
    rootClass: 'state',
    sourceSection: 'Source Target State',
    sourceIdPrefix: 'TGT',
    rootIdPrefix: 'TGT',
    nodeType: 'scenario',
    bodySchemaVersion: 'requirements-contract-state-root/v1',
    projectionKind: 'generic',
    fields: [
      field('behavior', ['Target behavior']),
      field('owner', ['Target owner or path'], false),
      field('acceptanceState', ['Required acceptance state'], false),
    ],
    relatedRefColumns: [refs('verified_by', ['Evidence'])],
  },
  {
    registryId: 'failure',
    rootClass: 'failure',
    sourceSection: 'Failure Matrix',
    sourceIdPrefix: 'FAIL',
    rootIdPrefix: 'FAIL',
    nodeType: 'scenario',
    bodySchemaVersion: 'requirements-contract-failure-root/v1',
    projectionKind: 'generic',
    fields: [
      field('condition', ['Failure condition', 'Failure Trigger']),
      field('requiredBehavior', ['Required system behavior', 'Expected behavior']),
    ],
    relatedRefColumns: [
      refs('bounded_by', ['Negative requirement refs', 'Requirement refs']),
      refs('verified_by', ['Evidence']),
    ],
  },
  {
    registryId: 'retry-policy',
    rootClass: 'retry',
    sourceSection: 'Failure Recovery Semantics',
    sourceIdPrefix: 'RETRY',
    rootIdPrefix: 'RETRY',
    nodeType: 'scenario',
    bodySchemaVersion: 'requirements-contract-retry-root/v1',
    projectionKind: 'generic',
    fields: [field('policy', ['Retry policy']), field('limit', ['Retry limit'], false)],
    relatedRefColumns: [refs('bounded_by', ['Requirement refs'])],
  },
  {
    registryId: 'compensation-policy',
    rootClass: 'compensation',
    sourceSection: 'Failure Recovery Semantics',
    sourceIdPrefix: 'COMP',
    rootIdPrefix: 'COMP',
    nodeType: 'scenario',
    bodySchemaVersion: 'requirements-contract-compensation-root/v1',
    projectionKind: 'generic',
    fields: [field('policy', ['Compensation policy'])],
    relatedRefColumns: [refs('bounded_by', ['Requirement refs'])],
  },
  {
    registryId: 'idempotency-policy',
    rootClass: 'idempotency',
    sourceSection: 'Failure Recovery Semantics',
    sourceIdPrefix: 'IDEMP',
    rootIdPrefix: 'IDEMP',
    nodeType: 'scenario',
    bodySchemaVersion: 'requirements-contract-idempotency-root/v1',
    projectionKind: 'generic',
    fields: [field('policy', ['Idempotency policy']), field('key', ['Idempotency key'], false)],
    relatedRefColumns: [refs('bounded_by', ['Requirement refs'])],
  },
  {
    registryId: 'ordering',
    rootClass: 'ordering',
    sourceSection: 'Sequence Ordering Constraints',
    sourceIdPrefix: 'ORDER',
    rootIdPrefix: 'ORDER',
    nodeType: 'ordering',
    bodySchemaVersion: 'requirements-contract-sequence-ordering-root/v1',
    projectionKind: 'generic',
    fields: [
      field('before', ['Before']),
      field('after', ['After']),
      field('reason', ['Reason'], false),
    ],
    relatedRefColumns: [refs('verified_by', ['Oracle ref', 'Test refs'])],
  },
  {
    registryId: 'temporal',
    rootClass: 'temporal',
    sourceSection: 'Sequence Temporal Constraints',
    sourceIdPrefix: 'TEMP',
    rootIdPrefix: 'TEMP',
    nodeType: 'temporal',
    bodySchemaVersion: 'requirements-contract-sequence-temporal-root/v1',
    projectionKind: 'generic',
    fields: [
      field('stepRef', ['Step ref']),
      field('deadlineMs', ['Deadline ms'], false),
      field('eventualConsistencyWindowMs', ['Eventual consistency window ms'], false),
      field('duplicatePolicy', ['Duplicate policy'], false),
      field('orderingPolicy', ['Ordering policy'], false),
    ],
    relatedRefColumns: [refs('verified_by', ['Oracle ref', 'Test refs'])],
  },
  {
    registryId: 'target-ownership',
    rootClass: 'target_ownership',
    sourceSection: 'Implementation Path Map',
    sourceIdPrefix: 'PATH',
    rootIdPrefix: 'PATH',
    nodeType: 'target',
    bodySchemaVersion: 'requirements-contract-target-root/v1',
    projectionKind: 'generic',
    fields: [
      field('path', ['Repository path']),
      field('ownership', ['Ownership'], false),
      field('requiredChange', ['Required change'], false),
    ],
    relatedRefColumns: [refs('implemented_in', ['Requirement refs'])],
  },
  {
    registryId: 'acceptance',
    rootClass: 'acceptance',
    sourceSection: 'Acceptance Evidence',
    sourceIdPrefix: 'ACC',
    rootIdPrefix: 'ACC',
    nodeType: 'acceptance',
    bodySchemaVersion: 'requirements-contract-acceptance-root/v1',
    projectionKind: 'generic',
    fields: [
      field('target', ['Evidence target']),
      field('oracle', ['Oracle']),
      field('requiredEvidence', ['Required evidence'], false),
    ],
    relatedRefColumns: [refs('verified_by', ['Covers', 'Assertion source'])],
  },
  {
    registryId: 'evidence-requirement',
    rootClass: 'evidence_requirement',
    sourceSection: 'Acceptance Evidence',
    sourceIdPrefix: 'ACC',
    rootIdPrefix: 'EVIDENCE-ACC',
    nodeType: 'evidence_requirement',
    bodySchemaVersion: 'requirements-contract-evidence-requirement-root/v1',
    projectionKind: 'generic',
    fields: [
      field('requiredEvidence', ['Required evidence']),
      field('oracle', ['Oracle'], false),
    ],
    relatedRefColumns: [refs('verified_by', ['Covers', 'Assertion source'])],
  },
  {
    registryId: 'unresolved-decision',
    rootClass: 'unresolved_decision',
    sourceSection: 'Unresolved Decisions',
    sourceIdPrefix: 'UNRESOLVED',
    rootIdPrefix: 'UNRESOLVED',
    nodeType: 'scenario',
    bodySchemaVersion: 'requirements-contract-unresolved-decision-root/v1',
    projectionKind: 'generic',
    fields: [
      field('question', ['Question']),
      field('blocking', ['Blocking'], false),
      field('decisionOwner', ['Decision owner'], false),
    ],
    relatedRefColumns: [refs('bounded_by', ['Requirement refs'])],
  },
] as const satisfies readonly RequirementsContractSourceRootClassDefinition[];

export const SOURCE_ROOT_CLASS_REGISTRY_HASH = sha256Stable({
  schemaVersion: SOURCE_ROOT_CLASS_REGISTRY_VERSION,
  entries: REQUIREMENTS_CONTRACT_SOURCE_ROOT_CLASS_REGISTRY,
});

export type RequirementsContractRegisteredSourceRootClass =
  (typeof REQUIREMENTS_CONTRACT_SOURCE_ROOT_CLASS_REGISTRY)[number]['rootClass'];

const registeredRootClasses: ReadonlySet<string> = new Set(
  REQUIREMENTS_CONTRACT_SOURCE_ROOT_CLASS_REGISTRY.map((entry) => entry.rootClass)
);

export function isRegisteredSourceRootClass(
  rootClass: string
): rootClass is RequirementsContractRegisteredSourceRootClass {
  return registeredRootClasses.has(rootClass);
}
