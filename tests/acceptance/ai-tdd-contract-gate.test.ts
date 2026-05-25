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
  targetModificationNoRefs?: boolean;
  targetModificationBrokenRefs?: boolean;
  brokenRefs?: boolean;
  omitAcc?: boolean;
  omitE2e?: boolean;
  includeOrphans?: boolean;
  omitRequirementRefs?: boolean;
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
        `      covers: [${input.brokenRefs ? 'MUST-MISSING' : 'MUST-001'}]`,
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
          `      traceRows: [${input.targetModificationBrokenRefs ? 'TRACE-MISSING' : 'TRACE-001'}]`,
          `      evidenceRefs: [${input.targetModificationBrokenRefs ? 'EVD-MISSING' : 'EVD-001'}]`,
          '    - id: TARGET-MOD-002',
          '      path: tests/acceptance/ai-tdd-contract-gate.test.ts',
          `      traceRows: [${input.targetModificationBrokenRefs ? 'TRACE-MISSING' : 'TRACE-001'}]`,
          `      evidenceRefs: [${input.targetModificationBrokenRefs ? 'EVD-MISSING' : 'EVD-001'}]`,
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
    ...(input.omitRequirementRefs ? [] : ['      coveredByTraceRows: [TRACE-001]']),
    '  mustNot:',
    '    - id: OUT-001',
    '      text: Do not mutate source trace rows.',
    '  evidence:',
    '    - id: EVD-001',
    '      text: Acceptance evidence.',
    '      oracle: current-attempt command with artifact evidence',
    '      requiredCommandRefs: [CMD-001, CMD-002]',
    '      artifactRefs: [ART-001]',
    ...orphanRows,
    '  traceRows:',
    '    - id: TRACE-001',
    '      covers: [MUST-001, NEG-001]',
    '      evidenceRefs: [EVD-001]',
    '      deliveryEvidenceCommandRefs: [CMD-001, CMD-002]',
    '      acceptanceRefs: [ACC-001, E2E-001]',
    '      artifactRefs: [ART-001]',
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
    '    - id: ART-001',
    '      artifactType: report',
    `      path: ${targetPath.replace(/\\/gu, '/')}`,
    '      producer: ai-tdd-fixture',
    '      sourceOfTruthRole: evidence',
    '      traceRows: [TRACE-001]',
    '      evidenceRefs: [EVD-001]',
    ...(input.includeOrphans
      ? [
          '    - id: ART-ORPHAN',
          '      artifactType: report',
          '      path: evidence/orphan.json',
          '      producer: ai-tdd-fixture',
          '      sourceOfTruthRole: evidence',
          '      traceRows: [TRACE-001]',
          '      evidenceRefs: [EVD-001]',
        ]
      : []),
    '  currentTargetMap:',
    '    canonicalArtifacts: []',
    '    pathRegistry: []',
    '    existingArtifacts:',
    '      - id: LEGACY-001',
    '        currentPath: legacy_completion_event',
    '        completionProofPolicy: legacy_only',
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
    targetModificationNoRefs?: boolean;
    targetModificationBrokenRefs?: boolean;
    brokenRefs?: boolean;
    omitAcc?: boolean;
    omitE2e?: boolean;
    includeOrphans?: boolean;
    omitRequirementRefs?: boolean;
  } = {}
) {
  const testPath = path.join(root, 'tests', 'acceptance', 'ai-tdd-fixture.test.ts');
  const e2eTestPath = path.join(root, 'tests', 'e2e', 'ai-tdd-fixture.e2e.test.ts');
  if (!options.missingTest) writeText(testPath, 'import { it } from "vitest"; it("ok", () => {});\n');
  if (!options.missingTest) writeText(e2eTestPath, 'import { it } from "vitest"; it("ok", () => {});\n');
  const targetPath = path.join(root, 'evidence', 'target.json');
  writeJson(targetPath, { ok: true });
  const sourcePath = path.join(root, 'source.md');
  writeText(
    sourcePath,
    sourceText({
      status: options.status,
      acceptanceState: options.acceptanceState,
      omitAcceptance: options.omitAcceptance,
      omitNegativeOracle: options.omitNegativeOracle,
      mockOnly: options.mockOnly,
      testPath,
      e2eTestPath,
      targetPath,
      nonTestCommand: options.nonTestCommand,
      omitTargetModificationPaths: options.omitTargetModificationPaths,
      targetModificationNoRefs: options.targetModificationNoRefs,
      targetModificationBrokenRefs: options.targetModificationBrokenRefs,
      brokenRefs: options.brokenRefs,
      omitAcc: options.omitAcc,
      omitE2e: options.omitE2e,
      includeOrphans: options.includeOrphans,
      omitRequirementRefs: options.omitRequirementRefs,
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
        ...(options.omitRequirementRefs ? {} : { coveredByTraceRows: ['TRACE-001'] }),
      },
    ],
    mustNot: [{ id: 'OUT-001', text: 'Do not mutate source trace rows.' }],
    evidence: [
      {
        id: 'EVD-001',
        text: 'Acceptance evidence.',
        oracle: 'current-attempt command with artifact evidence',
        requiredCommandRefs: ['CMD-001'],
        artifactRefs: ['ART-001'],
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
        covers: ['MUST-001', 'NEG-001'],
        evidenceRefs: ['EVD-001'],
        deliveryEvidenceCommandRefs: ['CMD-001', 'CMD-002'],
        acceptanceRefs: ['ACC-001', 'E2E-001'],
        artifactRefs: ['ART-001'],
      },
    ],
    requiredCommands: [
      {
        id: 'CMD-001',
        command: options.nonTestCommand
          ? 'node scripts/non-test-command.js'
          : `npx vitest run ${testPath.replace(/\\/gu, '/')}`,
        oracle: 'fixture acceptance oracle',
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
      },
      {
        id: 'CMD-002',
        command: options.nonTestCommand
          ? 'node scripts/non-test-command.js'
          : `npx vitest run ${e2eTestPath.replace(/\\/gu, '/')}`,
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
    ],
    artifactAutomationPlan: [
      {
        id: 'ART-001',
        artifactType: 'report',
        path: targetPath.replace(/\\/gu, '/'),
        producer: 'ai-tdd-fixture',
        sourceOfTruthRole: 'evidence',
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
      },
      ...(options.includeOrphans
        ? [
            {
              id: 'ART-ORPHAN',
              artifactType: 'report',
              path: 'evidence/orphan.json',
              producer: 'ai-tdd-fixture',
              sourceOfTruthRole: 'evidence',
              traceRows: ['TRACE-001'],
              evidenceRefs: ['EVD-001'],
            },
          ]
        : []),
    ],
    currentTargetMap: {
      canonicalArtifacts: [],
      pathRegistry: [],
      existingArtifacts: [
        {
          id: 'LEGACY-001',
          currentPath: 'legacy_completion_event',
          completionProofPolicy: 'legacy_only',
        },
      ],
    },
    ...(options.omitTargetModificationPaths
      ? {}
      : {
          targetModificationPaths: options.targetModificationNoRefs
            ? [
                'scripts/ai-tdd-contract-gate.ts',
                'tests/acceptance/ai-tdd-contract-gate.test.ts',
              ]
            : [
                {
                  id: 'TARGET-MOD-001',
                  path: 'scripts/ai-tdd-contract-gate.ts',
                  traceRows: [options.targetModificationBrokenRefs ? 'TRACE-MISSING' : 'TRACE-001'],
                  evidenceRefs: [options.targetModificationBrokenRefs ? 'EVD-MISSING' : 'EVD-001'],
                },
                {
                  id: 'TARGET-MOD-002',
                  path: 'tests/acceptance/ai-tdd-contract-gate.test.ts',
                  traceRows: [options.targetModificationBrokenRefs ? 'TRACE-MISSING' : 'TRACE-001'],
                  evidenceRefs: [options.targetModificationBrokenRefs ? 'EVD-MISSING' : 'EVD-001'],
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
                    file: testPath.replace(/\\/gu, '/'),
                    covers: ['MUST-001'],
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
                    file: e2eTestPath.replace(/\\/gu, '/'),
                    covers: ['NEG-001'],
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
  const artifactRef = {
    artifactType: 'report',
    path: targetPath.replace(/\\/gu, '/'),
    contentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
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
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
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
      ],
    },
    artifactIndex: [artifactRef],
  };
  writeJson(recordPath, record);
  return { sourcePath, record, recordPath };
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
      expect(report.blockingReasons).toContain('source_implementation_confirmation_not_user_confirmed');
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
      expect(reportArray(reportObject(report, 'missingTestPlan'), 'missingCoverage')).toHaveLength(2);
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
      expect(reportArray(report, 'redGreenMatrix').some((row) => row.currentState === 'missing_test')).toBe(true);
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
      expect(missingTargetPathsReport.blockingReasons).toContain('contract_completeness_report_blocked');
      expect(missingTargetPathsReport.blockingReasons).toContain('target_modification_paths_missing');
      expect(reportObject(missingTargetPathsReport, 'contractCompletenessReport')).toMatchObject({
        ready: false,
        decision: 'blocked',
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
      expect(reportArray(reportObject(brokenRefsReport, 'contractCompletenessReport'), 'issues')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ category: 'ACC', code: 'requirement_ref_missing', ref: 'MUST-MISSING' }),
          expect.objectContaining({ category: 'E2E', code: 'requirement_ref_missing', ref: 'NEG-MISSING' }),
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
        reportArray(reportObject(missingRequirementRefsReport, 'contractCompletenessReport'), 'issues')
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ category: 'MUST', code: 'requirement_evidence_refs_missing' }),
          expect.objectContaining({ category: 'MUST', code: 'requirement_trace_refs_missing' }),
          expect.objectContaining({ category: 'NEG', code: 'requirement_evidence_refs_missing' }),
          expect.objectContaining({ category: 'NEG', code: 'requirement_trace_refs_missing' }),
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
      expect(reportArray(reportObject(missingAccReport, 'contractCompletenessReport'), 'issues')).toEqual(
        expect.arrayContaining([expect.objectContaining({ category: 'ACC', code: 'acceptance_tests_missing' })])
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
      expect(reportArray(reportObject(missingTargetRefsReport, 'contractCompletenessReport'), 'issues')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: 'targetModificationPaths',
            code: 'target_modification_trace_or_evidence_refs_missing',
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
      expect(reportArray(reportObject(brokenTargetRefsReport, 'contractCompletenessReport'), 'issues')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ category: 'targetModificationPaths', code: 'trace_ref_missing', ref: 'TRACE-MISSING' }),
          expect.objectContaining({ category: 'targetModificationPaths', code: 'evidence_ref_missing', ref: 'EVD-MISSING' }),
        ])
      );

      const orphanRows = writeFixture(path.join(root, 'orphan-rows'), { includeOrphans: true });
      const orphanReport = evaluateAiTddContractGate({
        sourcePath: orphanRows.sourcePath,
        record: orphanRows.record,
        recordPath: orphanRows.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
      });
      expect(reportArray(reportObject(orphanReport, 'contractCompletenessReport'), 'issues')).toEqual(
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
      const expected = writeFixture(path.join(root, 'expected'), { acceptanceState: 'expected_red' });
      const expectedReport = evaluateAiTddContractGate({
        sourcePath: expected.sourcePath,
        record: expected.record,
        recordPath: expected.recordPath,
        mode: 'pre-implementation',
        attemptId: ATTEMPT,
      });
      expect(expectedReport.decision).toBe('blocked');
      expect(expectedReport.blockingReasons).toContain('pre_implementation_red_proof_missing');
      expect(expectedReport.blockingReasons).toContain('pre_implementation_valid_expected_red_missing');
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
            refs: expect.arrayContaining(['proof:record.aiTddContractGate.preImplementationRedProofs']),
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
      writeText(path.join(root, 'red-proof.js'), 'process.stderr.write("oracle failed\\n"); process.exit(1);\n');
      const source = readFileSync(fixture.sourcePath, 'utf8')
        .replace(/npx vitest run [^\n]+ai-tdd-fixture\.test\.ts/gu, `node ${path.join(root, 'red-proof.js').replace(/\\/gu, '/')}`)
        .replace(/npx vitest run [^\n]+ai-tdd-fixture\.e2e\.test\.ts/gu, `node ${path.join(root, 'red-proof.js').replace(/\\/gu, '/')}`);
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
        .replace(/npx vitest run [^\n]+ai-tdd-fixture\.test\.ts/gu, `node ${path.join(root, 'green-proof.js').replace(/\\/gu, '/')}`)
        .replace(/npx vitest run [^\n]+ai-tdd-fixture\.e2e\.test\.ts/gu, `node ${path.join(root, 'green-proof.js').replace(/\\/gu, '/')}`);
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
      expect(reportArray(report, 'redGreenMatrix').some((row) => row.currentState === 'partial_green')).toBe(true);
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
      const fixture = writeFixture(root);
      const report = evaluateAiTddContractGate({
        sourcePath: fixture.sourcePath,
        record: fixture.record,
        recordPath: fixture.recordPath,
        mode: 'closeout',
        attemptId: ATTEMPT,
      });
      expect(report.decision).toBe('blocked');
      expect(report.blockingReasons).toContain('reverse_audit_delivery_readiness_not_ready');
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
      expect(report.contractExecutionManifest.acceptanceTests).toHaveLength(1);
      expect(report.contractExecutionManifest.e2eSuites).toHaveLength(1);
      expect(report.contractExecutionManifest.acceptanceSuites).toHaveLength(2);
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
