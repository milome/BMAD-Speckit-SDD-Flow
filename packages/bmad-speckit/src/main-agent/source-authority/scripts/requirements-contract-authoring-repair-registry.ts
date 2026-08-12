import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type Repairability = 'auto' | 'input_required' | 'environment_required' | 'forbidden';

export type RepairFailureClass =
  | 'deterministic_generation_defect'
  | 'authority_gap'
  | 'environment_gap'
  | 'forbidden_repair'
  | 'upstream_runtime_defect';

export interface RepairRegistryEntry {
  code: string;
  issueFamily: string;
  deterministicApplicabilityCondition: string;
  repairability: Repairability;
  failureClass: RepairFailureClass;
  repairAction: string;
  retryStage: 'authoring_pre_materialization' | 'authoring_post_render' | 'input_gate';
  producedArtifactPaths: string[];
  receiptPath: string;
}

export interface RepairRegistryClassification extends RepairRegistryEntry {
  rawIssueCode?: string;
  rawIssueMessage?: string;
}

export const REPAIR_REGISTRY_UNCLASSIFIED_CODE = 'repair_registry_unclassified_issue_code';

const auto = (
  code: string,
  issueFamily: string,
  condition: string,
  repairAction: string
): RepairRegistryEntry => ({
  code,
  issueFamily,
  deterministicApplicabilityCondition: condition,
  repairability: 'auto',
  failureClass: 'deterministic_generation_defect',
  repairAction,
  retryStage: 'authoring_pre_materialization',
  producedArtifactPaths: ['<authoring-dir>/repair-attempt-N.json'],
  receiptPath: '<authoring-dir>/repair-registry.json',
});

const inputRequired = (
  code: string,
  issueFamily: string,
  condition: string,
  repairAction: string
): RepairRegistryEntry => ({
  code,
  issueFamily,
  deterministicApplicabilityCondition: condition,
  repairability: 'input_required',
  failureClass: 'authority_gap',
  repairAction,
  retryStage: 'input_gate',
  producedArtifactPaths: ['<authoring-dir>/source-mutation-decision.json'],
  receiptPath: '<authoring-dir>/repair-registry.json',
});

const environmentRequired = (
  code: string,
  issueFamily: string,
  condition: string,
  repairAction: string
): RepairRegistryEntry => ({
  code,
  issueFamily,
  deterministicApplicabilityCondition: condition,
  repairability: 'environment_required',
  failureClass: 'environment_gap',
  repairAction,
  retryStage: 'input_gate',
  producedArtifactPaths: ['<authoring-dir>/source-mutation-decision.json'],
  receiptPath: '<authoring-dir>/repair-registry.json',
});

const forbidden = (
  code: string,
  issueFamily: string,
  condition: string,
  repairAction: string,
  failureClass: RepairFailureClass = 'forbidden_repair'
): RepairRegistryEntry => ({
  code,
  issueFamily,
  deterministicApplicabilityCondition: condition,
  repairability: 'forbidden',
  failureClass,
  repairAction,
  retryStage: 'input_gate',
  producedArtifactPaths: ['<authoring-dir>/source-mutation-decision.json'],
  receiptPath: '<authoring-dir>/repair-registry.json',
});

const entries = [
  auto(
    'trace_unknown_view_ref',
    'trace_view_ref_integrity',
    'Referenced view ID is absent but the current model has materialized or derivable view rows.',
    'Regenerate trace refs from actual generated view IDs and rerun render.'
  ),
  auto(
    'out_missing_boundary_view',
    'out_boundary_materialization',
    'OUT row exists without a matching boundary view.',
    'Generate one BOUND-* view per OUT row and rerun render.'
  ),
  auto(
    'business_boundary_missing_views',
    'business_view_materialization',
    'Business requirement IDs exist without business-scoped views.',
    'Generate business requirement rows and business view rows from source-bound IDs.'
  ),
  auto(
    'business_boundary_missing_diagrams',
    'business_view_materialization',
    'Business views exist without Mermaid-backed business diagrams.',
    'Generate business sequence or flow diagram refs from materialized business views.'
  ),
  auto(
    'diagram_unbound_semantics',
    'business_view_materialization',
    'Diagram row exists but lacks source-bound semantic coverage after materialization.',
    'Rebuild diagram semantic refs from materialized business and trace registries.'
  ),
  auto(
    'governance_boundary_missing_views',
    'governance_view_materialization',
    'Governance requirements are explicitly source-authorized and lack governance-scoped views.',
    'Generate governance-scoped views from source-bound governance requirements.'
  ),
  auto(
    'governance_boundary_missing_diagrams',
    'governance_view_materialization',
    'Governance requirements are explicitly source-authorized and lack governance-scoped diagrams.',
    'Generate governance-scoped diagrams from source-bound governance requirements.'
  ),
  auto(
    'missing_must',
    'core_collection_closure',
    'Source has requirement semantics that were dropped by materialization.',
    'Regenerate missing MUST rows from controlled source projections and rerun render.'
  ),
  auto(
    'missing_notDone',
    'core_collection_closure',
    'Source has negative semantics that were dropped by materialization.',
    'Regenerate missing NEG rows from controlled source projections and rerun render.'
  ),
  auto(
    'missing_mustNot',
    'core_collection_closure',
    'Source has out-of-scope semantics that were dropped by materialization.',
    'Regenerate missing OUT rows from controlled source projections and rerun render.'
  ),
  auto(
    'missing_evidence',
    'core_collection_closure',
    'Source has evidence semantics or MUST rows without evidence closure.',
    'Regenerate evidence rows from controlled source projections and rerun render.'
  ),
  auto(
    'missing_failurePaths',
    'core_collection_closure',
    'Source has failure semantics or NEG rows without failure closure.',
    'Regenerate failure path rows from controlled source projections and rerun render.'
  ),
  auto(
    'missing_edgeCases',
    'core_collection_closure',
    'Source has edge-case semantics or NEG rows without edge closure.',
    'Regenerate edge-case rows from controlled source projections and rerun render.'
  ),
  auto(
    'missing_trace_rows',
    'trace_closure',
    'Source has requirement rows without trace closure.',
    'Regenerate trace rows from controlled source projections and rerun render.'
  ),
  auto(
    'missing_sequence_views',
    'visual_view_closure',
    'Required sequence view collection is empty and source requirements exist.',
    'Materialize sequence views from MUST, NEG, OUT, and trace closure rows.'
  ),
  auto(
    'missing_flow_views',
    'visual_view_closure',
    'Required flow view collection is empty and source requirements exist.',
    'Materialize flow views from MUST, NEG, OUT, and trace closure rows.'
  ),
  auto(
    'missing_edge_case_views',
    'visual_view_closure',
    'Required edge-case view collection is empty and source requirements exist.',
    'Materialize edge-case views from MUST, NEG, OUT, and trace closure rows.'
  ),
  auto(
    'missing_boundary_views',
    'visual_view_closure',
    'Required boundary view collection is empty and source requirements exist.',
    'Materialize boundary views from MUST, NEG, OUT, and trace closure rows.'
  ),
  auto(
    'must_missing_trace_coverage',
    'must_trace_closure',
    'MUST row exists without trace closure rows.',
    'Generate per-MUST trace, view, acceptance, command, and evidence closure rows.'
  ),
  auto(
    'must_missing_happy_or_flow_view',
    'must_trace_closure',
    'MUST row exists without happy-path or flow view closure.',
    'Generate per-MUST business and governance view rows.'
  ),
  auto(
    'must_missing_acceptance_or_e2e_coverage',
    'must_trace_closure',
    'MUST row exists without acceptance or E2E coverage.',
    'Generate per-MUST acceptance, E2E, command, and evidence closure rows.'
  ),
  auto(
    'neg_missing_trace_coverage',
    'negative_trace_closure',
    'NEG row exists without trace closure rows.',
    'Generate NEG trace, failure, edge, acceptance, command, and evidence closure rows.'
  ),
  auto(
    'neg_missing_failure_or_edge_view',
    'negative_trace_closure',
    'NEG row exists without failure or edge view closure.',
    'Generate NEG failure and edge view closure rows.'
  ),
  auto(
    'neg_missing_acceptance_or_e2e_coverage',
    'negative_trace_closure',
    'NEG row exists without acceptance or E2E coverage.',
    'Generate NEG acceptance, E2E, command, and evidence closure rows.'
  ),
  auto(
    'failure_path_missing_trigger',
    'failure_edge_field_closure',
    'Linked NEG or source failure semantics contain enough text to derive the trigger.',
    'Fill failure path trigger from source-bound failure semantics.'
  ),
  auto(
    'failure_path_missing_expected_behavior',
    'failure_edge_field_closure',
    'Linked NEG or source failure semantics contain enough text to derive expected behavior.',
    'Fill failure path expected behavior from source-bound failure semantics.'
  ),
  auto(
    'edge_case_missing_condition',
    'failure_edge_field_closure',
    'Linked NEG or source edge semantics contain enough text to derive the condition.',
    'Fill edge-case condition from source-bound edge semantics.'
  ),
  auto(
    'edge_case_missing_expected_behavior',
    'failure_edge_field_closure',
    'Linked NEG or source edge semantics contain enough text to derive expected behavior.',
    'Fill edge-case expected behavior from source-bound edge semantics.'
  ),
  auto(
    'must_unknown_evidence_ref',
    'canonical_ref_rewrite',
    'Referenced evidence ID was renamed or regenerated in the same active authoring transaction.',
    'Rewrite refs from the current canonical ID registry and rerun render.'
  ),
  auto(
    'neg_unknown_evidence_ref',
    'canonical_ref_rewrite',
    'Referenced evidence ID was renamed or regenerated in the same active authoring transaction.',
    'Rewrite refs from the current canonical ID registry and rerun render.'
  ),
  auto(
    'failure_path_unknown_neg_ref',
    'canonical_ref_rewrite',
    'Referenced NEG ID was renamed or regenerated in the same active authoring transaction.',
    'Rewrite refs from the current canonical ID registry and rerun render.'
  ),
  auto(
    'failure_path_unknown_evidence_ref',
    'canonical_ref_rewrite',
    'Referenced evidence ID was renamed or regenerated in the same active authoring transaction.',
    'Rewrite refs from the current canonical ID registry and rerun render.'
  ),
  auto(
    'edge_case_unknown_failure_path_ref',
    'canonical_ref_rewrite',
    'Referenced failure path ID was renamed or regenerated in the same active authoring transaction.',
    'Rewrite refs from the current canonical ID registry and rerun render.'
  ),
  auto(
    'edge_case_unknown_evidence_ref',
    'canonical_ref_rewrite',
    'Referenced evidence ID was renamed or regenerated in the same active authoring transaction.',
    'Rewrite refs from the current canonical ID registry and rerun render.'
  ),
  auto(
    'trace_unknown_cover_ref',
    'canonical_ref_rewrite',
    'Referenced cover row exists under a generated replacement ID.',
    'Rewrite trace cover refs from the current canonical ID registry and rerun render.'
  ),
  auto(
    'trace_unknown_evidence_ref',
    'canonical_ref_rewrite',
    'Referenced evidence row exists under a generated replacement ID.',
    'Rewrite trace evidence refs from the current canonical ID registry and rerun render.'
  ),
  auto(
    'trace_unknown_acceptance_ref',
    'canonical_ref_rewrite',
    'Referenced acceptance row exists under a generated replacement ID.',
    'Rewrite trace acceptance refs from the current canonical ID registry and rerun render.'
  ),
  auto(
    'trace_missing_diagram_refs',
    'trace_closure',
    'Trace row exists but lacks diagram refs while view rows are available.',
    'Rebuild trace diagram refs from generated view registries.'
  ),
  auto(
    'trace_missing_command_refs',
    'trace_closure',
    'Trace row exists but lacks command refs while validation authority commands are available.',
    'Rebuild trace command refs from validation command registry.'
  ),
  auto(
    'trace_task_unbound',
    'trace_closure',
    'Trace row exists but lacks task refs while atomic tasks are available.',
    'Rebuild trace task refs from atomic task registry.'
  ),
  auto(
    'trace_legacy_command_refs_only',
    'trace_closure',
    'Trace row only has legacy command refs while canonical command refs exist.',
    'Rewrite trace command refs to canonical command row IDs.'
  ),
  auto(
    'visual_view_missing_trace_rows',
    'visual_reciprocal_closure',
    'Visual view row exists but lacks reciprocal trace links.',
    'Rebuild reciprocal view-to-trace closure from canonical trace rows.'
  ),
  auto(
    'visual_failure_view_missing_failure_path_refs',
    'visual_reciprocal_closure',
    'Failure visual view row exists but lacks failure path refs.',
    'Rebuild failure view refs from canonical failure path rows.'
  ),
  auto(
    'visual_edge_view_missing_edge_case_refs',
    'visual_reciprocal_closure',
    'Edge visual view row exists but lacks edge-case refs.',
    'Rebuild edge view refs from canonical edge-case rows.'
  ),
  auto(
    'confirmation_language_content_english_only',
    'confirmation_localization_materialization',
    'confirmationLanguage is zh-CN or bilingual and renderer-checked confirmation fields have English raw text without Chinese projection fields.',
    'Emit a current-hash localization request and require the main-session authoring agent to provide complete, semantically equivalent Chinese projections before hashing, audit, promotion, and render. Synthetic CJK wrapper text is forbidden.'
  ),
  inputRequired(
    'target_authority_missing',
    'target_authority_gap',
    'No source-bound or explicit target path authority exists for proposed source mutation.',
    'Return missing target authority and require explicit Target Authority input.'
  ),
  inputRequired(
    'validation_authority_missing',
    'validation_authority_gap',
    'No source-bound or explicit validation command authority exists for proposed source mutation.',
    'Return missing validation authority and require explicit Validation Authority input.'
  ),
  inputRequired(
    'controlled_must_candidates_missing',
    'source_authority_gap',
    'No source-bound controlled MUST candidate can be extracted.',
    'Return the missing source requirement statement and require source authority.'
  ),
  inputRequired(
    'controlled_ingest_confirmation_phrase_missing',
    'user_confirmation_gap',
    'Controlled ingest lacks the exact HTML confirmation phrase and hashes.',
    'Require operator confirmation phrase and hashes before ingest.'
  ),
  inputRequired(
    'source_hash_changed_before_promotion',
    'source_hash_safety_gap',
    'Source hash changed concurrently before promotion.',
    'Stop and require a fresh source-authority run.'
  ),
  environmentRequired(
    'missing_mermaid_runtime',
    'renderer_environment_gap',
    'Renderer requires Mermaid runtime and it is not available.',
    'Install or provide the Mermaid runtime required by the renderer.'
  ),
  environmentRequired(
    'invalid_mermaid_runtime_bundle',
    'renderer_environment_gap',
    'Renderer found a Mermaid runtime bundle that cannot execute.',
    'Replace the invalid Mermaid runtime bundle.'
  ),
  environmentRequired(
    'acceptance_test_file_missing',
    'consumer_test_environment_gap',
    'Required acceptance or E2E test file referenced by validation authority is missing locally.',
    'Create the real acceptance test file or install the consumer project test surface.'
  ),
  forbidden(
    'line_based_must_id_forbidden',
    'forbidden_repair_requested',
    'Repair would preserve old line-based inline MUST IDs instead of source-bound FR/NFR IDs.',
    'Do not promote old line-based IDs; rebuild from source-bound candidates.'
  ),
  forbidden(
    'forbidden_repair_requested',
    'forbidden_repair_requested',
    'Repair would fabricate authority, bypass source-hash safety, hand patch generated source, delete TRACE refs, or create a consumer temporary generator.',
    'Stop without promotion.'
  ),
  forbidden(
    'repair_loop_non_convergent_runtime_defect',
    'upstream_runtime_defect',
    'Auto-repair loop reached deterministic no-progress evidence with unchanged issue/action/source/draft/report hashes.',
    'Stop without promotion and report upstream runtime defect.',
    'upstream_runtime_defect'
  ),
] satisfies RepairRegistryEntry[];

export const REQUIREMENTS_AUTHORING_REPAIR_REGISTRY = {
  schemaVersion: 'requirements-authoring-repair-registry/v1',
  sourceKind: 'typescript_typed_map',
  entries,
} as const;

const registryByCode = new Map(entries.map((entry) => [entry.code, entry]));

function unclassifiedEntry(
  rawIssueCode: string,
  rawIssueMessage = ''
): RepairRegistryClassification {
  return {
    code: REPAIR_REGISTRY_UNCLASSIFIED_CODE,
    rawIssueCode,
    rawIssueMessage,
    issueFamily: 'upstream_runtime_defect',
    deterministicApplicabilityCondition:
      'Renderer or materializer emitted an issue code missing from the typed repair registry.',
    repairability: 'forbidden',
    failureClass: 'upstream_runtime_defect',
    repairAction: 'Update typed repair registry and add a regression test before release.',
    retryStage: 'input_gate',
    producedArtifactPaths: ['<authoring-dir>/repair-registry-unclassified-issue.json'],
    receiptPath: '<authoring-dir>/repair-registry-unclassified-issue.json',
  };
}

export function classifyRequirementAuthoringIssue(
  issueCode: string,
  issueMessage = ''
): RepairRegistryClassification {
  const normalizedCode = String(issueCode ?? '').trim();
  return registryByCode.get(normalizedCode) ?? unclassifiedEntry(normalizedCode, issueMessage);
}

export function writeRequirementsAuthoringRepairRegistryReceipt(input: {
  authoringDir: string;
  autoRepairEnabled: boolean;
}): string {
  fs.mkdirSync(input.authoringDir, { recursive: true });
  const receiptPath = path.join(input.authoringDir, 'repair-registry.json');
  fs.writeFileSync(
    receiptPath,
    `${JSON.stringify(
      {
        schemaVersion: 'requirements-authoring-repair-registry-receipt/v1',
        sourceKind: REQUIREMENTS_AUTHORING_REPAIR_REGISTRY.sourceKind,
        autoRepairEnabled: input.autoRepairEnabled,
        debugSwitch: '--no-auto-repair',
        retryLoopPolicy:
          'no_arbitrary_fixed_retry_success_boundary_confirmable_or_authority_environment_upstream_runtime_defect',
        deterministicNoProgressCode: 'repair_loop_non_convergent_runtime_defect',
        registryEntryCount: REQUIREMENTS_AUTHORING_REPAIR_REGISTRY.entries.length,
        entries: REQUIREMENTS_AUTHORING_REPAIR_REGISTRY.entries,
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return receiptPath;
}

export function writeRepairRegistryUnclassifiedIssueReceipt(input: {
  authoringDir: string;
  rawIssueCode: string;
  rawIssueMessage?: string;
  originStage: string;
  reportPath: string;
  sourceHash: string | null;
  draftHash: string | null;
}): string {
  fs.mkdirSync(input.authoringDir, { recursive: true });
  const receiptPath = path.join(input.authoringDir, 'repair-registry-unclassified-issue.json');
  fs.writeFileSync(
    receiptPath,
    `${JSON.stringify(
      {
        schemaVersion: 'requirements-authoring-repair-registry-unclassified-issue/v1',
        code: REPAIR_REGISTRY_UNCLASSIFIED_CODE,
        rawIssueCode: input.rawIssueCode,
        rawIssueMessage: input.rawIssueMessage ?? '',
        originStage: input.originStage,
        reportPath: input.reportPath,
        sourceHash: input.sourceHash,
        draftHash: input.draftHash,
        repairability: 'forbidden',
        failureClass: 'upstream_runtime_defect',
        requiredRegistryEntry: 'Add a typed RepairRegistryEntry for the raw issue code.',
        requiredRegressionTest:
          'Add an acceptance regression test that proves the new classification.',
        nextRequiredAction: 'update_typed_repair_registry_and_regression_test',
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return receiptPath;
}

export type RequirementAuthoringResumeTrigger =
  | 'frozen_ir_reentry'
  | 'decision_projection_gap'
  | 'compiler_decision_loss'
  | 'technical_planning_pending'
  | 'projection_drift'
  | 'semantic_revision_stale'
  | 'citation_binding_stale';

export interface RequirementAuthoringResumeClassification {
  schemaVersion: 'requirements-authoring-repair-resume-classification/v1';
  trigger: RequirementAuthoringResumeTrigger;
  earliestAffectedStage: 'cp00' | 'cp01' | 'cp02' | 'cp05' | 'binding_refresh';
  latestValidPredecessorCheckpoint: 'cp00' | 'cp01' | 'cp04' | null;
  resumeAction:
    | 'resume_projection_from_frozen_ir'
    | 'recompile_from_existing_decision_receipt'
    | 'resume_after_technical_capability_change'
    | 'rebuild_projection_from_frozen_ir'
    | 'compile_semantic_successor'
    | 'refresh_binding_and_citations_only';
  reopenGrill: boolean;
  rerunJudge: boolean;
  preserveFrozenSemanticRevision: boolean;
  preserveDecisionReceipts: boolean;
}

const resumeClassifications = {
  frozen_ir_reentry: {
    earliestAffectedStage: 'cp05',
    latestValidPredecessorCheckpoint: 'cp04',
    resumeAction: 'resume_projection_from_frozen_ir',
    reopenGrill: false,
    rerunJudge: false,
    preserveFrozenSemanticRevision: true,
    preserveDecisionReceipts: true,
  },
  decision_projection_gap: {
    earliestAffectedStage: 'cp01',
    latestValidPredecessorCheckpoint: 'cp00',
    resumeAction: 'recompile_from_existing_decision_receipt',
    reopenGrill: false,
    rerunJudge: true,
    preserveFrozenSemanticRevision: false,
    preserveDecisionReceipts: true,
  },
  compiler_decision_loss: {
    earliestAffectedStage: 'cp01',
    latestValidPredecessorCheckpoint: 'cp00',
    resumeAction: 'recompile_from_existing_decision_receipt',
    reopenGrill: false,
    rerunJudge: true,
    preserveFrozenSemanticRevision: false,
    preserveDecisionReceipts: true,
  },
  technical_planning_pending: {
    earliestAffectedStage: 'cp02',
    latestValidPredecessorCheckpoint: 'cp01',
    resumeAction: 'resume_after_technical_capability_change',
    reopenGrill: false,
    rerunJudge: false,
    preserveFrozenSemanticRevision: false,
    preserveDecisionReceipts: true,
  },
  projection_drift: {
    earliestAffectedStage: 'cp05',
    latestValidPredecessorCheckpoint: 'cp04',
    resumeAction: 'rebuild_projection_from_frozen_ir',
    reopenGrill: false,
    rerunJudge: true,
    preserveFrozenSemanticRevision: true,
    preserveDecisionReceipts: true,
  },
  semantic_revision_stale: {
    earliestAffectedStage: 'cp00',
    latestValidPredecessorCheckpoint: null,
    resumeAction: 'compile_semantic_successor',
    reopenGrill: false,
    rerunJudge: true,
    preserveFrozenSemanticRevision: false,
    preserveDecisionReceipts: true,
  },
  citation_binding_stale: {
    earliestAffectedStage: 'binding_refresh',
    latestValidPredecessorCheckpoint: 'cp04',
    resumeAction: 'refresh_binding_and_citations_only',
    reopenGrill: false,
    rerunJudge: false,
    preserveFrozenSemanticRevision: true,
    preserveDecisionReceipts: true,
  },
} as const satisfies Record<
  RequirementAuthoringResumeTrigger,
  Omit<RequirementAuthoringResumeClassification, 'schemaVersion' | 'trigger'>
>;

export function classifyRequirementAuthoringResume(
  trigger: RequirementAuthoringResumeTrigger
): RequirementAuthoringResumeClassification {
  return {
    schemaVersion: 'requirements-authoring-repair-resume-classification/v1',
    trigger,
    ...resumeClassifications[trigger],
  };
}

export type RequirementAuditorSemanticRepairAction =
  | 'add_must'
  | 'add_neg'
  | 'add_out'
  | 'replace_target_path'
  | 'replace_validation_command';

export interface RequirementAuditorSemanticRepairInput {
  sourceDocument: string;
  sourceHash: string;
  action: RequirementAuditorSemanticRepairAction;
  sourceSpan: { startLine: number; endLine: number };
  sourceText: string;
  proposedValue: string;
  decisionReceiptRef?: {
    path: string;
    hash: string;
    verified: boolean;
  };
}

function semanticAuthorityHash(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

export function validateRequirementAuditorSemanticRepair(
  input: RequirementAuditorSemanticRepairInput
): {
  ok: boolean;
  issues: string[];
  authorityClass: 'source_grounded' | 'decision_grounded' | 'none';
} {
  const issues: string[] = [];
  const normalizedSource = input.sourceDocument.replace(/\r\n?/gu, '\n');
  if (semanticAuthorityHash(normalizedSource) !== input.sourceHash) {
    issues.push('auditor_source_hash_mismatch');
  }
  const lines = normalizedSource.split('\n');
  const { startLine, endLine } = input.sourceSpan;
  if (
    !Number.isInteger(startLine) ||
    !Number.isInteger(endLine) ||
    startLine < 1 ||
    endLine < startLine ||
    endLine > lines.length
  ) {
    issues.push('auditor_source_span_invalid');
  }
  const sourceSlice =
    issues.includes('auditor_source_span_invalid')
      ? ''
      : lines.slice(startLine - 1, endLine).join('\n');
  if (sourceSlice !== input.sourceText.replace(/\r\n?/gu, '\n')) {
    issues.push('auditor_source_text_mismatch');
  }

  const decisionReceiptValid =
    input.decisionReceiptRef?.verified === true &&
    input.decisionReceiptRef.path.trim().length > 0 &&
    /^sha256:[a-f0-9]{64}$/u.test(input.decisionReceiptRef.hash);
  const sourceEntailsValue =
    input.proposedValue.trim().length > 0 &&
    sourceSlice.includes(input.proposedValue.trim());
  if (!sourceEntailsValue && !decisionReceiptValid) {
    issues.push('auditor_semantic_entailment_missing');
  }

  return {
    ok: issues.length === 0,
    issues,
    authorityClass:
      issues.length > 0
        ? 'none'
        : decisionReceiptValid
          ? 'decision_grounded'
          : 'source_grounded',
  };
}
