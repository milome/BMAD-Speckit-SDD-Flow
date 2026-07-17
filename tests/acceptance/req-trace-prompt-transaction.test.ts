import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { compiledPromptRunnerFor } from './helpers/prompt-transaction-compiled-runner-fixture';
import { materializePromptPublicationFixture } from './helpers/prompt-transaction-publication-fixture';

const fixtures: Array<ReturnType<typeof materializePromptPublicationFixture>> = [];

afterEach(() => {
  while (fixtures.length > 0) fixtures.pop()?.cleanup();
});

describe('req-trace prompt transaction exact publication', () => {
  it('rejects any extra active output outside the applicability-aware set', async () => {
    const value = materializePromptPublicationFixture();
    fixtures.push(value);
    const publisher = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prompt-transaction-publisher'
    );

    const exitCode = await publisher.requirementsContractPromptTransactionPublishCommand(
      value.options,
      {
        runCompiledPrompt: compiledPromptRunnerFor(value, {
          extraOutputName: 'unexpected-output.json',
        }),
      }
    );

    expect(exitCode).toBe(1);
    expect(fs.existsSync(path.join(value.paths.outDir, 'unexpected-output.json'))).toBe(false);
  });

  it('binds the actual installed runner and capability observation to the transaction', async () => {
    const value = materializePromptPublicationFixture();
    fixtures.push(value);
    const publisher = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prompt-transaction-publisher'
    );

    const exitCode = await publisher.requirementsContractPromptTransactionPublishCommand(
      value.options,
      {
        runCompiledPrompt: compiledPromptRunnerFor(value, {
          runnerPath: value.paths.installedRunnerPath,
        }),
      }
    );

    expect(exitCode).toBe(0);
    const capability = JSON.parse(
      fs.readFileSync(
        path.join(value.paths.outDir, 'observations', 'consumer-cli-capability.json'),
        'utf8'
      )
    );
    expect(capability).toMatchObject({
      transactionId: value.identity.transactionId,
      implementationAttemptId: value.identity.implementationAttemptId,
      installedCliRef: {
        path: value.paths.installedCliPath.replace(/\\/gu, '/'),
      },
      readbackVerified: true,
    });
  });
});
