import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainRunRequiredCommandsFromAiTddManifest } from '../../scripts/run-required-commands-from-ai-tdd-manifest';

const dynamicRunnerPath = 'scripts/run-required-commands-from-ai-tdd-manifest.ts';
const legacyRunnerPath = 'scripts/run-confirmed-final-required-commands.js';
const finalCloseoutRunnerPath = 'scripts/final-closeout-evidence-runner.ts';

const globalContractTraceabilityPolicy = {
  schemaVersion: 'global-contract-traceability-policy/v1',
  appliesToEntryFlows: ['bugfix', 'standalone_tasks', 'story'],
  contractAuthoringRequired: true,
  taskBindingRequired: true,
  taskBindingDimensions: ['MUST', 'NEG', 'OUT', 'EVD', 'TRACE'],
  missingBindingBehavior: 'fail_closed',
  sourceDocumentHashRequired: true,
  implementationConfirmationHashRequired: true,
  reconfirmOnTraceSemanticChange: true,
  allowUnboundImplementationTask: false,
  taskRegistryField: 'implementationTasks',
  traceTaskRefsMustResolveTo: 'implementationTasks[].id',
  readinessFailureWhenUnresolved: true,
  closeoutFailureWhenUnresolved: true,
};

const traceStatusPolicy = {
  schemaVersion: 'trace-status-policy/v1',
  allowedStatuses: [
    'PENDING',
    'PASS',
    'FAIL',
    'BLOCKED',
    'LINKED_DOWNSTREAM',
    'USER_APPROVED_DEFERRED',
    'USER_APPROVED_OUT_OF_SCOPE',
  ],
  terminalFullCloseoutStatuses: ['PASS', 'FAIL', 'BLOCKED'],
  linkedDownstreamRequiredFields: [
    'downstreamRecordId',
    'downstreamStoryRef',
    'downstreamSourceDocumentPath',
    'downstreamSourceDocumentHash',
    'downstreamScopeSummary',
    'downstreamRequirementIds',
    'downstreamAuditEvidenceRefs',
  ],
  userApprovedDeferredRequiredFields: [
    'userApprovalRef',
    'approvedAt',
    'approvedBy',
    'impactSummary',
    'followUpRecordId',
    'followUpDueCondition',
  ],
  userApprovedOutOfScopeRequiredFields: [
    'userApprovalRef',
    'approvedAt',
    'approvedBy',
    'impactSummary',
    'confirmationDeltaRef',
  ],
  bareDeferredForbidden: true,
  bareOutOfScopeForbidden: true,
  fullCloseoutForUserScopedStatusesForbidden: true,
};

function readText(path: string): string {
  return readFileSync(path, 'utf8');
}

function writeText(filePath: string, value: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, 'utf8');
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function fixture(
  root: string,
  mode:
    | 'valid'
    | 'missing-target-modification-paths'
    | 'missing-path'
    | 'missing-refs'
    | 'missing-trace-refs'
    | 'missing-evidence-refs'
    | 'broken-refs'
) {
  const testFile = path.join(root, 'tests', 'acceptance', 'fixture.test.ts');
  writeText(testFile, 'import { it } from "vitest"; it("runner fixture", () => {});\n');
  const targetPath = 'scripts/run-required-commands-from-ai-tdd-manifest.ts';
  const targetRows =
    mode === 'missing-target-modification-paths'
      ? []
      : mode === 'missing-path'
        ? ['  targetModificationPaths:', '    - id: TARGET-MOD-MISSING-PATH', '      traceRows: [TRACE-001]', '      evidenceRefs: [EVD-001]']
      : mode === 'missing-refs'
        ? ['  targetModificationPaths:', `    - ${targetPath}`]
      : mode === 'missing-trace-refs'
        ? ['  targetModificationPaths:', '    - id: TARGET-MOD-001', `      path: ${targetPath}`, '      evidenceRefs: [EVD-001]']
      : mode === 'missing-evidence-refs'
        ? ['  targetModificationPaths:', '    - id: TARGET-MOD-001', `      path: ${targetPath}`, '      traceRows: [TRACE-001]']
      : [
          '  targetModificationPaths:',
          '    - id: TARGET-MOD-001',
          `      path: ${targetPath}`,
          `      traceRows: [${mode === 'broken-refs' ? 'TRACE-MISSING' : 'TRACE-001'}]`,
          `      evidenceRefs: [${mode === 'broken-refs' ? 'EVD-MISSING' : 'EVD-001'}]`,
        ];
  const sourcePath = path.join(root, 'source.md');
  writeText(
    sourcePath,
    [
      'implementationConfirmation:',
      '  status: user_confirmed',
      '  must:',
      '    - id: MUST-001',
      '      text: Must execute dynamic command.',
      '      evidenceRefs: [EVD-001]',
      '      coveredByTraceRows: [TRACE-001]',
      '  notDone:',
      '    - id: NEG-001',
      '      text: Missing command proof blocks closeout.',
      '      evidenceRefs: [EVD-001]',
      '      oracle: negative oracle',
      '      coveredByTraceRows: [TRACE-001]',
      '  mustNot:',
      '    - id: OUT-001',
      '      text: Do not use legacy proof.',
      '  evidence:',
      '    - id: EVD-001',
      '      text: Evidence.',
      '      oracle: command output artifact',
      '      requiredCommandRefs: [CMD-TEST-DYNAMIC-RUNNER]',
      '      artifactRefs: [CANONICAL-001]',
      '  traceRows:',
      '    - id: TRACE-001',
      '      covers: [MUST-001, NEG-001]',
      '      evidenceRefs: [EVD-001]',
      '      deliveryEvidenceCommandRefs: [CMD-TEST-DYNAMIC-RUNNER]',
      '      acceptanceRefs: [ACC-001, E2E-001]',
      '      artifactRefs: [CANONICAL-001]',
      '  failurePaths:',
      '    - id: FAIL-001',
      '      title: Missing proof',
      '      trigger: command evidence missing',
      '      expectedBehavior: blocked',
      '      forbiddenBehavior: pass',
      '      blocksCompletionWhenViolated: true',
      '      linkedNegIds: [NEG-001]',
      '      linkedEvidenceIds: [EVD-001]',
      '      requiredAssertions: [blocked]',
      '  edgeCases:',
      '    - id: EDGE-001',
      '      category: missing_required_command',
      '      condition: command evidence missing',
      '      expectedBehavior: blocked',
      '      forbiddenBehavior: pass',
      '      linkedFailurePathIds: [FAIL-001]',
      '      linkedEvidenceIds: [EVD-001]',
      '  edgeCaseViews:',
      '    - id: EDGEVIEW-001',
      '      title: edge view',
      '      covers: [FAIL-001, EDGE-001]',
      '      cases: [EDGE-001]',
      '  requiredCommands:',
      '    - id: CMD-TEST-DYNAMIC-RUNNER',
      `      command: npx vitest run ${testFile.replace(/\\/gu, '/')}`,
      '      traceRows: [TRACE-001]',
      '      evidenceRefs: [EVD-001]',
      '  artifactAutomationPlan:',
      '    - id: CANONICAL-001',
      '      artifactType: report',
      '      path: scripts/run-required-commands-from-ai-tdd-manifest.ts',
      '      producer: runner-fixture',
      '      sourceOfTruthRole: evidence',
      '      traceRows: [TRACE-001]',
      '      evidenceRefs: [EVD-001]',
      '  currentTargetMap:',
      '    schemaVersion: current-target-map/v1',
      '    displayProfile: closed_loop_current_target_map',
      '    currentSummary:',
      '      - title: current',
      '        detail: unproven',
      '    targetSummary:',
      '      - title: target',
      '        detail: proven',
      '    diffRows:',
      '      - dimension: command source',
      '        currentState: local',
      '        targetState: manifest',
      '        action: use manifest',
      '    process:',
      '      - phase: closeout',
      '        currentState: missing',
      '        targetState: runner',
      '    artifactPaths:',
      '      - path: scripts/run-required-commands-from-ai-tdd-manifest.ts',
      '        traceRows: [TRACE-001]',
      '        evidenceRefs: [EVD-001]',
      '    canonicalArtifacts:',
      '      - id: CANONICAL-001',
      '        targetPathOrField: scripts/run-required-commands-from-ai-tdd-manifest.ts',
      '        traceRows: [TRACE-001]',
      '        evidenceRefs: [EVD-001]',
      '    existingArtifacts:',
      '      - id: LEGACY-001',
      '        currentPath: legacy',
      '        completionProofPolicy: legacy_only',
      '        traceRows: [TRACE-001]',
      '        evidenceRefs: [EVD-001]',
      '  closeoutReadinessPreview:',
      '    requiredCommands: [CMD-TEST-DYNAMIC-RUNNER]',
      '    orphanPolicy: no orphan',
      '    currentAttemptPolicy: current attempt only',
      '    recordClosedPolicy: closeout gate only',
      ...targetRows,
      '',
    ].join('\n')
  );
  const recordPath = path.join(root, 'requirement-record.json');
  writeJson(recordPath, {
    recordId: 'REQ-RUNNER',
    requirementSetId: 'REQ-RUNNER',
    status: 'user_confirmed',
    sourcePath,
    sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    implementationConfirmationHash:
      'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    closeout: { currentAttemptId: 'attempt-runner' },
    aiTddContractGate: { required: true },
    deliveryEvidence: { requiredCommands: [] },
    globalContractTraceabilityPolicy,
    traceStatusPolicy,
    executionIterations: [],
    artifactIndex: [],
  });
  return { sourcePath, recordPath };
}

describe('manifest driven required command runner contract', () => {
  it('provides the sole dynamic required-command runner entrypoint', () => {
    expect(existsSync(dynamicRunnerPath), 'missing manifest required-command runner').toBe(true);

    const source = readText(dynamicRunnerPath);
    expect(source).toContain('evaluateAiTddContractGate');
    expect(source).toContain('pre-rerun');
    expect(source).toContain('closeout');
    expect(source).toContain('contractExecutionManifest');
    expect(source).toContain('closeoutProof');
    expect(source).toContain('requiredCommands');
    expect(source).toContain('deliveryEvidence');
    expect(source).toContain('artifactRefs');
    expect(source).toContain('closeoutAttemptId');
  });

  it('does not depend on legacy six-model command IDs for required command resolution', () => {
    expect(existsSync(dynamicRunnerPath), 'missing manifest required-command runner').toBe(true);

    const source = readText(dynamicRunnerPath);
    expect(source).not.toContain('CMD-CONTRACT-001');
    expect(source).not.toMatch(/CMD-DELIVERY-\d{3}/u);
    expect(source).not.toContain('commandArgsForGenericCommand');
  });

  it('fails fast and writes failed evidence outside successful implementation evidence ingest', () => {
    expect(existsSync(dynamicRunnerPath), 'missing manifest required-command runner').toBe(true);

    const source = readText(dynamicRunnerPath);
    expect(source).toContain('failed evidence');
    expect(source).toContain('implementation-evidence-packet.failed.json');
    expect(source).toContain('not_allowed_through_implementation_evidence_ingested');
    expect(source).toMatch(/break|return|throw/u);
  });

  it.each([
    ['missing-target-modification-paths', 'targetModificationPathCoverage:target_modification_paths_missing'],
    ['missing-path', 'targetModificationPathCoverage:target_modification_path_missing'],
    ['missing-refs', 'targetModificationPathCoverage:target_modification_trace_refs_missing'],
    ['missing-trace-refs', 'targetModificationPathCoverage:target_modification_trace_refs_missing'],
    ['missing-evidence-refs', 'targetModificationPathCoverage:target_modification_evidence_refs_missing'],
    ['broken-refs', 'targetModificationPathCoverage:trace_ref_missing'],
  ] as const)('blocks closeout when targetModificationPathCoverage is %s', (mode, reason) => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'manifest-runner-target-paths-'));
    try {
      const { sourcePath, recordPath } = fixture(root, mode);
      const evidenceDir = path.join(root, 'evidence');
      const code = mainRunRequiredCommandsFromAiTddManifest([
        '--source',
        sourcePath,
        '--requirement-record',
        recordPath,
        '--mode',
        'closeout',
        '--attempt-id',
        'attempt-runner',
        '--run-id',
        'run-runner',
        '--evidence-dir',
        evidenceDir,
        '--json',
      ]);
      expect(code).toBe(1);
      const failedPacketPath = path.join(evidenceDir, 'implementation-evidence-packet.failed.json');
      expect(existsSync(failedPacketPath)).toBe(true);
      const failedPacket = JSON.parse(readFileSync(failedPacketPath, 'utf8'));
      expect(failedPacket.not_allowed_through_implementation_evidence_ingested).toBe(true);
      expect(failedPacket.blockingReasons).toEqual(expect.arrayContaining([reason]));
      expect(existsSync(path.join(evidenceDir, 'implementation-evidence-packet.json'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('indexes target snapshots and normalized runtime reports through controlled ingest', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'manifest-runner-artifact-index-'));
    try {
      const { sourcePath, recordPath } = fixture(root, 'valid');
      const commandFile = path.join(root, 'runner-artifact-command.js');
      writeText(commandFile, 'console.log("runner artifact index fixture");\n');
      const source = readText(sourcePath).replace(
        /command: npx vitest run .+/u,
        `command: node ${commandFile.replace(/\\/gu, '/')}`
      );
      writeText(sourcePath, source);
      const evidenceDir = path.join(root, 'evidence');
      const code = mainRunRequiredCommandsFromAiTddManifest([
        '--source',
        sourcePath,
        '--requirement-record',
        recordPath,
        '--mode',
        'closeout',
        '--attempt-id',
        'attempt-runner',
        '--run-id',
        'run-runner',
        '--evidence-dir',
        evidenceDir,
        '--json',
      ]);
      expect([0, 1]).toContain(code);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      const artifactPaths = record.artifactIndex.map((artifact: Record<string, unknown>) =>
        String(artifact.path)
      );
      expect(artifactPaths).toEqual(
        expect.arrayContaining([
          path.join(evidenceDir, 'ai-tdd-pre-run-report.json').replace(/\\/gu, '/'),
          path.join(evidenceDir, 'command-evidence-bundle.json').replace(/\\/gu, '/'),
          path.join(evidenceDir, 'implementation-evidence-packet.json').replace(/\\/gu, '/'),
          path.join(evidenceDir, 'dynamic-runner-test-report.json').replace(/\\/gu, '/'),
          path.join(evidenceDir, 'legacy-guard-test-report.json').replace(/\\/gu, '/'),
          path.join(evidenceDir, 'final-closeout-runner-test-report.json').replace(/\\/gu, '/'),
          path.resolve('scripts/run-required-commands-from-ai-tdd-manifest.ts').replace(/\\/gu, '/'),
        ])
      );
      const packet = JSON.parse(
        readFileSync(path.join(evidenceDir, 'implementation-evidence-packet.json'), 'utf8')
      );
      expect(packet.artifactRefs).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ artifactType: 'implementation_evidence_packet' }),
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('treats forbidden rg scans as pass only when no forbidden pattern is found', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'manifest-runner-forbidden-rg-'));
    try {
      const { sourcePath, recordPath } = fixture(root, 'valid');
      const cleanFile = path.join(root, 'clean-surface.ts');
      writeText(cleanFile, 'currentMentalModel: delivery_confirmation\n');
      const source = readText(sourcePath).replace(
        /command: npx vitest run .+/u,
        `command: rg -n -e 'currentMentalModel.*delivery_closeout|delivery_closeout.*currentMentalModel' -- ${cleanFile.replace(/\\/gu, '/')}`
      );
      writeText(sourcePath, source);
      const evidenceDir = path.join(root, 'evidence');
      const code = mainRunRequiredCommandsFromAiTddManifest([
        '--source',
        sourcePath,
        '--requirement-record',
        recordPath,
        '--mode',
        'closeout',
        '--attempt-id',
        'attempt-runner',
        '--run-id',
        'run-runner',
        '--evidence-dir',
        evidenceDir,
        '--json',
      ]);
      expect([0, 1]).toContain(code);
      const failedPacketPath = path.join(evidenceDir, 'implementation-evidence-packet.failed.json');
      expect(existsSync(failedPacketPath)).toBe(true);
      const packet = JSON.parse(readFileSync(failedPacketPath, 'utf8'));
      expect(packet.commandRuns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            commandId: 'CMD-TEST-DYNAMIC-RUNNER',
            commandExecutionMode: 'forbidden_pattern_absent',
            exitCode: 0,
            rawExitCode: 1,
          }),
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('generates failure-case coverage through controlled ingest without polluting manifest required commands', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'manifest-runner-failure-coverage-'));
    try {
      const { sourcePath, recordPath } = fixture(root, 'valid');
      const commandFile = path.join(root, 'runner-failure-coverage-command.js');
      writeText(commandFile, 'console.log("runner failure coverage fixture");\n');
      const source = readText(sourcePath)
        .replace(/command: npx vitest run .+/u, `command: node ${commandFile.replace(/\\/gu, '/')}`)
        .replace(
          '  closeoutReadinessPreview:',
          [
            '  applicability:',
            '    runtimeRecovery:',
            '      requiresFunctionalResumeFailureCaseRegistry: true',
            '  functionalResumeFailureCaseRegistry:',
            '    applies: true',
            '    recoveryActionDefinitions:',
            '      - actionId: block_closeout',
            '        label: Block closeout',
            '        writesControlFields: [gateChecks]',
            '        recordEventTypes: [implementation_evidence_ingested]',
            '    groups:',
            '      - groupId: evidence_integrity',
            '        label: Evidence integrity',
            '        caseRefs: [exit_code_only_proof]',
            '        requiredTraceRefs: [TRACE-001]',
            '        requiredEvidenceRefs: [EVD-001]',
            '    failureCases:',
            '      - id: exit_code_only_proof',
            '        groupId: evidence_integrity',
            '        triggerSignal: deliveryEvidence.requiredCommands artifactRefs is empty',
            '        detectionPoint: ai_tdd_closeout_gate',
            '        failClosedGate: closeout',
            '        expectedRecoveryActions: [block_closeout]',
            '        requiredTraceRefs: [TRACE-001]',
            '        requiredEvidenceRefs: [EVD-001]',
            '  closeoutReadinessPreview:',
          ].join('\n')
        );
      writeText(sourcePath, source);
      const evidenceDir = path.join(root, 'evidence');
      const code = mainRunRequiredCommandsFromAiTddManifest([
        '--source',
        sourcePath,
        '--requirement-record',
        recordPath,
        '--mode',
        'closeout',
        '--attempt-id',
        'attempt-runner',
        '--run-id',
        'run-runner',
        '--evidence-dir',
        evidenceDir,
        '--json',
      ]);
      expect([0, 1]).toContain(code);
      const coveragePath = path.join(evidenceDir, 'failure-case-coverage.json');
      expect(existsSync(coveragePath)).toBe(true);
      const coverage = JSON.parse(readFileSync(coveragePath, 'utf8'));
      expect(coverage.resumeFailureCaseRegistryCoverage.caseEvidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            caseId: 'exit_code_only_proof',
            expectedRecoveryActions: ['block_closeout'],
            sourceRefs: [
              {
                sourceType: 'functionalResumeFailureCaseRegistry.failureCases',
                id: 'exit_code_only_proof',
              },
            ],
          }),
        ])
      );
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.artifactIndex).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            artifactType: 'failure_case_coverage',
            path: coveragePath.replace(/\\/gu, '/'),
          }),
        ])
      );
      expect(
        record.executionIterations.flatMap((iteration: Record<string, unknown>) =>
          (iteration.commandRunRefs as Record<string, unknown>[]) ?? []
        )
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ commandId: 'CMD-FULL-FAILURE-CASE-COVERAGE' }),
        ])
      );
      expect(
        record.deliveryEvidence.requiredCommands.map((command: Record<string, unknown>) => command.commandId)
      ).not.toContain('CMD-FULL-FAILURE-CASE-COVERAGE');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('legacy and final closeout runner boundaries', () => {
  it('keeps the legacy six-model runner as a non-executing tombstone', () => {
    const source = readText(legacyRunnerPath);
    expect(source).toContain('tombstone');
    expect(source).toContain(dynamicRunnerPath);
    expect(source).not.toContain('DEFAULT_COMMAND_ORDER');
    expect(source).not.toMatch(/CMD-DELIVERY-\d{3}/u);
  });

  it('forces final closeout generic mode to delegate to the manifest runner only', () => {
    const source = readText(finalCloseoutRunnerPath);
    expect(source).toContain(dynamicRunnerPath);
    expect(source).not.toContain('commandArgsForGenericCommand');
    expect(source).not.toContain('CMD-DELIVERY-002');
    expect(source).not.toContain('CMD-DELIVERY-003');
    expect(source).not.toMatch(/TRACE-00[1-5]/u);
  });
});
