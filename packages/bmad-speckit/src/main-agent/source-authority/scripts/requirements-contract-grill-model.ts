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
