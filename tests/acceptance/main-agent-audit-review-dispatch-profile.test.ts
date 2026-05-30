import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildMainAgentDispatchInstruction } from '../../scripts/main-agent-orchestration';
import {
  createExecutionPacket,
  type ExecutionPacket,
} from '../../scripts/orchestration-dispatch-contract';
import {
  cleanupRequirementWorkspace,
  materializeRequirementFixture,
  writeCompiledImplementPacket,
} from '../helpers/requirement-fixture-runtime';

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

describe('Main Agent audit review dispatch profile contract', () => {
  it('builds a real audit dispatch packet from current compiled prompt evidence', () => {
    const fixture = materializeRequirementFixture({
      currentMentalModel: 'execution_closure',
      sixModelResults: {
        requirement_confirmation: { status: 'pass' },
        architecture_confirmation: { status: 'pass' },
        implementation_readiness: { status: 'pass' },
        execution_closure: { status: 'pass' },
      },
    });
    try {
      writeCompiledImplementPacket({ root: fixture.root, fixture, packetId: 'implement-current' });

      const instruction = buildMainAgentDispatchInstruction({
        projectRoot: fixture.root,
        recordId: fixture.recordId,
        requirementSetId: fixture.requirementSetId,
        runId: fixture.runId,
        flow: 'standalone_tasks',
        stage: 'implement',
        host: 'codex',
        hydratePacket: true,
        preferredPacketId: 'audit-current',
      });

      expect(instruction).toMatchObject({
        taskType: 'audit',
        nextAction: 'dispatch_review',
        packetId: 'audit-current',
      });
      const packet = readJson<ExecutionPacket>(instruction!.packetPath);
      expect(packet.taskType).toBe('audit');
      expect(packet.authorityMode).toBe('compiled_implementation_confirmation');
      expect(packet.compiledPromptRef).toBeTruthy();
      expect(packet.legacyPromptFallbackReason).toBeNull();
      expect(packet.auditExecutionProfile).toBeTruthy();
      expect(packet.auditTriadExecutionPlanRef).toBeTruthy();
      expect(packet.auditExecutionProfile?.selfReviewDenied).toBe(true);
      expect(packet.auditExecutionProfile?.runAuditorHostArgs.artifactPath).toBe(
        packet.compiledPromptRef?.modelPacketPath
      );
      expect(packet.auditExecutionProfile?.currentAttemptBinding).toMatchObject({
        recordId: fixture.recordId,
        requirementSetId: fixture.requirementSetId,
        attemptId: 'audit-current',
        sourceDocumentHash: fixture.sourceDocumentHash,
        implementationConfirmationHash: fixture.implementationConfirmationHash,
        modelPacketHash: packet.compiledPromptRef?.modelPacketHash,
        currentAttemptHash: packet.auditTriadExecutionPlanRef?.currentAttemptHash,
        currentEvidenceHash: packet.auditTriadExecutionPlanRef?.currentEvidenceHash,
      });
      expect(packet.auditExecutionProfile?.perspectives).toEqual([
        'product_intent',
        'model_projection',
        'main_agent_execution',
      ]);
      const profilePath = path.join(
        fixture.root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        fixture.recordId,
        'audit-review',
        'audit-current',
        'audit-execution-profile-packet.json'
      );
      const triadPath = path.join(
        fixture.root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        fixture.recordId,
        'audit-triad',
        'audit-current',
        'audit-triad-execution-plan.json'
      );
      expect(fs.existsSync(profilePath)).toBe(true);
      expect(fs.existsSync(triadPath)).toBe(true);
      expect(packet.auditTriadExecutionPlanRef?.path).toBe(triadPath);
      const triad = readJson<{
        currentAttemptHash: string;
        currentEvidenceHash: string;
        subagents: Array<{
          perspectiveId: string;
          writeScope: string[];
          currentHashBinding: Record<string, string>;
        }>;
      }>(triadPath);
      expect(triad.subagents.map((item) => item.perspectiveId)).toEqual([
        'product_intent',
        'model_projection',
        'main_agent_execution',
      ]);
      expect(
        triad.subagents.every((item) =>
          item.writeScope.every((scope) => scope.includes('/reports/**'))
        )
      ).toBe(true);
      expect(packet.auditExecutionProfile?.currentAttemptBinding.currentEvidenceHash).toBe(
        triad.currentEvidenceHash
      );
      expect(packet.auditExecutionProfile?.currentAttemptBinding.currentAttemptHash).toBe(
        triad.currentAttemptHash
      );
      expect(
        triad.subagents.every(
          (item) =>
            item.currentHashBinding.currentEvidenceHash === triad.currentEvidenceHash &&
            item.currentHashBinding.currentAttemptHash === triad.currentAttemptHash
        )
      ).toBe(true);

      expect(() =>
        createExecutionPacket({
          ...packet,
          packetId: 'audit-new',
        })
      ).toThrow('auditExecutionProfile attemptId must match packetId');
      expect(() =>
        createExecutionPacket({
          ...packet,
          auditTriadExecutionPlanRef: {
            ...packet.auditTriadExecutionPlanRef!,
            attemptId: 'audit-old',
          },
        })
      ).toThrow('auditTriadExecutionPlanRef attemptId must match packetId');
      expect(() =>
        createExecutionPacket({
          ...packet,
          auditExecutionProfile: {
            ...packet.auditExecutionProfile!,
            currentAttemptBinding: {
              ...packet.auditExecutionProfile!.currentAttemptBinding,
              modelPacketHash: 'sha256:mismatch',
            },
          },
        })
      ).toThrow('auditExecutionProfile modelPacketHash must match compiledPromptRef');
      expect(() =>
        createExecutionPacket({
          ...packet,
          auditExecutionProfile: {
            ...packet.auditExecutionProfile!,
            currentAttemptBinding: {
              ...packet.auditExecutionProfile!.currentAttemptBinding,
              currentAttemptHash:
                'sha256:0000000000000000000000000000000000000000000000000000000000000000',
            },
          },
          auditTriadExecutionPlanRef: {
            ...packet.auditTriadExecutionPlanRef!,
            currentAttemptHash:
              'sha256:0000000000000000000000000000000000000000000000000000000000000000',
          },
        })
      ).toThrow('auditExecutionProfile currentAttemptHash must be derived from attemptId');
      expect(() =>
        createExecutionPacket({
          ...packet,
          auditExecutionProfile: {
            ...packet.auditExecutionProfile!,
            currentAttemptBinding: {
              ...packet.auditExecutionProfile!.currentAttemptBinding,
              currentEvidenceHash:
                'sha256:1111111111111111111111111111111111111111111111111111111111111111',
            },
          },
          auditTriadExecutionPlanRef: {
            ...packet.auditTriadExecutionPlanRef!,
            currentEvidenceHash:
              'sha256:1111111111111111111111111111111111111111111111111111111111111111',
          },
        })
      ).toThrow(
        'auditExecutionProfile currentEvidenceHash must match compiledPromptRef evidence hashes'
      );
      expect(() =>
        createExecutionPacket({
          ...packet,
          auditExecutionProfile: {
            ...packet.auditExecutionProfile!,
            currentAttemptBinding: {
              ...packet.auditExecutionProfile!.currentAttemptBinding,
              currentEvidenceHash:
                'sha256:c8ed309d65d96bc2341ebb69cb0ab61499f75f4b526ccb79b1c5afe59727e408',
            },
          },
        })
      ).toThrow('auditExecutionProfile currentEvidenceHash must be a fresh non-placeholder hash');
      expect(() =>
        createExecutionPacket({
          ...packet,
          auditTriadExecutionPlanRef: {
            ...packet.auditTriadExecutionPlanRef!,
            criticalAuditorProfileHash: 'sha256:mismatch',
          },
        })
      ).toThrow('auditTriadExecutionPlanRef profileHash must match auditExecutionProfile');
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });
});
