import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const RENDERER = path.join(
  ROOT,
  '_bmad',
  'skills',
  'requirements-contract-authoring',
  'scripts',
  'render-requirements-confirmation-html.ts'
);
const REVERSE_AUDIT = path.join(
  ROOT,
  '_bmad',
  'skills',
  'requirements-contract-authoring',
  'scripts',
  'reverse_audit_contract.js'
);
const PRE_RENDER_DRILLDOWN = path.join(
  ROOT,
  '_bmad',
  'skills',
  'requirements-contract-authoring',
  'scripts',
  'pre_render_definition_drilldown.js'
);

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reverse-audit-contract-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function writeMockMermaidBundle(): string {
  const file = path.join(tempDir, 'mock-mermaid.min.js');
  fs.writeFileSync(
    file,
    `window.mermaid={initialize:function(){},render:async function(){return {svg:'<svg></svg>'};}};`,
    'utf8'
  );
  return file;
}

function writeSource(overrides = ''): string {
  const file = path.join(tempDir, 'source.md');
  const acceptanceTestPath = path.join(tempDir, 'tests', 'acceptance', 'reverse-audit.acceptance.test.ts');
  const e2eTestPath = path.join(tempDir, 'tests', 'e2e', 'reverse-audit.e2e.test.ts');
  fs.mkdirSync(path.dirname(acceptanceTestPath), { recursive: true });
  fs.mkdirSync(path.dirname(e2eTestPath), { recursive: true });
  fs.writeFileSync(acceptanceTestPath, 'import { it } from "vitest"; it("acceptance oracle", () => {});\n', 'utf8');
  fs.writeFileSync(e2eTestPath, 'import { it } from "vitest"; it("e2e oracle", () => {});\n', 'utf8');
  const missingViews = overrides.includes('MISSING_VIEWS');
  const vague = overrides.includes('VAGUE_REQUIREMENT') ? ' and handle it efficiently as needed' : '';
  const sideEffect = overrides.includes('SIDE_EFFECT') ? ' and write a control file' : '';
  const conflict = overrides.includes('CONFLICT_OUT')
    ? 'Do not let the user confirm a scoped behavior.'
    : 'Do not expand beyond this fixture scope.';
  const contextTerm = overrides.includes('CONTEXT_TERM') ? ' LegacyTerm' : '';
  const commandRef = overrides.includes('UNKNOWN_COMMAND') ? 'CMD-MISSING' : 'CMD-001';
  const body = `# PRD: Reverse Audit Fixture

implementationConfirmation:
  contractSchemaVersion: 1
  status: ${overrides.includes('DRAFT') ? 'draft' : 'user_confirmed'}
  recordId: REQ-REV-AUDIT
  requirementSetId: REQSET-REV-AUDIT
  entryFlow: story
  entryFlowClass: full_story_entry
  workflowAdapter: bmad
  contractAuthoringRequired: true
  confirmationLanguage: zh-CN
  confirmationProfile: implementation_confirmation
  requiredViewPacks: []
  optionalViewPacks: []
  confirmedAt: "2026-05-25T00:00:00.000Z"
  confirmedBy: "fixture-user"
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
      reasonCode: fixture_uses_confirmation_render_events
    runtimeRecovery:
      applies: false
      reasonCode: no_resume_rerun_closeout_hook_ingest_or_trace_checkpoint_changes
      requiresFunctionalResumeFailureCaseRegistry: false
      activeRequirementResolutionRequired: false
      retiredContextSurfaceForbidden: true
    scoringDashboardSft:
      applies: false
      reasonCode: no_scoring_dashboard_sft_dataset_or_read_model_changes
    currentTargetMap:
      applies: false
      reasonCode: no_current_target_migration_or_governance_comparison_needed
    aiTddContractGate:
      applies: true
      reasonCode: fixture_must_project_contract_execution_manifest
    scriptsAndHooks:
      applies: false
      reasonCode: no_script_hook_report_or_generated_artifact_changes
  targetModificationPaths:
    - id: TARGET-MOD-001
      path: "_bmad/skills/requirements-contract-authoring/scripts/reverse_audit_contract.js"
      changeType: modify
      intent: "Keep reverse audit fixture aligned with contract execution manifest projection."
      ownerModel: requirements_contract_authoring
      requirementRefs: ["MUST-001", "NEG-001"]
      traceRefs: ["TRACE-001"]
      evidenceRefs: ["EVD-001"]
      artifactRefs: ["ART-EVD-001"]
      requiresReconfirmationOnChange: true
  must:
    - id: MUST-001
      text: "The user confirms a scoped behavior${vague}${sideEffect}${contextTerm}."
      textZh: "用户确认受控范围内的行为。"
      evidenceRefs: ["EVD-001"]
  notDone:
    - id: NEG-001
      text: "The workflow must not treat a smoke-only result as done."
      textZh: "工作流不得将 smoke-only 结果当作完成。"
      evidenceRefs: ["EVD-001"]
      whyItBlocksCompletion: "Smoke-only evidence can hide missing behavior."
      whyItBlocksCompletionZh: "Smoke-only 证据可能掩盖缺失行为。"
      negativeAssertionRequired: true
  mustNot:
    - id: OUT-001
      text: "${conflict}"
      textZh: "不得扩展到该夹具范围之外。"
      scopeBoundary: "fixture only"
      scopeBoundaryZh: "仅限夹具范围。"
      userApprovalRequiredIfChanged: true
  evidence:
    - id: EVD-001
      text: "Run acceptance with independent oracle."
      textZh: "使用独立 oracle 运行验收。"
      gate: "npm run test:e2e -- fixture"
      oracle: "Independent persisted state proves the behavior and rejects smoke-only completion."
      oracleZh: "独立持久化状态证明行为，并拒绝 smoke-only 完成。"
      requiredCommandRefs: ["${commandRef}"]
      artifactRefs: ["ART-EVD-001"]
      acceptanceType: acceptance_e2e
  openQuestions:${overrides.includes('BLOCKING_QUESTION') ? `
    - id: Q-001
      text: "User decision is still required."
      blocksImplementation: true
` : ' []'}
  failurePaths:
    - id: FAIL-001
      title: "Smoke-only result rejected"
      titleZh: "拒绝 smoke-only 结果"
      trigger: "Only exit code, stdout, HTTP 200, page render, or mock calls are available."
      triggerZh: "只有退出码、标准输出、HTTP 200、页面渲染或 mock 调用可用。"
      expectedBehavior: "Block completion until independent evidence exists."
      expectedBehaviorZh: "在独立证据存在之前阻断完成。"
      forbiddenBehavior: "Do not mark done from smoke-only proof."
      forbiddenBehaviorZh: "不得根据 smoke-only 证明标记完成。"
      blocksCompletionWhenViolated: true
      linkedNegIds: ["NEG-001"]
      linkedEvidenceIds: ["EVD-001"]
      viewRefs: ["EDGEVIEW-001"]
      requiredAssertions:
        - "Smoke-only proof is rejected."
  edgeCases:
    - id: EDGE-001
      category: smoke_only
      condition: "Only page render or mock call exists."
      conditionZh: "只有页面渲染或 mock 调用存在。"
      expectedBehavior: "Block completion."
      expectedBehaviorZh: "阻断完成。"
      forbiddenBehavior: "Do not claim completion."
      forbiddenBehaviorZh: "不得声称完成。"
      linkedFailurePathIds: ["FAIL-001"]
      linkedEvidenceIds: ["EVD-001"]
  traceRows:
    - id: TRACE-001
      covers: ["MUST-001", "NEG-001"${overrides.includes('BAD_TRACE_COVER') ? ', "MUST-999"' : ''}]
      taskRefs: ["TASK-001"${overrides.includes('BAD_TASK_REF') ? ', "MUST-999"' : ''}]
      evidenceRefs: ["EVD-001"${overrides.includes('BAD_TRACE_EVIDENCE') ? ', "EVD-999"' : ''}]
      contractValidationCommandRefs: ["CMD-001"]
      deliveryEvidenceCommandRefs: ["CMD-001"]
      acceptanceRefs: ["ACC-001", "E2E-001"${overrides.includes('BAD_ACCEPTANCE_REF') ? ', "ACC-999"' : ''}]
      sequenceViewRefs: ["SEQ-001"]
      boundaryViewRefs: ["BOUNDARY-001"]
      artifactRefs: ["ART-EVD-001"]
      status: PENDING
  acceptanceTests:
    - id: ACC-001
      file: "${acceptanceTestPath.replace(/\\/gu, '/')}"
      covers: ["MUST-001"${overrides.includes('BAD_ACCEPTANCE_COVER') ? ', "MUST-999"' : ''}]
      traceRows: ["TRACE-001"]
      evidenceRefs: ["EVD-001"]
      commandRefs: ["CMD-001"]
      failurePathRefs: ["FAIL-001"]
      positiveControl: true
      expectedPreImplementationState: expected_red
      oracle: "Independent persisted state proves the behavior."
  e2eSuites:
    - id: E2E-001
      file: "${e2eTestPath.replace(/\\/gu, '/')}"
      covers: ["NEG-001"]
      traceRows: ["TRACE-001"]
      evidenceRefs: ["EVD-001"]
      commandRefs: ["CMD-001"]
      edgeCaseRefs: ["EDGE-001"]
      negativeControls: ["NEG-001"]
      expectedPreImplementationState: expected_red
      oracle: "${overrides.includes('SMOKE_ONLY_ACCEPTANCE') ? 'HTTP 200' : 'Independent persisted state rejects smoke-only completion.'}"
  currentTargetMap:
    schemaVersion: current-target-map/v1
    displayProfile: closed_loop_current_target_map
    currentSummary:
      - id: CUR-001
        text: "Reverse audit wrapper validates confirmation render reports."
        textZh: "反向审计 wrapper 校验确认页渲染报告。"
        traceRefs: ["TRACE-001"]
        evidenceRefs: ["EVD-001"]
    targetSummary:
      - id: TAR-001
        text: "Reverse audit preserves stage semantics and AI-TDD manifest projection."
        textZh: "反向审计保留阶段语义和 AI-TDD manifest 投影。"
        traceRefs: ["TRACE-001"]
        evidenceRefs: ["EVD-001"]
    diffRows:
      - id: DIFF-001
        current: "Wrapper-only reverse audit fixture."
        target: "Fixture includes explicit AI-TDD manifest surfaces."
        targetZh: "夹具包含显式 AI-TDD manifest 表面。"
        traceRefs: ["TRACE-001"]
        evidenceRefs: ["EVD-001"]
      - id: DIFF-002
        current: "Command target can be hidden behind command text."
        target: "Command target file paths are visible."
        targetZh: "命令目标文件路径可见。"
        traceRefs: ["TRACE-001"]
        evidenceRefs: ["EVD-001"]
      - id: DIFF-003
        current: "Legacy smoke-only proof can appear complete."
        target: "Smoke-only proof is explicitly denied."
        targetZh: "明确否定 smoke-only 证明。"
        traceRefs: ["TRACE-001"]
        evidenceRefs: ["EVD-001"]
    process:
      - id: PROC-001
        from: "Render report"
        to: "Reverse audit"
        action: "Validate confirmability while keeping delivery readiness separate."
        actionZh: "校验可确认性，同时保持交付就绪独立。"
        traceRefs: ["TRACE-001"]
        evidenceRefs: ["EVD-001"]
    artifactPaths:
      - id: PATH-001
        path: "_bmad/skills/requirements-contract-authoring/scripts/reverse_audit_contract.js"
        role: "stage wrapper"
        traceRefs: ["TRACE-001"]
        evidenceRefs: ["EVD-001"]
    canonicalArtifacts:
      - id: CANON-001
        targetPathOrField: "_bmad/skills/requirements-contract-authoring/scripts/reverse_audit_contract.js"
        role: "canonical reverse audit wrapper"
        traceRefs: ["TRACE-001"]
        evidenceRefs: ["EVD-001"]
    existingArtifacts:
      - id: LEGACY-001
        currentPath: "_bmad/skills/requirements-contract-authoring/scripts/reverse_audit_contract.js"
        completionProofPolicy: not_completion_proof
        traceRefs: ["TRACE-001"]
        evidenceRefs: ["EVD-001"]
  requirementBoundary:
    business:
      description: "Fixture business behavior."
      requirementIds: ["MUST-001", "NEG-001"]
      viewRefs: ["SEQ-001", "FLOW-001", "EDGEVIEW-001"]
      diagramRefs: ["MERMAID-001"]
    governance:
      description: "Fixture governance boundary."
      requirementIds: ["OUT-001", "EVD-001"]
      viewRefs: ["BOUNDARY-001"]
      diagramRefs: ["MERMAID-002"]
  sequenceViews:${missingViews ? ' []' : ''}
${missingViews ? '' : `    - id: SEQ-001
      title: "Fixture happy and failure path"
      scope: business
      covers: ["MUST-001", "NEG-001", "EVD-001"]
`}
  flowViews:${missingViews ? ' []' : ''}
${missingViews ? '' : `    - id: FLOW-001
      title: "Fixture flow"
      scope: business
      covers: ["MUST-001", "NEG-001"]
`}
  edgeCaseViews:${missingViews ? ' []' : ''}
${missingViews ? '' : `    - id: EDGEVIEW-001
      title: "Smoke-only edge case"
      scope: business
      covers: ["NEG-001"]
      cases: ["EDGE-001"]
`}
  boundaryViews:${missingViews ? ' []' : ''}
${missingViews ? '' : `    - id: BOUNDARY-001
      title: "Fixture boundary"
      scope: governance
      covers: ["OUT-001"]
`}
  artifactAutomationPlan:
    - artifactId: ART-EVD-001
      path: "_bmad-output/runtime/fixture/evidence.json"
      artifactType: evidence
      sourceOfTruthRole: evidence
      ownerModel: requirement_confirmation
      producer: test
      consumer: reverse audit
      inputArtifacts: ["source.md"]
      outputArtifacts: ["evidence.json"]
      recordEventTypes: []
      canAffectControlFlow: false
      userApprovalRequired: false
      retention: short_lived
      cleanupPolicy: keep_until_reconfirmed
      orphanRisk: low
      containsSensitiveData: false
      trainingDataEligible: false
  requiredCommands:
    - id: CMD-001
      command: "npx vitest run ${acceptanceTestPath.replace(/\\/gu, '/')} ${e2eTestPath.replace(/\\/gu, '/')}"
  suggestedCommands: []
  closeoutReadinessPreview:
    requiredCommands: ["CMD-001"]
    orphanPolicy: "block orphan artifacts"
    currentAttemptPolicy: "current attempt only"
  governanceEventTypeRegistryPolicy:
    controlFieldVocabulary: ["artifactIndex"]
    payloadKindContracts:
      - payloadKind: artifactRefs
        requiredFields: ["eventType", "artifactRefs"]
        forbiddenFields: ["result", "decision", "status"]
        allowedControlWriteModes: ["artifact_only"]
    controlWriteModePolicies:
      - allowedControlWriteMode: artifact_only
        allowedWritesControlFields: ["artifactIndex"]
    eventSpecificRequirements: []
  governanceEventTypeRegistry:
    - eventType: confirmation_view_rendered
      ownerModel: requirements
      payloadKind: artifactRefs
      writesControlFields: ["artifactIndex"]
      canAffectControlFlow: false
      payloadContract:
        requiredFields: ["eventType", "artifactRefs"]
        forbiddenFields: ["result", "decision", "status"]
        requiredSourceRefs: false
        allowedControlWriteMode: artifact_only
  controlledIngestWriterRegistry:
    - writerId: confirmation-renderer
      scriptPath: "_bmad/skills/requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts"
      scriptContentHash: "sha256:fixture-renderer"
      ownerModel: requirement_confirmation
      allowedWriteApis: ["appendArtifactIndex"]
      allowedPaths:
        - "_bmad-output/runtime/requirement-records/<requirement-set-id>/artifact-index.jsonl"
      allowedEventTypes: ["confirmation_view_rendered"]
      payloadContractRefs: ["confirmation_view_rendered"]
      writesControlFields: ["artifactIndex"]
      receiptPath: "_bmad-output/runtime/requirement-records/<requirement-set-id>/receipts/confirmation-renderer/<receipt-id>.json"
      beforeAfterHashRequired: true
      canModifyWriterRegistry: false
      registryHash: "sha256:fixture-registry"
      architectureConfirmationHash: "sha256:fixture-architecture"

## Reverse Audit Report

Verdict: PASS
Mode: scripted
Audit command: \`node _bmad/skills/requirements-contract-authoring/scripts/reverse_audit_contract.js source.md\`

### implementationConfirmation Findings
### HTML Confirmation Findings
### Reconfirmation Findings
### ID Reference Findings
### Diagram And Step Findings
### Artifact Automation Plan Findings
### traceRows Findings
### Row Quality Findings
### E2E Anti-Smoke Findings
Must Not Count As Done: exit code only, stdout, HTTP 200, page render, and mock calls.
### Open Findings

## Definition of Done

- Independent acceptance evidence exists.
- Smoke-only proof is rejected.

\`\`\`mermaid
sequenceDiagram
  actor User
  participant System
  User->>System: Confirm fixture [MUST-001][EVD-001]
  System-->>User: Reject smoke-only done [NEG-001][EVD-001]
\`\`\`

\`\`\`mermaid
flowchart TD
  A[Scope boundary OUT-001] --> B[Evidence EVD-001]
\`\`\`
`;
  fs.writeFileSync(file, body, 'utf8');
  return file;
}

function runRenderer(source: string) {
  const out = path.join(tempDir, 'confirmation.html');
  const result = spawnSync(
    process.execPath,
    [
      RENDERER,
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      writeMockMermaidBundle(),
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-REV-AUDIT',
      '--entry-flow',
      'story',
      '--strict',
      'false',
      '--json',
    ],
    { cwd: ROOT, encoding: 'utf8' }
  );
  const reportPath = path.join(tempDir, 'confirmation-render-report.json');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  return { result, report, reportPath, out };
}

function patchConfirmationRender(source: string, render: { report: any; reportPath: string; out: string }) {
  const original = fs.readFileSync(source, 'utf8');
  const patched = original
    .replace('  sourceDocumentHash: null', `  sourceDocumentHash: "${render.report.sourceDocumentHash}"`)
    .replace(
      '  implementationConfirmationHash: null',
      `  implementationConfirmationHash: "${render.report.implementationConfirmationHash}"`
    )
    .replace(
    /  confirmationRender:\n    htmlPath: null\n    summaryPath: null\n    reportPath: null\n    htmlHash: null\n    confirmationPhrase: null/u,
    `  confirmationRender:
    htmlPath: "${render.out.replace(/\\/g, '/')}"
    summaryPath: "${path.join(tempDir, 'confirmation-summary.json').replace(/\\/g, '/')}"
    reportPath: "${render.reportPath.replace(/\\/g, '/')}"
    htmlHash: "${render.report.confirmationPageHash}"
    confirmationPhrase: ${JSON.stringify(render.report.confirmInstruction)}`
  );
  fs.writeFileSync(source, patched, 'utf8');
}

function runReverseAudit(source: string, reportPath: string, extraArgs: string[] = []) {
  const result = spawnSync(process.execPath, [REVERSE_AUDIT, source, '--render-report', reportPath, ...extraArgs, '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return {
    result,
    report: JSON.parse(result.stdout),
  };
}

function runDefinitionAudit(source: string) {
  const result = spawnSync(process.execPath, [REVERSE_AUDIT, source, '--definition-only', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return {
    result,
    report: JSON.parse(result.stdout),
  };
}

function runPreRenderDrilldown(source: string, extraArgs: string[] = []) {
  const result = spawnSync(process.execPath, [PRE_RENDER_DRILLDOWN, source, ...extraArgs, '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return {
    result,
    report: JSON.parse(result.stdout),
  };
}

describe('reverse_audit_contract', () => {
  it('passes with a confirmable render report and carries delivery readiness separately', () => {
    const source = writeSource();
    const render = runRenderer(source);
    expect(render.result.status).toBe(0);
    patchConfirmationRender(source, render);

    const audit = runReverseAudit(source, render.reportPath);

    expect(audit.result.status, JSON.stringify({
      failedChecks: audit.report.failedChecks,
      findings: audit.report.findings,
    })).toBe(0);
    expect(audit.report.verdict).toBe('PASS');
    expect(audit.report.rendererAuthority.confirmability).toBe('confirmable');
    expect(audit.report.rendererAuthority.deliveryReadiness.ready).toBe(false);
    expect(audit.report.failedChecks).toEqual([]);
  });

  it('fails when renderer blockingIssues are present', () => {
    const source = writeSource('MISSING_VIEWS');
    const render = runRenderer(source);
    expect(render.report.confirmability).toBe('blocked');
    patchConfirmationRender(source, render);

    const audit = runReverseAudit(source, render.reportPath);

    expect(audit.result.status).toBe(1);
    expect(audit.report.failedChecks).toContain('render_report_not_confirmable');
    expect(audit.report.failedChecks).toContain('missing_sequence_views');
    expect(audit.report.failedChecks).toContain('missing_flow_views');
  });

  it('fails when current source hash no longer matches the render report', () => {
    const source = writeSource();
    const render = runRenderer(source);
    patchConfirmationRender(source, render);
    fs.appendFileSync(source, '\n\nAdditional unrendered semantic text [MUST-001].\n', 'utf8');

    const audit = runReverseAudit(source, render.reportPath);

    expect(audit.result.status).toBe(1);
    expect(audit.report.failedChecks).toContain('render_report_source_hash_mismatch');
  });

  it('fails when confirmed source bookkeeping hashes are stale', () => {
    const source = writeSource();
    const render = runRenderer(source);
    patchConfirmationRender(source, render);
    const patched = fs
      .readFileSync(source, 'utf8')
      .replace(`sourceDocumentHash: "${render.report.sourceDocumentHash}"`, 'sourceDocumentHash: "sha256:stale"');
    fs.writeFileSync(source, patched, 'utf8');

    const audit = runReverseAudit(source, render.reportPath);

    expect(audit.result.status).toBe(1);
    expect(audit.report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'confirmed_source_hash_stale',
          source: 'reverse_audit',
        }),
      ])
    );
  });

  it('fails when open questions still block implementation', () => {
    const source = writeSource('BLOCKING_QUESTION');
    const render = runRenderer(source);
    patchConfirmationRender(source, render);

    const audit = runReverseAudit(source, render.reportPath);

    expect(audit.result.status).toBe(1);
    expect(audit.report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'blocking_open_question',
          source: 'reverse_audit',
          refs: ['Q-001'],
        }),
      ])
    );
  });

  it('reports missing reconfirmation request details when reconfirmation is required', () => {
    const source = writeSource('DRAFT');
    const text = fs.readFileSync(source, 'utf8').replace('status: draft', 'status: reconfirm_required');
    fs.writeFileSync(source, text, 'utf8');
    const render = runRenderer(source);
    patchConfirmationRender(source, render);

    const audit = runReverseAudit(source, render.reportPath);

    expect(audit.result.status).toBe(1);
    expect(audit.report.failedChecks).toContain('reconfirmation_required_unresolved');
    expect(audit.report.failedChecks).toContain('missing_reconfirmation_request');
  });

  it('fails when traceRows reference unknown covers, evidence, or contract task refs', () => {
    const source = writeSource('BAD_TRACE_COVER BAD_TRACE_EVIDENCE BAD_TASK_REF');
    const render = runRenderer(source);
    patchConfirmationRender(source, render);

    const audit = runReverseAudit(source, render.reportPath);

    expect(audit.result.status).toBe(1);
    expect(audit.report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'trace_row_unknown_cover_ref', source: 'reverse_audit' }),
        expect.objectContaining({ code: 'trace_row_unknown_evidence_ref', source: 'reverse_audit' }),
        expect.objectContaining({ code: 'trace_row_unknown_task_contract_ref', source: 'reverse_audit' }),
      ])
    );
  });

  it('fails when ACC/E2E refs are missing, unknown, or smoke-only', () => {
    const source = writeSource('BAD_ACCEPTANCE_REF BAD_ACCEPTANCE_COVER SMOKE_ONLY_ACCEPTANCE');
    const render = runRenderer(source);
    patchConfirmationRender(source, render);

    const audit = runReverseAudit(source, render.reportPath);

    expect(audit.result.status).toBe(1);
    expect(audit.report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'trace_row_unknown_acceptance_ref', source: 'reverse_audit' }),
        expect.objectContaining({ code: 'acceptance_unknown_requirement_ref', source: 'reverse_audit' }),
        expect.objectContaining({ code: 'acceptance_oracle_smoke_only', source: 'reverse_audit' }),
      ])
    );
  });

  it('adds deterministic definition drilldown warnings and blockers', () => {
    const source = writeSource('VAGUE_REQUIREMENT UNKNOWN_COMMAND');
    const render = runRenderer(source);
    patchConfirmationRender(source, render);

    const audit = runReverseAudit(source, render.reportPath);

    expect(audit.result.status).toBe(1);
    expect(audit.report.failedChecks).toContain('definition_unresolved_authority_ref');
    expect(audit.report.warningChecks).toContain('definition_ambiguous_language');
    expect(audit.report.definitionDrilldown.questions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'unresolved_authority_ref' }),
        expect.objectContaining({ category: 'ambiguous_language' }),
      ])
    );
  });

  it('runs definition drilldown before render without requiring a render report', () => {
    const source = writeSource('VAGUE_REQUIREMENT UNKNOWN_COMMAND');

    const audit = runDefinitionAudit(source);

    expect(audit.result.status).toBe(1);
    expect(audit.report.mode).toBe('definition-only');
    expect(audit.report.sourceDocumentHash).toMatch(/^sha256:/);
    expect(audit.report.implementationConfirmationHash).toMatch(/^sha256:/);
    expect(audit.report.failedChecks).toContain('definition_unresolved_authority_ref');
    expect(audit.report.warningChecks).toContain('definition_ambiguous_language');
    expect(audit.report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'definition_drilldown',
          status: 'open',
          summary: expect.stringContaining('references command CMD-MISSING'),
        }),
      ])
    );
  });

  it('runs the independent pre-render drilldown script and detects side effects plus contradictions', () => {
    const source = writeSource('SIDE_EFFECT CONFLICT_OUT');
    const out = path.join(tempDir, 'grill-definition-report.json');

    const audit = runPreRenderDrilldown(source, ['--out', out]);

    expect(audit.result.status).toBe(1);
    expect(fs.existsSync(out)).toBe(true);
    expect(audit.report.mode).toBe('definition-only');
    expect(audit.report.failedChecks).toContain('definition_external_side_effect_incomplete');
    expect(audit.report.failedChecks).toContain('definition_contradiction_matrix');
    expect(audit.report.contextHash).toMatch(/^sha256:/);
  });

  it('suppresses unchanged previous blockers when changed-only is requested', () => {
    const source = writeSource('SIDE_EFFECT CONFLICT_OUT');
    const previous = path.join(tempDir, 'previous-definition-report.json');

    const first = runPreRenderDrilldown(source, ['--out', previous]);
    const second = runPreRenderDrilldown(source, ['--previous-report', previous, '--changed-only']);

    expect(first.result.status).toBe(1);
    expect(second.result.status).toBe(0);
    expect(second.report.verdict).toBe('PASS');
    expect(second.report.convergence.stopReason).toBe('no_new_blockers');
    expect(second.report.convergence.newBlockingCount).toBe(0);
    expect(second.report.convergence.suppressedPreviousCount).toBeGreaterThan(0);
    expect(second.report.findings).toEqual([]);
  });

  it('suppresses resolved definition blockers through the resolution ledger', () => {
    const source = writeSource('SIDE_EFFECT');
    const first = runPreRenderDrilldown(source);
    const ledger = path.join(tempDir, 'definition-resolutions.json');

    expect(first.result.status).toBe(1);
    expect(first.report.findings[0].fingerprint).toMatch(/^fp:/);
    fs.writeFileSync(
      ledger,
      JSON.stringify(
        {
          resolutions: [
            {
              fingerprint: first.report.findings[0].fingerprint,
              status: 'waived',
              reason: 'fixture waiver',
              sourceDocumentHash: first.report.sourceDocumentHash,
              implementationConfirmationHash: first.report.implementationConfirmationHash,
              contextHash: first.report.contextHash,
            },
          ],
        },
        null,
        2
      ),
      'utf8'
    );

    const second = runPreRenderDrilldown(source, ['--resolutions', ledger]);

    expect(second.result.status).toBe(0);
    expect(second.report.verdict).toBe('PASS');
    expect(second.report.convergence.suppressedResolvedCount).toBe(1);
    expect(second.report.suppressedFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fingerprint: first.report.findings[0].fingerprint,
          status: 'waived',
          suppressedBy: 'resolution_ledger',
        }),
      ])
    );
  });

  it('limits emitted new blockers while preserving total blocker counts', () => {
    const source = writeSource('SIDE_EFFECT CONFLICT_OUT');

    const audit = runPreRenderDrilldown(source, ['--max-new-blockers', '1']);

    expect(audit.result.status).toBe(1);
    expect(audit.report.convergence.newBlockingCount).toBeGreaterThan(1);
    expect(audit.report.convergence.emittedBlockingCount).toBe(1);
    expect(audit.report.convergence.truncatedBlockingCount).toBeGreaterThan(0);
    expect(audit.report.findings.filter((item: any) => item.severity !== 'warning')).toHaveLength(1);
  });

  it('emits a decision packet for remaining blocking definition clusters', () => {
    const source = writeSource('SIDE_EFFECT CONFLICT_OUT');
    const packetPath = path.join(tempDir, 'definition-decision-packet.json');

    const audit = runPreRenderDrilldown(source, ['--emit-decision-packet', packetPath]);
    const packet = JSON.parse(fs.readFileSync(packetPath, 'utf8'));

    expect(audit.result.status).toBe(1);
    expect(packet.schemaVersion).toBe('pre-render-definition-drilldown-decision-packet/v1');
    expect(packet.sourceDocumentHash).toBe(audit.report.sourceDocumentHash);
    expect(packet.implementationConfirmationHash).toBe(audit.report.implementationConfirmationHash);
    expect(packet.contextHash).toBe(audit.report.contextHash);
    expect(packet.stopReason).toBe('requires_user_decision');
    expect(packet.remainingBlockingClusters.length).toBeGreaterThan(0);
    expect(packet.recommendedActions).toEqual(
      expect.arrayContaining([expect.stringMatching(/add_evidence_oracle|split_requirement|convert_to_open_question/)])
    );
  });

  it('reads glossary terms from CONTEXT-MAP multi-context references', () => {
    const contextDir = path.join(tempDir, 'domain');
    fs.mkdirSync(contextDir, { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, 'CONTEXT-MAP.md'),
      `# Context Map\n\n- domain: domain/CONTEXT.md\n`,
      'utf8'
    );
    fs.writeFileSync(
      path.join(contextDir, 'CONTEXT.md'),
      `# Domain Context\n\n**CanonicalTerm**:\nUse this term for the domain concept.\n_Avoid_: LegacyTerm\n`,
      'utf8'
    );
    const source = writeSource('CONTEXT_TERM');

    const audit = spawnSync(process.execPath, [PRE_RENDER_DRILLDOWN, source, '--json'], {
      cwd: tempDir,
      encoding: 'utf8',
    });
    const report = JSON.parse(audit.stdout);

    expect(audit.status).toBe(1);
    expect(report.failedChecks).toContain('definition_glossary_conflict');
    expect(report.contextRefs).toEqual(expect.arrayContaining([expect.stringContaining('domain/CONTEXT.md')]));
  });

  it('fails delivery readiness only in readiness mode', () => {
    const source = writeSource();
    const render = runRenderer(source);
    patchConfirmationRender(source, render);

    const implementationAudit = runReverseAudit(source, render.reportPath);
    const readinessAudit = runReverseAudit(source, render.reportPath, ['--mode', 'readiness']);

    expect(implementationAudit.result.status).toBe(0);
    expect(readinessAudit.result.status).toBe(1);
    expect(readinessAudit.report.failedChecks).toContain('delivery_readiness_not_ready');
  });

  it('fails when render report confirmInstruction does not include the current hashes', () => {
    const source = writeSource();
    const render = runRenderer(source);
    patchConfirmationRender(source, render);
    const staleReportPath = path.join(tempDir, 'stale-confirmation-render-report.json');
    fs.writeFileSync(
      staleReportPath,
      JSON.stringify(
        {
          ...render.report,
          confirmInstruction: '确认以上范围进入下一阶段 sourceDocumentHash=sha256:stale',
        },
        null,
        2
      ),
      'utf8'
    );

    const audit = runReverseAudit(source, staleReportPath);

    expect(audit.result.status).toBe(1);
    expect(audit.report.failedChecks).toContain('render_report_confirm_instruction_hash_mismatch');
  });

  it('fails when an external grill report has unresolved blocking findings', () => {
    const source = writeSource();
    const render = runRenderer(source);
    patchConfirmationRender(source, render);
    const grillReport = path.join(tempDir, 'grill-definition-audit.json');
    fs.writeFileSync(
      grillReport,
      JSON.stringify(
        {
          status: 'blocked',
          sourceDocumentHash: render.report.sourceDocumentHash,
          implementationConfirmationHash: render.report.implementationConfirmationHash,
          findings: [
            {
              code: 'grill_term_conflict',
              severity: 'blocking',
              status: 'open',
              summary: 'Domain term conflicts with CONTEXT.md',
              requirementIds: ['MUST-001'],
            },
            {
              code: 'grill_minor_wording',
              severity: 'warning',
              status: 'open',
              summary: 'Minor wording issue',
            },
          ],
        },
        null,
        2
      ),
      'utf8'
    );

    const audit = runReverseAudit(source, render.reportPath, ['--grill-report', grillReport]);

    expect(audit.result.status).toBe(1);
    expect(audit.report.grillReport.openBlockingCount).toBe(1);
    expect(audit.report.failedChecks).toContain('grill_term_conflict');
  });

  it('fails when an external grill report is stale for the current source hashes', () => {
    const source = writeSource();
    const render = runRenderer(source);
    patchConfirmationRender(source, render);
    const grillReport = path.join(tempDir, 'stale-grill-definition-audit.json');
    fs.writeFileSync(
      grillReport,
      JSON.stringify(
        {
          status: 'pass',
          sourceDocumentHash: 'sha256:stale',
          implementationConfirmationHash: render.report.implementationConfirmationHash,
          findings: [],
        },
        null,
        2
      ),
      'utf8'
    );

    const audit = runReverseAudit(source, render.reportPath, ['--grill-report', grillReport]);

    expect(audit.result.status).toBe(1);
    expect(audit.report.grillReport.hashStatus).toBe('stale_or_incomplete');
    expect(audit.report.failedChecks).toContain('grill_report_source_hash_stale');
  });
});
