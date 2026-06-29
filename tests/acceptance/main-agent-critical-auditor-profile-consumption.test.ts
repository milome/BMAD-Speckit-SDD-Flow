import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateCriticalAuditorProfile } from '../../_bmad/shared/critical-auditor-profile/validate-critical-auditor-profile';
import {
  createAuditTriadExecutionPlan,
  evaluateAuditTriadConvergence,
  type AuditTriadRoundReceipt,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/audit-triad-orchestrator';
import {
  resolveCriticalAuditorProfile,
  stageProfileForCallPoint,
  validateCriticalAuditorProfileForStage,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/critical-auditor-profile';
import {
  cleanupRequirementWorkspace,
  materializeRequirementFixture,
  writeCompiledImplementPacket,
} from '../helpers/requirement-fixture-runtime';

const REQUIREMENTS_CONTRACT_DIMENSIONS = [
  'requirement_coverage_completeness',
  'controlled_must_atomicity',
  'target_authority_correctness',
  'validation_command_authority',
  'behavior_edge_failure_path_coverage',
  'packet_source_reconciliation',
  'no_fallback_no_synthetic_receipt',
  'hash_binding',
  'current_id_namespace',
  'source_materialization_safety',
  'user_confirmability_gate',
] as const;

const REQUIREMENTS_CONTRACT_REQUIRED_RESPONSE_FIELDS = [
  'schemaVersion',
  'requestHash',
  'recordId',
  'roundIndex',
  'transactionId',
  'namespaceVersion',
  'sourceHash',
  'sourceDocumentHash',
  'implementationConfirmationHash',
  'packetHash',
  'gateDryRunHash',
  'reconciliationIssueCount',
  'checkedProjectionGroups',
  'verdict',
  'reviewedMustRefs',
  'reviewedProjectionRefs',
  'priorFindingsDisposition',
  'falsePositiveProofs',
  'gapCandidates',
  'validatedGaps',
  'rejectedGapCandidates',
  'rationale',
] as const;

const REQUIREMENTS_CONTRACT_SURFACE_PATHS = [
  '_bmad/codex/agents/auditors/requirements-contract-critical-auditor.toml',
  '_bmad/claude/agents/auditors/requirements-contract-critical-auditor.md',
  '.codex/agents/auditors/requirements-contract-critical-auditor.toml',
  '.claude/agents/auditors/requirements-contract-critical-auditor.md',
] as const;

function readRepoText(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Main Agent CriticalAuditorProfile consumption', () => {
  it('binds requirements-contract profile and installed auditor surfaces to every D007 dimension', () => {
    const profilePath = path.join(
      process.cwd(),
      '_bmad',
      'shared',
      'critical-auditor-profile',
      'requirements-contract-critical-auditor-profile.json'
    );
    expect(fs.existsSync(profilePath)).toBe(true);

    const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    expect(profile.metadata.profileId).toBe('requirements-contract-critical-auditor');
    expect(validateCriticalAuditorProfile({ profile })).toEqual({ ok: true, blockingReasons: [] });

    const profileText = JSON.stringify(profile);
    for (const dimension of REQUIREMENTS_CONTRACT_DIMENSIONS) {
      expect(profile.dimensionContractBinding.dimensions).toContain(dimension);
      expect(profileText).toContain(dimension);
    }

    for (const surfacePath of REQUIREMENTS_CONTRACT_SURFACE_PATHS) {
      const surfaceText = readRepoText(surfacePath);
      const normalizedSurfaceText = surfaceText.toLowerCase();
      for (const dimension of REQUIREMENTS_CONTRACT_DIMENSIONS) {
        expect(surfaceText, `${surfacePath} missing ${dimension}`).toContain(dimension);
      }
      for (const field of REQUIREMENTS_CONTRACT_REQUIRED_RESPONSE_FIELDS) {
        expect(surfaceText, `${surfacePath} missing response field ${field}`).toContain(field);
      }
      expect(normalizedSurfaceText).toContain('read-only');
      expect(normalizedSurfaceText).toContain('must not write source');
      expect(normalizedSurfaceText).toContain('must not declare convergence');
      expect(normalizedSurfaceText).toContain('source-materialization');
      expect(normalizedSurfaceText).toContain('critical-auditor-round-response/v1');
    }
  });

  it('blocks stale stage profile hashes and binds triad convergence to current check item hash', () => {
    const fixture = materializeRequirementFixture();
    try {
      const profile = resolveCriticalAuditorProfile(fixture.root);
      const stageProfileId = stageProfileForCallPoint('audit_review');
      expect(stageProfileId).toBe('post_implementation_code_audit');
      const stale = validateCriticalAuditorProfileForStage({
        profile,
        stageProfileId,
        expectedProfileHash: profile.profileHash,
        expectedStageProfileHash:
          'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      });
      expect(stale.ok).toBe(false);
      expect(stale.blockingReasons).toContain('critical_auditor_stage_profile_hash_stale');

      const compiled = writeCompiledImplementPacket({ root: fixture.root, fixture });
      const plan = createAuditTriadExecutionPlan({
        projectRoot: fixture.root,
        recordId: fixture.recordId,
        stage: 'implement',
        callPoint: 'audit_review',
        attemptId: 'audit-current',
        sourceDocumentHash: fixture.sourceDocumentHash,
        implementationConfirmationHash: fixture.implementationConfirmationHash,
        modelPacketHash: compiled.compiledPromptRef.modelPacketHash,
        auditReceiptHash: compiled.compiledPromptRef.auditReceiptHash,
        goalExecutionHash: compiled.compiledPromptRef.goalExecutionHash,
      });
      expect(plan.stageProfileId).toBe('post_implementation_code_audit');
      expect(plan.subagents.every((agent) => agent.requiredCheckItemIds.length > 0)).toBe(true);
      const round: AuditTriadRoundReceipt = {
        schemaVersion: 'audit-triad-round-receipt/v1',
        roundId: 'r1',
        stageProfileId: plan.stageProfileId,
        perspectiveResults: {
          product_intent: { agentId: 'a1', validGaps: [] },
          model_projection: { agentId: 'a2', validGaps: [] },
          main_agent_execution: { agentId: 'a3', validGaps: [] },
        },
        coveredCheckItemIds: plan.subagents[0].requiredCheckItemIds,
        vetoItemResults: [],
        validatedGapRefs: [],
        invalidGapRefs: [],
        sourceDocumentHash: plan.sourceDocumentHash,
        implementationConfirmationHash: plan.implementationConfirmationHash,
        modelPacketHash: plan.modelPacketHash,
        auditReceiptHash: plan.auditReceiptHash,
        goalExecutionHash: plan.goalExecutionHash,
        criticalAuditorProfileHash: plan.criticalAuditorProfileHash,
        criticalAuditorStageProfileHash: plan.criticalAuditorStageProfileHash,
        requiredCheckItemSetHash: 'sha256:stale-check-items',
        currentAttemptHash: plan.currentAttemptHash,
        currentEvidenceHash: plan.currentEvidenceHash,
        scoreReceiptRefs: ['score.json'],
        runAuditorHostReceiptRefs: ['host.json'],
      };
      const decision = evaluateAuditTriadConvergence({
        plan,
        rounds: [round, { ...round, roundId: 'r2' }, { ...round, roundId: 'r3' }],
        scoreReceiptRequired: true,
        runAuditorHostReceiptRequired: true,
      });
      expect(decision.ok).toBe(false);
      expect(decision.blockingReasons).toContain('round_1_check_item_set_hash_mismatch');
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });
});
