import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mainMainAgentOrchestration } from '../../scripts/main-agent-orchestration';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-post-close-intake-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function sha256Bytes(value: Buffer | string): string {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
}

function semanticConfirmationForHash(
  confirmation: Record<string, unknown>
): Record<string, unknown> {
  const bookkeeping = new Set([
    'status',
    'confirmedAt',
    'confirmedBy',
    'sourceDocumentHash',
    'implementationConfirmationHash',
    'reconfirmationRequest',
    'confirmationRender',
  ]);
  return Object.fromEntries(Object.entries(confirmation).filter(([key]) => !bookkeeping.has(key)));
}

function sourceHashes(sourceText: string, blockText: string, confirmation: Record<string, unknown>) {
  const semantic = semanticConfirmationForHash(confirmation);
  const normalizedBlock = `implementationConfirmation:${stableStringify(semantic)}`;
  return {
    sourceDocumentHash: sha256Bytes(sourceText.replace(blockText, normalizedBlock)),
    implementationConfirmationHash: sha256Bytes(stableStringify(semantic)),
  };
}

function writeJson(filePath: string, payload: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
}

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

function captureStdout(fn: () => number): { code: number; stdout: string; stderr: string } {
  const chunks: string[] = [];
  const errors: string[] = [];
  const origWrite = process.stdout.write.bind(process.stdout);
  const origError = console.error;
  process.stdout.write = (msg: string | Uint8Array) => {
    chunks.push(typeof msg === 'string' ? msg : Buffer.from(msg).toString('utf8'));
    return true;
  };
  console.error = (...args: unknown[]) => {
    errors.push(args.map((arg) => String(arg)).join(' '));
  };
  try {
    return { code: fn(), stdout: chunks.join(''), stderr: errors.join('\n') };
  } finally {
    process.stdout.write = origWrite;
    console.error = origError;
  }
}

function writeSource(recordId: string): {
  sourcePath: string;
  hashes: { sourceDocumentHash: string; implementationConfirmationHash: string };
} {
  const confirmation = {
    status: 'user_confirmed',
    recordId,
    requirementSetId: recordId,
    must: [
      {
        id: 'MUST-001',
        text: 'The post-close intake action must preserve the closed origin record.',
        evidenceRefs: ['EVD-001'],
      },
    ],
    targetModificationPathCoverage: [
      {
        id: 'CANONICAL-001',
        path: 'scripts/target-artifact.ts',
        evidenceRefs: ['EVD-001'],
      },
    ],
  };
  const blockText = [
    'implementationConfirmation:',
    '  status: user_confirmed',
    `  recordId: ${recordId}`,
    `  requirementSetId: ${recordId}`,
    '  must:',
    '    - id: MUST-001',
    '      text: The post-close intake action must preserve the closed origin record.',
    '      evidenceRefs:',
    '        - EVD-001',
    '  targetModificationPathCoverage:',
    '    - id: CANONICAL-001',
    '      path: scripts/target-artifact.ts',
    '      evidenceRefs:',
    '        - EVD-001',
  ].join('\n');
  const sourceText = [`# ${recordId}`, '', blockText].join('\n');
  const sourcePath = path.join(root, 'docs', 'requirements', `${recordId}.md`);
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, sourceText, 'utf8');
  return { sourcePath, hashes: sourceHashes(sourceText, blockText, confirmation) };
}

function writeClosedRecordFixture(options: {
  recordId?: string;
  closeoutDecision?: string;
  semanticHashOverride?: Partial<ReturnType<typeof sourceHashes>>;
  currentArtifactBody?: string;
  historicalArtifactHash?: string;
  postCloseSignals?: Array<Record<string, unknown>>;
  writeArtifactIndex?: boolean;
} = {}): { sourcePath: string; recordPath: string; targetPath: string; recordId: string } {
  const recordId = options.recordId ?? 'REQ-POST-CLOSE-001';
  const { sourcePath, hashes } = writeSource(recordId);
  const targetPath = path.join(root, 'scripts', 'target-artifact.ts');
  const currentArtifactBody = options.currentArtifactBody ?? 'export const value = "current";\n';
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, currentArtifactBody, 'utf8');

  const closeoutAttemptId = `closeout-${recordId}-20260528T000000Z`;
  const recordPath = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId,
    'requirement-record.json'
  );
  const record = {
    recordId,
    requirementSetId: recordId,
    status: 'user_confirmed',
    currentMentalModel: 'delivery_confirmation',
    sourcePath: path.relative(root, sourcePath).replace(/\\/g, '/'),
    sourceDocumentHash: options.semanticHashOverride?.sourceDocumentHash ?? hashes.sourceDocumentHash,
    implementationConfirmationHash:
      options.semanticHashOverride?.implementationConfirmationHash ??
      hashes.implementationConfirmationHash,
    closeout: {
      currentAttemptId: closeoutAttemptId,
      decision: options.closeoutDecision ?? 'pass',
      attempts: [
        {
          closeoutAttemptId,
          decision: options.closeoutDecision ?? 'pass',
          reportPath: `_bmad-output/runtime/requirement-records/${recordId}/delivery-closeout-report.json`,
        },
      ],
    },
    postCloseSignals: options.postCloseSignals ?? [],
    closeoutEvidence: {
      targetArtifacts: [
        {
          artifactId: 'TARGET-001',
          path: path.relative(root, targetPath).replace(/\\/g, '/'),
          hash:
            options.historicalArtifactHash ??
            sha256Bytes(Buffer.from('export const value = "previous";\n', 'utf8')),
          evidenceRefs: ['closeout-report:TARGET-001'],
        },
      ],
    },
  };
  writeJson(recordPath, record);
  if (options.writeArtifactIndex ?? true) {
    fs.writeFileSync(
      path.join(path.dirname(recordPath), 'artifact-index.jsonl'),
      `${JSON.stringify({
        eventType: 'artifact_indexed',
        artifactType: 'target_file_snapshot',
        sourceOfTruthRole: 'evidence',
        recordId,
        requirementSetId: recordId,
        path: targetPath.replace(/\\/g, '/'),
        contentHash: record.closeoutEvidence.targetArtifacts[0].hash,
        inputVersion: closeoutAttemptId,
        outputVersion: closeoutAttemptId,
        evidenceRefs: ['EVD-001'],
      })}\n`,
      'utf8'
    );
  }
  return { sourcePath, recordPath, targetPath, recordId };
}

function writeGatePassFixture(): {
  sourcePath: string;
  recordPath: string;
  targetPath: string;
  recordId: string;
} {
  const recordId = 'REQ-POST-CLOSE-GATE-PASS';
  const targetRelativePath = 'scripts/target-artifact.ts';
  const targetPath = path.join(root, targetRelativePath);
  const currentArtifactBody = 'export const value = "current";\n';
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, currentArtifactBody, 'utf8');

  const confirmation = {
    status: 'user_confirmed',
    recordId,
    requirementSetId: recordId,
    must: [
      {
        id: 'MUST-001',
        text: 'The post-close intake action must preserve the closed origin record.',
        evidenceRefs: ['EVD-001'],
        traceRefs: ['TRACE-001'],
      },
    ],
    notDone: [
      {
        id: 'NEG-001',
        text: 'Do not reopen a closed origin record during post-close revalidation.',
        evidenceRefs: ['EVD-001'],
        coveredByTraceRows: ['TRACE-001'],
        oracle: 'closed record remains byte-for-byte unchanged',
      },
    ],
    mustNot: [
      {
        id: 'OUT-001',
        text: 'The origin record must not be used as a new implementation carrier.',
        boundaryRefs: ['TRACE-001'],
      },
    ],
    evidence: [
      {
        id: 'EVD-001',
        oracle: 'post-close revalidation is recorded outside the origin record',
        requiredCommandRefs: ['CMD-POST-CLOSE-PASS'],
        artifactRefs: ['ART-001'],
      },
    ],
    traceRows: [
      {
        id: 'TRACE-001',
        covers: ['MUST-001', 'NEG-001'],
        evidenceRefs: ['EVD-001'],
        commandRefs: ['CMD-POST-CLOSE-PASS'],
        acceptanceRefs: ['ACC-001', 'E2E-001'],
        artifactRefs: ['ART-001'],
      },
    ],
    acceptanceTests: [
      {
        id: 'ACC-001',
        files: ['tests/acceptance/main-agent-post-close-defect-intake.test.ts'],
        commandRefs: ['CMD-POST-CLOSE-PASS'],
        covers: ['MUST-001'],
        evidenceRefs: ['EVD-001'],
      },
    ],
    e2eSuites: [
      {
        id: 'E2E-001',
        files: ['tests/acceptance/main-agent-post-close-defect-intake.test.ts'],
        commandRefs: ['CMD-POST-CLOSE-PASS'],
        covers: ['MUST-001'],
        evidenceRefs: ['EVD-001'],
      },
    ],
    requiredCommands: [
      {
        id: 'CMD-POST-CLOSE-PASS',
        command: 'node -e "process.exit(0)" tests/acceptance/main-agent-post-close-defect-intake.test.ts',
        files: ['tests/acceptance/main-agent-post-close-defect-intake.test.ts'],
        traceRefs: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
      },
    ],
    targetModificationPaths: [
      {
        id: 'TARGET-MOD-001',
        path: targetRelativePath,
        traceRefs: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
      },
    ],
    currentTargetMap: {
      schemaVersion: 'current-target-map/v1',
      displayProfile: 'closed_loop_current_target_map',
      currentSummary: [{ id: 'CUR-001', text: 'closed origin record exists' }],
      targetSummary: [{ id: 'TGT-001', text: 'post-close evidence carrier records revalidation' }],
      diffRows: [{ id: 'DIFF-001', text: 'artifact hash drift is revalidated' }],
      process: [{ id: 'PROCESS-001', text: 'run post-close revalidation' }],
      artifactPaths: [{ id: 'ARTPATH-001', path: targetRelativePath }],
      canonicalArtifacts: [
        {
          id: 'ART-001',
          targetPathOrField: targetRelativePath,
          traceRefs: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
        },
      ],
      existingArtifacts: [
        {
          id: 'LEGACY-001',
          currentPath: 'legacy/old-closeout-proof.json',
          completionProofPolicy: 'legacy_only',
          traceRefs: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
          oracle: 'old closeout proof cannot be treated as current revalidation evidence',
        },
      ],
    },
    closeoutReadinessPreview: {
      requiredCommands: ['CMD-POST-CLOSE-PASS'],
      recordClosedPolicy: 'closed_origin_record_remains_terminal',
    },
    aiTddContractExecutionManifestProjection: {
      closeoutProof: {
        requiredCommands: ['CMD-POST-CLOSE-PASS'],
        policies: ['closed_origin_record_remains_terminal'],
        targetRefs: ['ART-001'],
      },
    },
  };
  const blockText = [
    'implementationConfirmation:',
    ...JSON.stringify(confirmation, null, 2)
      .split('\n')
      .map((line) => `  ${line}`),
  ].join('\n');
  const sourceText = [`# ${recordId}`, '', blockText].join('\n');
  const sourcePath = path.join(root, 'docs', 'requirements', `${recordId}.md`);
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, sourceText, 'utf8');
  const hashes = sourceHashes(sourceText, blockText, confirmation);
  const closeoutAttemptId = `closeout-${recordId}-20260528T000000Z`;
  const previousHash = sha256Bytes(Buffer.from('export const value = "previous";\n', 'utf8'));
  const recordPath = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId,
    'requirement-record.json'
  );
  writeJson(recordPath, {
    recordId,
    requirementSetId: recordId,
    status: 'user_confirmed',
    currentMentalModel: 'delivery_confirmation',
    sourceDocumentHash: hashes.sourceDocumentHash,
    implementationConfirmationHash: hashes.implementationConfirmationHash,
    globalContractTraceabilityPolicy,
    traceStatusPolicy,
    closeout: {
      currentAttemptId: closeoutAttemptId,
      decision: 'pass',
      attempts: [
        {
          closeoutAttemptId,
          decision: 'pass',
        },
      ],
    },
    closeoutEvidence: {
      targetArtifacts: [
        {
          artifactId: 'ART-001',
          path: targetRelativePath,
          hash: previousHash,
          evidenceRefs: ['EVD-001'],
        },
      ],
    },
    artifactIndex: [
      {
        artifactId: 'ART-001',
        artifactType: 'target_file_snapshot',
        path: targetRelativePath,
        hash: previousHash,
        contentHash: previousHash,
        closeoutAttemptId,
        sourceOfTruthRole: 'evidence',
        producer: 'historical-closeout',
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
      },
    ],
  });
  return { sourcePath, recordPath, targetPath, recordId };
}

function runPostCloseIntake(args: string[]): {
  code: number;
  stdout: string;
  stderr: string;
  parsed: Record<string, unknown>;
} {
  const result = captureStdout(() => mainMainAgentOrchestration(['--cwd', root, ...args]));
  return {
    ...result,
    parsed: result.stdout.trim() ? (JSON.parse(result.stdout) as Record<string, unknown>) : {},
  };
}

describe('main-agent post-close defect intake', () => {
  it('classifies closed-record artifact drift as post-close revalidation', () => {
    const { sourcePath, recordPath } = writeClosedRecordFixture();
    const beforeRecord = fs.readFileSync(recordPath, 'utf8');

    const result = runPostCloseIntake([
      '--action',
      'post-close-defect-intake',
      '--source',
      sourcePath,
      '--requirement-record',
      recordPath,
      '--dry-run',
      '--json',
    ]);

    expect(result.stderr).toBe('');
    expect(result.code).toBe(0);
    expect(result.parsed).toMatchObject({
      ok: true,
      action: 'post-close-defect-intake',
      classification: 'post_close_revalidation_required',
      decision: 'dry_run',
      nextSafeAction: 'run_post_close_revalidation',
      reopenOriginalRecord: false,
      reconfirmOriginalRequirement: false,
      dispatchFromOriginRecord: false,
    });
    expect(result.parsed.changedTargetArtifacts).toEqual([
      expect.objectContaining({
        artifactId: 'TARGET-001',
        previousHash: sha256Bytes(Buffer.from('export const value = "previous";\n', 'utf8')),
        currentHash: sha256Bytes(Buffer.from('export const value = "current";\n', 'utf8')),
      }),
    ]);
    expect(result.parsed.carrier).toMatchObject({
      schemaVersion: 'post-close-revalidation-evidence-carrier/v1',
      reportType: 'post_close_revalidation_report',
      classification: 'post_close_revalidation_required',
      originRecordId: 'REQ-POST-CLOSE-001',
      originRequirementSetId: 'REQ-POST-CLOSE-001',
      originCloseoutAttemptId: 'closeout-REQ-POST-CLOSE-001-20260528T000000Z',
      sourceDocumentHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      implementationConfirmationHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      changedTargetArtifacts: [
        expect.objectContaining({
          artifactId: 'TARGET-001',
          previousHash: sha256Bytes(Buffer.from('export const value = "previous";\n', 'utf8')),
          currentHash: sha256Bytes(Buffer.from('export const value = "current";\n', 'utf8')),
        }),
      ],
      previousArtifactEvidenceRefs: expect.arrayContaining(['closeout-report:TARGET-001']),
      currentArtifactHashes: [
        expect.objectContaining({
          path: 'scripts/target-artifact.ts',
          hash: sha256Bytes(Buffer.from('export const value = "current";\n', 'utf8')),
          missing: false,
        }),
      ],
      revalidationRunId: expect.stringMatching(/^post-close-revalidation-run-REQ-POST-CLOSE-001-/u),
      revalidationEvidenceRefs: [],
      gateReports: [],
      decision: 'dry_run',
      blockingReasons: [],
      nextSafeAction: 'run_post_close_revalidation',
    });
    expect(fs.readFileSync(recordPath, 'utf8')).toBe(beforeRecord);
  });

  it('fails closed when the origin record is not closed', () => {
    const { sourcePath, recordPath } = writeClosedRecordFixture({ closeoutDecision: 'blocked' });

    const result = runPostCloseIntake([
      '--action',
      'post-close-defect-intake',
      '--source',
      sourcePath,
      '--requirement-record',
      recordPath,
      '--dry-run',
      '--json',
    ]);

    expect(result.code).toBe(1);
    expect(result.parsed).toMatchObject({
      ok: false,
      action: 'post-close-defect-intake',
      block: 'origin_record_not_closed',
      nextSafeAction: 'do_not_reopen_closed_record',
    });
  });

  it('reports no action when a closed record has no artifact drift', () => {
    const current = 'export const value = "current";\n';
    const { sourcePath, recordPath } = writeClosedRecordFixture({
      currentArtifactBody: current,
      historicalArtifactHash: sha256Bytes(Buffer.from(current, 'utf8')),
    });

    const result = runPostCloseIntake([
      '--action',
      'post-close-defect-intake',
      '--source',
      sourcePath,
      '--requirement-record',
      recordPath,
      '--dry-run',
      '--json',
    ]);

    expect(result.code).toBe(0);
    expect(result.parsed).toMatchObject({
      classification: 'no_post_close_action_required',
      decision: 'no_action',
      nextSafeAction: 'no_action_required',
    });
    expect(result.parsed.changedTargetArtifacts).toEqual([]);
  });

  it('blocks semantic hash drift without requesting reconfirmation directly', () => {
    const { sourcePath, recordPath } = writeClosedRecordFixture({
      semanticHashOverride: {
        sourceDocumentHash:
          'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
    });

    const result = runPostCloseIntake([
      '--action',
      'post-close-defect-intake',
      '--source',
      sourcePath,
      '--requirement-record',
      recordPath,
      '--dry-run',
      '--json',
    ]);

    expect(result.code).toBe(1);
    expect(result.parsed).toMatchObject({
      ok: false,
      action: 'post-close-defect-intake',
      block: 'semantic_decision_required',
      nextSafeAction: 'semantic_decision_required',
      reconfirmOriginalRequirement: false,
      dispatchFromOriginRecord: false,
    });
    expect(result.parsed.classification).not.toBe('post_close_revalidation_required');
  });

  it('routes proof defect signals to closure integrity escalation', () => {
    const { sourcePath, recordPath } = writeClosedRecordFixture({
      postCloseSignals: [{ type: 'false_closeout_proof', severity: 'blocker' }],
    });

    const result = runPostCloseIntake([
      '--action',
      'post-close-defect-intake',
      '--source',
      sourcePath,
      '--requirement-record',
      recordPath,
      '--dry-run',
      '--json',
    ]);

    expect(result.code).toBe(1);
    expect(result.parsed).toMatchObject({
      classification: 'closeout_proof_defect',
      decision: 'blocked',
      nextSafeAction: 'closure_integrity_incident_required',
    });
  });

  it('does not use non-defect revalidation for explicit defect classes', () => {
    const { sourcePath, recordPath } = writeClosedRecordFixture();

    for (const signal of [
      'implementation_defect',
      'missing_scope',
      'architecture_drift',
      'production_regression',
    ]) {
      const result = runPostCloseIntake([
        '--action',
        'post-close-defect-intake',
        '--source',
        sourcePath,
        '--requirement-record',
        recordPath,
        '--signal',
        signal,
        '--dry-run',
        '--json',
      ]);
      expect(result.parsed.classification).toBe(signal);
      expect(result.parsed.classification).not.toBe('post_close_revalidation_required');
      expect(result.parsed.dispatchFromOriginRecord).toBe(false);
    }
  });

  it('keeps dry-run runtime output out of the origin record', () => {
    const { sourcePath, recordPath } = writeClosedRecordFixture();
    const before = readJson(recordPath);

    const result = runPostCloseIntake([
      '--action',
      'post-close-defect-intake',
      '--source',
      sourcePath,
      '--requirement-record',
      recordPath,
      '--run-id',
      'post-close-revalidation-run-test',
      '--dry-run',
      '--json',
    ]);

    expect(result.code).toBe(0);
    expect(readJson(recordPath)).toEqual(before);
    expect(result.parsed.reportPath).toContain(
      '_bmad-output/runtime/requirement-records/REQ-POST-CLOSE-001/post-close/post-close-revalidation-run-test.json'
    );
    expect(fs.existsSync(path.resolve(root, String(result.parsed.reportPath)))).toBe(false);
  });

  it('writes a revalidation carrier and escalates when reused gates fail', () => {
    const { sourcePath, recordPath } = writeClosedRecordFixture({
      recordId: 'REQ-POST-CLOSE-GATE-FAIL',
    });
    const before = readJson(recordPath);

    const result = runPostCloseIntake([
      '--action',
      'post-close-defect-intake',
      '--source',
      sourcePath,
      '--requirement-record',
      recordPath,
      '--run-id',
      'post-close-revalidation-run-gate-fail',
      '--json',
    ]);

    expect(result.code).toBe(0);
    expect(result.parsed).toMatchObject({
      classification: 'post_close_revalidation_required',
      decision: 'blocked',
      nextSafeAction: 'linked_bugfix_required',
      dispatchFromOriginRecord: false,
      reconfirmOriginalRequirement: false,
      reopenOriginalRecord: false,
    });
    expect(result.parsed.blockingReasons).toEqual(
      expect.arrayContaining([
        'required_commands_from_ai_tdd_manifest',
        'required_commands_revalidation_failed',
      ])
    );
    expect(result.parsed.gateReports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reportType: 'required_commands_from_ai_tdd_manifest',
          decision: 'blocked',
        }),
      ])
    );
    const reportPath = String(result.parsed.reportPath);
    expect(fs.existsSync(reportPath)).toBe(true);
    expect(readJson(reportPath)).toMatchObject({
      schemaVersion: 'post-close-revalidation-evidence-carrier/v1',
      reportType: 'post_close_revalidation_report',
      classification: 'post_close_revalidation_required',
      originRecordId: 'REQ-POST-CLOSE-GATE-FAIL',
      originRequirementSetId: 'REQ-POST-CLOSE-GATE-FAIL',
      originCloseoutAttemptId: 'closeout-REQ-POST-CLOSE-GATE-FAIL-20260528T000000Z',
      sourceDocumentHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      implementationConfirmationHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      changedTargetArtifacts: [expect.objectContaining({ artifactId: 'TARGET-001' })],
      previousArtifactEvidenceRefs: expect.arrayContaining(['closeout-report:TARGET-001']),
      currentArtifactHashes: [expect.objectContaining({ path: 'scripts/target-artifact.ts' })],
      revalidationRunId: 'post-close-revalidation-run-gate-fail',
      revalidationEvidenceRefs: expect.arrayContaining([
        expect.stringContaining('required-command-evidence'),
      ]),
      gateReports: expect.arrayContaining([
        expect.objectContaining({
          reportType: 'required_commands_from_ai_tdd_manifest',
          decision: 'blocked',
        }),
      ]),
      decision: 'blocked',
      blockingReasons: expect.arrayContaining([
        'required_commands_from_ai_tdd_manifest',
        'required_commands_revalidation_failed',
      ]),
      nextSafeAction: 'linked_bugfix_required',
    });
    expect(readJson(recordPath)).toEqual(before);
  });

  it('keeps the origin record unchanged when reused gates reach successful evidence ingest', () => {
    const { sourcePath, recordPath } = writeGatePassFixture();
    const beforeRecord = fs.readFileSync(recordPath, 'utf8');

    const result = runPostCloseIntake([
      '--action',
      'post-close-defect-intake',
      '--source',
      sourcePath,
      '--requirement-record',
      recordPath,
      '--run-id',
      'post-close-revalidation-run-gate-pass',
      '--json',
    ]);

    expect(result.code).toBe(0);
    expect(result.parsed).toMatchObject({
      classification: 'post_close_revalidation_required',
      reopenOriginalRecord: false,
      reconfirmOriginalRequirement: false,
      dispatchFromOriginRecord: false,
    });
    const gateReports = result.parsed.gateReports as Array<Record<string, unknown>>;
    const commandGate = gateReports.find(
      (report) => report.reportType === 'required_commands_from_ai_tdd_manifest'
    );
    expect(commandGate).toMatchObject({
      reportType: 'required_commands_from_ai_tdd_manifest',
      originRecordPath: recordPath.replace(/\\/g, '/'),
    });
    expect(String(commandGate?.carrierRecordPath)).toContain(
      'post-close/post-close-revalidation-run-gate-pass/revalidation-carrier-control-record.json'
    );
    expect(String(commandGate?.stdout)).toContain('"ok": true');
    expect(String(commandGate?.stdout)).toContain(String(commandGate?.carrierRecordPath));
    expect(fs.readFileSync(recordPath, 'utf8')).toBe(beforeRecord);
    expect(String(result.parsed.reportPath)).toContain(
      '_bmad-output/runtime/requirement-records/REQ-POST-CLOSE-GATE-PASS/post-close/post-close-revalidation-run-gate-pass.json'
    );
    expect(fs.existsSync(String(result.parsed.reportPath))).toBe(true);
  });
});
