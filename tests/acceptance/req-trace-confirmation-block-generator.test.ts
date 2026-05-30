import { execFileSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import yaml from 'js-yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SCRIPT = path.join(
  ROOT,
  '_bmad',
  'skills',
  'req-trace-matrix-prompt-generator',
  'scripts',
  'generate_prompt.py'
);
const NODE_SCRIPT = path.join(
  ROOT,
  '_bmad',
  'skills',
  'req-trace-matrix-prompt-generator',
  'scripts',
  'generate_prompt.js'
);
const CANONICAL_SKILL_DIR = path.join(ROOT, '_bmad', 'skills', 'req-trace-matrix-prompt-generator');
const HOST_SKILL_SURFACES = ['.codex', '.cursor', '.claude'] as const;

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'req-trace-confirmation-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function writeSource(body: string): string {
  const file = path.join(tempDir, 'source.md');
  fs.writeFileSync(file, body, 'utf8');
  return file;
}

const BOOKKEEPING_FIELDS = new Set([
  'status',
  'confirmedAt',
  'confirmedBy',
  'sourceDocumentHash',
  'implementationConfirmationHash',
  'reconfirmationRequest',
  'confirmationRender',
]);

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => {
      const record = value as Record<string, unknown>;
      return `${JSON.stringify(key)}:${stableStringify(record[key])}`;
    })
    .join(',')}}`;
}

function sha256(content: string): string {
  return `sha256:${crypto.createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

function semanticConfirmationForHash(
  confirmation: Record<string, unknown>
): Record<string, unknown> {
  const semantic: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(confirmation)) {
    if (!BOOKKEEPING_FIELDS.has(key)) semantic[key] = value;
  }
  return semantic;
}

function extractConfirmation(sourceText: string): {
  blockText: string;
  confirmation: Record<string, unknown>;
} {
  const lines = sourceText.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((line) => /^implementationConfirmation:\s*$/.test(line));
  if (start < 0) throw new Error('missing implementationConfirmation');
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '') continue;
    if (/^\S/.test(line)) {
      end = i;
      break;
    }
  }
  const blockText = lines.slice(start, end).join('\n');
  const parsed = yaml.load(blockText) as { implementationConfirmation?: Record<string, unknown> };
  if (!parsed?.implementationConfirmation) throw new Error('invalid implementationConfirmation');
  return { blockText, confirmation: parsed.implementationConfirmation };
}

function currentHashes(sourcePath: string): {
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
} {
  const sourceText = fs.readFileSync(sourcePath, 'utf8');
  const { blockText, confirmation } = extractConfirmation(sourceText);
  const semantic = semanticConfirmationForHash(confirmation);
  const normalizedBlock = `implementationConfirmation:${stableStringify(semantic)}`;
  return {
    sourceDocumentHash: sha256(sourceText.replace(blockText, normalizedBlock)),
    implementationConfirmationHash: sha256(stableStringify(semantic)),
  };
}

function writeRequirementRecord(
  sourcePath: string,
  overrides: Partial<{
    sourceDocumentHash: string;
    implementationConfirmationHash: string;
  }> = {}
): string {
  const recordPath = path.join(tempDir, 'requirement-record.json');
  const hashes = { ...currentHashes(sourcePath), ...overrides };
  fs.writeFileSync(
    recordPath,
    `${JSON.stringify(
      {
        recordId: 'REQ-TRACE-001',
        status: 'user_confirmed',
        controlStore: {
          schemaVersion: 'control-store/v1',
          eventLogPath: path.join(tempDir, 'events', 'control-events.jsonl').replace(/\\/g, '/'),
          reducer: 'canonical-requirement-record-reducer/v1',
          atomicCommitter: 'requirement-record-control-store/v1',
        },
        ...hashes,
        confirmationHistory: [
          {
            eventType: 'confirmation_recorded',
            confirmedAt: '2026-05-10T00:00:00.000Z',
            confirmedBy: 'test-user',
            sourcePath,
            ...hashes,
            confirmationPageHash:
              'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          },
        ],
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return recordPath;
}

function run(
  args: string[],
  options: { env?: NodeJS.ProcessEnv } = {}
): { stdout: string; status: number } {
  try {
    const stdout = execFileSync('python', [SCRIPT, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { stdout, status: 0 };
  } catch (error: any) {
    return { stdout: String(error.stdout ?? ''), status: error.status ?? 1 };
  }
}

function runNodePrompt(args: string[]): { stdout: string; status: number } {
  try {
    const stdout = execFileSync(process.execPath, [NODE_SCRIPT, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { stdout, status: 0 };
  } catch (error: any) {
    return { stdout: String(error.stdout ?? ''), status: error.status ?? 1 };
  }
}

function readJson<T = Record<string, unknown>>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function validSource(overrides = ''): string {
  return `# Source

implementationConfirmation:
  status: user_confirmed
  confirmedAt: "2026-05-10"
  confirmedBy: "user"
  sourceDocumentHash: "hash"
  must:
    - id: MUST-001
      text: "Valid upload persists a file."
      evidenceRefs: ["EVD-001"]
  notDone:
    - id: NEG-001
      text: "Empty file must not display success."
      evidenceRefs: ["EVD-002"]
  mustNot:
    - id: OUT-001
      text: "Batch upload is out of scope."
  evidence:
    - id: EVD-001
      text: "Run upload acceptance."
      gate: "npm run test:e2e -- upload"
      oracle: "file exists"
    - id: EVD-002
      text: "Run invalid upload acceptance."
      gate: "npm run test:e2e -- upload-invalid"
      oracle: "no file exists"
  openQuestions: []
  traceRows:
    - id: TRACE-001
      covers: ["MUST-001", "NEG-001"]
      taskRefs: []
      evidenceRefs: ["EVD-001", "EVD-002"]
      contractValidationCommandRefs: ["CMD-CONTRACT-001"]
      deliveryEvidenceCommandRefs: ["CMD-DELIVERY-001", "CMD-DELIVERY-002"]
      boundaryViewRefs: ["BOUNDARY-001"]
      status: PENDING
  boundaryViews:
    - id: BOUNDARY-001
      title: "Upload scope boundary"
      covers: ["OUT-001"]
  requiredCommands:
    - id: CMD-CONTRACT-001
      commandRef:
        skill: requirements-contract-authoring
        script: scripts/render-requirements-confirmation-html.ts
      command: "node <skill-dir>/scripts/render-requirements-confirmation-html.ts --source source.md"
      purpose: "Validate the confirmation source."
    - id: CMD-DELIVERY-001
      command: "npm run test:e2e -- upload"
      purpose: "Produce positive-path delivery evidence."
    - id: CMD-DELIVERY-002
      command: "npm run test:e2e -- upload-invalid"
      purpose: "Produce negative-path delivery evidence."
  suggestedCommands:
    - id: CMD-SUGGESTED-001
      command: "npm run lint"
      purpose: "Optional quality signal; not acceptance evidence."
  closeoutReadinessPreview:
    requiredCommands: ["CMD-CONTRACT-001", "CMD-DELIVERY-001", "CMD-DELIVERY-002"]
${overrides}`;
}

function validCompilerSource(overrides = ''): string {
  return `# Compiler Source

implementationConfirmation:
  status: user_confirmed
  confirmedAt: "2026-05-10"
  confirmedBy: "user"
  sourceDocumentHash: "hash"
  applicability:
    currentTargetMap:
      applies: true
      reasonCode: "compiler_requires_current_target_map"
    aiTddContractGate:
      applies: true
      reasonCode: "compiler_requires_ai_tdd_packet"
  preConfirmationDrilldown:
    semanticKernelRef: authoring/semantic-kernel.json
    mustDecompositionPacketRef: authoring/must_decomposition_packet.json
    reconciliationReportRef: authoring/must_packet_source_reconciliation_report.json
    preRenderGateReportRef: authoring/pre-render-must-decomposition-gate-report.json
    criticalAuditorReceiptRefs:
      - authoring/critical-auditor-receipt-round-1.json
      - authoring/critical-auditor-receipt-round-2.json
      - authoring/critical-auditor-receipt-round-3.json
  must:
    - id: MUST-001
      text: "Compile synchronized execution artifacts."
      evidenceRefs: ["EVD-001"]
  notDone:
    - id: NEG-001
      text: "Prompt-only output cannot close execution."
      evidenceRefs: ["EVD-001"]
  mustNot:
    - id: OUT-004
      text: "Do not change bugfix, standalone task, story, or other agent prompt routing."
  evidence:
    - id: EVD-001
      text: "Compiler output artifacts are hash-linked and complete."
      requiredCommandRefs: ["CMD-TEST-001"]
      oracle: "model packet, prompt, and receipt share hashes"
  failurePaths:
    - id: FAIL-001
      title: "Prompt-only compiler path"
      trigger: "Only human prompt is emitted."
      expectedBehavior: "Fail closed."
      forbiddenBehavior: "Treat prompt text as execution authority."
      blocksCompletionWhenViolated: true
      linkedNegIds: ["NEG-001"]
      linkedEvidenceIds: ["EVD-001"]
  edgeCases:
    - id: EDGE-001
      category: prompt_projection_authority
      condition: "Human prompt includes content not present in model packet."
      expectedBehavior: "Fail closed."
      forbiddenBehavior: "Use prompt-only requirement semantics."
      linkedFailurePathIds: ["FAIL-001"]
      linkedEvidenceIds: ["EVD-001"]
  traceRows:
    - id: TRACE-001
      covers: ["MUST-001", "NEG-001"]
      taskRefs: ["TASK-001"]
      evidenceRefs: ["EVD-001"]
      contractValidationCommandRefs: ["CMD-TEST-001"]
      deliveryEvidenceCommandRefs: ["CMD-TEST-001"]
      acceptanceRefs: ["ACC-001", "E2E-001"]
      e2eRefs: ["E2E-001"]
      failurePathRefs: ["FAIL-001"]
      edgeCaseRefs: ["EDGE-001"]
      artifactRefs: ["ART-001"]
      targetModificationPaths: ["_bmad/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.js"]
      currentTargetMapRefs: ["CTM-001"]
      canonicalSurfaceRefs: ["SURFACE-001"]
      legacyDenialRefs: ["LEGACY-001"]
      expectedRedProofs: ["ACC-001", "E2E-001"]
      greenExitCriteria: "Artifacts are synchronized."
      refactorGuards: "Do not change packet authority."
      allowedRuntimeWrites: ["artifactIndex"]
      forbiddenProofTypes: ["audit_receipt_only", "completion_packet_only"]
      status: PENDING
  atomicImplementationTaskList:
    - id: TASK-001
      title: "Compile synchronized packet artifacts"
      mustRefs: ["MUST-001"]
      traceRefs: ["TRACE-001"]
      evidenceRefs: ["EVD-001"]
      targetFiles:
        - _bmad/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.js
      redProofPlan: "Assert --out-dir does not produce all artifacts before implementation."
      derivedFromProjectionRef: "must_decomposition_packet:atomicImplementationTaskList[TASK-001]"
  mustToAtomicTaskMap:
    MUST-001: ["TASK-001"]
  atomicTaskToTraceMap:
    TASK-001: ["TRACE-001"]
  acceptanceTests:
    - id: ACC-001
      file: tests/acceptance/req-trace-confirmation-block-generator.test.ts
      covers: ["MUST-001"]
      traceRows: ["TRACE-001"]
      evidenceRefs: ["EVD-001"]
      commandRefs: ["CMD-TEST-001"]
      failurePathRefs: ["FAIL-001"]
      edgeCaseRefs: ["EDGE-001"]
      expectedPreImplementationState: expected_red
      redProofPlan: "Before implementation, --out-dir lacks synchronized outputs."
      oracle: "Artifacts are hash linked."
  e2eSuites:
    - id: E2E-001
      file: tests/acceptance/req-trace-confirmation-block-generator.test.ts
      covers: ["MUST-001", "NEG-001"]
      traceRows: ["TRACE-001"]
      evidenceRefs: ["EVD-001"]
      commandRefs: ["CMD-TEST-001"]
      failurePathRefs: ["FAIL-001"]
      edgeCaseRefs: ["EDGE-001"]
      expectedPreImplementationState: expected_red
      redProofPlan: "Before implementation, compiler does not emit model_packet.json."
      oracle: "Valid confirmed source produces model packet, prompt, and receipt."
      negativeControls: ["NEG-001"]
  artifactAutomationPlan:
    - id: ART-001
      artifactType: json
      path: model_packet.json
      traceRows: ["TRACE-001"]
      evidenceRefs: ["EVD-001"]
  targetModificationPaths:
    - id: TARGET-MOD-001
      path: _bmad/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.js
      traceRows: ["TRACE-001"]
      evidenceRefs: ["EVD-001"]
  requiredCommands:
    - id: CMD-TEST-001
      command: "npx vitest run tests/acceptance/req-trace-confirmation-block-generator.test.ts"
      oracle: "acceptance test pass"
      traceRows: ["TRACE-001"]
      evidenceRefs: ["EVD-001"]
  closeoutReadinessPreview:
    requiredCommands: ["CMD-TEST-001"]
  currentTargetMap:
    schemaVersion: current-target-map/v1
    displayProfile: closed_loop_current_target_map
    canonicalArtifacts:
      - id: SURFACE-001
        targetPathOrField: model_packet.json
        traceRows: ["TRACE-001"]
        evidenceRefs: ["EVD-001"]
    existingArtifacts:
      - id: LEGACY-001
        currentPath: trace-execution-prompt.txt
        completionProofPolicy: not_completion_proof
        traceRows: ["TRACE-001"]
        evidenceRefs: ["EVD-001"]
  aiTddContractExecutionManifestProjection:
    schemaVersion: contract-execution-manifest/v1
    applies: true
    requiredSections:
      - preConfirmationDrilldownInputs
      - atomicImplementationTaskLineage
      - errorCaseCoverage
      - commandTargets
      - traceClosureAssertions
      - currentTargetMap
      - canonicalSurfaceReconciliation
      - legacyDenial
      - finalGateMatrix
      - executionLoopProtocol
      - semanticGapPolicy
      - hostExecutionHints
      - closeoutProof
      - evidenceTrustStates
    preConfirmationDrilldownInputs:
      semanticKernelRequired: true
      synchronizedMustDecompositionPacketRequired: true
      criticalAuditorConsecutiveNoNewGapRounds: 3
      packetSourceReconciliationVerdict: pass
      preRenderGateReportVerdict: PASS
    atomicImplementationTaskLineage:
      requiredMaps: ["atomicImplementationTaskList", "mustToAtomicTaskMap", "atomicTaskToTraceMap"]
    errorCaseCoverage:
      failurePaths: ["FAIL-001"]
      edgeCases: ["EDGE-001"]
      acceptanceRefs: ["ACC-001", "E2E-001"]
    commandTargets:
      commandRefs: ["CMD-TEST-001"]
      atomicTaskCommandBindings:
        TASK-001: ["CMD-TEST-001"]
    traceClosureAssertions:
      - traceId: TRACE-001
        assertion: "Artifacts are synchronized."
        evidenceRefs: ["EVD-001"]
    currentTargetMapRefs: ["CTM-001"]
    canonicalSurfaceRefs: ["SURFACE-001"]
    legacyDenial:
      - id: LEGACY-001
        deniedSurface: prompt-only output
        replacement: model_packet.json
    finalGateMatrix:
      requiredCurrentAttemptGates:
        - gateId: final-required-commands
          commandRefs: ["CMD-TEST-001"]
          passRequired: true
        - gateId: ai-tdd-contract-gate
          authority: AI_TDD_gate_report
          passRequired: true
        - gateId: delivery-verification
          authority: delivery_verification_report
          passRequired: true
        - gateId: closeout-integrity
          authority: closeout_integrity_report
          passRequired: true
      stopCondition: all_required_current_attempt_gates_pass
      forbiddenStopConditions: ["partial_green", "exitCode_only", "prompt_completion", "goal_completion"]
    executionLoopProtocol:
      mode: bounded_until_final_acceptance
      authority: packet_only
      iterationRules:
        onGateFailure: repair_and_retry_same_trace_slice
        onSemanticGap: halt_for_reconfirmation
      stopConditions: ["finalGateMatrix_allows_closeout"]
      forbiddenStopConditions: ["prompt_only_completion_claim", "partial_green_without_final_acceptance"]
    semanticGapPolicy:
      semanticGapClasses: ["requirement_boundary_change", "acceptance_oracle_change"]
      nonSemanticExecutionGapClasses: ["implementation_bug", "test_failure"]
      semanticGapAction: reconfirm_required
      nonSemanticGapAction: repair_and_rerun
    hostExecutionHints:
      codexCapable:
        goalModeAllowed: true
        preferredContinuationMechanism: /goal
        goalObjectiveTemplate: "Execute model_packet.json until finalGateMatrix passes; halt for reconfirm_required on semantic gaps."
      nonCodex:
        goalModeAllowed: false
        preferredContinuationMechanism: branch_specific_future_work
        instruction: "Use branch-specific continuation instructions without emitting /goal."
      proofPolicy: execution_hint_only_not_delivery_or_closeout_proof
    closeoutProof:
      allowedAuthorities: ["AI_TDD_gate_report", "delivery_verification_report", "closeout_integrity_report"]
      forbiddenAuthorities: ["audit_receipt_json", "exitCode_only", "goal_completion"]
    evidenceTrustStates:
      trusted: ["current_attempt_controlled_report"]
      diagnosticOnly: ["audit_receipt_json", "executionLoopProtocol_state"]
      forbidden: ["mock_only", "self_certification"]
${overrides}`;
}

describe('req trace generator confirmation block gate', () => {
  it('keeps Codex, Cursor, and Claude skill surfaces script-complete and synced from the canonical skill', () => {
    const requiredRelativeFiles = [
      'SKILL.md',
      path.join('scripts', 'generate_prompt.js'),
      path.join('scripts', 'generate_prompt.py'),
      path.join('scripts', 'load-js-yaml.js'),
    ];

    for (const surface of HOST_SKILL_SURFACES) {
      const hostSkillDir = path.join(ROOT, surface, 'skills', 'req-trace-matrix-prompt-generator');
      for (const relativeFile of requiredRelativeFiles) {
        const canonicalPath = path.join(CANONICAL_SKILL_DIR, relativeFile);
        const hostPath = path.join(hostSkillDir, relativeFile);
        expect(fs.existsSync(hostPath), `${surface} is missing ${relativeFile}`).toBe(true);
        expect(fs.readFileSync(hostPath, 'utf8'), `${surface} has stale ${relativeFile}`).toBe(
          fs.readFileSync(canonicalPath, 'utf8')
        );
      }
      expect(fs.existsSync(path.join(hostSkillDir, 'scripts', '__pycache__'))).toBe(false);
    }
  });

  it('keeps skill docs and scripts free of fixed install roots while preserving portable refs', () => {
    const files = [
      path.join(CANONICAL_SKILL_DIR, 'SKILL.md'),
      path.join(CANONICAL_SKILL_DIR, 'scripts', 'generate_prompt.js'),
      path.join(CANONICAL_SKILL_DIR, 'scripts', 'generate_prompt.py'),
      path.join(CANONICAL_SKILL_DIR, 'scripts', 'load-js-yaml.js'),
    ];
    const forbiddenFixedRootFragments = [
      'D:/',
      'D:\\',
      'C:/',
      'C:\\',
      '_bmad/skills/req-trace-matrix-prompt-generator',
      '_bmad\\skills\\req-trace-matrix-prompt-generator',
      '.codex/skills/req-trace-matrix-prompt-generator',
      '.codex\\skills\\req-trace-matrix-prompt-generator',
      '.cursor/skills/req-trace-matrix-prompt-generator',
      '.cursor\\skills\\req-trace-matrix-prompt-generator',
      '.claude/skills/req-trace-matrix-prompt-generator',
      '.claude\\skills\\req-trace-matrix-prompt-generator',
    ];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      for (const fragment of forbiddenFixedRootFragments) {
        expect(
          content,
          `${path.relative(ROOT, file)} contains fixed install root ${fragment}`
        ).not.toContain(fragment);
      }
    }
    expect(fs.readFileSync(path.join(CANONICAL_SKILL_DIR, 'SKILL.md'), 'utf8')).toContain(
      '<skill-dir>/scripts/generate_prompt.js'
    );
  });

  it('compiles synchronized model packet, human prompt, and audit receipt artifacts', () => {
    const source = writeSource(validCompilerSource());
    const record = writeRequirementRecord(source);
    const outDir = path.join(tempDir, 'trace-execution');
    const result = runNodePrompt([
      '--source-document',
      source,
      '--requirement-record',
      record,
      '--out-dir',
      outDir,
      '--execution-host',
      'codex',
      '--json',
    ]);

    expect(result.status, result.stdout).toBe(0);
    const summary = JSON.parse(result.stdout);
    expect(summary.outputs).toMatchObject({
      modelPacket: expect.stringContaining('model_packet.json'),
      humanPrompt: expect.stringContaining('human_prompt.txt'),
      auditReceipt: expect.stringContaining('audit_receipt.json'),
    });

    const packet = readJson<Record<string, any>>(path.join(outDir, 'model_packet.json'));
    const prompt = fs.readFileSync(path.join(outDir, 'human_prompt.txt'), 'utf8');
    const receipt = readJson<Record<string, any>>(path.join(outDir, 'audit_receipt.json'));

    expect(packet.artifactRole).toBe('execution_authority');
    expect(packet.sourceDocumentHash).toBe(currentHashes(source).sourceDocumentHash);
    expect(packet.implementationConfirmationHash).toBe(
      currentHashes(source).implementationConfirmationHash
    );
    expect(packet.preConfirmationDrilldown).toMatchObject({
      semanticKernelRef: 'authoring/semantic-kernel.json',
      preRenderGateReportRef: 'authoring/pre-render-must-decomposition-gate-report.json',
    });
    expect(packet.atomicImplementationTaskList).toHaveLength(1);
    expect(packet.mustToAtomicTaskMap).toMatchObject({ 'MUST-001': ['TASK-001'] });
    expect(packet.atomicTaskToTraceMap).toMatchObject({ 'TASK-001': ['TRACE-001'] });
    expect(packet.contractExecutionManifest).toMatchObject({
      schemaVersion: 'contract-execution-manifest/v1',
      builderVersion: 'contract-execution-manifest-builder/v1',
      manifestHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      sourceProjectionHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      commandTargetCollection: expect.any(Object),
      finalGateMatrix: expect.any(Object),
      executionLoopProtocol: expect.any(Object),
      semanticGapPolicy: expect.any(Object),
      hostExecutionHints: expect.any(Object),
    });
    expect(packet.contractExecutionManifest).not.toHaveProperty('commandTargets');
    expect(packet.traceSlices[0]).toMatchObject({
      traceId: 'TRACE-001',
      requirementRefs: ['MUST-001'],
      negativeRequirementRefs: ['NEG-001'],
      acceptanceRefs: ['ACC-001', 'E2E-001'],
      e2eRefs: ['E2E-001'],
      failurePathRefs: ['FAIL-001'],
      edgeCaseRefs: ['EDGE-001'],
      artifactRefs: ['ART-001'],
      targetModificationPaths: [
        '_bmad/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.js',
      ],
      deliveryCommandRefs: ['CMD-TEST-001'],
      tddProtocol: {
        states: ['RED', 'GREEN', 'REFACTOR', 'CLOSEOUT'],
      },
    });
    expect(packet.runtimeWritePolicy).toMatchObject({
      sourceTraceRowsWritable: false,
      requirementRecordRequired: true,
    });
    expect(packet.blockingDecisionTable).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'SEMANTIC_GAP_RECONFIRM_REQUIRED' }),
        expect.objectContaining({ code: 'NON_SEMANTIC_GAP_REPAIR_AND_RERUN' }),
      ])
    );
    expect(packet.completionEvidencePacketSchema).toMatchObject({
      artifactRole: 'evidence_index_only_not_closeout_authority',
    });

    expect(packet.hostExecutionHints).toMatchObject({
      codex: expect.objectContaining({ strategy: 'goal_if_available_else_continue_nonstop' }),
      cursorIde: expect.objectContaining({ strategy: 'agent_panel_autonomous_prompt' }),
      cursorCli: expect.objectContaining({
        strategy: 'headless_command_with_external_supervisor_loop',
      }),
    });

    expect(prompt).toContain('$executing-plans $verification-before-completion');
    expect(prompt).toContain('Primary authority: model_packet.json');
    expect(prompt).toContain('continue nonstop');
    expect(prompt).toContain('Trace slices:');
    expect(prompt).toContain('Required commands:');
    expect(prompt).toContain('PASS requires evidence for covered must, notDone, and evidence IDs');
    expect(prompt).toContain('Semantic gap policy:');
    expect(prompt).toContain('semantic gaps -> reconfirm_required');
    expect(prompt).toContain('audit_receipt.json is generator self-audit only');
    expect(prompt).not.toContain('/goal Execute model_packet.json until finalGateMatrix passes');

    expect(receipt.decision).toBe('pass');
    expect(receipt.contractExecutionManifest).toMatchObject({
      schemaVersion: 'contract-execution-manifest/v1',
      builderVersion: 'contract-execution-manifest-builder/v1',
      manifestHash: packet.contractExecutionManifest.manifestHash,
      sourceProjectionHash: packet.contractExecutionManifest.sourceProjectionHash,
    });
    expect(receipt.executionHost).toBe('codex');
    expect(receipt.humanPromptProfile).toBe('full');
    expect(receipt.humanPromptLanguage).toBe('zh-CN');
    expect(receipt.continuationDirective).toMatchObject({
      strategy: 'goal_if_available_else_continue_nonstop',
      nativeGoalCommandUsed: false,
      directive: 'continue nonstop',
    });
    expect(receipt.humanPromptRequiredFragmentsPassed).toBe(true);
    expect(receipt.outputHashes.modelPacketHash).toBe(summary.outputHashes.modelPacketHash);
    expect(receipt.outputHashes.humanPromptHash).toBe(summary.outputHashes.humanPromptHash);
    expect(receipt.inputValidation).toMatchObject({
      sourceConfirmed: true,
      requirementRecordConfirmed: true,
      preConfirmationDrilldownPassed: true,
      aiTddManifestComplete: true,
      atomicTaskLineageComplete: true,
    });
  });

  it('blocks generation when legacy and canonical command target aliases conflict', () => {
    const source = writeSource(
      validCompilerSource().replace(
        `    commandTargets:
      commandRefs: ["CMD-TEST-001"]
      atomicTaskCommandBindings:
        TASK-001: ["CMD-TEST-001"]
    traceClosureAssertions:`,
        `    commandTargets:
      commandRefs: ["CMD-TEST-001"]
      atomicTaskCommandBindings:
        TASK-001: ["CMD-TEST-001"]
    commandTargetCollection:
      commandRefs: ["CMD-OTHER"]
      atomicTaskCommandBindings:
        TASK-001: ["CMD-OTHER"]
    traceClosureAssertions:`
      )
    );
    const record = writeRequirementRecord(source);
    const outDir = path.join(tempDir, 'alias-conflict-trace-execution');
    const result = runNodePrompt([
      '--source-document',
      source,
      '--requirement-record',
      record,
      '--out-dir',
      outDir,
      '--execution-host',
      'codex',
      '--goal-command-available',
      'true',
      '--json',
    ]);

    expect(result.status, result.stdout).toBe(3);
    const receipt = readJson<Record<string, any>>(path.join(outDir, 'audit_receipt.json'));
    expect(receipt.decision).toBe('blocked');
    expect(receipt.blockingReasons).toEqual(
      expect.arrayContaining(['MANIFEST_ALIAS_CONFLICT:commandTargets:commandTargetCollection'])
    );
    expect(receipt.contractExecutionManifest.aliasAudit).toMatchObject({
      aliasesUsed: expect.arrayContaining(['commandTargets', 'commandTargetCollection']),
      blockingReasons: expect.arrayContaining([
        'MANIFEST_ALIAS_CONFLICT:commandTargets:commandTargetCollection',
      ]),
    });
    expect(fs.existsSync(path.join(outDir, 'model_packet.json'))).toBe(false);
    expect(fs.existsSync(path.join(outDir, 'human_prompt.txt'))).toBe(false);
    expect(fs.existsSync(path.join(outDir, 'goal_execution.md'))).toBe(false);
  });

  it('accepts canonical commandTargetCollection without exposing legacy commandTargets', () => {
    const source = writeSource(
      validCompilerSource().replace(
        `    commandTargets:
      commandRefs: ["CMD-TEST-001"]
      atomicTaskCommandBindings:
        TASK-001: ["CMD-TEST-001"]`,
        `    commandTargetCollection:
      commandRefs: ["CMD-TEST-001"]
      atomicTaskCommandBindings:
        TASK-001: ["CMD-TEST-001"]`
      )
    );
    const record = writeRequirementRecord(source);
    const outDir = path.join(tempDir, 'canonical-command-target-trace-execution');
    const result = runNodePrompt([
      '--source-document',
      source,
      '--requirement-record',
      record,
      '--out-dir',
      outDir,
      '--json',
    ]);

    expect(result.status, result.stdout).toBe(0);
    const packet = readJson<Record<string, any>>(path.join(outDir, 'model_packet.json'));
    expect(packet.contractExecutionManifest.commandTargetCollection).toMatchObject({
      commandRefs: ['CMD-TEST-001'],
      atomicTaskCommandBindings: {
        'TASK-001': ['CMD-TEST-001'],
      },
    });
    expect(packet.contractExecutionManifest).not.toHaveProperty('commandTargets');
  });

  it('accepts equivalent legacy and canonical command target aliases without blocking', () => {
    const source = writeSource(
      validCompilerSource().replace(
        `    commandTargets:
      commandRefs: ["CMD-TEST-001"]
      atomicTaskCommandBindings:
        TASK-001: ["CMD-TEST-001"]
    traceClosureAssertions:`,
        `    commandTargets:
      commandRefs: ["CMD-TEST-001"]
      atomicTaskCommandBindings:
        TASK-001: ["CMD-TEST-001"]
    commandTargetCollection:
      commandRefs: ["CMD-TEST-001"]
      atomicTaskCommandBindings:
        TASK-001: ["CMD-TEST-001"]
    traceClosureAssertions:`
      )
    );
    const record = writeRequirementRecord(source);
    const outDir = path.join(tempDir, 'equivalent-command-target-aliases-trace-execution');
    const result = runNodePrompt([
      '--source-document',
      source,
      '--requirement-record',
      record,
      '--out-dir',
      outDir,
      '--json',
    ]);

    expect(result.status, result.stdout).toBe(0);
    const packet = readJson<Record<string, any>>(path.join(outDir, 'model_packet.json'));
    const receipt = readJson<Record<string, any>>(path.join(outDir, 'audit_receipt.json'));
    expect(packet.contractExecutionManifest.commandTargetCollection).toBeDefined();
    expect(packet.contractExecutionManifest).not.toHaveProperty('commandTargets');
    expect(receipt.contractExecutionManifest.aliasAudit).toMatchObject({
      aliasesUsed: expect.arrayContaining(['commandTargets', 'commandTargetCollection']),
      blockingReasons: [],
    });
  });

  it('uses /goal for Codex only when explicitly available and allowed', () => {
    const source = writeSource(validCompilerSource());
    const record = writeRequirementRecord(source);
    const outDir = path.join(tempDir, 'codex-goal-trace-execution');
    const result = runNodePrompt([
      '--source-document',
      source,
      '--requirement-record',
      record,
      '--out-dir',
      outDir,
      '--execution-host',
      'codex',
      '--goal-command-available',
      'true',
      '--json',
    ]);

    expect(result.status).toBe(0);
    const prompt = fs.readFileSync(path.join(outDir, 'human_prompt.txt'), 'utf8');
    const receipt = readJson<Record<string, any>>(path.join(outDir, 'audit_receipt.json'));
    expect(prompt).toContain('/goal Execute REQ-TRACE-001 by following');
    expect(prompt).toContain('goal_execution.md');
    expect(prompt).toContain(
      'The /goal command is an entry pointer only, not the full task scope.'
    );
    expect(prompt).toContain('Execution scope is goal_execution.md + model_packet.json.');
    expect(prompt).not.toContain('\ncontinue nonstop\n');
    expect(fs.readFileSync(path.join(outDir, 'goal_execution.md'), 'utf8')).toContain(
      'AI-TDD protocol:'
    );
    expect(receipt.continuationDirective).toMatchObject({
      strategy: 'goal_if_available_else_continue_nonstop',
      nativeGoalCommandUsed: true,
    });
    expect(receipt.goalCommand).toMatchObject({
      mode: 'native_goal_document_ref',
      documentHash: expect.stringMatching(/^sha256:/),
    });
    expect(receipt.goalCommand.mode).not.toBe('native_goal_inline');
  });

  it('defaults Codex native /goal to allowed when confirmed host hints omit goalModeAllowed', () => {
    const source = writeSource(
      validCompilerSource().replace(
        `    hostExecutionHints:
      codexCapable:
        goalModeAllowed: true
        preferredContinuationMechanism: /goal
        goalObjectiveTemplate: "Execute model_packet.json until finalGateMatrix passes; halt for reconfirm_required on semantic gaps."
      nonCodex:
        goalModeAllowed: false
        preferredContinuationMechanism: branch_specific_future_work
        instruction: "Use branch-specific continuation instructions without emitting /goal."
      proofPolicy: execution_hint_only_not_delivery_or_closeout_proof`,
        `    hostExecutionHints:
      hostSurfaces: ["_bmad/skills/bmad-speckit/SKILL.md"]
      projectionStatus: synchronized`
      )
    );
    const record = writeRequirementRecord(source);
    const outDir = path.join(tempDir, 'codex-goal-default-allowed-trace-execution');
    const result = runNodePrompt([
      '--source-document',
      source,
      '--requirement-record',
      record,
      '--out-dir',
      outDir,
      '--execution-host',
      'codex',
      '--goal-command-available',
      'true',
      '--json',
    ]);

    expect(result.status).toBe(0);
    expect(fs.existsSync(path.join(outDir, 'goal_execution.md'))).toBe(true);
    const receipt = readJson<Record<string, any>>(path.join(outDir, 'audit_receipt.json'));
    expect(receipt.goalCommand.mode).toBe('native_goal_document_ref');
    expect(receipt.continuationDirective.nativeGoalCommandUsed).toBe(true);
  });

  it('projects generic continuation text without /goal for generic hosts', () => {
    const source = writeSource(validCompilerSource());
    const record = writeRequirementRecord(source);
    const outDir = path.join(tempDir, 'generic-trace-execution');
    const result = runNodePrompt([
      '--source-document',
      source,
      '--requirement-record',
      record,
      '--out-dir',
      outDir,
      '--execution-host',
      'generic',
    ]);

    expect(result.status).toBe(0);
    const prompt = fs.readFileSync(path.join(outDir, 'human_prompt.txt'), 'utf8');
    const receipt = readJson<Record<string, any>>(path.join(outDir, 'audit_receipt.json'));
    expect(prompt).toContain(
      'Continue until all final gates pass or semantic gap requires reconfirm_required'
    );
    expect(prompt).not.toContain('/goal');
    expect(receipt.executionHost).toBe('generic');
    expect(receipt.continuationDirective.strategy).toBe('prompt_contract_only');
  });

  it('defaults cursor alias to Cursor IDE prompt and reserves cursor-agent for cursor-cli', () => {
    const source = writeSource(validCompilerSource());
    const record = writeRequirementRecord(source);
    const ideOutDir = path.join(tempDir, 'cursor-ide-trace-execution');
    const cliOutDir = path.join(tempDir, 'cursor-cli-trace-execution');
    const ideResult = runNodePrompt([
      '--source-document',
      source,
      '--requirement-record',
      record,
      '--out-dir',
      ideOutDir,
      '--execution-host',
      'cursor',
      '--json',
    ]);
    const cliResult = runNodePrompt([
      '--source-document',
      source,
      '--requirement-record',
      record,
      '--out-dir',
      cliOutDir,
      '--execution-host',
      'cursor-cli',
      '--json',
    ]);

    expect(ideResult.status).toBe(0);
    expect(cliResult.status).toBe(0);
    const idePrompt = fs.readFileSync(path.join(ideOutDir, 'human_prompt.txt'), 'utf8');
    const cliPrompt = fs.readFileSync(path.join(cliOutDir, 'human_prompt.txt'), 'utf8');
    const ideReceipt = readJson<Record<string, any>>(path.join(ideOutDir, 'audit_receipt.json'));
    const cliReceipt = readJson<Record<string, any>>(path.join(cliOutDir, 'audit_receipt.json'));
    expect(idePrompt).toContain('Cursor IDE Agent mode');
    expect(idePrompt).not.toContain('cursor-agent -p');
    expect(ideReceipt.executionHost).toBe('cursor-ide');
    expect(ideReceipt.executionHostAliasUsed).toBe('cursor');
    expect(cliPrompt).toContain('cursor-agent -p --force --output-format stream-json');
    expect(cliPrompt).toContain('External supervisor loop:');
    expect(cliReceipt.executionHost).toBe('cursor-cli');
  });

  it('resolves prompt language and supports compact human prompt profile', () => {
    const source = writeSource(validCompilerSource());
    const record = writeRequirementRecord(source);
    const outDir = path.join(tempDir, 'english-compact-trace-execution');
    const result = runNodePrompt([
      '--source-document',
      source,
      '--requirement-record',
      record,
      '--out-dir',
      outDir,
      '--execution-host',
      'claude',
      '--prompt-language',
      'en-US',
      '--human-prompt-profile',
      'compact',
      '--json',
    ]);

    expect(result.status).toBe(0);
    const prompt = fs.readFileSync(path.join(outDir, 'human_prompt.txt'), 'utf8');
    const receipt = readJson<Record<string, any>>(path.join(outDir, 'audit_receipt.json'));
    expect(prompt).toContain('Only ');
    expect(prompt).toContain('Full details are in model_packet.json');
    expect(receipt.executionHost).toBe('claude-code');
    expect(receipt.executionHostAliasUsed).toBe('claude');
    expect(receipt.humanPromptProfile).toBe('compact');
    expect(receipt.humanPromptLanguage).toBe('en-US');
    expect(receipt.humanPromptRequiredFragmentsPassed).toBe(true);
  });

  it('writes a blocked audit receipt when drilldown or atomic lineage is missing', () => {
    const source = writeSource(
      validCompilerSource()
        .replace(/ {2}preConfirmationDrilldown:[\s\S]*? {2}must:\n/u, '  must:\n')
        .replace(
          / {2}atomicImplementationTaskList:[\s\S]*? {2}acceptanceTests:\n/u,
          '  acceptanceTests:\n'
        )
    );
    const record = writeRequirementRecord(source);
    const outDir = path.join(tempDir, 'blocked-trace-execution');
    const result = runNodePrompt([
      '--source-document',
      source,
      '--requirement-record',
      record,
      '--out-dir',
      outDir,
      '--json',
    ]);

    expect(result.status).toBe(3);
    const receipt = readJson<Record<string, any>>(path.join(outDir, 'audit_receipt.json'));
    expect(receipt.decision).toBe('blocked');
    expect(receipt.blockingReasons).toEqual(
      expect.arrayContaining([
        'PRE_CONFIRMATION_DRILLDOWN_REQUIRED',
        'ATOMIC_TASK_LINEAGE_REQUIRED',
      ])
    );
    expect(fs.existsSync(path.join(outDir, 'model_packet.json'))).toBe(false);
    expect(fs.existsSync(path.join(outDir, 'human_prompt.txt'))).toBe(false);
  });

  it('accepts object-shaped pre-confirmation drilldown refs from controlled records', () => {
    const source = writeSource(
      validCompilerSource().replace(
        / {2}preConfirmationDrilldown:[\s\S]*? {2}must:\n/u,
        `  preConfirmationDrilldown:
    semanticKernelRef:
      path: authoring/semantic-kernel.json
      hash: null
    mustDecompositionPacketRef:
      path: authoring/must_decomposition_packet.json
      hash: null
      status: synchronized
    criticalAuditor:
      minimumRounds: 3
      consecutiveNoNewGapRounds: 3
      convergenceVerdict: bounded_no_new_gap
    packetSourceReconciliation:
      reportPath: authoring/must_packet_source_reconciliation_report.json
      verdict: pass
    preRenderGateReportPath: authoring/pre-render-must-decomposition-gate-report.json
  must:\n`
      )
    );
    const record = writeRequirementRecord(source);
    const outDir = path.join(tempDir, 'object-drilldown-trace-execution');
    const result = runNodePrompt([
      '--source-document',
      source,
      '--requirement-record',
      record,
      '--out-dir',
      outDir,
      '--json',
    ]);

    expect(result.status).toBe(0);
    const receipt = readJson<Record<string, any>>(path.join(outDir, 'audit_receipt.json'));
    expect(receipt.decision).toBe('pass');
    const packet = readJson<Record<string, any>>(path.join(outDir, 'model_packet.json'));
    expect(packet.preConfirmationDrilldown.criticalAuditor.consecutiveNoNewGapRounds).toBe(3);
  });

  it('blocks missing AI-TDD/currentTargetMap applicability and missing E2E suites', () => {
    const source = writeSource(
      validCompilerSource()
        .replace(
          / {2}applicability:[\s\S]*? {2}preConfirmationDrilldown:\n/u,
          '  preConfirmationDrilldown:\n'
        )
        .replace(
          / {2}e2eSuites:[\s\S]*? {2}artifactAutomationPlan:\n/u,
          '  artifactAutomationPlan:\n'
        )
    );
    const record = writeRequirementRecord(source);
    const outDir = path.join(tempDir, 'missing-applicability-trace-execution');
    const result = runNodePrompt([
      '--source-document',
      source,
      '--requirement-record',
      record,
      '--out-dir',
      outDir,
      '--json',
    ]);

    expect(result.status).toBe(3);
    const receipt = readJson<Record<string, any>>(path.join(outDir, 'audit_receipt.json'));
    expect(receipt.blockingReasons).toEqual(
      expect.arrayContaining([
        'MISSING_APPLICABILITY_DECLARATION',
        'AI_TDD_APPLICABILITY_REQUIRED',
        'CURRENT_TARGET_MAP_APPLICABILITY_REQUIRED',
        'E2E_SUITES_REQUIRED',
      ])
    );
  });

  it('blocks invalid acceptance references and incomplete MUST/NEG command coverage', () => {
    const source = writeSource(
      validCompilerSource()
        .replace('acceptanceRefs: ["ACC-001", "E2E-001"]', 'acceptanceRefs: ["ACC-MISSING"]')
        .replace('requiredCommandRefs: ["CMD-TEST-001"]', 'requiredCommandRefs: []')
        .replace(
          'contractValidationCommandRefs: ["CMD-TEST-001"]',
          'contractValidationCommandRefs: []'
        )
        .replace('deliveryEvidenceCommandRefs: ["CMD-TEST-001"]', 'deliveryEvidenceCommandRefs: []')
        .replace(/commandRefs: \["CMD-TEST-001"\]/g, 'commandRefs: []')
    );
    const record = writeRequirementRecord(source);
    const outDir = path.join(tempDir, 'invalid-acceptance-trace-execution');
    const result = runNodePrompt([
      '--source-document',
      source,
      '--requirement-record',
      record,
      '--out-dir',
      outDir,
      '--json',
    ]);

    expect(result.status).toBe(3);
    const receipt = readJson<Record<string, any>>(path.join(outDir, 'audit_receipt.json'));
    expect(receipt.blockingReasons).toEqual(
      expect.arrayContaining([
        'TRACE_ACCEPTANCE_REF_INVALID:TRACE-001:ACC-MISSING',
        'REQUIREMENT_COVERAGE_INCOMPLETE:MUST-001:CMD',
        'REQUIREMENT_COVERAGE_INCOMPLETE:NEG-001:CMD',
      ])
    );
  });

  it('blocks incomplete failure and edge-case closure', () => {
    const source = writeSource(
      validCompilerSource()
        .replace('linkedNegIds: ["NEG-001"]', 'linkedNegIds: []')
        .replace('linkedEvidenceIds: ["EVD-001"]', 'linkedEvidenceIds: []')
        .replace('linkedFailurePathIds: ["FAIL-001"]', 'linkedFailurePathIds: []')
    );
    const record = writeRequirementRecord(source);
    const outDir = path.join(tempDir, 'incomplete-error-case-trace-execution');
    const result = runNodePrompt([
      '--source-document',
      source,
      '--requirement-record',
      record,
      '--out-dir',
      outDir,
      '--json',
    ]);

    expect(result.status).toBe(3);
    const receipt = readJson<Record<string, any>>(path.join(outDir, 'audit_receipt.json'));
    expect(receipt.blockingReasons).toEqual(
      expect.arrayContaining([
        'ERROR_CASE_CLOSURE_INCOMPLETE:FAIL-001:NEG',
        'ERROR_CASE_CLOSURE_INCOMPLETE:FAIL-001:EVD',
        'ERROR_CASE_CLOSURE_INCOMPLETE:EDGE-001:FAIL',
      ])
    );
  });

  it('blocks missing target modification bindings, invalid proof policy, and missing control store', () => {
    const source = writeSource(
      validCompilerSource()
        .replace(
          '      traceRows: ["TRACE-001"]\n      evidenceRefs: ["EVD-001"]\n  requiredCommands:',
          '  requiredCommands:'
        )
        .replace(
          'allowedAuthorities: ["AI_TDD_gate_report", "delivery_verification_report", "closeout_integrity_report"]',
          'allowedAuthorities: ["audit_receipt_json"]'
        )
    );
    const record = writeRequirementRecord(source);
    const recordData = readJson<Record<string, any>>(record);
    delete recordData.controlStore;
    fs.writeFileSync(record, `${JSON.stringify(recordData, null, 2)}\n`, 'utf8');
    const outDir = path.join(tempDir, 'invalid-policy-trace-execution');
    const result = runNodePrompt([
      '--source-document',
      source,
      '--requirement-record',
      record,
      '--out-dir',
      outDir,
      '--json',
    ]);

    expect(result.status).toBe(3);
    const receipt = readJson<Record<string, any>>(path.join(outDir, 'audit_receipt.json'));
    expect(receipt.blockingReasons).toEqual(
      expect.arrayContaining([
        'TARGET_MODIFICATION_TRACE_BINDING_REQUIRED:TARGET-MOD-001',
        'TARGET_MODIFICATION_EVIDENCE_BINDING_REQUIRED:TARGET-MOD-001',
        'INVALID_CLOSEOUT_PROOF_POLICY:audit_receipt_json',
        'CONTROL_STORE_NOT_READY',
      ])
    );
  });

  it('generates a prompt only from a confirmed source document', () => {
    const source = writeSource(validSource());
    const record = writeRequirementRecord(source);
    const result = run(['--source-document', source, '--requirement-record', record]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('$executing-plans $verification-before-completion');
    expect(result.stdout).toContain('#implementationConfirmation');
    expect(result.stdout).toContain('TRACE-001');
    expect(result.stdout).toContain('Trace order:');
    expect(result.stdout).toContain('执行切片:');
    expect(result.stdout).toContain('contract gates: CMD-CONTRACT-001');
    expect(result.stdout).toContain('delivery gates: CMD-DELIVERY-001, CMD-DELIVERY-002');
    expect(result.stdout).toContain('Required commands:');
    expect(result.stdout).toContain('CMD-CONTRACT-001:');
    expect(result.stdout).toContain(
      'node <skill-dir>/scripts/render-requirements-confirmation-html.ts --source source.md'
    );
    expect(result.stdout).toContain('Suggested smoke only, not acceptance by itself:');
    expect(result.stdout).toContain('npm run lint');
    expect(result.stdout).toContain(
      'PASS requires evidence for covered must, notDone, and evidence IDs'
    );
    expect(result.stdout).not.toContain('MISSING_INPUT: final gate commands');
    expect(result.stdout).not.toContain('$requirements-contract-authoring');
  });

  it('keeps the legacy Python entrypoint working without PyYAML by delegating to Node js-yaml', () => {
    const source = writeSource(validSource());
    const record = writeRequirementRecord(source);
    const noYamlPath = path.join(tempDir, 'no-pyyaml');
    fs.mkdirSync(noYamlPath, { recursive: true });
    fs.writeFileSync(
      path.join(noYamlPath, 'yaml.py'),
      'raise ImportError("forced no PyYAML for shim compatibility test")\n',
      'utf8'
    );
    const result = run(['--source-document', source, '--requirement-record', record], {
      env: {
        ...process.env,
        PYTHONPATH: noYamlPath,
      },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('$executing-plans $verification-before-completion');
    expect(result.stdout).toContain('TRACE-001');
  });

  it('supports the Node js-yaml entrypoint directly', () => {
    const source = writeSource(validSource());
    const record = writeRequirementRecord(source);
    const result = runNodePrompt(['--source-document', source, '--requirement-record', record]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('$executing-plans $verification-before-completion');
    expect(result.stdout).toContain('TRACE-001');
  });

  it('keeps Python shim output byte-equivalent to the Node prompt generator', () => {
    const source = writeSource(validSource());
    const record = writeRequirementRecord(source);
    const args = ['--source-document', source, '--requirement-record', record];
    const pythonResult = run(args);
    const nodeResult = runNodePrompt(args);

    expect(pythonResult.status).toBe(0);
    expect(nodeResult.status).toBe(0);
    expect(pythonResult.stdout).toBe(nodeResult.stdout);
  });

  it('blocks trace command refs that are not declared as required commands', () => {
    const source = writeSource(
      validSource().replace(
        '  requiredCommands:',
        '  requiredCommands:\n    - id: CMD-OTHER\n      command: "npm run other"\n      purpose: "Wrong command."\n  unusedCommands:'
      )
    );
    const record = writeRequirementRecord(source);
    const result = runNodePrompt(['--source-document', source, '--requirement-record', record]);

    expect(result.status).toBe(3);
    expect(result.stdout).toContain('BLOCK: COMMAND_REFERENCE_INVALID');
    expect(result.stdout).toContain('TRACE-001.contractValidationCommandRefs:CMD-CONTRACT-001');
  });

  it('blocks referenced required commands without runnable command text', () => {
    const source = writeSource(
      validSource().replace('      command: "npm run test:e2e -- upload"', '      command: ""')
    );
    const record = writeRequirementRecord(source);
    const result = runNodePrompt(['--source-document', source, '--requirement-record', record]);

    expect(result.status).toBe(3);
    expect(result.stdout).toContain('BLOCK: COMMAND_DEFINITION_INVALID');
    expect(result.stdout).toContain('CMD-DELIVERY-001.command');
  });

  it('blocks duplicate required command IDs before prompt generation', () => {
    const source = writeSource(
      validSource().replace(
        '    - id: CMD-DELIVERY-002\n      command: "npm run test:e2e -- upload-invalid"',
        '    - id: CMD-DELIVERY-001\n      command: "npm run test:e2e -- upload-invalid"'
      )
    );
    const record = writeRequirementRecord(source);
    const result = runNodePrompt(['--source-document', source, '--requirement-record', record]);

    expect(result.status).toBe(3);
    expect(result.stdout).toContain('BLOCK: COMMAND_DEFINITION_INVALID');
    expect(result.stdout).toContain('IDs must be unique: CMD-DELIVERY-001');
  });

  it('blocks confirmed source documents without any final gate commands', () => {
    const source = writeSource(
      validSource()
        .replace('      contractValidationCommandRefs: ["CMD-CONTRACT-001"]\n', '')
        .replace(
          '      deliveryEvidenceCommandRefs: ["CMD-DELIVERY-001", "CMD-DELIVERY-002"]\n',
          ''
        )
        .replace(
          / {2}requiredCommands:[\s\S]* {2}closeoutReadinessPreview:\n {4}requiredCommands: \["CMD-CONTRACT-001", "CMD-DELIVERY-001", "CMD-DELIVERY-002"\]\n/u,
          ''
        )
        .replace(
          '      gate: "npm run test:e2e -- upload"',
          '      gate: "Implementation Readiness Gate"'
        )
        .replace(
          '      gate: "npm run test:e2e -- upload-invalid"',
          '      gate: "Manual Review Gate"'
        )
    );
    const record = writeRequirementRecord(source);
    const result = runNodePrompt(['--source-document', source, '--requirement-record', record]);

    expect(result.status).toBe(3);
    expect(result.stdout).toContain('BLOCK: FINAL_GATES_REQUIRED');
  });

  it('blocks confirmed source documents without a requirement record', () => {
    const source = writeSource(validSource());
    const result = run(['--source-document', source]);

    expect(result.status).toBe(3);
    expect(result.stdout).toContain('BLOCK: CONFIRMATION_RECORD_REQUIRED');
  });

  it('blocks when latest confirmation history hashes do not match the current source', () => {
    const source = writeSource(validSource());
    const record = writeRequirementRecord(source, {
      sourceDocumentHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });
    const result = run(['--source-document', source, '--requirement-record', record]);

    expect(result.status).toBe(3);
    expect(result.stdout).toContain('BLOCK: CONFIRMATION_RECORD_HASH_MISMATCH');
    expect(result.stdout).toContain('sourceDocumentHash');
  });

  it('blocks draft confirmation blocks', () => {
    const source = writeSource(validSource().replace('status: user_confirmed', 'status: draft'));
    const result = run(['--source-document', source]);

    expect(result.status).toBe(3);
    expect(result.stdout).toContain('BLOCK: CONFIRMATION_REQUIRED');
  });

  it('blocks missing confirmation blocks', () => {
    const source = writeSource('# Source without confirmation\n');
    const result = run(['--source-document', source]);

    expect(result.status).toBe(3);
    expect(result.stdout).toContain('BLOCK: SOURCE_DOCUMENT_REQUIRED');
  });

  it('blocks blocking open questions', () => {
    const source = writeSource(
      validSource().replace(
        'openQuestions: []',
        `openQuestions:
    - id: Q-001
      text: "Who owns rollback?"
      blocksImplementation: true`
      )
    );
    const result = run(['--source-document', source]);

    expect(result.status).toBe(3);
    expect(result.stdout).toContain('BLOCK: BLOCKING_QUESTIONS');
  });

  it('blocks invalid trace references', () => {
    const source = writeSource(validSource().replace('MUST-001", "NEG-001', 'MUST-001", "NEG-999'));
    const result = run(['--source-document', source]);

    expect(result.status).toBe(3);
    expect(result.stdout).toContain('BLOCK: TRACE_REFERENCE_INVALID');
  });

  it('blocks conversation-style source-file input', () => {
    const source = writeSource(validSource());
    const result = run(['--source-file', source]);

    expect(result.status).toBe(3);
    expect(result.stdout).toContain('BLOCK: SESSION_INPUT_NEEDS_SOURCE_DOCUMENT');
  });
});
