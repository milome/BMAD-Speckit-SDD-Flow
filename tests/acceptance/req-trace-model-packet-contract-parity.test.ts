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
});
