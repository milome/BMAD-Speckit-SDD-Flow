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
const INGEST = path.join(
  ROOT,
  '_bmad',
  'skills',
  'requirements-contract-authoring',
  'scripts',
  'ingest-confirmation-event.js'
);
const REQ_TRACE_PROMPT = path.join(
  ROOT,
  '_bmad',
  'skills',
  'req-trace-matrix-prompt-generator',
  'scripts',
  'generate_prompt.py'
);

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'req-confirm-ingest-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function writeMockMermaidBundle(): string {
  const file = path.join(tempDir, 'mock-mermaid.min.js');
  fs.writeFileSync(
    file,
    `window.mermaid={initialize:function(){},render:async function(){return {svg:'<svg viewBox="0 0 320 120"></svg>'};}};`,
    'utf8'
  );
  return file;
}

function writeSource(): string {
  const file = path.join(tempDir, 'prd.md');
  fs.writeFileSync(
    file,
    `# PRD

implementationConfirmation:
  status: draft
  recordId: REQ-CONFIRM-INGEST
  requirementSetId: REQSET-CONFIRM-INGEST
  entryFlow: story
  entryFlowClass: full_story_entry
  workflowAdapter: bmad
  contractAuthoringRequired: true
  confirmationLanguage: zh-CN
  confirmedAt: null
  confirmedBy: null
  sourceDocumentHash: null
  confirmationProfile: implementation_confirmation
  requiredViewPacks: []
  optionalViewPacks: []
  applicability:
    governanceEvents:
      applies: true
      reasonCode: "confirmation ingest emits event"
    runtimeRecovery:
      applies: true
      reasonCode: "confirmation ingest supports reconfirmation recovery"
      requiresFunctionalResumeFailureCaseRegistry: true
    scoringDashboardSft:
      applies: true
      reasonCode: "read model boundary stays visible"
    currentTargetMap:
      applies: false
      reasonCode: "not needed for this fixture"
    scriptsAndHooks:
      applies: true
      reasonCode: "ingest script is part of automation plan"
  governanceEventTypeRegistryPolicy:
    controlFieldVocabulary: ["artifactIndex", "confirmationHistory"]
    payloadKindContracts:
      - payloadKind: status
        requiredFields: ["eventType", "status"]
        forbiddenFields: ["result", "decision"]
        allowedControlWriteModes: ["control"]
      - payloadKind: artifactRefs
        requiredFields: ["eventType", "artifactRefs"]
        forbiddenFields: ["result", "decision", "status"]
        allowedControlWriteModes: ["artifact_only"]
    controlWriteModePolicies:
      - allowedControlWriteMode: control
        allowedWritesControlFields: ["confirmationHistory"]
      - allowedControlWriteMode: artifact_only
        allowedWritesControlFields: ["artifactIndex"]
    eventSpecificRequirements: []
  must:
    - id: MUST-001
      text: "Confirmed source can be ingested into requirement record."
      evidenceRefs: ["EVD-001"]
  notDone:
    - id: NEG-001
      text: "Mismatched confirmation text must not write user_confirmed."
      evidenceRefs: ["EVD-002"]
  mustNot:
    - id: OUT-001
      text: "Renderer must not write confirmation state."
  evidence:
    - id: EVD-001
      text: "Run controlled ingest and inspect requirement record."
      gate: "node ingest-confirmation-event.js"
      oracle: "requirement-record.json contains confirmation_recorded event."
      requiredCommandRefs: ["CMD-001"]
      artifactRefs: ["ART-001"]
      acceptanceType: acceptance_test
    - id: EVD-002
      text: "Run controlled ingest with wrong hash."
      gate: "node ingest-confirmation-event.js"
      oracle: "process exits non-zero and source remains unconfirmed."
      requiredCommandRefs: ["CMD-002"]
      artifactRefs: ["ART-002"]
      acceptanceType: negative_test
  openQuestions: []
  failurePaths:
    - id: FAIL-001
      title: "Wrong confirmation hash rejected"
      trigger: "User confirmation text contains stale hash."
      expectedBehavior: "Reject write."
      forbiddenBehavior: "Do not set user_confirmed."
      linkedNegIds: ["NEG-001"]
      linkedEvidenceIds: ["EVD-002"]
  edgeCases:
    - id: EDGE-001
      condition: "Render report is stale."
      expectedBehavior: "Reject write."
      linkedIds: ["NEG-001", "EVD-002"]
  traceRows:
    - id: TRACE-001
      covers: ["MUST-001", "NEG-001"]
      taskRefs: ["TASK-001"]
      evidenceRefs: ["EVD-001", "EVD-002"]
      diagramRefs: ["SEQ-001", "STATE-001", "EDGE-001", "BOUNDARY-001"]
      artifactRefs: ["ART-001", "ART-002"]
      contractValidationCommandRefs: ["CMD-001"]
      deliveryEvidenceCommandRefs: ["CMD-002"]
      status: PENDING
  sequenceViews:
    - id: SEQ-001
      title: "Confirmation ingest success and rejection"
      covers: ["MUST-001", "NEG-001"]
  flowViews:
    - id: STATE-001
      title: "Confirmation state"
      covers: ["MUST-001", "NEG-001"]
  edgeCaseViews:
    - id: EDGE-001
      title: "Hash mismatch"
      covers: ["NEG-001"]
      cases: ["wrong hash"]
  boundaryViews:
    - id: BOUNDARY-001
      title: "Renderer is read-only"
      covers: ["OUT-001"]
  artifactAutomationPlan:
    - id: ART-001
      path: "_bmad-output/runtime/requirement-records/REQ-CONFIRM-INGEST/requirement-record.json"
      artifactType: requirement_record
      kind: requirement_record
      producer: ingest-confirmation-event.js
      consumer: main-agent
      ownerModel: requirements_contract
      sourceOfTruthRole: control
      canAffectControlFlow: true
      inputArtifacts: ["confirmation-render-report.json"]
      outputArtifacts: ["requirement-record.json"]
      recordEventTypes: ["confirmation_recorded"]
      userApprovalRequired: true
      retention: long_lived
      cleanupPolicy: retain
      orphanRisk: low
      containsSensitiveData: false
      trainingDataEligible: false
      linkedIds: ["MUST-001", "EVD-001"]
    - id: ART-002
      path: "_bmad-output/runtime/requirement-records/mentor-events.jsonl"
      artifactType: event_log
      kind: event_log
      producer: ingest-confirmation-event.js
      consumer: audit
      ownerModel: requirements_contract
      sourceOfTruthRole: evidence
      canAffectControlFlow: false
      inputArtifacts: ["requirement-record.json"]
      outputArtifacts: ["mentor-events.jsonl"]
      recordEventTypes: ["confirmation_recorded"]
      userApprovalRequired: false
      retention: long_lived
      cleanupPolicy: retain
      orphanRisk: low
      containsSensitiveData: false
      trainingDataEligible: false
      linkedIds: ["NEG-001", "EVD-002"]
  governanceEventTypeRegistry:
    - eventType: confirmation_recorded
      ownerModel: requirements_contract
      payloadKind: status
      payloadContract:
        requiredFields: ["eventType", "status"]
        forbiddenFields: ["result", "decision"]
        allowedControlWriteMode: control
      writesControlFields: ["confirmationHistory"]
      allowedStatusValues: ["user_confirmed", "reconfirm_required"]
      canAffectControlFlow: true
    - eventType: artifact_index_recorded
      ownerModel: requirements_contract
      payloadKind: artifactRefs
      payloadContract:
        requiredFields: ["eventType", "artifactRefs"]
        forbiddenFields: ["result", "decision", "status"]
        allowedControlWriteMode: artifact_only
      writesControlFields: ["artifactIndex"]
      canAffectControlFlow: false
  controlledIngestWriterRegistry:
    - writerId: requirements-confirmation-ingest
      scriptPath: "_bmad/skills/requirements-contract-authoring/scripts/ingest-confirmation-event.js"
      scriptContentHash: "sha256:fixture-confirmation-ingest"
      ownerModel: requirements_contract
      allowedWriteApis: ["appendControlEvent", "atomicWriteRequirementRecord", "appendArtifactIndex"]
      allowedPaths:
        - "_bmad-output/runtime/requirement-records/<requirement-set-id>/requirement-record.json"
        - "_bmad-output/runtime/requirement-records/<requirement-set-id>/events/control-events.jsonl"
        - "_bmad-output/runtime/requirement-records/<requirement-set-id>/artifact-index.jsonl"
        - "_bmad-output/runtime/requirement-records/artifact-index.jsonl"
      allowedEventTypes: ["confirmation_recorded", "artifact_index_recorded"]
      payloadContractRefs: ["confirmation_recorded", "artifact_index_recorded"]
      writesControlFields: ["confirmationHistory", "artifactIndex"]
      receiptPath: "_bmad-output/runtime/requirement-records/<requirement-set-id>/receipts/requirements-confirmation-ingest/<receipt-id>.json"
      beforeAfterHashRequired: true
      canModifyWriterRegistry: false
      registryHash: "sha256:fixture-writer-registry"
      architectureConfirmationHash: "sha256:fixture-architecture"
  functionalResumeFailureCaseRegistry:
    status: frozen_in_P0
    p0ExecutableSubsetRequired: true
    p0RequiredFixtureCases: ["sourceDocumentHash_changed"]
    recoveryActionDefinitions:
      - actionId: require_user_reconfirmation
        label: "要求用户重新确认"
        ownerModel: requirements_contract
        automationLevel: user_required
        writesControlFields: ["confirmationHistory"]
        recordEventTypes: ["confirmation_recorded"]
        outputArtifacts: ["requirement-record.json"]
        createsNewCloseoutAttempt: false
        requiresUserConfirmation: true
    groups:
      - groupId: hash_and_trace_checkpoint
        label: "Hash consistency"
        caseRefs: ["sourceDocumentHash_changed"]
        ownerModel: requirements_contract
        blockingBehavior: fail_closed_before_resume
        requiredEvidenceRefs: ["EVD-002"]
        requiredTraceRefs: ["TRACE-001"]
    failureCases:
      - id: sourceDocumentHash_changed
        groupId: hash_and_trace_checkpoint
        coveragePhase: P0 deterministic fixture
        p0Required: true
        triggerSignal: "source hash differs"
        detectionPoint: "ingest validation"
        failClosedGate: Confirmation Ingest Gate
        failureRecordType: reconfirmation_required
        expectedRecoveryActions: ["require_user_reconfirmation"]

\`\`\`mermaid
sequenceDiagram
  actor User
  participant Ingest
  participant Record
  User->>Ingest: confirm current hashes [MUST-001]
  Ingest->>Record: write confirmation_recorded [MUST-001,EVD-001]
  User->>Ingest: stale hash [NEG-001]
  Ingest-->>User: reject write [NEG-001,EVD-002]
\`\`\`

\`\`\`mermaid
stateDiagram-v2
  [*] --> draft
  draft --> user_confirmed: valid confirmation [MUST-001]
  draft --> blocked: mismatched hash [NEG-001]
\`\`\`
`,
    'utf8'
  );
  return file;
}

function runNode(script: string, args: string[]) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

function runPython(script: string, args: string[]) {
  return spawnSync('python', [script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

function render(source: string) {
  const out = path.join(tempDir, '_bmad-output/runtime/requirements/REQ-CONFIRM-INGEST/confirmation/confirmation.html');
  const result = runNode(RENDERER, [
    '--source',
    source,
    '--out',
    out,
    '--language',
    'zh-CN',
    '--record-id',
    'REQ-CONFIRM-INGEST',
    '--entry-flow',
    'story',
    '--mermaid-bundle',
    writeMockMermaidBundle(),
    '--json',
  ]);
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  const reportPath = path.join(path.dirname(out), 'confirmation-render-report.json');
  return { out, reportPath, report: JSON.parse(fs.readFileSync(reportPath, 'utf8')) };
}

describe('controlled confirmation ingest', () => {
  it('blocks req-trace prompt before ingest and allows it after controlled confirmation ingest', () => {
    const source = writeSource();
    const blockedPrompt = runPython(REQ_TRACE_PROMPT, ['--source-document', source]);
    expect(blockedPrompt.status).toBe(3);
    expect(blockedPrompt.stdout).toContain('BLOCK: CONFIRMATION_REQUIRED');

    const { reportPath, report } = render(source);
    const recordPath = path.join(tempDir, '_bmad-output/runtime/requirement-records/REQ-CONFIRM-INGEST/requirement-record.json');
    const ingest = runNode(INGEST, [
      '--source',
      source,
      '--render-report',
      reportPath,
      '--confirmation-text',
      report.confirmInstruction,
      '--confirmed-by',
      'test-user',
      '--record-id',
      'REQ-CONFIRM-INGEST',
      '--requirement-record',
      recordPath,
      '--confirmed-at',
      '2026-05-18T06:00:00.000Z',
      '--json',
    ]);
    expect(ingest.status).toBe(0);

    const allowedPrompt = runPython(REQ_TRACE_PROMPT, [
      '--source-document',
      source,
      '--requirement-record',
      recordPath,
    ]);
    expect(
      allowedPrompt.status,
      `${allowedPrompt.stdout}\n${allowedPrompt.stderr}`
    ).toBe(0);
    expect(allowedPrompt.stdout).toContain('$executing-plans $verification-before-completion');
    expect(allowedPrompt.stdout).toContain('#implementationConfirmation');
    expect(allowedPrompt.stdout).toContain('TRACE-001');
    expect(allowedPrompt.stdout).toContain('PASS requires evidence for covered must, notDone, and evidence IDs');

    const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
    expect(record.confirmationHistory.at(-1)).toMatchObject({
      eventType: 'confirmation_recorded',
      sourceDocumentHash: report.sourceDocumentHash,
      implementationConfirmationHash: report.implementationConfirmationHash,
      confirmationPageHash: report.confirmationPageHash,
    });
  });

  it('writes confirmation history, source bookkeeping, event log, and artifact index after exact chat confirmation', () => {
    const source = writeSource();
    const { reportPath, report } = render(source);
    const recordPath = path.join(tempDir, '_bmad-output/runtime/requirement-records/REQ-CONFIRM-INGEST/requirement-record.json');
    const eventLogPath = path.join(tempDir, '_bmad-output/runtime/requirement-records/mentor-events.jsonl');
    const artifactIndexPath = path.join(tempDir, '_bmad-output/runtime/requirement-records/artifact-index.jsonl');
    const result = runNode(INGEST, [
      '--source',
      source,
      '--render-report',
      reportPath,
      '--confirmation-text',
      report.confirmInstruction,
      '--confirmed-by',
      'test-user',
      '--record-id',
      'REQ-CONFIRM-INGEST',
      '--requirement-record',
      recordPath,
      '--event-log',
      eventLogPath,
      '--artifact-index',
      artifactIndexPath,
      '--confirmed-at',
      '2026-05-18T06:00:00.000Z',
      '--json',
    ]);

    expect(result.status).toBe(0);
    const updatedSource = fs.readFileSync(source, 'utf8');
    const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
    const events = fs.readFileSync(eventLogPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    const indexRows = fs.readFileSync(artifactIndexPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line));

    expect(updatedSource).toContain('status: user_confirmed');
    expect(updatedSource).toContain('confirmedBy: test-user');
    expect(updatedSource).toContain(`sourceDocumentHash: ${report.sourceDocumentHash}`);
    expect(updatedSource).toContain(`implementationConfirmationHash: ${report.implementationConfirmationHash}`);
    expect(record.status).toBe('user_confirmed');
    expect(record.confirmationHistory).toHaveLength(1);
    expect(record.confirmationHistory[0]).toMatchObject({
      eventType: 'confirmation_recorded',
      confirmedBy: 'test-user',
      sourceDocumentHash: report.sourceDocumentHash,
      implementationConfirmationHash: report.implementationConfirmationHash,
      confirmationPageHash: report.confirmationPageHash,
    });
    expect(events[0].eventType).toBe('confirmation_recorded');
    expect(indexRows[0]).toMatchObject({
      artifactType: 'requirement_record',
      sourceOfTruthRole: 'control',
      eventType: 'confirmation_recorded',
    });
  });

  it('accepts semantic confirmation when only confirmation projection hash refreshed', () => {
    const source = writeSource();
    const { reportPath, report } = render(source);
    const recordPath = path.join(tempDir, '_bmad-output/runtime/requirement-records/REQ-CONFIRM-INGEST/requirement-record.json');
    const eventLogPath = path.join(tempDir, '_bmad-output/runtime/requirement-records/mentor-events.jsonl');
    const firstIngest = runNode(INGEST, [
      '--source',
      source,
      '--render-report',
      reportPath,
      '--confirmation-text',
      report.confirmInstruction,
      '--confirmed-by',
      'test-user',
      '--record-id',
      'REQ-CONFIRM-INGEST',
      '--requirement-record',
      recordPath,
      '--event-log',
      eventLogPath,
      '--confirmed-at',
      '2026-05-18T06:00:00.000Z',
      '--json',
    ]);
    expect(firstIngest.status, `${firstIngest.stdout}\n${firstIngest.stderr}`).toBe(0);
    const sourceAfterConfirmation = fs.readFileSync(source, 'utf8');
    const recordAfterConfirmation = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
    const changedReportPath = path.join(path.dirname(reportPath), 'confirmation-render-report-refreshed.json');
    const changedReport = {
      ...report,
      confirmationPageHash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      artifactRef: {
        ...report.artifactRef,
        hash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      },
    };
    fs.writeFileSync(changedReportPath, JSON.stringify(changedReport, null, 2), 'utf8');

    const result = runNode(INGEST, [
      '--source',
      source,
      '--render-report',
      changedReportPath,
      '--confirmation-text',
      report.confirmInstruction,
      '--confirmed-by',
      'test-user',
      '--record-id',
      'REQ-CONFIRM-INGEST',
      '--requirement-record',
      recordPath,
      '--event-log',
      eventLogPath,
      '--confirmed-at',
      '2026-05-18T06:10:00.000Z',
      '--json',
    ]);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
    const events = fs.readFileSync(eventLogPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    expect(fs.readFileSync(source, 'utf8')).toBe(sourceAfterConfirmation);
    expect(record.confirmationHistory).toEqual(recordAfterConfirmation.confirmationHistory);
    expect(record.confirmationHistory.at(-1)).toMatchObject({
      eventType: 'confirmation_recorded',
      sourceDocumentHash: report.sourceDocumentHash,
      implementationConfirmationHash: report.implementationConfirmationHash,
      confirmationPageHash: report.confirmationPageHash,
    });
    expect(record.confirmationProjectionHistory.at(-1)).toMatchObject({
      eventType: 'confirmation_projection_refreshed',
      oldProjectionHash: report.confirmationPageHash,
      newProjectionHash: changedReport.confirmationPageHash,
    });
    expect(record.status).toBe('user_confirmed');
    expect(events.map((event) => event.eventType)).toEqual([
      'confirmation_recorded',
      'confirmation_projection_refreshed',
    ]);
    expect(JSON.parse(result.stdout).event).toBeNull();
  });

  it('rejects mismatched confirmation text and does not write confirmation state', () => {
    const source = writeSource();
    const before = fs.readFileSync(source, 'utf8');
    const { reportPath, report } = render(source);
    const recordPath = path.join(tempDir, '_bmad-output/runtime/requirement-records/REQ-CONFIRM-INGEST/requirement-record.json');
    const badText = report.confirmInstruction.replace(/sourceDocumentHash=sha256:[a-f0-9]{64}/, 'sourceDocumentHash=sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    const result = runNode(INGEST, [
      '--source',
      source,
      '--render-report',
      reportPath,
      '--confirmation-text',
      badText,
      '--confirmed-by',
      'test-user',
      '--record-id',
      'REQ-CONFIRM-INGEST',
      '--requirement-record',
      recordPath,
      '--json',
    ]);

    expect(result.status).toBe(3);
    expect(result.stderr).toContain('confirmation_text_source_hash_mismatch');
    expect(fs.readFileSync(source, 'utf8')).toBe(before);
    expect(fs.existsSync(recordPath)).toBe(false);
  });
});
