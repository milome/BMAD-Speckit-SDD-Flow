import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const HASH = `sha256:${'4'.repeat(64)}`;
const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-terminal-command-receipt.schema.json'
);

function finalizationTarget(
  order: number,
  artifactRole: string,
  targetPath: string,
  receiptPath: string,
  predecessorRole: string
) {
  return {
    order,
    artifactRole,
    targetPath,
    receiptPath,
    targetSchemaVersion: `requirements-contract-${artifactRole.toLowerCase()}/v1`,
    minimumBytes: 2,
    predecessorRole,
    targetHash: HASH,
    promotionReceiptHash: HASH,
    promotionHash: HASH,
    readbackHash: HASH,
  };
}

function command(commandId: 'CMD-24' | 'CMD-25', exitCode = 0) {
  return {
    commandId,
    exactArgv: ['node', 'packages/bmad-speckit/bin/bmad-speckit.js', commandId],
    argvHash: HASH,
    cwd: 'D:/Dev/BMAD-Speckit-SDD-Flow',
    executorIdentity: 'controlled-terminal-supervisor',
    hostIdentity: 'windows-x64',
    startedAt: '2026-07-13T00:00:00.000Z',
    endedAt: '2026-07-13T00:00:01.000Z',
    exitCode,
    stdoutHash: HASH,
    stderrHash: HASH,
  };
}

function receipt() {
  return {
    schemaVersion: 'requirements-contract-terminal-command-receipt/v1',
    contractHash: HASH,
    frozenEvidenceBundleHash: HASH,
    terminalFinalizationTargetSetDeclarationHash: HASH,
    terminalFinalizationTargetSetClosureHash: HASH,
    finalizationTargets: [
      finalizationTarget(
        1,
        'SAFE-WRITE-RECEIPT-MANIFEST',
        'docs/plans/evidence/loop-engineering-remediation/safe-write-receipt-manifest.json',
        'docs/plans/evidence/loop-engineering-remediation/finalization-receipts/safe-write-receipt-manifest.receipt.json',
        'not_applicable'
      ),
      finalizationTarget(
        2,
        'EVD-15',
        'docs/plans/evidence/loop-engineering-remediation/G15-final-gates.json',
        'docs/plans/evidence/loop-engineering-remediation/finalization-receipts/G15-final-gates.receipt.json',
        'SAFE-WRITE-RECEIPT-MANIFEST'
      ),
      finalizationTarget(
        3,
        'ARTIFACT-01',
        'docs/plans/evidence/loop-engineering-remediation/implementation-evidence.json',
        'docs/plans/evidence/loop-engineering-remediation/finalization-receipts/implementation-evidence.receipt.json',
        'EVD-15'
      ),
    ],
    commands: [command('CMD-24'), command('CMD-25')],
    orderedExecutionDecision: 'pass',
    result: 'PASS',
  };
}

function validator() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(readFileSync(schemaPath, 'utf8')));
}

it('publishes the external terminal command receipt schema boundary', () => {
  expect(existsSync(schemaPath)).toBe(true);
});

describe.runIf(existsSync(schemaPath))('requirements-contract-terminal-command-receipt/v1', () => {
  it('accepts the exact three-target closure and ordered passing terminal commands', () => {
    const validate = validator();

    expect(validate(receipt()), JSON.stringify(validate.errors)).toBe(true);
  });

  it('accepts a blocking receipt only when at least one terminal command fails', () => {
    const validate = validator();
    const blocked = receipt();
    blocked.commands[1] = command('CMD-25', 1);
    blocked.orderedExecutionDecision = 'block';
    blocked.result = 'BLOCK';

    expect(validate(blocked), JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects command reordering and nonzero exits presented as PASS', () => {
    const validate = validator();
    const reordered = receipt();
    reordered.commands.reverse();
    const falsePass = receipt();
    falsePass.commands[1] = command('CMD-25', 1);

    expect(validate(reordered)).toBe(false);
    expect(validate(falsePass)).toBe(false);
  });

  it('rejects incomplete closure proof and circular self-hash authority', () => {
    const validate = validator();
    const incomplete = receipt() as Record<string, unknown>;
    const targets = incomplete.finalizationTargets as Array<Record<string, unknown>>;
    delete targets[2].readbackHash;
    const selfHashed = {
      ...receipt(),
      terminalCommandReceiptHash: HASH,
    };

    expect(validate(incomplete)).toBe(false);
    expect(validate(selfHashed)).toBe(false);
  });

  it('rejects BLOCK when both governed commands passed', () => {
    const validate = validator();
    const falseBlock = receipt();
    falseBlock.orderedExecutionDecision = 'block';
    falseBlock.result = 'BLOCK';

    expect(validate(falseBlock)).toBe(false);
  });
});
