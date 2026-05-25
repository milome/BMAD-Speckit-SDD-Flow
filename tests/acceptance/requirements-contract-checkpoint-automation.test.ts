import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import yaml from 'js-yaml';

const ROOT = process.cwd();
const ASSESS = path.join(
  ROOT,
  '_bmad',
  'skills',
  'requirements-contract-authoring',
  'scripts',
  'assess_contract_authoring_scale.js'
);
const CHECKPOINTS = path.join(
  ROOT,
  '_bmad',
  'skills',
  'requirements-contract-authoring',
  'scripts',
  'run_semantic_checkpoints.js'
);
const RETENTION_CLEANUP = path.join(
  ROOT,
  '_bmad',
  'skills',
  'requirements-contract-authoring',
  'scripts',
  'finalize_requirements_contract_retention.js'
);
const CHECKPOINT_REQUIREMENT_DOC = path.join(
  ROOT,
  'docs',
  'requirements',
  '2026-05-25-requirements-contract-checkpoint-automation.md'
);

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'requirements-checkpoint-automation-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function runNode(script: string, args: string[], cwd = ROOT) {
  const result = spawnSync(process.execPath, [script, ...args, '--json'], { cwd, encoding: 'utf8' });
  return {
    result,
    json: JSON.parse(result.stdout || result.stderr),
  };
}

function extractTargetModificationPaths() {
  const rows = asArray(readCheckpointImplementationConfirmation().targetModificationPaths);
  if (!rows.length) {
    throw new Error('targetModificationPaths block not found in checkpoint automation source document');
  }

  return rows.map((row) => ({
    id: row.id,
    path: row.path,
  }));
}

function readCheckpointImplementationConfirmation(): Record<string, any> {
  const source = fs.readFileSync(CHECKPOINT_REQUIREMENT_DOC, 'utf8');
  const match = source.match(/\nimplementationConfirmation:\n[\s\S]*?(?=\n## |\n# |$)/u);
  if (!match) {
    throw new Error('implementationConfirmation block not found in checkpoint automation source document');
  }
  const parsed = yaml.load(match[0]) as Record<string, any>;
  if (!parsed?.implementationConfirmation) {
    throw new Error('implementationConfirmation block is not valid YAML');
  }
  return parsed.implementationConfirmation as Record<string, any>;
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function refs(row: Record<string, any>, keys: string[]): string[] {
  return Array.from(
    new Set(keys.flatMap((key) => (Array.isArray(row[key]) ? row[key].filter((value: unknown) => typeof value === 'string') : [])))
  );
}

function writeSmallSource(root = tempDir): string {
  const file = path.join(root, 'small.md');
  fs.writeFileSync(
    file,
    `# Small Requirement

## Goal

Small single behavior with no governance modules.
`,
    'utf8'
  );
  return file;
}

function writeLargeSource(root = tempDir): string {
  const file = path.join(root, 'large.md');
  const sections = Array.from({ length: 32 }, (_, index) => `## Section ${index + 1}\n\nGovernance event, runtime recovery, script hook, dashboard score, current target map.\n`).join('\n');
  const ids = Array.from({ length: 28 }, (_, index) => `- MUST-${String(index + 1).padStart(3, '0')} requirement\n`).join('');
  fs.writeFileSync(file, `# Large Requirement\n\n${sections}\n${ids}\n`, 'utf8');
  return file;
}

function writeAmendmentRiskSource(root = tempDir): string {
  const file = path.join(root, 'amendment.md');
  fs.writeFileSync(
    file,
    `# Amendment Risk Requirement

This source has a blocking assumption and requires kernel amendment before materialization.

implementationConfirmation:
  contractSchemaVersion: 1
  status: reconfirm_required
  recordId: REQ-AMENDMENT-RISK
  requirementSetId: REQSET-AMENDMENT-RISK
  openQuestions:
    - id: Q-001
      text: "Which canonical writer owns record_closed?"
      blocksImplementation: true
  blockingAssumptions:
    - id: ASM-001
      text: "AI-TDD final runner report schema is not stable yet."
`,
    'utf8'
  );
  return file;
}

function completeImplementationConfirmation(): string {
  return `implementationConfirmation:
  contractSchemaVersion: 1
  status: draft
  recordId: REQ-GLOBAL-GATE
  requirementSetId: REQSET-GLOBAL-GATE
  entryFlow: standalone_tasks
  entryFlowClass: task_packet_entry
  workflowAdapter: bmad
  contractAuthoringRequired: true
  confirmationLanguage: zh-CN
  confirmationProfile: implementation_confirmation
  requiredViewPacks: []
  optionalViewPacks: []
  confirmedAt: null
  confirmedBy: null
  sourceDocumentHash: null
  implementationConfirmationHash: null
  confirmationRender:
    htmlPath: null
    summaryPath: null
    reportPath: null
    htmlHash: null
    confirmationPhrase: null
  applicability:
    governanceEvents:
      applies: false
      reasonCode: no_governance_event_or_control_envelope_changes
    runtimeRecovery:
      applies: false
      reasonCode: no_runtime_resume_or_recovery_runtime_changes
      requiresFunctionalResumeFailureCaseRegistry: false
      activeRequirementResolutionRequired: false
      retiredContextSurfaceForbidden: true
    scoringDashboardSft:
      applies: false
      reasonCode: no_scoring_dashboard_sft_dataset_or_read_model_changes
    currentTargetMap:
      applies: false
      reasonCode: no_current_target_migration_or_governance_comparison_needed
    scriptsAndHooks:
      applies: true
      reasonCode: checkpoint_runner_global_gate_changes
  must:
    - id: MUST-001
      text: "Checkpoint readiness requires whole-document trace consistency before HTML render."
      evidenceRefs: ["EVD-001"]
      coveredByTraceRows: ["TRACE-001"]
  notDone:
    - id: NEG-001
      text: "The runner must not report pre_render_ready when trace rows reference missing evidence or commands."
      evidenceRefs: ["EVD-002"]
      whyItBlocksCompletion: "A false ready result hides broken trace closure."
      negativeAssertionRequired: true
      coveredByFailurePath: ["FAIL-001"]
      coveredByTraceRows: ["TRACE-002"]
  mustNot:
    - id: OUT-001
      text: "This scope excludes user confirmation ingest changes."
      scopeBoundary: "Only checkpoint readiness gating changes are in scope."
      userApprovalRequiredIfChanged: true
  evidence:
    - id: EVD-001
      text: "Positive fixture proves the global gate can pass."
      gate: "npx vitest run tests/acceptance/requirements-contract-checkpoint-automation.test.ts"
      oracle: "Independent assertion verifies PASS report and zero blockers."
      requiredCommandRefs: ["CMD-CONTRACT-001"]
      artifactRefs: ["ART-001"]
    - id: EVD-002
      text: "Negative fixture proves missing trace references block readiness."
      gate: "npx vitest run tests/acceptance/requirements-contract-checkpoint-automation.test.ts"
      oracle: "Independent assertion verifies FAIL report includes missing-reference blockers."
      requiredCommandRefs: ["CMD-CONTRACT-001"]
      artifactRefs: ["ART-002"]
  failurePaths:
    - id: FAIL-001
      title: "Broken trace closure"
      trigger: "A trace row references missing evidence or command IDs."
      expectedBehavior: "Fail closed before HTML render and return a blocker report."
      forbiddenBehavior: "Return pre_render_ready."
      blocksCompletionWhenViolated: true
      linkedNegIds: ["NEG-001"]
      linkedEvidenceIds: ["EVD-002"]
      requiredAssertions: ["Exit non-zero", "Report missing references"]
  edgeCases:
    - id: EDGE-001
      category: stale_progress
      condition: "Progress says complete but the current source has broken trace closure."
      expectedBehavior: "Fail closed before HTML render."
      forbiddenBehavior: "Proceed to HTML render."
      linkedFailurePathIds: ["FAIL-001"]
      linkedEvidenceIds: ["EVD-002"]
  traceRows:
    - id: TRACE-001
      covers: ["MUST-001"]
      taskRefs: []
      evidenceRefs: ["EVD-001"]
      contractValidationCommandRefs: ["CMD-CONTRACT-001"]
      deliveryEvidenceCommandRefs: ["CMD-DELIVERY-001"]
    - id: TRACE-002
      covers: ["NEG-001"]
      taskRefs: []
      evidenceRefs: ["EVD-002"]
      contractValidationCommandRefs: ["CMD-CONTRACT-001"]
      deliveryEvidenceCommandRefs: ["CMD-DELIVERY-001"]
  sequenceViews:
    - id: SEQ-001
      title: "Global gate sequence"
      covers: ["MUST-001", "TRACE-001"]
  flowViews:
    - id: FLOW-001
      title: "Readiness failure flow"
      covers: ["NEG-001", "TRACE-002"]
  edgeCaseViews:
    - id: EDGEVIEW-001
      title: "Broken trace edge case"
      covers: ["EDGE-001", "FAIL-001"]
  boundaryViews:
    - id: BOUNDARY-001
      title: "Scope boundary"
      covers: ["OUT-001"]
  artifactAutomationPlan:
    - artifactId: ART-001
      path: "_bmad-output/runtime/requirement-records/REQ-GLOBAL-GATE/authoring/pre-render-global-consistency-report.json"
      artifactType: report
      canAffectControlFlow: false
      linkedEvidenceIds: ["EVD-001"]
    - artifactId: ART-002
      path: "_bmad-output/runtime/requirement-records/REQ-GLOBAL-GATE/authoring/pre-render-global-consistency-negative-report.json"
      artifactType: report
      canAffectControlFlow: false
      linkedEvidenceIds: ["EVD-002"]
  requiredCommands:
    - id: CMD-CONTRACT-001
      command: "npx vitest run tests/acceptance/requirements-contract-checkpoint-automation.test.ts"
      purpose: "Validate checkpoint global consistency behavior."
    - id: CMD-DELIVERY-001
      command: "npx vitest run tests/acceptance/requirements-contract-checkpoint-automation.test.ts"
      purpose: "Produce current delivery evidence for the checkpoint runner."
  suggestedCommands: []
  closeoutReadinessPreview:
    requiredCommands: ["CMD-CONTRACT-001", "CMD-DELIVERY-001"]
  requirementBoundary:
    business:
      requirementIds: ["MUST-001"]
      diagramRefs: ["SEQ-001"]
    governance:
      requirementIds: ["NEG-001"]
      diagramRefs: ["FLOW-001"]
`;
}

function writeGloballyConsistentSource(root = tempDir): string {
  const file = path.join(root, 'docs', 'requirements', 'source.md');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    `# Source

## Goal

Validate that checkpoint completion is not treated as global readiness.

${completeImplementationConfirmation()}`,
    'utf8'
  );
  return file;
}

function writeEighteenTraceFalsePositiveSource(root = tempDir): string {
  const file = path.join(root, 'docs', 'requirements', 'trace-false-positive.md');
  const traceRows = Array.from(
    { length: 18 },
    (_, index) => `    - id: TRACE-${String(index + 1).padStart(3, '0')}
      covers: ["MUST-001"]
      taskRefs: []
      evidenceRefs: ["EVD-MISSING"]
      contractValidationCommandRefs: ["CMD-CONTRACT-001"]
      deliveryEvidenceCommandRefs: ["CMD-DELIVERY-001"]`
  ).join('\n');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    `# Trace False Positive

implementationConfirmation:
  contractSchemaVersion: 1
  status: draft
  recordId: REQ-TRACE-FALSE-POSITIVE
  requirementSetId: REQSET-TRACE-FALSE-POSITIVE
  entryFlow: standalone_tasks
  entryFlowClass: task_packet_entry
  workflowAdapter: bmad
  contractAuthoringRequired: true
  confirmationLanguage: zh-CN
  confirmationProfile: implementation_confirmation
  applicability:
    governanceEvents:
      applies: false
      reasonCode: no_governance_event_or_control_envelope_changes
    runtimeRecovery:
      applies: false
      reasonCode: no_runtime_resume_or_recovery_runtime_changes
      requiresFunctionalResumeFailureCaseRegistry: false
      activeRequirementResolutionRequired: false
      retiredContextSurfaceForbidden: true
    scoringDashboardSft:
      applies: false
      reasonCode: no_scoring_dashboard_sft_dataset_or_read_model_changes
    currentTargetMap:
      applies: false
      reasonCode: no_current_target_migration_or_governance_comparison_needed
    scriptsAndHooks:
      applies: true
      reasonCode: checkpoint_runner_global_gate_changes
  must:
    - id: MUST-001
      text: "The runner requires every trace row to reference defined evidence."
      evidenceRefs: ["EVD-001"]
      coveredByTraceRows: ["TRACE-001"]
  notDone:
    - id: NEG-001
      text: "The runner must not accept trace rows with missing evidence."
      evidenceRefs: ["EVD-001"]
      whyItBlocksCompletion: "Missing evidence creates false trace closure."
      negativeAssertionRequired: true
      coveredByFailurePath: ["FAIL-001"]
      coveredByTraceRows: ["TRACE-002"]
  mustNot:
    - id: OUT-001
      text: "This source excludes renderer changes."
      scopeBoundary: "Only the pre-render gate is exercised."
      userApprovalRequiredIfChanged: true
  evidence:
    - id: EVD-001
      text: "Known evidence exists, but trace rows intentionally reference a missing one."
      gate: "npx vitest run tests/acceptance/requirements-contract-checkpoint-automation.test.ts"
      oracle: "Independent assertion verifies missing evidence blockers."
      requiredCommandRefs: ["CMD-CONTRACT-001"]
      artifactRefs: ["ART-001"]
  failurePaths:
    - id: FAIL-001
      title: "Missing trace evidence"
      trigger: "Trace row references EVD-MISSING."
      expectedBehavior: "Fail closed before HTML render."
      forbiddenBehavior: "Report pre_render_ready."
      blocksCompletionWhenViolated: true
      linkedNegIds: ["NEG-001"]
      linkedEvidenceIds: ["EVD-001"]
      requiredAssertions: ["Missing evidence is reported"]
  edgeCases:
    - id: EDGE-001
      category: trace_integrity
      condition: "Eighteen trace rows exist but point at missing evidence."
      expectedBehavior: "Fail closed."
      forbiddenBehavior: "Treat trace count as coverage."
      linkedFailurePathIds: ["FAIL-001"]
      linkedEvidenceIds: ["EVD-001"]
  traceRows:
${traceRows}
  sequenceViews:
    - id: SEQ-001
      title: "Trace check"
      covers: ["MUST-001", "TRACE-001"]
  flowViews:
    - id: FLOW-001
      title: "Blocked trace flow"
      covers: ["NEG-001", "TRACE-002"]
  edgeCaseViews:
    - id: EDGEVIEW-001
      title: "Trace edge"
      covers: ["EDGE-001", "FAIL-001"]
  boundaryViews:
    - id: BOUNDARY-001
      title: "Boundary"
      covers: ["OUT-001"]
  artifactAutomationPlan:
    - artifactId: ART-001
      path: "_bmad-output/runtime/requirement-records/REQ-TRACE-FALSE-POSITIVE/authoring/report.json"
      artifactType: report
      canAffectControlFlow: false
      linkedEvidenceIds: ["EVD-001"]
  requiredCommands:
    - id: CMD-CONTRACT-001
      command: "npx vitest run tests/acceptance/requirements-contract-checkpoint-automation.test.ts"
      purpose: "Validate missing evidence blockers."
    - id: CMD-DELIVERY-001
      command: "npx vitest run tests/acceptance/requirements-contract-checkpoint-automation.test.ts"
      purpose: "Produce delivery evidence."
  suggestedCommands: []
  closeoutReadinessPreview:
    requiredCommands: ["CMD-CONTRACT-001", "CMD-DELIVERY-001"]
`,
    'utf8'
  );
  return file;
}

function writeCurrentTargetHiddenFalsePositiveSource(root = tempDir): string {
  const file = path.join(root, 'docs', 'requirements', 'current-target-hidden.md');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    `# Current Target Hidden False Positive

implementationConfirmation:
  contractSchemaVersion: 1
  status: draft
  recordId: REQ-CURRENT-TARGET-HIDDEN
  requirementSetId: REQSET-CURRENT-TARGET-HIDDEN
  entryFlow: standalone_tasks
  entryFlowClass: task_packet_entry
  workflowAdapter: bmad
  contractAuthoringRequired: true
  confirmationLanguage: zh-CN
  confirmationProfile: implementation_confirmation
  requiredViewPacks: []
  optionalViewPacks: []
  confirmedAt: null
  confirmedBy: null
  sourceDocumentHash: null
  implementationConfirmationHash: null
  confirmationRender:
    htmlPath: null
    summaryPath: null
    reportPath: null
    htmlHash: null
    confirmationPhrase: null
  applicability:
    governanceEvents:
      applies: true
      reasonCode: current_target_governance_comparison_required
    runtimeRecovery:
      applies: false
      reasonCode: no_runtime_resume_or_recovery_runtime_changes
      requiresFunctionalResumeFailureCaseRegistry: false
      activeRequirementResolutionRequired: false
      retiredContextSurfaceForbidden: true
    scoringDashboardSft:
      applies: false
      reasonCode: no_scoring_dashboard_sft_dataset_or_read_model_changes
    currentTargetMap:
      applies: true
      reasonCode: current_target_comparison_required_before_confirmation
    scriptsAndHooks:
      applies: true
      reasonCode: current_target_script_path_comparison_required
  currentTargetMap:
    schemaVersion: current-target-map/v1
    displayProfile: closed_loop_current_target_map
    currentSummary:
      - title: "Current hidden state"
        detail: "The source has data but the confirmation page would hide it without the hard gate."
    targetSummary:
      - title: "Target visible state"
        detail: "The confirmation page must render this before user confirmation."
    diffRows:
      - dimension: "Display"
        currentState: "hidden"
        targetState: "visible"
        action: "require view pack"
      - dimension: "Coverage"
        currentState: "zero in report"
        targetState: "non-zero in report"
        action: "count source rows"
      - dimension: "Confirmability"
        currentState: "confirmable"
        targetState: "blocked"
        action: "fail closed"
    process:
      - phase: "scope_confirmation"
        currentState: "currentTargetMap can be hidden"
        targetState: "currentTargetMap is visible"
    artifactPaths:
      - path: "_bmad-output/runtime/requirement-records/<recordId>/confirmation/confirmation.html"
        targetRole: "confirmation_view"
    canonicalArtifacts:
      - targetPathOrField: "implementationConfirmation.currentTargetMap"
        functionDescription: "Visible current/target comparison"
        controlPlaneRole: "confirmation_gate"
  governanceEventTypeRegistry:
    - eventType: current_target_checked
      payloadContract:
        requiredFields: ["eventType"]
        forbiddenFields: ["decision"]
  must:
    - id: MUST-001
      text: "When currentTargetMap applies, confirmation is blocked unless currentTargetMap is a required view pack."
      evidenceRefs: ["EVD-001"]
      coveredByTraceRows: ["TRACE-001"]
  notDone:
    - id: NEG-001
      text: "The pre-render gate must not allow a confirmable page with hidden current/target comparison."
      evidenceRefs: ["EVD-001"]
      whyItBlocksCompletion: "The user cannot confirm the most important acceptance boundary."
      negativeAssertionRequired: true
      coveredByFailurePath: ["FAIL-001"]
      coveredByTraceRows: ["TRACE-001"]
  mustNot:
    - id: OUT-001
      text: "This fixture excludes delivery verification behavior."
      scopeBoundary: "Only pre-render current/target gating is exercised."
      userApprovalRequiredIfChanged: true
  evidence:
    - id: EVD-001
      text: "Pre-render gate fails when currentTargetMap applies but requiredViewPacks omits currentTargetMap."
      gate: "npx vitest run tests/acceptance/requirements-contract-checkpoint-automation.test.ts"
      oracle: "Report includes global_current_target_required_view_pack_missing."
      requiredCommandRefs: ["CMD-CONTRACT-001"]
      artifactRefs: ["ART-001"]
  failurePaths:
    - id: FAIL-001
      title: "Hidden current/target comparison"
      trigger: "applicability.currentTargetMap.applies=true but requiredViewPacks omits currentTargetMap."
      expectedBehavior: "Fail closed before HTML render."
      forbiddenBehavior: "Return pre_render_ready."
      blocksCompletionWhenViolated: true
      linkedNegIds: ["NEG-001"]
      linkedEvidenceIds: ["EVD-001"]
      requiredAssertions: ["currentTargetMap view pack missing is a blocker"]
  edgeCases:
    - id: EDGE-001
      category: hidden_confirmation_surface
      condition: "Structured currentTargetMap rows exist but are not enabled in the confirmation view."
      expectedBehavior: "Fail closed."
      forbiddenBehavior: "Generate a confirmable page."
      linkedFailurePathIds: ["FAIL-001"]
      linkedEvidenceIds: ["EVD-001"]
  traceRows:
    - id: TRACE-001
      covers: ["MUST-001", "NEG-001"]
      taskRefs: []
      evidenceRefs: ["EVD-001"]
      contractValidationCommandRefs: ["CMD-CONTRACT-001"]
      deliveryEvidenceCommandRefs: ["CMD-DELIVERY-001"]
  sequenceViews:
    - id: SEQ-001
      title: "Current target pre-render check"
      covers: ["MUST-001", "TRACE-001"]
  flowViews:
    - id: FLOW-001
      title: "Hidden comparison blocked"
      covers: ["NEG-001", "TRACE-001"]
  edgeCaseViews:
    - id: EDGEVIEW-001
      title: "Hidden current target edge"
      covers: ["EDGE-001", "FAIL-001"]
  boundaryViews:
    - id: BOUNDARY-001
      title: "Delivery out of scope"
      covers: ["OUT-001"]
  artifactAutomationPlan:
    - artifactId: ART-001
      path: "_bmad-output/runtime/requirement-records/REQ-CURRENT-TARGET-HIDDEN/authoring/pre-render-global-consistency-report.json"
      artifactType: report
      canAffectControlFlow: false
      linkedEvidenceIds: ["EVD-001"]
  requiredCommands:
    - id: CMD-CONTRACT-001
      command: "npx vitest run tests/acceptance/requirements-contract-checkpoint-automation.test.ts"
      purpose: "Validate currentTargetMap pre-render gate."
    - id: CMD-DELIVERY-001
      command: "npx vitest run tests/acceptance/requirements-contract-checkpoint-automation.test.ts"
      purpose: "Produce currentTargetMap fixture evidence."
  suggestedCommands: []
  closeoutReadinessPreview:
    requiredCommands: ["CMD-CONTRACT-001", "CMD-DELIVERY-001"]
`,
    'utf8'
  );
  return file;
}

function initGitRepo(root: string) {
  spawnSync('git', ['init'], { cwd: root, encoding: 'utf8' });
  spawnSync('git', ['config', 'user.email', 'test@example.invalid'], { cwd: root, encoding: 'utf8' });
  spawnSync('git', ['config', 'user.name', 'Test User'], { cwd: root, encoding: 'utf8' });
  fs.mkdirSync(path.join(root, 'docs', 'requirements'), { recursive: true });
}

describe('requirements contract checkpoint automation', () => {
  it('routes small requirements to single_pass', () => {
    const source = writeSmallSource();

    const { result, json } = runNode(ASSESS, ['--source', source]);

    expect(result.status).toBe(0);
    expect(json.decision).toBe('single_pass');
    expect(json.authoringMode).toBe('single_pass');
    expect(json.riskLevel).toBe('low');
    expect(json.recommendedCheckpoints).toEqual([]);
  });

  it('routes large or complex requirements to checkpoint_required', () => {
    const source = writeLargeSource();

    const { result, json } = runNode(ASSESS, ['--source', source]);

    expect(result.status).toBe(0);
    expect(json.decision).toBe('checkpoint_required');
    expect(json.authoringMode).toBe('kernel_then_checkpoint');
    expect(json.signals.applicableConditionalDomains).toEqual(
      expect.arrayContaining(['governanceEvents', 'runtimeRecovery', 'scriptsAndHooks'])
    );
    expect(json.recommendedCheckpoints).toContain('cp-01-header-scope-decisions');
  });

  it('routes to checkpoint_required when progress already exists', () => {
    const source = writeSmallSource();
    const progress = path.join(tempDir, 'semantic-checkpoint-progress.json');
    fs.writeFileSync(progress, JSON.stringify({ schemaVersion: 'semantic-checkpoint-progress/v1' }), 'utf8');

    const { result, json } = runNode(ASSESS, ['--source', source, '--progress', progress]);

    expect(result.status).toBe(0);
    expect(json.decision).toBe('checkpoint_required');
    expect(json.authoringMode).toBe('kernel_then_checkpoint_with_amendment');
    expect(json.signals.progressExists).toBe(true);
  });

  it('routes blocking definition or amendment risk to kernel checkpoint with amendment', () => {
    const source = writeAmendmentRiskSource();

    const { result, json } = runNode(ASSESS, ['--source', source]);

    expect(result.status).toBe(0);
    expect(json.decision).toBe('checkpoint_required');
    expect(json.authoringMode).toBe('kernel_then_checkpoint_with_amendment');
    expect(json.signals.amendmentRisk).toBe(true);
  });

  it('emits checkpoint plan in deterministic pre-render order', () => {
    const source = writeLargeSource();

    const { result, json } = runNode(CHECKPOINTS, ['--source', source, '--mode', 'plan']);

    expect(result.status).toBe(0);
    expect(json.authoringMode).toBe('kernel_then_checkpoint');
    expect(json.checkpoints.map((checkpoint: any) => checkpoint.id)).toEqual([
      'cp-01-header-scope-decisions',
      'cp-02-confirmation-core-applicability',
      'cp-03-must-neg-out-evidence',
      'cp-04-failure-edge-trace',
      'cp-05-views',
      'cp-06-artifacts-commands-closeout',
      'cp-07-conditional-modules',
      'cp-08-human-readable-views-dod-reverse-audit',
    ]);
    expect(json.nextCheckpoint).toBe('cp-01-header-scope-decisions');
  });

  it('reports status from progress without editing', () => {
    const source = writeSmallSource();
    const progress = path.join(tempDir, 'progress.json');
    fs.writeFileSync(
      progress,
      JSON.stringify(
        {
          schemaVersion: 'semantic-checkpoint-progress/v1',
          documentHash: 'sha256:not-current',
          next: 'cp-02-confirmation-core-applicability',
        },
        null,
        2
      ),
      'utf8'
    );

    const { result, json } = runNode(CHECKPOINTS, ['--source', source, '--progress', progress, '--mode', 'status']);

    expect(result.status).toBe(1);
    expect(json.code).toBe('document_hash_mismatch');
    expect(json.nextCheckpoint).toBe('cp-02-confirmation-core-applicability');
  });

  it('fails closed when unrelated staged files exist before checkpoint commit', () => {
    initGitRepo(tempDir);
    const source = path.join(tempDir, 'docs', 'requirements', 'source.md');
    const unrelated = path.join(tempDir, 'unrelated.txt');
    fs.writeFileSync(source, '# Source\n\nCheckpoint content.\n', 'utf8');
    fs.writeFileSync(unrelated, 'staged unrelated work\n', 'utf8');
    spawnSync('git', ['add', 'unrelated.txt'], { cwd: tempDir, encoding: 'utf8' });

    const { result, json } = runNode(
      CHECKPOINTS,
      ['--source', source, '--mode', 'run', '--checkpoint', 'cp-01-header-scope-decisions'],
      tempDir
    );

    expect(result.status).toBe(1);
    expect(json.code).toBe('staged_paths_exist_before_checkpoint');
    expect(json.stagedPaths).toEqual(['unrelated.txt']);
  });

  it('creates a single-file checkpoint commit and progress record', () => {
    initGitRepo(tempDir);
    const source = path.join(tempDir, 'docs', 'requirements', 'source.md');
    const progress = path.join(tempDir, 'progress.json');
    fs.writeFileSync(source, '# Source\n\nCheckpoint content.\n', 'utf8');

    const { result, json } = runNode(
      CHECKPOINTS,
      ['--source', source, '--progress', progress, '--mode', 'run', '--checkpoint', 'cp-01-header-scope-decisions'],
      tempDir
    );
    const committedFiles = spawnSync('git', ['show', '--name-only', '--format=', 'HEAD'], { cwd: tempDir, encoding: 'utf8' })
      .stdout.split(/\r?\n/u)
      .filter(Boolean);

    expect(result.status).toBe(0);
    expect(json.ok).toBe(true);
    expect(json.commitHash).toMatch(/^[a-f0-9]{40}$/u);
    expect(fs.existsSync(progress)).toBe(true);
    expect(JSON.parse(fs.readFileSync(progress, 'utf8')).lastCompletedCheckpoint).toBe('cp-01-header-scope-decisions');
    expect(JSON.parse(fs.readFileSync(progress, 'utf8')).checkpoints[0].idempotencyKey).toMatch(/^[a-f0-9]{64}$/u);
    expect(committedFiles).toEqual(['docs/requirements/source.md']);
  });

  it('does not create a duplicate checkpoint commit when progress idempotency key already matches current document', () => {
    initGitRepo(tempDir);
    const source = path.join(tempDir, 'docs', 'requirements', 'source.md');
    const progress = path.join(tempDir, 'progress.json');
    fs.writeFileSync(source, '# Source\n\nCheckpoint content.\n', 'utf8');
    runNode(CHECKPOINTS, ['--source', source, '--progress', progress, '--mode', 'run', '--checkpoint', 'cp-01-header-scope-decisions'], tempDir);
    const beforeCount = spawnSync('git', ['rev-list', '--count', 'HEAD'], { cwd: tempDir, encoding: 'utf8' }).stdout.trim();

    const { result, json } = runNode(
      CHECKPOINTS,
      ['--source', source, '--progress', progress, '--mode', 'run', '--checkpoint', 'cp-01-header-scope-decisions'],
      tempDir
    );
    const afterCount = spawnSync('git', ['rev-list', '--count', 'HEAD'], { cwd: tempDir, encoding: 'utf8' }).stdout.trim();

    expect(result.status).toBe(0);
    expect(json.noOp).toBe(true);
    expect(json.reason).toBe('checkpoint_already_recorded_for_current_document_and_commit');
    expect(afterCount).toBe(beforeCount);
  });

  it('recovers status from backup progress when the primary progress record is corrupt', () => {
    initGitRepo(tempDir);
    const source = path.join(tempDir, 'docs', 'requirements', 'source.md');
    const progress = path.join(tempDir, 'progress.json');
    fs.writeFileSync(source, '# Source\n\nCheckpoint content.\n', 'utf8');
    runNode(CHECKPOINTS, ['--source', source, '--progress', progress, '--mode', 'run', '--checkpoint', 'cp-01-header-scope-decisions'], tempDir);
    fs.copyFileSync(progress, `${progress}.bak`);
    fs.writeFileSync(progress, '{broken json', 'utf8');

    const { result, json } = runNode(CHECKPOINTS, ['--source', source, '--progress', progress, '--mode', 'status'], tempDir);

    expect(result.status).toBe(0);
    expect(json.status).toBe('ready');
    expect(json.recoveredFrom).toBe('backup');
    expect(json.nextCheckpoint).toBe('cp-02-confirmation-core-applicability');
  });

  it('recovers status from the latest git checkpoint when progress and backup are corrupt', () => {
    initGitRepo(tempDir);
    const source = path.join(tempDir, 'docs', 'requirements', 'source.md');
    const progress = path.join(tempDir, 'progress.json');
    fs.writeFileSync(source, '# Source\n\nCheckpoint content.\n', 'utf8');
    runNode(CHECKPOINTS, ['--source', source, '--progress', progress, '--mode', 'run', '--checkpoint', 'cp-01-header-scope-decisions'], tempDir);
    fs.writeFileSync(progress, '{broken json', 'utf8');
    fs.writeFileSync(`${progress}.bak`, '{also broken', 'utf8');

    const { result, json } = runNode(CHECKPOINTS, ['--source', source, '--progress', progress, '--mode', 'status'], tempDir);

    expect(result.status).toBe(0);
    expect(json.status).toBe('ready');
    expect(json.recoveredFrom).toBe('git_checkpoint');
    expect(json.nextCheckpoint).toBe('cp-02-confirmation-core-applicability');
  });

  it('continues run from recovered progress instead of replaying completed checkpoints', () => {
    initGitRepo(tempDir);
    const source = writeGloballyConsistentSource(tempDir);
    const progress = path.join(tempDir, 'progress.json');
    runNode(CHECKPOINTS, ['--source', source, '--progress', progress, '--mode', 'run', '--checkpoint', 'cp-01-header-scope-decisions'], tempDir);
    fs.copyFileSync(progress, `${progress}.bak`);
    fs.writeFileSync(progress, '{broken json', 'utf8');

    const { result, json } = runNode(CHECKPOINTS, ['--source', source, '--progress', progress, '--mode', 'run'], tempDir);
    const commitCount = spawnSync('git', ['rev-list', '--count', 'HEAD'], { cwd: tempDir, encoding: 'utf8' }).stdout.trim();

    expect(result.status).toBe(0);
    expect(json.completedCheckpoints.map((item: any) => item.checkpoint)).toEqual([
      'cp-02-confirmation-core-applicability',
      'cp-03-must-neg-out-evidence',
      'cp-04-failure-edge-trace',
      'cp-05-views',
      'cp-06-artifacts-commands-closeout',
      'cp-07-conditional-modules',
      'cp-08-human-readable-views-dod-reverse-audit',
    ]);
    expect(commitCount).toBe('8');
  });

  it('fails closed when checkpoint progress cannot be written after a checkpoint commit', () => {
    initGitRepo(tempDir);
    const source = path.join(tempDir, 'docs', 'requirements', 'source.md');
    const blockingParent = path.join(tempDir, 'not-a-directory');
    const progress = path.join(blockingParent, 'progress.json');
    fs.writeFileSync(source, '# Source\n\nCheckpoint content.\n', 'utf8');
    fs.writeFileSync(blockingParent, 'blocks progress directory creation\n', 'utf8');

    const { result, json } = runNode(
      CHECKPOINTS,
      ['--source', source, '--progress', progress, '--mode', 'run', '--checkpoint', 'cp-01-header-scope-decisions'],
      tempDir
    );

    expect(result.status).toBe(1);
    expect(json.code).toBe('progress_write_failed');
    expect(json.commitHash).toMatch(/^[a-f0-9]{40}$/u);
  });

  it('blocks pre-render readiness when checkpoint logs exist but global consistency is missing', () => {
    initGitRepo(tempDir);
    const source = path.join(tempDir, 'docs', 'requirements', 'source.md');
    const progress = path.join(tempDir, 'progress.json');
    fs.writeFileSync(source, '# Source\n\nCheckpoint content.\n', 'utf8');

    const { result, json } = runNode(CHECKPOINTS, ['--source', source, '--progress', progress, '--mode', 'run'], tempDir);
    const commitHashes = spawnSync('git', ['log', '--format=%H'], { cwd: tempDir, encoding: 'utf8' })
      .stdout.split(/\r?\n/u)
      .filter(Boolean);
    const committedFileSets = commitHashes.map((hash) =>
      spawnSync('git', ['show', '--name-only', '--format=', hash], { cwd: tempDir, encoding: 'utf8' })
        .stdout.split(/\r?\n/u)
        .filter(Boolean)
    );
    const savedProgress = JSON.parse(fs.readFileSync(progress, 'utf8'));

    expect(result.status).toBe(1);
    expect(json.ok).toBe(false);
    expect(json.code).toBe('pre_render_global_consistency_failed');
    expect(json.status).toBe('blocked');
    expect(json.completedCheckpoints.map((item: any) => item.checkpoint)).toEqual([
      'cp-01-header-scope-decisions',
      'cp-02-confirmation-core-applicability',
      'cp-03-must-neg-out-evidence',
      'cp-04-failure-edge-trace',
      'cp-05-views',
      'cp-06-artifacts-commands-closeout',
      'cp-07-conditional-modules',
      'cp-08-human-readable-views-dod-reverse-audit',
    ]);
    expect(commitHashes).toHaveLength(8);
    expect(committedFileSets).toEqual(Array.from({ length: 8 }, () => ['docs/requirements/source.md']));
    expect(savedProgress.lastCompletedCheckpoint).toBe('cp-08-human-readable-views-dod-reverse-audit');
    expect(savedProgress.next).toBeNull();
    expect(savedProgress.validation.globalConsistency).toBe('fail');
    expect(json.failedChecks).toContain('global_source_parse_failed');
    expect(fs.existsSync(path.join(tempDir, 'pre-render-global-consistency-report.json'))).toBe(true);
  });

  it('runs all pre-render checkpoints as separate commits and reports ready only after global consistency passes', () => {
    initGitRepo(tempDir);
    const source = writeGloballyConsistentSource(tempDir);
    const progress = path.join(tempDir, 'progress.json');

    const { result, json } = runNode(CHECKPOINTS, ['--source', source, '--progress', progress, '--mode', 'run'], tempDir);
    const commitHashes = spawnSync('git', ['log', '--format=%H'], { cwd: tempDir, encoding: 'utf8' })
      .stdout.split(/\r?\n/u)
      .filter(Boolean);
    const savedProgress = JSON.parse(fs.readFileSync(progress, 'utf8'));

    expect(result.status).toBe(0);
    expect(json.ok).toBe(true);
    expect(json.status).toBe('pre_render_ready');
    expect(json.completedCheckpoints).toHaveLength(8);
    expect(commitHashes).toHaveLength(8);
    expect(savedProgress.validation.globalConsistency).toBe('pass');
    expect(savedProgress.preRenderGlobalConsistency.verdict).toBe('PASS');
    expect(fs.existsSync(path.join(tempDir, 'pre-render-global-consistency-report.json'))).toBe(true);
  });

  it('resumes from progress next checkpoint and runs remaining checkpoints separately', () => {
    initGitRepo(tempDir);
    const source = writeGloballyConsistentSource(tempDir);
    const progress = path.join(tempDir, 'progress.json');
    runNode(
      CHECKPOINTS,
      ['--source', source, '--progress', progress, '--mode', 'run', '--checkpoint', 'cp-01-header-scope-decisions'],
      tempDir
    );

    const { result, json } = runNode(CHECKPOINTS, ['--source', source, '--progress', progress, '--mode', 'resume'], tempDir);
    const commitCount = spawnSync('git', ['rev-list', '--count', 'HEAD'], { cwd: tempDir, encoding: 'utf8' }).stdout.trim();
    const savedProgress = JSON.parse(fs.readFileSync(progress, 'utf8'));

    expect(result.status).toBe(0);
    expect(json.ok).toBe(true);
    expect(json.completedCheckpoints.map((item: any) => item.checkpoint)).toEqual([
      'cp-02-confirmation-core-applicability',
      'cp-03-must-neg-out-evidence',
      'cp-04-failure-edge-trace',
      'cp-05-views',
      'cp-06-artifacts-commands-closeout',
      'cp-07-conditional-modules',
      'cp-08-human-readable-views-dod-reverse-audit',
    ]);
    expect(commitCount).toBe('8');
    expect(savedProgress.next).toBeNull();
    expect(savedProgress.validation.globalConsistency).toBe('pass');
  });

  it('fails the pre-render gate for eighteen trace rows that reference missing evidence', () => {
    initGitRepo(tempDir);
    const source = writeEighteenTraceFalsePositiveSource(tempDir);
    const progress = path.join(tempDir, 'progress.json');

    const { result, json } = runNode(CHECKPOINTS, ['--source', source, '--progress', progress, '--mode', 'pre-render-gate'], tempDir);

    expect(result.status).toBe(1);
    expect(json.verdict).toBe('FAIL');
    expect(json.failedChecks).toContain('global_trace_unknown_evidence_ref');
    expect(json.issues.filter((issue: any) => issue.code === 'global_trace_unknown_evidence_ref')).toHaveLength(18);
  });

  it('fails the pre-render gate when currentTargetMap applies but the confirmation view pack is hidden', () => {
    initGitRepo(tempDir);
    const source = writeCurrentTargetHiddenFalsePositiveSource(tempDir);
    const progress = path.join(tempDir, 'progress.json');

    const { result, json } = runNode(CHECKPOINTS, ['--source', source, '--progress', progress, '--mode', 'pre-render-gate'], tempDir);

    expect(result.status).toBe(1);
    expect(json.verdict).toBe('FAIL');
    expect(json.failedChecks).toContain('global_current_target_required_view_pack_missing');
    expect(json.issues.map((issue: any) => issue.code)).toContain('global_current_target_required_view_pack_missing');
  });

  it('fails retention cleanup when no confirmed retention strategy is provided', () => {
    initGitRepo(tempDir);
    const source = path.join(tempDir, 'docs', 'requirements', 'source.md');
    fs.writeFileSync(source, '# Source\n', 'utf8');

    const { result, json } = runNode(RETENTION_CLEANUP, ['--source', source, '--mode', 'dry-run'], tempDir);

    expect(result.status).toBe(2);
    expect(json.verdict).toBe('FAIL');
    expect(json.message).toBe('missing confirmed retention strategy');
  });

  it('dry-runs retention cleanup without removing the source from index or local disk', () => {
    initGitRepo(tempDir);
    const source = path.join(tempDir, 'docs', 'requirements', 'source.md');
    const receipt = path.join(tempDir, 'retention-receipt.json');
    fs.writeFileSync(source, '# Source\n', 'utf8');
    spawnSync('git', ['add', 'docs/requirements/source.md'], { cwd: tempDir, encoding: 'utf8' });

    const { result, json } = runNode(
      RETENTION_CLEANUP,
      ['--source', source, '--strategy', 'confirmed-local-only', '--mode', 'dry-run', '--receipt', receipt],
      tempDir
    );
    const staged = spawnSync('git', ['diff', '--cached', '--name-only'], { cwd: tempDir, encoding: 'utf8' }).stdout
      .split(/\r?\n/u)
      .filter(Boolean);

    expect(result.status).toBe(0);
    expect(json.status).toBe('PASS');
    expect(json.mode).toBe('dry-run');
    expect(json.localFilePreserved).toBe(true);
    expect(fs.existsSync(source)).toBe(true);
    expect(fs.existsSync(receipt)).toBe(true);
    expect(staged).toEqual(['docs/requirements/source.md']);
  });

  it('applies retention cleanup by removing only the source from git index while preserving the local file', () => {
    initGitRepo(tempDir);
    const source = path.join(tempDir, 'docs', 'requirements', 'source.md');
    const receipt = path.join(tempDir, 'retention-receipt.json');
    fs.writeFileSync(source, '# Source\n', 'utf8');
    spawnSync('git', ['add', 'docs/requirements/source.md'], { cwd: tempDir, encoding: 'utf8' });

    const { result, json } = runNode(
      RETENTION_CLEANUP,
      ['--source', source, '--strategy', 'confirmed-local-only', '--mode', 'apply', '--receipt', receipt],
      tempDir
    );
    const staged = spawnSync('git', ['diff', '--cached', '--name-only'], { cwd: tempDir, encoding: 'utf8' }).stdout
      .split(/\r?\n/u)
      .filter(Boolean);
    const untracked = spawnSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: tempDir, encoding: 'utf8' }).stdout
      .split(/\r?\n/u)
      .filter(Boolean);

    expect(result.status).toBe(0);
    expect(json.status).toBe('PASS');
    expect(json.mode).toBe('apply');
    expect(json.command).toEqual(['git', 'rm', '--cached', '--', 'docs/requirements/source.md']);
    expect(json.localFilePreserved).toBe(true);
    expect(fs.existsSync(source)).toBe(true);
    expect(fs.existsSync(receipt)).toBe(true);
    expect(staged).toEqual([]);
    expect(untracked).toEqual(['docs/requirements/source.md', 'retention-receipt.json']);
  });

  it('keeps target modification paths aligned with reverse audit split implementation scope', () => {
    const rows = extractTargetModificationPaths();
    const paths = new Set(rows.map((row) => row.path));
    const requiredPaths = [
      '_bmad/skills/requirements-contract-authoring/scripts/audit_contract_confirmability.js',
      '_bmad/skills/requirements-contract-authoring/scripts/audit_implementation_readiness.js',
      '_bmad/skills/requirements-contract-authoring/scripts/audit_delivery_verification.js',
      '_bmad/skills/requirements-contract-authoring/scripts/audit_closeout_integrity.js',
      '_bmad/skills/requirements-contract-authoring/scripts/reverse_audit_contract.js',
      '_bmad/skills/requirements-contract-authoring/scripts/reverse_audit_stage_common.js',
      '_bmad/skills/requirements-contract-authoring/references/reverse-audit-gate.md',
      '_bmad/skills/requirements-contract-authoring/SKILL.md',
      'tests/acceptance/reverse-audit-contract.test.ts',
      'tests/acceptance/requirements-contract-authoring-skill-contract.test.ts',
      'scripts/main-agent-implementation-readiness-gate.ts',
      'scripts/main-agent-delivery-closeout-gate.ts',
      'scripts/strict-closeout-proof-gate.ts',
      'scripts/requirement-record-control-store.ts',
      '_bmad/_schemas/requirement-record.schema.json',
      '_bmad-output/runtime/requirement-records/<recordId>/authoring/reverse-audit-stage-cli-capability-report.json',
      '_bmad-output/runtime/requirement-records/<recordId>/authoring/reverse-audit-wrapper-compatibility-report.json',
      '_bmad-output/runtime/requirement-records/<recordId>/authoring/stage-boundary-regression-report.json',
      'scripts/ai-tdd-contract-gate.ts',
      'tests/acceptance/ai-tdd-contract-gate.test.ts',
    ];

    expect(rows).toHaveLength(27);
    expect(requiredPaths.filter((requiredPath) => !paths.has(requiredPath))).toEqual([]);
  });

  it('maps every FAIL and EDGE case to explicit NEG, acceptance or e2e, trace, evidence, and view coverage', () => {
    const confirmation = readCheckpointImplementationConfirmation();
    const failRows = asArray(confirmation.failurePaths);
    const edgeRows = asArray(confirmation.edgeCases);
    const traceRows = asArray(confirmation.traceRows);
    const acceptanceRows = [...asArray(confirmation.acceptanceTests), ...asArray(confirmation.e2eSuites)];
    const viewRows = [
      ...asArray(confirmation.sequenceViews),
      ...asArray(confirmation.flowViews),
      ...asArray(confirmation.edgeCaseViews),
      ...asArray(confirmation.boundaryViews),
    ];
    const failNegRefs = new Map(failRows.map((row) => [row.id, refs(row, ['linkedNegIds', 'negRefs'])]));

    const acceptanceFor = (key: 'failurePathRefs' | 'edgeCaseRefs', id: string) =>
      acceptanceRows.filter((row) => refs(row, [key]).includes(id));
    const traceFor = (negRefs: string[], evidenceRefs: string[]) =>
      traceRows.filter(
        (row) =>
          refs(row, ['covers']).some((ref) => negRefs.includes(ref)) ||
          refs(row, ['evidenceRefs']).some((ref) => evidenceRefs.includes(ref))
      );
    const viewFor = (id: string) =>
      viewRows.filter((row) => [...refs(row, ['covers']), ...refs(row, ['cases'])].includes(id));

    const failGaps = failRows.flatMap((row) => {
      const negRefs = refs(row, ['linkedNegIds', 'negRefs']);
      const evidenceRefs = refs(row, ['linkedEvidenceIds', 'evidenceRefs']);
      return [
        ...(negRefs.length > 0 ? [] : [`${row.id}:neg`]),
        ...(evidenceRefs.length > 0 ? [] : [`${row.id}:evidence`]),
        ...(traceFor(negRefs, evidenceRefs).length > 0 ? [] : [`${row.id}:trace`]),
        ...(acceptanceFor('failurePathRefs', row.id).length > 0 ? [] : [`${row.id}:acceptance`]),
        ...(viewFor(row.id).length > 0 ? [] : [`${row.id}:view`]),
      ];
    });
    const edgeGaps = edgeRows.flatMap((row) => {
      const failureRefs = refs(row, ['linkedFailurePathIds', 'failurePathRefs']);
      const negRefs = Array.from(new Set([...refs(row, ['linkedNegIds', 'negRefs']), ...failureRefs.flatMap((id) => failNegRefs.get(id) ?? [])]));
      const evidenceRefs = refs(row, ['linkedEvidenceIds', 'evidenceRefs']);
      return [
        ...(failureRefs.length + negRefs.length > 0 ? [] : [`${row.id}:failure-or-neg`]),
        ...(evidenceRefs.length > 0 ? [] : [`${row.id}:evidence`]),
        ...(traceFor(negRefs, evidenceRefs).length > 0 ? [] : [`${row.id}:trace`]),
        ...(acceptanceFor('edgeCaseRefs', row.id).length > 0 ? [] : [`${row.id}:acceptance`]),
        ...(viewFor(row.id).length > 0 ? [] : [`${row.id}:view`]),
      ];
    });

    expect(failRows.length).toBeGreaterThan(0);
    expect(edgeRows.length).toBeGreaterThan(0);
    expect(failGaps).toEqual([]);
    expect(edgeGaps).toEqual([]);
    expect(acceptanceRows.filter((row) => row.id !== 'ACC-001' && refs(row, ['failurePathRefs', 'edgeCaseRefs']).length > 0).length).toBeGreaterThan(0);
  });
});
