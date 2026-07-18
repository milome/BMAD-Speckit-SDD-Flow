import {
  createInteractionDecisionReceipt,
  type InteractionDecisionReceipt,
} from './requirements-contract-interaction-resolver';
import {
  type RequirementsGrillQuestionPacket,
  validateRequirementsGrillQuestionPacket,
} from './requirements-contract-grill-model';
import {
  applySemanticFieldValue,
  isCanonicalJsonValue,
  sha256Stable,
} from './requirements-contract-semantic-resolver';

export type RequirementsGrillResponseDecision =
  | 'select_option'
  | 'custom_answer'
  | 'reject'
  | 'defer';

export interface RequirementsGrillResponse {
  schemaVersion: 'requirements-grill-response/v1';
  responseId: string;
  questionId: string;
  questionHash: string;
  decision: RequirementsGrillResponseDecision;
  optionId?: string;
  customAnswer?: string;
  reason?: string;
  respondedAt: string;
  responseHash: string;
}

export interface RequirementsGrillQuestionState {
  status: 'unresolved' | 'confirmed';
  decisionReceiptRef: string | null;
  lastResponseDecision: RequirementsGrillResponseDecision | null;
}

export interface RequirementsGrillSession {
  schemaVersion: 'requirements-grill-session/v1';
  sessionId: string;
  requirementSetId: string;
  semanticModelHash: string;
  createdAt: string;
  questions: RequirementsGrillQuestionPacket[];
  orderedQuestionIds: string[];
  questionStates: Record<string, RequirementsGrillQuestionState>;
  activeQuestionId: string | null;
  activeQuestionCount: 0 | 1;
  unresolvedQueueHash: string;
  dependencyGraphHash: string;
  decisionReceiptRefs: string[];
  resumeState: 'awaiting_response' | 'paused' | 'completed';
  sessionHash: string;
}

export interface CreateRequirementsGrillSessionInput {
  sessionId: string;
  requirementSetId: string;
  semanticModelHash: string;
  createdAt: string;
  questions: RequirementsGrillQuestionPacket[];
}

export interface SubmitRequirementsGrillResponseInput {
  session: RequirementsGrillSession;
  response: RequirementsGrillResponse;
  semanticModelBefore: Record<string, unknown>;
  receiptRef: string;
  confirmedAt: string;
}

export interface SubmitRequirementsGrillResponseResult {
  session: RequirementsGrillSession;
  decisionReceipt: InteractionDecisionReceipt | null;
  semanticModelAfter: Record<string, unknown>;
}

const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const ARTIFACT_ORDER = [
  'semanticIr',
  'render',
  'oracle',
  'red',
  'packet',
  'evidence',
] as const;

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function responsePayload(
  input: Omit<RequirementsGrillResponse, 'schemaVersion' | 'responseHash'>
): Omit<RequirementsGrillResponse, 'responseHash'> {
  return {
    schemaVersion: 'requirements-grill-response/v1',
    responseId: input.responseId,
    questionId: input.questionId,
    questionHash: input.questionHash,
    decision: input.decision,
    ...(input.optionId === undefined ? {} : { optionId: input.optionId }),
    ...(input.customAnswer === undefined ? {} : { customAnswer: input.customAnswer }),
    ...(input.reason === undefined ? {} : { reason: input.reason }),
    respondedAt: input.respondedAt,
  };
}

export function validateRequirementsGrillResponse(
  value: unknown
): value is RequirementsGrillResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const response = value as RequirementsGrillResponse;
  const baseValid =
    response.schemaVersion === 'requirements-grill-response/v1' &&
    nonEmpty(response.responseId) &&
    nonEmpty(response.questionId) &&
    SHA256.test(response.questionHash) &&
    ['select_option', 'custom_answer', 'reject', 'defer'].includes(response.decision) &&
    ISO_TIMESTAMP.test(response.respondedAt) &&
    SHA256.test(response.responseHash);
  if (!baseValid) return false;
  if (
    response.decision === 'select_option' &&
    (!nonEmpty(response.optionId) ||
      response.customAnswer !== undefined ||
      response.reason !== undefined)
  ) {
    return false;
  }
  if (
    response.decision === 'custom_answer' &&
    (!nonEmpty(response.customAnswer) ||
      response.optionId !== undefined ||
      response.reason !== undefined)
  ) {
    return false;
  }
  if (
    (response.decision === 'reject' || response.decision === 'defer') &&
    (!nonEmpty(response.reason) ||
      response.optionId !== undefined ||
      response.customAnswer !== undefined)
  ) {
    return false;
  }
  const { responseHash, ...payload } = response;
  return responseHash === sha256Stable(payload);
}

export function createRequirementsGrillResponse(
  input: Omit<RequirementsGrillResponse, 'schemaVersion' | 'responseHash'>
): RequirementsGrillResponse {
  const payload = responsePayload(input);
  const response: RequirementsGrillResponse = {
    ...payload,
    responseHash: sha256Stable(payload),
  };
  if (!validateRequirementsGrillResponse(response)) {
    throw new Error('requirements_grill_response_invalid');
  }
  return response;
}

function orderedQuestions(
  questions: RequirementsGrillQuestionPacket[]
): RequirementsGrillQuestionPacket[] {
  const byId = new Map(questions.map((question) => [question.questionId, question]));
  if (byId.size !== questions.length) {
    throw new Error('requirements_grill_question_id_duplicate');
  }
  for (const question of questions) {
    for (const dependency of question.dependencies) {
      if (!byId.has(dependency)) {
        throw new Error(`requirements_grill_dependency_unknown:${dependency}`);
      }
    }
  }
  const remaining = new Map(
    questions.map((question) => [question.questionId, new Set(question.dependencies)])
  );
  const result: RequirementsGrillQuestionPacket[] = [];
  while (remaining.size > 0) {
    const ready = [...remaining.entries()]
      .filter(([, dependencies]) => dependencies.size === 0)
      .map(([questionId]) => questionId)
      .sort();
    if (ready.length === 0) {
      throw new Error('requirements_grill_dependency_cycle');
    }
    for (const questionId of ready) {
      result.push(byId.get(questionId)!);
      remaining.delete(questionId);
      for (const dependencies of remaining.values()) dependencies.delete(questionId);
    }
  }
  return result;
}

function nextActiveQuestionId(
  session: Pick<RequirementsGrillSession, 'orderedQuestionIds' | 'questionStates' | 'questions'>
): string | null {
  const byId = new Map(session.questions.map((question) => [question.questionId, question]));
  return (
    session.orderedQuestionIds.find((questionId) => {
      const state = session.questionStates[questionId];
      const question = byId.get(questionId);
      return (
        state?.status === 'unresolved' &&
        question?.dependencies.every(
          (dependency) => session.questionStates[dependency]?.status === 'confirmed'
        )
      );
    }) ?? null
  );
}

function finalizeSession(
  input: Omit<
    RequirementsGrillSession,
    | 'activeQuestionId'
    | 'activeQuestionCount'
    | 'unresolvedQueueHash'
    | 'dependencyGraphHash'
    | 'resumeState'
    | 'sessionHash'
  >,
  forcedResumeState?: RequirementsGrillSession['resumeState']
): RequirementsGrillSession {
  const activeQuestionId =
    forcedResumeState === 'paused' ? null : nextActiveQuestionId(input);
  const unresolvedQuestionIds = input.orderedQuestionIds.filter(
    (questionId) => input.questionStates[questionId]?.status === 'unresolved'
  );
  const dependencyGraph = input.questions
    .map((question) => ({
      questionId: question.questionId,
      dependencies: [...question.dependencies],
    }))
    .sort((left, right) => left.questionId.localeCompare(right.questionId));
  const resumeState =
    forcedResumeState ??
    (activeQuestionId
      ? 'awaiting_response'
      : unresolvedQuestionIds.length === 0
        ? 'completed'
        : 'paused');
  const payload = {
    ...clone(input),
    activeQuestionId,
    activeQuestionCount: (activeQuestionId ? 1 : 0) as 0 | 1,
    unresolvedQueueHash: sha256Stable(unresolvedQuestionIds),
    dependencyGraphHash: sha256Stable(dependencyGraph),
    resumeState,
  };
  return {
    ...payload,
    sessionHash: sha256Stable(payload),
  };
}

export function validateRequirementsGrillSession(
  value: unknown
): value is RequirementsGrillSession {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const session = value as RequirementsGrillSession;
  if (
    session.schemaVersion !== 'requirements-grill-session/v1' ||
    !nonEmpty(session.sessionId) ||
    !nonEmpty(session.requirementSetId) ||
    !SHA256.test(session.semanticModelHash) ||
    !ISO_TIMESTAMP.test(session.createdAt) ||
    !Array.isArray(session.questions) ||
    !session.questions.every(validateRequirementsGrillQuestionPacket) ||
    !Array.isArray(session.orderedQuestionIds) ||
    !session.questionStates ||
    typeof session.questionStates !== 'object' ||
    ![0, 1].includes(session.activeQuestionCount) ||
    (session.activeQuestionCount === 0) !== (session.activeQuestionId === null) ||
    !SHA256.test(session.unresolvedQueueHash) ||
    !SHA256.test(session.dependencyGraphHash) ||
    !Array.isArray(session.decisionReceiptRefs) ||
    !['awaiting_response', 'paused', 'completed'].includes(session.resumeState) ||
    !SHA256.test(session.sessionHash)
  ) {
    return false;
  }
  try {
    const { sessionHash, ...payload } = session;
    return (
      sessionHash === sha256Stable(payload) &&
      orderedQuestions(session.questions).map((question) => question.questionId).join('|') ===
        session.orderedQuestionIds.join('|')
    );
  } catch {
    return false;
  }
}

export function createRequirementsGrillSession(
  input: CreateRequirementsGrillSessionInput
): RequirementsGrillSession {
  if (
    !nonEmpty(input.sessionId) ||
    !nonEmpty(input.requirementSetId) ||
    !SHA256.test(input.semanticModelHash) ||
    !ISO_TIMESTAMP.test(input.createdAt) ||
    !Array.isArray(input.questions) ||
    input.questions.length === 0 ||
    !input.questions.every(validateRequirementsGrillQuestionPacket)
  ) {
    throw new Error('requirements_grill_session_input_invalid');
  }
  const questions = orderedQuestions(input.questions);
  const questionStates = Object.fromEntries(
    questions.map((question) => [
      question.questionId,
      {
        status: 'unresolved' as const,
        decisionReceiptRef: null,
        lastResponseDecision: null,
      },
    ])
  );
  const session = finalizeSession({
    schemaVersion: 'requirements-grill-session/v1',
    sessionId: input.sessionId,
    requirementSetId: input.requirementSetId,
    semanticModelHash: input.semanticModelHash,
    createdAt: input.createdAt,
    questions,
    orderedQuestionIds: questions.map((question) => question.questionId),
    questionStates,
    decisionReceiptRefs: [],
  });
  if (!validateRequirementsGrillSession(session)) {
    throw new Error('requirements_grill_session_invalid');
  }
  return session;
}

function invalidatedArtifactRefs(question: RequirementsGrillQuestionPacket): string[] {
  return ARTIFACT_ORDER.flatMap((key) => question.affectedArtifactRefs[key]);
}

export function submitRequirementsGrillResponse(
  input: SubmitRequirementsGrillResponseInput
): SubmitRequirementsGrillResponseResult {
  if (
    !validateRequirementsGrillSession(input.session) ||
    !validateRequirementsGrillResponse(input.response) ||
    !isCanonicalJsonValue(input.semanticModelBefore) ||
    sha256Stable(input.semanticModelBefore) !== input.session.semanticModelHash ||
    !nonEmpty(input.receiptRef) ||
    !ISO_TIMESTAMP.test(input.confirmedAt)
  ) {
    throw new Error('requirements_grill_submission_invalid');
  }
  const active = input.session.questions.find(
    (question) => question.questionId === input.session.activeQuestionId
  );
  if (
    !active ||
    input.response.questionId !== active.questionId ||
    input.response.questionHash !== active.questionHash
  ) {
    throw new Error('requirements_grill_response_not_active');
  }
  if (input.response.decision === 'reject' || input.response.decision === 'defer') {
    const questionStates = clone(input.session.questionStates);
    questionStates[active.questionId] = {
      status: 'unresolved',
      decisionReceiptRef: null,
      lastResponseDecision: input.response.decision,
    };
    return {
      session: finalizeSession(
        {
          schemaVersion: input.session.schemaVersion,
          sessionId: input.session.sessionId,
          requirementSetId: input.session.requirementSetId,
          semanticModelHash: input.session.semanticModelHash,
          createdAt: input.session.createdAt,
          questions: input.session.questions,
          orderedQuestionIds: input.session.orderedQuestionIds,
          questionStates,
          decisionReceiptRefs: input.session.decisionReceiptRefs,
        },
        'paused'
      ),
      decisionReceipt: null,
      semanticModelAfter: clone(input.semanticModelBefore),
    };
  }
  const selectedOption =
    input.response.decision === 'select_option'
      ? active.options.find((option) => option.optionId === input.response.optionId)
      : null;
  if (input.response.decision === 'select_option' && !selectedOption) {
    throw new Error('requirements_grill_option_unknown');
  }
  const selectedValue =
    input.response.decision === 'select_option'
      ? selectedOption!.value
      : input.response.customAnswer!;
  const semanticModelAfterValue = applySemanticFieldValue(
    input.semanticModelBefore,
    active.fieldRef,
    selectedValue
  );
  if (
    !semanticModelAfterValue ||
    typeof semanticModelAfterValue !== 'object' ||
    Array.isArray(semanticModelAfterValue)
  ) {
    throw new Error('requirements_grill_field_ref_invalid');
  }
  const semanticModelAfter = semanticModelAfterValue;
  const selection =
    input.response.decision === 'select_option'
      ? { kind: 'option' as const, optionId: input.response.optionId! }
      : { kind: 'custom_answer' as const, customAnswer: input.response.customAnswer! };
  const decisionReceipt = createInteractionDecisionReceipt({
    receiptRef: input.receiptRef,
    questionId: active.questionId,
    questionHash: active.questionHash,
    responseId: input.response.responseId,
    responseHash: input.response.responseHash,
    selection,
    fieldRef: active.fieldRef,
    value: selectedValue,
    sequenceModelBefore: input.semanticModelBefore,
    sequenceModelAfter: semanticModelAfter,
    affectedRequirementRefs: active.affectedRequirementRefs,
    invalidatedArtifactRefs: invalidatedArtifactRefs(active),
    confirmedAt: input.confirmedAt,
  });
  const questionStates = clone(input.session.questionStates);
  questionStates[active.questionId] = {
    status: 'confirmed',
    decisionReceiptRef: decisionReceipt.receiptRef,
    lastResponseDecision: input.response.decision,
  };
  const session = finalizeSession({
    schemaVersion: input.session.schemaVersion,
    sessionId: input.session.sessionId,
    requirementSetId: input.session.requirementSetId,
    semanticModelHash: decisionReceipt.sequenceModelHashAfter,
    createdAt: input.session.createdAt,
    questions: input.session.questions,
    orderedQuestionIds: input.session.orderedQuestionIds,
    questionStates,
    decisionReceiptRefs: [...input.session.decisionReceiptRefs, decisionReceipt.receiptRef],
  });
  return { session, decisionReceipt, semanticModelAfter };
}
