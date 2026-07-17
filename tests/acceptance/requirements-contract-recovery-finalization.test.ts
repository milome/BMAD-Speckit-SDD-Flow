import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import {
  finalizeRequirementsContractRecoveryLineageReceipt,
  requirementsContractRecoveryBootstrapCommand,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-recovery-bootstrap';
import {
  createRecoveryFixture,
  fileHash,
} from './helpers/requirements-contract-recovery-test-fixture';

async function publishProvisional(
  fixture: ReturnType<typeof createRecoveryFixture>
): Promise<void> {
  const exitCode = await requirementsContractRecoveryBootstrapCommand({
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
  expect(exitCode).toBe(0);
}

function finalizationOptions(
  fixture: ReturnType<typeof createRecoveryFixture>,
  commandReceipts: string[]
) {
  const finalizerPlan = Object.values(fixture.context.commandPlan).find(
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
    commandRunId: finalizerPlan.commandRunId,
    invocationSequence: finalizerPlan.invocationSequence,
    finalizationRunId: fixture.context.finalizationRunId,
    transactionRoot: fixture.transactionRoot,
    failureRoot: fixture.failureRoot,
    finalizationReceipt: fixture.finalizationReceiptPath,
    json: false,
  };
}

it('finalizes provisional lineage through schema-owned receipt roles and preimage CAS', async () => {
  const fixture = createRecoveryFixture();
  try {
    await publishProvisional(fixture);
    const expectedRoles = fixture.schema['x-finalizedCommandReceiptRoles'] as string[];
    const commandReceipts = expectedRoles.map((role) =>
      fixture.createCommandReceipt(role)
    );
    const targetPreimageHash = fileHash(fixture.targetPath);

    const result = await finalizeRequirementsContractRecoveryLineageReceipt(
      finalizationOptions(fixture, commandReceipts)
    );

    expect(result.decision).toBe('pass');
    expect(result.passAuthority).toBe(false);
    expect(result.outcome).toBe('committed');
    expect(fileHash(fixture.targetPath)).not.toBe(targetPreimageHash);
    expect(existsSync(fixture.finalizationReceiptPath)).toBe(true);

    const finalized = JSON.parse(
      readFileSync(fixture.targetPath, 'utf8')
    ) as Record<string, any>;
    const finalizationReceipt = JSON.parse(
      readFileSync(fixture.finalizationReceiptPath, 'utf8')
    ) as Record<string, any>;
    const finalizerPlan = Object.values(fixture.context.commandPlan).find(
      (entry: any) => entry.commandId === fixture.roles.finalizer
    ) as Record<string, any>;

    expect(finalized.state).toBe('finalized');
    expect(Object.keys(finalized.commandReceiptRefs).sort()).toEqual(
      [...expectedRoles].sort()
    );
    expect(finalized).not.toHaveProperty('pendingFinalization');
    expect(finalized).not.toHaveProperty('provisionalPublication');
    expect(finalizationReceipt.fixedTarget.finalHash).toBe(
      fileHash(fixture.targetPath)
    );
    expect(finalizationReceipt.fixedTarget.readbackHash).toBe(
      fileHash(fixture.targetPath)
    );
    expect(finalizationReceipt.commitCommandRunId).toBe(
      finalizerPlan.commandRunId
    );
    expect(finalizationReceipt.commitInvocationSequence).toBe(
      finalizerPlan.invocationSequence
    );
  } finally {
    fixture.cleanup();
  }
});

it('rejects duplicate and extra command receipt roles before target mutation', async () => {
  const fixture = createRecoveryFixture();
  try {
    await publishProvisional(fixture);
    const expectedRoles = fixture.schema['x-finalizedCommandReceiptRoles'] as string[];
    const commandReceipts = expectedRoles.map((role) =>
      fixture.createCommandReceipt(role)
    );
    const targetPreimageHash = fileHash(fixture.targetPath);

    await expect(
      finalizeRequirementsContractRecoveryLineageReceipt(
        finalizationOptions(fixture, [
          commandReceipts[0],
          commandReceipts[0],
          ...commandReceipts.slice(1),
        ])
      )
    ).rejects.toThrow(/duplicate command receipt role/u);
    expect(fileHash(fixture.targetPath)).toBe(targetPreimageHash);

    const extraReceipt = fixture.createCommandReceipt(fixture.roles.finalizer);
    await expect(
      finalizeRequirementsContractRecoveryLineageReceipt(
        finalizationOptions(fixture, [...commandReceipts, extraReceipt])
      )
    ).rejects.toThrow(/command receipt role set mismatch/u);
    expect(fileHash(fixture.targetPath)).toBe(targetPreimageHash);

    await expect(
      finalizeRequirementsContractRecoveryLineageReceipt(
        finalizationOptions(fixture, [...commandReceipts].reverse())
      )
    ).rejects.toThrow(/command receipt role order mismatch/u);
    expect(fileHash(fixture.targetPath)).toBe(targetPreimageHash);
    expect(existsSync(fixture.finalizationReceiptPath)).toBe(false);
  } finally {
    fixture.cleanup();
  }
});
