import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TEXT_EXTENSIONS = new Set(['.js', '.json', '.md', '.ts', '.yaml', '.yml']);
const FORBIDDEN_TOKENS = [
  'runCriticalAuditorReceiptLoop',
  'consecutiveNoNewGapRounds',
  'consecutiveNoNewValidGapRounds',
  'critical-auditor-round-request',
  'critical-auditor-round-response',
  'critical-auditor-receipt-round',
  'critical_auditor_receipt_loop',
  'critical_auditor_rework_verification',
  'criticalAuditorReceiptRefs',
  'governedCriticalAuditorReceiptRefs',
  'critical_auditor_less_than_three_no_new_gap_rounds',
  'bounded_no_new_gap',
  'critical_auditor_provider_mode_required',
  '--critical-auditor-provider-mode',
  '--critical-auditor-response-file',
  '--critical-auditor-response-dir',
  '--max-critical-auditor-rounds',
  'write-critical-auditor-no-new-gap-response',
  'runMainAgentPreConfirmationDrilldown',
  'runMainAgentAuthoringRepair',
  'requirements-contract-critical-auditor-independence',
  'requirements-contract-critical-auditor.prompt.md',
  'requirements-contract-critical-auditor-profile.json',
  'requirements_critical_auditor',
  'run_authoring_repair_preserve_existing',
  'requirements-contract-legacy-audit-reader',
  'migrate-requirements-authoring-record',
  'requirements-contract-record-migration',
  'requirements-contract-migration-operation',
  'legacyOrchestration',
  '--legacy-orchestration',
  'publishInitialCompatibilityCheckpointPointer',
  'publishLegacyAttemptSnapshots',
  'readActiveSourceBindingCompat',
  'requirements_legacy_checkpoint_snapshot',
  'requirements_source_binding_compatibility_ref',
  'semantic_ir_compatibility',
  'requirements-contract-compatibility/v1',
  'requirements_authoring_package_runtime_required',
  'requirements_authoring_legacy_action_removed',
  'authoring-repair',
  'authoring_repair',
  'CriticalAuditorStagingTransaction',
  'critical_auditor_round_required',
  'blocked_by_critical_auditor_gap',
  'critical_auditor_validated_gap',
  'critical_auditor_split_must',
  'requirements-contract-record/v1',
  'V2_COMPATIBILITY_KEYS',
  'Read-only compatibility paths for pre-v2 resume consumers',
  'requirements_active_semantic_compatibility_path_invalid',
  'requirements_active_binding_compatibility_path_invalid',
  'requirements_active_authoring_attempt_compatibility_invalid',
  'requirements_active_build_compatibility_hash_mismatch',
  'activeSemanticIrPath',
  'activeSourceBindingPath',
  'activeAuthoringAttemptId',
  'activeBuildManifestHash',
  'ActiveAuthoringAttemptPointer/v1',
  'authoring/staging',
  'requirements-contract-checkpoint-manifest/v1',
  'requirements-contract-build-manifest/v1',
  'requirements-contract-active-authoring-attempt-pointer',
  'publishRequirementsContractCp05Cp08Stages',
] as const;

const AUTHORING_ROOTS = [
  '_bmad/skills/requirements-contract-authoring',
  '_bmad/skills/req-trace-matrix-prompt-generator/scripts',
  '_bmad/shared/requirements-contract',
  '_bmad/shared/critical-auditor-profile',
  '_bmad/claude/agents/auditors/requirements-contract-critical-auditor.md',
  '_bmad/codex/agents/auditors/requirements-contract-critical-auditor.toml',
  'packages/bmad-speckit/src/main-agent',
] as const;

const GENERIC_AUDIT_SOURCES = new Set([
  'audit-scoring-convergence-policy.ts',
  'audit-triad-producer-artifact-validator.ts',
]);

function collectTextFiles(root: string): string[] {
  const absoluteRoot = path.join(ROOT, root);
  if (!existsSync(absoluteRoot)) return [];
  if (!statSync(absoluteRoot).isDirectory()) return [absoluteRoot];
  return readdirSync(absoluteRoot, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(root, entry.name);
    if (entry.isDirectory()) return collectTextFiles(relativePath);
    if (GENERIC_AUDIT_SOURCES.has(entry.name)) return [];
    return TEXT_EXTENSIONS.has(path.extname(entry.name)) ? [path.join(ROOT, relativePath)] : [];
  });
}

describe('requirements authoring retired three-round authority hard cut', () => {
  it.each(AUTHORING_ROOTS)('%s contains no retired round protocol', (root) => {
    const violations = collectTextFiles(root).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return FORBIDDEN_TOKENS.filter((token) => source.includes(token)).map(
        (token) => `${path.relative(ROOT, file)}:${token}`
      );
    });

    expect(violations).toEqual([]);
  });

  it('does not retain an executable writer, round schema, provider, or legacy reader', () => {
    const retiredPaths = [
      '_bmad/skills/requirements-contract-authoring/scripts/write-critical-auditor-no-new-gap-response.js',
      '_bmad/shared/requirements-contract/judge-prompts/requirements-contract-critical-auditor.prompt.md',
      '_bmad/shared/critical-auditor-profile/requirements-contract-critical-auditor-profile.json',
      '_bmad/shared/critical-auditor-profile/requirements-contract-judge-profile.json',
      '_bmad/claude/agents/auditors/requirements-contract-critical-auditor.md',
      '_bmad/codex/agents/auditors/requirements-contract-critical-auditor.toml',
      'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-critical-auditor-judge-request.schema.json',
      'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-critical-auditor-independence.ts',
      'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-legacy-audit-reader.ts',
      'packages/bmad-speckit/src/main-agent/actions/migrate-requirements-authoring-record.ts',
      'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-record-migration.ts',
      'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-migration-operation.ts',
      'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-migration-operation.schema.json',
      'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-active-authoring-attempt-pointer.ts',
      'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-active-authoring-attempt-pointer.schema.json',
      'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-authoring-checkpoint-manifest.schema.json',
      'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-source-binding-refresh.ts',
      'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-remediation-delta.ts',
    ];

    expect(retiredPaths.filter((file) => existsSync(path.join(ROOT, file)))).toEqual([]);
  });
});
