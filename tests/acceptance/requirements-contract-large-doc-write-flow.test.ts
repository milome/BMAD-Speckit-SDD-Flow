import { spawnSync } from 'node:child_process';
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

function draftWithStatus(status: string, extras = ''): string {
  return `# Large Source

implementationConfirmation:
  contractSchemaVersion: 1
  status: ${status}
  recordId: REQ-LARGE-DOC
  requirementSetId: REQSET-LARGE-DOC
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
    expect(dryRun.json.audit.ok).toBe(true);
    expect(fs.readFileSync(target, 'utf8')).toBe('# old target\n');

    const promoted = runNode(PROMOTE, ['--draft', source, '--target', target, '--json']);
    expect(promoted.result.status).toBe(0);
    expect(promoted.json.ok).toBe(true);
    expect(promoted.json.backupPath).toMatch(/target\.md\.bak\./u);
    expect(fs.existsSync(promoted.json.backupPath)).toBe(true);
    expect(fs.readFileSync(promoted.json.backupPath, 'utf8')).toBe('# old target\n');
    expect(fs.readFileSync(target, 'utf8')).toContain('implementationConfirmation:');
  });
});
