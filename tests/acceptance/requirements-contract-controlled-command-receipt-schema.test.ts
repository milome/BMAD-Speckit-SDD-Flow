import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

const HASH = `sha256:${'a'.repeat(64)}`;
const COMMAND_ID = ['CMD', '1'].join('-');
const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-controlled-command-receipt.schema.json'
);
const lineageSchemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-recovery-lineage-receipt.schema.json'
);

function receipt() {
  return {
    schemaVersion: 'requirements-contract-controlled-command-receipt/v1',
    commandRunId: 'RUN-controlled-command-schema',
    invocationSequence: 1,
    commandId: COMMAND_ID,
    argv: ['node', '--version'],
    argvHash: HASH,
    orderedChildren: [
      {
        argv: ['node', '--version'],
        argvHash: HASH,
        cwd: 'D:/Dev/BMAD-Speckit-SDD-Flow',
        startedAt: '2026-07-13T00:00:00.100Z',
        endedAt: '2026-07-13T00:00:00.900Z',
        exitCode: 0,
        signal: null,
        stdoutPath: 'evidence/child.stdout.log',
        stdoutHash: HASH,
        stderrPath: 'evidence/child.stderr.log',
        stderrHash: HASH,
      },
    ],
    cwd: 'D:/Dev/BMAD-Speckit-SDD-Flow',
    executorIdentity: {
      class: 'goal_controlled_executor',
      id: 'controlled-executor',
    },
    hostIdentity: {
      platform: 'win32',
      architecture: 'x64',
      nodeVersion: 'v24.0.0',
    },
    transactionId: 'TX-controlled-command-schema',
    implementationAttemptId: 'IMP-controlled-command-schema',
    architectureAuditAttemptId: 'AUDIT-controlled-command-schema',
    activePhaseAuditAttemptId: 'AUDIT-controlled-command-schema',
    contractHash: HASH,
    inputSnapshotHash: HASH,
    startedAt: '2026-07-13T00:00:00.000Z',
    endedAt: '2026-07-13T00:00:01.000Z',
    exitCode: 0,
    signal: null,
    stdoutPath: 'evidence/command.stdout.log',
    stdoutHash: HASH,
    stderrPath: 'evidence/command.stderr.log',
    stderrHash: HASH,
    acceptanceRefs: ['acceptance-ref'],
    traceRefs: ['trace-ref'],
    publication: {
      writer: 'controlled-executor',
      targetPath: 'evidence/command.receipt.json',
      publishedAt: '2026-07-13T00:00:01.100Z',
      readbackAt: '2026-07-13T00:00:01.200Z',
      explicitUtf8: true,
      createOnly: true,
      readbackVerified: true,
    },
    decision: 'pass',
    passAuthorityScope: 'command_only',
  };
}

function validator() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(readFileSync(schemaPath, 'utf8')));
}

it('publishes the controlled command Receipt schema boundary', () => {
  expect(existsSync(schemaPath)).toBe(true);
});

describe.runIf(existsSync(schemaPath))(
  'requirements-contract-controlled-command-receipt/v1',
  () => {
    it('accepts exact execution, publication, and readback facts', () => {
      const validate = validator();

      expect(validate(receipt()), JSON.stringify(validate.errors)).toBe(true);
    });

    it('requires publication and readback timestamps', () => {
      const validate = validator();
      const missingPublication = receipt() as Record<string, any>;
      delete missingPublication.publication.publishedAt;
      const missingReadback = receipt() as Record<string, any>;
      delete missingReadback.publication.readbackAt;

      expect(validate(missingPublication)).toBe(false);
      expect(validate(missingReadback)).toBe(false);
    });

    it('requires child stdout and stderr readback paths', () => {
      const validate = validator();
      const missingStdoutPath = receipt() as Record<string, any>;
      delete missingStdoutPath.orderedChildren[0].stdoutPath;
      const missingStderrPath = receipt() as Record<string, any>;
      delete missingStderrPath.orderedChildren[0].stderrPath;

      expect(validate(missingStdoutPath)).toBe(false);
      expect(validate(missingStderrPath)).toBe(false);
    });

    it('keeps the causal clock-skew authority fixed at two seconds', () => {
      const lineageSchema = JSON.parse(
        readFileSync(lineageSchemaPath, 'utf8')
      ) as Record<string, unknown>;

      expect(lineageSchema['x-maxClockSkewMs']).toBe(2000);
    });
  }
);
