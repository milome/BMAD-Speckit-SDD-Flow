import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const orchestratorPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-bmad-consumer-orchestrator.ts'
);

it('publishes the Codex Create PRD orchestration owner', () => {
  expect(existsSync(orchestratorPath)).toBe(true);
});

describe.runIf(existsSync(orchestratorPath))('Codex CLI Create PRD flow', () => {
  it('executes the complete requirement-source pipeline without manual Skill chaining', async () => {
    const { executeBmadCreatePrdOrchestration } = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-bmad-consumer-orchestrator'
    );
    const executed: string[] = [];
    const result = await executeBmadCreatePrdOrchestration({
      requestedArtifactRole: 'requirement_source_prd',
      runStage: async (stage) => {
        executed.push(stage);
        return { stage, outputHash: `sha256:${String(executed.length).repeat(64).slice(0, 64)}` };
      },
    });

    expect(executed).toEqual([
      'discovery',
      'advanced_elicitation',
      'automatic_semantic_resolution',
      'requirements_grill',
      'draft_validation',
      'confirmation_ready_validation',
      'canonical_source_prd_render',
      'safe_write',
      'runtime_registration',
      'receipt_generation',
    ]);
    expect(result).toMatchObject({
      artifactRole: 'requirement_source_prd',
      manualSkillChainingRequired: false,
      directPrdWriteCount: 0,
      decision: 'completed',
    });
    expect(result.stageReceipts).toHaveLength(executed.length);
  });

  it('routes Product PRD and incomplete discovery through role-specific pipelines', async () => {
    const { executeBmadCreatePrdOrchestration } = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-bmad-consumer-orchestrator'
    );
    const productStages: string[] = [];
    const discoveryStages: string[] = [];

    await executeBmadCreatePrdOrchestration({
      requestedArtifactRole: 'product_prd',
      runStage: async (stage) => {
        productStages.push(stage);
        return { stage, outputHash: `sha256:${'a'.repeat(64)}` };
      },
    });
    const discovery = await executeBmadCreatePrdOrchestration({
      requestedArtifactRole: 'discovery_envelope',
      runStage: async (stage) => {
        discoveryStages.push(stage);
        return { stage, outputHash: `sha256:${'b'.repeat(64)}` };
      },
    });

    expect(productStages).toEqual([
      'discovery',
      'registered_product_prd_render',
      'safe_write',
      'receipt_generation',
    ]);
    expect(discoveryStages).toEqual(['discovery', 'semantic_candidate_capture', 'receipt_generation']);
    expect(discovery).toMatchObject({
      finalImplementationAuthority: 'none',
      directPrdWriteCount: 0,
    });
  });
});
