import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  evaluateAiTddContractGate,
  mainAiTddContractGate,
} from '../../scripts/ai-tdd-contract-gate';
import { implementationConfirmationHash } from '../../scripts/target-artifact-realization-gate';

const ATTEMPT = 'attempt-ai-tdd-001';

type Report = Record<string, unknown>;

function reportArray(report: Report, key: string): Record<string, unknown>[] {
  const value = report[key];
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

function reportObject(report: Report, key: string): Record<string, unknown> {
  const value = report[key];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function writeText(filePath: string, value: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, 'utf8');
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sourceText(input: {
  status?: string;
  testPath?: string;
  e2eTestPath?: string;
  acceptanceState?: string;
  omitAcceptance?: boolean;
  omitNegativeOracle?: boolean;
  mockOnly?: boolean;
  targetPath?: string;
  nonTestCommand?: boolean;
  omitTargetModificationPaths?: boolean;
  targetModificationMissingPath?: boolean;
  targetModificationNoRefs?: boolean;
  targetModificationTraceRefsMissing?: boolean;
  targetModificationEvidenceRefsMissing?: boolean;
  targetModificationBrokenRefs?: boolean;
  omitCloseoutPreview?: boolean;
  omitLegacyRefs?: boolean;
  brokenRefs?: boolean;
  omitAcc?: boolean;
  omitE2e?: boolean;
  accCoversNegOnly?: boolean;
  includeOrphans?: boolean;
  omitRequirementRefs?: boolean;
  omitNotDoneTraceRefs?: boolean;
  omitTraceRowCovers?: boolean;
  artifactIdOnly?: boolean;
  projectionArtifactRole?: boolean;
  canonicalSurfaceOnly?: boolean;
  omitFailureNegRefs?: boolean;
  omitEdgeFailureRefs?: boolean;
  omitErrorCaseAcceptanceRefs?: boolean;
  manifestProjectionAddsCommand?: boolean;
  manifestProjectionOmitsCommand?: boolean;
}): string {
  const status = input.status ?? 'user_confirmed';
  const targetPath = input.targetPath ?? 'evidence/target.json';
  const testPath = input.testPath ?? 'tests/acceptance/ai-tdd-fixture.test.ts';
  const e2eTestPath = input.e2eTestPath ?? 'tests/e2e/ai-tdd-fixture.e2e.test.ts';
  const acceptanceCommandText = input.nonTestCommand
    ? 'node scripts/non-test-command.js'
    : `npx vitest run ${testPath.replace(/\\/gu, '/')}`;
  const e2eCommandText = input.nonTestCommand
    ? 'node scripts/non-test-command.js'
    : `npx vitest run ${e2eTestPath.replace(/\\/gu, '/')}`;
  const acceptance: string[] = [];
  if (!input.omitAcceptance && !input.omitAcc) {
    acceptance.push(
      '  acceptanceTests:',
      '    - id: ACC-001',
      `      file: ${testPath.replace(/\\/gu, '/')}`,
      `      covers: [${input.brokenRefs ? 'MUST-MISSING' : input.accCoversNegOnly ? 'NEG-001' : 'MUST-001'}]`,
      ...(input.omitErrorCaseAcceptanceRefs
        ? []
        : ['      failurePathRefs: [FAIL-001]', '      edgeCaseRefs: [EDGE-001]']),
      '      traceRows: [TRACE-001]',
      '      evidenceRefs: [EVD-001]',
      '      commandRefs: [CMD-001]',
      `      expectedPreImplementationState: ${input.acceptanceState ?? 'expected_red'}`,
      '      oracle: fixture acceptance oracle',
      ...(input.mockOnly ? ['      mockOnly: true'] : [])
    );
  }
  if (!input.omitAcceptance && !input.omitE2e) {
    acceptance.push(
      '  e2eSuites:',
      '    - id: E2E-001',
      `      file: ${e2eTestPath.replace(/\\/gu, '/')}`,
      `      covers: [${input.brokenRefs ? 'NEG-MISSING' : 'NEG-001'}]`,
      ...(input.omitErrorCaseAcceptanceRefs
        ? []
        : ['      failurePathRefs: [FAIL-001]', '      edgeCaseRefs: [EDGE-001]']),
      '      traceRows: [TRACE-001]',
      '      evidenceRefs: [EVD-001]',
      '      commandRefs: [CMD-002]',
      '      negativeControls: [NEG-001]',
      `      expectedPreImplementationState: ${input.acceptanceState ?? 'expected_red'}`,
      '      oracle: fixture e2e negative-control oracle'
    );
  }
  const targetModificationRows = input.omitTargetModificationPaths
    ? []
    : input.targetModificationMissingPath
      ? [
          '  targetModificationPaths:',
          '    - id: TARGET-MOD-MISSING-PATH',
          '      traceRows: [TRACE-001]',
          '      evidenceRefs: [EVD-001]',
        ]
      : input.targetModificationNoRefs
        ? [
            '  targetModificationPaths:',
            '    - scripts/ai-tdd-contract-gate.ts',
            '    - tests/acceptance/ai-tdd-contract-gate.test.ts',
          ]
        : [
            '  targetModificationPaths:',
            '    - id: TARGET-MOD-001',
            '      path: scripts/ai-tdd-contract-gate.ts',
            ...(input.targetModificationTraceRefsMissing
              ? []
              : [
                  `      traceRows: [${input.targetModificationBrokenRefs ? 'TRACE-MISSING' : 'TRACE-001'}]`,
                ]),
            ...(input.targetModificationEvidenceRefsMissing
              ? []
              : [
                  `      evidenceRefs: [${input.targetModificationBrokenRefs ? 'EVD-MISSING' : 'EVD-001'}]`,
                ]),
            '    - id: TARGET-MOD-002',
            '      path: tests/acceptance/ai-tdd-contract-gate.test.ts',
            ...(input.targetModificationTraceRefsMissing
              ? []
              : [
                  `      traceRows: [${input.targetModificationBrokenRefs ? 'TRACE-MISSING' : 'TRACE-001'}]`,
                ]),
            ...(input.targetModificationEvidenceRefsMissing
              ? []
              : [
                  `      evidenceRefs: [${input.targetModificationBrokenRefs ? 'EVD-MISSING' : 'EVD-001'}]`,
                ]),
          ];
  const orphanRows = input.includeOrphans
    ? [
        '    - id: EVD-ORPHAN',
        '      text: Orphan evidence.',
        '      oracle: orphan oracle',
        '      requiredCommandRefs: [CMD-ORPHAN]',
        '      artifactRefs: []',
      ]
    : [];
  const legacyRefs = input.omitLegacyRefs
    ? []
    : ['        traceRows: [TRACE-001]', '        evidenceRefs: [EVD-001]'];
  const projectionRows = input.manifestProjectionAddsCommand || input.manifestProjectionOmitsCommand
    ? [
        '  aiTddContractExecutionManifestProjection:',
        '    closeoutProof:',
        `      requiredCommands: [${input.manifestProjectionOmitsCommand ? 'CMD-001, CMD-002' : 'CMD-001, CMD-002, CMD-003'}]`,
        '      policies:',
        '        - no orphan commands, evidence, or artifacts may satisfy closeout',
        '        - closeout consumes only current-attempt command and artifact evidence',
        '        - record_closed is written only after delivery verification',
        '      targetRefs: [ART-001]',
        '      ready: true',
      ]
    : [];
  const closeoutPreviewRows = input.omitCloseoutPreview
    ? []
    : [
        '  closeoutReadinessPreview:',
        '    requiredCommands: [CMD-001, CMD-002]',
        '    orphanPolicy: no orphan commands, evidence, or artifacts may satisfy closeout',
        '    currentAttemptPolicy: closeout consumes only current-attempt command and artifact evidence',
        '    recordClosedPolicy: record_closed is written only after delivery verification',
      ];
  return [
    'implementationConfirmation:',
    `  status: ${status}`,
    '  must:',
    '    - id: MUST-001',
    '      text: Must expose AI-TDD manifest.',
    ...(input.omitRequirementRefs
      ? []
      : ['      evidenceRefs: [EVD-001]', '      coveredByTraceRows: [TRACE-001]']),
    '  notDone:',
    '    - id: NEG-001',
    '      text: Missing acceptance coverage cannot close.',
    ...(input.omitRequirementRefs ? [] : ['      evidenceRefs: [EVD-001]']),
    `      oracle: ${input.omitNegativeOracle ? '' : 'negative control oracle'}`,
    ...(input.omitRequirementRefs || input.omitNotDoneTraceRefs
      ? []
      : ['      coveredByTraceRows: [TRACE-001]']),
    '  mustNot:',
    '    - id: OUT-001',
    '      text: Do not mutate source trace rows.',
    '  evidence:',
    '    - id: EVD-001',
    '      text: Acceptance evidence.',
    '      oracle: current-attempt command with artifact evidence',
    '      requiredCommandRefs: [CMD-001, CMD-002]',
    `      artifactRefs: [${input.canonicalSurfaceOnly ? 'scripts/ai-tdd-contract-gate.ts' : input.artifactIdOnly ? 'ART-001, scripts/ai-tdd-contract-gate.ts' : 'CANONICAL-001, scripts/ai-tdd-contract-gate.ts'}]`,
    ...orphanRows,
    '  traceRows:',
    '    - id: TRACE-001',
    `      covers: [${input.omitTraceRowCovers ? '' : 'MUST-001, NEG-001'}]`,
    '      evidenceRefs: [EVD-001]',
    `      deliveryEvidenceCommandRefs: [CMD-001, CMD-002${input.manifestProjectionOmitsCommand ? ', CMD-003' : ''}]`,
    '      acceptanceRefs: [ACC-001, E2E-001]',
    `      artifactRefs: [${input.canonicalSurfaceOnly ? 'scripts/ai-tdd-contract-gate.ts' : input.artifactIdOnly ? 'ART-001, scripts/ai-tdd-contract-gate.ts' : 'CANONICAL-001, scripts/ai-tdd-contract-gate.ts'}]`,
    ...(input.canonicalSurfaceOnly ? ['      canonicalSurfaceRefs: [ART-001]'] : []),
    '  failurePaths:',
    '    - id: FAIL-001',
    '      title: Missing AI-TDD negative coverage',
    '      trigger: A negative behavior lacks explicit AI-TDD coverage.',
    '      expectedBehavior: Fail closed.',
    '      forbiddenBehavior: Report the contract complete.',
    '      blocksCompletionWhenViolated: true',
    `      linkedNegIds: [${input.omitFailureNegRefs ? '' : 'NEG-001'}]`,
    '      linkedEvidenceIds: [EVD-001]',
    '      requiredAssertions: [error-case coverage is explicit]',
    '  edgeCases:',
    '    - id: EDGE-001',
    '      category: explicit_error_case_mapping',
    '      condition: An edge case depends on the failure path.',
    '      expectedBehavior: Fail closed.',
    '      forbiddenBehavior: Hide edge-case coverage.',
    `      linkedFailurePathIds: [${input.omitEdgeFailureRefs ? '' : 'FAIL-001'}]`,
    '      linkedEvidenceIds: [EVD-001]',
    '  edgeCaseViews:',
    '    - id: EDGEVIEW-001',
    '      title: AI-TDD error-case coverage view',
    '      covers: [FAIL-001, EDGE-001]',
    '      cases: [EDGE-001]',
    '  requiredCommands:',
    '    - id: CMD-001',
    `      command: ${acceptanceCommandText}`,
    '      oracle: fixture acceptance oracle',
    '      traceRows: [TRACE-001]',
    '      evidenceRefs: [EVD-001]',
    '    - id: CMD-002',
    `      command: ${e2eCommandText}`,
    '      oracle: fixture e2e negative-control oracle',
    '      traceRows: [TRACE-001]',
    '      evidenceRefs: [EVD-001]',
    ...(input.manifestProjectionAddsCommand || input.manifestProjectionOmitsCommand
      ? [
          '    - id: CMD-003',
          `      command: ${acceptanceCommandText}`,
          '      oracle: fixture closeout review oracle',
          '      traceRows: [TRACE-001]',
          '      evidenceRefs: [EVD-001]',
        ]
      : []),
    ...(input.includeOrphans
      ? [
          '    - id: CMD-ORPHAN',
          '      command: node scripts/orphan-command.js',
          '      oracle: orphan command oracle',
          '      traceRows: [TRACE-001]',
          '      evidenceRefs: [EVD-001]',
        ]
      : []),
    '  artifactAutomationPlan:',
    `    - ${input.artifactIdOnly ? 'artifactId' : 'id'}: ART-001`,
    '      artifactType: report',
    `      path: ${targetPath.replace(/\\/gu, '/')}`,
    '      producer: ai-tdd-fixture',
    `      sourceOfTruthRole: ${input.projectionArtifactRole ? 'projection' : input.artifactIdOnly ? 'implementation' : 'evidence'}`,
    '      traceRows: [TRACE-001]',
    '      evidenceRefs: [EVD-001]',
    ...(input.includeOrphans
      ? [
          '    - id: ART-ORPHAN',
          '      artifactType: code',
          '      path: evidence/orphan.json',
          '      producer: ai-tdd-fixture',
          '      sourceOfTruthRole: implementation',
          '      traceRows: [TRACE-001]',
          '      evidenceRefs: [EVD-001]',
        ]
      : []),
    '  currentTargetMap:',
    '    schemaVersion: current-target-map/v1',
    '    displayProfile: closed_loop_current_target_map',
    '    currentSummary:',
    '      - title: current fixture state',
    '        detail: fixture target artifact is not yet delivery verified',
    '    targetSummary:',
    '      - title: target fixture state',
    '        detail: fixture target artifact must be proven by current attempt evidence',
    '    diffRows:',
    '      - dimension: fixture positive behavior',
    '        currentState: unverified',
    '        targetState: current-attempt proof required',
    '        action: verify MUST-001',
    '      - dimension: fixture negative behavior',
    '        currentState: incomplete negative proof can be hidden',
    '        targetState: NEG-001 has failure/e2e coverage',
    '        action: verify NEG-001',
    '      - dimension: fixture completion proof',
    '        currentState: legacy completion event exists',
    '        targetState: legacy proof cannot close delivery',
    '        action: deny legacy proof',
    '    process:',
    '      - phase: pre-implementation',
    '        currentState: red proof required',
    '        targetState: AI-TDD manifest gates are ready',
    '    artifactPaths:',
    '      - path: scripts/ai-tdd-contract-gate.ts',
    '        targetRole: contract execution manifest gate',
    '        traceRows: [TRACE-001]',
    '        evidenceRefs: [EVD-001]',
    '    canonicalArtifacts:',
    '      - id: CANONICAL-001',
    `        targetPathOrField: ${targetPath.replace(/\\/gu, '/')}`,
    '        traceRows: [TRACE-001]',
    '        evidenceRefs: [EVD-001]',
    '    pathRegistry: []',
    '    existingArtifacts:',
    '      - id: LEGACY-001',
    '        currentPath: legacy_completion_event',
    '        completionProofPolicy: legacy_only',
    ...legacyRefs,
    ...closeoutPreviewRows,
    ...projectionRows,
    ...targetModificationRows,
    ...acceptance,
    '',
  ].join('\n');
}

function writeFixture(
  root: string,
  options: {
    status?: string;
    acceptanceState?: string;
    omitAcceptance?: boolean;
    omitNegativeOracle?: boolean;
    missingTest?: boolean;
    mockOnly?: boolean;
    staleAttempt?: boolean;
    exitCodeOnly?: boolean;
    reverseAuditReady?: boolean;
    nonTestCommand?: boolean;
    omitTargetModificationPaths?: boolean;
    targetModificationMissingPath?: boolean;
    targetModificationNoRefs?: boolean;
    targetModificationTraceRefsMissing?: boolean;
    targetModificationEvidenceRefsMissing?: boolean;
    targetModificationBrokenRefs?: boolean;
    omitCloseoutPreview?: boolean;
    omitLegacyRefs?: boolean;
    brokenRefs?: boolean;
    omitAcc?: boolean;
    omitE2e?: boolean;
    accCoversNegOnly?: boolean;
    includeOrphans?: boolean;
    omitRequirementRefs?: boolean;
    omitNotDoneTraceRefs?: boolean;
    omitTraceRowCovers?: boolean;
    artifactIdOnly?: boolean;
    projectionArtifactRole?: boolean;
    canonicalSurfaceOnly?: boolean;
    omitFailureNegRefs?: boolean;
    omitEdgeFailureRefs?: boolean;
    omitErrorCaseAcceptanceRefs?: boolean;
    projectRootRelativeTestPaths?: boolean;
    sourceInRequirementsDir?: boolean;
    manifestProjectionAddsCommand?: boolean;
    manifestProjectionOmitsCommand?: boolean;
  } = {}
) {
  const testPath = path.join(root, 'tests', 'acceptance', 'ai-tdd-fixture.test.ts');
  const e2eTestPath = path.join(root, 'tests', 'e2e', 'ai-tdd-fixture.e2e.test.ts');
  const testPathRef = options.projectRootRelativeTestPaths
    ? 'tests/acceptance/ai-tdd-fixture.test.ts'
    : testPath.replace(/\\/gu, '/');
  const e2eTestPathRef = options.projectRootRelativeTestPaths
    ? 'tests/e2e/ai-tdd-fixture.e2e.test.ts'
    : e2eTestPath.replace(/\\/gu, '/');
  if (!options.missingTest)
    writeText(testPath, 'import { it } from "vitest"; it("ok", () => {});\n');
  if (!options.missingTest)
    writeText(e2eTestPath, 'import { it } from "vitest"; it("ok", () => {});\n');
  const targetPath = path.join(root, 'evidence', 'target.json');
  writeJson(targetPath, { ok: true });
  const sourcePath = options.sourceInRequirementsDir
    ? path.join(root, 'docs', 'requirements', 'source.md')
    : path.join(root, 'source.md');
  writeText(
    sourcePath,
    sourceText({
      status: options.status,
      acceptanceState: options.acceptanceState,
      omitAcceptance: options.omitAcceptance,
      omitNegativeOracle: options.omitNegativeOracle,
      mockOnly: options.mockOnly,
      testPath: testPathRef,
      e2eTestPath: e2eTestPathRef,
      targetPath,
      nonTestCommand: options.nonTestCommand,
      omitTargetModificationPaths: options.omitTargetModificationPaths,
      targetModificationMissingPath: options.targetModificationMissingPath,
      targetModificationNoRefs: options.targetModificationNoRefs,
      targetModificationTraceRefsMissing: options.targetModificationTraceRefsMissing,
      targetModificationEvidenceRefsMissing: options.targetModificationEvidenceRefsMissing,
      targetModificationBrokenRefs: options.targetModificationBrokenRefs,
      omitCloseoutPreview: options.omitCloseoutPreview,
      omitLegacyRefs: options.omitLegacyRefs,
      brokenRefs: options.brokenRefs,
      omitAcc: options.omitAcc,
      omitE2e: options.omitE2e,
      accCoversNegOnly: options.accCoversNegOnly,
      includeOrphans: options.includeOrphans,
      omitRequirementRefs: options.omitRequirementRefs,
      omitNotDoneTraceRefs: options.omitNotDoneTraceRefs,
      omitTraceRowCovers: options.omitTraceRowCovers,
      artifactIdOnly: options.artifactIdOnly,
      projectionArtifactRole: options.projectionArtifactRole,
      canonicalSurfaceOnly: options.canonicalSurfaceOnly,
      omitFailureNegRefs: options.omitFailureNegRefs,
      omitEdgeFailureRefs: options.omitEdgeFailureRefs,
      omitErrorCaseAcceptanceRefs: options.omitErrorCaseAcceptanceRefs,
      manifestProjectionAddsCommand: options.manifestProjectionAddsCommand,
      manifestProjectionOmitsCommand: options.manifestProjectionOmitsCommand,
    })
  );
  const confirmation = {
    status: options.status ?? 'user_confirmed',
    must: [
      {
        id: 'MUST-001',
        text: 'Must expose AI-TDD manifest.',
        ...(options.omitRequirementRefs
          ? {}
          : {
              evidenceRefs: ['EVD-001'],
              coveredByTraceRows: ['TRACE-001'],
            }),
      },
    ],
    notDone: [
      {
        id: 'NEG-001',
        text: 'Missing acceptance coverage cannot close.',
        ...(options.omitRequirementRefs ? {} : { evidenceRefs: ['EVD-001'] }),
        oracle: options.omitNegativeOracle ? '' : 'negative control oracle',
        ...(options.omitRequirementRefs || options.omitNotDoneTraceRefs
          ? {}
          : { coveredByTraceRows: ['TRACE-001'] }),
      },
    ],
    mustNot: [{ id: 'OUT-001', text: 'Do not mutate source trace rows.' }],
    evidence: [
      {
        id: 'EVD-001',
        text: 'Acceptance evidence.',
        oracle: 'current-attempt command with artifact evidence',
        requiredCommandRefs: ['CMD-001'],
        artifactRefs: options.canonicalSurfaceOnly
          ? ['scripts/ai-tdd-contract-gate.ts']
          : options.artifactIdOnly
            ? ['ART-001', 'scripts/ai-tdd-contract-gate.ts']
            : ['CANONICAL-001', 'scripts/ai-tdd-contract-gate.ts'],
      },
      ...(options.includeOrphans
        ? [
            {
              id: 'EVD-ORPHAN',
              text: 'Orphan evidence.',
              oracle: 'orphan oracle',
              requiredCommandRefs: ['CMD-ORPHAN'],
              artifactRefs: [],
            },
          ]
        : []),
    ],
    traceRows: [
      {
        id: 'TRACE-001',
        covers: options.omitTraceRowCovers ? [] : ['MUST-001', 'NEG-001'],
        evidenceRefs: ['EVD-001'],
        deliveryEvidenceCommandRefs: [
          'CMD-001',
          'CMD-002',
          ...(options.manifestProjectionOmitsCommand ? ['CMD-003'] : []),
        ],
        acceptanceRefs: ['ACC-001', 'E2E-001'],
        artifactRefs: options.canonicalSurfaceOnly
          ? ['scripts/ai-tdd-contract-gate.ts']
          : options.artifactIdOnly
            ? ['ART-001', 'scripts/ai-tdd-contract-gate.ts']
            : ['CANONICAL-001', 'scripts/ai-tdd-contract-gate.ts'],
        ...(options.canonicalSurfaceOnly ? { canonicalSurfaceRefs: ['ART-001'] } : {}),
      },
    ],
    failurePaths: [
      {
        id: 'FAIL-001',
        title: 'Missing AI-TDD negative coverage',
        trigger: 'A negative behavior lacks explicit AI-TDD coverage.',
        expectedBehavior: 'Fail closed.',
        forbiddenBehavior: 'Report the contract complete.',
        blocksCompletionWhenViolated: true,
        linkedNegIds: options.omitFailureNegRefs ? [] : ['NEG-001'],
        linkedEvidenceIds: ['EVD-001'],
        requiredAssertions: ['error-case coverage is explicit'],
      },
    ],
    edgeCases: [
      {
        id: 'EDGE-001',
        category: 'explicit_error_case_mapping',
        condition: 'An edge case depends on the failure path.',
        expectedBehavior: 'Fail closed.',
        forbiddenBehavior: 'Hide edge-case coverage.',
        linkedFailurePathIds: options.omitEdgeFailureRefs ? [] : ['FAIL-001'],
        linkedEvidenceIds: ['EVD-001'],
      },
    ],
    edgeCaseViews: [
      {
        id: 'EDGEVIEW-001',
        title: 'AI-TDD error-case coverage view',
        covers: ['FAIL-001', 'EDGE-001'],
        cases: ['EDGE-001'],
      },
    ],
    requiredCommands: [
      {
        id: 'CMD-001',
        command: options.nonTestCommand
          ? 'node scripts/non-test-command.js'
          : `npx vitest run ${testPathRef}`,
        oracle: 'fixture acceptance oracle',
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
      },
      {
        id: 'CMD-002',
        command: options.nonTestCommand
          ? 'node scripts/non-test-command.js'
          : `npx vitest run ${e2eTestPathRef}`,
        oracle: 'fixture e2e negative-control oracle',
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
      },
      ...(options.includeOrphans
        ? [
            {
              id: 'CMD-ORPHAN',
              command: 'node scripts/orphan-command.js',
              oracle: 'orphan command oracle',
            },
          ]
        : []),
      ...(options.manifestProjectionAddsCommand || options.manifestProjectionOmitsCommand
        ? [
            {
              id: 'CMD-003',
              command: `npx vitest run ${testPathRef}`,
              oracle: 'fixture closeout review oracle',
              traceRows: ['TRACE-001'],
              evidenceRefs: ['EVD-001'],
            },
          ]
        : []),
    ],
    artifactAutomationPlan: [
      {
        ...(options.artifactIdOnly ? { artifactId: 'ART-001' } : { id: 'ART-001' }),
        artifactType: 'report',
        path: targetPath.replace(/\\/gu, '/'),
        producer: 'ai-tdd-fixture',
        sourceOfTruthRole: options.projectionArtifactRole
          ? 'projection'
          : options.artifactIdOnly
            ? 'implementation'
            : 'evidence',
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
      },
      ...(options.includeOrphans
        ? [
            {
              id: 'ART-ORPHAN',
              artifactType: 'code',
              path: 'evidence/orphan.json',
              producer: 'ai-tdd-fixture',
              sourceOfTruthRole: 'implementation',
              traceRows: ['TRACE-001'],
              evidenceRefs: ['EVD-001'],
            },
          ]
        : []),
    ],
    currentTargetMap: {
      canonicalArtifacts: [
        {
          id: 'CANONICAL-001',
          targetPathOrField: targetPath.replace(/\\/gu, '/'),
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
        },
      ],
      pathRegistry: [],
      existingArtifacts: [
        {
          id: 'LEGACY-001',
          currentPath: 'legacy_completion_event',
          completionProofPolicy: 'legacy_only',
          ...(options.omitLegacyRefs
            ? {}
            : { traceRows: ['TRACE-001'], evidenceRefs: ['EVD-001'] }),
        },
      ],
    },
    ...(options.omitCloseoutPreview
      ? {}
      : {
          closeoutReadinessPreview: {
            requiredCommands: ['CMD-001', 'CMD-002'],
            orphanPolicy: 'no orphan commands, evidence, or artifacts may satisfy closeout',
            currentAttemptPolicy:
              'closeout consumes only current-attempt command and artifact evidence',
            recordClosedPolicy: 'record_closed is written only after delivery verification',
          },
        }),
    ...(options.omitTargetModificationPaths
      ? {}
      : {
          targetModificationPaths: options.targetModificationMissingPath
            ? [
                {
                  id: 'TARGET-MOD-MISSING-PATH',
                  traceRows: ['TRACE-001'],
                  evidenceRefs: ['EVD-001'],
                },
              ]
            : options.targetModificationNoRefs
              ? ['scripts/ai-tdd-contract-gate.ts', 'tests/acceptance/ai-tdd-contract-gate.test.ts']
              : [
                  {
                    id: 'TARGET-MOD-001',
                    path: 'scripts/ai-tdd-contract-gate.ts',
                    ...(options.targetModificationTraceRefsMissing
                      ? {}
                      : {
                          traceRows: [
                            options.targetModificationBrokenRefs ? 'TRACE-MISSING' : 'TRACE-001',
                          ],
                        }),
                    ...(options.targetModificationEvidenceRefsMissing
                      ? {}
                      : {
                          evidenceRefs: [
                            options.targetModificationBrokenRefs ? 'EVD-MISSING' : 'EVD-001',
                          ],
                        }),
                  },
                  {
                    id: 'TARGET-MOD-002',
                    path: 'tests/acceptance/ai-tdd-contract-gate.test.ts',
                    ...(options.targetModificationTraceRefsMissing
                      ? {}
                      : {
                          traceRows: [
                            options.targetModificationBrokenRefs ? 'TRACE-MISSING' : 'TRACE-001',
                          ],
                        }),
                    ...(options.targetModificationEvidenceRefsMissing
                      ? {}
                      : {
                          evidenceRefs: [
                            options.targetModificationBrokenRefs ? 'EVD-MISSING' : 'EVD-001',
                          ],
                        }),
                  },
                ],
        }),
    ...(options.omitAcceptance
      ? {}
      : {
          ...(options.omitAcc
            ? {}
            : {
                acceptanceTests: [
                  {
                    id: 'ACC-001',
                    file: testPathRef,
                    covers: [options.accCoversNegOnly ? 'NEG-001' : 'MUST-001'],
                    ...(options.omitErrorCaseAcceptanceRefs
                      ? {}
                      : { failurePathRefs: ['FAIL-001'], edgeCaseRefs: ['EDGE-001'] }),
                    traceRows: ['TRACE-001'],
                    evidenceRefs: ['EVD-001'],
                    commandRefs: ['CMD-001'],
                    expectedPreImplementationState: options.acceptanceState ?? 'expected_red',
                    oracle: 'fixture acceptance oracle',
                    ...(options.mockOnly ? { mockOnly: true } : {}),
                  },
                ],
              }),
          ...(options.omitE2e
            ? {}
            : {
                e2eSuites: [
                  {
                    id: 'E2E-001',
                    file: e2eTestPathRef,
                    covers: ['NEG-001'],
                    ...(options.omitErrorCaseAcceptanceRefs
                      ? {}
                      : { failurePathRefs: ['FAIL-001'], edgeCaseRefs: ['EDGE-001'] }),
                    traceRows: ['TRACE-001'],
                    evidenceRefs: ['EVD-001'],
                    commandRefs: ['CMD-002'],
                    negativeControls: ['NEG-001'],
                    expectedPreImplementationState: options.acceptanceState ?? 'expected_red',
                    oracle: 'fixture e2e negative-control oracle',
                  },
                ],
              }),
        }),
  };
  const base = path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'REQ-AI-TDD');
  const recordPath = path.join(base, 'requirement-record.json');
  const commandAttempt = options.staleAttempt ? 'old-attempt' : ATTEMPT;
  const reverseAuditReady = options.reverseAuditReady ?? true;
  const artifactRef = {
    artifactType: 'report',
    path: targetPath.replace(/\\/gu, '/'),
    ...(reverseAuditReady
      ? { contentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111' }
      : {}),
    producer: 'ai-tdd-fixture',
    sourceOfTruthRole: 'evidence',
    status: 'active',
    relatedRequirementIds: ['TRACE-001', 'EVD-001'],
  };
  const record = {
    recordId: 'REQ-AI-TDD',
    requirementSetId: 'REQ-AI-TDD',
    status: 'user_confirmed',
    sourcePath,
    implementationConfirmationHash: implementationConfirmationHash(confirmation),
    closeout: { currentAttemptId: ATTEMPT },
    aiTddContractGate: { required: true },
    executionIterations: [
      {
        executionIterationId: 'exec-ai-tdd',
        traceRows: reverseAuditReady ? ['TRACE-001'] : [],
        evidenceRefs: reverseAuditReady ? ['EVD-001'] : [],
        commandRunRefs: [
          {
            commandId: 'CMD-001',
            closeoutAttemptId: commandAttempt,
            runId: 'run-ai-tdd',
            exitCode: 0,
          },
          {
            commandId: 'CMD-002',
            closeoutAttemptId: commandAttempt,
            runId: 'run-ai-tdd-e2e',
            exitCode: 0,
          },
          ...(options.manifestProjectionAddsCommand
            ? [
                {
                  commandId: 'CMD-003',
                  closeoutAttemptId: commandAttempt,
                  runId: 'run-ai-tdd-closeout-review',
                  exitCode: 0,
                },
              ]
            : []),
        ],
      },
    ],
    deliveryEvidence: {
      requiredCommands: [
        {
          commandId: 'CMD-001',
          closeoutAttemptId: commandAttempt,
          ...(options.exitCodeOnly ? {} : { artifactRefs: [artifactRef] }),
        },
          {
            commandId: 'CMD-002',
            closeoutAttemptId: commandAttempt,
            ...(options.exitCodeOnly ? {} : { artifactRefs: [artifactRef] }),
          },
          ...(options.manifestProjectionAddsCommand
            ? [
                {
                  commandId: 'CMD-003',
                  closeoutAttemptId: commandAttempt,
                  ...(options.exitCodeOnly ? {} : { artifactRefs: [artifactRef] }),
                },
              ]
            : []),
        ],
      },
    artifactIndex: [artifactRef],
  };
  writeJson(recordPath, record);
  return { sourcePath, record, recordPath, testPath, e2eTestPath };
}

describe('ai tdd contract gate', () => {
  it('blocks unconfirmed source in pre-implementation mode', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'ai-tdd-unconfirmed-'));
    try {
      const fixture = writeFixture(root, { status: 'draft' });
      const report = evaluateAiTddContractGate({
        sourcePath: fixture.sourcePath,
        record: fixture.record,
        recordPath: fixture.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
      });
      expect(report.decision).toBe('blocked');
      expect(report.blockingReasons).toContain(
        'source_implementation_confirmation_not_user_confirmed'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks when MUST or NEG lacks acceptance/e2e coverage', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'ai-tdd-missing-acceptance-'));
    try {
      const fixture = writeFixture(root, { omitAcceptance: true, nonTestCommand: true });
      const report = evaluateAiTddContractGate({
        sourcePath: fixture.sourcePath,
        record: fixture.record,
        recordPath: fixture.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
      });
      expect(report.decision).toBe('blocked');
      expect(report.blockingReasons).toContain('missing_test_plan_blocked');
      expect(reportArray(reportObject(report, 'missingTestPlan'), 'missingCoverage')).toHaveLength(
        2
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks when required command names a missing test file', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'ai-tdd-missing-test-'));
    try {
      const fixture = writeFixture(root, { missingTest: true });
      const report = evaluateAiTddContractGate({
        sourcePath: fixture.sourcePath,
        record: fixture.record,
        recordPath: fixture.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
      });
      expect(report.decision).toBe('blocked');
      expect(report.blockingReasons).toContain('acceptance_test_file_missing');
      expect(
        reportArray(report, 'redGreenMatrix').some((row) => row.currentState === 'missing_test')
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('uses manifest projection closeoutProof required commands before legacy preview mirror', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'ai-tdd-closeout-proof-projection-'));
    try {
      const fixture = writeFixture(root, { manifestProjectionAddsCommand: true });
      const report = evaluateAiTddContractGate({
        sourcePath: fixture.sourcePath,
        record: fixture.record,
        recordPath: fixture.recordPath,
        mode: 'pre-rerun',
        attemptId: ATTEMPT,
      });
      expect(
        reportObject(reportObject(report, 'contractExecutionManifest'), 'closeoutProof')
      ).toMatchObject({
        ready: true,
        decision: 'pass',
        requiredCommands: ['CMD-001', 'CMD-002', 'CMD-003'],
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('normalizes generated closeoutProof required commands from command targets when projection omits a required command', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'ai-tdd-closeout-proof-normalize-'));
    try {
      const fixture = writeFixture(root, { manifestProjectionOmitsCommand: true });
      const report = evaluateAiTddContractGate({
        sourcePath: fixture.sourcePath,
        record: fixture.record,
        recordPath: fixture.recordPath,
        mode: 'pre-rerun',
        attemptId: ATTEMPT,
      });
      expect(
        reportObject(reportObject(report, 'contractExecutionManifest'), 'closeoutProof')
      ).toMatchObject({
        ready: true,
        decision: 'pass',
        requiredCommands: ['CMD-001', 'CMD-002', 'CMD-003'],
        projectionRequiredCommands: ['CMD-001', 'CMD-002'],
        normalizedFromCommandTargets: ['CMD-003'],
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('resolves project-root relative test paths from nested requirement sources', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'ai-tdd-project-root-paths-'));
    try {
      const fixture = writeFixture(root, {
        projectRootRelativeTestPaths: true,
        sourceInRequirementsDir: true,
      });
      const record = {
        ...fixture.record,
        aiTddContractGate: {
          ...(fixture.record.aiTddContractGate as Record<string, unknown>),
          preImplementationRedProofs: [
            {
              proofId: 'proof-acc-001',
              acceptanceId: 'ACC-001',
              commandId: 'CMD-001',
              state: 'expected_red',
              oracle: 'controlled acceptance red proof oracle',
              failureClass: 'oracle_failure',
            },
            {
              proofId: 'proof-e2e-001',
              acceptanceId: 'E2E-001',
              commandId: 'CMD-002',
              state: 'expected_red',
              oracle: 'controlled e2e red proof oracle',
              failureClass: 'oracle_failure',
            },
          ],
        },
      };
      const report = evaluateAiTddContractGate({
        sourcePath: fixture.sourcePath,
        record,
        recordPath: fixture.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
      });
      expect(report.blockingReasons).not.toContain('acceptance_test_file_missing');
      expect(report.blockingReasons).not.toContain(
        'required_command_file_missing:tests/acceptance/ai-tdd-fixture.test.ts'
      );
      expect(report.blockingReasons).not.toContain(
        'required_command_file_missing:tests/e2e/ai-tdd-fixture.e2e.test.ts'
      );
      expect(report.decision, JSON.stringify(report.blockingReasons)).toBe('pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('uses traceRows.covers as reverse coverage for NEG trace refs', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'ai-tdd-neg-reverse-trace-'));
    try {
      const fixture = writeFixture(root, { omitNotDoneTraceRefs: true });
      const report = evaluateAiTddContractGate({
        sourcePath: fixture.sourcePath,
        record: {
          ...fixture.record,
          aiTddContractGate: {
            preImplementationRedProofs: [
              {
                acceptanceId: 'ACC-001',
                commandId: 'CMD-001',
                state: 'expected_red',
                oracle: 'controlled acceptance red proof oracle',
                failureClass: 'oracle_failure',
              },
              {
                acceptanceId: 'E2E-001',
                commandId: 'CMD-002',
                state: 'expected_red',
                oracle: 'controlled e2e red proof oracle',
                failureClass: 'oracle_failure',
              },
            ],
          },
        },
        recordPath: fixture.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
      });
      expect(report.blockingReasons).not.toContain('requirement_trace_refs_missing');
      expect(report.decision, JSON.stringify(report.blockingReasons)).toBe('pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('treats artifactAutomationPlan.artifactId as a resolvable artifact alias', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'ai-tdd-artifact-id-alias-'));
    try {
      const fixture = writeFixture(root, { artifactIdOnly: true });
      const report = evaluateAiTddContractGate({
        sourcePath: fixture.sourcePath,
        record: {
          ...fixture.record,
          aiTddContractGate: {
            preImplementationRedProofs: [
              {
                acceptanceId: 'ACC-001',
                commandId: 'CMD-001',
                state: 'expected_red',
                oracle: 'controlled acceptance red proof oracle',
                failureClass: 'oracle_failure',
              },
              {
                acceptanceId: 'E2E-001',
                commandId: 'CMD-002',
                state: 'expected_red',
                oracle: 'controlled e2e red proof oracle',
                failureClass: 'oracle_failure',
              },
            ],
          },
        },
        recordPath: fixture.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
      });
      expect(report.blockingReasons).not.toContain('artifact_ref_missing');
      expect(report.blockingReasons).not.toContain('orphan_artifact');
      expect(report.decision, JSON.stringify(report.blockingReasons)).toBe('pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('includes projection artifact plan rows when they are explicitly referenced by evidence', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'ai-tdd-projection-artifact-role-'));
    try {
      const fixture = writeFixture(root, { artifactIdOnly: true, projectionArtifactRole: true });
      const report = evaluateAiTddContractGate({
        sourcePath: fixture.sourcePath,
        record: {
          ...fixture.record,
          aiTddContractGate: {
            preImplementationRedProofs: [
              {
                acceptanceId: 'ACC-001',
                commandId: 'CMD-001',
                state: 'expected_red',
                oracle: 'controlled acceptance red proof oracle',
                failureClass: 'oracle_failure',
              },
              {
                acceptanceId: 'E2E-001',
                commandId: 'CMD-002',
                state: 'expected_red',
                oracle: 'controlled e2e red proof oracle',
                failureClass: 'oracle_failure',
              },
            ],
          },
        },
        recordPath: fixture.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
      });
      expect(report.blockingReasons).not.toContain('artifact_ref_missing');
      expect(report.blockingReasons).not.toContain('orphan_artifact');
      expect(report.decision, JSON.stringify(report.blockingReasons)).toBe('pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('treats contract-bound report artifacts as resolvable evidence targets', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'ai-tdd-report-artifact-target-'));
    try {
      const fixture = writeFixture(root, { artifactIdOnly: true });
      const reportArtifactPath = path.join(root, 'evidence', 'report-artifact.json');
      const source = sourceText({
        artifactIdOnly: true,
        targetPath: path.join(root, 'evidence', 'target.json'),
        testPath: fixture.testPath,
        e2eTestPath: fixture.e2eTestPath,
      })
        .replace(
          '      artifactRefs: [ART-001, scripts/ai-tdd-contract-gate.ts]',
          '      artifactRefs: [ART-REPORT, ART-001, scripts/ai-tdd-contract-gate.ts]'
        )
        .replace(
          '      artifactRefs: [ART-001, scripts/ai-tdd-contract-gate.ts]',
          '      artifactRefs: [ART-REPORT, ART-001, scripts/ai-tdd-contract-gate.ts]'
        )
        .replace(
          '  currentTargetMap:',
          [
            '    - artifactId: ART-REPORT',
            '      artifactType: test_report',
            `      path: ${reportArtifactPath.replace(/\\/gu, '/')}`,
            '      producer: vitest',
            '      sourceOfTruthRole: evidence',
            '      traceRows: [TRACE-001]',
            '      evidenceRefs: [EVD-001]',
            '      projectionStatus: synchronized',
            '  currentTargetMap:',
          ].join('\n')
        );
      writeText(fixture.sourcePath, source);
      writeJson(reportArtifactPath, { ok: true });
      const report = evaluateAiTddContractGate({
        sourcePath: fixture.sourcePath,
        record: {
          ...fixture.record,
          aiTddContractGate: {
            preImplementationRedProofs: [
              {
                acceptanceId: 'ACC-001',
                commandId: 'CMD-001',
                state: 'expected_red',
                oracle: 'controlled acceptance red proof oracle',
                failureClass: 'oracle_failure',
              },
              {
                acceptanceId: 'E2E-001',
                commandId: 'CMD-002',
                state: 'expected_red',
                oracle: 'controlled e2e red proof oracle',
                failureClass: 'oracle_failure',
              },
            ],
          },
        },
        recordPath: fixture.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
      });
      expect(report.blockingReasons).not.toContain('artifact_ref_missing');
      expect(report.blockingReasons).not.toContain('orphan_artifact');
      expect(report.decision, JSON.stringify(report.blockingReasons)).toBe('pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('accepts NEG coverage through ACC rows without requiring direct E2E coverage', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'ai-tdd-neg-acc-coverage-'));
    try {
      const fixture = writeFixture(root, {
        accCoversNegOnly: true,
        omitE2e: true,
      });
      const report = evaluateAiTddContractGate({
        sourcePath: fixture.sourcePath,
        record: {
          ...fixture.record,
          aiTddContractGate: {
            preImplementationRedProofs: [
              {
                acceptanceId: 'ACC-001',
                commandId: 'CMD-001',
                state: 'expected_red',
                oracle: 'controlled acceptance red proof oracle',
                failureClass: 'oracle_failure',
              },
            ],
          },
        },
        recordPath: fixture.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
      });
      expect(report.blockingReasons).not.toContain('neg_e2e_coverage_missing');
      const contractCompletenessReport = report.contractCompletenessReport as {
        blockingReasons: string[];
      };
      expect(contractCompletenessReport.blockingReasons).not.toContain('neg_e2e_coverage_missing');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('treats trace canonicalSurfaceRefs as artifact binding for canonical surfaces', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'ai-tdd-canonical-surface-binding-'));
    try {
      const fixture = writeFixture(root, {
        artifactIdOnly: true,
        canonicalSurfaceOnly: true,
      });
      const report = evaluateAiTddContractGate({
        sourcePath: fixture.sourcePath,
        record: {
          ...fixture.record,
          aiTddContractGate: {
            preImplementationRedProofs: [
              {
                acceptanceId: 'ACC-001',
                commandId: 'CMD-001',
                state: 'expected_red',
                oracle: 'controlled acceptance red proof oracle',
                failureClass: 'oracle_failure',
              },
              {
                acceptanceId: 'E2E-001',
                commandId: 'CMD-002',
                state: 'expected_red',
                oracle: 'controlled e2e red proof oracle',
                failureClass: 'oracle_failure',
              },
            ],
          },
        },
        recordPath: fixture.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
      });
      expect(report.blockingReasons).not.toContain('orphan_artifact');
      expect(report.decision, JSON.stringify(report.blockingReasons)).toBe('pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks incomplete contracts before any mode-specific readiness can pass', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'ai-tdd-contract-completeness-'));
    try {
      const missingTargetPaths = writeFixture(path.join(root, 'missing-target-paths'), {
        omitTargetModificationPaths: true,
      });
      const missingTargetPathsReport = evaluateAiTddContractGate({
        sourcePath: missingTargetPaths.sourcePath,
        record: missingTargetPaths.record,
        recordPath: missingTargetPaths.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
      });
      expect(missingTargetPathsReport.decision).toBe('blocked');
      expect(missingTargetPathsReport.blockingReasons).toContain(
        'contract_completeness_report_blocked'
      );
      expect(missingTargetPathsReport.blockingReasons).toContain(
        'target_modification_paths_missing'
      );
      expect(reportObject(missingTargetPathsReport, 'contractCompletenessReport')).toMatchObject({
        ready: false,
        decision: 'blocked',
      });
      expect(
        reportObject(
          reportObject(missingTargetPathsReport, 'contractExecutionManifest'),
          'targetModificationPathCoverage'
        )
      ).toMatchObject({
        ready: false,
        decision: 'blocked',
        blockingReasons: expect.arrayContaining(['target_modification_paths_missing']),
      });

      const brokenRefs = writeFixture(path.join(root, 'broken-refs'), { brokenRefs: true });
      const brokenRefsReport = evaluateAiTddContractGate({
        sourcePath: brokenRefs.sourcePath,
        record: brokenRefs.record,
        recordPath: brokenRefs.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
      });
      expect(brokenRefsReport.blockingReasons).toEqual(
        expect.arrayContaining(['requirement_ref_missing', 'acceptance_or_e2e_coverage_missing'])
      );
      expect(
        reportArray(reportObject(brokenRefsReport, 'contractCompletenessReport'), 'issues')
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: 'ACC',
            code: 'requirement_ref_missing',
            ref: 'MUST-MISSING',
          }),
          expect.objectContaining({
            category: 'E2E',
            code: 'requirement_ref_missing',
            ref: 'NEG-MISSING',
          }),
        ])
      );

      const missingRequirementRefs = writeFixture(path.join(root, 'missing-requirement-refs'), {
        omitRequirementRefs: true,
      });
      const missingRequirementRefsReport = evaluateAiTddContractGate({
        sourcePath: missingRequirementRefs.sourcePath,
        record: missingRequirementRefs.record,
        recordPath: missingRequirementRefs.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
      });
      expect(
        reportArray(
          reportObject(missingRequirementRefsReport, 'contractCompletenessReport'),
          'issues'
        )
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ category: 'MUST', code: 'requirement_evidence_refs_missing' }),
          expect.objectContaining({ category: 'NEG', code: 'requirement_evidence_refs_missing' }),
        ])
      );

      const missingDirectAndReverseTraceRefs = writeFixture(
        path.join(root, 'missing-direct-and-reverse-trace-refs'),
        {
          omitNotDoneTraceRefs: true,
          omitTraceRowCovers: true,
        }
      );
      const missingDirectAndReverseTraceRefsReport = evaluateAiTddContractGate({
        sourcePath: missingDirectAndReverseTraceRefs.sourcePath,
        record: missingDirectAndReverseTraceRefs.record,
        recordPath: missingDirectAndReverseTraceRefs.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
      });
      expect(
        reportArray(
          reportObject(missingDirectAndReverseTraceRefsReport, 'contractCompletenessReport'),
          'issues'
        )
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ category: 'NEG', code: 'requirement_trace_refs_missing' }),
        ])
      );

      const missingFailureNegRefs = writeFixture(path.join(root, 'missing-failure-neg-refs'), {
        omitFailureNegRefs: true,
      });
      const missingFailureNegRefsReport = evaluateAiTddContractGate({
        sourcePath: missingFailureNegRefs.sourcePath,
        record: missingFailureNegRefs.record,
        recordPath: missingFailureNegRefs.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
      });
      expect(
        reportArray(
          reportObject(missingFailureNegRefsReport, 'contractCompletenessReport'),
          'issues'
        )
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: 'FAIL',
            code: 'failure_path_neg_refs_missing',
            id: 'FAIL-001',
          }),
        ])
      );

      const missingEdgeFailureRefs = writeFixture(path.join(root, 'missing-edge-failure-refs'), {
        omitFailureNegRefs: true,
        omitEdgeFailureRefs: true,
      });
      const missingEdgeFailureRefsReport = evaluateAiTddContractGate({
        sourcePath: missingEdgeFailureRefs.sourcePath,
        record: missingEdgeFailureRefs.record,
        recordPath: missingEdgeFailureRefs.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
      });
      expect(
        reportArray(
          reportObject(missingEdgeFailureRefsReport, 'contractCompletenessReport'),
          'issues'
        )
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: 'EDGE',
            code: 'edge_case_failure_or_neg_missing',
            id: 'EDGE-001',
          }),
        ])
      );

      const missingErrorCaseAcceptanceRefs = writeFixture(
        path.join(root, 'missing-error-case-acceptance-refs'),
        {
          omitErrorCaseAcceptanceRefs: true,
        }
      );
      const missingErrorCaseAcceptanceRefsReport = evaluateAiTddContractGate({
        sourcePath: missingErrorCaseAcceptanceRefs.sourcePath,
        record: missingErrorCaseAcceptanceRefs.record,
        recordPath: missingErrorCaseAcceptanceRefs.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
      });
      expect(
        reportArray(
          reportObject(missingErrorCaseAcceptanceRefsReport, 'contractCompletenessReport'),
          'issues'
        )
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: 'FAIL',
            code: 'failure_path_acceptance_coverage_missing',
            id: 'FAIL-001',
          }),
          expect.objectContaining({
            category: 'EDGE',
            code: 'edge_case_acceptance_coverage_missing',
            id: 'EDGE-001',
          }),
        ])
      );

      const missingCloseoutPreview = writeFixture(path.join(root, 'missing-closeout-preview'), {
        omitCloseoutPreview: true,
      });
      const missingCloseoutPreviewReport = evaluateAiTddContractGate({
        sourcePath: missingCloseoutPreview.sourcePath,
        record: missingCloseoutPreview.record,
        recordPath: missingCloseoutPreview.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
      });
      expect(
        reportArray(
          reportObject(missingCloseoutPreviewReport, 'contractCompletenessReport'),
          'issues'
        )
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: 'CLOSEOUT_PROOF',
            code: 'closeout_proof_policies_missing',
          }),
        ])
      );

      const missingLegacyRefs = writeFixture(path.join(root, 'missing-legacy-refs'), {
        omitLegacyRefs: true,
      });
      const missingLegacyRefsReport = evaluateAiTddContractGate({
        sourcePath: missingLegacyRefs.sourcePath,
        record: missingLegacyRefs.record,
        recordPath: missingLegacyRefs.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
      });
      expect(
        reportArray(reportObject(missingLegacyRefsReport, 'contractCompletenessReport'), 'issues')
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: 'LEGACY_DENIAL',
            code: 'legacy_denial_refs_missing',
          }),
        ])
      );

      const missingAcc = writeFixture(path.join(root, 'missing-acc'), { omitAcc: true });
      const missingAccReport = evaluateAiTddContractGate({
        sourcePath: missingAcc.sourcePath,
        record: missingAcc.record,
        recordPath: missingAcc.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
      });
      expect(
        reportArray(reportObject(missingAccReport, 'contractCompletenessReport'), 'issues')
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ category: 'ACC', code: 'acceptance_tests_missing' }),
        ])
      );

      const missingTargetRefs = writeFixture(path.join(root, 'missing-target-refs'), {
        targetModificationNoRefs: true,
      });
      const missingTargetRefsReport = evaluateAiTddContractGate({
        sourcePath: missingTargetRefs.sourcePath,
        record: missingTargetRefs.record,
        recordPath: missingTargetRefs.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
      });
      expect(
        reportArray(reportObject(missingTargetRefsReport, 'contractCompletenessReport'), 'issues')
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: 'targetModificationPaths',
            code: 'target_modification_trace_refs_missing',
          }),
          expect.objectContaining({
            category: 'targetModificationPaths',
            code: 'target_modification_evidence_refs_missing',
          }),
        ])
      );
      expect(
        reportObject(
          reportObject(missingTargetRefsReport, 'contractExecutionManifest'),
          'targetModificationPathCoverage'
        )
      ).toMatchObject({
        ready: false,
        decision: 'blocked',
        blockingReasons: expect.arrayContaining([
          'target_modification_trace_refs_missing',
          'target_modification_evidence_refs_missing',
        ]),
      });

      const missingTraceRefs = writeFixture(path.join(root, 'missing-target-trace-refs'), {
        targetModificationTraceRefsMissing: true,
      });
      const missingTraceRefsReport = evaluateAiTddContractGate({
        sourcePath: missingTraceRefs.sourcePath,
        record: missingTraceRefs.record,
        recordPath: missingTraceRefs.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
      });
      expect(
        reportObject(
          reportObject(missingTraceRefsReport, 'contractExecutionManifest'),
          'targetModificationPathCoverage'
        )
      ).toMatchObject({
        ready: false,
        decision: 'blocked',
        blockingReasons: expect.arrayContaining(['target_modification_trace_refs_missing']),
      });

      const missingEvidenceRefs = writeFixture(path.join(root, 'missing-target-evidence-refs'), {
        targetModificationEvidenceRefsMissing: true,
      });
      const missingEvidenceRefsReport = evaluateAiTddContractGate({
        sourcePath: missingEvidenceRefs.sourcePath,
        record: missingEvidenceRefs.record,
        recordPath: missingEvidenceRefs.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
      });
      expect(
        reportObject(
          reportObject(missingEvidenceRefsReport, 'contractExecutionManifest'),
          'targetModificationPathCoverage'
        )
      ).toMatchObject({
        ready: false,
        decision: 'blocked',
        blockingReasons: expect.arrayContaining(['target_modification_evidence_refs_missing']),
      });

      const missingTargetPath = writeFixture(path.join(root, 'missing-target-path'), {
        targetModificationMissingPath: true,
      });
      const missingTargetPathReport = evaluateAiTddContractGate({
        sourcePath: missingTargetPath.sourcePath,
        record: missingTargetPath.record,
        recordPath: missingTargetPath.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
      });
      expect(
        reportObject(
          reportObject(missingTargetPathReport, 'contractExecutionManifest'),
          'targetModificationPathCoverage'
        )
      ).toMatchObject({
        ready: false,
        decision: 'blocked',
        blockingReasons: expect.arrayContaining(['target_modification_path_missing']),
      });
      expect(
        reportArray(reportObject(missingTargetPathReport, 'contractCompletenessReport'), 'issues')
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: 'targetModificationPaths',
            code: 'target_modification_path_missing',
          }),
        ])
      );

      const brokenTargetRefs = writeFixture(path.join(root, 'broken-target-refs'), {
        targetModificationBrokenRefs: true,
      });
      const brokenTargetRefsReport = evaluateAiTddContractGate({
        sourcePath: brokenTargetRefs.sourcePath,
        record: brokenTargetRefs.record,
        recordPath: brokenTargetRefs.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
      });
      expect(
        reportArray(reportObject(brokenTargetRefsReport, 'contractCompletenessReport'), 'issues')
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: 'targetModificationPaths',
            code: 'trace_ref_missing',
            ref: 'TRACE-MISSING',
          }),
          expect.objectContaining({
            category: 'targetModificationPaths',
            code: 'evidence_ref_missing',
            ref: 'EVD-MISSING',
          }),
        ])
      );
      expect(
        reportObject(
          reportObject(brokenTargetRefsReport, 'contractExecutionManifest'),
          'targetModificationPathCoverage'
        )
      ).toMatchObject({
        ready: false,
        decision: 'blocked',
        blockingReasons: expect.arrayContaining(['trace_ref_missing', 'evidence_ref_missing']),
      });

      const orphanRows = writeFixture(path.join(root, 'orphan-rows'), { includeOrphans: true });
      const orphanReport = evaluateAiTddContractGate({
        sourcePath: orphanRows.sourcePath,
        record: orphanRows.record,
        recordPath: orphanRows.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
      });
      expect(
        reportArray(reportObject(orphanReport, 'contractCompletenessReport'), 'issues')
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ category: 'EVD', code: 'orphan_evidence', id: 'EVD-ORPHAN' }),
          expect.objectContaining({ category: 'CMD', code: 'orphan_command', id: 'CMD-ORPHAN' }),
          expect.objectContaining({ category: 'ART', code: 'orphan_artifact', id: 'ART-ORPHAN' }),
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks NEG without negative-control oracle', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'ai-tdd-missing-neg-oracle-'));
    try {
      const fixture = writeFixture(root, { omitNegativeOracle: true });
      const report = evaluateAiTddContractGate({
        sourcePath: fixture.sourcePath,
        record: fixture.record,
        recordPath: fixture.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
      });
      expect(report.decision).toBe('blocked');
      expect(report.blockingReasons).toContain('negative_control_plan_blocked');
      expect(reportArray(reportObject(report, 'negativeControlPlan'), 'withoutOracle')).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 'NEG-001' })])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks source-declared expected red, unexpected green, and invalid red before implementation', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'ai-tdd-red-states-'));
    try {
      const expected = writeFixture(path.join(root, 'expected'), {
        acceptanceState: 'expected_red',
      });
      const expectedReport = evaluateAiTddContractGate({
        sourcePath: expected.sourcePath,
        record: expected.record,
        recordPath: expected.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
      });
      expect(expectedReport.decision).toBe('blocked');
      expect(expectedReport.blockingReasons).toContain('pre_implementation_red_proof_missing');
      expect(expectedReport.blockingReasons).toContain(
        'pre_implementation_valid_expected_red_missing'
      );
      expect(reportObject(expectedReport, 'preImplementationReadinessReport').ready).toBe(false);
      expect(reportObject(expectedReport, 'closeoutReadinessReport').ready).toBe(false);

      const green = writeFixture(path.join(root, 'green'), { acceptanceState: 'unexpected_green' });
      const greenReport = evaluateAiTddContractGate({
        sourcePath: green.sourcePath,
        record: green.record,
        recordPath: green.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
      });
      expect(greenReport.decision).toBe('blocked');
      expect(greenReport.blockingReasons).toContain('pre_implementation_red_proof_missing');
      expect(greenReport.blockingReasons).not.toContain('unexpected_green');

      const invalid = writeFixture(path.join(root, 'invalid'), { acceptanceState: 'invalid_red' });
      const invalidReport = evaluateAiTddContractGate({
        sourcePath: invalid.sourcePath,
        record: invalid.record,
        recordPath: invalid.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
      });
      expect(invalidReport.decision).toBe('blocked');
      expect(invalidReport.blockingReasons).toContain('pre_implementation_red_proof_missing');
      expect(invalidReport.blockingReasons).not.toContain('invalid_red');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('uses controlled pre-implementation red proof ingest instead of expected-state self declaration', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'ai-tdd-controlled-red-proof-'));
    try {
      const fixture = writeFixture(root, { acceptanceState: 'unexpected_green' });
      const record = {
        ...fixture.record,
        aiTddContractGate: {
          ...(fixture.record.aiTddContractGate as Record<string, unknown>),
          preImplementationRedProofs: [
            {
              proofId: 'proof-acc-001',
              acceptanceId: 'ACC-001',
              commandId: 'CMD-001',
              state: 'expected_red',
              oracle: 'controlled acceptance red proof oracle',
              failureClass: 'oracle_failure',
              recordedAt: '2026-05-25T00:00:00.000Z',
              recordedBy: 'test-agent',
            },
            {
              proofId: 'proof-e2e-001',
              acceptanceId: 'E2E-001',
              commandId: 'CMD-002',
              state: 'expected_red',
              oracle: 'controlled e2e red proof oracle',
              failureClass: 'oracle_failure',
              recordedAt: '2026-05-25T00:00:00.000Z',
              recordedBy: 'test-agent',
            },
          ],
        },
      };
      const report = evaluateAiTddContractGate({
        sourcePath: fixture.sourcePath,
        record,
        recordPath: fixture.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
      });
      expect(report.decision, JSON.stringify(report.blockingReasons)).toBe('pass');
      expect(reportObject(report, 'preImplementationReadinessReport')).toMatchObject({
        ready: true,
        validExpectedRed: true,
        closeoutReady: false,
      });
      expect(reportObject(report, 'closeoutReadinessReport')).toMatchObject({
        ready: false,
        notReadyReason: 'implementation_not_started',
      });
      expect(report.blockingReasons).not.toContain('unexpected_green');
      expect(reportArray(report, 'redGreenMatrix')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'ACC-001',
            currentState: 'expected_red',
            refs: expect.arrayContaining([
              'proof:record.aiTddContractGate.preImplementationRedProofs',
            ]),
          }),
          expect.objectContaining({
            id: 'E2E-001',
            category: 'E2E',
            currentState: 'expected_red',
          }),
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('can execute real old-implementation red proof commands when explicitly enabled', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'ai-tdd-execute-red-proof-'));
    try {
      const fixture = writeFixture(root);
      writeText(
        path.join(root, 'red-proof.js'),
        'process.stderr.write("oracle failed\\n"); process.exit(1);\n'
      );
      const source = readFileSync(fixture.sourcePath, 'utf8')
        .replace(
          /npx vitest run [^\n]+ai-tdd-fixture\.test\.ts/gu,
          `node ${path.join(root, 'red-proof.js').replace(/\\/gu, '/')}`
        )
        .replace(
          /npx vitest run [^\n]+ai-tdd-fixture\.e2e\.test\.ts/gu,
          `node ${path.join(root, 'red-proof.js').replace(/\\/gu, '/')}`
        );
      writeText(fixture.sourcePath, source);
      const report = evaluateAiTddContractGate({
        sourcePath: fixture.sourcePath,
        record: fixture.record,
        recordPath: fixture.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
        executeRedProof: true,
        redProofCommandTimeoutMs: 5000,
      });
      expect(reportArray(report, 'redGreenMatrix')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'ACC-001',
            currentState: 'expected_red',
            refs: expect.arrayContaining(['proof:execute_red_proof']),
          }),
          expect.objectContaining({
            id: 'E2E-001',
            currentState: 'expected_red',
            refs: expect.arrayContaining(['proof:execute_red_proof']),
          }),
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks real red proof execution when old implementation unexpectedly passes', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'ai-tdd-execute-unexpected-green-'));
    try {
      const fixture = writeFixture(root);
      writeText(path.join(root, 'green-proof.js'), 'process.exit(0);\n');
      const source = readFileSync(fixture.sourcePath, 'utf8')
        .replace(
          /npx vitest run [^\n]+ai-tdd-fixture\.test\.ts/gu,
          `node ${path.join(root, 'green-proof.js').replace(/\\/gu, '/')}`
        )
        .replace(
          /npx vitest run [^\n]+ai-tdd-fixture\.e2e\.test\.ts/gu,
          `node ${path.join(root, 'green-proof.js').replace(/\\/gu, '/')}`
        );
      writeText(fixture.sourcePath, source);
      const report = evaluateAiTddContractGate({
        sourcePath: fixture.sourcePath,
        record: fixture.record,
        recordPath: fixture.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
        executeRedProof: true,
        redProofCommandTimeoutMs: 5000,
      });
      expect(report.decision).toBe('blocked');
      expect(report.blockingReasons).toContain('unexpected_green');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('marks iteration green as partial only', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'ai-tdd-iteration-'));
    try {
      const fixture = writeFixture(root);
      const report = evaluateAiTddContractGate({
        sourcePath: fixture.sourcePath,
        record: fixture.record,
        recordPath: fixture.recordPath,
        mode: 'iteration',
        attemptId: ATTEMPT,
      });
      expect(reportObject(report, 'closeoutReadinessReport').partialOnly).toBe(true);
      expect(
        reportArray(report, 'redGreenMatrix').some((row) => row.currentState === 'partial_green')
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks closeout for mock-only, exitCode-only, and stale attempt evidence', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'ai-tdd-closeout-invalid-proof-'));
    try {
      const mock = writeFixture(path.join(root, 'mock'), { mockOnly: true });
      const mockReport = evaluateAiTddContractGate({
        sourcePath: mock.sourcePath,
        record: mock.record,
        recordPath: mock.recordPath,
        mode: 'closeout',
        attemptId: ATTEMPT,
      });
      expect(mockReport.blockingReasons).toContain('mock_only_proof_invalid');

      const exitOnly = writeFixture(path.join(root, 'exit'), { exitCodeOnly: true });
      const exitReport = evaluateAiTddContractGate({
        sourcePath: exitOnly.sourcePath,
        record: exitOnly.record,
        recordPath: exitOnly.recordPath,
        mode: 'closeout',
        attemptId: ATTEMPT,
      });
      expect(exitReport.blockingReasons).toContain('exitCode_only_proof');

      const stale = writeFixture(path.join(root, 'stale'), { staleAttempt: true });
      const staleReport = evaluateAiTddContractGate({
        sourcePath: stale.sourcePath,
        record: stale.record,
        recordPath: stale.recordPath,
        mode: 'closeout',
        attemptId: ATTEMPT,
      });
      expect(staleReport.blockingReasons).toContain('stale_attempt');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks closeout when reverse audit delivery readiness is not ready', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'ai-tdd-reverse-audit-'));
    try {
      const fixture = writeFixture(root, { reverseAuditReady: false });
      const report = evaluateAiTddContractGate({
        sourcePath: fixture.sourcePath,
        record: fixture.record,
        recordPath: fixture.recordPath,
        mode: 'closeout',
        attemptId: ATTEMPT,
      });
      expect(report.decision).toBe('blocked');
      expect(
        report.blockingReasons,
        JSON.stringify(
          {
            blockingReasons: report.blockingReasons,
            subReports: report.subReports,
          },
          null,
          2
        )
      ).toContain('reverse_audit_delivery_readiness_not_ready');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes a CLI report with manifest and acceptance/e2e plan', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'ai-tdd-cli-'));
    try {
      const fixture = writeFixture(root);
      const reportPath = path.join(root, 'report.json');
      const code = mainAiTddContractGate([
        '--source',
        fixture.sourcePath,
        '--requirement-record',
        fixture.recordPath,
        '--mode',
        'pre-implementation',
        '--attempt-id',
        ATTEMPT,
        '--report-path',
        reportPath,
        '--json',
      ]);
      expect(code).toBe(1);
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      expect(report.contractExecutionManifest).toMatchObject({
        schemaVersion: 'contract-execution-manifest/v1',
        builderVersion: 'contract-execution-manifest-builder/v1',
        manifestHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
        sourceProjectionHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      });
      expect(report.contractExecutionManifest.acceptanceTests).toHaveLength(1);
      expect(report.contractExecutionManifest.e2eSuites).toHaveLength(1);
      expect(report.contractExecutionManifest.acceptanceSuites).toHaveLength(2);
      expect(report.contractExecutionManifest.errorCaseCoverage).toMatchObject({
        ready: true,
        decision: 'pass',
        summary: {
          failurePathCount: 1,
          edgeCaseCount: 1,
          missingCount: 0,
        },
      });
      expect(report.contractExecutionManifest.commandTargetCollection).toMatchObject({
        ready: true,
        decision: 'pass',
      });
      expect(report.contractExecutionManifest.traceClosureAssertions).toMatchObject({
        ready: true,
        decision: 'pass',
      });
      expect(report.contractExecutionManifest.canonicalSurfaceReconciliation).toMatchObject({
        ready: true,
        decision: 'pass',
      });
      expect(report.contractExecutionManifest.targetModificationPathCoverage).toMatchObject({
        ready: true,
        decision: 'pass',
      });
      expect(report.contractExecutionManifest.legacyDenial).toMatchObject({
        ready: true,
        decision: 'pass',
      });
      expect(report.contractExecutionManifest.closeoutProof).toMatchObject({
        ready: true,
        decision: 'pass',
      });
      expect(report.contractExecutionManifest.evidenceTrustStates).toMatchObject({
        ready: true,
        decision: 'pass',
      });
      expect(report.contractExecutionManifest.closeoutGates).toMatchObject({
        decision: 'pass',
        requiredManifestSections: [
          'commandTargetCollection',
          'traceClosureAssertions',
          'currentTargetMap',
          'targetModificationPathCoverage',
          'canonicalSurfaceReconciliation',
          'legacyDenial',
          'closeoutProof',
          'evidenceTrustStates',
        ],
      });
      expect(report.acceptanceE2eTestPlan.tests.length).toBeGreaterThan(0);
      expect(report.acceptanceE2eTestPlan.e2eSuites.length).toBeGreaterThan(0);
      expect(report.redGreenMatrix.map((row: Record<string, unknown>) => row.category)).toEqual(
        expect.arrayContaining(['MUST', 'NEG', 'OUT', 'EVD', 'TRACE', 'CMD', 'ACC', 'E2E', 'ART'])
      );
      expect(report.preImplementationReadinessReport.ready).toBe(false);
      expect(report.closeoutReadinessReport.ready).toBe(false);
      expect(report.blockingReasons).toContain('pre_implementation_red_proof_missing');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
