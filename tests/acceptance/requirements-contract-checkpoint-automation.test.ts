import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createRequire } from 'node:module';
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
const PRE_RENDER_MUST_GATE = path.join(
  ROOT,
  '_bmad',
  'skills',
  'requirements-contract-authoring',
  'scripts',
  'pre_render_must_decomposition_gate.js'
);
const RETENTION_CLEANUP = path.join(
  ROOT,
  '_bmad',
  'skills',
  'requirements-contract-authoring',
  'scripts',
  'finalize_requirements_contract_retention.js'
);
const CHECKPOINT_REQUIREMENT_FIXTURE = path.join(
  ROOT,
  'tests',
  'fixtures',
  'requirements',
  'REQ-CHECKPOINT-AUTOMATION',
  'source.requirement.md'
);
const CHECKPOINT_REQUIREMENT_RUNTIME_RELATIVE_PATH = path.join(
  'docs',
  'requirements',
  '2026-05-25-requirements-contract-checkpoint-automation.md'
);

let tempDir: string;
let checkpointRequirementDoc: string | null;
const requireForGate = createRequire(import.meta.url);
const {
  extractImplementationConfirmation,
  sourceDocumentHashFor,
  implementationConfirmationHashFor,
} = requireForGate(
  path.join(
    ROOT,
    '_bmad',
    'skills',
    'requirements-contract-authoring',
    'scripts',
    'pre_render_definition_drilldown_lib.js'
  )
);
const { buildAuditInputHash } = requireForGate(PRE_RENDER_MUST_GATE);

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'requirements-checkpoint-automation-'));
  checkpointRequirementDoc = null;
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function runNode(script: string, args: string[], cwd = ROOT) {
  const result = spawnSync(process.execPath, [script, ...args, '--json'], {
    cwd,
    encoding: 'utf8',
  });
  return {
    result,
    json: JSON.parse(result.stdout || result.stderr),
  };
}

function materializeCheckpointRequirementDoc(root: string): string {
  const target = path.join(root, CHECKPOINT_REQUIREMENT_RUNTIME_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(CHECKPOINT_REQUIREMENT_FIXTURE, target);
  return target;
}

function checkpointRequirementDocPath(): string {
  checkpointRequirementDoc ??= materializeCheckpointRequirementDoc(tempDir);
  return checkpointRequirementDoc;
}

function extractTargetModificationPaths() {
  const rows = asArray(readCheckpointImplementationConfirmation().targetModificationPaths);
  if (!rows.length) {
    throw new Error(
      'targetModificationPaths block not found in checkpoint automation source document'
    );
  }

  return rows.map((row) => ({
    id: row.id,
    path: row.path,
  }));
}

function readCheckpointImplementationConfirmation(): Record<string, any> {
  const source = fs.readFileSync(checkpointRequirementDocPath(), 'utf8').replace(/\r\n/g, '\n');
  const match = source.match(/(?:^|\n)implementationConfirmation:\n[\s\S]*?(?=\n#{1,6}\s|$)/u);
  if (!match) {
    throw new Error(
      'implementationConfirmation block not found in checkpoint automation source document'
    );
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
    new Set(
      keys.flatMap((key) =>
        Array.isArray(row[key])
          ? row[key].filter((value: unknown) => typeof value === 'string')
          : []
      )
    )
  );
}

function fixedHash(char: string): string {
  return `sha256:${char.repeat(64)}`;
}

function fileHash(filePath: string): string {
  return `sha256:${createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function mustGateSource(packetHash = fixedHash('a'), overrides = ''): string {
  const inventedTraceBackRef = overrides.includes('SOURCE_INVENTED_TRACE_ROW')
    ? ''
    : `      derivedFromMustRef: MUST-001
      derivedFromPacketHash: ${packetHash}`;
  return `# MUST Gate Fixture

implementationConfirmation:
  contractSchemaVersion: 1
  status: draft
  recordId: REQ-MUST-GATE
  requirementSetId: REQSET-MUST-GATE
  entryFlow: standalone_tasks
  entryFlowClass: task_packet_entry
  workflowAdapter: direct
  contractAuthoringRequired: true
  confirmationLanguage: zh-CN
  confirmationProfile: implementation_confirmation
  requiredViewPacks: ["currentTargetMap"]
  optionalViewPacks: []
  confirmedAt: null
  confirmedBy: null
  sourceDocumentHash: null
  confirmationRender:
    htmlPath: null
    summaryPath: null
    reportPath: null
    htmlHash: null
    confirmationPhrase: null
  applicability:
    governanceEvents:
      applies: false
      reasonCode: no_governance_event_changes
    runtimeRecovery:
      applies: false
      reasonCode: no_runtime_recovery_changes
      requiresFunctionalResumeFailureCaseRegistry: false
      activeRequirementResolutionRequired: false
      retiredContextSurfaceForbidden: true
    scoringDashboardSft:
      applies: false
      reasonCode: no_scoring_changes
    currentTargetMap:
      applies: true
      reasonCode: requires_current_target_map
    scriptsAndHooks:
      applies: false
      reasonCode: no_scripts_or_hooks
    aiTddContractGate:
      applies: true
      reasonCode: requires_manifest_projection
  must:
    - id: MUST-001
      text: "Render only after atomic decomposition converges."
      evidenceRefs: ["EVD-001"]
      coveredByTraceRows: ["TRACE-001"]
      coveredBySequenceViews: ["SEQ-001"]
  notDone:
    - id: NEG-001
      text: "A shallow field-only source must not be confirmable."
      evidenceRefs: ["EVD-001"]
      whyItBlocksCompletion: "It bypasses semantic drilldown."
      negativeAssertionRequired: true
      coveredByFailurePath: ["FAIL-001"]
      derivedFromMustRef: MUST-001
      derivedFromPacketHash: ${packetHash}
  mustNot:
    - id: OUT-001
      text: "Do not claim delivery readiness from the packet."
      scopeBoundary: "Confirmation scope only."
      userApprovalRequiredIfChanged: true
  mustExecutionDecompositionMatrix:
    - id: MDM-001
      mustRef: MUST-001
      atomicTaskRefs: ["TASK-001"]
      derivedFromMustRef: MUST-001
      derivedFromPacketHash: ${packetHash}
  atomicImplementationTaskList:
    - id: TASK-001
      text: "Validate drilldown gate before render."
      targetFiles: ["_bmad/skills/requirements-contract-authoring/scripts/pre_render_must_decomposition_gate.js"]
      acceptanceRefs: ["ACC-001"]
      redProofPlan: "Gate fails when packet is missing."
      derivedFromMustRef: MUST-001
      derivedFromPacketHash: ${packetHash}
  evidence:
    - id: EVD-001
      text: "Gate report proves confirmability is blocked or pass."
      gate: "node pre_render_must_decomposition_gate.js"
      oracle: "Fails closed on missing drilldown artifacts."
      requiredCommandRefs: ["CMD-001"]
      artifactRefs: ["ART-001"]
      derivedFromMustRef: MUST-001
      derivedFromPacketHash: ${packetHash}
  failurePaths:
    - id: FAIL-001
      title: "Missing packet blocks render."
      trigger: "Packet is missing."
      expectedBehavior: "Gate fails closed."
      forbiddenBehavior: "Renderer marks source confirmable."
      blocksCompletionWhenViolated: true
      linkedNegIds: ["NEG-001"]
      linkedEvidenceIds: ["EVD-001"]
      requiredAssertions: ["missing packet blocks"]
      derivedFromMustRef: MUST-001
      derivedFromPacketHash: ${packetHash}
  edgeCases:
    - id: EDGE-001
      category: stale_hash
      condition: "Packet hash is stale."
      expectedBehavior: "Gate blocks."
      forbiddenBehavior: "Gate passes."
      linkedFailurePathIds: ["FAIL-001"]
      linkedEvidenceIds: ["EVD-001"]
      derivedFromMustRef: MUST-001
      derivedFromPacketHash: ${packetHash}
  traceRows:
    - id: TRACE-001
      covers: ["MUST-001", "NEG-001"]
      taskRefs: ["TASK-001"]
      evidenceRefs: ["EVD-001"]
      contractValidationCommandRefs: ["CMD-001"]
      deliveryEvidenceCommandRefs: ["CMD-001"]
      acceptanceRefs: ["ACC-001"]
      sequenceViewRefs: ["SEQ-001"]
      boundaryViewRefs: ["BOUND-001"]
      artifactRefs: ["ART-001"]
      status: PENDING
${inventedTraceBackRef}
  acceptanceTests:
    - id: ACC-001
      file: "tests/acceptance/requirements-contract-checkpoint-automation.test.ts"
      covers: ["MUST-001", "NEG-001"]
      traceRows: ["TRACE-001"]
      evidenceRefs: ["EVD-001"]
      commandRefs: ["CMD-001"]
      expectedPreImplementationState: expected_red
      oracle: "Gate fails before artifacts exist and passes with synchronized artifacts."
      positiveControl: true
      negativeControls: ["NEG-001"]
      mockOnly: false
      derivedFromMustRef: MUST-001
      derivedFromPacketHash: ${packetHash}
  e2eSuites:
    - id: E2E-001
      file: "tests/acceptance/requirements-contract-checkpoint-automation.test.ts"
      covers: ["MUST-001"]
      traceRows: ["TRACE-001"]
      evidenceRefs: ["EVD-001"]
      commandRefs: ["CMD-001"]
      expectedPreImplementationState: expected_red
      oracle: "End-to-end gate CLI behavior."
      positiveControl: true
      negativeControls: []
      mockOnly: false
      derivedFromMustRef: MUST-001
      derivedFromPacketHash: ${packetHash}
  targetModificationPaths:
    - id: TARGET-MOD-001
      path: "_bmad/skills/requirements-contract-authoring/scripts/pre_render_must_decomposition_gate.js"
      changeType: explicit_modification
      intent: "Implement deterministic pre-render MUST decomposition gate."
      requirementRefs: ["MUST-001"]
      traceRefs: ["TRACE-001"]
      evidenceRefs: ["EVD-001"]
      artifactRefs: ["ART-001"]
      requiresReconfirmationOnChange: true
      derivedFromMustRef: MUST-001
      derivedFromPacketHash: ${packetHash}
  currentTargetMap:
    schemaVersion: current-target-map/v1
    displayProfile: closed_loop_current_target_map
    currentSummary:
      - id: CT-CUR-001
        title: "No gate"
        detail: "Renderer can pass shallow source."
    targetSummary:
      - id: CT-TGT-001
        title: "Gate enforced"
        detail: "Renderer consumes drilldown gate."
    diffRows:
      - id: CT-DIFF-001
        dimension: "Gate"
        currentState: "missing"
        targetState: "mandatory"
        action: "add pre-render gate"
      - id: CT-DIFF-002
        dimension: "Packet"
        currentState: "optional"
        targetState: "synchronized"
        action: "require packet"
      - id: CT-DIFF-003
        dimension: "Critic"
        currentState: "not enforced"
        targetState: "three rounds"
        action: "verify receipts"
    process:
      - id: CT-PROC-001
        step: "Run gate"
        owner: "requirements-contract-authoring"
    artifactPaths:
      - id: CT-ART-001
        path: "_bmad-output/runtime/requirement-records/REQ-MUST-GATE/authoring/pre-render-must-decomposition-gate-report.json"
        targetRole: "gate_report"
    canonicalArtifacts: []
    existingArtifacts: []
  aiTddContractExecutionManifestProjection:
    id: AI-TDD-001
    derivedFromMustRef: MUST-001
    derivedFromPacketHash: ${packetHash}
  artifactAutomationPlan:
    - artifactId: ART-001
      path: "_bmad-output/runtime/requirement-records/REQ-MUST-GATE/authoring/pre-render-must-decomposition-gate-report.json"
      artifactType: report
      sourceOfTruthRole: evidence
      ownerModel: requirements
      producer: pre_render_must_decomposition_gate
      consumer: renderer
      inputArtifacts: []
      outputArtifacts: ["pre-render-must-decomposition-gate-report.json"]
      recordEventTypes: []
      canAffectControlFlow: false
      traceRows: ["TRACE-001"]
      evidenceRefs: ["EVD-001"]
      retention: long_lived
      cleanupPolicy: keep
      orphanRisk: low
      derivedFromMustRef: MUST-001
      derivedFromPacketHash: ${packetHash}
  requiredCommands:
    - id: CMD-001
      command: "node _bmad/skills/requirements-contract-authoring/scripts/pre_render_must_decomposition_gate.js --source source.md --json"
      purpose: "Validate pre-render MUST decomposition gate."
      derivedFromMustRef: MUST-001
      derivedFromPacketHash: ${packetHash}
  requirementBoundary:
    business:
      description: "No business behavior."
      requirementIds: []
      viewRefs: []
      diagramRefs: []
    governance:
      description: "Pre-render gate governance."
      requirementIds: ["MUST-001", "NEG-001"]
      viewRefs: ["BOUND-001"]
      diagramRefs: ["SEQ-001"]
  sequenceViews:
    - id: SEQ-001
      title: "Gate sequence"
      scope: governance
      covers: ["MUST-001", "NEG-001"]
      mermaid: "sequenceDiagram\\n  participant A\\n  participant G\\n  A->>G: run gate [MUST-001]"
  flowViews:
    - id: FLOW-001
      title: "Gate flow"
      scope: governance
      covers: ["MUST-001"]
      mermaid: "flowchart TD\\n  A[MUST-001] --> B[TRACE-001]"
  edgeCaseViews:
    - id: EDGEVIEW-001
      title: "Gate edge"
      scope: governance
      covers: ["EDGE-001", "FAIL-001"]
  boundaryViews:
    - id: BOUND-001
      title: "Scope boundary"
      scope: governance
      covers: ["OUT-001"]
  suggestedCommands: []
  closeoutReadinessPreview:
    requiredCommands: ["CMD-001"]
    orphanPolicy: "Packet is not closeout proof."
    currentAttemptPolicy: "Confirmation scope only."
    derivedFromMustRef: MUST-001
    derivedFromPacketHash: ${packetHash}

## Reverse Audit Report

Definition of Done
`;
}

function writeMustGateFixture(overrides = '') {
  const fixtureDir = path.join(
    tempDir,
    `must-gate-${overrides.replace(/[^A-Z0-9_]+/g, '-').toLowerCase() || 'valid'}`
  );
  const authoringDir = path.join(fixtureDir, 'authoring');
  fs.mkdirSync(authoringDir, { recursive: true });
  const source = path.join(fixtureDir, 'source.md');
  const packetHash = fixedHash('a');
  fs.writeFileSync(source, mustGateSource(packetHash, overrides), 'utf8');
  const text = fs.readFileSync(source, 'utf8');
  const extracted = extractImplementationConfirmation(text);
  const sourceDocumentHash = sourceDocumentHashFor(
    text,
    extracted.blockText,
    extracted.confirmation
  );
  const implementationConfirmationHash = implementationConfirmationHashFor(extracted.confirmation);
  const kernelHash = fixedHash('b');
  const kernel = {
    schemaVersion: 'semantic-kernel/v1',
    recordId: 'REQ-MUST-GATE',
    sourceDocument: source,
    sourceDocumentHash: overrides.includes('STALE_KERNEL') ? fixedHash('c') : sourceDocumentHash,
    goal: 'Gate confirmation before render.',
    currentState: ['Field presence can pass shallow source.'],
    targetState: ['Drilldown artifacts are mandatory.'],
    nonGoals: [],
    mustCandidates: ['MUST-001'],
    kernelHash,
  };
  const taskCount = overrides.includes('UNDER_SPLIT')
    ? { expectedTaskCount: 2, actualTaskCount: 1 }
    : { expectedTaskCount: 1, actualTaskCount: 1 };
  const packet = {
    schemaVersion: 'must-decomposition-packet/v1',
    recordId: 'REQ-MUST-GATE',
    sourceDocument: source,
    sourceDocumentHash: overrides.includes('STALE_PACKET') ? fixedHash('d') : sourceDocumentHash,
    semanticKernelHash: kernelHash,
    packetHash,
    status: overrides.includes('BLOCKED_PACKET') ? 'blocked' : 'synchronized',
    generatedBy: 'requirements-contract-authoring',
    materializationTarget: 'implementationConfirmation',
    mustPackets: [
      {
        mustRef: 'MUST-001',
        mustIntent: 'Render only after atomic decomposition converges.',
        decompositionBasis: {
          observableBehaviors: ['block missing packet'],
          targetSurfaces: ['pre_render_must_decomposition_gate.js'],
        },
        atomicityDrivers: { behaviorSurfaceOracleUnits: ['gate report oracle'] },
        questionCoverage: {
          requiredCategories: ['intent_boundary'],
          answeredCategories: ['intent_boundary'],
          missingCategories: [],
          coverageVerdict: overrides.includes('INCOMPLETE_QUESTION') ? 'incomplete' : 'complete',
        },
        atomicityCompleteness: {
          splitRule: 'one_task_per_independent_behavior_surface_oracle',
          completenessVerdict: overrides.includes('UNDER_SPLIT') ? 'under_split' : 'complete',
          ...taskCount,
        },
        mustAtomicTasks: [
          {
            id: 'TASK-001',
            targetFiles: [
              '_bmad/skills/requirements-contract-authoring/scripts/pre_render_must_decomposition_gate.js',
            ],
            redProofPlan: overrides.includes('MISSING_RED_PROOF')
              ? ''
              : 'Gate fails without packet.',
            overBroad: overrides.includes('OVER_BROAD_TASK'),
            materializedTo: overrides.includes('PROJECTION_NOT_MATERIALIZED')
              ? []
              : ['implementationConfirmation.atomicImplementationTaskList[TASK-001]'],
          },
        ],
        mustExecutionDecompositionMatrix: [
          {
            id: 'MDM-001',
            materializedTo: [
              'implementationConfirmation.mustExecutionDecompositionMatrix[MDM-001]',
            ],
          },
        ],
        mustEvidenceProjection: [
          { id: 'EVD-001', materializedTo: ['implementationConfirmation.evidence[EVD-001]'] },
        ],
        mustTraceProjection: [
          { id: 'TRACE-001', materializedTo: ['implementationConfirmation.traceRows[TRACE-001]'] },
        ],
        mustAcceptanceProjection: [
          {
            id: 'ACC-001',
            materializedTo: ['implementationConfirmation.acceptanceTests[ACC-001]'],
          },
          { id: 'E2E-001', materializedTo: ['implementationConfirmation.e2eSuites[E2E-001]'] },
        ],
        mustFailureEdgeProjection: [
          { id: 'FAIL-001', materializedTo: ['implementationConfirmation.failurePaths[FAIL-001]'] },
          { id: 'EDGE-001', materializedTo: ['implementationConfirmation.edgeCases[EDGE-001]'] },
        ],
        mustTargetPathProjection: [
          {
            id: 'TARGET-MOD-001',
            materializedTo: ['implementationConfirmation.targetModificationPaths[TARGET-MOD-001]'],
          },
        ],
        mustArtifactProjection: [
          {
            id: 'ART-001',
            materializedTo: ['implementationConfirmation.artifactAutomationPlan[ART-001]'],
          },
        ],
        mustCommandProjection: [
          {
            id: 'CMD-001',
            materializedTo: ['implementationConfirmation.requiredCommands[CMD-001]'],
          },
        ],
      },
    ],
    mustDerivedProjectionMap: [
      {
        mustRef: 'MUST-001',
        materializedTo: [
          'implementationConfirmation.currentTargetMap',
          'implementationConfirmation.aiTddContractExecutionManifestProjection',
          'implementationConfirmation.closeoutReadinessPreview',
        ],
      },
    ],
  };
  fs.writeFileSync(
    path.join(authoringDir, 'semantic-kernel.json'),
    JSON.stringify({ semanticKernel: kernel }, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(authoringDir, 'must_decomposition_packet.json'),
    JSON.stringify({ must_decomposition_packet: packet }, null, 2),
    'utf8'
  );
  const auditInputHash = buildAuditInputHash({
    sourceDocumentHash,
    implementationConfirmationHash,
    kernel,
    packet,
  });
  if (!overrides.includes('MISSING_CRITIC')) {
    const rounds = overrides.includes('LESS_THAN_3_ROUNDS') ? 2 : 3;
    for (let index = 1; index <= rounds; index += 1) {
      const receipt = {
        criticalAuditorReceipt: {
          schemaVersion: 'critical-auditor-receipt/v1',
          roundIndex: index,
          inputHash: overrides.includes('STALE_CRITIC') ? fixedHash('e') : auditInputHash,
          attackVectors: ['missing_projection'],
          gapCandidates: [],
          validatedGaps:
            overrides.includes('UNRESOLVED_GAP') && index === rounds
              ? [{ id: 'GAP-001', status: 'open' }]
              : [],
          rejectedGapCandidates: [{ id: `REJ-${index}` }],
          mutationPressureFindings: [],
          overBroadTaskFindings: [],
          missingProjectionFindings: [],
          invalidProofFindings: [],
          legacyBypassFindings: [],
          sourceMaterializationFindings: [],
          noNewGapRationale: 'No new valid gap in fixture.',
          convergenceDecision: {
            verdict: 'no_new_valid_gap',
            resetsConvergenceCounter: false,
          },
        },
      };
      fs.writeFileSync(
        path.join(authoringDir, `critical-auditor-receipt-round-${index}.json`),
        JSON.stringify(receipt, null, 2),
        'utf8'
      );
    }
  }
  return { source, authoringDir };
}

function writeValidMustGateArtifactsForSource(source: string, authoringDir: string) {
  fs.mkdirSync(authoringDir, { recursive: true });
  const text = fs.readFileSync(source, 'utf8');
  const extracted = extractImplementationConfirmation(text);
  const confirmation = extracted.confirmation;
  let sourceDocumentHash = sourceDocumentHashFor(text, extracted.blockText, confirmation);
  let implementationConfirmationHash = implementationConfirmationHashFor(confirmation);
  const packetHash = fixedHash('a');
  const kernelHash = fixedHash('b');
  const kernel = {
    schemaVersion: 'semantic-kernel/v1',
    recordId: confirmation.recordId,
    sourceDocument: source,
    sourceDocumentHash,
    goal: 'Validate semantic pre-render gate.',
    currentState: ['Legacy global consistency is the only gate.'],
    targetState: ['MUST packet and critic convergence gate HTML rendering.'],
    kernelHash,
  };
  const mustRows = asArray(confirmation.must);
  const packet = {
    schemaVersion: 'must-decomposition-packet/v1',
    recordId: confirmation.recordId,
    sourceDocument: source,
    sourceDocumentHash,
    semanticKernelHash: kernelHash,
    packetHash,
    status: 'synchronized',
    mustPackets: mustRows.map((must: any, index: number) => {
      const taskId = `TASK-${String(index + 1).padStart(3, '0')}`;
      return {
        mustRef: must.id,
        mustIntent: must.text,
        decompositionBasis: {
          observableBehaviors: [must.text],
          targetSurfaces: ['confirmation source'],
        },
        atomicityDrivers: { behaviorSurfaceOracleUnits: [`${must.id} oracle`] },
        questionCoverage: {
          requiredCategories: ['intent_boundary'],
          answeredCategories: ['intent_boundary'],
          missingCategories: [],
          coverageVerdict: 'complete',
        },
        atomicityCompleteness: {
          expectedTaskCount: 1,
          actualTaskCount: 1,
          completenessVerdict: 'complete',
        },
        mustAtomicTasks: [
          {
            id: taskId,
            targetFiles: ['tests/acceptance/requirements-contract-checkpoint-automation.test.ts'],
            redProofPlan: `${must.id} red proof`,
            materializedTo: [`implementationConfirmation.atomicImplementationTaskList[${taskId}]`],
          },
        ],
        mustExecutionDecompositionMatrix: [
          {
            id: `MDM-${String(index + 1).padStart(3, '0')}`,
            materializedTo: [
              `implementationConfirmation.mustExecutionDecompositionMatrix[MDM-${String(index + 1).padStart(3, '0')}]`,
            ],
          },
        ],
        mustEvidenceProjection: asArray(confirmation.evidence).map((row: any) => ({
          id: row.id,
          materializedTo: [`implementationConfirmation.evidence[${row.id}]`],
        })),
        mustTraceProjection: asArray(confirmation.traceRows).map((row: any) => ({
          id: row.id,
          materializedTo: [`implementationConfirmation.traceRows[${row.id}]`],
        })),
        mustAcceptanceProjection: [
          ...asArray(confirmation.acceptanceTests).map((row: any) => ({
            id: row.id,
            materializedTo: [`implementationConfirmation.acceptanceTests[${row.id}]`],
          })),
          ...asArray(confirmation.e2eSuites).map((row: any) => ({
            id: row.id,
            materializedTo: [`implementationConfirmation.e2eSuites[${row.id}]`],
          })),
        ],
        mustFailureEdgeProjection: [
          ...asArray(confirmation.failurePaths).map((row: any) => ({
            id: row.id,
            materializedTo: [`implementationConfirmation.failurePaths[${row.id}]`],
          })),
          ...asArray(confirmation.edgeCases).map((row: any) => ({
            id: row.id,
            materializedTo: [`implementationConfirmation.edgeCases[${row.id}]`],
          })),
        ],
        mustTargetPathProjection: asArray(confirmation.targetModificationPaths).map((row: any) => ({
          id: row.id,
          materializedTo: [`implementationConfirmation.targetModificationPaths[${row.id}]`],
        })),
        mustArtifactProjection: asArray(confirmation.artifactAutomationPlan).map((row: any) => ({
          id: row.artifactId ?? row.id,
          materializedTo: [
            `implementationConfirmation.artifactAutomationPlan[${row.artifactId ?? row.id}]`,
          ],
        })),
        mustCommandProjection: asArray(confirmation.requiredCommands).map((row: any) => ({
          id: row.id,
          materializedTo: [`implementationConfirmation.requiredCommands[${row.id}]`],
        })),
      };
    }),
    mustDerivedProjectionMap: [
      {
        mustRef: mustRows[0]?.id ?? 'MUST-001',
        materializedTo: ['implementationConfirmation.closeoutReadinessPreview'],
      },
    ],
  };
  const addBackRefs = (rows: any[]) =>
    rows.forEach((row) => {
      row.derivedFromMustRef = row.derivedFromMustRef ?? mustRows[0]?.id ?? 'MUST-001';
      row.derivedFromPacketHash = packetHash;
    });
  confirmation.atomicImplementationTaskList = mustRows.map((must: any, index: number) => ({
    id: `TASK-${String(index + 1).padStart(3, '0')}`,
    text: `${must.id} atomic fixture task`,
    targetFiles: ['tests/acceptance/requirements-contract-checkpoint-automation.test.ts'],
    redProofPlan: `${must.id} red proof`,
    derivedFromMustRef: must.id,
    derivedFromPacketHash: packetHash,
  }));
  confirmation.mustExecutionDecompositionMatrix = mustRows.map((must: any, index: number) => ({
    id: `MDM-${String(index + 1).padStart(3, '0')}`,
    mustRef: must.id,
    atomicTaskRefs: [`TASK-${String(index + 1).padStart(3, '0')}`],
    derivedFromMustRef: must.id,
    derivedFromPacketHash: packetHash,
  }));
  addBackRefs(asArray(confirmation.evidence));
  addBackRefs(asArray(confirmation.traceRows));
  addBackRefs(asArray(confirmation.acceptanceTests));
  addBackRefs(asArray(confirmation.e2eSuites));
  addBackRefs(asArray(confirmation.failurePaths));
  addBackRefs(asArray(confirmation.edgeCases));
  addBackRefs(asArray(confirmation.targetModificationPaths));
  addBackRefs(asArray(confirmation.artifactAutomationPlan));
  addBackRefs(asArray(confirmation.requiredCommands));
  confirmation.closeoutReadinessPreview = {
    ...(confirmation.closeoutReadinessPreview ?? {}),
    derivedFromMustRef: mustRows[0]?.id ?? 'MUST-001',
    derivedFromPacketHash: packetHash,
  };
  fs.writeFileSync(
    source,
    `# Source\n\n${yaml.dump({ implementationConfirmation: confirmation }, { lineWidth: -1 })}`,
    'utf8'
  );
  const finalText = fs.readFileSync(source, 'utf8');
  const finalExtracted = extractImplementationConfirmation(finalText);
  sourceDocumentHash = sourceDocumentHashFor(
    finalText,
    finalExtracted.blockText,
    finalExtracted.confirmation
  );
  implementationConfirmationHash = implementationConfirmationHashFor(finalExtracted.confirmation);
  kernel.sourceDocumentHash = sourceDocumentHash;
  packet.sourceDocumentHash = sourceDocumentHash;
  const auditInputHash = buildAuditInputHash({
    sourceDocumentHash,
    implementationConfirmationHash,
    kernel,
    packet,
  });
  fs.writeFileSync(
    path.join(authoringDir, 'semantic-kernel.json'),
    JSON.stringify({ semanticKernel: kernel }, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(authoringDir, 'must_decomposition_packet.json'),
    JSON.stringify({ must_decomposition_packet: packet }, null, 2),
    'utf8'
  );
  for (let roundIndex = 1; roundIndex <= 3; roundIndex += 1) {
    fs.writeFileSync(
      path.join(authoringDir, `critical-auditor-receipt-round-${roundIndex}.json`),
      JSON.stringify(
        {
          criticalAuditorReceipt: {
            schemaVersion: 'critical-auditor-receipt/v1',
            roundIndex,
            inputHash: auditInputHash,
            attackVectors: [],
            gapCandidates: [],
            validatedGaps: [],
            rejectedGapCandidates: [],
            mutationPressureFindings: [],
            overBroadTaskFindings: [],
            missingProjectionFindings: [],
            invalidProofFindings: [],
            legacyBypassFindings: [],
            sourceMaterializationFindings: [],
            noNewGapRationale: 'Fixture has no new valid gap.',
            convergenceDecision: { verdict: 'no_new_valid_gap', resetsConvergenceCounter: false },
          },
        },
        null,
        2
      ),
      'utf8'
    );
  }
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
  const sections = Array.from(
    { length: 32 },
    (_, index) =>
      `## Section ${index + 1}\n\nGovernance event, runtime recovery, script hook, dashboard score, current target map.\n`
  ).join('\n');
  const ids = Array.from(
    { length: 28 },
    (_, index) => `- MUST-${String(index + 1).padStart(3, '0')} requirement\n`
  ).join('');
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
  targetModificationPaths:
    - id: TARGET-MOD-001
      path: tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      changeType: validation_only
      intent: "Validation command target for checkpoint global consistency fixtures."
      requirementRefs: ["MUST-001", "NEG-001"]
      traceRefs: ["TRACE-001", "TRACE-002"]
      evidenceRefs: ["EVD-001", "EVD-002"]
      artifactRefs: []
      requiresReconfirmationOnChange: false
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
  spawnSync('git', ['config', 'user.email', 'test@example.invalid'], {
    cwd: root,
    encoding: 'utf8',
  });
  spawnSync('git', ['config', 'user.name', 'Test User'], { cwd: root, encoding: 'utf8' });
  fs.mkdirSync(path.join(root, 'docs', 'requirements'), { recursive: true });
}

function authoringDirForGlobalGateRecord(root = tempDir): string {
  return path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    'REQ-GLOBAL-GATE',
    'authoring'
  );
}

describe('requirements contract checkpoint automation', () => {
  const SEMANTIC_CHECKPOINT_IDS = [
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

  it('routes small requirements to single_pass_allowed while still requiring semantic kernel then packet authoring', () => {
    const source = writeSmallSource();

    const { result, json } = runNode(ASSESS, ['--source', source]);

    expect(result.status).toBe(0);
    expect(json.schemaVersion).toBe('contract-authoring-scale-assessment/v1');
    expect(json.decision).toBe('single_pass_allowed');
    expect(json.authoringMode).toBe('semantic_kernel_then_packet');
    expect(json.riskLevel).toBe('low');
    expect(json.recommendedCheckpoints).toEqual([]);
    expect(json.scoreBreakdown.map((item: any) => item.id)).toEqual([
      'line_count',
      'byte_length',
      'section_count',
      'confirmation_id_count',
      'conditional_domain_count',
      'mermaid_block_count',
      'required_command_count',
      'progress_exists',
      'amendment_risk',
    ]);
    expect(json.hardTriggerBreakdown.map((item: any) => item.id)).toEqual([
      'line_count_gt_600',
      'byte_length_gt_35000',
      'confirmation_ids_gt_45',
      'conditional_domains_gte_2',
      'progress_exists',
      'amendment_risk',
    ]);
    expect(json.assessmentTrace.visibleOutputStream).toBe('stderr');
    expect(json.assessmentTrace.stdoutContract).toBe('json_only');
    expect(result.stderr).toContain('[requirements-contract-authoring] scale assessment started');
    expect(result.stderr).toContain('[requirements-contract-authoring] signals');
    expect(result.stderr).toContain('[requirements-contract-authoring] score breakdown');
    expect(result.stderr).toContain('[requirements-contract-authoring] hard triggers');
    expect(result.stderr).toContain('[requirements-contract-authoring] scale assessment result');
    expect(result.stderr).toContain('decision=single_pass_allowed');
  });

  it('routes large or complex requirements to checkpoint_required', () => {
    const source = writeLargeSource();

    const { result, json } = runNode(ASSESS, ['--source', source]);

    expect(result.status).toBe(0);
    expect(json.decision).toBe('checkpoint_required');
    expect(json.authoringMode).toBe('semantic_kernel_then_packet');
    expect(json.signals.applicableConditionalDomains).toEqual(
      expect.arrayContaining(['governanceEvents', 'runtimeRecovery', 'scriptsAndHooks'])
    );
    expect(json.recommendedCheckpoints).toEqual(SEMANTIC_CHECKPOINT_IDS);
    expect(
      json.hardTriggerBreakdown.filter((item: any) => item.triggered).map((item: any) => item.id)
    ).toContain('conditional_domains_gte_2');
    expect(result.stderr).toContain('decision=checkpoint_required');
  });

  it('routes to checkpoint_required when progress already exists', () => {
    const source = writeSmallSource();
    const progress = path.join(tempDir, 'semantic-checkpoint-progress.json');
    fs.writeFileSync(
      progress,
      JSON.stringify({ schemaVersion: 'semantic-checkpoint-progress/v1' }),
      'utf8'
    );

    const { result, json } = runNode(ASSESS, ['--source', source, '--progress', progress]);

    expect(result.status).toBe(0);
    expect(json.decision).toBe('checkpoint_required_with_amendment');
    expect(json.authoringMode).toBe('semantic_kernel_then_packet_with_amendment');
    expect(json.signals.progressExists).toBe(true);
    expect(json.scoreBreakdown.find((item: any) => item.id === 'progress_exists')?.points).toBe(5);
    expect(result.stderr).toContain('TRIGGERED progress_exists');
  });

  it('routes blocking definition or amendment risk to kernel checkpoint with amendment', () => {
    const source = writeAmendmentRiskSource();

    const { result, json } = runNode(ASSESS, ['--source', source]);

    expect(result.status).toBe(0);
    expect(json.decision).toBe('checkpoint_required_with_amendment');
    expect(json.authoringMode).toBe('semantic_kernel_then_packet_with_amendment');
    expect(json.signals.amendmentRisk).toBe(true);
    expect(
      json.hardTriggerBreakdown.find((item: any) => item.id === 'amendment_risk')?.triggered
    ).toBe(true);
    expect(result.stderr).toContain('TRIGGERED amendment_risk');
  });

  it('keeps stdout JSON-only while printing assessment process to stderr', () => {
    const source = writeLargeSource();

    const { result, json } = runNode(ASSESS, ['--source', source]);

    expect(result.status).toBe(0);
    expect(result.stdout.trim().startsWith('{')).toBe(true);
    expect(result.stdout).not.toContain('[requirements-contract-authoring]');
    expect(result.stderr).toContain('[requirements-contract-authoring] scale assessment started');
    expect(result.stderr).toContain('conditionalDomains=governanceEvents,runtimeRecovery');
    expect(result.stderr).toContain('scriptsAndHooks');
    expect(json.assessmentTrace.result.decision).toBe('checkpoint_required');
  });

  it('suppresses visible assessment trace only when --quiet is explicitly provided', () => {
    const source = writeLargeSource();

    const { result, json } = runNode(ASSESS, ['--source', source, '--quiet']);

    expect(result.status).toBe(0);
    expect(json.decision).toBe('checkpoint_required');
    expect(result.stderr).toBe('');
  });

  it('keeps initial single pass provisional and requires post-packet assessment before final route', () => {
    const source = writeSmallSource();
    const initial = path.join(tempDir, 'scale-assessment-initial.json');
    const route = path.join(tempDir, 'scale-routing-decision.json');

    const { result, json } = runNode(ASSESS, [
      '--source',
      source,
      '--phase',
      'initial_assessment',
      '--out',
      initial,
      '--routing-decision-out',
      route,
    ]);
    const routing = JSON.parse(fs.readFileSync(route, 'utf8'));

    expect(result.status).toBe(0);
    expect(json.phase).toBe('initial_assessment');
    expect(json.decision).toBe('single_pass_allowed');
    expect(json.provisionalDecision).toBe('provisional_single_pass_allowed');
    expect(routing.decision).toBe('checkpoint_required_with_amendment');
    expect(routing.blockingState).toBe('blocked_by_missing_post_packet_assessment');
    expect(routing.routeDecisionHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
  });

  it('upgrades post-packet routing to checkpoint from packet-derived growth and conditional domains', () => {
    const source = writeGloballyConsistentSource(tempDir);
    const authoringDir = authoringDirForGlobalGateRecord(tempDir);
    writeValidMustGateArtifactsForSource(source, authoringDir);
    const packetPath = path.join(authoringDir, 'must_decomposition_packet.json');
    const packetWrapper = JSON.parse(fs.readFileSync(packetPath, 'utf8'));
    packetWrapper.must_decomposition_packet.mustPackets[0].mustAtomicTasks = Array.from(
      { length: 21 },
      (_, index) => ({
        id: `TASK-GROWTH-${String(index + 1).padStart(3, '0')}`,
        targetFiles: ['tests/acceptance/requirements-contract-checkpoint-automation.test.ts'],
        redProofPlan: `growth red proof ${index + 1}`,
      })
    );
    fs.writeFileSync(packetPath, JSON.stringify(packetWrapper, null, 2), 'utf8');
    const initial = path.join(authoringDir, 'scale-assessment-initial.json');
    const postPacket = path.join(authoringDir, 'scale-assessment-post-packet.json');
    const route = path.join(authoringDir, 'scale-routing-decision.json');
    runNode(ASSESS, [
      '--source',
      source,
      '--phase',
      'initial_assessment',
      '--out',
      initial,
      '--quiet',
    ]);

    const { result, json } = runNode(ASSESS, [
      '--source',
      source,
      '--phase',
      'post_packet_assessment',
      '--semantic-kernel',
      path.join(authoringDir, 'semantic-kernel.json'),
      '--packet',
      packetPath,
      '--initial-assessment',
      initial,
      '--out',
      postPacket,
      '--routing-decision-out',
      route,
    ]);
    const routing = JSON.parse(fs.readFileSync(route, 'utf8'));

    expect(result.status).toBe(0);
    expect(json.phase).toBe('post_packet_assessment');
    expect(json.signals.mustAtomicTaskCount).toBeGreaterThan(0);
    expect(json.signals.projectionRowCount).toBeGreaterThan(0);
    expect(json.signals.conditionalDomainCount).toBe(
      json.signals.applicableConditionalDomains.length
    );
    expect(json.decision).toBe('checkpoint_required');
    expect(json.blockingReasons).toEqual([]);
    expect(json.hardTriggerBreakdown.map((item: any) => item.id)).toContain(
      'must_atomic_task_count_gt_20'
    );
    expect(routing.decision).toBe('checkpoint_required');
    expect(routing.decisionSource).toBe('post_packet_assessment');
    expect(routing.latestCompletedPhase).toBe('post_packet_assessment');
  });

  it('blocks post-packet assessment when semantic kernel or packet hashes are stale', () => {
    const source = writeGloballyConsistentSource(tempDir);
    const authoringDir = authoringDirForGlobalGateRecord(tempDir);
    writeValidMustGateArtifactsForSource(source, authoringDir);
    const packetPath = path.join(authoringDir, 'must_decomposition_packet.json');
    const packetWrapper = JSON.parse(fs.readFileSync(packetPath, 'utf8'));
    packetWrapper.must_decomposition_packet.sourceDocumentHash = fixedHash('f');
    fs.writeFileSync(packetPath, JSON.stringify(packetWrapper, null, 2), 'utf8');

    const { result, json } = runNode(ASSESS, [
      '--source',
      source,
      '--phase',
      'post_packet_assessment',
      '--semantic-kernel',
      path.join(authoringDir, 'semantic-kernel.json'),
      '--packet',
      packetPath,
    ]);

    expect(result.status).toBe(0);
    expect(json.decision).toBe('checkpoint_required_with_amendment');
    expect(json.blockingState).toBe('blocked_by_stale_scale_assessment_hash');
    expect(json.blockingReasons).toContain('must_decomposition_packet_source_hash_stale');
  });

  it('allows final single-pass only after post-materialization reconciliation pass and stable hashes', () => {
    const source = writeSmallSource();
    const authoringDir = path.join(tempDir, 'authoring');
    fs.mkdirSync(authoringDir, { recursive: true });
    const reconciliation = path.join(authoringDir, 'must_packet_source_reconciliation_report.json');
    fs.writeFileSync(reconciliation, JSON.stringify({ verdict: 'pass' }, null, 2), 'utf8');
    const initial = path.join(authoringDir, 'scale-assessment-initial.json');
    const postPacket = path.join(authoringDir, 'scale-assessment-post-packet.json');
    const postMaterialization = path.join(
      authoringDir,
      'scale-assessment-post-materialization.json'
    );
    const route = path.join(authoringDir, 'scale-routing-decision.json');
    runNode(ASSESS, [
      '--source',
      source,
      '--phase',
      'initial_assessment',
      '--out',
      initial,
      '--quiet',
    ]);
    fs.writeFileSync(
      postPacket,
      JSON.stringify({
        schemaVersion: 'contract-authoring-scale-assessment/v1',
        phase: 'post_packet_assessment',
        decision: 'single_pass_allowed',
        signals: { postPacketProjectionWeight: 0, sourceDocumentHash: 'sha256:fixture' },
      }),
      'utf8'
    );

    const { result, json } = runNode(ASSESS, [
      '--source',
      source,
      '--phase',
      'post_materialization_assessment',
      '--post-packet-assessment',
      postPacket,
      '--packet-source-reconciliation',
      reconciliation,
      '--initial-assessment',
      initial,
      '--out',
      postMaterialization,
      '--routing-decision-out',
      route,
    ]);
    const routing = JSON.parse(fs.readFileSync(route, 'utf8'));
    const rewritten = {
      ...routing,
      createdAt: '2099-01-01T00:00:00.000Z',
      checkpointPersistenceSatisfied: true,
    };
    const reroute = path.join(authoringDir, 'scale-routing-decision-rewritten.json');
    fs.writeFileSync(reroute, JSON.stringify(rewritten, null, 2), 'utf8');

    const { buildScaleRoutingDecision } = requireForGate(ASSESS);
    const recomputed = buildScaleRoutingDecision({
      sourcePath: source,
      initial: JSON.parse(fs.readFileSync(initial, 'utf8')),
      postPacket: JSON.parse(fs.readFileSync(postPacket, 'utf8')),
      postMaterialization: JSON.parse(fs.readFileSync(postMaterialization, 'utf8')),
      refs: {
        initialAssessment: initial,
        postPacketAssessment: postPacket,
        postMaterializationAssessment: postMaterialization,
        packetSourceReconciliation: reconciliation,
        packetSourceReconciliationHash: routing.packetSourceReconciliationHash,
      },
    });

    expect(result.status).toBe(0);
    expect(json.phase).toBe('post_materialization_assessment');
    expect(routing.decision).toBe('single_pass_final_allowed');
    expect(routing.decisionSource).toBe('post_materialization_assessment');
    expect(recomputed.routeDecisionHash).toBe(routing.routeDecisionHash);
  });

  it('rejects bare checkpoint persistence satisfaction without runner evidence', () => {
    const source = writeSmallSource();
    const { result, json } = runNode(ASSESS, [
      '--source',
      source,
      '--phase',
      'post_materialization_assessment',
      '--checkpoint-persistence-satisfied',
    ]);

    expect(result.status).toBe(2);
    expect(json.verdict).toBe('FAIL');
    expect(json.message).toBe('unknown option --checkpoint-persistence-satisfied');
  });

  it('prints visible assessment trace when checkpoint runner computes assessment implicitly', () => {
    const source = writeLargeSource();

    const { result, json } = runNode(CHECKPOINTS, ['--source', source, '--mode', 'plan']);

    expect(result.status).toBe(0);
    expect(json.authoringMode).toBe('semantic_kernel_then_packet');
    expect(result.stderr).toContain('[requirements-contract-authoring] scale assessment started');
    expect(result.stderr).toContain('[requirements-contract-authoring] scale assessment result');
    expect(result.stderr).toContain('decision=checkpoint_required');
    expect(result.stderr).toContain('[需求契约]');
    expect(result.stderr).toContain('现在在做什么：');
    expect(result.stderr).toContain('下一安全动作：');
    expect(result.stderr).toContain('机器信息：');
  });

  it('emits checkpoint plan in deterministic pre-render order', () => {
    const source = writeLargeSource();

    const { result, json } = runNode(CHECKPOINTS, ['--source', source, '--mode', 'plan']);

    expect(result.status).toBe(0);
    expect(json.authoringMode).toBe('semantic_kernel_then_packet');
    expect(json.checkpoints.map((checkpoint: any) => checkpoint.id)).toEqual(
      SEMANTIC_CHECKPOINT_IDS
    );
    expect(json.nextCheckpoint).toBe('cp-00-semantic-kernel');
    expect(json.semanticDrilldown.semanticKernel.status).toBe('missing');
    expect(json.semanticDrilldown.nextAction).toBe('create_semantic_kernel');
  });

  it('blocks pre-render MUST decomposition gate failures before confirmable HTML', () => {
    const cases = [
      ['missing semantic kernel', 'MISSING_KERNEL', 'missing_semantic_kernel'],
      ['missing must_decomposition_packet', 'MISSING_PACKET', 'missing_must_decomposition_packet'],
      ['stale packet hash', 'STALE_PACKET', 'must_packet_source_hash_stale'],
      ['missing Critical Auditor receipt', 'MISSING_CRITIC', 'critical_auditor_receipt_missing'],
      [
        'less than three no-new-gap rounds',
        'LESS_THAN_3_ROUNDS',
        'critical_auditor_less_than_three_no_new_gap_rounds',
      ],
      ['unresolved validated gap', 'UNRESOLVED_GAP', 'critical_auditor_validated_gap_unresolved'],
      [
        'question coverage incomplete',
        'INCOMPLETE_QUESTION',
        'must_packet_question_coverage_incomplete',
      ],
      ['actual task count below expected', 'UNDER_SPLIT', 'must_packet_under_split'],
      ['over-broad atomic task', 'OVER_BROAD_TASK', 'must_packet_over_broad_atomic_task'],
      [
        'source row independently invented',
        'SOURCE_INVENTED_TRACE_ROW',
        'source_row_independently_invented',
      ],
      [
        'packet projection not materialized',
        'PROJECTION_NOT_MATERIALIZED',
        'packet_projection_not_materialized',
      ],
    ];

    for (const [_label, override, code] of cases) {
      const fixture = writeMustGateFixture(override);
      if (override === 'MISSING_KERNEL')
        fs.rmSync(path.join(fixture.authoringDir, 'semantic-kernel.json'));
      if (override === 'MISSING_PACKET')
        fs.rmSync(path.join(fixture.authoringDir, 'must_decomposition_packet.json'));

      const { result, json } = runNode(PRE_RENDER_MUST_GATE, [
        '--source',
        fixture.source,
        '--authoring-dir',
        fixture.authoringDir,
      ]);

      expect(result.status, `${override} should fail`).toBe(1);
      expect(json.confirmability).toBe('blocked');
      expect(json.failedChecks).toContain(code);
      expect(
        fs.existsSync(
          path.join(fixture.authoringDir, 'pre-render-must-decomposition-gate-report.json')
        )
      ).toBe(true);
      expect(
        fs.existsSync(
          path.join(fixture.authoringDir, 'must_packet_source_reconciliation_report.json')
        )
      ).toBe(true);
    }
  });

  it('marks complete kernel, packet, critic receipts, and reconciliation as confirmable', () => {
    const fixture = writeMustGateFixture();

    const { result, json } = runNode(PRE_RENDER_MUST_GATE, [
      '--source',
      fixture.source,
      '--authoring-dir',
      fixture.authoringDir,
    ]);
    const receipt = JSON.parse(
      fs.readFileSync(path.join(fixture.authoringDir, 'must_decomposition_receipt.json'), 'utf8')
    );
    const reconciliation = JSON.parse(
      fs.readFileSync(
        path.join(fixture.authoringDir, 'must_packet_source_reconciliation_report.json'),
        'utf8'
      )
    );

    expect(result.status).toBe(0);
    expect(json.verdict).toBe('PASS');
    expect(json.confirmability).toBe('confirmable');
    expect(json.criticalAuditor.consecutiveNoNewGapRounds).toBe(3);
    expect(json.packetSourceReconciliation.verdict).toBe('pass');
    expect(receipt.criticalAuditor.convergenceVerdict).toBe('bounded_no_new_gap');
    expect(reconciliation.verdict).toBe('pass');
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

    const { result, json } = runNode(CHECKPOINTS, [
      '--source',
      source,
      '--progress',
      progress,
      '--mode',
      'status',
    ]);

    expect(result.status).toBe(1);
    expect(json.code).toBe('document_hash_mismatch');
    expect(json.nextCheckpoint).toBe('cp-02-confirmation-core-applicability');
    expect(result.stderr).toContain('[需求契约]');
    expect(result.stderr).toContain('现在在做什么：');
    expect(result.stderr).toContain('为什么停在这里：');
    expect(result.stderr).toContain('下一安全动作：');
    expect(result.stderr).toContain('机器信息：');
  });

  it('prints human checkpoint status for plan/status/run/resume while keeping stdout JSON-only', () => {
    initGitRepo(tempDir);
    const source = writeGloballyConsistentSource(tempDir);
    const progress = path.join(tempDir, 'progress.json');
    writeValidMustGateArtifactsForSource(source, authoringDirForGlobalGateRecord(tempDir));

    const plan = runNode(CHECKPOINTS, ['--source', source, '--progress', progress, '--mode', 'plan'], tempDir);
    expect(plan.result.status).toBe(0);
    expect(() => JSON.parse(plan.result.stdout)).not.toThrow();
    expect(plan.result.stderr).toContain('[需求契约]');
    expect(plan.result.stderr).toContain('现在在做什么：');
    expect(plan.result.stderr).toContain('为什么继续：');
    expect(plan.result.stderr).toContain('下一安全动作：');
    expect(plan.result.stderr).toContain('机器信息：');

    const run = runNode(
      CHECKPOINTS,
      [
        '--source',
        source,
        '--progress',
        progress,
        '--mode',
        'run',
        '--checkpoint',
        'cp-01-header-scope-decisions',
      ],
      tempDir
    );
    expect(run.result.status).toBe(0);
    expect(() => JSON.parse(run.result.stdout)).not.toThrow();
    expect(run.result.stderr).toContain('[需求契约]');
    expect(run.result.stderr).toContain('现在在做什么：');
    expect(run.result.stderr).toContain('下一安全动作：');
    expect(run.result.stderr).toContain('机器信息：');

    const status = runNode(CHECKPOINTS, ['--source', source, '--progress', progress, '--mode', 'status'], tempDir);
    expect(status.result.status).toBe(0);
    expect(() => JSON.parse(status.result.stdout)).not.toThrow();
    expect(status.result.stderr).toContain('[需求契约]');
    expect(status.result.stderr).toContain('现在在做什么：');
    expect(status.result.stderr).toContain('下一安全动作：');
    expect(status.result.stderr).toContain('机器信息：');

    const resume = runNode(CHECKPOINTS, ['--source', source, '--progress', progress, '--mode', 'resume'], tempDir);
    expect(resume.result.status).toBe(1);
    expect(() => JSON.parse(resume.result.stdout)).not.toThrow();
    expect(resume.result.stderr).toContain('[需求契约]');
    expect(resume.result.stderr).toContain('现在在做什么：');
    expect(resume.result.stderr).toContain('为什么停在这里：');
    expect(resume.result.stderr).toContain('下一安全动作：');
    expect(resume.result.stderr).toContain('机器信息：');
  });

  it('explains checkpoint_source_edit_missing in human language and suppresses it with --quiet', () => {
    initGitRepo(tempDir);
    const source = writeGloballyConsistentSource(tempDir);
    const progress = path.join(tempDir, 'progress.json');
    writeValidMustGateArtifactsForSource(source, authoringDirForGlobalGateRecord(tempDir));
    runNode(
      CHECKPOINTS,
      [
        '--source',
        source,
        '--progress',
        progress,
        '--mode',
        'run',
        '--checkpoint',
        'cp-01-header-scope-decisions',
      ],
      tempDir
    );

    const blocked = runNode(CHECKPOINTS, ['--source', source, '--progress', progress, '--mode', 'resume'], tempDir);
    expect(blocked.result.status).toBe(1);
    expect(blocked.json.code).toBe('checkpoint_source_edit_missing');
    expect(blocked.result.stderr).toContain('当前源文档还没有写入本 checkpoint 需要保存的内容');
    expect(blocked.result.stderr).toContain('不会替代需求契约编写');
    expect(blocked.result.stderr).toContain('不能伪造进度');
    expect(blocked.result.stderr).toContain('blockingReason=checkpoint_source_edit_missing');

    const quiet = spawnSync(
      process.execPath,
      [CHECKPOINTS, '--source', source, '--progress', progress, '--mode', 'resume', '--json', '--quiet'],
      {
        cwd: tempDir,
        encoding: 'utf8',
      }
    );
    expect(quiet.status).toBe(1);
    expect(() => JSON.parse(quiet.stdout)).not.toThrow();
    expect(quiet.stderr).toBe('');
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
    const source = writeGloballyConsistentSource(tempDir);
    const progress = path.join(tempDir, 'progress.json');
    writeValidMustGateArtifactsForSource(source, authoringDirForGlobalGateRecord(tempDir));

    const { result, json } = runNode(
      CHECKPOINTS,
      [
        '--source',
        source,
        '--progress',
        progress,
        '--mode',
        'run',
        '--checkpoint',
        'cp-01-header-scope-decisions',
      ],
      tempDir
    );
    const committedFiles = spawnSync('git', ['show', '--name-only', '--format=', 'HEAD'], {
      cwd: tempDir,
      encoding: 'utf8',
    })
      .stdout.split(/\r?\n/u)
      .filter(Boolean);

    expect(result.status).toBe(0);
    expect(json.ok).toBe(true);
    expect(json.commitHash).toMatch(/^[a-f0-9]{40}$/u);
    expect(fs.existsSync(progress)).toBe(true);
    expect(JSON.parse(fs.readFileSync(progress, 'utf8')).lastCompletedCheckpoint).toBe(
      'cp-01-must-decomposition-packet'
    );
    expect(JSON.parse(fs.readFileSync(progress, 'utf8')).checkpoints[0].idempotencyKey).toMatch(
      /^[a-f0-9]{64}$/u
    );
    expect(committedFiles).toEqual(['docs/requirements/source.md']);
  });

  it('does not create a duplicate checkpoint commit when progress idempotency key already matches current document', () => {
    initGitRepo(tempDir);
    const source = writeGloballyConsistentSource(tempDir);
    const progress = path.join(tempDir, 'progress.json');
    writeValidMustGateArtifactsForSource(source, authoringDirForGlobalGateRecord(tempDir));
    runNode(
      CHECKPOINTS,
      [
        '--source',
        source,
        '--progress',
        progress,
        '--mode',
        'run',
        '--checkpoint',
        'cp-01-header-scope-decisions',
      ],
      tempDir
    );
    const beforeCount = spawnSync('git', ['rev-list', '--count', 'HEAD'], {
      cwd: tempDir,
      encoding: 'utf8',
    }).stdout.trim();

    const { result, json } = runNode(
      CHECKPOINTS,
      [
        '--source',
        source,
        '--progress',
        progress,
        '--mode',
        'run',
        '--checkpoint',
        'cp-01-header-scope-decisions',
      ],
      tempDir
    );
    const afterCount = spawnSync('git', ['rev-list', '--count', 'HEAD'], {
      cwd: tempDir,
      encoding: 'utf8',
    }).stdout.trim();

    expect(result.status).toBe(0);
    expect(json.noOp).toBe(true);
    expect(json.reason).toBe('checkpoint_already_recorded_for_current_document_and_commit');
    expect(afterCount).toBe(beforeCount);
  });

  it('recovers status from backup progress when the primary progress record is corrupt', () => {
    initGitRepo(tempDir);
    const source = writeGloballyConsistentSource(tempDir);
    const progress = path.join(tempDir, 'progress.json');
    writeValidMustGateArtifactsForSource(source, authoringDirForGlobalGateRecord(tempDir));
    runNode(
      CHECKPOINTS,
      [
        '--source',
        source,
        '--progress',
        progress,
        '--mode',
        'run',
        '--checkpoint',
        'cp-01-header-scope-decisions',
      ],
      tempDir
    );
    fs.copyFileSync(progress, `${progress}.bak`);
    fs.writeFileSync(progress, '{broken json', 'utf8');

    const { result, json } = runNode(
      CHECKPOINTS,
      ['--source', source, '--progress', progress, '--mode', 'status'],
      tempDir
    );

    expect(result.status).toBe(0);
    expect(json.status).toBe('ready');
    expect(json.recoveredFrom).toBe('backup');
    expect(json.nextCheckpoint).toBe('cp-02-atomic-decomposition-loop-convergence');
    expect(json.semanticDrilldown.nextAction).toBe('run_packet_source_reconciliation');
  });

  it('recovers status from the latest git checkpoint when progress and backup are corrupt', () => {
    initGitRepo(tempDir);
    const source = writeGloballyConsistentSource(tempDir);
    const progress = path.join(tempDir, 'progress.json');
    writeValidMustGateArtifactsForSource(source, authoringDirForGlobalGateRecord(tempDir));
    runNode(
      CHECKPOINTS,
      [
        '--source',
        source,
        '--progress',
        progress,
        '--mode',
        'run',
        '--checkpoint',
        'cp-01-header-scope-decisions',
      ],
      tempDir
    );
    fs.writeFileSync(progress, '{broken json', 'utf8');
    fs.writeFileSync(`${progress}.bak`, '{also broken', 'utf8');

    const { result, json } = runNode(
      CHECKPOINTS,
      ['--source', source, '--progress', progress, '--mode', 'status'],
      tempDir
    );

    expect(result.status).toBe(0);
    expect(json.status).toBe('ready');
    expect(json.recoveredFrom).toBe('git_checkpoint');
    expect(json.nextCheckpoint).toBe('cp-02-atomic-decomposition-loop-convergence');
  });

  it('continues run from recovered progress instead of replaying completed checkpoints', () => {
    initGitRepo(tempDir);
    const source = writeGloballyConsistentSource(tempDir);
    const progress = path.join(tempDir, 'progress.json');
    writeValidMustGateArtifactsForSource(source, authoringDirForGlobalGateRecord(tempDir));
    runNode(
      CHECKPOINTS,
      [
        '--source',
        source,
        '--progress',
        progress,
        '--mode',
        'run',
        '--checkpoint',
        'cp-01-header-scope-decisions',
      ],
      tempDir
    );
    fs.copyFileSync(progress, `${progress}.bak`);
    fs.writeFileSync(progress, '{broken json', 'utf8');

    const { result, json } = runNode(
      CHECKPOINTS,
      ['--source', source, '--progress', progress, '--mode', 'run'],
      tempDir
    );
    const commitCount = spawnSync('git', ['rev-list', '--count', 'HEAD'], {
      cwd: tempDir,
      encoding: 'utf8',
    }).stdout.trim();

    expect(result.status).toBe(1);
    expect(json.code).toBe('checkpoint_source_edit_missing');
    expect(json.failedCheckpoint).toBe('cp-02-atomic-decomposition-loop-convergence');
    expect(commitCount).toBe('1');
  });

  it('fails closed when checkpoint progress cannot be written after a checkpoint commit', () => {
    initGitRepo(tempDir);
    const source = writeGloballyConsistentSource(tempDir);
    const blockingParent = path.join(tempDir, 'not-a-directory');
    const progress = path.join(blockingParent, 'progress.json');
    writeValidMustGateArtifactsForSource(source, authoringDirForGlobalGateRecord(tempDir));
    fs.writeFileSync(blockingParent, 'blocks progress directory creation\n', 'utf8');

    const { result, json } = runNode(
      CHECKPOINTS,
      [
        '--source',
        source,
        '--progress',
        progress,
        '--mode',
        'run',
        '--checkpoint',
        'cp-01-header-scope-decisions',
      ],
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

    const { result, json } = runNode(
      CHECKPOINTS,
      ['--source', source, '--progress', progress, '--mode', 'run'],
      tempDir
    );
    const commitHashes = spawnSync('git', ['log', '--format=%H'], {
      cwd: tempDir,
      encoding: 'utf8',
    })
      .stdout.split(/\r?\n/u)
      .filter(Boolean);
    const committedFileSets = commitHashes.map((hash) =>
      spawnSync('git', ['show', '--name-only', '--format=', hash], {
        cwd: tempDir,
        encoding: 'utf8',
      })
        .stdout.split(/\r?\n/u)
        .filter(Boolean)
    );

    expect(result.status).toBe(1);
    expect(json.ok).toBe(false);
    expect(json.code).toBe('checkpoint_authoring_evidence_missing');
    expect(json.status).toBe('blocked');
    expect(json.failedCheckpoint).toBe('cp-00-semantic-kernel');
    expect(json.issues.map((issue: any) => issue.code)).toEqual(
      expect.arrayContaining([
        'implementation_confirmation_required_before_checkpoint',
        'semantic_kernel_required_before_checkpoint',
      ])
    );
    expect(commitHashes).toHaveLength(0);
    expect(committedFileSets).toEqual([]);
    expect(fs.existsSync(progress)).toBe(false);
  });

  it('blocks full checkpoint run when semantic kernel, packet, critic, and reconciliation are missing', () => {
    initGitRepo(tempDir);
    const source = writeGloballyConsistentSource(tempDir);
    const progress = path.join(tempDir, 'progress.json');

    const { result, json } = runNode(
      CHECKPOINTS,
      ['--source', source, '--progress', progress, '--mode', 'run'],
      tempDir
    );
    const commitHashes = spawnSync('git', ['log', '--format=%H'], {
      cwd: tempDir,
      encoding: 'utf8',
    })
      .stdout.split(/\r?\n/u)
      .filter(Boolean);

    expect(result.status).toBe(1);
    expect(json.ok).toBe(false);
    expect(json.status).toBe('blocked');
    expect(json.code).toBe('checkpoint_authoring_evidence_missing');
    expect(json.failedCheckpoint).toBe('cp-00-semantic-kernel');
    expect(commitHashes).toHaveLength(0);
    expect(json.issues.map((issue: any) => issue.code)).toContain(
      'semantic_kernel_required_before_checkpoint'
    );
    expect(fs.existsSync(progress)).toBe(false);
  });

  it('rejects route decisions that are not checkpoint decisions before checkpoint execution', () => {
    initGitRepo(tempDir);
    const source = writeSmallSource(tempDir);
    const route = path.join(tempDir, 'scale-routing-decision.json');
    const routeDecision = {
      schemaVersion: 'contract-authoring-scale-routing-decision/v1',
      decision: 'single_pass_final_allowed',
      decisionSource: 'post_materialization_assessment',
      latestCompletedPhase: 'post_materialization_assessment',
      routeDecisionHash: 'sha256:stale',
    };
    fs.writeFileSync(route, JSON.stringify(routeDecision, null, 2), 'utf8');

    const { result, json } = runNode(
      CHECKPOINTS,
      ['--source', source, '--mode', 'run', '--route-decision', route],
      tempDir
    );

    expect(result.status).toBe(1);
    expect(json.status).toBe('blocked');
    expect(json.code).toBe('route_decision_invalid');
    expect(json.blockingReasons).toEqual(
      expect.arrayContaining(['route_decision_not_checkpoint', 'route_decision_hash_stale'])
    );
    expect(json.nextAction).toBe('rerun_scale_routing_decision');
    expect(result.stdout.trim().startsWith('{')).toBe(true);
  });

  it('returns checkpoint persistence candidate evidence without mutating route decision fields', () => {
    initGitRepo(tempDir);
    const source = writeGloballyConsistentSource(tempDir);
    const authoringDir = authoringDirForGlobalGateRecord(tempDir);
    writeValidMustGateArtifactsForSource(source, authoringDir);
    const progress = path.join(tempDir, 'progress.json');
    const route = path.join(tempDir, 'scale-routing-decision.json');
    const { buildScaleRoutingDecision } = requireForGate(ASSESS);
    const routeDecision = buildScaleRoutingDecision({
      sourcePath: source,
      initial: { phase: 'initial_assessment', decision: 'single_pass_allowed', signals: {} },
      postPacket: { phase: 'post_packet_assessment', decision: 'checkpoint_required', signals: {} },
      refs: {},
    });
    fs.writeFileSync(route, JSON.stringify(routeDecision, null, 2), 'utf8');
    const before = fs.readFileSync(route, 'utf8');

    const { result, json } = runNode(
      CHECKPOINTS,
      [
        '--source',
        source,
        '--progress',
        progress,
        '--mode',
        'run',
        '--checkpoint',
        'cp-01-header-scope-decisions',
        '--route-decision',
        route,
      ],
      tempDir
    );
    const after = fs.readFileSync(route, 'utf8');

    expect(result.status).toBe(0);
    expect(json.routeDecisionHash).toBe(routeDecision.routeDecisionHash);
    expect(json.checkpointPersistenceRef.routeDecisionHash).toBe(routeDecision.routeDecisionHash);
    expect(json.checkpointPersistenceSatisfiedCandidate).toBe(false);
    expect(after).toBe(before);
  });

  it('returns satisfied checkpoint persistence evidence from current progress and gate hashes without mutating route decisions', () => {
    initGitRepo(tempDir);
    const source = writeGloballyConsistentSource(tempDir);
    const authoringDir = authoringDirForGlobalGateRecord(tempDir);
    writeValidMustGateArtifactsForSource(source, authoringDir);
    const progress = path.join(authoringDir, 'semantic-checkpoint-progress.json');
    const route = path.join(authoringDir, 'scale-routing-decision.json');
    const documentHash = fileHash(source);
    fs.writeFileSync(
      progress,
      JSON.stringify(
        {
          schemaVersion: 'semantic-checkpoint-progress/v1',
          documentHash,
          checkpoints: SEMANTIC_CHECKPOINT_IDS.map((id) => ({
            id,
            status: 'passed',
            documentHash,
          })),
        },
        null,
        2
      ),
      'utf8'
    );
    runNode(
      CHECKPOINTS,
      ['--source', source, '--progress', progress, '--mode', 'pre-render-gate'],
      tempDir
    );
    const { buildScaleRoutingDecision } = requireForGate(ASSESS);
    const routeDecision = buildScaleRoutingDecision({
      sourcePath: source,
      initial: { phase: 'initial_assessment', decision: 'single_pass_allowed', signals: {} },
      postPacket: { phase: 'post_packet_assessment', decision: 'checkpoint_required', signals: {} },
      postMaterialization: {
        phase: 'post_materialization_assessment',
        decision: 'checkpoint_required',
        signals: { packetSourceReconciliationVerdict: 'pass' },
      },
      refs: {},
    });
    fs.writeFileSync(route, JSON.stringify(routeDecision, null, 2), 'utf8');
    const before = fs.readFileSync(route, 'utf8');

    const { result, json } = runNode(
      CHECKPOINTS,
      [
        '--source',
        source,
        '--progress',
        progress,
        '--mode',
        'checkpoint-persistence',
        '--route-decision',
        route,
      ],
      tempDir
    );
    const after = fs.readFileSync(route, 'utf8');

    expect(result.status).toBe(0);
    expect(json.status).toBe('satisfied');
    expect(json.checkpointPersistenceSatisfiedCandidate).toBe(true);
    expect(json.checkpointPersistenceRef.routeDecisionHash).toBe(routeDecision.routeDecisionHash);
    expect(json.checkpointPersistenceRef.completedCheckpointIds).toEqual(SEMANTIC_CHECKPOINT_IDS);
    expect(json.completedCheckpointIds).toEqual(SEMANTIC_CHECKPOINT_IDS);
    expect(json.checkpointPersistenceRef.progressHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(json.checkpointPersistenceRef.preRenderMustDecompositionGateHash).toMatch(
      /^sha256:[a-f0-9]{64}$/u
    );
    expect(json.checkpointPersistenceRef.preRenderGlobalConsistencyHash).toMatch(
      /^sha256:[a-f0-9]{64}$/u
    );
    expect(json.checkpointPersistenceRef.packetSourceReconciliationHash).toMatch(
      /^sha256:[a-f0-9]{64}$/u
    );
    expect(after).toBe(before);
  });

  it('resumes from progress next checkpoint and runs remaining checkpoints separately', () => {
    initGitRepo(tempDir);
    const source = writeGloballyConsistentSource(tempDir);
    const progress = path.join(tempDir, 'progress.json');
    writeValidMustGateArtifactsForSource(source, authoringDirForGlobalGateRecord(tempDir));
    runNode(
      CHECKPOINTS,
      [
        '--source',
        source,
        '--progress',
        progress,
        '--mode',
        'run',
        '--checkpoint',
        'cp-01-header-scope-decisions',
      ],
      tempDir
    );

    const { result, json } = runNode(
      CHECKPOINTS,
      ['--source', source, '--progress', progress, '--mode', 'resume'],
      tempDir
    );
    const commitCount = spawnSync('git', ['rev-list', '--count', 'HEAD'], {
      cwd: tempDir,
      encoding: 'utf8',
    }).stdout.trim();
    const savedProgress = JSON.parse(fs.readFileSync(progress, 'utf8'));

    expect(result.status).toBe(1);
    expect(json.ok).toBe(false);
    expect(json.code).toBe('checkpoint_source_edit_missing');
    expect(json.failedCheckpoint).toBe('cp-02-atomic-decomposition-loop-convergence');
    expect(commitCount).toBe('1');
    expect(savedProgress.next).toBe('cp-02-atomic-decomposition-loop-convergence');
  });

  it('fails the pre-render gate for eighteen trace rows that reference missing evidence', () => {
    initGitRepo(tempDir);
    const source = writeEighteenTraceFalsePositiveSource(tempDir);
    const progress = path.join(tempDir, 'progress.json');

    const { result, json } = runNode(
      CHECKPOINTS,
      ['--source', source, '--progress', progress, '--mode', 'pre-render-gate'],
      tempDir
    );

    expect(result.status).toBe(1);
    expect(json.verdict).toBe('FAIL');
    expect(json.failedChecks).toContain('global_trace_unknown_evidence_ref');
    expect(
      json.issues.filter((issue: any) => issue.code === 'global_trace_unknown_evidence_ref')
    ).toHaveLength(18);
  });

  it('fails the pre-render gate when currentTargetMap applies but the confirmation view pack is hidden', () => {
    initGitRepo(tempDir);
    const source = writeCurrentTargetHiddenFalsePositiveSource(tempDir);
    const progress = path.join(tempDir, 'progress.json');

    const { result, json } = runNode(
      CHECKPOINTS,
      ['--source', source, '--progress', progress, '--mode', 'pre-render-gate'],
      tempDir
    );

    expect(result.status).toBe(1);
    expect(json.verdict).toBe('FAIL');
    expect(json.failedChecks).toContain('global_current_target_required_view_pack_missing');
    expect(json.issues.map((issue: any) => issue.code)).toContain(
      'global_current_target_required_view_pack_missing'
    );
  });

  it('fails retention cleanup when no confirmed retention strategy is provided', () => {
    initGitRepo(tempDir);
    const source = path.join(tempDir, 'docs', 'requirements', 'source.md');
    fs.writeFileSync(source, '# Source\n', 'utf8');

    const { result, json } = runNode(
      RETENTION_CLEANUP,
      ['--source', source, '--mode', 'dry-run'],
      tempDir
    );

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
      [
        '--source',
        source,
        '--strategy',
        'confirmed-local-only',
        '--mode',
        'dry-run',
        '--receipt',
        receipt,
      ],
      tempDir
    );
    const staged = spawnSync('git', ['diff', '--cached', '--name-only'], {
      cwd: tempDir,
      encoding: 'utf8',
    })
      .stdout.split(/\r?\n/u)
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
      [
        '--source',
        source,
        '--strategy',
        'confirmed-local-only',
        '--mode',
        'apply',
        '--receipt',
        receipt,
      ],
      tempDir
    );
    const staged = spawnSync('git', ['diff', '--cached', '--name-only'], {
      cwd: tempDir,
      encoding: 'utf8',
    })
      .stdout.split(/\r?\n/u)
      .filter(Boolean);
    const untracked = spawnSync('git', ['ls-files', '--others', '--exclude-standard'], {
      cwd: tempDir,
      encoding: 'utf8',
    })
      .stdout.split(/\r?\n/u)
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
    const acceptanceRows = [
      ...asArray(confirmation.acceptanceTests),
      ...asArray(confirmation.e2eSuites),
    ];
    const viewRows = [
      ...asArray(confirmation.sequenceViews),
      ...asArray(confirmation.flowViews),
      ...asArray(confirmation.edgeCaseViews),
      ...asArray(confirmation.boundaryViews),
    ];
    const failNegRefs = new Map(
      failRows.map((row) => [row.id, refs(row, ['linkedNegIds', 'negRefs'])])
    );

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
      const negRefs = Array.from(
        new Set([
          ...refs(row, ['linkedNegIds', 'negRefs']),
          ...failureRefs.flatMap((id) => failNegRefs.get(id) ?? []),
        ])
      );
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
    expect(
      acceptanceRows.filter(
        (row) => row.id !== 'ACC-001' && refs(row, ['failurePathRefs', 'edgeCaseRefs']).length > 0
      ).length
    ).toBeGreaterThan(0);
  });
});
