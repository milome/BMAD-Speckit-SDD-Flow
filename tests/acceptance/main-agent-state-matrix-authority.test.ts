import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  buildMainAgentDispatchInstruction,
  resolveMainAgentOrchestrationSurface,
  runMainAgentAutomaticLoop,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import { requirementsContractPromptTransactionPublishCommand } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prompt-transaction-publisher';
import {
  cleanupRequirementWorkspace,
  materializeRequirementFixture,
} from '../helpers/requirement-fixture-runtime';
import { prepareAuditDispatchRuntime } from './helpers/prompt-transaction-audit-dispatch-fixture';
import { compiledPromptRunnerFor } from './helpers/prompt-transaction-compiled-runner-fixture';
import { publishImplementationPromptFixture } from './helpers/prompt-transaction-implementation-publication-fixture';
import { materializePromptPublicationFixture } from './helpers/prompt-transaction-publication-fixture';

describe('Main Agent state matrix authority', () => {
  it('dispatches audit only after execution_closure pass and closeout only after audit_review pass', async () => {
    const auditFixture = materializePromptPublicationFixture();
    try {
      auditFixture.options.currentDispatchPointer = path.join(
        auditFixture.root,
        'docs',
        'plans',
        'evidence',
        'loop-engineering-remediation',
        'current-dispatch-pointer-receipt.json'
      );
      prepareAuditDispatchRuntime(auditFixture);
      let publishOutput = '';
      const stdout = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
        publishOutput += String(chunk);
        return true;
      });
      const publishCode = await requirementsContractPromptTransactionPublishCommand(
        auditFixture.options,
        {
          runCompiledPrompt: compiledPromptRunnerFor(auditFixture, {
            extraPacket: {
              packetId: auditFixture.identity.implementationAttemptId,
            },
          }),
        }
      ).finally(() => stdout.mockRestore());
      expect(publishCode, publishOutput).toBe(0);

      const instruction = buildMainAgentDispatchInstruction({
        projectRoot: auditFixture.root,
        recordId: auditFixture.authority.recordId,
        requirementSetId: auditFixture.identity.requirementSetId,
        runId: auditFixture.identity.implementationAttemptId,
        flow: 'standalone_tasks',
        stage: 'implement',
        host: 'codex',
        hydratePacket: true,
        preferredPacketId: 'audit-current',
      });
      expect(instruction?.taskType).toBe('audit');

      const closeoutFixture = materializeRequirementFixture({
        currentMentalModel: 'audit_review',
        sixModelResults: {
          requirement_confirmation: { status: 'pass' },
          architecture_confirmation: { status: 'pass' },
          implementation_readiness: { status: 'pass' },
          execution_closure: { status: 'pass' },
          audit_review: { status: 'pass' },
        },
      });
      try {
        const closeoutSurface = resolveMainAgentOrchestrationSurface({
          projectRoot: closeoutFixture.root,
          recordId: closeoutFixture.recordId,
          requirementSetId: closeoutFixture.requirementSetId,
          runId: closeoutFixture.runId,
          flow: 'standalone_tasks',
          stage: 'implement',
        });
        expect(closeoutSurface.mainAgentNextAction).toBe('run_closeout');
        expect(
          buildMainAgentDispatchInstruction({
            projectRoot: closeoutFixture.root,
            recordId: closeoutFixture.recordId,
            requirementSetId: closeoutFixture.requirementSetId,
            runId: closeoutFixture.runId,
            flow: 'standalone_tasks',
            stage: 'implement',
          })
        ).toBeNull();
      } finally {
        cleanupRequirementWorkspace(closeoutFixture.root);
      }

      const { fixture: blockedLoopFixture } = await publishImplementationPromptFixture({
        goalMode: 'direct_prompt',
        configureRecord: (record, fixture) => ({
          ...record,
          transactionId: fixture.identity.transactionId,
        }),
      });
      try {
        const result = runMainAgentAutomaticLoop({
          projectRoot: blockedLoopFixture.root,
          recordId: blockedLoopFixture.authority.recordId,
          requirementSetId: blockedLoopFixture.identity.requirementSetId,
          runId: blockedLoopFixture.identity.implementationAttemptId,
          flow: 'standalone_tasks',
          stage: 'implement',
        });
        expect(result.status).toBe('blocked');
        expect(result.finalSurface.mainAgentNextAction).toBe('dispatch_implement');
        const matrixDir = path.join(
          blockedLoopFixture.root,
          '_bmad-output',
          'runtime',
          'requirement-records',
          blockedLoopFixture.authority.recordId,
          'decision-matrix'
        );
        expect(fs.existsSync(matrixDir)).toBe(true);
      } finally {
        blockedLoopFixture.cleanup();
      }
    } finally {
      auditFixture.cleanup();
    }
  });
});
