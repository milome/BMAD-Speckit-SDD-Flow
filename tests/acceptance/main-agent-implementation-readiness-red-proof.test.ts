import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { implementationReadinessGateAction } from '../../packages/bmad-speckit/src/main-agent/actions/implementation-readiness-gate';
import {
  produceImplementationReadiness,
  runReadinessCommand,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-implementation-readiness-gate';
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

  it.runIf(process.platform === 'win32').each(['npm', 'npx'])(
    'runs the real %s JavaScript CLI on Windows',
    (executable) => {
      const result = runReadinessCommand(
        {
          normalizedCommandHash: `sha256:${'0'.repeat(64)}`,
          commandIds: [`CMD-${executable}-version`],
          executable,
          args: ['--version'],
          normalizedInvocation: `${executable}\u0000--version`,
          expectedTestIds: [],
          expectedFailureSignatures: [],
        },
        process.cwd()
      );

      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      expect(result.errorCode).toBeUndefined();
      expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/u);
    }
  );

  it('does not inherit ambient Node loader hooks into the RED command', () => {
    const fixture = materializeImplementationReadinessFixture();
    const markerPath = path.join(fixture.root, 'ambient-node-options-loaded.txt');
    const preloadPath = path.join(fixture.root, 'ambient-preload.cjs');
    const previousNodeOptions = process.env.NODE_OPTIONS;
    writeFileSync(
      preloadPath,
      `require('node:fs').writeFileSync(${JSON.stringify(markerPath)}, 'loaded', 'utf8');\n`,
      'utf8'
    );
    process.env.NODE_OPTIONS = `--require=${preloadPath}`;
    try {
      const action = implementationReadinessGateAction(readinessActionContext(fixture)) as Record<
        string,
        any
      >;

      expect(action, JSON.stringify(action, null, 2)).toMatchObject({
        status: 'implementation_readiness_pass',
        exitCode: 0,
      });
      expect(existsSync(markerPath)).toBe(false);
    } finally {
      if (previousNodeOptions === undefined) delete process.env.NODE_OPTIONS;
      else process.env.NODE_OPTIONS = previousNodeOptions;
      fixture.cleanup();
    }
  });

  it('does not inherit user configuration or toolchain environment into the runner', () => {
    const sentinel = 'READINESS_AMBIENT_SENTINEL';
    const keys = [
      'HOME',
      'USERPROFILE',
      'APPDATA',
      'LOCALAPPDATA',
      'NPM_CONFIG_USERCONFIG',
      'npm_config_registry',
      'INIT_CWD',
      'TS_NODE_PROJECT',
    ] as const;
    const previous = new Map(keys.map((key) => [key, process.env[key]]));
    for (const key of keys) process.env[key] = sentinel;
    try {
      const result = runReadinessCommand(
        {
          normalizedCommandHash: `sha256:${'1'.repeat(64)}`,
          commandIds: ['CMD-controlled-environment'],
          executable: 'node',
          args: [
            '-e',
            `process.stdout.write(JSON.stringify(${JSON.stringify(keys)}.map((key) => process.env[key] ?? null)))`,
          ],
          normalizedInvocation: 'node\u0000-e\u0000controlled-environment-probe',
          expectedTestIds: [],
          expectedFailureSignatures: [],
        },
        process.cwd()
      );

      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      expect(result.stdout).not.toContain(sentinel);
    } finally {
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it('uses an isolated runtime home, temp directory, and controlled executable path', () => {
    const ambientTempRoot = mkdtempSync(path.join(os.tmpdir(), 'readiness-ambient-'));
    const sharedRuntimeHome = path.join(ambientTempRoot, 'bmad-speckit-readiness-runtime');
    const poisonName = 'ambient-runtime-poison.txt';
    mkdirSync(sharedRuntimeHome, { recursive: true });
    writeFileSync(path.join(sharedRuntimeHome, poisonName), 'poisoned\n', 'utf8');
    const keys = ['PATH', 'TEMP', 'TMP', 'TMPDIR'] as const;
    const previous = new Map(keys.map((key) => [key, process.env[key]]));
    process.env.PATH = path.join(ambientTempRoot, 'ambient-bin');
    process.env.TEMP = ambientTempRoot;
    process.env.TMP = ambientTempRoot;
    process.env.TMPDIR = ambientTempRoot;
    try {
      const result = runReadinessCommand(
        {
          normalizedCommandHash: `sha256:${'2'.repeat(64)}`,
          commandIds: ['CMD-isolated-runtime'],
          executable: 'node',
          args: [
            '-e',
            [
              "const fs = require('node:fs');",
              "const path = require('node:path');",
              `const poisonName = ${JSON.stringify(poisonName)};`,
              'process.stdout.write(JSON.stringify({',
              '  home: process.env.HOME,',
              '  path: process.env.PATH,',
              '  temp: process.env.TEMP,',
              '  tmp: process.env.TMP,',
              '  tmpdir: process.env.TMPDIR,',
              '  poisonSeen: fs.existsSync(path.join(process.env.HOME, poisonName)),',
              '}));',
            ].join('\n'),
          ],
          normalizedInvocation: 'node\u0000-e\u0000isolated-runtime-probe',
          expectedTestIds: [],
          expectedFailureSignatures: [],
        },
        process.cwd()
      );

      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      const observed = JSON.parse(result.stdout) as Record<string, string | boolean>;
      expect(observed.poisonSeen).toBe(false);
      expect(observed.path).toBe(
        [path.join(process.cwd(), 'node_modules', '.bin'), path.dirname(process.execPath)].join(
          path.delimiter
        )
      );
      expect(observed.temp).toBe(observed.tmp);
      expect(observed.temp).toBe(observed.tmpdir);
      expect(String(observed.temp)).not.toContain(ambientTempRoot);
      expect(String(observed.home)).not.toBe(sharedRuntimeHome);
      expect(existsSync(String(observed.home))).toBe(false);
    } finally {
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      rmSync(ambientTempRoot, { recursive: true, force: true });
    }
  });

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

  it('invalidates an existing pass before changed scoped inputs fail RED reevaluation', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      expect(implementationReadinessGateAction(readinessActionContext(fixture))).toMatchObject({
        status: 'implementation_readiness_pass',
        exitCode: 0,
      });
      const passRecord = JSON.parse(readFileSync(fixture.runtimeRecordPath, 'utf8'));
      const passReceiptRegistry = passRecord.runtimeStatusDecisionReceipts;
      writeFileSync(
        fixture.targetPath,
        "module.exports = { refundStatus: () => 'accepted' };\n",
        'utf8'
      );

      expect(implementationReadinessGateAction(readinessActionContext(fixture))).toMatchObject({
        status: 'implementation_readiness_blocked',
        exitCode: 1,
        result: {
          issueCodes: [`red_proof_not_observed:${fixture.commandIds[0]}`],
          writeCount: 1,
        },
      });
      const runtimeRecord = JSON.parse(readFileSync(fixture.runtimeRecordPath, 'utf8'));
      expect(runtimeRecord.sixModelResults.implementation_readiness).toMatchObject({
        status: 'stale',
        blockingReasons: ['readiness_recheck_required:scoped_input_digest'],
      });
      expect(runtimeRecord.sixModelResults.implementation_readiness.decisionReceiptRef).toBe(
        undefined
      );
      expect(runtimeRecord.runtimeStatusDecisionReceipts).toEqual(passReceiptRegistry);
      expect(
        resolveVerifiedSixModelStatus({
          record: runtimeRecord,
          modelId: 'implementation_readiness',
          currentImplementationAttemptId: runtimeRecord.currentAttemptId,
        }).effectiveStatus
      ).not.toBe('pass');
    } finally {
      fixture.cleanup();
    }
  });

  it('preserves the stale write after an after-commit hook throws', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      expect(implementationReadinessGateAction(readinessActionContext(fixture))).toMatchObject({
        status: 'implementation_readiness_pass',
        exitCode: 0,
      });
      writeFileSync(
        fixture.targetPath,
        "module.exports = { refundStatus: () => 'accepted' };\n",
        'utf8'
      );
      let failure: unknown;
      try {
        produceImplementationReadiness(
          { projectRoot: fixture.root, requestId: fixture.requestId },
          {
            controlStoreCommitDeps: {
              beforeBoundary: (boundary) => {
                if (boundary === 'after_commit_boundary') {
                  throw new Error('simulated_stale_post_commit_failure');
                }
              },
            },
          }
        );
      } catch (error) {
        failure = error;
      }

      const runtimeProjection = JSON.parse(readFileSync(fixture.runtimeRecordPath, 'utf8'))
        .sixModelResults.implementation_readiness;
      expect(failure, JSON.stringify(runtimeProjection, null, 2)).toMatchObject({
        issueCode: `red_proof_not_observed:${fixture.commandIds[0]}`,
        commandExecutionCount: 1,
        writeCount: 1,
      });
      expect(runtimeProjection).toMatchObject({
        status: 'stale',
        currentHashes: {
          readinessScopedInputDigest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
        },
      });
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
