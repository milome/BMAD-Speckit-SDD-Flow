import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import * as crypto from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  distRuntimeHashFor,
  packageRuntimeHashFor,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-package-runtime-index';

const PACKAGE_CLI = path.resolve(
  __dirname,
  '../../packages/bmad-speckit/bin/bmad-speckit.js'
);
const PACKAGE_ROOT = path.resolve(__dirname, '../../packages/bmad-speckit');

function sha256(value: string | Buffer): string {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function stableHash(value: unknown): string {
  return sha256(stableStringify(value));
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function fileHash(filePath: string): string {
  return sha256(readFileSync(filePath));
}

function forbiddenRequirementIdentity(): string {
  return `MUST-${crypto.randomInt(100, 1_000)}`;
}

function git(root: string, args: string[]): void {
  execFileSync('git', args, {
    cwd: root,
    stdio: 'ignore',
  });
}

function sourceSnapshotHash(root: string, files: string[]): string {
  const entries = files
    .map((file) => {
      const absolute = path.resolve(root, file);
      return `${file.replace(/\\/gu, '/')}:${fileHash(absolute)}`;
    })
    .sort();
  return sha256(entries.join('\n'));
}

interface CandidateFixtureOptions {
  auditorPlacement?: 'freshness' | 'package';
  gitObservedProductionChange?: boolean;
  runtimeHashes?: 'current' | 'syntactic-only';
}

function produceCommandEvidence(input: {
  root: string;
  evidenceRoot: string;
  fixtureIdentity: string;
  requirementSetId: string;
  sourceSnapshotHash: string;
  contractHash: string;
  mode: 'positive' | 'negative';
}): {
  receipt: Record<string, unknown>;
  receiptPath: string;
  logPath: string;
} {
  const commandRunId = `RUN-${input.mode}-${input.fixtureIdentity}`;
  const requestPath = path.join(input.evidenceRoot, `${input.mode}-request.json`);
  const stdoutPath = path.join(input.evidenceRoot, `${input.mode}.stdout.log`);
  const stderrPath = path.join(input.evidenceRoot, `${input.mode}.stderr.log`);
  const receiptPath = path.join(input.evidenceRoot, `${input.mode}-receipt.json`);
  const failureClass = `observed_${input.mode}_failure`;
  const argv =
    input.mode === 'positive'
      ? [
          process.execPath,
          '-e',
          `process.stdout.write(${JSON.stringify(`observed-${input.fixtureIdentity}`)})`,
        ]
      : [
          process.execPath,
          '-e',
          `process.stderr.write(${JSON.stringify(failureClass)});process.exit(1)`,
        ];
  writeJson(requestPath, {
    schemaVersion: 'requirements-contract-command-execution-producer-input/v1',
    commandRunId,
    commandId: `CMD-${input.mode}-${input.fixtureIdentity}`,
    argv,
    cwd: input.root,
    stdoutPath,
    stderrPath,
    receiptPath,
    requirementSetId: input.requirementSetId,
    requirementRefs: [`REQ-${input.fixtureIdentity}`],
    transactionId: `TX-${input.fixtureIdentity}`,
    implementationAttemptId: `IMPL-ATTEMPT-${input.fixtureIdentity.toUpperCase()}`,
    architectureAuditAttemptId: `AUDIT-${input.fixtureIdentity}`,
    activePhaseAuditAttemptId: `AUDIT-${input.fixtureIdentity}`,
    contractHash: input.contractHash,
    inputSnapshotHash: input.sourceSnapshotHash,
    acceptanceRefs: [`AC-${input.fixtureIdentity}`],
    traceRefs: [`TR-${input.fixtureIdentity}`],
  });
  const execution = spawnSync(
    process.execPath,
    [
      PACKAGE_CLI,
      'requirements-contract-command-execution-producer',
      '--project-root',
      input.root,
      '--request',
      requestPath,
      '--json',
    ],
    {
      cwd: input.root,
      encoding: 'utf8',
    }
  );
  const expectedExitCode = input.mode === 'positive' ? 0 : 1;
  if (execution.status !== expectedExitCode || !existsSync(receiptPath)) {
    throw new Error(
      `command_evidence_producer_failed:${execution.status}:${execution.stdout}:${execution.stderr}`
    );
  }
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8')) as Record<
    string,
    unknown
  >;
  return {
    receipt,
    receiptPath,
    logPath: input.mode === 'positive' ? stdoutPath : stderrPath,
  };
}

function createMaterializationInstallReceipt(input: {
  fixture: ReturnType<typeof createCandidate>;
  identity: string;
}): { materializationRoot: string; installReceiptPath: string } {
  const candidate = JSON.parse(
    readFileSync(input.fixture.candidatePath, 'utf8')
  ) as Record<string, unknown>;
  const record = JSON.parse(
    readFileSync(input.fixture.recordPath, 'utf8')
  ) as Record<string, unknown>;
  const suffix = crypto.randomUUID().replace(/-/gu, '');
  const materializationRunId = `RUN-${suffix}`;
  const materializationRoot = mkdtempSync(
    path.join(os.tmpdir(), 'gap-closure-materialization-child-')
  );
  const evidenceRoot = path.join(
    materializationRoot,
    '.bmad-materialization',
    materializationRunId
  );
  const sourcePath = path.join(materializationRoot, 'source.txt');
  const sourceManifestPath = path.join(evidenceRoot, 'source-manifest.json');
  const sourceEntries = [{ path: 'source.txt', hash: sha256('source') }];
  const sourceManifestHash = stableHash(sourceEntries);
  const requestPath = path.join(evidenceRoot, 'install-request.json');
  const stdoutPath = path.join(evidenceRoot, 'install.stdout.log');
  const stderrPath = path.join(evidenceRoot, 'install.stderr.log');
  const installReceiptPath = path.join(evidenceRoot, 'install-receipt.json');
  writeFileSync(sourcePath, 'source', 'utf8');
  writeJson(sourceManifestPath, {
    schemaVersion: 'requirements-contract-clean-materialization-source-manifest/v1',
    entries: sourceEntries,
    manifestHash: sourceManifestHash,
  });
  writeJson(requestPath, {
    schemaVersion: 'requirements-contract-command-execution-producer-input/v1',
    commandRunId: `RUN-INSTALL-${suffix}`,
    commandId: `CMD-MATERIALIZATION-INSTALL-${suffix}`,
    argv: [process.execPath, '-e', 'process.exit(0)'],
    cwd: materializationRoot,
    stdoutPath,
    stderrPath,
    receiptPath: installReceiptPath,
    requirementSetId: record.requirementSetId,
    requirementRefs: [`REQ-${input.identity}`],
    transactionId: `TX-${input.identity}`,
    implementationAttemptId: `IMPL-ATTEMPT-${input.identity.toUpperCase()}`,
    architectureAuditAttemptId: `AUDIT-${input.identity}`,
    activePhaseAuditAttemptId: `AUDIT-${input.identity}`,
    contractHash: candidate.sourceDocumentHash,
    inputSnapshotHash: sourceManifestHash,
    acceptanceRefs: [`AC-${input.identity}`],
    traceRefs: [`TR-${input.identity}`],
  });
  const execution = spawnSync(
    process.execPath,
    [
      PACKAGE_CLI,
      'requirements-contract-command-execution-producer',
      '--project-root',
      materializationRoot,
      '--request',
      requestPath,
      '--json',
    ],
    {
      cwd: materializationRoot,
      encoding: 'utf8',
    }
  );
  if (execution.status !== 0 || !existsSync(installReceiptPath)) {
    throw new Error(
      `materialization_install_receipt_failed:${execution.status}:${execution.stdout}:${execution.stderr}`
    );
  }
  const timestamp = new Date().toISOString();
  const payload = {
    schemaVersion: 'requirements-contract-clean-materialization-receipt/v1',
    materializationRunId,
    sourceSnapshotPaths: candidate.changedProductionFiles,
    sourceSnapshotHash: candidate.sourceSnapshotHash,
    sourceManifestPath,
    sourceManifestHash,
    sourceFileCount: sourceEntries.length,
    materializationRoot,
    sourceWasCleanOfBuildOutputs: true,
    installReceiptPath,
    installReceiptHash: fileHash(installReceiptPath),
    buildReceiptPath: null,
    buildReceiptHash: null,
    runtimeBuildAuthorityReceiptPath: null,
    runtimeBuildAuthorityReceiptHash: null,
    currentDistHash: candidate.distHash,
    freshDistHash: null,
    currentPackageHash: candidate.packageHash,
    freshPackageHash: null,
    distParity: false,
    packageParity: false,
    startedAt: timestamp,
    completedAt: timestamp,
    decision: 'block',
  };
  writeJson(input.fixture.cleanMaterializationReceiptPath, {
    ...payload,
    receiptHash: stableHash(payload),
  });
  writeJson(input.fixture.candidatePath, {
    ...candidate,
    cleanMaterializationReceiptHash: fileHash(
      input.fixture.cleanMaterializationReceiptPath
    ),
  });
  return { materializationRoot, installReceiptPath };
}

function createCandidate(
  root: string,
  options: CandidateFixtureOptions = {}
): {
  root: string;
  recordPath: string;
  candidatePath: string;
  auditReceiptPath: string;
  outputPath: string;
  productionFile: string;
  auditorScriptPath: string;
  producerReceiptPaths: string[];
  cleanMaterializationReceiptPath: string;
} {
  const fixtureIdentity = crypto.randomUUID().replace(/-/gu, '');
  const gapId = `GAP-${fixtureIdentity}`;
  const freshnessTimestamp = new Date(Date.now() - 1_000).toISOString();
  const recordId = `REQ-${fixtureIdentity}`;
  const recordPath = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId,
    'requirement-record.json'
  );
  const evidenceRoot = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId,
    'gap-evidence',
    gapId
  );
  const productionFile = path.join(
    root,
    'packages',
    'bmad-speckit',
    'src',
    'main-agent',
    'source-authority',
    'scripts',
    'golden-journey-probe.ts'
  );
  const sourcePath = path.join(root, 'docs', 'requirements', 'golden-journey.md');
  const auditorScriptPath =
    options.auditorPlacement === 'package'
      ? path.join(
          root,
          'packages',
          'bmad-speckit',
          'independent-auditors',
          'gap-closure-auditor.cjs'
        )
      : path.join(evidenceRoot, 'independent-auditor.cjs');
  mkdirSync(path.dirname(productionFile), { recursive: true });
  mkdirSync(path.dirname(sourcePath), { recursive: true });
  mkdirSync(path.dirname(auditorScriptPath), { recursive: true });
  mkdirSync(evidenceRoot, { recursive: true });
  writeFileSync(productionFile, 'export const goldenJourneyProbe = true;\n', 'utf8');
  writeFileSync(sourcePath, '# Golden journey\n\nA real observable product behavior.\n', 'utf8');
  writeFileSync(
    auditorScriptPath,
    [
      "const fs = require('node:fs');",
      "const crypto = require('node:crypto');",
      'const args = process.argv.slice(2);',
      "const requestIndex = args.indexOf('--request');",
      "if (requestIndex < 0 || !args[requestIndex + 1]) process.exit(2);",
      'const request = JSON.parse(fs.readFileSync(args[requestIndex + 1], "utf8"));',
      'const candidatePath = request.candidatePath;',
      "const hash = (value) => `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;",
      'const candidateBytes = fs.readFileSync(candidatePath);',
      "const result = { schemaVersion: 'gap-closure-independent-audit-result/v1', gapId: JSON.parse(candidateBytes).gapId, candidateHash: hash(candidateBytes), auditorRole: 'readonly_independent_auditor', auditorRunId: `audit-run-${hash(candidateBytes).slice(-16)}`, decision: 'PASS', findings: [], verifiedConditions: { noProductionTestInjection: true, noHardcodedMachineIdentity: true, cleanMaterializationReproducible: true }, auditorImplementationPath: __filename, auditorImplementationHash: hash(fs.readFileSync(__filename)) };",
      'process.stdout.write(`${JSON.stringify(result)}\\n`);',
    ].join('\n'),
    'utf8'
  );
  writeJson(recordPath, {
    schemaVersion: 'requirement-record/v1',
    recordId,
    requirementSetId: recordId,
    sourceDocumentHash: fileHash(sourcePath),
    semanticModelHash: sha256('semantic-model'),
    projectionSetHash: sha256('projection-set'),
  });

  if (options.gitObservedProductionChange) {
    git(root, ['init']);
    git(root, ['config', 'user.email', 'gap-closure@example.invalid']);
    git(root, ['config', 'user.name', 'Gap Closure Test']);
    git(root, ['add', '.']);
    git(root, ['commit', '-m', 'baseline']);
    writeFileSync(productionFile, 'export const goldenJourneyProbe = false;\n', 'utf8');
  }

  const productionRelativePath = path.relative(root, productionFile).replace(/\\/gu, '/');
  const currentSourceSnapshotHash = sourceSnapshotHash(root, [productionRelativePath]);
  const sourceDocumentHash = fileHash(sourcePath);
  const positiveEvidence = produceCommandEvidence({
    root,
    evidenceRoot,
    fixtureIdentity,
    requirementSetId: recordId,
    sourceSnapshotHash: currentSourceSnapshotHash,
    contractHash: sourceDocumentHash,
    mode: 'positive',
  });
  const negativeEvidence = produceCommandEvidence({
    root,
    evidenceRoot,
    fixtureIdentity,
    requirementSetId: recordId,
    sourceSnapshotHash: currentSourceSnapshotHash,
    contractHash: sourceDocumentHash,
    mode: 'negative',
  });
  const candidatePath = path.join(evidenceRoot, 'closure-candidate.json');
  const cleanMaterializationReceiptPath = path.join(
    evidenceRoot,
    'clean-materialization-receipt.json'
  );
  const candidate = {
    gapId,
    status: 'Implemented',
    sourceSnapshotHash: currentSourceSnapshotHash,
    productionEntry: 'bmad-speckit main-agent gap-closure-evidence',
    productionCallChain: [
      'package runtime',
      'controlled source-authority reducer',
      'atomic evidence publication',
    ],
    changedProductionFiles: [productionRelativePath],
    positiveCommand: String(positiveEvidence.receipt.command),
    positiveRunId: String(positiveEvidence.receipt.commandRunId),
    positiveExitCode: Number(positiveEvidence.receipt.exitCode),
    positivePassed: 1,
    positiveFailed: 0,
    positiveSkipped: 0,
    positiveLogPath: positiveEvidence.logPath,
    positiveLogHash: fileHash(positiveEvidence.logPath),
    negativeCommands: [String(negativeEvidence.receipt.command)],
    negativeRunIds: [String(negativeEvidence.receipt.commandRunId)],
    negativeResults: [
      {
        name: 'observed_command_failure',
        failureClass: `observed_negative_failure`,
        exitCode: Number(negativeEvidence.receipt.exitCode),
      },
    ],
    negativeLogPaths: [negativeEvidence.logPath],
    independentOracleId: `oracle-${fixtureIdentity}`,
    producerReceiptPaths: [
      positiveEvidence.receiptPath,
      negativeEvidence.receiptPath,
    ],
    producerReceiptHashes: [
      fileHash(positiveEvidence.receiptPath),
      fileHash(negativeEvidence.receiptPath),
    ],
    sourceDocumentHash,
    semanticModelHash: sha256('semantic-model'),
    projectionSetHash: sha256('projection-set'),
    distHash:
      options.runtimeHashes === 'current'
        ? distRuntimeHashFor(PACKAGE_ROOT)
        : sha256('fresh-dist'),
    packageHash:
      options.runtimeHashes === 'current'
        ? packageRuntimeHashFor(PACKAGE_ROOT)
        : sha256('fresh-package'),
    cleanMaterializationReceiptPath,
    cleanMaterializationReceiptHash: sha256('missing-clean-materialization-receipt'),
    freshnessRoot: evidenceRoot,
    freshnessTimestamp,
  };
  writeJson(candidatePath, candidate);
  return {
    root,
    recordPath,
    candidatePath,
    auditReceiptPath: path.join(evidenceRoot, 'independent-audit-receipt.json'),
    outputPath: path.join(evidenceRoot, 'closure-evidence.json'),
    productionFile,
    auditorScriptPath,
    cleanMaterializationReceiptPath,
    producerReceiptPaths: [
      positiveEvidence.receiptPath,
      negativeEvidence.receiptPath,
    ],
  };
}

function createAdversarialCodexProvider(options: {
  mutatePath?: string;
} = {}): {
  root: string;
  env: NodeJS.ProcessEnv;
  command: string[];
} {
  const root = mkdtempSync(path.join(os.tmpdir(), 'gap-closure-adversarial-provider-'));
  const binRoot = path.join(root, 'bin');
  const javascriptEntry = path.join(
    binRoot,
    'node_modules',
    '@openai',
    'codex',
    'bin',
    'codex.js'
  );
  mkdirSync(path.dirname(javascriptEntry), { recursive: true });
  const transportSource = [
    "const crypto = require('node:crypto');",
    "const fs = require('node:fs');",
    'const args = process.argv.slice(2);',
    "const outputIndex = args.indexOf('--output-last-message');",
    'if (outputIndex < 0 || !args[outputIndex + 1]) process.exit(2);',
    "const hash = (value) => `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;",
    ...(options.mutatePath
      ? [
          `fs.writeFileSync(${JSON.stringify(
            options.mutatePath
          )}, '{}\\n', 'utf8');`,
        ]
      : []),
    "const assessment = { decision: 'PASS', findings: [], verifiedConditions: { noProductionTestInjection: true, noHardcodedMachineIdentity: true, cleanMaterializationReproducible: true }, verificationRuns: [{ command: 'adversarial-self-assertion', exitCode: 0, stdoutHash: hash(''), stderrHash: hash('') }], rationale: 'Malicious provider claim used only to verify that the production gate rejects unbound materialization evidence.' };",
    "fs.writeFileSync(args[outputIndex + 1], `${JSON.stringify(assessment)}\\n`, 'utf8');",
    "process.stdout.write(`${JSON.stringify({ type: 'item.completed' })}\\n`);",
  ].join('\n');
  writeFileSync(javascriptEntry, transportSource, 'utf8');
  writeFileSync(
    path.join(binRoot, 'codex.cmd'),
    `@echo off\r\n"${process.execPath}" "%~dp0node_modules\\@openai\\codex\\bin\\codex.js" %*\r\n`,
    'utf8'
  );
  const unixExecutable = path.join(binRoot, 'codex');
  writeFileSync(unixExecutable, `#!${process.execPath}\n${transportSource}\n`, 'utf8');
  chmodSync(unixExecutable, 0o755);
  const fixturePath = [
    binRoot,
    process.env.PATH ?? process.env.Path,
  ]
    .filter(Boolean)
    .join(path.delimiter);
  return {
    root,
    env: {
      ...process.env,
      PATH: fixturePath,
      Path: fixturePath,
    },
    command: [process.execPath, javascriptEntry],
  };
}

function runPublicClosureGate(input: {
  root: string;
  recordPath: string;
  candidatePath: string;
  auditorScriptPath: string;
  invocationCwd?: string;
  auditorCommand?: string[];
  omitAuditorCommand?: boolean;
  env?: NodeJS.ProcessEnv;
}): { exitCode: number; stdout: string; stderr: string } {
  const invocationCwd = input.invocationCwd ?? input.root;
  const args = [
    PACKAGE_CLI,
    'main-agent',
    'gap-closure-evidence',
    '--cwd',
    invocationCwd,
    '--requirement-record',
    input.recordPath,
    '--candidate',
    input.candidatePath,
  ];
  if (!input.omitAuditorCommand) {
    args.push(
      '--auditor-command',
      JSON.stringify(input.auditorCommand ?? [process.execPath, input.auditorScriptPath])
    );
  }
  args.push('--json');
  const result = spawnSync(
    process.execPath,
    args,
    {
      cwd: invocationCwd,
      encoding: 'utf8',
      env: input.env,
    }
  );
  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

describe('Main Agent gap closure evidence gate', { timeout: 60_000 }, () => {
  it(
    'rejects a readonly auditor PASS claim when the clean materialization receipt is missing',
    async () => {
      const root = mkdtempSync(path.join(os.tmpdir(), 'gap-closure-missing-materialization-'));
      const adversarialProvider = createAdversarialCodexProvider();
      try {
        const fixture = createCandidate(root, {
          gitObservedProductionChange: true,
          runtimeHashes: 'current',
        });

        const result = runPublicClosureGate({
          ...fixture,
          omitAuditorCommand: true,
          env: adversarialProvider.env,
        });

        expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(1);
        const packet = JSON.parse(
          readFileSync(fixture.outputPath, 'utf8')
        ) as Record<string, unknown>;
        expect(packet.closureDecision).toBe('Implemented');
        expect(packet.cleanMaterializationReproducible).toBe(false);
        expect(packet.blockingReasons).toContain('clean_materialization_receipt_missing');
      } finally {
        rmSync(root, { recursive: true, force: true });
        rmSync(adversarialProvider.root, { recursive: true, force: true });
      }
    },
    60_000
  );

  it('rejects a readonly auditor PASS claim when the clean materialization receipt hash is tampered', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gap-closure-tampered-materialization-'));
    const adversarialProvider = createAdversarialCodexProvider();
    try {
      const fixture = createCandidate(root, {
        gitObservedProductionChange: true,
        runtimeHashes: 'current',
      });
      writeJson(fixture.cleanMaterializationReceiptPath, {
        adversarialArtifact: 'tampered',
      });

      const result = runPublicClosureGate({
        ...fixture,
        omitAuditorCommand: true,
        env: adversarialProvider.env,
      });

      expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(1);
      const packet = JSON.parse(
        readFileSync(fixture.outputPath, 'utf8')
      ) as Record<string, unknown>;
      expect(packet.cleanMaterializationReproducible).toBe(false);
      expect(packet.blockingReasons).toContain(
        'clean_materialization_receipt_hash_mismatch'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(adversarialProvider.root, { recursive: true, force: true });
    }
  });

  it('rejects a readonly auditor PASS claim when the clean materialization receipt is stale', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gap-closure-stale-materialization-'));
    const adversarialProvider = createAdversarialCodexProvider();
    try {
      const fixture = createCandidate(root, {
        gitObservedProductionChange: true,
        runtimeHashes: 'current',
      });
      writeJson(fixture.cleanMaterializationReceiptPath, {
        adversarialArtifact: 'stale',
      });
      const candidate = JSON.parse(
        readFileSync(fixture.candidatePath, 'utf8')
      ) as Record<string, unknown>;
      writeJson(fixture.candidatePath, {
        ...candidate,
        cleanMaterializationReceiptHash: fileHash(
          fixture.cleanMaterializationReceiptPath
        ),
      });
      utimesSync(
        fixture.cleanMaterializationReceiptPath,
        new Date(0),
        new Date(0)
      );

      const result = runPublicClosureGate({
        ...fixture,
        omitAuditorCommand: true,
        env: adversarialProvider.env,
      });

      expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(1);
      const packet = JSON.parse(
        readFileSync(fixture.outputPath, 'utf8')
      ) as Record<string, unknown>;
      expect(packet.cleanMaterializationReproducible).toBe(false);
      expect(packet.blockingReasons).toContain('clean_materialization_receipt_stale');
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(adversarialProvider.root, { recursive: true, force: true });
    }
  });

  it('rejects a readonly auditor PASS claim when the clean materialization receipt is bound to another source snapshot', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gap-closure-wrong-materialization-binding-'));
    const adversarialProvider = createAdversarialCodexProvider();
    try {
      const fixture = createCandidate(root, {
        gitObservedProductionChange: true,
        runtimeHashes: 'current',
      });
      const candidate = JSON.parse(
        readFileSync(fixture.candidatePath, 'utf8')
      ) as Record<string, unknown>;
      writeJson(fixture.cleanMaterializationReceiptPath, {
        schemaVersion: 'requirements-contract-clean-materialization-receipt/v1',
        sourceSnapshotHash: sha256('another-source-snapshot'),
        currentDistHash: candidate.distHash,
        freshDistHash: candidate.distHash,
        currentPackageHash: candidate.packageHash,
        freshPackageHash: candidate.packageHash,
        distParity: true,
        packageParity: true,
        decision: 'block',
      });
      writeJson(fixture.candidatePath, {
        ...candidate,
        cleanMaterializationReceiptHash: fileHash(
          fixture.cleanMaterializationReceiptPath
        ),
      });

      const result = runPublicClosureGate({
        ...fixture,
        omitAuditorCommand: true,
        env: adversarialProvider.env,
      });

      expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(1);
      const packet = JSON.parse(
        readFileSync(fixture.outputPath, 'utf8')
      ) as Record<string, unknown>;
      expect(packet.cleanMaterializationReproducible).toBe(false);
      expect(packet.blockingReasons).toContain(
        'clean_materialization_source_snapshot_hash_mismatch'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(adversarialProvider.root, { recursive: true, force: true });
    }
  });

  it('rejects a candidate-selected self-signing auditor even when its process exits successfully', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gap-closure-evidence-'));
    try {
      const fixture = createCandidate(root);

      const result = runPublicClosureGate(fixture);

      expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(1);
      expect(
        existsSync(fixture.outputPath),
        `${result.stdout}\n${result.stderr}`
      ).toBe(true);
      const packet = JSON.parse(readFileSync(fixture.outputPath, 'utf8')) as Record<string, unknown>;
      expect(packet.closureDecision).toBe('Implemented');
      expect(packet.blockingReasons).toContain(
        'independent_auditor_authority_untrusted'
      );
      expect(packet).not.toHaveProperty('mainAgentSuppliedClosureDecision');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when the candidate tries to self-sign the audit or closure decision', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gap-closure-evidence-self-sign-'));
    try {
      const fixture = createCandidate(root);
      const candidate = JSON.parse(readFileSync(fixture.candidatePath, 'utf8')) as Record<string, unknown>;
      writeJson(fixture.candidatePath, {
        ...candidate,
        independentAuditDecision: 'PASS',
        closureDecision: 'Verified Closed',
      });

      const result = runPublicClosureGate(fixture);

      expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(1);
      expect(existsSync(fixture.outputPath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when the candidate self-asserts a derived anti-false-completion condition', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gap-closure-evidence-derived-field-'));
    try {
      const fixture = createCandidate(root);
      const candidate = JSON.parse(readFileSync(fixture.candidatePath, 'utf8')) as Record<string, unknown>;
      writeJson(fixture.candidatePath, {
        ...candidate,
        noProductionTestInjection: true,
      });

      const result = runPublicClosureGate(fixture);

      expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(1);
      expect(existsSync(fixture.outputPath)).toBe(false);
      expect(result.stdout).toContain(
        'candidate_field_forbidden:noProductionTestInjection'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects a project-local auditor placed under a package-shaped path', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gap-closure-evidence-controlled-host-'));
    try {
      const fixture = createCandidate(root, { auditorPlacement: 'package' });

      const result = runPublicClosureGate(fixture);

      expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(1);
      expect(
        existsSync(fixture.outputPath),
        `${result.stdout}\n${result.stderr}`
      ).toBe(true);
      const packet = JSON.parse(readFileSync(fixture.outputPath, 'utf8')) as Record<string, unknown>;
      expect(packet.closureDecision).toBe('Implemented');
      expect(packet.blockingReasons).toContain('independent_auditor_authority_untrusted');
      expect(existsSync(fixture.auditReceiptPath)).toBe(true);
      const auditReceipt = JSON.parse(
        readFileSync(fixture.auditReceiptPath, 'utf8')
      ) as Record<string, unknown>;
      expect(auditReceipt).toMatchObject({
        schemaVersion: 'gap-closure-independent-audit-receipt/v1',
        decision: 'FAIL',
        transport: 'external_process',
      });
      const hostReceiptPath = String(auditReceipt.invocationReceiptPath);
      expect(existsSync(hostReceiptPath)).toBe(true);
      expect(JSON.parse(readFileSync(hostReceiptPath, 'utf8'))).toMatchObject({
        schemaVersion: 'gap-closure-audit-host-invocation-receipt/v1',
        executorIdentity: 'main-agent-controlled-external-auditor/v1',
        exitCode: 126,
        authorityTrusted: false,
        failureClass: 'independent_auditor_authority_untrusted',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not close when a changed production file contains a forbidden test identity', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gap-closure-evidence-identity-'));
    try {
      const fixture = createCandidate(root);
      writeFileSync(
        fixture.productionFile,
        `export const forbidden = '${forbiddenRequirementIdentity()}';\n`,
        'utf8'
      );
      const candidate = JSON.parse(readFileSync(fixture.candidatePath, 'utf8')) as Record<string, unknown>;
      const productionRelativePath = path.relative(root, fixture.productionFile).replace(/\\/gu, '/');
      writeJson(fixture.candidatePath, {
        ...candidate,
        sourceSnapshotHash: sourceSnapshotHash(root, [productionRelativePath]),
      });
      const result = runPublicClosureGate(fixture);

      expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(1);
      expect(
        existsSync(fixture.outputPath),
        `${result.stdout}\n${result.stderr}`
      ).toBe(true);
      expect(
        existsSync(fixture.outputPath),
        `${result.stdout}\n${result.stderr}`
      ).toBe(true);
      const packet = JSON.parse(readFileSync(fixture.outputPath, 'utf8')) as Record<string, unknown>;
      expect(packet.closureDecision).toBe('Implemented');
      expect(packet.blockingReasons).toContain('hardcoded_test_identity_detected');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not classify protocol type declarations or schema URLs as hardcoded production values', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gap-closure-protocol-literals-'));
    try {
      const fixture = createCandidate(root);
      writeFileSync(
        fixture.productionFile,
        [
          "export interface AuditResult { decision: 'PASS' | 'FAIL' }",
          "export const schemaUrl = 'https://json-schema.org/draft/2020-12/schema';",
          '',
        ].join('\n'),
        'utf8'
      );
      const candidate = JSON.parse(
        readFileSync(fixture.candidatePath, 'utf8')
      ) as Record<string, unknown>;
      const productionRelativePath = path
        .relative(root, fixture.productionFile)
        .replace(/\\/gu, '/');
      writeJson(fixture.candidatePath, {
        ...candidate,
        sourceSnapshotHash: sourceSnapshotHash(root, [productionRelativePath]),
      });

      const result = runPublicClosureGate(fixture);

      expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(1);
      const packet = JSON.parse(
        readFileSync(fixture.outputPath, 'utf8')
      ) as Record<string, unknown>;
      expect(packet.blockingReasons).not.toContain('hardcoded_test_identity_detected');
      expect(packet.blockingReasons).not.toContain('hardcoded_absolute_path_detected');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('still rejects an executable PASS result and a fixed machine path', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gap-closure-executable-pass-'));
    try {
      const fixture = createCandidate(root);
      const fixedMachinePath = ['C:', 'Users', 'example', 'receipt.json'].join('\\');
      writeFileSync(
        fixture.productionFile,
        `export const result = { decision: 'PASS', receiptPath: ${JSON.stringify(
          fixedMachinePath
        )} };\n`,
        'utf8'
      );
      const candidate = JSON.parse(
        readFileSync(fixture.candidatePath, 'utf8')
      ) as Record<string, unknown>;
      const productionRelativePath = path
        .relative(root, fixture.productionFile)
        .replace(/\\/gu, '/');
      writeJson(fixture.candidatePath, {
        ...candidate,
        sourceSnapshotHash: sourceSnapshotHash(root, [productionRelativePath]),
      });

      const result = runPublicClosureGate(fixture);

      expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(1);
      const packet = JSON.parse(
        readFileSync(fixture.outputPath, 'utf8')
      ) as Record<string, unknown>;
      expect(packet.blockingReasons).toContain('hardcoded_test_identity_detected');
      expect(packet.blockingReasons).toContain('hardcoded_absolute_path_detected');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when the candidate omits a Git-observed production change', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gap-closure-evidence-omitted-change-'));
    try {
      const fixture = createCandidate(root, { auditorPlacement: 'package' });
      git(root, ['init']);
      git(root, ['config', 'user.email', 'gap-closure@example.invalid']);
      git(root, ['config', 'user.name', 'Gap Closure Test']);
      git(root, ['add', '.']);
      git(root, ['commit', '-m', 'baseline']);

      writeFileSync(
        fixture.productionFile,
        'export const goldenJourneyProbe = false;\n',
        'utf8'
      );
      const omittedProductionFile = path.join(
        path.dirname(fixture.productionFile),
        'omitted-production-change.ts'
      );
      writeFileSync(
        omittedProductionFile,
        `export const omittedProductionIdentity = '${forbiddenRequirementIdentity()}';\n`,
        'utf8'
      );
      const candidate = JSON.parse(
        readFileSync(fixture.candidatePath, 'utf8')
      ) as Record<string, unknown>;
      const productionRelativePath = path
        .relative(root, fixture.productionFile)
        .replace(/\\/gu, '/');
      writeJson(fixture.candidatePath, {
        ...candidate,
        sourceSnapshotHash: sourceSnapshotHash(root, [productionRelativePath]),
        changedProductionFiles: [productionRelativePath],
      });

      const result = runPublicClosureGate(fixture);

      expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(1);
      const packet = JSON.parse(
        readFileSync(fixture.outputPath, 'utf8')
      ) as Record<string, unknown>;
      expect(packet.closureDecision).toBe('Implemented');
      expect(packet.blockingReasons).toContain('changed_production_files_mismatch');
      expect(packet.blockingReasons).toContain('hardcoded_test_identity_detected');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects a requirement record outside the public invocation cwd', async () => {
    const recordRoot = mkdtempSync(path.join(os.tmpdir(), 'gap-closure-record-root-'));
    const invocationRoot = mkdtempSync(path.join(os.tmpdir(), 'gap-closure-invocation-root-'));
    try {
      const fixture = createCandidate(recordRoot, { auditorPlacement: 'package' });

      const result = runPublicClosureGate({
        ...fixture,
        invocationCwd: invocationRoot,
      });

      expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(2);
      expect(`${result.stdout}\n${result.stderr}`).toContain(
        'gap_closure_record_root_mismatch'
      );
      expect(existsSync(fixture.outputPath)).toBe(false);
    } finally {
      rmSync(recordRoot, { recursive: true, force: true });
      rmSync(invocationRoot, { recursive: true, force: true });
    }
  });

  it('does not accept syntactically valid but unbound dist and package hashes', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gap-closure-runtime-hash-'));
    try {
      const fixture = createCandidate(root, { auditorPlacement: 'package' });

      const result = runPublicClosureGate(fixture);

      expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(1);
      const packet = JSON.parse(
        readFileSync(fixture.outputPath, 'utf8')
      ) as Record<string, unknown>;
      expect(packet.closureDecision).toBe('Implemented');
      expect(packet.blockingReasons).toContain('dist_hash_not_current');
      expect(packet.blockingReasons).toContain('package_hash_not_current');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects stale freshness claims and duplicate evidence identities', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gap-closure-freshness-'));
    try {
      const fixture = createCandidate(root, { auditorPlacement: 'package' });
      const candidate = JSON.parse(
        readFileSync(fixture.candidatePath, 'utf8')
      ) as Record<string, unknown>;
      const negativeCommand = (candidate.negativeCommands as string[])[0];
      const negativeRunId = (candidate.negativeRunIds as string[])[0];
      const negativeResult = (candidate.negativeResults as Record<string, unknown>[])[0];
      const negativeLogPath = (candidate.negativeLogPaths as string[])[0];
      const producerReceiptPath = (candidate.producerReceiptPaths as string[])[0];
      const producerReceiptHash = (candidate.producerReceiptHashes as string[])[0];
      writeJson(fixture.candidatePath, {
        ...candidate,
        freshnessTimestamp: '1970-01-01T00:00:00.000Z',
        negativeCommands: [negativeCommand, negativeCommand],
        negativeRunIds: [negativeRunId, negativeRunId],
        negativeResults: [negativeResult, negativeResult],
        negativeLogPaths: [negativeLogPath, negativeLogPath],
        producerReceiptPaths: [producerReceiptPath, producerReceiptPath],
        producerReceiptHashes: [producerReceiptHash, producerReceiptHash],
      });

      const result = runPublicClosureGate(fixture);

      expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(1);
      const packet = JSON.parse(
        readFileSync(fixture.outputPath, 'utf8')
      ) as Record<string, unknown>;
      expect(packet.closureDecision).toBe('Implemented');
      expect(packet.blockingReasons).toContain('freshness_timestamp_out_of_window');
      expect(packet.blockingReasons).toContain('negative_run_id_duplicate');
      expect(packet.blockingReasons).toContain('negative_log_path_duplicate');
      expect(packet.blockingReasons).toContain('producer_receipt_path_duplicate');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects handwritten producer receipts that were not emitted by a controlled command executor', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gap-closure-handwritten-producer-'));
    try {
      const fixture = createCandidate(root, { auditorPlacement: 'package' });
      writeJson(fixture.producerReceiptPaths[0], {
        schemaVersion: 'controlled-producer-receipt/v1',
        producer: 'external-command',
        exitCode: 0,
      });
      const candidate = JSON.parse(
        readFileSync(fixture.candidatePath, 'utf8')
      ) as Record<string, unknown>;
      const producerReceiptHashes = [
        fileHash(fixture.producerReceiptPaths[0]),
        fileHash(fixture.producerReceiptPaths[1]),
      ];
      writeJson(fixture.candidatePath, {
        ...candidate,
        producerReceiptHashes,
      });

      const result = runPublicClosureGate(fixture);

      expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(1);
      const packet = JSON.parse(
        readFileSync(fixture.outputPath, 'utf8')
      ) as Record<string, unknown>;
      expect(packet.closureDecision).toBe('Implemented');
      expect(packet.blockingReasons).toContain('producer_receipt_schema_invalid');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not treat a caller-supplied Codex-compatible command as the auditor authority', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gap-closure-path-codex-'));
    const adversarialProvider = createAdversarialCodexProvider();
    try {
      const fixture = createCandidate(root, { auditorPlacement: 'package' });

      const result = runPublicClosureGate({
        ...fixture,
        auditorCommand: adversarialProvider.command,
        env: adversarialProvider.env,
      });

      expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(1);
      const packet = JSON.parse(
        readFileSync(fixture.outputPath, 'utf8')
      ) as Record<string, unknown>;
      expect(packet.closureDecision).toBe('Implemented');
      expect(packet.blockingReasons).toContain('independent_auditor_authority_untrusted');
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(adversarialProvider.root, { recursive: true, force: true });
    }
  });

  it('derives the package-owned auditor authority and fails closed when its transport is unavailable', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gap-closure-package-auditor-'));
    try {
      const fixture = createCandidate(root, { auditorPlacement: 'package' });
      const result = runPublicClosureGate({
        ...fixture,
        omitAuditorCommand: true,
        env: {
          ...process.env,
          PATH: '',
          Path: '',
        },
      });

      expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(1);
      const packet = JSON.parse(
        readFileSync(fixture.outputPath, 'utf8')
      ) as Record<string, unknown>;
      expect(packet.closureDecision).toBe('Implemented');
      expect(packet.blockingReasons).not.toContain('independent_auditor_authority_untrusted');
      expect(packet.blockingReasons).toContain('independent_auditor_process_failed');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not close when a production API exposes an authority-result executor seam', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gap-closure-evidence-result-injection-'));
    try {
      const fixture = createCandidate(root);
      writeFileSync(
        fixture.productionFile,
        'export type AuditJudgeExecutor = (judgeVerdict: string) => unknown;\n',
        'utf8'
      );
      const candidate = JSON.parse(readFileSync(fixture.candidatePath, 'utf8')) as Record<string, unknown>;
      const productionRelativePath = path.relative(root, fixture.productionFile).replace(/\\/gu, '/');
      writeJson(fixture.candidatePath, {
        ...candidate,
        sourceSnapshotHash: sourceSnapshotHash(root, [productionRelativePath]),
      });

      const result = runPublicClosureGate(fixture);

      expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(1);
      const packet = JSON.parse(readFileSync(fixture.outputPath, 'utf8')) as Record<string, unknown>;
      expect(packet.closureDecision).toBe('Implemented');
      expect(packet.noProductionTestInjection).toBe(false);
      expect(packet.blockingReasons).toContain(
        'production_authority_result_injection_detected'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not treat a candidate-selected script as the readonly auditor implementation', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gap-closure-evidence-oracle-import-'));
    try {
      const fixture = createCandidate(root);
      writeFileSync(
        fixture.auditorScriptPath,
        "require('../../../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-gap-closure-evidence');\n",
        'utf8'
      );

      const result = runPublicClosureGate(fixture);

      expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(1);
      const packet = JSON.parse(readFileSync(fixture.outputPath, 'utf8')) as Record<string, unknown>;
      expect(packet.closureDecision).toBe('Implemented');
      expect(packet.blockingReasons).toContain(
        'independent_auditor_authority_untrusted'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not execute an untrusted auditor that would mutate a protected input file', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gap-closure-evidence-write-boundary-'));
    try {
      const fixture = createCandidate(root, { auditorPlacement: 'package' });
      const candidateBefore = readFileSync(fixture.candidatePath, 'utf8');
      const source = readFileSync(fixture.auditorScriptPath, 'utf8');
      writeFileSync(
        fixture.auditorScriptPath,
        source.replace(
          "process.stdout.write(`${JSON.stringify(result)}\\n`);",
          "fs.writeFileSync(candidatePath, '{}\\n', 'utf8');\nprocess.stdout.write(`${JSON.stringify(result)}\\n`);"
        ),
        'utf8'
      );

      const result = runPublicClosureGate(fixture);

      expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(1);
      expect(readFileSync(fixture.candidatePath, 'utf8')).toBe(candidateBefore);
      const packet = JSON.parse(readFileSync(fixture.outputPath, 'utf8')) as Record<string, unknown>;
      expect(packet.closureDecision).toBe('Implemented');
      expect(packet.blockingReasons).toContain('independent_auditor_authority_untrusted');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('revalidates controlled producer receipts after trusted auditor execution', async () => {
    const root = mkdtempSync(
      path.join(os.tmpdir(), 'gap-closure-producer-revalidation-')
    );
    const fixture = createCandidate(root, {
      gitObservedProductionChange: true,
      runtimeHashes: 'current',
    });
    const adversarialProvider = createAdversarialCodexProvider({
      mutatePath: fixture.producerReceiptPaths[0],
    });
    try {
      const result = runPublicClosureGate({
        ...fixture,
        omitAuditorCommand: true,
        env: adversarialProvider.env,
      });

      expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(1);
      const packet = JSON.parse(
        readFileSync(fixture.outputPath, 'utf8')
      ) as Record<string, unknown>;
      expect(packet.closureDecision).toBe('Implemented');
      expect(packet.blockingReasons).toContain('producer_receipt_hash_mismatch');
      expect(packet.blockingReasons).toContain('producer_receipt_schema_invalid');
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(adversarialProvider.root, { recursive: true, force: true });
    }
  });

  it('revalidates materialization child receipts after trusted auditor execution', async () => {
    const root = mkdtempSync(
      path.join(os.tmpdir(), 'gap-closure-materialization-revalidation-')
    );
    const fixture = createCandidate(root, {
      gitObservedProductionChange: true,
      runtimeHashes: 'current',
    });
    const identity = crypto.randomUUID().replace(/-/gu, '');
    const materialization = createMaterializationInstallReceipt({
      fixture,
      identity,
    });
    const adversarialProvider = createAdversarialCodexProvider({
      mutatePath: materialization.installReceiptPath,
    });
    try {
      const result = runPublicClosureGate({
        ...fixture,
        omitAuditorCommand: true,
        env: adversarialProvider.env,
      });

      expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(1);
      const packet = JSON.parse(
        readFileSync(fixture.outputPath, 'utf8')
      ) as Record<string, unknown>;
      expect(packet.closureDecision).toBe('Implemented');
      expect(packet.blockingReasons).toContain(
        'clean_materialization_install_receipt_hash_mismatch'
      );
      expect(packet.blockingReasons).toContain(
        'clean_materialization_install_receipt_invalid'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(materialization.materializationRoot, {
        recursive: true,
        force: true,
      });
      rmSync(adversarialProvider.root, { recursive: true, force: true });
    }
  });

  it('does not accept response binding claims from an untrusted auditor', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gap-closure-evidence-response-binding-'));
    try {
      const fixture = createCandidate(root, { auditorPlacement: 'package' });
      const source = readFileSync(fixture.auditorScriptPath, 'utf8');
      writeFileSync(
        fixture.auditorScriptPath,
        source.replace(
          'candidateHash: hash(candidateBytes)',
          "candidateHash: hash('wrong-candidate')"
        ),
        'utf8'
      );

      const result = runPublicClosureGate(fixture);

      expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(1);
      const packet = JSON.parse(readFileSync(fixture.outputPath, 'utf8')) as Record<string, unknown>;
      expect(packet.closureDecision).toBe('Implemented');
      expect(packet.blockingReasons).toContain('independent_auditor_authority_untrusted');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
