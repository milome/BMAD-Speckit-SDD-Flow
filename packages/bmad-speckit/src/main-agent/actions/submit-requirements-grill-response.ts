const fs = require('node:fs');
const path = require('node:path');
const Ajv2020 = require('ajv/dist/2020.js').default;
const {
  assertRequirementsGrillSessionPathConfinement,
  createRequirementsContractDecisionReceipt,
  publishRequirementsContractDecisionReceipt,
  resolveRequirementsGrillSessionSnapshot,
} = require('../source-authority/scripts/requirements-contract-grill-session');
const {
  atomicNoClobberPublish,
} = require('../source-authority/scripts/requirements-contract-atomic-no-clobber-publisher');
const {
  sha256Stable,
} = require('../source-authority/scripts/requirements-contract-semantic-resolver');
const {
  validateRequirementsContractSchema,
} = require('../source-authority/scripts/requirements-contract-semantic-ir-schema');
const {
  continueAuthoringFromContext,
} = require('./source-authority-orchestration');

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;

function errorResult(code, message, exitCode = 2) {
  return {
    schemaVersion: 'requirements-contract-cli-result/v1',
    status: 'authoring_blocked',
    issueCode: code,
    authoringRequestId: null,
    authoringAttemptId: null,
    grillSessionId: null,
    resumable: false,
    nextAction: null,
    decisionReceiptRefs: [],
    frontier: [],
    forbiddenArtifacts: ['active_authority', 'confirmation', 'projection'],
    exitCode,
    errors: [{ code, message }],
  };
}

function confinedFile(cwd, candidate, issueCode) {
  const absolute = path.resolve(cwd, String(candidate || ''));
  const relative = path.relative(cwd, absolute);
  if (!candidate || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(issueCode);
  }
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(issueCode);
  return absolute;
}

function exactStringSet(values) {
  return [...new Set(values.map(String))].sort((left, right) => left.localeCompare(right));
}

function resultHash(payload) {
  return sha256Stable({ domain: 'requirements-contract-cli-result/v1', payload });
}

async function submitRequirementsGrillResponseAction(context) {
  const requestId = String(context.args.requestId || '').trim();
  const grillSessionId = String(context.args.grillSessionId || '').trim();
  if (!SAFE_ID.test(requestId) || !SAFE_ID.test(grillSessionId)) {
    return errorResult(
      'requirements_grill_resume_identity_invalid',
      'requestId and grillSessionId must be explicit safe identities.'
    );
  }
  try {
    const answersPath = confinedFile(
      context.cwd,
      context.args.answers,
      'requirements_grill_answers_path_invalid'
    );
    const answers = JSON.parse(fs.readFileSync(answersPath, 'utf8'));
    const answersValidation = validateRequirementsContractSchema(
      'requirements-contract-grill-answers.schema.json',
      answers
    );
    if (answersValidation.decision !== 'pass') {
      throw new Error('requirements_grill_answers_schema_invalid');
    }
    const recordRoot = path.resolve(
      context.cwd,
      '_bmad-output',
      'runtime',
      'requirement-records',
      requestId
    );
    const sessionPath = path.join(
      recordRoot,
      'authoring',
      'decisions',
      'sessions',
      grillSessionId,
      'session.json'
    );
    assertRequirementsGrillSessionPathConfinement({ recordRoot, targetPath: sessionPath });
    const resolution = resolveRequirementsGrillSessionSnapshot({
      recordRoot,
      authoringRequestId: requestId,
      grillSessionId,
      session: JSON.parse(fs.readFileSync(sessionPath, 'utf8')),
    });
    const answerIds = exactStringSet(answers.answers.map((answer) => answer.questionId));
    const frontier = resolution.questionGraph.readyFrontier;
    if (JSON.stringify(answerIds) !== JSON.stringify(frontier)) {
      throw new Error('requirements_grill_frontier_mismatch');
    }
    const answerById = new Map(answers.answers.map((answer) => [answer.questionId, answer]));
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const decisionReceiptRefs = [];
    for (const questionId of frontier) {
      const question = resolution.questionById.get(questionId);
      const answer = answerById.get(questionId);
      if (
        !question ||
        !answer ||
        answer.questionVersion !== question.questionVersion ||
        !question.answerSchema ||
        !ajv.compile(question.answerSchema)(answer.answerValue)
      ) {
        throw new Error('requirements_grill_answer_invalid');
      }
      const receipt = createRequirementsContractDecisionReceipt({
        authoringRequestId: requestId,
        grillSessionId,
        questionId,
        questionVersion: question.questionVersion,
        affectedFieldIds: question.affectedFieldIds,
        authorityPremiseHashes: question.authorityPremiseHashes,
        answerValue: answer.answerValue,
        answerSchemaHash: question.answerSchemaHash,
        affectedNodeIds: question.affectedNodeIds,
        userInputProvenance: question.userInputProvenance,
      });
      const publication = publishRequirementsContractDecisionReceipt({ recordRoot, receipt });
      decisionReceiptRefs.push({
        path: publication.receiptPath,
        hash: publication.receiptHash,
      });
    }
    const continuation = resolveRequirementsGrillSessionSnapshot({
      recordRoot,
      authoringRequestId: requestId,
      grillSessionId,
      session: JSON.parse(fs.readFileSync(sessionPath, 'utf8')),
    });
    let result;
    if (continuation.questionGraph.readyFrontier.length > 0) {
      const payload = {
        schemaVersion: 'requirements-contract-cli-result/v1',
        status: 'business_decision_required',
        issueCode: 'requirements_business_decision_required',
        authoringRequestId: requestId,
        authoringAttemptId: continuation.session.authoringAttemptId,
        grillSessionId,
        resumable: true,
        nextAction: 'submit-requirements-grill-response',
        decisionReceiptRefs: continuation.decisionReceiptRefs,
        frontier: continuation.questionGraph.readyFrontier,
        forbiddenArtifacts: ['active_authority', 'confirmation', 'projection'],
      };
      result = { ...payload, resultHash: resultHash(payload), exitCode: 0, errors: [] };
    } else {
      result = await continueAuthoringFromContext(context, continuation.session, {
        grillSessionId,
        decisionReceiptRefs: continuation.decisionReceiptRefs,
      });
    }
    const {
      resultHash: _resultHash,
      exitCode: _exitCode,
      errors: _errors,
      ...payload
    } = result;
    const continuationPath = path.join(
      path.dirname(sessionPath),
      'continuations',
      `${result.resultHash.slice('sha256:'.length)}.json`
    );
    atomicNoClobberPublish({
      targetPath: continuationPath,
      value: payload,
      role: 'requirements_grill_continuation',
    });
    return result;
  } catch (error) {
    const code = error instanceof Error && error.message
      ? error.message
      : 'requirements_grill_submission_failed';
    return {
      ...errorResult(code, code),
      authoringRequestId: requestId,
      grillSessionId,
    };
  }
}

module.exports = {
  submitRequirementsGrillResponseAction,
};
