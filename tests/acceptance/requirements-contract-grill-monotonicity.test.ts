import { describe, expect, it } from 'vitest';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  computeRequirementsGrillReadyFrontier,
  createRequirementsContractDecisionReceipt,
  publishRequirementsContractDecisionReceipt,
  shouldReopenRequirementsGrillQuestion,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-grill-session';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import {
  createRequirementsGrillQuestionGraph,
  validateRequirementsGrillQuestionGraph,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-grill-model';

describe('requirements contract Grill monotonicity', () => {
  it('documents the batch frontier and canonical decision receipt owner', () => {
    const skill = readFileSync(path.resolve(
      '_bmad/skills/requirements-contract-grill/SKILL.md'
    ), 'utf8');
    expect(skill).toContain('requirements-grill-answers/v1');
    expect(skill).toContain('requirements-contract-decision-receipt/v1');
    expect(skill).toContain('0..N ready frontier');
    expect(skill).toContain('Decision receipt owner: `requirements-contract-grill-session.ts`');
    expect(skill).not.toContain('Expose exactly one active question');
    expect(skill).not.toContain('Decision receipt owner: `requirements-contract-interaction-resolver.ts`');
  });

  it('persists a complete acyclic question graph with a zero-to-many ready frontier', () => {
    const premise = sha256Stable('graph-premise');
    const graph = createRequirementsGrillQuestionGraph({
      authoringRequestId: 'request-graph',
      grillSessionId: 'session-graph',
      resolvedQuestionIds: [],
      questions: [
        { questionId: 'q-b', questionVersion: 'v1', dependencies: [], affectedFieldIds: ['FIELD-B'], authorityPremiseHashes: [premise], affectedNodeIds: ['NODE-B'] },
        { questionId: 'q-a', questionVersion: 'v1', dependencies: [], affectedFieldIds: ['FIELD-A'], authorityPremiseHashes: [premise], affectedNodeIds: ['NODE-A'] },
        { questionId: 'q-c', questionVersion: 'v1', dependencies: ['q-a', 'q-b'], affectedFieldIds: ['FIELD-C'], authorityPremiseHashes: [premise], affectedNodeIds: ['NODE-C'] },
      ],
    });

    expect(validateRequirementsGrillQuestionGraph(graph)).toBe(true);
    expect(graph.dependencyOrder).toEqual(['q-a', 'q-b', 'q-c']);
    expect(graph.readyFrontier).toEqual(['q-a', 'q-b']);
    expect(graph.graphHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(JSON.stringify(graph)).not.toMatch(/activeQuestion|createdAt|nonce/iu);
    expect(() => createRequirementsGrillQuestionGraph({
      authoringRequestId: 'request-cycle',
      grillSessionId: 'session-cycle',
      resolvedQuestionIds: [],
      questions: [
        { questionId: 'q-cycle', questionVersion: 'v1', dependencies: ['q-cycle'], affectedFieldIds: ['FIELD-CYCLE'], authorityPremiseHashes: [premise], affectedNodeIds: ['NODE-CYCLE'] },
      ],
    })).toThrow('requirements_grill_question_graph_cycle');
  });

  it('supports a zero-to-many ready frontier in stable dependency order', () => {
    const questions = [
      { questionId: 'q-b', questionVersion: 'v1', dependencies: [] },
      { questionId: 'q-a', questionVersion: 'v1', dependencies: [] },
      { questionId: 'q-c', questionVersion: 'v1', dependencies: ['q-a', 'q-b'] },
    ];
    expect(computeRequirementsGrillReadyFrontier({ questions, resolvedQuestionIds: [] }))
      .toEqual(['q-a', 'q-b']);
    expect(computeRequirementsGrillReadyFrontier({
      questions,
      resolvedQuestionIds: ['q-a', 'q-b'],
    })).toEqual(['q-c']);
    expect(computeRequirementsGrillReadyFrontier({
      questions: [],
      resolvedQuestionIds: [],
    })).toEqual([]);
  });

  it('keeps a receipt resolved until fields, question version, or authority premises change', () => {
    const premise = sha256Stable('premise');
    const question = {
      questionId: 'q-retry',
      questionVersion: 'v1',
      affectedFieldIds: ['FIELD-RETRY'],
      authorityPremiseHashes: [premise],
    };
    const receipt = {
      questionId: 'q-retry',
      questionVersion: 'v1',
      affectedFieldIds: ['FIELD-RETRY'],
      authorityPremiseHashes: [premise],
    };
    expect(shouldReopenRequirementsGrillQuestion({ question, receipt })).toBe(false);
    expect(shouldReopenRequirementsGrillQuestion({
      question: { ...question, questionVersion: 'v2' },
      receipt,
    })).toBe(true);
    expect(shouldReopenRequirementsGrillQuestion({
      question: { ...question, authorityPremiseHashes: [sha256Stable('changed')] },
      receipt,
    })).toBe(true);
  });

  it('rejects a linked grill session path without writing through to the external target', () => {
    const recordRoot = mkdtempSync(path.join(os.tmpdir(), 'requirements-grill-record-'));
    const external = mkdtempSync(path.join(os.tmpdir(), 'requirements-grill-external-'));
    try {
      const sessionsRoot = path.join(recordRoot, 'authoring', 'decisions', 'sessions');
      mkdirSync(sessionsRoot, { recursive: true });
      symlinkSync(external, path.join(sessionsRoot, 'SESSION-LINK'),
        process.platform === 'win32' ? 'junction' : 'dir');
      const receipt = createRequirementsContractDecisionReceipt({
        authoringRequestId: 'REQUEST-LINK',
        grillSessionId: 'SESSION-LINK',
        questionId: 'QUESTION-LINK',
        questionVersion: 'v1',
        affectedFieldIds: ['FIELD-LINK'],
        authorityPremiseHashes: [sha256Stable('premise-link')],
        answerValue: 'approved',
        answerSchemaHash: sha256Stable({ type: 'string' }),
        affectedNodeIds: ['NODE-LINK'],
        userInputProvenance: { authorityOrigin: 'requesting_user' },
      });

      expect(() => publishRequirementsContractDecisionReceipt({ recordRoot, receipt }))
        .toThrow('requirements_grill_session_path_reparse_forbidden');
      expect(readdirSync(external)).toEqual([]);
    } finally {
      rmSync(recordRoot, { recursive: true, force: true });
      rmSync(external, { recursive: true, force: true });
    }
  });
});
