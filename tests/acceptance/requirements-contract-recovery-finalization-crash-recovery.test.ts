import { randomUUID } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import {
  finalizeRequirementsContractRecoveryLineageReceipt,
  requirementsContractRecoveryBootstrapCommand,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-recovery-bootstrap';
import {
  createRecoveryFixture,
  fileHash,
} from './helpers/requirements-contract-recovery-test-fixture';

async function prepareFixture(fixture: ReturnType<typeof createRecoveryFixture>) {
  const bootstrapExit = await requirementsContractRecoveryBootstrapCommand({
    cwd: fixture.cwd,
    contract: fixture.contractPath,
    authority: fixture.authorityPath,
    architectureAuthority: fixture.architectureAuthorityPath,
    attemptContext: fixture.contextPath,
    qualifiedRedReceipt: fixture.qualifiedRedPath,
    consumerRoot: fixture.consumerRoot,
    createIfAbsent: true,
    initialPublicationReceipt: fixture.publicationPath,
    out: fixture.provisionalPath,
    json: false,
  });
  expect(bootstrapExit).toBe(0);
  const expectedRoles = fixture.schema['x-finalizedCommandReceiptRoles'] as string[];
  return expectedRoles.map((role) => fixture.createCommandReceipt(role));
}

function optionsFor(
  fixture: ReturnType<typeof createRecoveryFixture>,
  commandReceipts: string[],
  commandRunId?: string,
  invocationSequence?: number
) {
  const initial = Object.values(fixture.context.commandPlan).find(
    (entry: any) => entry.commandId === fixture.roles.finalizer
  ) as Record<string, any>;
  return {
    cwd: fixture.cwd,
    contract: fixture.contractPath,
    authority: fixture.authorityPath,
    architectureAuthority: fixture.architectureAuthorityPath,
    attemptContext: fixture.contextPath,
    recovery: fixture.provisionalPath,
    initialPublicationReceipt: fixture.publicationPath,
    target: fixture.targetPath,
    expectedTargetPreimageHash: fixture.context.recoveryTarget.preimageHash,
    qualifiedRedReceipt: fixture.qualifiedRedPath,
    commandReceipts,
    expectedProvisionalHash: fileHash(fixture.provisionalPath),
    commandRunId: commandRunId ?? initial.commandRunId,
    invocationSequence: invocationSequence ?? initial.invocationSequence,
    finalizationRunId: fixture.context.finalizationRunId,
    transactionRoot: fixture.transactionRoot,
    failureRoot: fixture.failureRoot,
    finalizationReceipt: fixture.finalizationReceiptPath,
    json: false,
  };
}

it('observes an existing commit idempotently under a new retry invocation', async () => {
  const fixture = createRecoveryFixture();
  try {
    const commandReceipts = await prepareFixture(fixture);
    const initialOptions = optionsFor(fixture, commandReceipts);
    const committed = await finalizeRequirementsContractRecoveryLineageReceipt(
      initialOptions
    );
    expect(committed.outcome).toBe('committed');
    const targetHash = fileHash(fixture.targetPath);
    const commitReceiptHash = fileHash(fixture.finalizationReceiptPath);

    const observed = await finalizeRequirementsContractRecoveryLineageReceipt(
      optionsFor(
        fixture,
        commandReceipts,
        `RUN-retry-${randomUUID()}`,
        initialOptions.invocationSequence + 1
      )
    );

    expect(observed.outcome).toBe('idempotent_observation');
    expect(observed.passAuthority).toBe(false);
    expect(observed.commitCommandRunId).toBe(initialOptions.commandRunId);
    expect(observed.commitInvocationSequence).toBe(
      initialOptions.invocationSequence
    );
    expect(fileHash(fixture.targetPath)).toBe(targetHash);
    expect(fileHash(fixture.finalizationReceiptPath)).toBe(commitReceiptHash);
  } finally {
    fixture.cleanup();
  }
});

it('rejects a tampered committed receipt during idempotent observation', async () => {
  const fixture = createRecoveryFixture();
  try {
    const commandReceipts = await prepareFixture(fixture);
    const initialOptions = optionsFor(fixture, commandReceipts);
    const committed = await finalizeRequirementsContractRecoveryLineageReceipt(
      initialOptions
    );
    expect(committed.outcome).toBe('committed');

    const receipt = JSON.parse(
      readFileSync(fixture.finalizationReceiptPath, 'utf8')
    ) as Record<string, any>;
    receipt.commitCommandRunId = `RUN-forged-${randomUUID()}`;
    writeFileSync(
      fixture.finalizationReceiptPath,
      `${JSON.stringify(receipt, null, 2)}\n`,
      'utf8'
    );

    await expect(
      finalizeRequirementsContractRecoveryLineageReceipt(
        optionsFor(
          fixture,
          commandReceipts,
          `RUN-retry-${randomUUID()}`,
          initialOptions.invocationSequence + 1
        )
      )
    ).rejects.toThrow(/committed recovery receipt binding mismatch/u);
  } finally {
    fixture.cleanup();
  }
});

it('blocks a staged-only transaction state without mutating the target', async () => {
  const fixture = createRecoveryFixture();
  try {
    const commandReceipts = await prepareFixture(fixture);
    const transactionDirectory = path.dirname(path.dirname(fixture.provisionalPath));
    const stagedPath = path.join(
      transactionDirectory,
      'staged',
      'recovery-lineage-receipt.json'
    );
    mkdirSync(path.dirname(stagedPath), { recursive: true });
    writeFileSync(stagedPath, readFileSync(fixture.provisionalPath));
    const targetHash = fileHash(fixture.targetPath);

    await expect(
      finalizeRequirementsContractRecoveryLineageReceipt(
        optionsFor(fixture, commandReceipts)
      )
    ).rejects.toThrow(/transaction is corrupt/u);

    expect(fileHash(fixture.targetPath)).toBe(targetHash);
    expect(existsSync(fixture.finalizationReceiptPath)).toBe(false);
  } finally {
    fixture.cleanup();
  }
});

it('rejects an unbound prior invocation decision before recovery', async () => {
  const fixture = createRecoveryFixture();
  try {
    const commandReceipts = await prepareFixture(fixture);
    const initialOptions = optionsFor(fixture, commandReceipts);
    const transactionDirectory = path.dirname(path.dirname(fixture.provisionalPath));
    const invocationKey = `${initialOptions.invocationSequence}-${initialOptions.commandRunId}`;
    const intentPath = path.join(
      transactionDirectory,
      'invocations',
      `${invocationKey}.intent.json`
    );
    const decisionPath = path.join(
      transactionDirectory,
      'observations',
      `${invocationKey}.state-decision.receipt.json`
    );
    mkdirSync(path.dirname(intentPath), { recursive: true });
    mkdirSync(path.dirname(decisionPath), { recursive: true });
    writeFileSync(intentPath, '{"tampered":true}\n', 'utf8');
    writeFileSync(decisionPath, '{"tampered":true}\n', 'utf8');
    const targetHash = fileHash(fixture.targetPath);

    await expect(
      finalizeRequirementsContractRecoveryLineageReceipt(
        optionsFor(
          fixture,
          commandReceipts,
          `RUN-retry-${randomUUID()}`,
          initialOptions.invocationSequence + 1
        )
      )
    ).rejects.toThrow(/prior invocation binding mismatch/u);

    expect(fileHash(fixture.targetPath)).toBe(targetHash);
    expect(existsSync(fixture.finalizationReceiptPath)).toBe(false);
  } finally {
    fixture.cleanup();
  }
});

it('rejects a tampered prepare receipt before retry promotion', async () => {
  const fixture = createRecoveryFixture();
  try {
    const commandReceipts = await prepareFixture(fixture);
    const initialOptions = optionsFor(fixture, commandReceipts);
    const committed = await finalizeRequirementsContractRecoveryLineageReceipt(
      initialOptions
    );
    expect(committed.outcome).toBe('committed');

    const transactionDirectory = path.dirname(path.dirname(fixture.provisionalPath));
    const backupPath = path.join(
      transactionDirectory,
      'backup',
      'recovery-lineage-receipt.json'
    );
    const prepareReceiptPath = path.join(
      transactionDirectory,
      'phases',
      'prepare.receipt.json'
    );
    const promotedReceiptPath = path.join(
      transactionDirectory,
      'phases',
      'target-promoted.receipt.json'
    );
    copyFileSync(backupPath, fixture.targetPath);
    rmSync(promotedReceiptPath);
    rmSync(fixture.finalizationReceiptPath);

    const prepareReceipt = JSON.parse(
      readFileSync(prepareReceiptPath, 'utf8')
    ) as Record<string, any>;
    prepareReceipt.staged.hash = `sha256:${'0'.repeat(64)}`;
    writeFileSync(
      prepareReceiptPath,
      `${JSON.stringify(prepareReceipt, null, 2)}\n`,
      'utf8'
    );
    const targetHash = fileHash(fixture.targetPath);

    await expect(
      finalizeRequirementsContractRecoveryLineageReceipt(
        optionsFor(
          fixture,
          commandReceipts,
          `RUN-retry-${randomUUID()}`,
          initialOptions.invocationSequence + 1
        )
      )
    ).rejects.toThrow(/prepare receipt binding mismatch/u);

    expect(fileHash(fixture.targetPath)).toBe(targetHash);
    expect(existsSync(fixture.finalizationReceiptPath)).toBe(false);
  } finally {
    fixture.cleanup();
  }
});

it('rejects a tampered logical intent before resuming backup-only state', async () => {
  const fixture = createRecoveryFixture();
  try {
    const commandReceipts = await prepareFixture(fixture);
    const initialOptions = optionsFor(fixture, commandReceipts);
    const committed = await finalizeRequirementsContractRecoveryLineageReceipt(
      initialOptions
    );
    expect(committed.outcome).toBe('committed');

    const transactionDirectory = path.dirname(path.dirname(fixture.provisionalPath));
    const logicalIntentPath = path.join(transactionDirectory, 'intent.json');
    const backupPath = path.join(
      transactionDirectory,
      'backup',
      'recovery-lineage-receipt.json'
    );
    const stagedPath = path.join(
      transactionDirectory,
      'staged',
      'recovery-lineage-receipt.json'
    );
    const prepareReceiptPath = path.join(
      transactionDirectory,
      'phases',
      'prepare.receipt.json'
    );
    const promotedReceiptPath = path.join(
      transactionDirectory,
      'phases',
      'target-promoted.receipt.json'
    );
    copyFileSync(backupPath, fixture.targetPath);
    rmSync(stagedPath);
    rmSync(prepareReceiptPath);
    rmSync(promotedReceiptPath);
    rmSync(fixture.finalizationReceiptPath);

    const logicalIntent = JSON.parse(
      readFileSync(logicalIntentPath, 'utf8')
    ) as Record<string, any>;
    logicalIntent.stagedHash = `sha256:${'0'.repeat(64)}`;
    writeFileSync(
      logicalIntentPath,
      `${JSON.stringify(logicalIntent, null, 2)}\n`,
      'utf8'
    );
    const targetHash = fileHash(fixture.targetPath);

    await expect(
      finalizeRequirementsContractRecoveryLineageReceipt(
        optionsFor(
          fixture,
          commandReceipts,
          `RUN-retry-${randomUUID()}`,
          initialOptions.invocationSequence + 1
        )
      )
    ).rejects.toThrow(/logical finalization intent binding mismatch/u);

    expect(fileHash(fixture.targetPath)).toBe(targetHash);
    expect(existsSync(stagedPath)).toBe(false);
    expect(existsSync(fixture.finalizationReceiptPath)).toBe(false);
  } finally {
    fixture.cleanup();
  }
});
