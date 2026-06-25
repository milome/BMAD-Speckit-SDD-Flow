import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SKILL_SCRIPTS = path.join(ROOT, '_bmad', 'skills', 'requirements-contract-authoring', 'scripts');
const NORMALIZE = path.join(SKILL_SCRIPTS, 'normalize-draft-markdown.js');
const MANIFEST = path.join(SKILL_SCRIPTS, 'generate-draft-manifest.js');
const PROMOTE = path.join(SKILL_SCRIPTS, 'promote-draft-large-doc.js');
const requireForTest = createRequire(import.meta.url);
const {
  extractImplementationConfirmation,
  sourceDocumentHashFor,
  implementationConfirmationHashFor,
} = requireForTest(path.join(SKILL_SCRIPTS, 'pre_render_definition_drilldown_lib.js'));

const REQUIRED_CHECKPOINT_IDS = [
  'cp-00-semantic-kernel',
  'cp-01-must-decomposition-packet',
  'cp-02-atomic-decomposition-loop-convergence',
  'cp-03-packet-to-source-materialization',
  'cp-04-id-freeze',
  'cp-05-implementation-confirmation-core',
  'cp-06-projections',
  'cp-07-human-readable-views',
  'cp-08-pre-render-global-reconciliation',
];

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'req-contract-large-doc-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function runNode(script: string, args: string[], cwd = ROOT) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  let json: any = null;
  if (output) {
    json = JSON.parse(output);
  }
  return { result, json, output };
}

function write(fileName: string, content: string): string {
  const filePath = path.join(tempDir, fileName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

function stableStringify(value: any): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function sha256Json(value: any): string {
  return `sha256:${crypto.createHash('sha256').update(stableStringify(value), 'utf8').digest('hex')}`;
}

function sha256Text(value: string): string {
  return `sha256:${crypto.createHash('sha256').update(Buffer.from(value, 'utf8')).digest('hex')}`;
}

function writeJson(fileName: string, value: any): string {
  return write(fileName, `${JSON.stringify(value, null, 2)}\n`);
}

function writeAuthoringPromotionGuard(
  name: string,
  options: {
    draftPath: string;
    targetPath: string;
    routeDecision?: string;
    includeCheckpointEvidence?: boolean;
    sourceMutationFinalDecision?: string;
    encodingFindings?: any[];
    sourceDocumentHashBefore?: string;
    sourceDocumentHashAfter?: string;
    sourceDocumentExistedBefore?: boolean;
  }
): { args: string[]; paths: Record<string, string> } {
  const routeDecision = options.routeDecision ?? 'single_pass_final_allowed';
  const targetExists = fs.existsSync(options.targetPath);
  const targetHash = targetExists ? sha256Text(fs.readFileSync(options.targetPath, 'utf8')) : 'absent';
  const draftHash = sha256Text(fs.readFileSync(options.draftPath, 'utf8'));
  const scaleAssessment = {
    schemaVersion: 'contract-authoring-scale-assessment/v1',
    phase: 'initial_assessment',
    target: path.join(tempDir, `${name}-intake-source.md`).replace(/\\/g, '/'),
    decision: routeDecision === 'single_pass_final_allowed' ? 'single_pass_allowed' : routeDecision,
    assessmentTrace: {
      visibleOutputStream: 'stderr',
      stdoutContract: 'json_only',
      start: {
        phase: 'initial_assessment',
        source: path.join(tempDir, `${name}-intake-source.md`).replace(/\\/g, '/'),
        progressPath: path.join(tempDir, `${name}-semantic-checkpoint-progress.json`).replace(/\\/g, '/'),
      },
      process: {
        scoreReason: 'fixture',
        triggeredHardTriggers: routeDecision === 'single_pass_final_allowed' ? [] : ['line_count_gt_600'],
        scoreBreakdown: [],
        hardTriggerBreakdown: [],
      },
      result: {
        phase: 'initial_assessment',
        decision: routeDecision,
        authoringMode: 'semantic_kernel_then_packet',
        riskLevel: 'low',
        checkpointRequired: routeDecision !== 'single_pass_final_allowed',
        recommendedCheckpointCount: routeDecision === 'single_pass_final_allowed' ? 0 : REQUIRED_CHECKPOINT_IDS.length,
      },
    },
  };
  const scaleAssessmentPath = writeJson(`${name}-scale-assessment-initial.json`, scaleAssessment);
  const scaleRoutingDecision = {
    schemaVersion: 'contract-authoring-scale-routing-decision/v1',
    latestCompletedPhase: 'initial_assessment',
    decision: routeDecision,
    decisionSource: 'initial_assessment',
    nextAction:
      routeDecision === 'single_pass_final_allowed'
        ? 'continue_pre_render_readiness'
        : 'run_checkpoint_persistence_or_authoring_repair',
    checkpointPersistenceSatisfied: false,
    initialAssessmentRef: {
      path: scaleAssessmentPath.replace(/\\/g, '/'),
      hash: sha256Json(scaleAssessment),
    },
  };
  const scaleRoutingDecisionPath = writeJson(
    `${name}-scale-routing-decision.json`,
    scaleRoutingDecision
  );
  const sourceMutationDecisionPath = writeJson(`${name}-source-mutation-decision.json`, {
    schemaVersion: 'requirements-authoring-source-mutation-decision/v1',
    finalDecision: options.sourceMutationFinalDecision ?? 'allow_source_materialization',
    sourceMutationAllowed: (options.sourceMutationFinalDecision ?? 'allow_source_materialization') ===
      'allow_source_materialization',
    sourceDocumentExistedBefore: options.sourceDocumentExistedBefore ?? targetExists,
    sourceDocumentHashBefore: options.sourceDocumentHashBefore ?? targetHash,
    sourceDocumentHashAfter: options.sourceDocumentHashAfter ?? draftHash,
  });
  const encodingReportPath = writeJson(`${name}-encoding-report.json`, {
    checkedFiles: 1,
    findings: options.encodingFindings ?? [],
  });
  const paths: Record<string, string> = {
    scaleAssessmentPath,
    scaleRoutingDecisionPath,
    sourceMutationDecisionPath,
    encodingReportPath,
    receiptOutPath: path.join(tempDir, `${name}-promotion-receipt.json`),
  };
  const args = [
    '--scale-assessment',
    scaleAssessmentPath,
    '--scale-routing-decision',
    scaleRoutingDecisionPath,
    '--source-mutation-decision',
    sourceMutationDecisionPath,
    '--encoding-report',
    encodingReportPath,
    '--receipt-out',
    paths.receiptOutPath,
  ];
  if (options.includeCheckpointEvidence) {
    paths.checkpointPersistenceEvidencePath = writeJson(`${name}-checkpoint-persistence-evidence.json`, {
      checkpointPersistenceSatisfiedCandidate: true,
      checkpointPersistenceRef: {
        routeDecisionHash: `sha256:${'3'.repeat(64)}`,
        progressPath: path.join(tempDir, `${name}-semantic-checkpoint-progress.json`).replace(/\\/g, '/'),
        progressHash: `sha256:${'4'.repeat(64)}`,
        completedCheckpointIds: REQUIRED_CHECKPOINT_IDS,
        preRenderMustDecompositionGateHash: `sha256:${'5'.repeat(64)}`,
        preRenderGlobalConsistencyHash: `sha256:${'6'.repeat(64)}`,
        packetSourceReconciliationHash: `sha256:${'7'.repeat(64)}`,
      },
      completedCheckpointIds: REQUIRED_CHECKPOINT_IDS,
      progressHash: `sha256:${'4'.repeat(64)}`,
      preRenderMustDecompositionGateHash: `sha256:${'5'.repeat(64)}`,
      preRenderGlobalConsistencyHash: `sha256:${'6'.repeat(64)}`,
      packetSourceReconciliationHash: `sha256:${'7'.repeat(64)}`,
    });
    args.push('--checkpoint-persistence-evidence', paths.checkpointPersistenceEvidencePath);
  }
  return { args, paths };
}

function draftWithStatus(status: string, extras = '', recordId = 'REQ-LARGE-DOC'): string {
  return `# Large Source

implementationConfirmation:
  contractSchemaVersion: 1
  status: ${status}
  recordId: ${recordId}
  requirementSetId: ${recordId}-SET
  entryFlow: story
  entryFlowClass: full_story_entry
  workflowAdapter: bmad
  contractAuthoringRequired: true
  confirmationLanguage: zh-CN
  confirmationProfile: implementation_confirmation
  requiredViewPacks: []
  optionalViewPacks: []
  confirmedAt: "2026-06-02T00:00:00.000Z"
  confirmedBy: "fixture"
  sourceDocumentHash: null
  implementationConfirmationHash: null
  confirmationRender:
    htmlPath: null
    summaryPath: null
    reportPath: null
    htmlHash: null
    confirmationPhrase: null
  must:
    - id: MUST-001
      text: "The large document validation flow accepts only stable draft files."
      textZh: "大文档校验流程只接受稳定草稿文件。"
      evidenceRefs: ["EVD-001"]
  notDone:
    - id: NEG-001
      text: "The flow must not replace targets after shell transport corruption."
      textZh: "shell 运输层损坏后不得替换目标。"
      evidenceRefs: ["EVD-001"]
      whyItBlocksCompletion: "Corrupted drafts are not source authority."
      whyItBlocksCompletionZh: "损坏草稿不是源权威。"
      negativeAssertionRequired: true
  mustNot:
    - id: OUT-001
      text: "Do not require a consumer root scripts directory."
      textZh: "不得要求消费项目根 scripts 目录。"
      scopeBoundary: "skill-local helpers only"
      scopeBoundaryZh: "仅限 skill-local helper。"
      userApprovalRequiredIfChanged: true
  evidence:
    - id: EVD-001
      text: "Vitest assertions prove target preservation and promotion with before/after hash evidence, failure handling, and idempotent retry receipts."
      textZh: "Vitest 断言证明目标保留和提升。"
      gate: "npx vitest run tests/acceptance/requirements-contract-large-doc-write-flow.test.ts"
      oracle: "Independent file hashes and backup files prove behavior."
      oracleZh: "独立文件哈希和备份文件证明行为。"
      requiredCommandRefs: ["CMD-001"]
      artifactRefs: ["ART-EVD-001"]
      acceptanceType: acceptance_e2e
  openQuestions: []
  failurePaths:
    - id: FAIL-001
      title: "Shell transport corruption"
      trigger: "PowerShell parser text appears in the draft."
      expectedBehavior: "Stop before target file replacement with before/after hash assertions."
      forbiddenBehavior: "Do not retry blindly or promote corrupted content."
      blocksCompletionWhenViolated: true
      linkedNegIds: ["NEG-001"]
      linkedEvidenceIds: ["EVD-001"]
      requiredAssertions: ["Target hash remains unchanged."]
  edgeCases:
    - id: EDGE-001
      category: shell_transport
      condition: "Markdown fences or YAML scalars were damaged by shell transport."
      expectedBehavior: "Normalize deterministic damage or fail closed before target file replacement."
      forbiddenBehavior: "Do not let PowerShell carry document bodies."
      linkedFailurePathIds: ["FAIL-001"]
      linkedEvidenceIds: ["EVD-001"]
  traceRows:
    - id: TRACE-001
      covers: ["MUST-001", "NEG-001"]
      taskRefs: ["TASK-001"]
      evidenceRefs: ["EVD-001"]
      contractValidationCommandRefs: ["CMD-001"]
      deliveryEvidenceCommandRefs: ["CMD-001"]
      acceptanceRefs: ["ACC-001", "E2E-001"]
      sequenceViewRefs: ["SEQ-001"]
      boundaryViewRefs: ["BOUNDARY-001"]
      artifactRefs: ["ART-EVD-001"]
      status: PENDING
  acceptanceTests:
    - id: ACC-001
      file: "${path.join(tempDir, 'acceptance.test.ts').replace(/\\/g, '/')}"
      covers: ["MUST-001"]
      traceRows: ["TRACE-001"]
      evidenceRefs: ["EVD-001"]
      commandRefs: ["CMD-001"]
      failurePathRefs: ["FAIL-001"]
      positiveControl: true
      expectedPreImplementationState: expected_red
      oracle: "File hash changes only after successful promotion."
  e2eSuites:
    - id: E2E-001
      file: "${path.join(tempDir, 'e2e.test.ts').replace(/\\/g, '/')}"
      covers: ["NEG-001"]
      traceRows: ["TRACE-001"]
      evidenceRefs: ["EVD-001"]
      commandRefs: ["CMD-001"]
      edgeCaseRefs: ["EDGE-001"]
      negativeControls: ["NEG-001"]
      expectedPreImplementationState: expected_red
      oracle: "Target remains unchanged when promotion fails."
  currentTargetMap:
    schemaVersion: current-target-map/v1
    displayProfile: closed_loop_current_target_map
    currentSummary:
      - id: CUR-001
        text: "Agents manually transported large document content through shell payloads."
        traceRefs: ["TRACE-001"]
        evidenceRefs: ["EVD-001"]
    targetSummary:
      - id: TAR-001
        text: "Agents promote normalized draft files through skill-local scripts."
        traceRefs: ["TRACE-001"]
        evidenceRefs: ["EVD-001"]
    diffRows:
      - id: DIFF-001
        current: "PowerShell content transport can corrupt drafts."
        target: "Node reads UTF-8 draft files and promotion writes target files only after failure handling and before/after hash assertions pass."
        traceRefs: ["TRACE-001"]
        evidenceRefs: ["EVD-001"]
    process: []
    artifactPaths:
      - id: PATH-001
        path: "_bmad/skills/requirements-contract-authoring/scripts/promote-draft-large-doc.js"
        role: "skill-local promotion command"
        traceRefs: ["TRACE-001"]
        evidenceRefs: ["EVD-001"]
    canonicalArtifacts: []
    existingArtifacts: []
  requirementBoundary:
    business:
      description: "Large document write flow."
      requirementIds: ["MUST-001", "NEG-001"]
      viewRefs: ["SEQ-001", "FLOW-001", "EDGEVIEW-001"]
      diagramRefs: ["MERMAID-001"]
    governance:
      description: "Consumer install surface."
      requirementIds: ["OUT-001", "EVD-001"]
      viewRefs: ["BOUNDARY-001"]
      diagramRefs: ["MERMAID-002"]
  sequenceViews:
    - id: SEQ-001
      title: "Draft promotion sequence"
      scope: business
      covers: ["MUST-001", "NEG-001", "EVD-001"]
  flowViews:
    - id: FLOW-001
      title: "Promotion flow"
      scope: business
      covers: ["MUST-001", "NEG-001"]
  edgeCaseViews:
    - id: EDGEVIEW-001
      title: "Shell transport edge"
      scope: business
      covers: ["NEG-001"]
      cases: ["EDGE-001"]
  boundaryViews:
    - id: BOUNDARY-001
      title: "No consumer root scripts"
      scope: governance
      covers: ["OUT-001"]
  artifactAutomationPlan:
    - artifactId: ART-EVD-001
      path: "_bmad-output/runtime/large-doc-write/evidence.json"
      artifactType: evidence
      sourceOfTruthRole: evidence
      ownerModel: requirement_confirmation
      producer: vitest
      consumer: promotion command
      inputArtifacts: ["draft.md"]
      outputArtifacts: ["target.md"]
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
      command: "npx vitest run tests/acceptance/requirements-contract-large-doc-write-flow.test.ts"
  suggestedCommands: []
  closeoutReadinessPreview:
    requiredCommands: ["CMD-001"]
    orphanPolicy: "block orphan artifacts"
    currentAttemptPolicy: "current attempt only"
  governanceEventTypeRegistryPolicy:
    controlFieldVocabulary: ["artifactIndex"]
    payloadKindContracts: []
    controlWriteModePolicies: []
    eventSpecificRequirements: []
  governanceEventTypeRegistry: []
  controlledIngestWriterRegistry: []

## Reverse Audit Report

Verdict: PASS

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

- Promotion preserves target files on failed checks.
- Successful promotion creates a backup before replacing the target.

\`\`\`mermaid
sequenceDiagram
  actor Agent
  participant Promote
  Agent->>Promote: Normalize draft [MUST-001][EVD-001]
  Promote-->>Agent: Reject corrupted content [NEG-001][EVD-001]
\`\`\`

\`\`\`mermaid
flowchart TD
  A[OUT-001] --> B[EVD-001]
\`\`\`
${extras}`;
}

function materializeConfirmationReadyDraft(): { source: string; reportPath: string } {
  fs.writeFileSync(path.join(tempDir, 'acceptance.test.ts'), 'import { it } from "vitest"; it("ok", () => {});\n', 'utf8');
  fs.writeFileSync(path.join(tempDir, 'e2e.test.ts'), 'import { it } from "vitest"; it("ok", () => {});\n', 'utf8');
  const source = write('ready-draft.md', draftWithStatus('user_confirmed'));
  const extracted = extractImplementationConfirmation(fs.readFileSync(source, 'utf8'));
  const sourceHash = sourceDocumentHashFor(
    fs.readFileSync(source, 'utf8'),
    extracted.blockText,
    extracted.confirmation
  );
  const implementationHash = implementationConfirmationHashFor(extracted.confirmation);
  const reportPath = path.join(tempDir, 'confirmation-render-report.json');
  const htmlPath = path.join(tempDir, 'confirmation.html');
  const summaryPath = path.join(tempDir, 'confirmation-summary.json');
  const confirmationPageHash = `sha256:${'a'.repeat(64)}`;
  const confirmInstruction = `确认最终验收并关闭需求 sourceDocumentHash=${sourceHash} implementationConfirmationHash=${implementationHash} confirmationPageHash=${confirmationPageHash}`;
  let text = fs
    .readFileSync(source, 'utf8')
    .replace('  sourceDocumentHash: null', `  sourceDocumentHash: "${sourceHash}"`)
    .replace(
      '  implementationConfirmationHash: null',
      `  implementationConfirmationHash: "${implementationHash}"`
    )
    .replace(
      / {2}confirmationRender:\n {4}htmlPath: null\n {4}summaryPath: null\n {4}reportPath: null\n {4}htmlHash: null\n {4}confirmationPhrase: null/u,
      `  confirmationRender:
    htmlPath: "${htmlPath.replace(/\\/g, '/')}"
    summaryPath: "${summaryPath.replace(/\\/g, '/')}"
    reportPath: "${reportPath.replace(/\\/g, '/')}"
    htmlHash: "${confirmationPageHash}"
    confirmationPhrase: ${JSON.stringify(confirmInstruction)}`
    );
  fs.writeFileSync(source, text, 'utf8');

  const patched = extractImplementationConfirmation(text);
  const currentSourceHash = sourceDocumentHashFor(text, patched.blockText, patched.confirmation);
  const currentImplementationHash = implementationConfirmationHashFor(patched.confirmation);
  text = text
    .replace(sourceHash, currentSourceHash)
    .replace(implementationHash, currentImplementationHash);
  fs.writeFileSync(source, text, 'utf8');

  const finalConfirmInstruction = `确认最终验收并关闭需求 sourceDocumentHash=${currentSourceHash} implementationConfirmationHash=${currentImplementationHash} confirmationPageHash=${confirmationPageHash}`;
  text = text.replace(confirmInstruction, finalConfirmInstruction);
  fs.writeFileSync(source, text, 'utf8');

  const drilldownReport = {
    verdict: 'PASS',
    confirmability: 'confirmable',
    sourceDocumentHash: currentSourceHash,
    implementationConfirmationHash: currentImplementationHash,
    criticalAuditor: { minimumRounds: 3, consecutiveNoNewGapRounds: 3 },
    packetSourceReconciliation: { verdict: 'pass' },
    failedChecks: [],
  };
  const report = {
    recordId: 'REQ-LARGE-DOC',
    requirementSetId: 'REQSET-LARGE-DOC',
    sourcePath: source,
    sourceDocumentHash: currentSourceHash,
    implementationConfirmationHash: currentImplementationHash,
    confirmationPageHash,
    actualHtmlFileHash: confirmationPageHash,
    generatedAt: '2026-06-02T00:00:00.000Z',
    language: 'zh-CN',
    confirmability: 'confirmable',
    deliveryReadiness: { ready: false, status: 'not_ready', reasons: [] },
    blockingIssues: [],
    warnings: [],
    diagramCoverage: { status: 'pass' },
    traceCoverage: { status: 'pass' },
    artifactAutomationCoverage: { status: 'pass' },
    confirmInstruction: finalConfirmInstruction,
    artifactRef: { path: htmlPath, hash: confirmationPageHash },
    renderedSections: ['pre-confirmation-semantic-drilldown'],
    preConfirmationSemanticDrilldown: {
      status: 'pass',
      reportPath: path.join(tempDir, 'pre-render-must-decomposition-gate-report.json'),
      report: drilldownReport,
    },
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  return { source, reportPath };
}

describe('requirements-contract large document write flow', () => {
  it('normalizes PowerShell-damaged Mermaid fences and YAML colon-space scalars idempotently', () => {
    const draft = write(
      'damaged.md',
      [
        '# Draft',
        '',
        'implementationConfirmation:',
        '  status: draft',
        '  question: Why: now',
        '  quoted: "Already: quoted"',
        '  arrayValue: ["Already: array"]',
        '  objectValue: { reason: "Already: object" }',
        '  blockValue: |',
        '    Keep: block scalar',
        '',
        '`mermaid',
        'flowchart TD',
        '  A[MUST-001] --> B[EVD-001]',
        '`',
        '',
      ].join('\n')
    );

    const first = runNode(NORMALIZE, ['--draft', draft, '--json']);
    expect(first.result.status).toBe(0);
    expect(first.json.changed).toBe(true);
    expect(first.json.mermaidFenceRepairs).toBe(2);
    expect(first.json.yamlScalarQuotes).toBe(1);
    expect(fs.readFileSync(draft, 'utf8')).toContain('  question: "Why: now"');
    expect(fs.readFileSync(draft, 'utf8')).toContain('```mermaid');

    const second = runNode(NORMALIZE, ['--draft', draft, '--json']);
    expect(second.result.status).toBe(0);
    expect(second.json.changed).toBe(false);
    expect(second.json.sha256).toBe(first.json.sha256);
  });

  it('generates a manifest and fails missing implementationConfirmation or unbalanced fences', () => {
    const target = write('target.md', '# old\n');
    const valid = write('valid.md', draftWithStatus('draft'));
    const manifestPath = path.join(tempDir, 'manifest.json');

    const ok = runNode(MANIFEST, [
      '--draft',
      valid,
      '--target',
      target,
      '--require',
      'MUST-001',
      '--require-must',
      'MUST-001',
      '--min-bytes',
      '100',
      '--attempt-id',
      'attempt-1',
      '--out',
      manifestPath,
      '--json',
    ]);

    expect(ok.result.status).toBe(0);
    expect(ok.json).toMatchObject({
      ok: true,
      statusValue: 'draft',
      implementationConfirmationPresent: true,
      attemptId: 'attempt-1',
      markdownFenceBalance: 0,
    });
    expect(ok.json.mustIds).toContain('MUST-001');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const missing = write('missing.md', '# Missing\n\n```mermaid\nA --> B\n');
    const fail = runNode(MANIFEST, ['--draft', missing, '--target', target, '--json']);
    expect(fail.result.status).toBe(1);
    expect(fail.json.errors).toEqual(
      expect.arrayContaining(['missing_implementation_confirmation', 'unbalanced_markdown_fences'])
    );
  });

  it('preserves target on preflight, dry-run, required text, byte, semantic, and shell transport failures', () => {
    const target = write('target.md', '# stable target\n');
    const before = fs.readFileSync(target, 'utf8');
    const draft = write('draft.md', draftWithStatus('draft'));

    const preflight = runNode(PROMOTE, [
      '--draft',
      draft,
      '--target',
      target,
      '--require',
      'MUST-001',
      '--preflight-only',
      '--json',
    ]);
    expect(preflight.result.status).toBe(0);
    expect(preflight.json.ok).toBe(true);
    expect(fs.readFileSync(target, 'utf8')).toBe(before);

    const semantic = runNode(PROMOTE, ['--draft', draft, '--target', target, '--json']);
    expect(semantic.result.status).toBe(1);
    expect(semantic.json.failureClass).toBe(
      'semantic_decision_required:expected_draft_gap_policy'
    );
    expect(semantic.json).toMatchObject({
      promotionStage: 'confirmation-ready',
      allowedStatuses: ['user_confirmed'],
      statusValue: 'draft',
      confirmationReady: false,
      safePromotionAsDraft: false,
      requiresUserConfirmationBeforeExecution: true,
    });
    expect(semantic.json.details).toMatchObject({
      promotionStage: 'confirmation-ready',
      allowedStatuses: ['user_confirmed'],
      statusValue: 'draft',
    });
    expect(fs.readFileSync(target, 'utf8')).toBe(before);

    const missingRequired = runNode(PROMOTE, [
      '--draft',
      draft,
      '--target',
      target,
      '--require',
      'ABSENT-REQUIRED-TEXT',
      '--json',
    ]);
    expect(missingRequired.result.status).toBe(1);
    expect(missingRequired.json.failureClass).toBe('draft_syntax_error');
    expect(fs.readFileSync(target, 'utf8')).toBe(before);

    const tooSmall = runNode(PROMOTE, [
      '--draft',
      draft,
      '--target',
      target,
      '--min-bytes',
      '999999',
      '--json',
    ]);
    expect(tooSmall.result.status).toBe(1);
    expect(tooSmall.json.failureClass).toBe('draft_syntax_error');
    expect(fs.readFileSync(target, 'utf8')).toBe(before);

    const shellDamaged = write(
      'shell-damaged.md',
      `${draftWithStatus('draft')}\n\nParserError:\nMissing file specification after redirection operator\n`
    );
    const shell = runNode(PROMOTE, ['--draft', shellDamaged, '--target', target, '--json']);
    expect(shell.result.status).toBe(1);
    expect(shell.json.failureClass).toBe('shell_transport_error');
    expect(fs.readFileSync(target, 'utf8')).toBe(before);
  });

  it('blocks authoring-draft promotion when required authoring receipts are missing', () => {
    const target = path.join(tempDir, 'docs', 'plans', 'target.md');
    const draft = write('authoring-draft.md', draftWithStatus('draft'));

    const blocked = runNode(PROMOTE, [
      '--draft',
      draft,
      '--target',
      target,
      '--promotion-stage',
      'authoring-draft',
      '--json',
    ]);

    expect(blocked.result.status).toBe(1);
    expect(blocked.json).toMatchObject({
      ok: false,
      promotionStage: 'authoring-draft',
      statusValue: 'draft',
      failureClass: 'authoring_promotion_gate_failed',
    });
    expect(blocked.json.authoringPromotionGate).toMatchObject({ required: true, ok: false });
    expect(blocked.json.authoringPromotionGate.errors).toEqual(
      expect.arrayContaining([
        'scaleAssessment_required',
        'scaleRoutingDecision_required',
        'sourceMutationDecision_required',
        'encodingReport_required',
        'receiptOut_required',
      ])
    );
    expect(fs.existsSync(target)).toBe(false);
  });

  it('auto-repairs deterministic gate artifacts and returns semantic next actions without writing target', () => {
    const target = path.join(tempDir, 'docs', 'plans', 'auto-repair.md');
    const recordId = `REQ-AUTO-REPAIR-${path
      .basename(tempDir)
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')}`;
    const draft = write('auto-repair-draft.md', draftWithStatus('draft', '', recordId));

    const repaired = runNode(PROMOTE, [
      '--draft',
      draft,
      '--target',
      target,
      '--promotion-stage',
      'authoring-draft',
      '--auto-repair',
      '--json',
    ]);

    expect(repaired.result.status).toBe(1);
    expect(repaired.json.failureClass).toBe('authoring_promotion_gate_failed');
    expect(repaired.json.autoRepair).toMatchObject({
      enabled: true,
    });
    expect(repaired.json.autoRepair.actions.map((action: any) => action.action)).toEqual(
      expect.arrayContaining([
        'run_initial_scale_assessment',
        'run_encoding_integrity_gate',
        'source_mutation_decision_required',
        'default_promotion_receipt_path_selected',
      ])
    );
    expect(repaired.json.authoringPromotionGate.errors).toContain('sourceMutationDecision_required');
    expect(repaired.json.details.nextRequiredActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'run_authoring_orchestrator_until_source_mutation_decision',
        }),
      ])
    );
    expect(fs.existsSync(repaired.json.autoRepair.defaultAuthoringDir)).toBe(true);
    expect(
      fs.existsSync(path.join(repaired.json.autoRepair.defaultAuthoringDir, 'scale-assessment-initial.json'))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(repaired.json.autoRepair.defaultAuthoringDir, 'scale-routing-decision.json'))
    ).toBe(true);
    expect(fs.existsSync(path.join(repaired.json.autoRepair.defaultAuthoringDir, 'encoding-report.json'))).toBe(
      true
    );
    expect(fs.existsSync(target)).toBe(false);
  });

  it('allows guarded authoring-draft promotion only after scale, routing, mutation, encoding, and receipt-out gates pass', () => {
    const target = write('target.md', '# old target\n');
    const draft = write('authoring-draft.md', draftWithStatus('draft'));
    const guard = writeAuthoringPromotionGuard('authoring-draft', { draftPath: draft, targetPath: target });

    const promoted = runNode(PROMOTE, [
      '--draft',
      draft,
      '--target',
      target,
      '--promotion-stage',
      'authoring-draft',
      ...guard.args,
      '--json',
    ]);

    expect(promoted.result.status).toBe(0);
    expect(promoted.json).toMatchObject({
      ok: true,
      promotionStage: 'authoring-draft',
      allowedStatuses: ['draft', 'draft_updated_not_confirmation_ready', 'reconfirm_required'],
      statusValue: 'draft',
      confirmationReady: false,
      safePromotionAsDraft: true,
      requiresUserConfirmationBeforeExecution: true,
      authoringPromotionGate: {
        required: true,
        ok: true,
      },
    });
    expect(promoted.json.audit).toMatchObject({
      ok: true,
      skipped: true,
      reason: 'authoring_draft_is_not_confirmation_ready',
    });
    expect(promoted.json.residualRisks).toContain('reverse_audit_not_run_authoring_draft');
    expect(promoted.json.writeReceipt.schemaVersion).toBe('large-document-writer-safe-write/v1');
    expect(promoted.json.receiptPath).toBe(guard.paths.receiptOutPath.replace(/\\/g, '/'));
    expect(fs.existsSync(guard.paths.receiptOutPath)).toBe(true);
    expect(fs.readFileSync(target, 'utf8')).toContain('status: draft');
    expect(fs.readFileSync(target, 'utf8')).not.toContain('status: user_confirmed');
  });

  it('requires checkpoint persistence evidence when scale routing requires checkpoints', () => {
    const target = path.join(tempDir, 'docs', 'plans', 'checkpoint-required.md');
    const draft = write('checkpoint-draft.md', draftWithStatus('draft'));
    const guardWithoutCheckpoint = writeAuthoringPromotionGuard('checkpoint-required-missing', {
      draftPath: draft,
      targetPath: target,
      routeDecision: 'checkpoint_required',
      includeCheckpointEvidence: false,
    });

    const blocked = runNode(PROMOTE, [
      '--draft',
      draft,
      '--target',
      target,
      '--promotion-stage',
      'authoring-draft',
      ...guardWithoutCheckpoint.args,
      '--json',
    ]);

    expect(blocked.result.status).toBe(1);
    expect(blocked.json.failureClass).toBe('authoring_promotion_gate_failed');
    expect(blocked.json.authoringPromotionGate.errors).toContain(
      'checkpoint_persistence_evidence_required'
    );
    expect(fs.existsSync(target)).toBe(false);

    const guardWithCheckpoint = writeAuthoringPromotionGuard('checkpoint-required-present', {
      draftPath: draft,
      targetPath: target,
      routeDecision: 'checkpoint_required',
      includeCheckpointEvidence: true,
    });
    const promoted = runNode(PROMOTE, [
      '--draft',
      draft,
      '--target',
      target,
      '--promotion-stage',
      'authoring-draft',
      ...guardWithCheckpoint.args,
      '--json',
    ]);

    expect(promoted.result.status).toBe(0);
    expect(promoted.json.authoringPromotionGate).toMatchObject({
      required: true,
      ok: true,
    });
    expect(promoted.json.authoringPromotionGate.decisions.checkpointPersistence).toMatchObject({
      satisfied: true,
      completedCheckpointCount: REQUIRED_CHECKPOINT_IDS.length,
    });
    expect(fs.readFileSync(target, 'utf8')).toContain('implementationConfirmation:');
  });

  it('blocks guarded authoring promotion on failed source mutation or encoding gates', () => {
    const draft = write('guarded-failures.md', draftWithStatus('draft'));

    const blockedMutationTarget = path.join(tempDir, 'docs', 'plans', 'blocked-mutation.md');
    const blockedMutationGuard = writeAuthoringPromotionGuard('blocked-mutation', {
      draftPath: draft,
      targetPath: blockedMutationTarget,
      sourceMutationFinalDecision: 'block_source_materialization',
    });
    const blockedMutation = runNode(PROMOTE, [
      '--draft',
      draft,
      '--target',
      blockedMutationTarget,
      '--promotion-stage',
      'authoring-draft',
      ...blockedMutationGuard.args,
      '--json',
    ]);

    expect(blockedMutation.result.status).toBe(1);
    expect(blockedMutation.json.authoringPromotionGate.errors).toEqual(
      expect.arrayContaining([
        'source_mutation_decision_not_allow_source_materialization',
        'source_mutation_allowed_true_required',
      ])
    );
    expect(fs.existsSync(blockedMutationTarget)).toBe(false);

    const blockedEncodingTarget = path.join(tempDir, 'docs', 'plans', 'blocked-encoding.md');
    const blockedEncodingGuard = writeAuthoringPromotionGuard('blocked-encoding', {
      draftPath: draft,
      targetPath: blockedEncodingTarget,
      encodingFindings: [{ file: 'docs/plans/broken.md', hits: [{ line: 1, pattern: 'UTF-8-BOM' }] }],
    });
    const blockedEncoding = runNode(PROMOTE, [
      '--draft',
      draft,
      '--target',
      blockedEncodingTarget,
      '--promotion-stage',
      'authoring-draft',
      ...blockedEncodingGuard.args,
      '--json',
    ]);

    expect(blockedEncoding.result.status).toBe(1);
    expect(blockedEncoding.json.authoringPromotionGate.errors).toContain(
      'encoding_report_findings_not_empty'
    );
    expect(fs.existsSync(blockedEncodingTarget)).toBe(false);
  });

  it('blocks stale source mutation decisions that are not bound to the current target and draft hashes', () => {
    const target = write('stale-target.md', '# current target\n');
    const draft = write('stale-draft.md', draftWithStatus('draft'));

    const staleBeforeGuard = writeAuthoringPromotionGuard('stale-before', {
      draftPath: draft,
      targetPath: target,
      sourceDocumentHashBefore: `sha256:${'8'.repeat(64)}`,
    });
    const blockedBefore = runNode(PROMOTE, [
      '--draft',
      draft,
      '--target',
      target,
      '--promotion-stage',
      'authoring-draft',
      ...staleBeforeGuard.args,
      '--json',
    ]);

    expect(blockedBefore.result.status).toBe(1);
    expect(blockedBefore.json.authoringPromotionGate.errors).toContain(
      'source_mutation_source_hash_before_mismatch'
    );
    expect(blockedBefore.json.details.nextRequiredActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'rerun_authoring_orchestrator_for_current_hashes',
        }),
      ])
    );
    expect(fs.readFileSync(target, 'utf8')).toBe('# current target\n');

    const staleAfterGuard = writeAuthoringPromotionGuard('stale-after', {
      draftPath: draft,
      targetPath: target,
      sourceDocumentHashAfter: `sha256:${'9'.repeat(64)}`,
    });
    const blockedAfter = runNode(PROMOTE, [
      '--draft',
      draft,
      '--target',
      target,
      '--promotion-stage',
      'authoring-draft',
      ...staleAfterGuard.args,
      '--json',
    ]);

    expect(blockedAfter.result.status).toBe(1);
    expect(blockedAfter.json.authoringPromotionGate.errors).toContain(
      'source_mutation_source_hash_after_mismatch'
    );
    expect(fs.readFileSync(target, 'utf8')).toBe('# current target\n');
  });

  it('requires explicit new-file authorization when guarded promotion would create a target document', () => {
    const target = path.join(tempDir, 'docs', 'plans', 'new-target.md');
    const draft = write('new-target-draft.md', draftWithStatus('draft'));

    const staleCreateGuard = writeAuthoringPromotionGuard('stale-create', {
      draftPath: draft,
      targetPath: target,
      sourceDocumentExistedBefore: true,
    });
    const blocked = runNode(PROMOTE, [
      '--draft',
      draft,
      '--target',
      target,
      '--promotion-stage',
      'authoring-draft',
      ...staleCreateGuard.args,
      '--json',
    ]);

    expect(blocked.result.status).toBe(1);
    expect(blocked.json.authoringPromotionGate.errors).toContain(
      'source_mutation_target_absence_not_authorized'
    );
    expect(fs.existsSync(target)).toBe(false);

    const createGuard = writeAuthoringPromotionGuard('authorized-create', {
      draftPath: draft,
      targetPath: target,
      sourceDocumentExistedBefore: false,
    });
    const promoted = runNode(PROMOTE, [
      '--draft',
      draft,
      '--target',
      target,
      '--promotion-stage',
      'authoring-draft',
      ...createGuard.args,
      '--json',
    ]);

    expect(promoted.result.status).toBe(0);
    expect(fs.readFileSync(target, 'utf8')).toContain('implementationConfirmation:');
  });

  it('enforces the authoring-draft status whitelist and rejects confirmed status', () => {
    for (const status of ['draft_updated_not_confirmation_ready', 'reconfirm_required']) {
      const target = write(`target-${status}.md`, '# old target\n');
      const draft = write(`authoring-${status}.md`, draftWithStatus(status));
      const guard = writeAuthoringPromotionGuard(`authoring-${status}`, { draftPath: draft, targetPath: target });

      const promoted = runNode(PROMOTE, [
        '--draft',
        draft,
        '--target',
        target,
        '--promotion-stage',
        'authoring-draft',
        ...guard.args,
        '--json',
      ]);

      expect(promoted.result.status).toBe(0);
      expect(promoted.json).toMatchObject({
        ok: true,
        promotionStage: 'authoring-draft',
        statusValue: status,
        confirmationReady: false,
        safePromotionAsDraft: true,
        requiresUserConfirmationBeforeExecution: true,
      });
      expect(fs.readFileSync(target, 'utf8')).toContain(`status: ${status}`);
    }

    const target = write('target-confirmed.md', '# old target\n');
    const confirmedDraft = write('authoring-confirmed.md', draftWithStatus('user_confirmed'));
    const guard = writeAuthoringPromotionGuard('authoring-confirmed', {
      draftPath: confirmedDraft,
      targetPath: target,
    });
    const rejected = runNode(PROMOTE, [
      '--draft',
      confirmedDraft,
      '--target',
      target,
      '--promotion-stage',
      'authoring-draft',
      ...guard.args,
      '--json',
    ]);

    expect(rejected.result.status).toBe(1);
    expect(rejected.json).toMatchObject({
      ok: false,
      promotionStage: 'authoring-draft',
      allowedStatuses: ['draft', 'draft_updated_not_confirmation_ready', 'reconfirm_required'],
      statusValue: 'user_confirmed',
      confirmationReady: false,
      safePromotionAsDraft: true,
      requiresUserConfirmationBeforeExecution: true,
      failureClass: 'semantic_decision_required:expected_draft_gap_policy',
    });
    expect(rejected.json.details).toMatchObject({
      promotionStage: 'authoring-draft',
      allowedStatuses: ['draft', 'draft_updated_not_confirmation_ready', 'reconfirm_required'],
      statusValue: 'user_confirmed',
    });
    expect(fs.readFileSync(target, 'utf8')).toBe('# old target\n');
  });

  it('does not implement allow-expected-draft-gap', () => {
    const help = spawnSync(process.execPath, [PROMOTE, '--help'], { cwd: ROOT, encoding: 'utf8' });
    expect(help.status).toBe(0);
    expect(help.stdout).not.toContain('--allow-expected-draft-gap');

    const target = write('target.md', '# stable target\n');
    const draft = write('draft.md', draftWithStatus('draft'));
    const unsupported = spawnSync(
      process.execPath,
      [PROMOTE, '--draft', draft, '--target', target, '--allow-expected-draft-gap', '--json'],
      { cwd: ROOT, encoding: 'utf8' }
    );
    expect(unsupported.status).toBe(2);
  });

  it('persists retry receipts and stops repeated same-draft same-failure loops', () => {
    const target = write('target.md', '# stable target\n');
    const draft = write('draft.md', `${draftWithStatus('draft')}\nParserError:\n`);
    const retryReceipt = path.join(tempDir, 'retry.json');

    const first = runNode(PROMOTE, [
      '--draft',
      draft,
      '--target',
      target,
      '--retry-receipt',
      retryReceipt,
      '--json',
    ]);
    expect(first.result.status).toBe(1);
    expect(first.json.failureClass).toBe('shell_transport_error');
    expect(first.json.retry).toMatchObject({
      receiptVersion: 'requirements-contract-large-doc-retry/v1',
      lastFailureClass: 'shell_transport_error',
      consecutiveFailureCount: 1,
    });

    const second = runNode(PROMOTE, [
      '--draft',
      draft,
      '--target',
      target,
      '--retry-receipt',
      retryReceipt,
      '--json',
    ]);
    expect(second.result.status).toBe(1);
    expect(second.json.failureClass).toBe('retry_limit_exceeded:shell_transport_error');
    expect(second.json.retry.consecutiveFailureCount).toBe(2);
  });

  it('runs reverse audit, supports dry-run, and creates backup before successful replacement', () => {
    const target = write('target.md', '# old target\n');
    const { source } = materializeConfirmationReadyDraft();

    const dryRun = runNode(PROMOTE, ['--draft', source, '--target', target, '--dry-run', '--json']);
    expect(dryRun.result.status).toBe(0);
    expect(dryRun.json.ok).toBe(true);
    expect(dryRun.json).toMatchObject({
      promotionStage: 'confirmation-ready',
      allowedStatuses: ['user_confirmed'],
      confirmationReady: true,
      safePromotionAsDraft: false,
      requiresUserConfirmationBeforeExecution: false,
    });
    expect(dryRun.json.audit.ok).toBe(true);
    expect(fs.readFileSync(target, 'utf8')).toBe('# old target\n');

    const promoted = runNode(PROMOTE, ['--draft', source, '--target', target, '--json']);
    expect(promoted.result.status).toBe(0);
    expect(promoted.json.ok).toBe(true);
    expect(promoted.json).toMatchObject({
      promotionStage: 'confirmation-ready',
      allowedStatuses: ['user_confirmed'],
      confirmationReady: true,
      safePromotionAsDraft: false,
      requiresUserConfirmationBeforeExecution: false,
    });
    expect(promoted.json.backupPath).toMatch(/target\.md\.backup-/u);
    expect(fs.existsSync(promoted.json.backupPath)).toBe(true);
    expect(fs.readFileSync(promoted.json.backupPath, 'utf8')).toBe('# old target\n');
    expect(promoted.json.targetHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(promoted.json.audit.ok).toBe(true);
    expect(promoted.json.preflight.manifest.ok).toBe(true);
    expect(promoted.json.writeReceipt.schemaVersion).toBe('large-document-writer-safe-write/v1');
    expect(promoted.json.writeReceipt.finalHash).toBe(promoted.json.targetHash);
    expect(fs.readFileSync(target, 'utf8')).toContain('implementationConfirmation:');
  });

  it('does not use copyFileAtomic as the final target replacement success path', () => {
    const source = fs.readFileSync(PROMOTE, 'utf8');

    expect(source).not.toContain('receipt.targetHash = copyFileAtomic(draftPath, targetPath)');
  });
});
