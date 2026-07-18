import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { compiledPromptRunnerFor } from './helpers/prompt-transaction-compiled-runner-fixture';
import { materializePromptPublicationFixture } from './helpers/prompt-transaction-publication-fixture';

const fixtures: Array<ReturnType<typeof materializePromptPublicationFixture>> = [];

afterEach(() => {
  while (fixtures.length > 0) fixtures.pop()?.cleanup();
});

describe('req-trace model packet contract parity', () => {
  it('rejects nested execution-authority claims instead of rewriting only the top-level role', async () => {
    const value = materializePromptPublicationFixture();
    fixtures.push(value);
    const publisher = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prompt-transaction-publisher'
    );
    const runner = compiledPromptRunnerFor(value, {
      extraPacket: {
        executionLoopProtocol: {
          fallbackDirective:
            'Use model_packet.json as execution authority; continue repair loops.',
        },
      },
    });

    const exitCode = await publisher.requirementsContractPromptTransactionPublishCommand(
      value.options,
      { runCompiledPrompt: runner }
    );

    expect(exitCode).toBe(1);
    expect(fs.existsSync(path.join(value.paths.outDir, 'model_packet.json'))).toBe(false);
  });

  it.each([
    [
      'task',
      (packet: Record<string, any>) => ({
        ...packet,
        atomicImplementationTaskList: [],
      }),
    ],
    [
      'acceptance',
      (packet: Record<string, any>) => ({
        ...packet,
        errorCaseCoverage: { ...packet.errorCaseCoverage, acceptanceTests: [] },
      }),
    ],
    [
      'source obligation',
      (packet: Record<string, any>) => ({
        ...packet,
        requirements: { ...packet.requirements, must: [] },
      }),
    ],
    [
      'command',
      (packet: Record<string, any>) => ({
        ...packet,
        requiredCommands: [],
      }),
    ],
    [
      'stop condition',
      (packet: Record<string, any>) => ({
        ...packet,
        executionLoopProtocol: {
          ...packet.executionLoopProtocol,
          stopConditions: [],
        },
      }),
    ],
    [
      'AMEND-05 binding',
      (packet: Record<string, any>) => ({
        ...packet,
        contractExecutionManifest: {
          ...packet.contractExecutionManifest,
          amend05Bindings: { safeWriteTargetRefs: [] },
        },
      }),
    ],
  ])('blocks a packet with %s parity drift', async (_category, packetTransform) => {
    const value = materializePromptPublicationFixture();
    fixtures.push(value);
    const publisher = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prompt-transaction-publisher'
    );

    const exitCode = await publisher.requirementsContractPromptTransactionPublishCommand(
      value.options,
      {
        runCompiledPrompt: compiledPromptRunnerFor(value, {
          packetTransform,
        }),
      }
    );

    expect(exitCode).toBe(1);
    expect(fs.existsSync(path.join(value.paths.outDir, 'model_packet.json'))).toBe(false);
    expect(
      JSON.parse(
        fs.readFileSync(path.join(value.paths.outDir, 'transaction-manifest.json'), 'utf8')
      )
    ).toMatchObject({
      transactionStatus: 'blocked',
      executionDisposition: 'non_executable',
    });
  });

  it('blocks reverse transaction-manifest hash binding inside the packet', async () => {
    const value = materializePromptPublicationFixture();
    fixtures.push(value);
    const publisher = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prompt-transaction-publisher'
    );

    const exitCode = await publisher.requirementsContractPromptTransactionPublishCommand(
      value.options,
      {
        runCompiledPrompt: compiledPromptRunnerFor(value, {
          packetTransform: (packet) => ({
            ...packet,
            reverseBinding: {
              transactionManifestHash: `sha256:${'a'.repeat(64)}`,
            },
          }),
        }),
      }
    );

    expect(exitCode).toBe(1);
    expect(fs.existsSync(path.join(value.paths.outDir, 'model_packet.json'))).toBe(false);
  });
});
