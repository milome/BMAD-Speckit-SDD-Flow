import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { implementationReadinessGateAction } from '../../packages/bmad-speckit/src/main-agent/actions/implementation-readiness-gate';
import { produceImplementationReadiness } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-implementation-readiness-gate';
import {
  materializeImplementationReadinessFixture,
  readinessActionContext,
} from '../helpers/implementation-readiness-fixture';

function run(fixture: ReturnType<typeof materializeImplementationReadinessFixture>) {
  return implementationReadinessGateAction(readinessActionContext(fixture)) as Record<string, any>;
}

function expectedRedOutput(fixture: ReturnType<typeof materializeImplementationReadinessFixture>) {
  return {
    status: 1,
    signal: null,
    stdout: [
      'TAP version 13',
      `not ok 1 - ${fixture.commandIds[0]} ${fixture.oracle}`,
      '  ---',
      `  error: '${fixture.oracle}'`,
      '  ...',
      '1..1',
      '',
    ].join('\n'),
    stderr: '',
  };
}

describe('Main Agent implementation readiness candidate identity', () => {
  it('validates closed candidate/result schemas and excludes physical/time provenance from identity', () => {
    const left = materializeImplementationReadinessFixture();
    const right = materializeImplementationReadinessFixture();
    try {
      const leftResult = run(left).result;
      const rightResult = run(right).result;
      const candidate = JSON.parse(
        readFileSync(path.join(left.root, ...leftResult.candidateRef.path.split('/')), 'utf8')
      );
      const candidateSchema = JSON.parse(
        readFileSync(
          path.join(
            process.cwd(),
            'packages/bmad-speckit/src/main-agent/source-authority/schemas/main-agent-implementation-readiness-candidate.schema.json'
          ),
          'utf8'
        )
      );
      const resultSchema = JSON.parse(
        readFileSync(
          path.join(
            process.cwd(),
            'packages/bmad-speckit/src/main-agent/source-authority/schemas/main-agent-implementation-readiness-result.schema.json'
          ),
          'utf8'
        )
      );
      const ajv = new Ajv2020({ allErrors: true, strict: false });
      const validateCandidate = ajv.compile(candidateSchema);
      const validateResult = ajv.compile(resultSchema);

      expect(validateCandidate(candidate), JSON.stringify(validateCandidate.errors)).toBe(true);
      expect(validateResult(leftResult), JSON.stringify(validateResult.errors)).toBe(true);
      expect(leftResult.implementationReadinessCandidateHash).toBe(
        rightResult.implementationReadinessCandidateHash
      );
      expect(validateCandidate({ ...candidate, generatedAt: new Date().toISOString() })).toBe(
        false
      );
      expect(
        validateResult({
          ...leftResult,
          status: 'implementation_readiness_blocked',
          issueCodes: ['red_proof_not_observed:CMD-readiness-refund'],
        })
      ).toBe(false);
      expect(
        validateResult({
          schemaVersion: 'implementation-readiness-result/v2',
          status: 'implementation_readiness_blocked',
          requestId: left.requestId,
          issueCodes: [`red_proof_not_observed:${left.commandIds[0]}`],
          commandExecutionCount: 1,
          writeCount: 0,
        })
      ).toBe(true);
      expect(
        validateResult({
          schemaVersion: 'implementation-readiness-result/v2',
          status: 'implementation_readiness_blocked',
          requestId: left.requestId,
          issueCodes: ['arbitrary_unclosed_issue'],
          commandExecutionCount: 0,
          writeCount: 0,
        })
      ).toBe(false);
      expect(
        validateResult({
          ...leftResult,
          status: 'implementation_readiness_pass',
          commandExecutionCount: 0,
          writeCount: 1,
        })
      ).toBe(false);
      expect(
        validateResult({
          ...leftResult,
          status: 'implementation_readiness_reused',
          commandExecutionCount: 0,
          writeCount: 1,
        })
      ).toBe(false);
      for (const issueCode of [
        'implementation_readiness_command_scope_unclosed',
        'implementation_readiness_runtime_prerequisite_invalid',
        'readiness_recheck_required:scoped_input_digest',
      ]) {
        expect(
          validateResult({
            schemaVersion: 'implementation-readiness-result/v2',
            status: 'implementation_readiness_blocked',
            requestId: left.requestId,
            issueCodes: [issueCode],
            commandExecutionCount: 0,
            writeCount: 0,
          }),
          issueCode
        ).toBe(true);
      }
    } finally {
      left.cleanup();
      right.cleanup();
    }
  });

  it('normalizes forbidden caller-derived inputs to the closed issue code', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      const context = readinessActionContext(fixture);
      const action = implementationReadinessGateAction({
        ...context,
        args: { ...context.args, candidateHash: 'sha256:caller-derived' },
      }) as Record<string, any>;

      expect(action).toMatchObject({
        status: 'implementation_readiness_blocked',
        exitCode: 2,
        result: {
          schemaVersion: 'implementation-readiness-result/v2',
          status: 'implementation_readiness_blocked',
          requestId: 'unknown',
          issueCodes: ['caller_derived_input_forbidden'],
          commandExecutionCount: 0,
          writeCount: 0,
        },
      });
    } finally {
      fixture.cleanup();
    }
  });

  it.each([
    ['pre_implementation_target', 'targetPath'],
    ['test', 'testPath'],
    ['config', 'configPath'],
    ['lock', 'lockPath'],
  ] as const)('changes the scoped digest and candidate when %s bytes change', (_role, field) => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      const first = run(fixture).result;
      appendFileSync(fixture[field], '\n', 'utf8');
      const second = run(fixture).result;

      expect(second.status).toBe('implementation_readiness_pass');
      expect(second.readinessScopedInputDigest).not.toBe(first.readinessScopedInputDigest);
      expect(second.implementationReadinessCandidateHash).not.toBe(
        first.implementationReadinessCandidateHash
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects publishing an evaluated candidate when scoped bytes drift before promotion', () => {
    const fixture = materializeImplementationReadinessFixture();
    let executions = 0;
    try {
      expect(() =>
        produceImplementationReadiness(
          { projectRoot: fixture.root, requestId: fixture.requestId },
          {
            onCommandExecuted: () => {
              executions += 1;
            },
            beforePublish: () => {
              appendFileSync(fixture.targetPath, '\n', 'utf8');
            },
          }
        )
      ).toThrow('readiness_recheck_required:scoped_input_digest');
      expect(executions).toBe(1);
      const evaluationsRoot = path.join(fixture.recordRoot, 'record', 'readiness', 'evaluations');
      expect(
        existsSync(evaluationsRoot)
          ? readdirSync(evaluationsRoot).filter((name) => !name.startsWith('.staging-'))
          : []
      ).toEqual([]);
    } finally {
      fixture.cleanup();
    }
  });

  it('includes an equals-form config input in the scoped digest', () => {
    const fixture = materializeImplementationReadinessFixture({
      invocation: 'node --config=readiness.config.json --test tests/refund-worker.test.cjs',
      additionalFiles: { 'readiness.config.json': '{"mode":"red"}\n' },
    });
    try {
      const result = produceImplementationReadiness(
        { projectRoot: fixture.root, requestId: fixture.requestId },
        { runCommand: () => expectedRedOutput(fixture) }
      ) as Record<string, any>;
      const candidate = JSON.parse(
        readFileSync(path.join(fixture.root, ...result.candidateRef.path.split('/')), 'utf8')
      );
      expect(candidate.inputArtifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: 'config', logicalPath: 'readiness.config.json' }),
        ])
      );
    } finally {
      fixture.cleanup();
    }
  });

  it.each([
    ['node --require setup.cjs --test tests/refund-worker.test.cjs', 'setup.cjs'],
    ['node --require=setup.cjs --test tests/refund-worker.test.cjs', 'setup.cjs'],
    ['node -r setup.cjs --test tests/refund-worker.test.cjs', 'setup.cjs'],
    ['node --import setup.mjs --test tests/refund-worker.test.cjs', 'setup.mjs'],
    ['node --loader=setup.mjs --test tests/refund-worker.test.cjs', 'setup.mjs'],
    ['node --experimental-loader setup.mjs --test tests/refund-worker.test.cjs', 'setup.mjs'],
    ['node --env-file .env --test tests/refund-worker.test.cjs', '.env'],
    ['node --experimental-policy=policy.json --test tests/refund-worker.test.cjs', 'policy.json'],
    ['npx node --require setup.cjs --test tests/refund-worker.test.cjs', 'setup.cjs'],
    ['node scripts/red-runner.cjs tests/refund-worker.test.cjs', 'scripts/red-runner.cjs'],
  ])('binds Node runtime input bytes for %s', (invocation, runtimeInput) => {
    const fixture = materializeImplementationReadinessFixture({
      invocation,
      additionalFiles: {
        'setup.cjs': 'globalThis.readinessSetup = true;\n',
        'setup.mjs': 'export const readinessSetup = true;\n',
        '.env': 'READINESS_MODE=red\n',
        'policy.json': '{}\n',
        'scripts/red-runner.cjs': "require('node:test');\n",
      },
    });
    try {
      const first = produceImplementationReadiness(
        { projectRoot: fixture.root, requestId: fixture.requestId },
        { runCommand: () => expectedRedOutput(fixture) }
      ) as Record<string, any>;
      appendFileSync(path.join(fixture.root, runtimeInput), '\n', 'utf8');
      const second = produceImplementationReadiness(
        { projectRoot: fixture.root, requestId: fixture.requestId },
        { runCommand: () => expectedRedOutput(fixture) }
      ) as Record<string, any>;

      expect(second.readinessScopedInputDigest).not.toBe(first.readinessScopedInputDigest);
      const candidate = JSON.parse(
        readFileSync(path.join(fixture.root, ...second.candidateRef.path.split('/')), 'utf8')
      );
      expect(candidate.inputArtifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: 'config', logicalPath: runtimeInput }),
        ])
      );
    } finally {
      fixture.cleanup();
    }
  });

  it.each([
    'npm --prefix packages/app test -- tests/refund-worker.test.cjs',
    'yarn --cwd packages/app test tests/refund-worker.test.cjs',
    'pnpm --filter app test -- tests/refund-worker.test.cjs',
    'pnpm -r test -- tests/refund-worker.test.cjs',
  ])('fails closed when package scope cannot be closed for %s', (invocation) => {
    const fixture = materializeImplementationReadinessFixture({ invocation });
    let executions = 0;
    try {
      expect(() =>
        produceImplementationReadiness(
          { projectRoot: fixture.root, requestId: fixture.requestId },
          {
            runCommand: () => expectedRedOutput(fixture),
            onCommandExecuted: () => {
              executions += 1;
            },
          }
        )
      ).toThrow('implementation_readiness_command_scope_unclosed');
      expect(executions).toBe(0);
    } finally {
      fixture.cleanup();
    }
  });

  it.each([
    'npm test -- tests/refund-worker.test.cjs',
    'npx node --test tests/refund-worker.test.cjs',
    'pnpm test -- tests/refund-worker.test.cjs',
    'yarn test tests/refund-worker.test.cjs',
    'bun test tests/refund-worker.test.cjs',
  ])('closes root package-manager command inputs for %s', (invocation) => {
    const fixture = materializeImplementationReadinessFixture({ invocation });
    try {
      const result = produceImplementationReadiness(
        { projectRoot: fixture.root, requestId: fixture.requestId },
        { runCommand: () => expectedRedOutput(fixture) }
      ) as Record<string, any>;
      const candidate = JSON.parse(
        readFileSync(path.join(fixture.root, ...result.candidateRef.path.split('/')), 'utf8')
      );

      expect(candidate.inputArtifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: 'test', logicalPath: 'tests/refund-worker.test.cjs' }),
          expect.objectContaining({ role: 'config', logicalPath: 'package.json' }),
          expect.objectContaining({ role: 'lock', logicalPath: 'package-lock.json' }),
        ])
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects an invalid official architecture prerequisite before executing RED', () => {
    const fixture = materializeImplementationReadinessFixture();
    let executions = 0;
    try {
      const runtimeRecord = JSON.parse(readFileSync(fixture.runtimeRecordPath, 'utf8'));
      runtimeRecord.sixModelResults.architecture_confirmation.status = 'not_established';
      writeFileSync(
        fixture.runtimeRecordPath,
        `${JSON.stringify(runtimeRecord, null, 2)}\n`,
        'utf8'
      );
      expect(() =>
        produceImplementationReadiness(
          { projectRoot: fixture.root, requestId: fixture.requestId },
          {
            onCommandExecuted: () => {
              executions += 1;
            },
          }
        )
      ).toThrow('implementation_readiness_runtime_prerequisite_invalid');
      expect(executions).toBe(0);
      expect(existsSync(path.join(fixture.recordRoot, 'record', 'readiness', 'evaluations'))).toBe(
        false
      );
    } finally {
      fixture.cleanup();
    }
  });
});
