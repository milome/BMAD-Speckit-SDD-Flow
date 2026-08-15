import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { implementationReadinessGateAction } from '../../packages/bmad-speckit/src/main-agent/actions/implementation-readiness-gate';
import { resolveVerifiedSixModelStatus } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/verified-six-model-status-facade';
import {
  materializeImplementationReadinessFixture,
  readinessActionContext,
} from '../helpers/implementation-readiness-fixture';

describe('Main Agent implementation readiness real RED proof', () => {
  it('runs the declared command once and proves the exact test ID and oracle are RED', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      const action = implementationReadinessGateAction(readinessActionContext(fixture)) as Record<
        string,
        any
      >;

      expect(action, JSON.stringify(action, null, 2)).toMatchObject({
        status: 'implementation_readiness_pass',
        exitCode: 0,
        result: {
          schemaVersion: 'implementation-readiness-result/v2',
          status: 'implementation_readiness_pass',
          requestId: fixture.requestId,
          issueCodes: [],
          commandExecutionCount: 1,
        },
      });
      const candidatePath = path.join(fixture.root, ...action.result.candidateRef.path.split('/'));
      const candidate = JSON.parse(readFileSync(candidatePath, 'utf8'));
      expect(candidate).toMatchObject({
        schemaVersion: 'ImplementationReadinessCandidate/v1',
        readinessScopedInputDigest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
        implementationReadinessCandidateHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
        normalizedCommands: [
          expect.objectContaining({
            commandIds: fixture.commandIds,
            expectedTestIds: fixture.commandIds,
            expectedFailureSignatures: [fixture.oracle],
          }),
        ],
        redOutcomes: [
          expect.objectContaining({
            status: 'expected_red_observed',
            exitCode: 1,
            failedTestIds: fixture.commandIds,
            unrelatedFailureIds: [],
          }),
        ],
      });
      expect(candidate.inputArtifacts.map((entry: Record<string, string>) => entry.role)).toEqual([
        'config',
        'lock',
        'pre_implementation_target',
        'test',
      ]);

      const requirementsConfirmation = JSON.parse(
        readFileSync(fixture.requirementsConfirmationPath, 'utf8')
      );
      const architectureEvent = JSON.parse(readFileSync(fixture.architectureEventPath, 'utf8'));
      const architectureReceipt = JSON.parse(
        readFileSync(fixture.architectureDecisionReceiptPath, 'utf8')
      );
      const readinessReceipt = JSON.parse(
        readFileSync(
          path.join(fixture.root, ...action.result.decisionReceiptRef.path.split('/')),
          'utf8'
        )
      );
      expect(requirementsConfirmation).toMatchObject({
        requestId: fixture.requestId,
        semanticRevisionId: fixture.semanticRevisionId,
        scopeSemanticHash: fixture.scopeSemanticHash,
      });
      expect(architectureEvent).toMatchObject({
        requestId: fixture.requestId,
        semanticRevisionId: fixture.semanticRevisionId,
        scopeSemanticHash: fixture.scopeSemanticHash,
        architectureConfirmationCandidateHash: fixture.architectureCandidateHash,
        decision: 'pass',
      });
      expect(architectureReceipt).toMatchObject({
        recordId: fixture.requestId,
        modelId: 'architecture_confirmation',
        semanticModelHash: fixture.scopeSemanticHash,
        decision: 'pass',
        effectiveStatus: 'pass',
      });
      expect(readinessReceipt).toMatchObject({
        recordId: fixture.requestId,
        modelId: 'implementation_readiness',
        semanticModelHash: fixture.scopeSemanticHash,
        decision: 'pass',
        effectiveStatus: 'pass',
      });
      expect(
        readinessReceipt.stageInputs,
        JSON.stringify(readinessReceipt.stageInputs, null, 2)
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'requirements_semantic_ir',
            hash: fixture.scopeSemanticHash,
          }),
          expect.objectContaining({
            role: 'architecture_confirmation_candidate',
            hash: fixture.architectureCandidateHash,
          }),
        ])
      );
      const record = JSON.parse(readFileSync(fixture.runtimeRecordPath, 'utf8'));
      expect(
        record.runtimeStatusDecisionReceipts.map(
          (entry: { receipt: { modelId: string } }) => entry.receipt.modelId
        )
      ).toEqual([
        'requirement_confirmation',
        'architecture_confirmation',
        'implementation_readiness',
      ]);
      expect(
        record.artifactIndex
          .filter(
            (entry: { artifactType: string }) =>
              entry.artifactType === 'runtime_status_decision_receipt'
          )
          .map((entry: { path: string }) => entry.path)
      ).toEqual(record.runtimeStatusDecisionReceipts.map((entry: { path: string }) => entry.path));
      for (const modelId of [
        'requirement_confirmation',
        'architecture_confirmation',
        'implementation_readiness',
      ] as const) {
        expect(
          resolveVerifiedSixModelStatus({
            record,
            modelId,
            currentImplementationAttemptId: record.currentAttemptId,
          }),
          modelId
        ).toMatchObject({
          modelId,
          effectiveStatus: 'pass',
          projectionIntegrity: 'valid',
        });
      }
      for (const relative of [
        'goal',
        'partition',
        'execution',
        'record/goal',
        'record/partition',
        'record/execution',
      ]) {
        expect(existsSync(path.join(fixture.recordRoot, ...relative.split('/')))).toBe(false);
      }
    } finally {
      fixture.cleanup();
    }
  });

  it.runIf(process.platform === 'win32')(
    'runs the declared npm command on Windows without a shell',
    () => {
      const fixture = materializeImplementationReadinessFixture({
        invocation: 'npm test -- tests/refund-worker.test.cjs',
        additionalFiles: {
          'package.json': `${JSON.stringify(
            {
              name: 'readiness-fixture',
              private: true,
              version: '1.0.0',
              scripts: { test: 'node --test' },
            },
            null,
            2
          )}\n`,
        },
      });
      try {
        const action = implementationReadinessGateAction(readinessActionContext(fixture)) as Record<
          string,
          any
        >;

        expect(action, JSON.stringify(action, null, 2)).toMatchObject({
          status: 'implementation_readiness_pass',
          exitCode: 0,
          result: {
            status: 'implementation_readiness_pass',
            commandExecutionCount: 1,
          },
        });
      } finally {
        fixture.cleanup();
      }
    }
  );

  it('returns a domain block without publishing when the declared RED test is already GREEN', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      writeFileSync(
        fixture.targetPath,
        "module.exports = { refundStatus: () => 'accepted' };\n",
        'utf8'
      );
      const action = implementationReadinessGateAction(readinessActionContext(fixture)) as Record<
        string,
        any
      >;

      expect(action).toMatchObject({
        status: 'implementation_readiness_blocked',
        exitCode: 1,
        result: {
          status: 'implementation_readiness_blocked',
          issueCodes: [`red_proof_not_observed:${fixture.commandIds[0]}`],
          commandExecutionCount: 1,
          writeCount: 0,
        },
      });
      expect(existsSync(path.join(fixture.recordRoot, 'record', 'readiness', 'evaluations'))).toBe(
        false
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('returns a producer failure without publishing when an unrelated test also fails', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      writeFileSync(
        fixture.testPath,
        `${readFileSync(fixture.testPath, 'utf8')}\ntest('UNRELATED-FAILURE', () => { assert.equal(1, 2); });\n`,
        'utf8'
      );
      const action = implementationReadinessGateAction(readinessActionContext(fixture)) as Record<
        string,
        any
      >;

      expect(action).toMatchObject({
        status: 'implementation_readiness_blocked',
        exitCode: 2,
        result: {
          status: 'implementation_readiness_blocked',
          issueCodes: [`implementation_readiness_red_identity_invalid:${fixture.commandIds[0]}`],
          commandExecutionCount: 1,
          writeCount: 0,
        },
      });
      expect(existsSync(path.join(fixture.recordRoot, 'record', 'readiness', 'evaluations'))).toBe(
        false
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('does not accept a longer test ID that only contains the expected ID as a prefix', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      const testSource = readFileSync(fixture.testPath, 'utf8');
      writeFileSync(
        fixture.testPath,
        testSource.replace(fixture.commandIds[0], `${fixture.commandIds[0]}-extra`),
        'utf8'
      );
      const action = implementationReadinessGateAction(readinessActionContext(fixture)) as Record<
        string,
        any
      >;

      expect(action).toMatchObject({
        status: 'implementation_readiness_blocked',
        exitCode: 2,
        result: {
          issueCodes: [`implementation_readiness_red_identity_invalid:${fixture.commandIds[0]}`],
          commandExecutionCount: 1,
          writeCount: 0,
        },
      });
      expect(existsSync(path.join(fixture.recordRoot, 'record', 'readiness', 'evaluations'))).toBe(
        false
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('does not accept an oracle printed outside the matching failure diagnostics', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      writeFileSync(
        fixture.testPath,
        [
          "const test = require('node:test');",
          `console.log('${fixture.oracle}');`,
          `test('${fixture.commandIds[0]}', () => { throw new Error('fixture broke'); });`,
          '',
        ].join('\n'),
        'utf8'
      );
      const action = implementationReadinessGateAction(readinessActionContext(fixture)) as Record<
        string,
        any
      >;

      expect(action).toMatchObject({
        status: 'implementation_readiness_blocked',
        exitCode: 2,
        result: {
          issueCodes: [`implementation_readiness_red_identity_invalid:${fixture.commandIds[0]}`],
          commandExecutionCount: 1,
          writeCount: 0,
        },
      });
      expect(existsSync(path.join(fixture.recordRoot, 'record', 'readiness', 'evaluations'))).toBe(
        false
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('returns a producer failure without publishing for a runner environment failure', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      writeFileSync(
        fixture.testPath,
        "require('implementation-readiness-missing-module');\n",
        'utf8'
      );
      const action = implementationReadinessGateAction(readinessActionContext(fixture)) as Record<
        string,
        any
      >;

      expect(action).toMatchObject({
        status: 'implementation_readiness_blocked',
        exitCode: 2,
        result: {
          status: 'implementation_readiness_blocked',
          issueCodes: [`implementation_readiness_environment_failure:${fixture.commandIds[0]}`],
          commandExecutionCount: 1,
          writeCount: 0,
        },
      });
      expect(existsSync(path.join(fixture.recordRoot, 'record', 'readiness', 'evaluations'))).toBe(
        false
      );
    } finally {
      fixture.cleanup();
    }
  });
});
