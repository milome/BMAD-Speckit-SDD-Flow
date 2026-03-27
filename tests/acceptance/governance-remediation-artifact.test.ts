import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildGovernanceRemediationArtifact,
  writeGovernanceRemediationArtifact,
} from '../../scripts/governance-remediation-artifact';

const repoRoot = process.cwd();

describe('governance remediation artifact entrypoint', () => {
  it('writes PM routing resolution and prompt hint usage into the remediation artifact', () => {
    const outDir = mkdtempSync(path.join(tmpdir(), 'gov-remediation-'));
    const outFile = path.join(outDir, 'attempt.md');

    const result = writeGovernanceRemediationArtifact({
      projectRoot: repoRoot,
      outputPath: outFile,
      promptText: '直接给我 architecture patch plan，使用 party-mode，但不要联网。',
      stageContextKnown: true,
      gateFailureExists: true,
      blockerOwnershipLocked: true,
      rootTargetLocked: true,
      equivalentAdapterCount: 2,
      attemptId: 'attempt-01',
      sourceGateFailureIds: ['GF-001'],
      capabilitySlot: 'architecture.challenge',
      canonicalAgent: 'Architect + Critical Auditor',
      actualExecutor: 'party-mode facilitator',
      adapterPath: 'host skill fallback',
      targetArtifacts: ['architecture.md'],
      expectedDelta: 'tighten completion semantics',
      rerunOwner: 'PM',
      rerunGate: 'architecture-contract-gate',
      outcome: 'in_progress',
      sharedArtifactsUpdated: ['Challenge Log'],
      contradictionsDelta: '1 opened / 0 closed',
      externalProofAdded: 'none',
      readyToRerunGate: false,
      stopReason: 'waiting on architecture update',
    });

    expect(existsSync(outFile)).toBe(true);
    const written = readFileSync(outFile, 'utf8');
    expect(written).toContain('## PM Routing Resolution');
    expect(written).toContain('## Prompt Hint Usage');
    expect(written).toContain('## Model Hint Debug');
    expect(written).toContain('Resolution order: `stage context -> gate failure -> artifact state -> PromptRoutingHints`');
    expect(written).toContain('- Blocker ownership affected: no');
    expect(written).toContain('- Model hint present: no');
    expect(result.promptHintUsage.hintAppliedTo).toContain('adapter-selection');
    expect(result.promptHintUsage.hintAppliedTo).not.toContain('entry-routing');
  });

  it('keeps low-confidence vague prompts from affecting artifact ownership in generated output', () => {
    const result = buildGovernanceRemediationArtifact({
      projectRoot: repoRoot,
      outputPath: 'unused.md',
      promptText: '帮我看看这个',
      stageContextKnown: true,
      gateFailureExists: true,
      blockerOwnershipLocked: true,
      rootTargetLocked: true,
      equivalentAdapterCount: 1,
      attemptId: 'attempt-02',
      sourceGateFailureIds: ['GF-002'],
      capabilitySlot: 'qa.traceability',
      canonicalAgent: 'PM + QA',
      actualExecutor: 'local artifact audit',
      adapterPath: 'local workflow fallback',
      targetArtifacts: ['prd.md'],
      expectedDelta: 'fill missing trace links',
      rerunOwner: 'PM',
      rerunGate: 'traceability-gate',
      outcome: 'blocked',
    });

    expect(result.promptHintUsage.hintAppliedTo).toHaveLength(0);
    expect(result.promptHintUsage.hintIgnoredBecause).toContain('low confidence');
    expect(result.markdown).toContain('- Blocker ownership affected: no');
    expect(result.markdown).toContain('- Hint confidence: low');
  });

  it('records filtered model hint debug without allowing ownership override', () => {
    const result = buildGovernanceRemediationArtifact({
      projectRoot: repoRoot,
      outputPath: 'unused.md',
      promptText: '继续 readiness 审计。',
      modelHintsCandidate: {
        source: 'model-provider',
        providerId: 'stub-model-governance-provider',
        providerMode: 'stub',
        confidence: 'high',
        suggestedStage: 'readiness',
        suggestedAction: 'audit',
        explicitRolePreference: ['critical-auditor'],
        researchPolicy: 'preferred',
        delegationPreference: 'ask-me-first',
        constraints: ['minimal-patch'],
        rationale: 'Need a stricter remediation pass.',
        overrideAllowed: false,
        forbiddenOverrides: {
          blockerOwnership: 'Architect',
          artifactRootTarget: 'architecture.md',
        },
      },
      stageContextKnown: true,
      gateFailureExists: true,
      blockerOwnershipLocked: true,
      rootTargetLocked: true,
      equivalentAdapterCount: 2,
      attemptId: 'attempt-03',
      sourceGateFailureIds: ['GF-003'],
      capabilitySlot: 'qa.readiness',
      canonicalAgent: 'PM + QA',
      actualExecutor: 'implementation readiness workflow',
      adapterPath: 'local workflow fallback',
      targetArtifacts: ['prd.md', 'architecture.md'],
      expectedDelta: 'tighten blocker repair plan',
      rerunOwner: 'PM',
      rerunGate: 'implementation-readiness',
      outcome: 'blocked',
    });

    expect(result.promptHintUsage.blockerOwnershipAffected).toBe(false);
    expect(result.promptHintUsage.modelHintPresent).toBe(true);
    expect(result.promptHintUsage.modelHintAppliedTo).toContain('adapter-selection');
    expect(result.promptHintUsage.modelHintIgnoredBecause).toContain('blocker ownership locked');
    expect(result.promptHintUsage.modelHintDebug?.strippedForbiddenOverrides).toContain(
      'blockerOwnership'
    );
    expect(result.markdown).toContain('- Model hint present: yes');
    expect(result.markdown).toContain('Stripped forbidden overrides: blockerOwnership, artifactRootTarget');
    expect(result.markdown).toContain('- Model hints remain advisory only: yes');
  });
});
