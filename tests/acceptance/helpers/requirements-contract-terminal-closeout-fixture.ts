import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

type JsonRecord = Record<string, ReturnType<typeof JSON.parse>>;

export const TERMINAL_BASE = 'docs/plans/evidence/loop-engineering-remediation';
const COMPLETION_SCHEMA_PATH =
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-completion-evidence.schema.json';

export function sha256(value: string | Buffer) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function ids(prefix: string, start: number, end: number, width: number) {
  return Array.from(
    { length: end - start + 1 },
    (_, index) => `${prefix}${String(start + index).padStart(width, '0')}`
  );
}

export function writeJson(root: string, relativePath: string, value: unknown) {
  const target = path.join(root, relativePath);
  const serialized = `${JSON.stringify(value)}\n`;
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, serialized, 'utf8');
  return { path: relativePath, hash: sha256(serialized), decision: 'PASS' };
}

function writeText(root: string, relativePath: string, value: string) {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, value, 'utf8');
  return { path: relativePath, hash: sha256(value), decision: 'PASS' };
}

function frozenContractText(sourceAmendmentHashes: string[]) {
  const amendmentIds = ids('AMEND-', 1, sourceAmendmentHashes.length, 2);
  return [
    '# Goal Execution Contract',
    '',
    '<!-- goal-slot:frontMatter required dynamic=frontMatter -->',
    '---',
    'sourceObligationRange: S001-S188',
    `sourceAmendmentId: ${amendmentIds.join('+')}`,
    ...amendmentIds.flatMap((amendmentId, index) => {
      const key = amendmentId.toLowerCase().replace('-', '');
      return [
        `${key}Authority: fixture/${amendmentId}`,
        `${key}SourceHash: ${sourceAmendmentHashes[index]}`,
      ];
    }),
    'taskRange: G00-G15',
    'acceptanceRange: AC-01-AC-226',
    '---',
    '<!-- /goal-slot:frontMatter -->',
    '',
    'The effective universes remain exactly:',
    '',
    '```text',
    'G00-G15',
    'S001-S188',
    'AC-01-AC-226',
    'TR-01-TR-226',
    'CMD-01-CMD-37',
    'EVD-00-EVD-16',
    'ARTIFACT-01-ARTIFACT-56',
    'DSA-01-DSA-16',
    'MS-01-MS-75',
    'STAGE-01-STAGE-11',
    '```',
    '',
  ].join('\n');
}

export function terminalCommandIds() {
  const schema = JSON.parse(
    readFileSync(
      path.resolve(
        'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-terminal-command-supervisor-input.schema.json'
      ),
      'utf8'
    )
  );
  return [
    schema.properties.firstCommand.const,
    schema.properties.secondCommand.const,
  ] as [string, string];
}

export function createTerminalCloseoutFixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'requirements-terminal-closeout-'));
  const contractPath =
    'docs/plans/2026-07-18-loop-engineering-evidence-closure-remediation-amend13-goal-execution-plan.md';
  const sourceAmendmentHashes = ids('AMEND-', 1, 13, 2).map((id) => sha256(id));
  const contractRef = writeText(root, contractPath, frozenContractText(sourceAmendmentHashes));
  const writeContractWithCommandRows = (commandRows: string[]) =>
    writeText(
      root,
      contractPath,
      `${frozenContractText(sourceAmendmentHashes)}${commandRows.join('\n')}\n`
    ).hash;
  const artifactIndex = ids('ARTIFACT-', 2, 56, 2).map((artifactId) => ({
    artifactId,
    ...writeJson(root, `artifacts/${artifactId}.json`, {
      schemaVersion: 'requirements-contract-test-artifact/v1',
      decision: 'PASS',
    }),
  }));
  const evidenceIndex = ids('EVD-', 0, 16, 2).map((evidenceId) => ({
    evidenceId,
    ...writeJson(root, `evidence/${evidenceId}.json`, {
      schemaVersion: 'requirements-contract-test-evidence/v1',
      decision: 'PASS',
    }),
  }));
  const transactionId = `TX-${randomUUID()}`;
  const implementationAttemptId = `IMP-${randomUUID()}`;
  const auditAttemptId = `AUD-${randomUUID()}`;
  const architectureAuditAttemptId = `AUD-${randomUUID()}`;
  const preCandidateAuditAttemptId = `AUD-${randomUUID()}`;
  const finalAuditAttemptId = `AUD-${randomUUID()}`;
  const bundlePath = `${TERMINAL_BASE}/implementation-evidence.json`;
  const bundle: JsonRecord = {
    schemaVersion: 'requirements-contract-completion-evidence/v1',
    transactionId,
    implementationAttemptId,
    auditAttemptId,
    architectureAuditAttemptId,
    preCandidateAuditAttemptId,
    finalAuditAttemptId,
    evidenceBundleId: `EVIDENCE-${randomUUID()}`,
    contractHash: contractRef.hash,
    sourcePlanHash: sha256('source-plan'),
    sourceAmendmentHashes,
    aggregateAmendmentHash: sha256('aggregate'),
    semanticModelHash: sha256('semantic-model'),
    sequenceContractHash: sha256('sequence-contract'),
    closureReportHash: sha256('closure-report'),
    coverage: {
      storyIds: ids('S', 1, 188, 3),
      acceptanceIds: ids('AC-', 1, 226, 2),
      traceIds: ids('TR-', 1, 226, 2),
      commandIds: ids('CMD-', 1, 37, 2),
    },
    criticalMetrics: {
      openGapCount: 0,
      invalidatedStageCount: 0,
      evidenceFabricationCount: 0,
    },
    lifecycleDecisions: {
      deterministicAcceptanceGate: 'pass',
      finalJudgeDecision: 'pass',
      realConsumerJourneyDecision: 'pass',
      stageFiveStarCount: 11,
      stageBelowFiveStarCount: 0,
    },
    phaseHistory: [
      architectureAuditAttemptId,
      preCandidateAuditAttemptId,
      finalAuditAttemptId,
    ],
    residualRisks: [],
    evidenceIndex,
    artifactIndex,
  };
  const completionSchema = JSON.parse(readFileSync(COMPLETION_SCHEMA_PATH, 'utf8'));
  for (const field of completionSchema.required as string[]) {
    if (field in bundle) continue;
    if (field === 'goalExecutionApplicability') bundle[field] = 'required';
    else if (/(Bytes|Lines)$/u.test(field)) bundle[field] = 1;
    else if (/Authority$/u.test(field)) bundle[field] = `${field}-fixture`;
    else if (field.endsWith('Path')) bundle[field] = `bindings/${field}.json`;
    else if (field.endsWith('Hash')) bundle[field] = sha256(field);
    else throw new Error(`unsupported_terminal_bundle_field:${field}`);
  }
  const bundleRef = writeJson(root, bundlePath, bundle);
  const commandIds = terminalCommandIds();
  const now = new Date().toISOString();
  const commandRuns = commandIds.map((commandId) => {
    const exactArgv = [process.execPath, '-e', 'process.exit(0)'];
    return {
      commandId,
      exactArgv,
      argvHash: sha256(JSON.stringify(exactArgv)),
      cwd: root.replace(/\\/gu, '/'),
      executorIdentity: 'requirements-contract-terminal-command-supervisor/v1',
      hostIdentity: `${process.platform}-${process.arch}`,
      startedAt: now,
      endedAt: now,
      exitCode: 0,
      stdoutHash: sha256(''),
      stderrHash: sha256(''),
    };
  });
  const targetDefinitions = [
    {
      order: 1,
      artifactRole: 'SAFE-WRITE-RECEIPT-MANIFEST',
      targetPath: `${TERMINAL_BASE}/safe-write-receipt-manifest.json`,
      receiptPath: `${TERMINAL_BASE}/finalization-receipts/safe-write-receipt-manifest.receipt.json`,
      predecessorRole: 'not_applicable',
    },
    {
      order: 2,
      artifactRole: 'EVD-15',
      targetPath: `${TERMINAL_BASE}/G15-final-gates.json`,
      receiptPath: `${TERMINAL_BASE}/finalization-receipts/G15-final-gates.receipt.json`,
      predecessorRole: 'SAFE-WRITE-RECEIPT-MANIFEST',
    },
    {
      order: 3,
      artifactRole: 'ARTIFACT-01',
      targetPath: bundlePath,
      receiptPath: `${TERMINAL_BASE}/finalization-receipts/implementation-evidence.receipt.json`,
      predecessorRole: 'EVD-15',
    },
  ];
  const finalizationTargets = targetDefinitions.map((target) => ({
    ...target,
    targetSchemaVersion: `${target.artifactRole}/v1`,
    minimumBytes: 2,
    targetHash: target.artifactRole === 'ARTIFACT-01' ? bundleRef.hash : sha256(target.artifactRole),
    promotionReceiptHash: sha256(`${target.artifactRole}-receipt`),
    promotionHash: target.artifactRole === 'ARTIFACT-01' ? bundleRef.hash : sha256(target.artifactRole),
    readbackHash: target.artifactRole === 'ARTIFACT-01' ? bundleRef.hash : sha256(target.artifactRole),
  }));
  const terminalReceiptPath = `${TERMINAL_BASE}/terminal-command-receipt.json`;
  const terminalReceipt: JsonRecord = {
    schemaVersion: 'requirements-contract-terminal-command-receipt/v1',
    contractHash: contractRef.hash,
    frozenEvidenceBundleHash: bundleRef.hash,
    terminalFinalizationTargetSetDeclarationHash: sha256('declaration'),
    terminalFinalizationTargetSetClosureHash: sha256(JSON.stringify(finalizationTargets)),
    finalizationTargets,
    commands: commandRuns,
    orderedExecutionDecision: 'pass',
    result: 'PASS',
  };
  const terminalReceiptRef = writeJson(root, terminalReceiptPath, terminalReceipt);
  return {
    root,
    contractPath,
    writeContractWithCommandRows,
    bundlePath,
    bundle,
    terminalReceiptPath,
    terminalReceipt,
    terminalReceiptRef,
    packetPath: `${TERMINAL_BASE}/terminal-closeout-packet.json`,
    readbackReceiptPath: `${TERMINAL_BASE}/terminal-closeout-packet.readback.receipt.json`,
  };
}
