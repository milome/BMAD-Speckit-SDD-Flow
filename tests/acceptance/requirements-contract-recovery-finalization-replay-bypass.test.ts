import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import {
  finalizeRequirementsContractRecoveryLineageReceipt,
  requirementsContractRecoveryBootstrapCommand,
  requirementsContractRecoveryFinalizeCommand,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-recovery-bootstrap';
import {
  createRecoveryFixture,
  fileHash,
} from './helpers/requirements-contract-recovery-test-fixture';

function canonical(value: any): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

async function preparedFixture() {
  const fixture = createRecoveryFixture();
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
  const commandReceipts = expectedRoles.map((role) =>
    fixture.createCommandReceipt(role)
  );
  const finalizerPlan = Object.values(fixture.context.commandPlan).find(
    (entry: any) => entry.commandId === fixture.roles.finalizer
  ) as Record<string, any>;
  const options = {
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
    commandRunId: finalizerPlan.commandRunId,
    invocationSequence: finalizerPlan.invocationSequence,
    finalizationRunId: fixture.context.finalizationRunId,
    transactionRoot: fixture.transactionRoot,
    failureRoot: fixture.failureRoot,
    finalizationReceipt: fixture.finalizationReceiptPath,
    json: false,
  };
  return { fixture, commandReceipts, options };
}

function failurePaths(
  fixture: ReturnType<typeof createRecoveryFixture>,
  options: Record<string, any>
) {
  const invocation = `${options.invocationSequence}-${options.commandRunId}`;
  const root = path.join(
    fixture.failureRoot,
    fixture.context.transactionId,
    fixture.context.implementationAttemptId,
    fixture.context.finalizationRunId,
    invocation
  );
  return {
    block: path.join(root, 'block.receipt.json'),
    archive: path.join(root, 'failure-archive.json'),
  };
}

function mutateReceipt(
  receiptPath: string,
  mutation: (receipt: Record<string, any>) => void
): void {
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8')) as Record<
    string,
    any
  >;
  mutation(receipt);
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
}

function receiptForRole(
  receiptPaths: string[],
  role: string
): { path: string; receipt: Record<string, any> } {
  const match = receiptPaths
    .map((receiptPath) => ({
      path: receiptPath,
      receipt: JSON.parse(readFileSync(receiptPath, 'utf8')) as Record<
        string,
        any
      >,
    }))
    .find(({ receipt }) => receipt.commandId === role);
  if (!match) throw new Error(`missing command receipt for requested role: ${role}`);
  return match;
}

it('archives a blocked invocation without mutating success artifacts', async () => {
  const { fixture, commandReceipts, options } = await preparedFixture();
  try {
    const targetHash = fileHash(fixture.targetPath);
    const blockedOptions = {
      ...options,
      commandReceipts: [
        commandReceipts[0],
        commandReceipts[0],
        ...commandReceipts.slice(1),
      ],
    };
    const paths = failurePaths(fixture, blockedOptions);

    expect(
      await requirementsContractRecoveryFinalizeCommand(blockedOptions)
    ).toBe(1);
    expect(existsSync(paths.block)).toBe(true);
    expect(existsSync(paths.archive)).toBe(true);
    expect(existsSync(fixture.finalizationReceiptPath)).toBe(false);
    expect(fileHash(fixture.targetPath)).toBe(targetHash);

    const block = JSON.parse(readFileSync(paths.block, 'utf8')) as Record<
      string,
      any
    >;
    expect(block.decision).toBe('block');
    expect(block.passAuthority).toBe(false);
    expect(block.outcome).toBe('blocked');
    expect(block.failureArchive.hash).toBe(fileHash(paths.archive));

    const blockHash = fileHash(paths.block);
    const archiveHash = fileHash(paths.archive);
    expect(
      await requirementsContractRecoveryFinalizeCommand(blockedOptions)
    ).toBe(1);
    expect(fileHash(paths.block)).toBe(blockHash);
    expect(fileHash(paths.archive)).toBe(archiveHash);
  } finally {
    fixture.cleanup();
  }
}, 60_000);

it.each([
  {
    name: 'publication before process exit beyond the allowed clock skew',
    mutation(receipt: Record<string, any>) {
      receipt.publication.publishedAt = '2026-07-12T23:59:58.999Z';
    },
  },
  {
    name: 'readback before publication beyond the allowed clock skew',
    mutation(receipt: Record<string, any>) {
      receipt.publication.readbackAt = '2026-07-12T23:59:59.099Z';
    },
  },
])('rejects $name', async ({ mutation }) => {
  const { fixture, commandReceipts, options } = await preparedFixture();
  try {
    mutateReceipt(commandReceipts[0], mutation);
    const targetHash = fileHash(fixture.targetPath);

    await expect(
      finalizeRequirementsContractRecoveryLineageReceipt(options)
    ).rejects.toThrow(/publication timestamp order is invalid/u);
    expect(fileHash(fixture.targetPath)).toBe(targetHash);
    expect(existsSync(fixture.finalizationReceiptPath)).toBe(false);
  } finally {
    fixture.cleanup();
  }
}, 60_000);

it.each([
  {
    name: 'executor identity',
    expected: /attempt-plan execution identity mismatch/u,
    mutation(receipt: Record<string, any>) {
      receipt.executorIdentity.id = 'substituted-executor';
    },
  },
  {
    name: 'host identity',
    expected: /execution identity is invalid/u,
    mutation(receipt: Record<string, any>) {
      receipt.hostIdentity.architecture = 'substituted-architecture';
    },
  },
  {
    name: 'working directory',
    expected: /execution identity is invalid/u,
    mutation(receipt: Record<string, any>) {
      receipt.cwd = path.join(receipt.cwd, 'substituted-cwd');
    },
  },
  {
    name: 'input snapshot hash',
    expected: /inputSnapshotHash mismatch/u,
    mutation(receipt: Record<string, any>) {
      receipt.inputSnapshotHash = `sha256:${'1'.repeat(64)}`;
    },
  },
  {
    name: 'contract hash',
    expected: /contractHash mismatch/u,
    mutation(receipt: Record<string, any>) {
      receipt.contractHash = `sha256:${'2'.repeat(64)}`;
    },
  },
  {
    name: 'invocation sequence',
    expected: /not attempt-plan-derived/u,
    mutation(receipt: Record<string, any>) {
      receipt.invocationSequence += 1;
    },
  },
])('rejects a substituted $name', async ({ expected, mutation }) => {
  const { fixture, commandReceipts, options } = await preparedFixture();
  try {
    mutateReceipt(commandReceipts[0], mutation);
    const targetHash = fileHash(fixture.targetPath);

    await expect(
      finalizeRequirementsContractRecoveryLineageReceipt(options)
    ).rejects.toThrow(expected);
    expect(fileHash(fixture.targetPath)).toBe(targetHash);
    expect(existsSync(fixture.finalizationReceiptPath)).toBe(false);
  } finally {
    fixture.cleanup();
  }
});

it.each([
  {
    name: 'child starts before the outer process beyond clock skew',
    mutation(receipt: Record<string, any>) {
      receipt.orderedChildren[0].startedAt = '2026-07-12T23:59:57.999Z';
    },
  },
  {
    name: 'child ends after the outer process beyond clock skew',
    mutation(receipt: Record<string, any>) {
      receipt.orderedChildren[0].endedAt = '2026-07-13T00:00:03.001Z';
    },
  },
  {
    name: 'later child starts before its predecessor beyond clock skew',
    mutation(receipt: Record<string, any>) {
      receipt.orderedChildren[1].startedAt = '2026-07-12T23:59:58.899Z';
    },
  },
])('rejects when a compound $name', async ({ mutation }) => {
  const { fixture, commandReceipts, options } = await preparedFixture();
  try {
    const compound = receiptForRole(commandReceipts, fixture.roles.bootstrap);
    mutation(compound.receipt);
    writeFileSync(
      compound.path,
      `${JSON.stringify(compound.receipt, null, 2)}\n`,
      'utf8'
    );
    const targetHash = fileHash(fixture.targetPath);

    await expect(
      finalizeRequirementsContractRecoveryLineageReceipt(options)
    ).rejects.toThrow(/child timestamp order is invalid/u);
    expect(fileHash(fixture.targetPath)).toBe(targetHash);
    expect(existsSync(fixture.finalizationReceiptPath)).toBe(false);
  } finally {
    fixture.cleanup();
  }
});

it('rejects a child output whose fresh readback hash differs', async () => {
  const { fixture, commandReceipts, options } = await preparedFixture();
  try {
    const compound = receiptForRole(commandReceipts, fixture.roles.bootstrap);
    compound.receipt.orderedChildren[0].stdoutHash = `sha256:${'3'.repeat(64)}`;
    writeFileSync(
      compound.path,
      `${JSON.stringify(compound.receipt, null, 2)}\n`,
      'utf8'
    );
    const targetHash = fileHash(fixture.targetPath);

    await expect(
      finalizeRequirementsContractRecoveryLineageReceipt(options)
    ).rejects.toThrow(/child stdoutPath readback mismatch/u);
    expect(fileHash(fixture.targetPath)).toBe(targetHash);
    expect(existsSync(fixture.finalizationReceiptPath)).toBe(false);
  } finally {
    fixture.cleanup();
  }
});

it('rejects a receipt whose argv hash does not match its exact argv', async () => {
  const { fixture, commandReceipts, options } = await preparedFixture();
  try {
    const receipt = JSON.parse(
      readFileSync(commandReceipts[0], 'utf8')
    ) as Record<string, any>;
    receipt.argvHash = `sha256:${'0'.repeat(64)}`;
    writeFileSync(
      commandReceipts[0],
      `${JSON.stringify(receipt, null, 2)}\n`,
      'utf8'
    );
    const targetHash = fileHash(fixture.targetPath);

    await expect(
      finalizeRequirementsContractRecoveryLineageReceipt(options)
    ).rejects.toThrow(/execution identity is invalid/u);
    expect(fileHash(fixture.targetPath)).toBe(targetHash);
    expect(existsSync(fixture.finalizationReceiptPath)).toBe(false);
  } finally {
    fixture.cleanup();
  }
});

it('rejects a receipt whose substituted argv has a matching self hash', async () => {
  const { fixture, commandReceipts, options } = await preparedFixture();
  try {
    const receipt = JSON.parse(
      readFileSync(commandReceipts[0], 'utf8')
    ) as Record<string, any>;
    receipt.argv = [...receipt.argv, '--substituted'];
    receipt.argvHash = sha256(canonical(receipt.argv));
    writeFileSync(
      commandReceipts[0],
      `${JSON.stringify(receipt, null, 2)}\n`,
      'utf8'
    );
    const targetHash = fileHash(fixture.targetPath);

    await expect(
      finalizeRequirementsContractRecoveryLineageReceipt(options)
    ).rejects.toThrow(/attempt-plan argv mismatch/u);
    expect(fileHash(fixture.targetPath)).toBe(targetHash);
    expect(existsSync(fixture.finalizationReceiptPath)).toBe(false);
  } finally {
    fixture.cleanup();
  }
});

it('rejects a compound receipt with a missing ordered child', async () => {
  const { fixture, commandReceipts, options } = await preparedFixture();
  try {
    const bootstrapReceipt = commandReceipts
      .map((receiptPath) => ({
        receiptPath,
        receipt: JSON.parse(readFileSync(receiptPath, 'utf8')) as Record<
          string,
          any
        >,
      }))
      .find(({ receipt }) => receipt.commandId === fixture.roles.bootstrap);
    expect(bootstrapReceipt).toBeDefined();
    bootstrapReceipt!.receipt.orderedChildren =
      bootstrapReceipt!.receipt.orderedChildren.slice(0, -1);
    writeFileSync(
      bootstrapReceipt!.receiptPath,
      `${JSON.stringify(bootstrapReceipt!.receipt, null, 2)}\n`,
      'utf8'
    );
    const targetHash = fileHash(fixture.targetPath);

    await expect(
      finalizeRequirementsContractRecoveryLineageReceipt(options)
    ).rejects.toThrow(/attempt-plan ordered child mismatch/u);
    expect(fileHash(fixture.targetPath)).toBe(targetHash);
    expect(existsSync(fixture.finalizationReceiptPath)).toBe(false);
  } finally {
    fixture.cleanup();
  }
});

it('rejects a receipt with acceptance bindings outside schema authority', async () => {
  const { fixture, commandReceipts, options } = await preparedFixture();
  try {
    const receipt = JSON.parse(
      readFileSync(commandReceipts[0], 'utf8')
    ) as Record<string, any>;
    receipt.acceptanceRefs = ['unbound-acceptance'];
    writeFileSync(
      commandReceipts[0],
      `${JSON.stringify(receipt, null, 2)}\n`,
      'utf8'
    );
    const targetHash = fileHash(fixture.targetPath);

    await expect(
      finalizeRequirementsContractRecoveryLineageReceipt(options)
    ).rejects.toThrow(/acceptance binding mismatch/u);
    expect(fileHash(fixture.targetPath)).toBe(targetHash);
    expect(existsSync(fixture.finalizationReceiptPath)).toBe(false);
  } finally {
    fixture.cleanup();
  }
});

it('rejects a retry sequence that is not append-only', async () => {
  const { fixture, options } = await preparedFixture();
  try {
    await expect(
      finalizeRequirementsContractRecoveryLineageReceipt({
        ...options,
        commandRunId: 'RUN-retry-sequence-gap',
        invocationSequence: options.invocationSequence + 2,
      })
    ).rejects.toThrow(/sequence is not append-only/u);
  } finally {
    fixture.cleanup();
  }
});
