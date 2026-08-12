import {
  createInteractionDecisionReceipt,
  type InteractionDecisionReceipt,
} from './requirements-contract-interaction-resolver';
import {
  createRequirementsGrillQuestionGraph,
  type RequirementsGrillQuestionGraph,
  type RequirementsGrillQuestionGraphNode,
  type RequirementsGrillQuestionPacket,
  validateRequirementsGrillQuestionGraph,
  validateRequirementsGrillQuestionPacket,
} from './requirements-contract-grill-model';
import {
  applySemanticFieldValue,
  isCanonicalJsonValue,
  sha256Stable,
} from './requirements-contract-semantic-resolver';
import path from 'node:path';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import {
  atomicNoClobberPublish,
} from './requirements-contract-atomic-no-clobber-publisher';

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

export interface RequirementsContractDecisionReceipt {
  schemaVersion: 'requirements-contract-decision-receipt/v1';
  decisionReceiptId: string;
  authoringRequestId: string;
  grillSessionId: string;
  questionId: string;
  questionVersion: string;
  affectedFieldIds: string[];
  authorityPremiseHashes: string[];
  answerValue: unknown;
  answerSchemaHash: string;
  affectedNodeIds: string[];
  userInputProvenance: { authorityOrigin: string };
  receiptHash: string;
}

export interface CreateRequirementsContractDecisionReceiptInput {
  authoringRequestId: string;
  grillSessionId: string;
  questionId: string;
  questionVersion: string;
  affectedFieldIds: string[];
  authorityPremiseHashes: string[];
  answerValue: unknown;
  answerSchemaHash: string;
  affectedNodeIds: string[];
  userInputProvenance: { authorityOrigin: string };
}

export interface RequirementsGrillSessionSnapshotQuestion
  extends RequirementsGrillQuestionGraphNode {
  question: string;
  answerSchema: unknown;
  answerSchemaHash: string;
  userInputProvenance: { authorityOrigin: string };
}

export interface RequirementsGrillSessionSnapshot {
  schemaVersion: 'requirements-grill-session-snapshot/v1';
  authoringRequestId: string;
  authoringAttemptId: string;
  grillSessionId: string;
  confirmationLanguage: string;
  intakeSource: string;
  targetSource: string;
  authoritySourceListHash: string;
  questions: RequirementsGrillSessionSnapshotQuestion[];
  questionGraph: RequirementsGrillQuestionGraph;
  readyQuestionIds: string[];
}

export interface RequirementsGrillSessionResolution {
  session: RequirementsGrillSessionSnapshot;
  questionGraph: RequirementsGrillQuestionGraph;
  questionById: Map<string, RequirementsGrillSessionSnapshotQuestion>;
  receiptByQuestionId: Map<string, RequirementsContractDecisionReceipt>;
  decisionReceiptRefs: Array<{ path: string; hash: string }>;
}

export function assertRequirementsGrillSessionPathConfinement(input: {
  recordRoot: string;
  targetPath: string;
  pathEscapeCode?: string;
}): void {
  const recordRoot = path.resolve(input.recordRoot);
  const sessionsRoot = path.resolve(recordRoot, 'authoring', 'decisions', 'sessions');
  const targetPath = path.resolve(input.targetPath);
  const relative = path.relative(sessionsRoot, targetPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(input.pathEscapeCode ?? 'requirements_grill_session_path_escape');
  }
  const components = path.relative(recordRoot, targetPath).split(path.sep).filter(Boolean);
  let current = recordRoot;
  if (existsSync(current) && lstatSync(current).isSymbolicLink()) {
    throw new Error('requirements_grill_session_path_reparse_forbidden');
  }
  for (const component of components) {
    current = path.join(current, component);
    if (!existsSync(current)) break;
    if (lstatSync(current).isSymbolicLink()) {
      throw new Error('requirements_grill_session_path_reparse_forbidden');
    }
  }
}

function sortedUniqueNormalized(values: unknown, issueCode: string): string[] {
  if (!Array.isArray(values) || values.some((value) => !nonEmpty(value))) {
    throw new Error(issueCode);
  }
  return [...new Set(values.map((value) => String(value).normalize('NFC')))].sort(
    (left, right) => Buffer.from(left, 'utf8').compare(Buffer.from(right, 'utf8'))
  );
}

function decisionReceiptPayload(
  input: CreateRequirementsContractDecisionReceiptInput
): Omit<RequirementsContractDecisionReceipt, 'decisionReceiptId' | 'receiptHash'> {
  if (
    !nonEmpty(input.authoringRequestId) ||
    !nonEmpty(input.grillSessionId) ||
    !nonEmpty(input.questionId) ||
    !nonEmpty(input.questionVersion) ||
    !SHA256.test(input.answerSchemaHash) ||
    !isCanonicalJsonValue(input.answerValue) ||
    !input.userInputProvenance ||
    Object.keys(input.userInputProvenance).join('|') !== 'authorityOrigin' ||
    !nonEmpty(input.userInputProvenance.authorityOrigin)
  ) {
    throw new Error('requirements_decision_receipt_input_invalid');
  }
  const affectedFieldIds = sortedUniqueNormalized(
    input.affectedFieldIds,
    'requirements_decision_receipt_affected_fields_invalid'
  );
  const authorityPremiseHashes = sortedUniqueNormalized(
    input.authorityPremiseHashes,
    'requirements_decision_receipt_premises_invalid'
  );
  const affectedNodeIds = sortedUniqueNormalized(
    input.affectedNodeIds,
    'requirements_decision_receipt_affected_nodes_invalid'
  );
  if (
    affectedFieldIds.length === 0 ||
    authorityPremiseHashes.length === 0 ||
    affectedNodeIds.length === 0 ||
    authorityPremiseHashes.some((hash) => !SHA256.test(hash))
  ) {
    throw new Error('requirements_decision_receipt_authority_invalid');
  }
  return {
    schemaVersion: 'requirements-contract-decision-receipt/v1',
    authoringRequestId: input.authoringRequestId.normalize('NFC'),
    grillSessionId: input.grillSessionId.normalize('NFC'),
    questionId: input.questionId.normalize('NFC'),
    questionVersion: input.questionVersion.normalize('NFC'),
    affectedFieldIds,
    authorityPremiseHashes,
    answerValue: clone(input.answerValue),
    answerSchemaHash: input.answerSchemaHash,
    affectedNodeIds,
    userInputProvenance: {
      authorityOrigin: input.userInputProvenance.authorityOrigin.normalize('NFC'),
    },
  };
}

export function createRequirementsContractDecisionReceipt(
  input: CreateRequirementsContractDecisionReceiptInput
): RequirementsContractDecisionReceipt {
  const payload = decisionReceiptPayload(input);
  const decisionReceiptId = `DECISION-${sha256Stable({
    domain: 'requirements-contract-decision-receipt-id/v1',
    authoringRequestId: payload.authoringRequestId,
    grillSessionId: payload.grillSessionId,
    questionId: payload.questionId,
    questionVersion: payload.questionVersion,
    affectedFieldIds: payload.affectedFieldIds,
    authorityPremiseHashes: payload.authorityPremiseHashes,
  }).slice('sha256:'.length).toUpperCase()}`;
  const withoutHash = { ...payload, decisionReceiptId };
  return {
    ...withoutHash,
    receiptHash: sha256Stable({
      domain: 'requirements-contract-decision-receipt-hash/v1',
      payload: withoutHash,
    }),
  };
}

export function validateRequirementsContractDecisionReceipt(
  value: unknown
): value is RequirementsContractDecisionReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const receipt = value as RequirementsContractDecisionReceipt;
  const permitted = [
    'schemaVersion',
    'decisionReceiptId',
    'authoringRequestId',
    'grillSessionId',
    'questionId',
    'questionVersion',
    'affectedFieldIds',
    'authorityPremiseHashes',
    'answerValue',
    'answerSchemaHash',
    'affectedNodeIds',
    'userInputProvenance',
    'receiptHash',
  ];
  if (Object.keys(receipt).sort().join('|') !== permitted.sort().join('|')) return false;
  try {
    const recreated = createRequirementsContractDecisionReceipt(receipt);
    return sha256Stable(recreated) === sha256Stable(receipt);
  } catch {
    return false;
  }
}

export function publishRequirementsContractDecisionReceipt(input: {
  recordRoot: string;
  receipt: RequirementsContractDecisionReceipt;
}) {
  if (!validateRequirementsContractDecisionReceipt(input.receipt)) {
    throw new Error('requirements_decision_receipt_invalid');
  }
  const targetPath = path.resolve(
    input.recordRoot,
    'authoring',
    'decisions',
    'sessions',
    input.receipt.grillSessionId,
    'receipts',
    `${input.receipt.decisionReceiptId}.json`
  );
  const confinedRoot = path.resolve(input.recordRoot, 'authoring', 'decisions', 'sessions');
  const relative = path.relative(confinedRoot, targetPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('requirements_decision_receipt_path_escape');
  }
  assertRequirementsGrillSessionPathConfinement({
    recordRoot: input.recordRoot,
    targetPath,
    pathEscapeCode: 'requirements_decision_receipt_path_escape',
  });
  try {
    const publication = atomicNoClobberPublish({
      targetPath,
      value: input.receipt,
      role: 'requirements_decision_receipt',
      validateReadback(value) {
        if (!validateRequirementsContractDecisionReceipt(value)) {
          throw new Error('requirements_decision_receipt_readback_invalid');
        }
      },
    });
    return {
      status: publication.disposition === 'reused'
        ? 'grill_answers_reused' as const
        : 'grill_answers_published' as const,
      receiptPath: path.relative(input.recordRoot, targetPath).replace(/\\/gu, '/'),
      receiptHash: input.receipt.receiptHash,
      publication,
    };
  } catch (error) {
    if ((error as Error).message === 'atomic_no_clobber_conflict') {
      throw new Error('grill_answer_conflict');
    }
    throw error;
  }
}

function validateRequirementsGrillSessionSnapshot(
  value: unknown,
  authoringRequestId: string,
  grillSessionId: string
): RequirementsGrillSessionSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('requirements_grill_session_identity_mismatch');
  }
  const session = value as RequirementsGrillSessionSnapshot;
  if (
    session.schemaVersion !== 'requirements-grill-session-snapshot/v1' ||
    session.authoringRequestId !== authoringRequestId ||
    session.grillSessionId !== grillSessionId ||
    !nonEmpty(session.authoringAttemptId) ||
    !nonEmpty(session.confirmationLanguage) ||
    !nonEmpty(session.intakeSource) ||
    !nonEmpty(session.targetSource) ||
    !SHA256.test(session.authoritySourceListHash) ||
    !Array.isArray(session.questions) ||
    !Array.isArray(session.readyQuestionIds) ||
    !validateRequirementsGrillQuestionGraph(session.questionGraph)
  ) {
    throw new Error('requirements_grill_session_identity_mismatch');
  }
  const questionById = new Map(session.questions.map((question) => [question.questionId, question]));
  if (questionById.size !== session.questions.length) {
    throw new Error('requirements_grill_question_id_duplicate');
  }
  for (const question of session.questions) {
    if (
      !nonEmpty(question.question) ||
      !SHA256.test(question.answerSchemaHash) ||
      !isCanonicalJsonValue(question.answerSchema) ||
      !question.userInputProvenance ||
      Object.keys(question.userInputProvenance).join('|') !== 'authorityOrigin' ||
      !nonEmpty(question.userInputProvenance.authorityOrigin)
    ) {
      throw new Error('requirements_grill_question_invalid');
    }
  }
  const canonicalGraph = createRequirementsGrillQuestionGraph({
    authoringRequestId,
    grillSessionId,
    questions: session.questions.map((question) => ({
      questionId: question.questionId,
      questionVersion: question.questionVersion,
      dependencies: question.dependencies,
      affectedFieldIds: question.affectedFieldIds,
      authorityPremiseHashes: question.authorityPremiseHashes,
      affectedNodeIds: question.affectedNodeIds,
    })),
    resolvedQuestionIds: [],
  });
  if (
    sha256Stable(canonicalGraph) !== sha256Stable(session.questionGraph) ||
    JSON.stringify(session.readyQuestionIds) !== JSON.stringify(canonicalGraph.readyFrontier)
  ) {
    throw new Error('requirements_grill_session_graph_mismatch');
  }
  return session;
}

export function resolveRequirementsGrillSessionSnapshot(input: {
  recordRoot: string;
  authoringRequestId: string;
  grillSessionId: string;
  session: unknown;
}): RequirementsGrillSessionResolution {
  const session = validateRequirementsGrillSessionSnapshot(
    input.session,
    input.authoringRequestId,
    input.grillSessionId
  );
  const questionById = new Map(session.questions.map((question) => [question.questionId, question]));
  const receiptByQuestionId = new Map<string, RequirementsContractDecisionReceipt>();
  const decisionReceiptRefs: Array<{ path: string; hash: string }> = [];
  const receiptDir = path.resolve(
    input.recordRoot,
    'authoring',
    'decisions',
    'sessions',
    input.grillSessionId,
    'receipts'
  );
  assertRequirementsGrillSessionPathConfinement({
    recordRoot: input.recordRoot,
    targetPath: receiptDir,
  });
  if (existsSync(receiptDir)) {
    const entries = readdirSync(receiptDir, { withFileTypes: true })
      .sort((left, right) => Buffer.from(left.name, 'utf8').compare(Buffer.from(right.name, 'utf8')));
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        throw new Error('requirements_grill_receipt_path_invalid');
      }
      const receiptPath = path.join(receiptDir, entry.name);
      const receipt = JSON.parse(readFileSync(receiptPath, 'utf8')) as unknown;
      if (!validateRequirementsContractDecisionReceipt(receipt)) {
        throw new Error('requirements_decision_receipt_invalid');
      }
      if (
        receipt.authoringRequestId !== input.authoringRequestId ||
        receipt.grillSessionId !== input.grillSessionId
      ) {
        throw new Error('requirements_grill_receipt_identity_mismatch');
      }
      const question = questionById.get(receipt.questionId);
      if (!question) throw new Error('requirements_grill_receipt_question_unknown');
      if (shouldReopenRequirementsGrillQuestion({ question, receipt })) continue;
      if (receiptByQuestionId.has(receipt.questionId)) {
        throw new Error('requirements_grill_receipt_question_duplicate');
      }
      receiptByQuestionId.set(receipt.questionId, receipt);
      decisionReceiptRefs.push({
        path: path.relative(input.recordRoot, receiptPath).replace(/\\/gu, '/'),
        hash: receipt.receiptHash,
      });
    }
  }
  const questionGraph = createRequirementsGrillQuestionGraph({
    authoringRequestId: input.authoringRequestId,
    grillSessionId: input.grillSessionId,
    questions: session.questionGraph.questions,
    resolvedQuestionIds: [...receiptByQuestionId.keys()],
  });
  return {
    session,
    questionGraph,
    questionById,
    receiptByQuestionId,
    decisionReceiptRefs,
  };
}

export function computeRequirementsGrillReadyFrontier(input: {
  questions: Array<{ questionId: string; questionVersion: string; dependencies: string[] }>;
  resolvedQuestionIds: string[];
}): string[] {
  const byId = new Map(input.questions.map((question) => [question.questionId, question]));
  if (byId.size !== input.questions.length) throw new Error('requirements_grill_question_id_duplicate');
  const resolved = new Set(input.resolvedQuestionIds);
  for (const question of input.questions) {
    if (!nonEmpty(question.questionId) || !nonEmpty(question.questionVersion)) {
      throw new Error('requirements_grill_question_identity_invalid');
    }
    if (!Array.isArray(question.dependencies) || question.dependencies.some((id) => !byId.has(id))) {
      throw new Error('requirements_grill_dependency_unknown');
    }
  }
  return input.questions
    .filter((question) =>
      !resolved.has(question.questionId) &&
      question.dependencies.every((dependency) => resolved.has(dependency))
    )
    .map((question) => question.questionId)
    .sort((left, right) => Buffer.from(left, 'utf8').compare(Buffer.from(right, 'utf8')));
}

export function shouldReopenRequirementsGrillQuestion(input: {
  question: {
    questionId: string;
    questionVersion: string;
    affectedFieldIds: string[];
    authorityPremiseHashes: string[];
  };
  receipt: {
    questionId: string;
    questionVersion: string;
    affectedFieldIds: string[];
    authorityPremiseHashes: string[];
  };
}): boolean {
  const canonical = (value: string[]) => sortedUniqueNormalized(value, 'requirements_grill_identity_invalid');
  return (
    input.question.questionId !== input.receipt.questionId ||
    input.question.questionVersion !== input.receipt.questionVersion ||
    JSON.stringify(canonical(input.question.affectedFieldIds)) !==
      JSON.stringify(canonical(input.receipt.affectedFieldIds)) ||
    JSON.stringify(canonical(input.question.authorityPremiseHashes)) !==
      JSON.stringify(canonical(input.receipt.authorityPremiseHashes))
  );
}

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
