import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

describe('requirements contract package CLI continuation', () => {
  it('ships a parseable CLI result schema that validates a resumable frontier', () => {
    const schema = JSON.parse(readFileSync(path.resolve(
      'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-cli-result.schema.json'
    ), 'utf8'));
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

    expect(validate({
      schemaVersion: 'requirements-contract-cli-result/v1',
      status: 'business_decision_required',
      issueCode: 'requirements_business_decision_required',
      authoringRequestId: 'REQ-SCHEMA',
      authoringAttemptId: 'ATTEMPT-SCHEMA',
      grillSessionId: 'GRILL-SCHEMA',
      resumable: true,
      nextAction: 'submit-requirements-grill-response',
      decisionReceiptRefs: [],
      frontier: ['question-1'],
      forbiddenArtifacts: [],
      resultHash: sha256Stable('result'),
    }), JSON.stringify(validate.errors)).toBe(true);
  });

  it('derives a durable Grill frontier from raw intake declared authority sources', () => {
    const root = path.join(os.tmpdir(), `requirements-cli-author-${process.pid}-${Date.now()}`);
    try {
      mkdirSync(path.join(root, 'docs'), { recursive: true });
      const intakePath = path.join(root, 'intake.md');
      const targetPath = path.join(root, 'requirements.md');
      writeFileSync(intakePath, [
        '---',
        'authoritySources:',
        '  - path: docs/unresolved.json',
        '    rootClass: unresolved_decision',
        '    proposedAuthorityClass: source_authority',
        '    bodySchemaVersion: requirements-contract-unresolved-decision-root/v1',
        '---',
        '# Requirements',
        '',
      ].join('\n'), 'utf8');
      writeFileSync(path.join(root, 'docs', 'unresolved.json'), JSON.stringify({
        schemaVersion: 'requirements-contract-authority-source/v1',
        sourceRootId: 'UNRESOLVED-001',
        semanticBody: {
          question: 'What retry limit is required?',
          affectedFieldIds: ['FIELD-RETRY-LIMIT'],
          affectedNodeIds: ['NODE-RETRY-LIMIT'],
          answerSchema: { type: 'integer', minimum: 1, maximum: 5 },
        },
      }), 'utf8');

      const run = spawnSync(process.execPath, [
        path.resolve('packages/bmad-speckit/bin/bmad-speckit.js'),
        'main-agent',
        'author-confirmation-ready-source',
        '--cwd',
        root,
        '--intake-source',
        intakePath,
        '--target-source',
        targetPath,
        '--confirmation-language',
        'en-US',
        '--json',
      ], { cwd: process.cwd(), encoding: 'utf8', windowsHide: true });

      expect(run.status, run.stderr || run.stdout).toBe(0);
      expect(run.stderr).toBe('');
      const envelope = JSON.parse(run.stdout) as Record<string, any>;
      expect(envelope).toMatchObject({
        action: 'author-confirmation-ready-source',
        status: 'business_decision_required',
        exitCode: 0,
        data: {
          schemaVersion: 'requirements-contract-cli-result/v1',
          status: 'business_decision_required',
          issueCode: 'requirements_business_decision_required',
          resumable: true,
          nextAction: 'submit-requirements-grill-response',
          frontier: ['UNRESOLVED-001'],
        },
      });
      const sessionPath = path.join(
        root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        envelope.data.authoringRequestId,
        'authoring',
        'decisions',
        'sessions',
        envelope.data.grillSessionId,
        'session.json'
      );
      expect(existsSync(sessionPath)).toBe(true);
      expect(existsSync(targetPath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('advances canonical dependent frontiers through real author, submit, and resume actions', () => {
    const root = path.join(os.tmpdir(), `requirements-cli-continuation-${process.pid}-${Date.now()}`);
    try {
      mkdirSync(path.join(root, 'docs'), { recursive: true });
      const intakePath = path.join(root, 'intake.md');
      const targetPath = path.join(root, 'requirements.md');
      writeFileSync(intakePath, [
        '---',
        'authoritySources:',
        '  - path: docs/retry-limit.json',
        '    rootClass: unresolved_decision',
        '    proposedAuthorityClass: source_authority',
        '    bodySchemaVersion: requirements-contract-unresolved-decision-root/v1',
        '  - path: docs/retry-mode.json',
        '    rootClass: unresolved_decision',
        '    proposedAuthorityClass: source_authority',
        '    bodySchemaVersion: requirements-contract-unresolved-decision-root/v1',
        '  - path: docs/functional.json',
        '    rootClass: functional_requirement',
        '    proposedAuthorityClass: source_authority',
        '    bodySchemaVersion: requirement-contract-requirement/v2',
        '---',
        '# Requirements',
        '',
      ].join('\n'), 'utf8');
      writeFileSync(path.join(root, 'docs', 'retry-limit.json'), JSON.stringify({
        schemaVersion: 'requirements-contract-authority-source/v1',
        sourceRootId: 'QUESTION-RETRY-LIMIT',
        semanticBody: {
          question: 'What retry limit is required?',
          dependencies: [],
          affectedFieldIds: ['FIELD-RETRY-LIMIT'],
          affectedNodeIds: ['NODE-RETRY-LIMIT'],
          answerSchema: { type: 'integer', minimum: 1, maximum: 5 },
        },
      }), 'utf8');
      writeFileSync(path.join(root, 'docs', 'retry-mode.json'), JSON.stringify({
        schemaVersion: 'requirements-contract-authority-source/v1',
        sourceRootId: 'QUESTION-RETRY-MODE',
        semanticBody: {
          question: 'Should retries use exponential backoff?',
          dependencies: ['QUESTION-RETRY-LIMIT'],
          affectedFieldIds: ['FIELD-RETRY-MODE'],
          affectedNodeIds: ['NODE-RETRY-MODE'],
          answerSchema: { type: 'boolean' },
        },
      }), 'utf8');
      writeFileSync(path.join(root, 'docs', 'functional.json'), JSON.stringify({
        schemaVersion: 'requirements-contract-authority-source/v1',
        sourceRootId: 'MUST-FR-CONTINUATION-001',
        semanticBody: {
          text: 'System MUST persist the selected retry policy.',
          oracle: 'The targeted test proves the selected retry policy is durable.',
          executionConstraints: [
            { kind: 'CMD', id: 'retry-policy-test', value: 'npm test -- retry-policy.test.ts' },
            { kind: 'PATH', id: 'retry-policy-owner', value: 'src/retry-policy.ts' },
          ],
          executionConstraintRefs: ['CMD:retry-policy-test', 'PATH:retry-policy-owner'],
        },
      }), 'utf8');

      const spawnMainAgent = (action: string, args: string[]) => spawnSync(
        process.execPath,
        [
          path.resolve('packages/bmad-speckit/bin/bmad-speckit.js'),
          'main-agent',
          action,
          '--cwd',
          root,
          ...args,
          '--json',
        ],
        { cwd: process.cwd(), encoding: 'utf8', windowsHide: true }
      );
      const author = spawnMainAgent('author-confirmation-ready-source', [
        '--intake-source',
        intakePath,
        '--target-source',
        targetPath,
        '--confirmation-language',
        'en-US',
      ]);
      expect(author.status, author.stderr || author.stdout).toBe(0);
      const authorEnvelope = JSON.parse(author.stdout) as Record<string, any>;
      expect(authorEnvelope.data.frontier).toEqual(['QUESTION-RETRY-LIMIT']);
      const requestId = authorEnvelope.data.authoringRequestId as string;
      const grillSessionId = authorEnvelope.data.grillSessionId as string;
      const recordRoot = path.join(
        root,
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
      const session = JSON.parse(readFileSync(sessionPath, 'utf8')) as Record<string, any>;
      expect(session.questionGraph).toMatchObject({
        schemaVersion: 'requirements-grill-question-graph/v1',
        readyFrontier: ['QUESTION-RETRY-LIMIT'],
      });

      const submit = (fileName: string, questionId: string, answerValue: unknown) => {
        const answersPath = path.join(root, fileName);
        writeFileSync(answersPath, JSON.stringify({
          schemaVersion: 'requirements-grill-answers/v1',
          answers: [{ questionId, questionVersion: 'v1', answerValue }],
        }), 'utf8');
        return spawnMainAgent('submit-requirements-grill-response', [
          '--request-id',
          requestId,
          '--grill-session-id',
          grillSessionId,
          '--answers',
          answersPath,
        ]);
      };
      const resume = () => spawnMainAgent('resume-author-confirmation-ready-source', [
        '--request-id',
        requestId,
        '--grill-session-id',
        grillSessionId,
      ]);

      const firstSubmit = submit('answers-1.json', 'QUESTION-RETRY-LIMIT', 3);
      expect(firstSubmit.status, firstSubmit.stderr || firstSubmit.stdout).toBe(0);
      const firstEnvelope = JSON.parse(firstSubmit.stdout) as Record<string, any>;
      expect(firstEnvelope.data).toMatchObject({
        status: 'business_decision_required',
        frontier: ['QUESTION-RETRY-MODE'],
      });
      const firstReceiptRef = firstEnvelope.data.decisionReceiptRefs[0] as {
        path: string;
        hash: string;
      };
      const firstReceiptPath = path.join(recordRoot, firstReceiptRef.path);
      const firstReceiptBytes = readFileSync(firstReceiptPath);

      const firstResume = resume();
      expect(firstResume.status, firstResume.stderr || firstResume.stdout).toBe(0);
      const firstResumeEnvelope = JSON.parse(firstResume.stdout) as Record<string, any>;
      expect(firstResumeEnvelope.data.frontier).toEqual(['QUESTION-RETRY-MODE']);
      expect(firstResumeEnvelope.data.decisionReceiptRefs).toContainEqual(firstReceiptRef);

      const secondSubmit = submit('answers-2.json', 'QUESTION-RETRY-MODE', true);
      expect(secondSubmit.status, secondSubmit.stderr || secondSubmit.stdout).toBe(0);
      const secondEnvelope = JSON.parse(secondSubmit.stdout) as Record<string, any>;
      expect(secondEnvelope.data).toMatchObject({
        status: 'audit_pending',
        issueCode: 'requirements_audit_pending',
        frontier: [],
      });
      expect(secondEnvelope.data.decisionReceiptRefs).toHaveLength(2);
      const attemptDir = path.join(
        recordRoot,
        'authoring',
        'staging',
        session.authoringAttemptId
      );
      expect(JSON.parse(readFileSync(path.join(attemptDir, 'cp02-candidate.json'), 'utf8')))
        .toMatchObject({ status: 'closed', issueCodes: [] });
      expect(existsSync(path.join(attemptDir, 'manifests', '4-cp04.json'))).toBe(true);
      expect(existsSync(path.join(recordRoot, 'record', 'active-authoring-request.json'))).toBe(true);

      const finalResume = resume();
      expect(finalResume.status, finalResume.stderr || finalResume.stdout).toBe(0);
      const finalResumeEnvelope = JSON.parse(finalResume.stdout) as Record<string, any>;
      expect(finalResumeEnvelope.data).toMatchObject({
        status: 'audit_pending',
        frontier: [],
      });
      expect(finalResumeEnvelope.data.decisionReceiptRefs).toEqual(
        secondEnvelope.data.decisionReceiptRefs
      );
      expect(readFileSync(firstReceiptPath)).toEqual(firstReceiptBytes);
      expect(existsSync(targetPath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
