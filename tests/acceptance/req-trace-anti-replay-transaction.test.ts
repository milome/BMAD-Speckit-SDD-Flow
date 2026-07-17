import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { compiledPromptRunnerFor } from './helpers/prompt-transaction-compiled-runner-fixture';
import {
  materializePromptPublicationFixture,
  writeJson,
} from './helpers/prompt-transaction-publication-fixture';

const fixtures: Array<ReturnType<typeof materializePromptPublicationFixture>> = [];
const FIXTURE_AUTHORITY_SURFACES = [
  path.resolve('tests/acceptance/req-trace-anti-replay-transaction.test.ts'),
  path.resolve('tests/acceptance/req-trace-model-packet-contract-parity.test.ts'),
  path.resolve('tests/acceptance/req-trace-prompt-transaction.test.ts'),
  path.resolve(
    'tests/acceptance/requirements-contract-prompt-transaction-production-publication.test.ts'
  ),
  path.resolve('tests/acceptance/helpers/prompt-transaction-publication-fixture.ts'),
  path.resolve('tests/acceptance/helpers/prompt-transaction-compiled-runner-fixture.ts'),
] as const;

function directFixtureAuthorityLiterals(source: string): string[] {
  const patterns = [
    /\b(?:lockId|transactionId|implementationAttemptId|requirementSetId|recordId|bootstrapId|consumerId|projectName)\s*[:=]\s*['"][^'"]+['"]/gu,
    /\b(?:acquiredAt|leaseExpiresAt|startedAt|completedAt)\s*:\s*['"]\d{4}-[^'"]+['"]/gu,
    /\bprocessId\s*:\s*\d+/gu,
  ];
  return patterns.flatMap((pattern) => source.match(pattern) ?? []);
}

afterEach(() => {
  while (fixtures.length > 0) fixtures.pop()?.cleanup();
});

function fixture() {
  const value = materializePromptPublicationFixture();
  fixtures.push(value);
  return value;
}

describe('req-trace prompt transaction anti-replay and lock ownership', () => {
  it('derives fixture identity, clock, and owner state from one authority instead of literals', () => {
    const violations = FIXTURE_AUTHORITY_SURFACES.flatMap((surface) =>
      directFixtureAuthorityLiterals(fs.readFileSync(surface, 'utf8')).map(
        (literal) => `${path.relative(process.cwd(), surface)}:${literal}`
      )
    );

    expect(violations).toEqual([]);
  });

  it('blocks a live same-host lock before invoking the generator', async () => {
    const value = fixture();
    const lockPath = path.join(value.paths.outDir, '.prompt-transaction.lock');
    writeJson(lockPath, {
      schemaVersion: 'requirements-contract-prompt-transaction-lock/v1',
      lockId: value.authority.lock.liveLockId,
      transactionId: value.authority.lock.liveTransactionId,
      host: value.authority.lock.host,
      processId: value.authority.lock.liveOwnerProcessId,
      acquiredAt: value.authority.lock.liveAcquiredAt,
      leaseExpiresAt: value.authority.lock.liveLeaseExpiresAt,
    });
    const runner = compiledPromptRunnerFor(value);
    const publisher = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prompt-transaction-publisher'
    );

    const exitCode = await publisher.requirementsContractPromptTransactionPublishCommand(
      value.options,
      {
        runCompiledPrompt: runner,
        lockDeps: {
          now: () => value.authority.clock.observedAt,
          hostName: () => value.authority.lock.host,
          createLockId: () => value.authority.lock.currentLockId,
          isProcessAlive: () => true,
        },
      }
    );

    expect(exitCode).toBe(1);
    expect(runner).not.toHaveBeenCalled();
    expect(fs.existsSync(lockPath)).toBe(true);
  });

  it('recovers an expired dead-owner lock by immutable stale-lock rename', async () => {
    const value = fixture();
    const lockPath = path.join(value.paths.outDir, '.prompt-transaction.lock');
    writeJson(lockPath, {
      schemaVersion: 'requirements-contract-prompt-transaction-lock/v1',
      lockId: value.authority.lock.staleLockId,
      transactionId: value.authority.lock.staleTransactionId,
      host: value.authority.lock.host,
      processId: value.authority.lock.ownerProcessId,
      acquiredAt: value.authority.lock.staleAcquiredAt,
      leaseExpiresAt: value.authority.lock.staleLeaseExpiresAt,
    });
    const publisher = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prompt-transaction-publisher'
    );

    const exitCode = await publisher.requirementsContractPromptTransactionPublishCommand(
      value.options,
      {
        runCompiledPrompt: compiledPromptRunnerFor(value, {
          runnerPath: value.paths.installedRunnerPath,
        }),
        lockDeps: {
          now: () => value.authority.clock.observedAt,
          hostName: () => value.authority.lock.host,
          createLockId: () => value.authority.lock.currentLockId,
          isProcessAlive: () => false,
        },
      }
    );

    expect(exitCode).toBe(0);
    expect(fs.existsSync(lockPath)).toBe(false);
    expect(
      fs.existsSync(
        path.join(
          value.paths.outDir,
          `.prompt-transaction.lock.stale.${value.authority.lock.staleLockId}`
        )
      )
    ).toBe(true);
    const evidence = JSON.parse(fs.readFileSync(value.options.evidenceOut, 'utf8'));
    expect(evidence.promptTransactionStaleLockRecoveryCases).toEqual([
      {
        staleLockId: value.authority.lock.staleLockId,
        staleTransactionId: value.authority.lock.staleTransactionId,
        archivePath: path
          .join(
            value.paths.outDir,
            `.prompt-transaction.lock.stale.${value.authority.lock.staleLockId}`
          )
          .replace(/\\/gu, '/'),
        recoveredByLockId: value.authority.lock.currentLockId,
        recoveredByTransactionId: value.identity.transactionId,
      },
    ]);
    expect(evidence.promptTransactionStaleLockRecoveryMismatchCount).toBe(0);
  });

  it('blocks a stale archive when no recovery authority created it', async () => {
    const value = fixture();
    const publisher = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prompt-transaction-publisher'
    );

    const exitCode = await publisher.requirementsContractPromptTransactionPublishCommand(
      value.options,
      {
        runCompiledPrompt: compiledPromptRunnerFor(value, {
          extraOutputName: `.prompt-transaction.lock.stale.${value.authority.lock.staleLockId}`,
        }),
        lockDeps: {
          now: () => value.authority.clock.observedAt,
          hostName: () => value.authority.lock.host,
          processId: () => value.authority.lock.liveOwnerProcessId,
          createLockId: () => value.authority.lock.currentLockId,
        },
      }
    );

    expect(exitCode).toBe(1);
    expect(fs.existsSync(value.options.evidenceOut)).toBe(false);
  });

  it('blocks an extra stale archive beyond the recovered lock identity', async () => {
    const value = fixture();
    const lockPath = path.join(value.paths.outDir, '.prompt-transaction.lock');
    writeJson(lockPath, {
      schemaVersion: 'requirements-contract-prompt-transaction-lock/v1',
      lockId: value.authority.lock.staleLockId,
      transactionId: value.authority.lock.staleTransactionId,
      host: value.authority.lock.host,
      processId: value.authority.lock.ownerProcessId,
      acquiredAt: value.authority.lock.staleAcquiredAt,
      leaseExpiresAt: value.authority.lock.staleLeaseExpiresAt,
    });
    const publisher = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prompt-transaction-publisher'
    );

    const exitCode = await publisher.requirementsContractPromptTransactionPublishCommand(
      value.options,
      {
        runCompiledPrompt: compiledPromptRunnerFor(value, {
          extraOutputName: `.prompt-transaction.lock.stale.${value.authority.lock.currentLockId}`,
        }),
        lockDeps: {
          now: () => value.authority.clock.observedAt,
          hostName: () => value.authority.lock.host,
          processId: () => value.authority.lock.liveOwnerProcessId,
          createLockId: () => value.authority.lock.currentLockId,
          isProcessAlive: () => false,
        },
      }
    );

    expect(exitCode).toBe(1);
    expect(fs.existsSync(value.options.evidenceOut)).toBe(false);
  });

  it('turns PASS to BLOCK by quarantining the stale transaction identity', async () => {
    const value = fixture();
    const publisher = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prompt-transaction-publisher'
    );
    expect(
      await publisher.requirementsContractPromptTransactionPublishCommand(value.options, {
        runCompiledPrompt: compiledPromptRunnerFor(value),
      })
    ).toBe(0);

    expect(
      await publisher.requirementsContractPromptTransactionPublishCommand(value.options, {
        runCompiledPrompt: compiledPromptRunnerFor(value),
      })
    ).toBe(1);

    const quarantine = path.join(
      value.paths.outDir,
      '.quarantine',
      value.identity.transactionId
    );
    expect(fs.existsSync(path.join(quarantine, 'model_packet.json'))).toBe(true);
    expect(fs.existsSync(path.join(value.paths.outDir, 'model_packet.json'))).toBe(false);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(value.paths.outDir, 'transaction-manifest.json'), 'utf8')
    );
    const receipt = JSON.parse(
      fs.readFileSync(path.join(value.paths.outDir, 'audit_receipt.json'), 'utf8')
    );
    expect(manifest).toMatchObject({
      transactionStatus: 'blocked',
      executionDisposition: 'non_executable',
    });
    expect(receipt).toMatchObject({ decision: 'BLOCK' });
  });
});
