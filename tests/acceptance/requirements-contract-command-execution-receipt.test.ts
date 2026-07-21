import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateModelPacketCommandExecutionReceipts } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-command-execution-receipt';
import {
  cleanupRequirementWorkspace,
  materializeRequirementFixture,
  writeCompiledImplementPacket,
} from '../helpers/requirement-fixture-runtime';

const COMMAND_ID = 'CMD-NATIVE-GOAL';
const COMMAND_TEXT = 'npm test -- --native-goal';
const COMMAND_ARGV = ['npm', 'test', '--', '--native-goal'];
const RECEIPT_SCHEMA_PATH = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-command-execution-receipt.schema.json'
);

function sha256File(filePath: string): string {
  return `sha256:${createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function sha256Stable(value: unknown): string {
  return `sha256:${createHash('sha256').update(stableStringify(value), 'utf8').digest('hex')}`;
}

function prepareReceiptImport(input: {
  writeReceipt?: boolean;
  mutateReceipt?: (receipt: Record<string, any>) => void;
  rehashAfterMutation?: boolean;
  tamperStdoutAfterPublication?: boolean;
} = {}) {
  const fixture = materializeRequirementFixture({
    currentMentalModel: 'execution_closure',
    sixModelResults: {
      requirement_confirmation: { status: 'pass' },
      architecture_confirmation: { status: 'pass' },
      implementation_readiness: { status: 'pass' },
      execution_closure: { status: 'pass' },
    },
  });
  const packetId = 'command-execution-receipt-required';
  const compiled = writeCompiledImplementPacket({
    root: fixture.root,
    fixture,
    packetId,
  });
  const receiptPath = path.join(
    fixture.root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    fixture.requirementSetId,
    'command-receipts',
    packetId,
    `${COMMAND_ID}.json`
  );
  const modelPacket = JSON.parse(
    fs.readFileSync(compiled.compiledPromptRef.modelPacketPath, 'utf8')
  );
  modelPacket.controlledExecutionContext = {
    requirementSetId: fixture.requirementSetId,
    transactionId: 'TX-command-execution-receipt',
    implementationAttemptId: 'IMPL-ATTEMPT-COMMAND-EXECUTION-RECEIPT',
    architectureAuditAttemptId: 'AUDIT-command-execution-receipt',
    activePhaseAuditAttemptId: 'AUDIT-command-execution-receipt',
    contractHash: `sha256:${'a'.repeat(64)}`,
    inputSnapshotHash: `sha256:${'b'.repeat(64)}`,
  };
  modelPacket.requiredCommands = [
    {
      id: COMMAND_ID,
      command: COMMAND_TEXT,
      argv: COMMAND_ARGV,
      cwd: fixture.root,
      receiptPath,
      requirementRefs: [fixture.recordId],
      acceptanceRefs: ['AC-150'],
      traceRefs: ['TR-150'],
    },
  ];
  fs.writeFileSync(
    compiled.compiledPromptRef.modelPacketPath,
    `${JSON.stringify(modelPacket, null, 2)}\n`,
    'utf8'
  );
  const stdoutPath = path.join(path.dirname(receiptPath), `${COMMAND_ID}.stdout.log`);
  const stderrPath = path.join(path.dirname(receiptPath), `${COMMAND_ID}.stderr.log`);
  if (input.writeReceipt) {
    fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
    fs.writeFileSync(stdoutPath, 'controlled command output\n', 'utf8');
    fs.writeFileSync(stderrPath, '', 'utf8');
    const receipt: Record<string, any> = {
      schemaVersion: 'requirements-contract-command-execution-receipt/v1',
      commandRunId: 'RUN-command-execution-receipt',
      commandId: COMMAND_ID,
      command: COMMAND_TEXT,
      normalizedCommand: COMMAND_TEXT,
      argv: COMMAND_ARGV,
      argvHash: sha256Stable(COMMAND_ARGV),
      cwd: fixture.root,
      executorIdentity: {
        class: 'controlled_detached_executor',
        id: 'command-execution-receipt-test-executor',
      },
      hostIdentity: {
        platform: process.platform,
        architecture: process.arch,
        nodeVersion: process.version,
      },
      requirementSetId: fixture.requirementSetId,
      requirementRefs: [fixture.recordId],
      transactionId: 'TX-command-execution-receipt',
      implementationAttemptId: 'IMPL-ATTEMPT-COMMAND-EXECUTION-RECEIPT',
      architectureAuditAttemptId: 'AUDIT-command-execution-receipt',
      activePhaseAuditAttemptId: 'AUDIT-command-execution-receipt',
      contractHash: `sha256:${'a'.repeat(64)}`,
      inputSnapshotHash: `sha256:${'b'.repeat(64)}`,
      startedAt: '2026-07-16T00:00:00.000Z',
      endedAt: '2026-07-16T00:00:01.000Z',
      exitCode: 0,
      signal: null,
      stdoutPath,
      stdoutHash: sha256File(stdoutPath),
      stderrPath,
      stderrHash: sha256File(stderrPath),
      acceptanceRefs: ['AC-150'],
      traceRefs: ['TR-150'],
      publication: {
        writer: 'controlled-detached-executor',
        targetPath: receiptPath,
        publishedAt: '2026-07-16T00:00:01.100Z',
        readbackAt: '2026-07-16T00:00:01.200Z',
        explicitUtf8: true,
        createOnly: true,
        readbackVerified: true,
      },
      decision: 'pass',
    };
    input.mutateReceipt?.(receipt);
    if (input.rehashAfterMutation !== false) {
      delete receipt.receiptHash;
      receipt.receiptHash = sha256Stable(receipt);
    } else if (!receipt.receiptHash) {
      receipt.receiptHash = sha256Stable(receipt);
    }
    fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
    if (input.tamperStdoutAfterPublication) {
      fs.appendFileSync(stdoutPath, 'tampered after publication\n', 'utf8');
    }
  }
  return { fixture, modelPacket };
}

function validatePrepared(prepared: ReturnType<typeof prepareReceiptImport>) {
  return validateModelPacketCommandExecutionReceipts({
    projectRoot: prepared.fixture.root,
    modelPacket: prepared.modelPacket,
  });
}

describe('requirements contract command execution receipt', () => {
  it('publishes the command-execution Receipt schema boundary', () => {
    expect(fs.existsSync(RECEIPT_SCHEMA_PATH)).toBe(true);
  });

  it('blocks unresolved requiredValidationCommandRefs instead of treating them as no commands', () => {
    const validation = validateModelPacketCommandExecutionReceipts({
      projectRoot: process.cwd(),
      modelPacket: {
        executionHandoff: {
          requiredValidationCommandRefs: [COMMAND_ID],
        },
      },
    });

    expect(validation.decision).toBe('block');
    expect(validation.commandIds).toEqual([COMMAND_ID]);
    expect(validation.issueCodes).toContain(
      `required_command_reference_unresolved:${COMMAND_ID}`
    );
  });

  it('blocks duplicate requiredValidationCommandRefs', () => {
    const validation = validateModelPacketCommandExecutionReceipts({
      projectRoot: process.cwd(),
      modelPacket: {
        executionHandoff: {
          requiredValidationCommandRefs: [COMMAND_ID, COMMAND_ID],
        },
      },
    });

    expect(validation.decision).toBe('block');
    expect(validation.commandIds).toEqual([COMMAND_ID]);
    expect(validation.issueCodes).toContain(
      `required_command_reference_duplicate:${COMMAND_ID}`
    );
  });

  it('blocks an external TaskReport when the model packet has no command descriptors', () => {
    const validation = validateModelPacketCommandExecutionReceipts({
      projectRoot: process.cwd(),
      modelPacket: {},
      requireCommandDescriptors: true,
    });

    expect(validation.decision).toBe('block');
    expect(validation.commandIds).toEqual([]);
    expect(validation.issueCodes).toContain('required_command_descriptor_missing');
  });

  it('rejects command-ID text when the controlled-executor Receipt is missing', () => {
    const prepared = prepareReceiptImport();
    try {
      const validation = validatePrepared(prepared);

      expect(validation.decision).toBe('block');
      expect(validation.issueCodes).toContain(
        `required_command_receipt_missing:${COMMAND_ID}`
      );
    } finally {
      cleanupRequirementWorkspace(prepared.fixture.root);
    }
  });

  it('accepts only when a current exact Receipt proves command success', () => {
    const prepared = prepareReceiptImport({
      writeReceipt: true,
    });
    try {
      const validation = validatePrepared(prepared);

      expect(validation.decision).toBe('pass');
      expect(validation.issueCodes).toEqual([]);
      expect(validation.acceptedReceipts).toEqual([
        expect.objectContaining({
          commandId: COMMAND_ID,
          commandRunRef: expect.objectContaining({
            commandId: COMMAND_ID,
            runId: 'RUN-command-execution-receipt',
            exitCode: 0,
          }),
        }),
      ]);
    } finally {
      cleanupRequirementWorkspace(prepared.fixture.root);
    }
  });

  it.each([
    {
      name: 'schema',
      mutateReceipt: (receipt: Record<string, any>) => {
        receipt.schemaVersion = 'requirements-contract-command-execution-receipt/v0';
      },
      expected: `required_command_receipt_schema_invalid:${COMMAND_ID}`,
    },
    {
      name: 'receipt-hash',
      mutateReceipt: (receipt: Record<string, any>) => {
        receipt.receiptHash = `sha256:${'f'.repeat(64)}`;
      },
      rehashAfterMutation: false,
      expected: `required_command_receipt_hash_mismatch:${COMMAND_ID}`,
    },
    {
      name: 'command-id',
      mutateReceipt: (receipt: Record<string, any>) => {
        receipt.commandId = 'CMD-OTHER';
      },
      expected: `required_command_receipt_binding_mismatch:${COMMAND_ID}:commandId`,
    },
    {
      name: 'normalized-command',
      mutateReceipt: (receipt: Record<string, any>) => {
        receipt.normalizedCommand = 'npm test -- --other';
      },
      expected: `required_command_receipt_binding_mismatch:${COMMAND_ID}:normalizedCommand`,
    },
    {
      name: 'argv',
      mutateReceipt: (receipt: Record<string, any>) => {
        receipt.argv = ['npm', 'test', '--', '--other'];
        receipt.argvHash = sha256Stable(receipt.argv);
      },
      expected: `required_command_receipt_binding_mismatch:${COMMAND_ID}:argv`,
    },
    {
      name: 'argv-hash',
      mutateReceipt: (receipt: Record<string, any>) => {
        receipt.argvHash = `sha256:${'c'.repeat(64)}`;
      },
      expected: `required_command_receipt_integrity_mismatch:${COMMAND_ID}:argvHash`,
    },
    {
      name: 'cwd',
      mutateReceipt: (receipt: Record<string, any>) => {
        receipt.cwd = path.dirname(receipt.cwd);
      },
      expected: `required_command_receipt_binding_mismatch:${COMMAND_ID}:cwd`,
    },
    {
      name: 'requirement',
      mutateReceipt: (receipt: Record<string, any>) => {
        receipt.requirementRefs = ['REQ-OTHER'];
      },
      expected: `required_command_receipt_binding_mismatch:${COMMAND_ID}:requirementRefs`,
    },
    {
      name: 'transaction',
      mutateReceipt: (receipt: Record<string, any>) => {
        receipt.transactionId = 'TX-other';
      },
      expected: `required_command_receipt_binding_mismatch:${COMMAND_ID}:transactionId`,
    },
    {
      name: 'implementation-attempt',
      mutateReceipt: (receipt: Record<string, any>) => {
        receipt.implementationAttemptId = 'IMPL-ATTEMPT-OTHER';
      },
      expected: `required_command_receipt_binding_mismatch:${COMMAND_ID}:implementationAttemptId`,
    },
    {
      name: 'phase-attempt',
      mutateReceipt: (receipt: Record<string, any>) => {
        receipt.activePhaseAuditAttemptId = 'AUDIT-other';
      },
      expected: `required_command_receipt_binding_mismatch:${COMMAND_ID}:activePhaseAuditAttemptId`,
    },
    {
      name: 'contract-hash',
      mutateReceipt: (receipt: Record<string, any>) => {
        receipt.contractHash = `sha256:${'d'.repeat(64)}`;
      },
      expected: `required_command_receipt_binding_mismatch:${COMMAND_ID}:contractHash`,
    },
    {
      name: 'input-snapshot',
      mutateReceipt: (receipt: Record<string, any>) => {
        receipt.inputSnapshotHash = `sha256:${'e'.repeat(64)}`;
      },
      expected: `required_command_receipt_binding_mismatch:${COMMAND_ID}:inputSnapshotHash`,
    },
    {
      name: 'non-pass',
      mutateReceipt: (receipt: Record<string, any>) => {
        receipt.exitCode = 1;
        receipt.decision = 'block';
      },
      expected: `required_command_receipt_non_pass:${COMMAND_ID}`,
    },
    {
      name: 'acceptance',
      mutateReceipt: (receipt: Record<string, any>) => {
        receipt.acceptanceRefs = ['AC-OTHER'];
      },
      expected: `required_command_receipt_binding_mismatch:${COMMAND_ID}:acceptanceRefs`,
    },
    {
      name: 'trace',
      mutateReceipt: (receipt: Record<string, any>) => {
        receipt.traceRefs = ['TR-OTHER'];
      },
      expected: `required_command_receipt_binding_mismatch:${COMMAND_ID}:traceRefs`,
    },
    {
      name: 'publication-target',
      mutateReceipt: (receipt: Record<string, any>) => {
        receipt.publication.targetPath = `${receipt.publication.targetPath}.other`;
      },
      expected: `required_command_receipt_publication_invalid:${COMMAND_ID}:targetPath`,
    },
    {
      name: 'publication-readback',
      mutateReceipt: (receipt: Record<string, any>) => {
        receipt.publication.readbackVerified = false;
      },
      expected: `required_command_receipt_schema_invalid:${COMMAND_ID}`,
    },
  ])('rejects $name mismatch without importing the TaskReport', (testCase) => {
    const prepared = prepareReceiptImport({
      writeReceipt: true,
      mutateReceipt: testCase.mutateReceipt,
      rehashAfterMutation: testCase.rehashAfterMutation,
    });
    try {
      const validation = validatePrepared(prepared);

      expect(validation.decision).toBe('block');
      expect(validation.issueCodes).toContain(testCase.expected);
    } finally {
      cleanupRequirementWorkspace(prepared.fixture.root);
    }
  });

  it('rejects output tampering after Receipt publication', () => {
    const prepared = prepareReceiptImport({
      writeReceipt: true,
      tamperStdoutAfterPublication: true,
    });
    try {
      const validation = validatePrepared(prepared);

      expect(validation.decision).toBe('block');
      expect(validation.issueCodes).toContain(
        `required_command_receipt_output_hash_mismatch:${COMMAND_ID}:stdout`
      );
    } finally {
      cleanupRequirementWorkspace(prepared.fixture.root);
    }
  });
});
