import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { dispatchPlanAction } from '../../packages/bmad-speckit/src/main-agent/actions/dispatch-plan';
import { implementationReadinessGateAction } from '../../packages/bmad-speckit/src/main-agent/actions/implementation-readiness-gate';
import { promptTransactionPublishAction } from '../../packages/bmad-speckit/src/main-agent/actions/prompt-transaction-publish';
import { compiledPromptRunnerFor } from './helpers/prompt-transaction-compiled-runner-fixture';
import { materializePromptPublicationFixture } from './helpers/prompt-transaction-publication-fixture';

function runtimeContext(root: string, action: string) {
  return {
    action,
    cwd: root,
    args: {},
    rawArgv: [action],
    json: true,
  };
}

describe('main-agent stable lifecycle actions', () => {
  it('fails readiness closed when the authoritative requirement record input is missing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'stable-readiness-action-'));
    try {
      const result = implementationReadinessGateAction(
        runtimeContext(root, 'implementation-readiness-gate')
      );

      expect(result.exitCode).toBeGreaterThan(0);
      expect(result.status).not.toBe('package_runtime_ready');
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: expect.stringMatching(/readiness|source_authority/iu),
          }),
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('publishes the governed prompt transaction through the canonical Main Agent action', async () => {
    const fixture = materializePromptPublicationFixture();
    try {
      const result = await promptTransactionPublishAction(
        {
          ...runtimeContext(fixture.root, 'requirements-contract-prompt-transaction-publish'),
          args: {
            requirementRecord: fixture.paths.recordPath,
            attemptContext: fixture.paths.attemptContext,
          },
        },
        {
          runCompiledPrompt: compiledPromptRunnerFor(fixture),
        }
      );

      expect(
        result.exitCode,
        JSON.stringify({
          status: result.status,
          errors: result.errors,
          result: result.result,
        })
      ).toBe(0);
      expect(result.status).toBe('prompt_transaction_published');
      expect(result.result).toMatchObject({
        decision: 'PASS',
        transactionId: fixture.identity.transactionId,
        implementationAttemptId: fixture.identity.implementationAttemptId,
      });
      expect(
        existsSync(
          path.join(
            fixture.root,
            'docs',
            'plans',
            'evidence',
            'loop-engineering-remediation',
            'current-dispatch-pointer-receipt.json'
          )
        )
      ).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });

  it('removes the direct compiled runner production action and routes the canonical publisher', () => {
    const runtimeSource = readFileSync(
      path.resolve('packages/bmad-speckit/src/main-agent/runtime.ts'),
      'utf8'
    );
    const compiledActionPath = path.resolve(
      'packages/bmad-speckit/src/main-agent/actions/compiled-prompt-runner.ts'
    );

    expect(existsSync(compiledActionPath)).toBe(false);
    expect(runtimeSource).not.toMatch(/compiledPromptRunnerAction|compiled-prompt-runner/u);
    expect(runtimeSource).toMatch(
      /await promptTransactionPublishAction\(context\)/u
    );
    expect(runtimeSource).toMatch(
      /emitPackageActionResponse\(\s*context,\s*implementationReadinessGateAction\(context\)/u
    );
    expect(runtimeSource).toMatch(
      /emitPackageActionResponse\(\s*context,\s*dispatchPlanAction\(context,\s*runtime\.state\)/u
    );
  });

  it('does not authorize dispatch before implementation readiness is verified PASS', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'stable-dispatch-action-'));
    try {
      const requirementSetId = path.basename(root);
      const result = dispatchPlanAction(runtimeContext(root, 'dispatch-plan'), {
        active: {
          recordId: requirementSetId,
          requirementSetId,
        },
        activeRecord: {
          recordId: requirementSetId,
          requirementSetId,
          currentAttemptId: `${requirementSetId}-attempt`,
          currentMentalModel: 'implementation_readiness',
          sixModelResults: {
            implementation_readiness: {
              status: 'blocked',
            },
          },
        },
      });

      expect(result.exitCode).toBeGreaterThan(0);
      expect(result.status).toBe('dispatch_blocked');
      expect(result.dispatchInstruction).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
