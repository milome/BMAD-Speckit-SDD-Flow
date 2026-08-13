import {
  isCanonicalJsonValue,
  sha256Stable,
} from './requirements-contract-semantic-resolver';

export type RequirementsGrillInvestigationKind =
  | 'source'
  | 'repository'
  | 'architecture'
  | 'policy'
  | 'glossary'
  | 'tests';

export interface RequirementsGrillSourceEvidence {
  path: string;
  hash: string;
  excerptHash: string;
}

export interface RequirementsGrillInvestigationRecord {
  kind: RequirementsGrillInvestigationKind;
  ref: string;
  hash: string;
  finding: string;
  resolution: 'resolved' | 'unresolved';
}

export interface RequirementsGrillAffectedArtifactRefs {
  semanticIr: string[];
  render: string[];
  oracle: string[];
  red: string[];
  packet: string[];
  evidence: string[];
}

export interface RequirementsGrillOption {
  optionId: string;
  value: unknown;
  provenanceRefs: string[];
  behaviorImpact: string;
  deliveryImpact: string;
}

export interface RequirementsGrillQuestionPacket {
  schemaVersion: 'requirements-grill-question/v1';
  questionId: string;
  fieldRef: string;
  issueCode: string;
  sourceEvidence: RequirementsGrillSourceEvidence[];
  investigations: RequirementsGrillInvestigationRecord[];
  dependencies: string[];
  affectedRequirementRefs: string[];
  affectedArtifactRefs: RequirementsGrillAffectedArtifactRefs;
  options: RequirementsGrillOption[];
  recommendation: {
    optionId: string;
    rationale: string;
    selected: false;
  };
  responsePaths: ['select_option', 'custom_answer', 'reject', 'defer'];
  questionHash: string;
}

export interface CreateRequirementsGrillQuestionPacketInput {
  questionId: string;
  fieldRef: string;
  issueCode: string;
  sourceEvidence: RequirementsGrillSourceEvidence[];
  investigations: RequirementsGrillInvestigationRecord[];
  dependencies: string[];
  affectedRequirementRefs: string[];
  affectedArtifactRefs: RequirementsGrillAffectedArtifactRefs;
  options: RequirementsGrillOption[];
  recommendation: {
    optionId: string;
    rationale: string;
  };
}

export interface RequirementsGrillQuestionGraphNode {
  questionId: string;
  questionVersion: string;
  dependencies: string[];
  affectedFieldIds: string[];
  authorityPremiseHashes: string[];
  affectedNodeIds: string[];
}

export interface RequirementsGrillQuestionGraph {
  schemaVersion: 'requirements-grill-question-graph/v1';
  authoringRequestId: string;
  grillSessionId: string;
  questions: RequirementsGrillQuestionGraphNode[];
  resolvedQuestionIds: string[];
  dependencyOrder: string[];
  readyFrontier: string[];
  graphHash: string;
}

export interface CreateRequirementsGrillQuestionGraphInput {
  authoringRequestId: string;
  grillSessionId: string;
  questions: RequirementsGrillQuestionGraphNode[];
  resolvedQuestionIds: string[];
}

const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const INVESTIGATION_KINDS: RequirementsGrillInvestigationKind[] = [
  'source',
  'repository',
  'architecture',
  'policy',
  'glossary',
  'tests',
];
const ARTIFACT_KEYS: Array<keyof RequirementsGrillAffectedArtifactRefs> = [
  'semanticIr',
  'render',
  'oracle',
  'red',
  'packet',
  'evidence',
];

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function uniqueStrings(values: unknown): values is string[] {
  return (
    Array.isArray(values) &&
    values.every(nonEmpty) &&
    new Set(values).size === values.length
  );
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function utf8SortedUnique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.normalize('NFC')))].sort(
    (left, right) => Buffer.from(left, 'utf8').compare(Buffer.from(right, 'utf8'))
  );
}

function normalizeQuestionGraphNode(
  value: RequirementsGrillQuestionGraphNode
): RequirementsGrillQuestionGraphNode {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join('|') !==
      [
        'affectedFieldIds',
        'affectedNodeIds',
        'authorityPremiseHashes',
        'dependencies',
        'questionId',
        'questionVersion',
      ].sort().join('|') ||
    !nonEmpty(value.questionId) ||
    !nonEmpty(value.questionVersion) ||
    !uniqueStrings(value.dependencies) ||
    !uniqueStrings(value.affectedFieldIds) ||
    value.affectedFieldIds.length === 0 ||
    !uniqueStrings(value.authorityPremiseHashes) ||
    value.authorityPremiseHashes.length === 0 ||
    value.authorityPremiseHashes.some((hash) => !SHA256.test(hash)) ||
    !uniqueStrings(value.affectedNodeIds) ||
    value.affectedNodeIds.length === 0
  ) {
    throw new Error('requirements_grill_question_graph_node_invalid');
  }
  return {
    questionId: value.questionId.normalize('NFC'),
    questionVersion: value.questionVersion.normalize('NFC'),
    dependencies: utf8SortedUnique(value.dependencies),
    affectedFieldIds: utf8SortedUnique(value.affectedFieldIds),
    authorityPremiseHashes: utf8SortedUnique(value.authorityPremiseHashes),
    affectedNodeIds: utf8SortedUnique(value.affectedNodeIds),
  };
}

export function createRequirementsGrillQuestionGraph(
  input: CreateRequirementsGrillQuestionGraphInput
): RequirementsGrillQuestionGraph {
  if (
    !nonEmpty(input.authoringRequestId) ||
    !nonEmpty(input.grillSessionId) ||
    !Array.isArray(input.questions) ||
    !uniqueStrings(input.resolvedQuestionIds)
  ) {
    throw new Error('requirements_grill_question_graph_input_invalid');
  }
  const questions = input.questions
    .map(normalizeQuestionGraphNode)
    .sort((left, right) =>
      Buffer.from(left.questionId, 'utf8').compare(Buffer.from(right.questionId, 'utf8'))
    );
  const ids = questions.map((question) => question.questionId);
  if (new Set(ids).size !== ids.length) {
    throw new Error('requirements_grill_question_graph_duplicate_question');
  }
  const knownIds = new Set(ids);
  for (const question of questions) {
    if (question.dependencies.some((dependency) => !knownIds.has(dependency))) {
      throw new Error('requirements_grill_question_graph_dependency_unknown');
    }
  }
  const resolvedQuestionIds = utf8SortedUnique(input.resolvedQuestionIds);
  if (resolvedQuestionIds.some((questionId) => !knownIds.has(questionId))) {
    throw new Error('requirements_grill_question_graph_resolved_unknown');
  }
  const remainingDependencies = new Map(
    questions.map((question) => [question.questionId, new Set(question.dependencies)])
  );
  const dependencyOrder: string[] = [];
  while (dependencyOrder.length < questions.length) {
    const ready = ids.filter(
      (questionId) =>
        !dependencyOrder.includes(questionId) &&
        remainingDependencies.get(questionId)?.size === 0
    );
    if (ready.length === 0) {
      throw new Error('requirements_grill_question_graph_cycle');
    }
    for (const questionId of ready) {
      dependencyOrder.push(questionId);
      for (const dependencies of remainingDependencies.values()) {
        dependencies.delete(questionId);
      }
    }
  }
  const resolved = new Set(resolvedQuestionIds);
  const readyFrontier = questions
    .filter(
      (question) =>
        !resolved.has(question.questionId) &&
        question.dependencies.every((dependency) => resolved.has(dependency))
    )
    .map((question) => question.questionId);
  const payload = {
    schemaVersion: 'requirements-grill-question-graph/v1' as const,
    authoringRequestId: input.authoringRequestId.normalize('NFC'),
    grillSessionId: input.grillSessionId.normalize('NFC'),
    questions,
    resolvedQuestionIds,
    dependencyOrder,
    readyFrontier,
  };
  return {
    ...payload,
    graphHash: sha256Stable({
      domain: 'requirements-grill-question-graph-hash/v1',
      payload,
    }),
  };
}

export function validateRequirementsGrillQuestionGraph(
  value: unknown
): value is RequirementsGrillQuestionGraph {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const graph = value as RequirementsGrillQuestionGraph;
  if (
    Object.keys(graph).sort().join('|') !==
      [
        'authoringRequestId',
        'dependencyOrder',
        'graphHash',
        'grillSessionId',
        'questions',
        'readyFrontier',
        'resolvedQuestionIds',
        'schemaVersion',
      ].sort().join('|') ||
    graph.schemaVersion !== 'requirements-grill-question-graph/v1' ||
    !SHA256.test(graph.graphHash)
  ) {
    return false;
  }
  try {
    return sha256Stable(graph) === sha256Stable(createRequirementsGrillQuestionGraph(graph));
  } catch {
    return false;
  }
}

function validateSourceEvidence(value: unknown): value is RequirementsGrillSourceEvidence[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((row) =>
      Boolean(
        row &&
        typeof row === 'object' &&
        !Array.isArray(row) &&
        Object.keys(row).length === 3 &&
        nonEmpty((row as RequirementsGrillSourceEvidence).path) &&
        SHA256.test((row as RequirementsGrillSourceEvidence).hash) &&
        SHA256.test((row as RequirementsGrillSourceEvidence).excerptHash)
      )
    )
  );
}

function validateInvestigations(
  value: unknown
): value is RequirementsGrillInvestigationRecord[] {
  if (!Array.isArray(value) || value.length !== INVESTIGATION_KINDS.length) return false;
  const observed = new Set<RequirementsGrillInvestigationKind>();
  for (const row of value) {
    if (
      !row ||
      typeof row !== 'object' ||
      Array.isArray(row) ||
      Object.keys(row).length !== 5
    ) {
      return false;
    }
    const record = row as RequirementsGrillInvestigationRecord;
    if (
      !INVESTIGATION_KINDS.includes(record.kind) ||
      observed.has(record.kind) ||
      !nonEmpty(record.ref) ||
      !SHA256.test(record.hash) ||
      !nonEmpty(record.finding) ||
      record.resolution !== 'unresolved'
    ) {
      return false;
    }
    observed.add(record.kind);
  }
  return INVESTIGATION_KINDS.every((kind) => observed.has(kind));
}

function validateAffectedArtifacts(
  value: unknown
): value is RequirementsGrillAffectedArtifactRefs {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).length === ARTIFACT_KEYS.length &&
    ARTIFACT_KEYS.every((key) => uniqueStrings(record[key]))
  );
}

function validateOptions(value: unknown): value is RequirementsGrillOption[] {
  if (!Array.isArray(value) || value.length < 2) return false;
  const ids = new Set<string>();
  for (const row of value) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
    const option = row as RequirementsGrillOption;
    if (
      Object.keys(option).length !== 5 ||
      !nonEmpty(option.optionId) ||
      ids.has(option.optionId) ||
      !isCanonicalJsonValue(option.value) ||
      !uniqueStrings(option.provenanceRefs) ||
      option.provenanceRefs.length === 0 ||
      !nonEmpty(option.behaviorImpact) ||
      !nonEmpty(option.deliveryImpact)
    ) {
      return false;
    }
    ids.add(option.optionId);
  }
  return true;
}

export function validateRequirementsGrillQuestionPacket(
  value: unknown
): value is RequirementsGrillQuestionPacket {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const packet = value as RequirementsGrillQuestionPacket;
  const permitted = new Set([
    'schemaVersion',
    'questionId',
    'fieldRef',
    'issueCode',
    'sourceEvidence',
    'investigations',
    'dependencies',
    'affectedRequirementRefs',
    'affectedArtifactRefs',
    'options',
    'recommendation',
    'responsePaths',
    'questionHash',
  ]);
  if (
    Object.keys(packet).some((key) => !permitted.has(key)) ||
    packet.schemaVersion !== 'requirements-grill-question/v1' ||
    !nonEmpty(packet.questionId) ||
    !nonEmpty(packet.fieldRef) ||
    !nonEmpty(packet.issueCode) ||
    !validateSourceEvidence(packet.sourceEvidence) ||
    !validateInvestigations(packet.investigations) ||
    !uniqueStrings(packet.dependencies) ||
    packet.dependencies.includes(packet.questionId) ||
    !uniqueStrings(packet.affectedRequirementRefs) ||
    packet.affectedRequirementRefs.length === 0 ||
    !validateAffectedArtifacts(packet.affectedArtifactRefs) ||
    !validateOptions(packet.options) ||
    !packet.recommendation ||
    !nonEmpty(packet.recommendation.optionId) ||
    !nonEmpty(packet.recommendation.rationale) ||
    packet.recommendation.selected !== false ||
    !packet.options.some((option) => option.optionId === packet.recommendation.optionId) ||
    JSON.stringify(packet.responsePaths) !==
      JSON.stringify(['select_option', 'custom_answer', 'reject', 'defer']) ||
    !SHA256.test(packet.questionHash)
  ) {
    return false;
  }
  const { questionHash, ...payload } = packet;
  return questionHash === sha256Stable(payload);
}

export function createRequirementsGrillQuestionPacket(
  input: CreateRequirementsGrillQuestionPacketInput
): RequirementsGrillQuestionPacket {
  const payload = {
    schemaVersion: 'requirements-grill-question/v1' as const,
    questionId: input.questionId,
    fieldRef: input.fieldRef,
    issueCode: input.issueCode,
    sourceEvidence: clone(input.sourceEvidence),
    investigations: clone(input.investigations),
    dependencies: clone(input.dependencies),
    affectedRequirementRefs: clone(input.affectedRequirementRefs),
    affectedArtifactRefs: clone(input.affectedArtifactRefs),
    options: clone(input.options),
    recommendation: {
      optionId: input.recommendation.optionId,
      rationale: input.recommendation.rationale,
      selected: false as const,
    },
    responsePaths: [
      'select_option',
      'custom_answer',
      'reject',
      'defer',
    ] as RequirementsGrillQuestionPacket['responsePaths'],
  };
  const packet: RequirementsGrillQuestionPacket = {
    ...payload,
    questionHash: sha256Stable(payload),
  };
  if (!validateRequirementsGrillQuestionPacket(packet)) {
    throw new Error('requirements_grill_question_invalid');
  }
  return packet;
}
