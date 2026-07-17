const { describe, it } = require('node:test');
const assert = require('node:assert');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const Ajv = require('ajv');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const PACKAGE_CLI = path.join(PACKAGE_ROOT, 'bin', 'bmad-speckit.js');
const COMMAND = 'requirements-contract-six-model-projection-parity-verify';
const PRODUCER_DIST = path.join(
  PACKAGE_ROOT,
  'dist',
  'main-agent',
  'source-authority',
  'scripts',
  'requirements-contract-six-model-projection-parity-observation-producer.js'
);
const VERIFIER_DIST = path.join(
  PACKAGE_ROOT,
  'dist',
  'main-agent',
  'source-authority',
  'scripts',
  'requirements-contract-six-model-projection-parity-verifier.js'
);
const PRODUCER_SOURCE = path.join(
  PACKAGE_ROOT,
  'src',
  'main-agent',
  'source-authority',
  'scripts',
  'requirements-contract-six-model-projection-parity-observation-producer.ts'
);
const VERIFIER_SOURCE = path.join(
  PACKAGE_ROOT,
  'src',
  'main-agent',
  'source-authority',
  'scripts',
  'requirements-contract-six-model-projection-parity-verifier.ts'
);
const REPORT_SCHEMA_RELATIVE = path.join(
  'dist',
  'main-agent',
  'source-authority',
  'schemas',
  'requirements-contract-six-model-projection-parity-report.schema.json'
);
const OBSERVATION_SCHEMA_RELATIVE = path.join(
  'dist',
  'main-agent',
  'source-authority',
  'schemas',
  'requirements-contract-six-model-projection-parity-observation.schema.json'
);
const PUBLICATION_RECEIPT_SCHEMA_RELATIVE = path.join(
  'dist',
  'main-agent',
  'source-authority',
  'schemas',
  'requirements-contract-six-model-projection-parity-publication-receipt.schema.json'
);
const CONTRACT_PATH = path.join(
  REPO_ROOT,
  'docs',
  'plans',
  '2026-07-11-loop-engineering-evidence-closure-remediation-goal-execution-plan.md'
);
const CONTRACT_HASH = 'sha256:d6f39af7a0995a16496913b2e224445a2a440e5ecf285e54f66b1fdaa46652c4';
const MODEL_ORDER = [
  'requirement_confirmation',
  'architecture_confirmation',
  'implementation_readiness',
  'execution_closure',
  'audit_review',
  'delivery_confirmation',
];
const SURFACES = [
  'source',
  'package-dist',
  'codex',
  'cursor',
  'claude',
  'installed',
  'generated-dist',
  'packed-package',
  'root-host',
];
const CASES = [
  'valid_receipt',
  'missing_receipt',
  'missing_projection',
  'projection_mismatch',
  'stale_attempt',
  'blocked_receipt',
  'synthetic_bridge',
  'complete_panorama',
];
const ZERO_COUNTS = {
  facade: 0,
  receipt: 0,
  projection: 0,
  bridge: 0,
  panorama: 0,
};
const OBSERVATION_PRODUCER = 'requirements-contract-six-model-projection-parity-observation-producer';
const OBSERVATION_ACTION = 'requirements-contract-six-model-projection-parity-observe';
const CASE_PRODUCER = 'requirements-contract-six-model-projection-parity-case-runner';
const VERIFIER_PRODUCER = 'requirements-contract-six-model-projection-parity-verifier';
const VERIFIER_ACTION = 'requirements-contract-six-model-projection-parity-verify';
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const tarCommand = process.platform === 'win32' ? 'tar.exe' : 'tar';

function contractCells(line) {
  return line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function deriveParityContractBinding() {
  const lines = fs.readFileSync(CONTRACT_PATH, 'utf8').split(/\r?\n/u);
  const commandLine = lines.find(
    (line) =>
      /^\| CMD-\d+ \|/u.test(line) &&
      line.includes('requirements-contract-six-model-projection-parity-verify')
  );
  assert.ok(commandLine, 'frozen parity command row is missing');
  const commandRow = contractCells(commandLine);
  const commandId = commandRow[0];
  const acceptanceRefs = Array.from(
    new Set(commandRow.at(-1).match(/AC-\d+/gu) || [])
  );
  const traceRefs = lines
    .filter(
      (line) =>
        /^\| TR-\d+ \|/u.test(line) &&
        line.includes(`| ${commandId} |`) &&
        line.includes('ARTIFACT-45')
    )
    .map((line) => contractCells(line)[0]);
  assert.ok(acceptanceRefs.length > 0, 'parity command acceptance refs are missing');
  assert.ok(traceRefs.length > 0, 'parity command trace refs are missing');
  return { commandId, acceptanceRefs, traceRefs };
}

const PARITY_CONTRACT_BINDING = deriveParityContractBinding();

function writeJson(target, value) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function relativeFileRef(root, target) {
  const bytes = fs.readFileSync(target);
  const hash = sha256(bytes);
  return {
    path: path.relative(root, target).replace(/\\/g, '/'),
    hash,
    readbackHash: sha256(fs.readFileSync(target)),
    readbackVerified: true,
  };
}

function mutateObservation(evidenceRoot, surface, mutate) {
  const target = path.join(evidenceRoot, 'observations', `${surface}.json`);
  const observation = JSON.parse(fs.readFileSync(target, 'utf8'));
  mutate(observation);
  writeJson(target, observation);
}

function expectedCaseOutcome(caseId) {
  const outcomes = {
    valid_receipt: {
      effectiveStatus: 'pass',
      projectionStatus: 'pass',
      projectionIntegrity: 'valid',
      receiptState: 'valid',
      authorityClass: 'controlled_confirmation',
      syntheticBridgePass: false,
    },
    missing_receipt: {
      effectiveStatus: 'not_established',
      projectionStatus: 'pass',
      projectionIntegrity: 'missing',
      receiptState: 'missing',
      authorityClass: 'none',
      syntheticBridgePass: false,
    },
    missing_projection: {
      effectiveStatus: 'not_established',
      projectionStatus: null,
      projectionIntegrity: 'missing',
      receiptState: 'valid',
      authorityClass: 'none',
      syntheticBridgePass: false,
    },
    projection_mismatch: {
      effectiveStatus: 'blocked',
      projectionStatus: 'blocked',
      projectionIntegrity: 'mismatch',
      receiptState: 'valid',
      authorityClass: 'controlled_confirmation',
      syntheticBridgePass: false,
    },
    stale_attempt: {
      effectiveStatus: 'stale',
      projectionStatus: 'pass',
      projectionIntegrity: 'stale',
      receiptState: 'stale',
      authorityClass: 'controlled_confirmation',
      syntheticBridgePass: false,
    },
    blocked_receipt: {
      effectiveStatus: 'blocked',
      projectionStatus: 'blocked',
      projectionIntegrity: 'valid',
      receiptState: 'blocked',
      authorityClass: 'deterministic_gate',
      syntheticBridgePass: false,
    },
    synthetic_bridge: {
      effectiveStatus: 'not_established',
      projectionStatus: 'not_established',
      projectionIntegrity: 'missing',
      receiptState: 'missing',
      authorityClass: 'none',
      syntheticBridgePass: false,
    },
    complete_panorama: {
      effectiveStatus: 'not_established',
      projectionStatus: null,
      projectionIntegrity: 'missing',
      receiptState: 'missing',
      authorityClass: 'none',
      syntheticBridgePass: false,
      panoramaModelOrder: MODEL_ORDER,
      panoramaRowCount: 6,
    },
  };
  return structuredClone(outcomes[caseId]);
}

function createSurfaceCell(
  evidenceRoot,
  surface,
  context,
  overrides = {}
) {
  const surfaceRoot = overrides.surfaceRoot || path.join(evidenceRoot, 'surfaces', surface);
  const artifactPath = overrides.artifactPath || path.join(surfaceRoot, 'runtime-artifact.js');
  const readerPath = overrides.readerPath || path.join(surfaceRoot, 'verified-status-reader.js');
  const writerPath = overrides.writerPath || path.join(surfaceRoot, 'controlled-status-writer.js');
  for (const [target, content] of [
    [artifactPath, `${surface}:artifact\n`],
    [readerPath, `${surface}:reader\n`],
    [writerPath, `${surface}:writer\n`],
  ]) {
    if (!fs.existsSync(target)) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content, 'utf8');
    }
  }
  const proofRoot = path.join(evidenceRoot, 'proofs', surface);
  const controlledReceiptRoot = path.join(evidenceRoot, 'controlled-command-receipts', surface);
  const behaviorObservationRoot = path.join(evidenceRoot, 'behavior-observations', surface);
  const commandOutputRoot = path.join(evidenceRoot, 'command-output', surface);
  for (const [caseIndex, caseId] of CASES.entries()) {
    const behaviorObservationPath = path.join(behaviorObservationRoot, `${caseId}.json`);
    writeJson(behaviorObservationPath, {
      schemaVersion: 'requirements-contract-six-model-projection-parity-behavior-observation/v1',
      producer: CASE_PRODUCER,
      action: `run:${caseId}`,
      surface,
      caseId,
      contractHash: context.contractHash,
      requirementSetId: context.requirementSetId,
      implementationAttemptId: context.implementationAttemptId,
      observedAt: context.observedAt,
      outcome: expectedCaseOutcome(caseId),
    });
    const stderrPath = path.join(commandOutputRoot, `${caseId}.stderr.txt`);
    fs.mkdirSync(path.dirname(stderrPath), { recursive: true });
    fs.writeFileSync(stderrPath, '', 'utf8');
    const controlledReceiptPath = path.join(controlledReceiptRoot, `${caseId}.json`);
    const argv = [
      ...context.commandBinding.argvPrefix,
      '--surface',
      surface,
      '--case',
      caseId,
    ];
    const childArgv = [...argv, '--emit-behavior-observation'];
    writeJson(controlledReceiptPath, {
      schemaVersion: 'requirements-contract-controlled-command-receipt/v1',
      commandRunId: `RUN-${surface}-${caseId}`,
      invocationSequence: SURFACES.indexOf(surface) * CASES.length + caseIndex + 1,
      commandId: context.commandBinding.commandId,
      argv,
      argvHash: sha256(Buffer.from(JSON.stringify(argv), 'utf8')),
      orderedChildren: [
        {
          argv: childArgv,
          argvHash: sha256(Buffer.from(JSON.stringify(childArgv), 'utf8')),
          cwd: context.commandBinding.cwd,
          startedAt: context.observedAt,
          endedAt: context.observedAt,
          exitCode: 0,
          stdoutPath: path.relative(evidenceRoot, behaviorObservationPath).replace(/\\/g, '/'),
          stdoutHash: sha256(fs.readFileSync(behaviorObservationPath)),
          stderrPath: path.relative(evidenceRoot, stderrPath).replace(/\\/g, '/'),
          stderrHash: sha256(fs.readFileSync(stderrPath)),
        },
      ],
      cwd: context.commandBinding.cwd,
      executorIdentity: {
        ...context.commandBinding.executorIdentity,
      },
      hostIdentity: {
        platform: process.platform,
        architecture: process.arch,
        nodeVersion: process.version,
      },
      transactionId: context.transactionId,
      implementationAttemptId: context.implementationAttemptId,
      architectureAuditAttemptId: context.architectureAuditAttemptId,
      activePhaseAuditAttemptId: context.activePhaseAuditAttemptId,
      contractHash: context.contractHash,
      inputSnapshotHash: context.inputSnapshotHash,
      startedAt: context.observedAt,
      endedAt: context.observedAt,
      exitCode: 0,
      signal: null,
      stdoutPath: path.relative(evidenceRoot, behaviorObservationPath).replace(/\\/g, '/'),
      stdoutHash: sha256(fs.readFileSync(behaviorObservationPath)),
      stderrPath: path.relative(evidenceRoot, stderrPath).replace(/\\/g, '/'),
      stderrHash: sha256(fs.readFileSync(stderrPath)),
      acceptanceRefs: context.commandBinding.acceptanceRefs,
      traceRefs: context.commandBinding.traceRefs,
      publication: {
        writer: 'goal-controlled-executor',
        targetPath: path.relative(evidenceRoot, controlledReceiptPath).replace(/\\/g, '/'),
        publishedAt: context.observedAt,
        readbackAt: context.observedAt,
        explicitUtf8: true,
        createOnly: true,
        readbackVerified: true,
      },
      decision: 'pass',
      passAuthorityScope: 'command_only',
    });
    writeJson(path.join(proofRoot, `${caseId}.json`), {
      schemaVersion: 'requirements-contract-six-model-projection-parity-case-proof/v2',
      producer: CASE_PRODUCER,
      action: `run:${caseId}`,
      surface,
      caseId,
      contractHash: context.contractHash,
      requirementSetId: context.requirementSetId,
      implementationAttemptId: context.implementationAttemptId,
      observedAt: context.observedAt,
      controlledCommandReceiptRef: relativeFileRef(evidenceRoot, controlledReceiptPath),
      behaviorObservationRef: relativeFileRef(evidenceRoot, behaviorObservationPath),
    });
  }
  return {
    surface,
    applicability: { applicable: true, reason: null },
    surfaceRoot: path.relative(evidenceRoot, surfaceRoot).replace(/\\/g, '/'),
    artifactPath: path.relative(evidenceRoot, artifactPath).replace(/\\/g, '/'),
    readerPaths: [path.relative(evidenceRoot, readerPath).replace(/\\/g, '/')],
    writerPaths: [path.relative(evidenceRoot, writerPath).replace(/\\/g, '/')],
    proofRoot: path.relative(evidenceRoot, proofRoot).replace(/\\/g, '/'),
    controlledReceiptRoot: path.relative(evidenceRoot, controlledReceiptRoot).replace(/\\/g, '/'),
    behaviorObservationRoot: path
      .relative(evidenceRoot, behaviorObservationRoot)
      .replace(/\\/g, '/'),
  };
}

function materializeEvidenceRoot(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmads-six-model-installed-parity-'));
  const evidenceRoot = path.join(root, 'evidence');
  const observedAt = options.observedAt || new Date().toISOString();
  const identity = path.basename(root).replace(/[^A-Za-z0-9._-]/gu, '-');
  const requirementSetId = `REQSET-${identity}`;
  const transactionId = `TX-${identity}`;
  const implementationAttemptId = options.implementationAttemptId || `IMP-${identity}`;
  const architectureAuditAttemptId = `AUDIT-ARCH-${identity}`;
  const activePhaseAuditAttemptId = `AUDIT-PHASE-${identity}`;
  const inputSnapshotPath = path.join(evidenceRoot, 'input-snapshot.json');
  const contractHash = options.contractHash || CONTRACT_HASH;
  writeJson(inputSnapshotPath, {
    contractHash,
    requirementSetId,
    transactionId,
    implementationAttemptId,
    architectureAuditAttemptId,
    activePhaseAuditAttemptId,
  });
  const commandBinding = {
    ...PARITY_CONTRACT_BINDING,
    cwd: evidenceRoot,
    argvPrefix: [process.execPath, 'requirements-contract-six-model-projection-parity-case-runner'],
    executorIdentity: {
      class: 'goal_controlled_executor',
      id: `executor-${identity}`,
    },
  };
  const context = {
    root,
    contractHash,
    observedAt,
    requirementSetId,
    transactionId,
    implementationAttemptId,
    architectureAuditAttemptId,
    activePhaseAuditAttemptId,
    inputSnapshotHash: sha256(fs.readFileSync(inputSnapshotPath)),
    commandBinding,
  };
  const cells = SURFACES.map((surface) =>
    createSurfaceCell(
      evidenceRoot,
      surface,
      context,
      options.surfaceOverrides?.[surface]
    )
  );
  writeJson(path.join(evidenceRoot, 'parity-authority.json'), {
    schemaVersion: 'requirements-contract-six-model-projection-parity-authority/v1',
    contractHash,
    requirementSetId,
    transactionId,
    implementationAttemptId,
    architectureAuditAttemptId,
    activePhaseAuditAttemptId,
    inputSnapshotHash: context.inputSnapshotHash,
    commandBinding,
    producer: OBSERVATION_PRODUCER,
    action: OBSERVATION_ACTION,
    caseProducer: CASE_PRODUCER,
    modelOrder: MODEL_ORDER,
    exactCases: CASES,
    surfaces: SURFACES,
    maxObservationAgeMs: 60 * 60 * 1000,
    maxClockSkewMs: 5 * 60 * 1000,
    cells,
  });
  const producer = require(PRODUCER_DIST);
  for (const surface of SURFACES) {
    producer.produceRequirementsContractSixModelProjectionParityObservation({
      evidenceRoot,
      surface,
      observedAt,
    });
  }
  return {
    root,
    evidenceRoot,
    producer,
    contractHash,
    requirementSetId,
    transactionId,
    implementationAttemptId,
    architectureAuditAttemptId,
    activePhaseAuditAttemptId,
  };
}

function materializeSelfReportedEvidenceRoot() {
  const fixture = materializeEvidenceRoot();
  for (const surface of SURFACES) {
    writeJson(path.join(fixture.evidenceRoot, 'observations', `${surface}.json`), {
      schemaVersion: 'requirements-contract-six-model-projection-parity-observation/v1',
      surface,
      modelOrder: MODEL_ORDER,
      counts: ZERO_COUNTS,
      coverage: 1,
    });
  }
  return fixture;
}

function runVerifier(cliPath, evidenceRoot, out, options = {}) {
  return spawnSync(
    process.execPath,
    [cliPath, COMMAND, '--evidence-root', evidenceRoot, '--out', out, '--json'],
    {
      cwd: options.cwd || PACKAGE_ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        RUST_BACKTRACE: '1',
        ...(options.nodeOptions ? { NODE_OPTIONS: options.nodeOptions } : {}),
        ...(options.env || {}),
      },
      timeout: 60_000,
    }
  );
}

function expectProcessSuccess(result, label) {
  assert.equal(
    result.status,
    0,
    `${label}\nSTDOUT:\n${result.stdout || ''}\nSTDERR:\n${result.stderr || result.error?.message || ''}`
  );
  return result;
}

function parseNpmPackFilename(stdout) {
  const parsed = JSON.parse(String(stdout || '').trim());
  assert.ok(Array.isArray(parsed) && parsed.length === 1, `unexpected npm pack output: ${stdout}`);
  assert.equal(typeof parsed[0].filename, 'string');
  return parsed[0].filename;
}

function readTarMember(tarball, memberPath) {
  return expectProcessSuccess(
    spawnSync(tarCommand, ['-xOf', tarball, memberPath], {
      encoding: 'utf8',
      env: { ...process.env, RUST_BACKTRACE: '1' },
      timeout: 60_000,
    }),
    `failed to read packed member: ${memberPath}`
  ).stdout;
}

function assertNoFrozenParityAuthorityConstants(surfaces) {
  const forbiddenTokens = [
    CONTRACT_HASH.slice('sha256:'.length),
    'SIX_MODEL_PARITY_CONTRACT_HASH',
  ];
  for (const surface of surfaces) {
    for (const token of forbiddenTokens) {
      assert.equal(
        surface.content.includes(token),
        false,
        `${surface.label} contains forbidden production authority token: ${token}`
      );
    }
  }
}

function materializeInstalledPackage(root) {
  const packRoot = path.join(root, 'pack');
  const consumerRoot = path.join(root, 'consumer');
  fs.mkdirSync(packRoot, { recursive: true });
  fs.mkdirSync(consumerRoot, { recursive: true });
  writeJson(path.join(consumerRoot, 'package.json'), {
    name: 'bmads-six-model-installed-parity-consumer',
    version: '1.0.0',
    private: true,
  });
  const pack = expectProcessSuccess(
    spawnSync(
      npmCommand,
      ['pack', '--ignore-scripts', '--json', '--pack-destination', packRoot],
      {
        cwd: PACKAGE_ROOT,
        encoding: 'utf8',
        shell: process.platform === 'win32',
        env: {
          ...process.env,
          RUST_BACKTRACE: '1',
          npm_config_loglevel: 'error',
        },
        maxBuffer: 64 * 1024 * 1024,
        timeout: 180_000,
      }
    ),
    'npm pack failed'
  );
  const tarball = path.join(packRoot, parseNpmPackFilename(pack.stdout));
  expectProcessSuccess(
    spawnSync(
      npmCommand,
      [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--no-package-lock',
        '--no-save',
        tarball,
      ],
      {
        cwd: consumerRoot,
        encoding: 'utf8',
        shell: process.platform === 'win32',
        env: {
          ...process.env,
          RUST_BACKTRACE: '1',
          npm_config_loglevel: 'error',
          BMAD_SKIP_CONSUMER_MCP_INSTALL: '1',
        },
        timeout: 300_000,
      }
    ),
    'npm install from packed package failed'
  );
  const installedRoot = path.join(consumerRoot, 'node_modules', 'bmad-speckit');
  assert.equal(fs.lstatSync(installedRoot).isSymbolicLink(), false);
  for (const sourceFallback of [
    path.join(installedRoot, 'src'),
    path.join(installedRoot, 'tests'),
    path.join(
      installedRoot,
      'dist',
      'main-agent',
      'source-authority',
      'packages',
      'bmad-speckit',
      'src'
    ),
  ]) {
    fs.rmSync(sourceFallback, { recursive: true, force: true });
  }
  const probeLog = path.join(consumerRoot, 'source-fallback-probe.ndjson');
  const probePath = path.join(consumerRoot, 'source-fallback-probe.cjs');
  fs.writeFileSync(
    probePath,
    [
      "const fs = require('node:fs');",
      "const Module = require('node:module');",
      "const childProcess = require('node:child_process');",
      `const logPath = ${JSON.stringify(probeLog)};`,
      "const forbidden = /(?:^|[\\\\/])src[\\\\/]|\\.tsx?$|\\btsx\\b|\\bts-node\\b|main-agent-orchestration\\.ts/i;",
      "function reject(kind, value) {",
      "  const text = String(value || '');",
      "  if (!forbidden.test(text)) return;",
      "  fs.appendFileSync(logPath, `${JSON.stringify({ kind, value: text })}\\n`, 'utf8');",
      "  throw new Error(`forbidden source fallback: ${text}`);",
      "}",
      "const originalLoad = Module._load;",
      "Module._load = function(request, parent, isMain) {",
      "  reject('module-load', request);",
      "  return originalLoad.call(this, request, parent, isMain);",
      "};",
      "for (const method of ['spawn', 'spawnSync', 'execFile', 'execFileSync']) {",
      "  const original = childProcess[method];",
      "  childProcess[method] = function(command, args, ...rest) {",
      "    reject(`child-${method}`, [command, ...(Array.isArray(args) ? args : [])].join(' '));",
      "    return original.call(this, command, args, ...rest);",
      "  };",
      "}",
      '',
    ].join('\n'),
    'utf8'
  );
  return {
    cli: path.join(installedRoot, 'bin', 'bmad-speckit.js'),
    root: installedRoot,
    consumerRoot,
    tarball,
    probeLog,
    probePath,
  };
}

function reproduceObservation(fixture, surface, observedAt = new Date().toISOString()) {
  fixture.producer.produceRequirementsContractSixModelProjectionParityObservation({
    evidenceRoot: fixture.evidenceRoot,
    surface,
    observedAt,
  });
}

function mutateJson(target, mutate) {
  const value = JSON.parse(fs.readFileSync(target, 'utf8'));
  mutate(value);
  writeJson(target, value);
  return value;
}

function assertReportMatchesSchema(report, schemaPath) {
  const validate = new Ajv({ strict: false }).compile(
    JSON.parse(fs.readFileSync(schemaPath, 'utf8'))
  );
  assert.equal(validate(report), true, JSON.stringify(validate.errors));
}

function parseSummary(result) {
  assert.equal(
    result.status,
    0,
    `expected parity verifier success\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
  );
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}

function parseBlockedSummary(result) {
  assert.notEqual(result.status, 0, `expected BLOCK exit\nSTDOUT:\n${result.stdout}`);
  assert.equal(result.stderr, '');
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.decision, 'BLOCK');
  return summary;
}

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function observationPath(evidenceRoot, surface) {
  return path.join(evidenceRoot, 'observations', `${surface}.json`);
}

function caseProofPath(evidenceRoot, surface, caseId) {
  return path.join(evidenceRoot, 'proofs', surface, `${caseId}.json`);
}

function mutateCaseBehaviorObservation(fixture, surface, caseId, mutate) {
  const behaviorPath = path.join(
    fixture.evidenceRoot,
    'behavior-observations',
    surface,
    `${caseId}.json`
  );
  mutateJson(behaviorPath, mutate);
  const behaviorHash = sha256(fs.readFileSync(behaviorPath));
  const controlledReceiptPath = path.join(
    fixture.evidenceRoot,
    'controlled-command-receipts',
    surface,
    `${caseId}.json`
  );
  mutateJson(controlledReceiptPath, (receipt) => {
    receipt.stdoutHash = behaviorHash;
    receipt.orderedChildren.at(-1).stdoutHash = behaviorHash;
  });
  mutateJson(caseProofPath(fixture.evidenceRoot, surface, caseId), (proof) => {
    proof.behaviorObservationRef = relativeFileRef(fixture.evidenceRoot, behaviorPath);
    proof.controlledCommandReceiptRef = relativeFileRef(
      fixture.evidenceRoot,
      controlledReceiptPath
    );
  });
  reproduceObservation(fixture, surface);
}

function refreshNestedCaseProofChain(fixture, surface, caseId) {
  const controlledReceiptPath = path.join(
    fixture.evidenceRoot,
    'controlled-command-receipts',
    surface,
    `${caseId}.json`
  );
  const behaviorObservationPath = path.join(
    fixture.evidenceRoot,
    'behavior-observations',
    surface,
    `${caseId}.json`
  );
  const proofPath = caseProofPath(fixture.evidenceRoot, surface, caseId);
  mutateJson(proofPath, (proof) => {
    proof.controlledCommandReceiptRef = relativeFileRef(
      fixture.evidenceRoot,
      controlledReceiptPath
    );
    proof.behaviorObservationRef = relativeFileRef(
      fixture.evidenceRoot,
      behaviorObservationPath
    );
  });
  const proofRef = relativeFileRef(fixture.evidenceRoot, proofPath);
  mutateJson(observationPath(fixture.evidenceRoot, surface), (observation) => {
    const caseProof = observation.caseProofs.find((entry) => entry.caseId === caseId);
    assert.ok(caseProof, `missing observation case proof: ${surface}:${caseId}`);
    Object.assign(caseProof, { caseId, ...proofRef });
    observation.caseProofSetHash = sha256(
      Buffer.from(
        fixture.producer.canonicalSixModelParityJson(observation.caseProofs),
        'utf8'
      )
    );
  });
  const surfaceObservationPath = observationPath(fixture.evidenceRoot, surface);
  const observation = JSON.parse(fs.readFileSync(surfaceObservationPath, 'utf8'));
  const commandReceiptPath = path.resolve(
    fixture.evidenceRoot,
    observation.commandReceiptRef.path
  );
  mutateJson(commandReceiptPath, (receipt) => {
    receipt.caseProofSetHash = observation.caseProofSetHash;
  });
  mutateJson(surfaceObservationPath, (currentObservation) => {
    currentObservation.commandReceiptRef = relativeFileRef(
      fixture.evidenceRoot,
      commandReceiptPath
    );
  });
}

function writeSafeWriterMutationProbe(fixture, out, mutation) {
  const probePath = path.join(fixture.root, `safe-writer-${mutation}.cjs`);
  const safeWriterModule = path.join(
    PACKAGE_ROOT,
    'dist',
    'utils',
    'large-document-writer'
  );
  fs.writeFileSync(
    probePath,
    [
      "const fs = require('node:fs');",
      "const path = require('node:path');",
      `const mutation = ${JSON.stringify(mutation)};`,
      `const reportPath = path.resolve(${JSON.stringify(out)});`,
      "const receiptPath = `${reportPath}.safe-write-receipt.json`;",
      `const writer = require(${JSON.stringify(safeWriterModule)});`,
      'const originalSafeWriteJson = writer.safeWriteJson;',
      'writer.safeWriteJson = function(target, value, options) {',
      '  const receipt = originalSafeWriteJson(target, value, options);',
      "  if (mutation === 'schema' && path.resolve(target) === reportPath) {",
      "    receipt.mode = 'forged-mode';",
      '  }',
      "  if (mutation === 'hash' && path.resolve(target) === receiptPath) {",
      "    const persisted = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));",
      "    persisted.finalHash = `sha256:${'0'.repeat(64)}`;",
      "    fs.writeFileSync(receiptPath, `${JSON.stringify(persisted, null, 2)}\\n`, 'utf8');",
      '  }',
      '  return receipt;',
      '};',
      "if (mutation === 'readback') {",
      '  const originalReadFileSync = fs.readFileSync;',
      '  let receiptReads = 0;',
      '  fs.readFileSync = function(target, ...args) {',
      '    const bytes = originalReadFileSync.call(this, target, ...args);',
      '    if (path.resolve(String(target)) === receiptPath) {',
      '      receiptReads += 1;',
      '      if (receiptReads === 2) fs.appendFileSync(receiptPath, " ", "utf8");',
      '    }',
      '    return bytes;',
      '  };',
      '}',
      '',
    ].join('\n'),
    'utf8'
  );
  return probePath;
}

function writeFileReadSwapProbe(fixture, targetPath, replacementPath) {
  const probePath = path.join(fixture.root, 'file-read-swap-probe.cjs');
  fs.writeFileSync(
    probePath,
    [
      "const fs = require('node:fs');",
      "const path = require('node:path');",
      `const targetPath = path.resolve(${JSON.stringify(targetPath)});`,
      `const replacementPath = path.resolve(${JSON.stringify(replacementPath)});`,
      'const originalReadFileSync = fs.readFileSync;',
      'let targetReads = 0;',
      'fs.readFileSync = function(target, ...args) {',
      '  if (path.resolve(String(target)) === targetPath) {',
      '    targetReads += 1;',
      '    if (targetReads >= 2) {',
      '      return originalReadFileSync.call(this, replacementPath, ...args);',
      '    }',
      '  }',
      '  return originalReadFileSync.call(this, target, ...args);',
      '};',
      '',
    ].join('\n'),
    'utf8'
  );
  return probePath;
}

function readPublicationReceipt(summary) {
  const receiptPath = path.resolve(summary.publicationReceiptPath);
  const receiptBytes = fs.readFileSync(receiptPath);
  assert.equal(summary.publicationReceiptHash, sha256(receiptBytes));
  assert.equal(summary.publicationReceiptReadbackHash, summary.publicationReceiptHash);
  return {
    path: receiptPath,
    bytes: receiptBytes,
    value: JSON.parse(receiptBytes.toString('utf8')),
  };
}

function refreshObservationCommandReceiptRef(evidenceRoot, surface) {
  const target = observationPath(evidenceRoot, surface);
  mutateJson(target, (observation) => {
    const receiptPath = path.resolve(evidenceRoot, observation.commandReceiptRef.path);
    const receiptHash = sha256(fs.readFileSync(receiptPath));
    observation.commandReceiptRef.hash = receiptHash;
    observation.commandReceiptRef.readbackHash = receiptHash;
    observation.commandReceiptRef.readbackVerified = true;
  });
}

describe('requirements-contract six-model installed parity package CLI', () => {
  it('writes a PASS report for complete zero-difference parity evidence', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'reports', 'parity-report.json');
    try {
      const summary = parseSummary(runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out));
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));

      assert.equal(
        report.schemaVersion,
        'requirements-contract-six-model-projection-parity-report/v1'
      );
      assert.equal(report.decision, 'PASS');
      assert.equal(report.producer, VERIFIER_PRODUCER);
      assert.equal(report.action, VERIFIER_ACTION);
      assert.equal(report.contractHash, CONTRACT_HASH);
      assert.equal(report.requirementSetId, fixture.requirementSetId);
      assert.equal(report.implementationAttemptId, fixture.implementationAttemptId);
      assert.deepStrictEqual(report.modelOrder, MODEL_ORDER);
      assert.deepStrictEqual(report.surfaces, SURFACES);
      assert.deepStrictEqual(report.exactCases, CASES);
      assert.deepStrictEqual(
        report.observations.map((observation) => observation.surface),
        SURFACES
      );
      assert.ok(report.observations.every((observation) => observation.valid));
      assert.deepStrictEqual(report.counts, ZERO_COUNTS);
      assert.equal(report.coverage, 1);
      assert.equal(report.caseCompleteness, 1);
      assert.equal(report.surfaceCompleteness, 1);
      assert.equal(report.readerInventoryCoverage, 1);
      assert.equal(report.writerInventoryCoverage, 1);
      assert.equal(summary.decision, 'PASS');
      const reportBytes = fs.readFileSync(out);
      assert.equal(summary.encoding, 'utf8');
      assert.equal(summary.atomicWrite, true);
      assert.equal(summary.readbackVerified, true);
      assert.equal(summary.readbackHash, sha256(reportBytes));
      assert.equal(summary.reportHash, summary.readbackHash);
      assert.equal(reportBytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), false);
      assert.equal(reportBytes.at(-1), 0x0a);
      assert.deepStrictEqual(
        fs.readdirSync(path.dirname(out)).filter((name) => name.endsWith('.tmp')),
        []
      );
      assert.equal(summary.reportPath, out.replace(/\\/g, '/'));
      const reportSchemaPath = path.join(PACKAGE_ROOT, REPORT_SCHEMA_RELATIVE);
      const observationSchemaPath = path.join(PACKAGE_ROOT, OBSERVATION_SCHEMA_RELATIVE);
      const publicationSchemaPath = path.join(
        PACKAGE_ROOT,
        PUBLICATION_RECEIPT_SCHEMA_RELATIVE
      );
      assertReportMatchesSchema(report, reportSchemaPath);
      for (const surface of SURFACES) {
        assertReportMatchesSchema(
          JSON.parse(fs.readFileSync(observationPath(fixture.evidenceRoot, surface), 'utf8')),
          observationSchemaPath
        );
      }
      const publication = readPublicationReceipt(summary);
      assertReportMatchesSchema(publication.value, publicationSchemaPath);
      assert.equal(
        publication.value.schemaVersion,
        'requirements-contract-six-model-projection-parity-publication-receipt/v1'
      );
      assert.equal(publication.value.producer, VERIFIER_PRODUCER);
      assert.equal(publication.value.action, VERIFIER_ACTION);
      assert.equal(publication.value.targetPath, out.replace(/\\/g, '/'));
      assert.equal(publication.value.targetHash, summary.reportHash);
      assert.equal(publication.value.readbackHash, summary.reportHash);
      assert.equal(publication.value.readbackVerified, true);
      assert.equal(
        publication.value.implementationAttemptId,
        fixture.implementationAttemptId
      );
      assert.equal(
        publication.value.reportSchema.hash,
        sha256(fs.readFileSync(reportSchemaPath))
      );
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('derives contract identity from the current evidence authority', () => {
    const contractHash = sha256(
      Buffer.from('independent-six-model-parity-contract-authority', 'utf8')
    );
    const fixture = materializeEvidenceRoot({ contractHash });
    const out = path.join(fixture.root, 'authority-derived-contract-report.json');
    try {
      const summary = parseSummary(runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out));
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));

      assert.equal(summary.decision, 'PASS');
      assert.equal(report.contractHash, contractHash);
      assert.notEqual(report.contractHash, CONTRACT_HASH);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('uses the unresolved sentinel when the parity authority identity is invalid', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'invalid-authority-identity-report.json');
    const unresolvedContractHash = sha256(
      Buffer.from(
        'requirements-contract-six-model-projection-parity-authority:unresolved',
        'utf8'
      )
    );
    mutateJson(path.join(fixture.evidenceRoot, 'parity-authority.json'), (authority) => {
      authority.producer = 'forged-parity-authority-producer';
    });
    try {
      const summary = parseBlockedSummary(runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out));
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));
      const publication = readPublicationReceipt(summary).value;

      assert.ok(report.blockingReasons.includes('authority_identity_invalid'));
      assert.equal(report.contractHash, unresolvedContractHash);
      assert.equal(publication.contractHash, unresolvedContractHash);
      assert.notEqual(report.contractHash, fixture.contractHash);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('quarantines every governed authority identity when any aggregate check fails', () => {
    const unresolvedContractHash = sha256(
      Buffer.from(
        'requirements-contract-six-model-projection-parity-authority:unresolved',
        'utf8'
      )
    );
    const mutations = [
      ['producer', (authority) => {
        authority.producer = 'forged-parity-authority-producer';
      }],
      ['action', (authority) => {
        authority.action = 'forged-parity-authority-action';
      }],
      ['model-order', (authority) => {
        authority.modelOrder = [...authority.modelOrder].reverse();
      }],
    ];

    for (const [name, mutate] of mutations) {
      const fixture = materializeEvidenceRoot();
      const out = path.join(fixture.root, `invalid-authority-${name}-report.json`);
      mutateJson(path.join(fixture.evidenceRoot, 'parity-authority.json'), (authority) => {
        authority.requirementSetId = 'REQSET-ATTACKER';
        authority.implementationAttemptId = 'IMP-ATTACKER';
        mutate(authority);
      });
      try {
        const summary = parseBlockedSummary(
          runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out)
        );
        const report = JSON.parse(fs.readFileSync(out, 'utf8'));
        const publication = readPublicationReceipt(summary).value;

        assert.ok(report.blockingReasons.includes('authority_identity_invalid'));
        assert.equal(report.contractHash, unresolvedContractHash);
        assert.equal(report.requirementSetId, 'unresolved');
        assert.equal(report.implementationAttemptId, 'unresolved');
        assert.equal(publication.contractHash, unresolvedContractHash);
        assert.equal(publication.requirementSetId, 'unresolved');
        assert.equal(publication.implementationAttemptId, 'unresolved');
      } finally {
        fs.rmSync(fixture.root, { recursive: true, force: true });
      }
    }
  });

  it('classifies a missing parity authority as an invalid authority identity', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'missing-authority-identity-report.json');
    const unresolvedContractHash = sha256(
      Buffer.from(
        'requirements-contract-six-model-projection-parity-authority:unresolved',
        'utf8'
      )
    );
    fs.rmSync(path.join(fixture.evidenceRoot, 'parity-authority.json'));
    try {
      const summary = parseBlockedSummary(runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out));
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));
      const publication = readPublicationReceipt(summary).value;

      assert.ok(report.blockingReasons.includes('authority_missing'));
      assert.ok(report.blockingReasons.includes('authority_identity_invalid'));
      assert.equal(report.contractHash, unresolvedContractHash);
      assert.equal(publication.contractHash, unresolvedContractHash);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('publishes governed BLOCK when the parity authority path is a directory', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'authority-directory-report.json');
    const authorityPath = path.join(fixture.evidenceRoot, 'parity-authority.json');
    fs.rmSync(authorityPath);
    fs.mkdirSync(authorityPath);
    try {
      const result = runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out);

      assert.equal(result.status, 2, `expected BLOCK exit\nSTDERR:\n${result.stderr}`);
      assert.equal(result.stderr, '');
      const summary = parseBlockedSummary(result);
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));
      assert.ok(report.blockingReasons.includes('authority_not_file'));
      assert.ok(report.blockingReasons.includes('authority_identity_invalid'));
      assertReportMatchesSchema(report, path.join(PACKAGE_ROOT, REPORT_SCHEMA_RELATIVE));
      readPublicationReceipt(summary);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('publishes governed BLOCK for a broken parity authority symlink', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'authority-broken-link-report.json');
    const authorityPath = path.join(fixture.evidenceRoot, 'parity-authority.json');
    fs.rmSync(authorityPath);
    fs.symlinkSync(path.join(fixture.root, 'missing-authority.json'), authorityPath, 'file');
    try {
      const summary = parseBlockedSummary(
        runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out)
      );
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));

      assert.ok(report.blockingReasons.includes('authority_broken_link'));
      assert.ok(report.blockingReasons.includes('authority_identity_invalid'));
      assert.equal(report.blockingReasons.includes('authority_missing'), false);
      assertReportMatchesSchema(report, path.join(PACKAGE_ROOT, REPORT_SCHEMA_RELATIVE));
      readPublicationReceipt(summary);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('publishes governed BLOCK when a canonical observation path is a directory', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'canonical-observation-directory-report.json');
    const sourceObservationPath = observationPath(fixture.evidenceRoot, 'source');
    fs.rmSync(sourceObservationPath);
    fs.mkdirSync(sourceObservationPath);
    try {
      const result = runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out);

      assert.equal(result.status, 2, `expected BLOCK exit\nSTDERR:\n${result.stderr}`);
      assert.equal(result.stderr, '');
      const summary = parseBlockedSummary(result);
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));
      assert.ok(report.blockingReasons.includes('surface_not_file:source'));
      assertReportMatchesSchema(report, path.join(PACKAGE_ROOT, REPORT_SCHEMA_RELATIVE));
      readPublicationReceipt(summary);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('publishes governed BLOCK for a broken canonical observation symlink', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'canonical-observation-broken-link-report.json');
    const sourceObservationPath = observationPath(fixture.evidenceRoot, 'source');
    fs.rmSync(sourceObservationPath);
    fs.symlinkSync(
      path.join(fixture.root, 'missing-source-observation.json'),
      sourceObservationPath,
      'file'
    );
    try {
      const summary = parseBlockedSummary(
        runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out)
      );
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));

      assert.ok(report.blockingReasons.includes('surface_broken_link:source'));
      assert.equal(report.blockingReasons.includes('missing_surface:source'), false);
      assertReportMatchesSchema(report, path.join(PACKAGE_ROOT, REPORT_SCHEMA_RELATIVE));
      readPublicationReceipt(summary);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('blocks caller-authored zero counts without governed observation provenance', () => {
    const fixture = materializeSelfReportedEvidenceRoot();
    const out = path.join(fixture.root, 'self-reported-parity-report.json');
    try {
      const result = runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out);

      assert.notEqual(
        result.status,
        0,
        `self-reported parity evidence must not grant PASS\nSTDOUT:\n${result.stdout}`
      );
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));
      assert.equal(report.decision, 'BLOCK');
      assert.ok(
        report.blockingReasons.some((reason) => reason.startsWith('untrusted_observation:')),
        JSON.stringify(report.blockingReasons)
      );
      assert.deepStrictEqual(report.counts, ZERO_COUNTS);
      assert.ok(report.coverage < 1);
      assert.doesNotMatch(JSON.stringify(report), /"decision":"PASS"/);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('blocks case proof payloads without controlled execution Receipts', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'static-case-proof-report.json');
    fs.rmSync(
      path.join(
        fixture.evidenceRoot,
        'controlled-command-receipts',
        'source',
        'valid_receipt.json'
      )
    );
    try {
      const result = runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out);

      assert.notEqual(
        result.status,
        0,
        `case proof payloads without controlled Receipts must not grant PASS\nSTDOUT:\n${result.stdout}`
      );
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));
      assert.equal(report.decision, 'BLOCK');
      assert.ok(
        report.blockingReasons.some((reason) =>
          reason.startsWith('case_controlled_receipt_missing:')
        ),
        JSON.stringify(report.blockingReasons)
      );
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('blocks stale controlled Receipts after every nested ref is refreshed', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'stale-controlled-receipt-report.json');
    const surface = 'source';
    const caseId = 'valid_receipt';
    const staleAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const behaviorPath = path.join(
      fixture.evidenceRoot,
      'behavior-observations',
      surface,
      `${caseId}.json`
    );
    const controlledReceiptPath = path.join(
      fixture.evidenceRoot,
      'controlled-command-receipts',
      surface,
      `${caseId}.json`
    );
    mutateJson(behaviorPath, (observation) => {
      observation.observedAt = staleAt;
    });
    const behaviorHash = sha256(fs.readFileSync(behaviorPath));
    mutateJson(controlledReceiptPath, (receipt) => {
      receipt.startedAt = staleAt;
      receipt.endedAt = staleAt;
      receipt.stdoutHash = behaviorHash;
      receipt.orderedChildren.at(-1).stdoutHash = behaviorHash;
    });
    mutateJson(caseProofPath(fixture.evidenceRoot, surface, caseId), (proof) => {
      proof.observedAt = staleAt;
    });
    refreshNestedCaseProofChain(fixture, surface, caseId);
    try {
      parseBlockedSummary(runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out));
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));
      assert.ok(
        report.blockingReasons.includes(`case_proof_identity_mismatch:${surface}:${caseId}`) ||
          report.blockingReasons.includes(
            `case_controlled_receipt_timestamp_mismatch:${surface}:${caseId}`
          ),
        JSON.stringify(report.blockingReasons)
      );
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('blocks cross-attempt controlled Receipts after every nested ref is refreshed', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'cross-attempt-controlled-receipt-report.json');
    const surface = 'source';
    const caseId = 'valid_receipt';
    mutateJson(
      path.join(
        fixture.evidenceRoot,
        'controlled-command-receipts',
        surface,
        `${caseId}.json`
      ),
      (receipt) => {
        receipt.implementationAttemptId = `IMP-cross-${path.basename(fixture.root)}`;
      }
    );
    refreshNestedCaseProofChain(fixture, surface, caseId);
    try {
      parseBlockedSummary(runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out));
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));
      assert.ok(
        report.blockingReasons.includes(
          `case_controlled_receipt_binding_mismatch:${surface}:${caseId}`
        ),
        JSON.stringify(report.blockingReasons)
      );
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('blocks a forged controlled executor identity after every nested ref is refreshed', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'forged-controlled-executor-report.json');
    const surface = 'source';
    const caseId = 'valid_receipt';
    mutateJson(
      path.join(
        fixture.evidenceRoot,
        'controlled-command-receipts',
        surface,
        `${caseId}.json`
      ),
      (receipt) => {
        receipt.executorIdentity.id = `forged-${receipt.executorIdentity.id}`;
      }
    );
    refreshNestedCaseProofChain(fixture, surface, caseId);
    try {
      parseBlockedSummary(runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out));
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));
      assert.ok(
        report.blockingReasons.includes(
          `case_controlled_receipt_binding_mismatch:${surface}:${caseId}`
        ),
        JSON.stringify(report.blockingReasons)
      );
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('binds ARTIFACT-45 publication to a real safe-write Receipt', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'safe-write-bound-report.json');
    try {
      const summary = parseSummary(runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out));
      const publication = readPublicationReceipt(summary).value;
      const safeWriteReceiptRef = publication.safeWriteReceiptRef;

      assert.equal(typeof safeWriteReceiptRef?.path, 'string');
      assert.match(safeWriteReceiptRef.path, /\.safe-write-receipt\.json$/u);
      const safeWriteReceiptPath = path.resolve(safeWriteReceiptRef.path);
      const safeWriteReceiptBytes = fs.readFileSync(safeWriteReceiptPath);
      assert.equal(safeWriteReceiptRef.hash, sha256(safeWriteReceiptBytes));
      assert.equal(safeWriteReceiptRef.readbackHash, safeWriteReceiptRef.hash);
      assert.equal(safeWriteReceiptRef.readbackVerified, true);
      const safeWriteReceipt = JSON.parse(safeWriteReceiptBytes.toString('utf8'));
      assert.equal(safeWriteReceipt.targetPath.replace(/\\/g, '/'), out.replace(/\\/g, '/'));
      assert.equal(safeWriteReceipt.schemaVersion, 'large-document-writer-safe-write/v1');
      assert.equal(safeWriteReceipt.tempHash, summary.reportHash);
      assert.equal(safeWriteReceipt.finalHash, summary.reportHash);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  for (const mutation of ['schema', 'hash', 'readback']) {
    it(`rejects a ${mutation}-mutated ARTIFACT-45 safe-write Receipt`, () => {
      const fixture = materializeEvidenceRoot();
      const out = path.join(fixture.root, `${mutation}-mutated-safe-write-report.json`);
      const probePath = writeSafeWriterMutationProbe(fixture, out, mutation);
      try {
        const result = runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out, {
          nodeOptions: `--require=${probePath}`,
        });
        assert.notEqual(
          result.status,
          0,
          `${mutation}-mutated safe-write Receipt must fail closed\nSTDOUT:\n${result.stdout}`
        );
        assert.doesNotMatch(result.stdout, /"decision":\s*"PASS"/u);
      } finally {
        fs.rmSync(fixture.root, { recursive: true, force: true });
      }
    });
  }

  it('blocks a controlled Receipt byte swap after ref hash validation', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'controlled-receipt-byte-swap-report.json');
    const surface = 'source';
    const caseId = 'valid_receipt';
    const controlledReceiptPath = path.join(
      fixture.evidenceRoot,
      'controlled-command-receipts',
      surface,
      `${caseId}.json`
    );
    const validReceiptPath = path.join(fixture.root, 'valid-controlled-receipt.json');
    fs.copyFileSync(controlledReceiptPath, validReceiptPath);
    mutateJson(controlledReceiptPath, (receipt) => {
      receipt.executorIdentity.id = `forged-${receipt.executorIdentity.id}`;
    });
    refreshNestedCaseProofChain(fixture, surface, caseId);
    const probePath = writeFileReadSwapProbe(
      fixture,
      controlledReceiptPath,
      validReceiptPath
    );
    try {
      const result = runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out, {
        nodeOptions: `--require=${probePath}`,
      });
      assert.notEqual(
        result.status,
        0,
        `hash-validated Receipt bytes must be the bytes parsed by the verifier\nSTDOUT:\n${result.stdout}`
      );
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));
      assert.ok(
        report.blockingReasons.includes(
          `case_controlled_receipt_binding_mismatch:${surface}:${caseId}`
        ),
        JSON.stringify(report.blockingReasons)
      );
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('rejects a producer fileRef whose readback bytes changed after hashing', () => {
    const fixture = materializeEvidenceRoot();
    const artifactPath = path.join(
      fixture.evidenceRoot,
      'surfaces',
      'source',
      'runtime-artifact.js'
    );
    const originalReadFileSync = fs.readFileSync;
    let artifactReads = 0;
    fs.readFileSync = function(target, ...args) {
      const bytes = originalReadFileSync.call(this, target, ...args);
      if (path.resolve(String(target)) === path.resolve(artifactPath)) {
        artifactReads += 1;
        if (artifactReads === 1) {
          fs.appendFileSync(artifactPath, 'changed-after-hash\n', 'utf8');
        }
      }
      return bytes;
    };
    try {
      assert.throws(
        () =>
          fixture.producer.produceRequirementsContractSixModelProjectionParityObservation({
            evidenceRoot: fixture.evidenceRoot,
            surface: 'source',
          }),
        /source artifact readback mismatch/u
      );
    } finally {
      fs.readFileSync = originalReadFileSync;
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it(
    'runs from a real packed and installed dist-only package without source fallback',
    { timeout: 360_000 },
    () => {
    const fixture = materializeEvidenceRoot();
    const installed = materializeInstalledPackage(fixture.root);
    const packageOut = path.join(fixture.root, 'package-report.json');
    const out = path.join(fixture.root, 'installed-report.json');
    try {
      const packageSummary = parseSummary(
        runVerifier(PACKAGE_CLI, fixture.evidenceRoot, packageOut)
      );
      const summary = parseSummary(
        runVerifier(installed.cli, fixture.evidenceRoot, out, {
          cwd: installed.consumerRoot,
          nodeOptions: `--require=${installed.probePath}`,
        })
      );
      const packageReport = JSON.parse(fs.readFileSync(packageOut, 'utf8'));
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));
      const schemaPath = path.join(installed.root, REPORT_SCHEMA_RELATIVE);
      const observationSchemaPath = path.join(installed.root, OBSERVATION_SCHEMA_RELATIVE);
      const publicationSchemaPath = path.join(
        installed.root,
        PUBLICATION_RECEIPT_SCHEMA_RELATIVE
      );

      assert.equal(summary.decision, 'PASS');
      assert.equal(packageSummary.decision, 'PASS');
      assert.deepStrictEqual(report, packageReport);
      assert.equal(fs.existsSync(installed.tarball), true);
      assert.equal(fs.existsSync(path.join(installed.root, 'src')), false);
      assert.equal(
        fs.existsSync(
          path.join(
            installed.root,
            'dist',
            'main-agent',
            'source-authority',
            'packages',
            'bmad-speckit',
            'src'
          )
        ),
        false
      );
      assert.equal(fs.existsSync(installed.probeLog), false);
      assert.equal(fs.existsSync(schemaPath), true, `installed report schema missing: ${schemaPath}`);
      assert.equal(fs.existsSync(observationSchemaPath), true);
      assert.equal(fs.existsSync(publicationSchemaPath), true);
      assertReportMatchesSchema(report, schemaPath);
      assertReportMatchesSchema(readPublicationReceipt(summary).value, publicationSchemaPath);
      assertNoFrozenParityAuthorityConstants([
        { label: 'source producer', content: fs.readFileSync(PRODUCER_SOURCE, 'utf8') },
        { label: 'source verifier', content: fs.readFileSync(VERIFIER_SOURCE, 'utf8') },
        { label: 'generated dist producer', content: fs.readFileSync(PRODUCER_DIST, 'utf8') },
        { label: 'generated dist verifier', content: fs.readFileSync(VERIFIER_DIST, 'utf8') },
        {
          label: 'packed producer',
          content: readTarMember(
            installed.tarball,
            'package/dist/main-agent/source-authority/scripts/requirements-contract-six-model-projection-parity-observation-producer.js'
          ),
        },
        {
          label: 'packed verifier',
          content: readTarMember(
            installed.tarball,
            'package/dist/main-agent/source-authority/scripts/requirements-contract-six-model-projection-parity-verifier.js'
          ),
        },
        {
          label: 'installed producer',
          content: fs.readFileSync(
            path.join(
              installed.root,
              'dist',
              'main-agent',
              'source-authority',
              'scripts',
              'requirements-contract-six-model-projection-parity-observation-producer.js'
            ),
            'utf8'
          ),
        },
        {
          label: 'installed verifier',
          content: fs.readFileSync(
            path.join(
              installed.root,
              'dist',
              'main-agent',
              'source-authority',
              'scripts',
              'requirements-contract-six-model-projection-parity-verifier.js'
            ),
            'utf8'
          ),
        },
      ]);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
    }
  );

  it('writes BLOCK when a required surface observation is missing', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'missing-surface-report.json');
    fs.rmSync(observationPath(fixture.evidenceRoot, 'installed'));
    try {
      const summary = parseBlockedSummary(runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out));
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));

      assert.equal(report.decision, 'BLOCK');
      assert.equal(summary.reportPath, out.replace(/\\/g, '/'));
      assert.ok(report.blockingReasons.includes('missing_surface:installed'));
      assert.equal(
        report.observations.find((observation) => observation.surface === 'installed').present,
        false
      );
      assert.ok(report.surfaceCompleteness < 1);
      assert.ok(report.coverage < 1);
      assertReportMatchesSchema(report, path.join(PACKAGE_ROOT, REPORT_SCHEMA_RELATIVE));
      assert.doesNotMatch(JSON.stringify({ summary, report }), /"decision":"PASS"/);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('writes BLOCK when any parity count is nonzero', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'nonzero-count-report.json');
    mutateCaseBehaviorObservation(
      fixture,
      'package-dist',
      'projection_mismatch',
      (observation) => {
        observation.outcome.projectionIntegrity = 'valid';
      }
    );
    try {
      parseBlockedSummary(runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out));
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));

      assert.equal(report.decision, 'BLOCK');
      assert.equal(report.counts.projection, 1);
      assert.ok(
        report.blockingReasons.includes(
          'case_outcome_mismatch:package-dist:projection_mismatch:projection'
        ),
        JSON.stringify(report.blockingReasons)
      );
      assert.equal(report.coverage, 1);
      assert.doesNotMatch(JSON.stringify(report), /"decision":"PASS"/);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('derives coverage below one when an exact behavior proof is missing', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'coverage-report.json');
    fs.rmSync(caseProofPath(fixture.evidenceRoot, 'installed', 'missing_projection'));
    try {
      parseBlockedSummary(runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out));
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));

      assert.equal(report.decision, 'BLOCK');
      assert.ok(report.coverage < 1);
      assert.ok(report.caseCompleteness < 1);
      assert.ok(
        report.blockingReasons.includes('case_proof_missing:installed:missing_projection'),
        JSON.stringify(report.blockingReasons)
      );
      assert.doesNotMatch(JSON.stringify(report), /"decision":"PASS"/);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('blocks a tampered panorama order while preserving the canonical report order', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'tampered-order-report.json');
    mutateCaseBehaviorObservation(fixture, 'source', 'complete_panorama', (observation) => {
      observation.outcome.panoramaModelOrder = [...MODEL_ORDER].reverse();
    });
    try {
      parseBlockedSummary(runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out));
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));
      const panoramaCase = report.observations[0].cases.find(
        (entry) => entry.caseId === 'complete_panorama'
      );

      assert.equal(report.decision, 'BLOCK');
      assert.deepStrictEqual(report.modelOrder, MODEL_ORDER);
      assert.deepStrictEqual(panoramaCase.outcome.panoramaModelOrder, [...MODEL_ORDER].reverse());
      assert.equal(report.counts.panorama, 1);
      assert.ok(
        report.blockingReasons.includes(
          'case_outcome_mismatch:source:complete_panorama:panorama'
        ),
        JSON.stringify(report.blockingReasons)
      );
      assertReportMatchesSchema(report, path.join(PACKAGE_ROOT, REPORT_SCHEMA_RELATIVE));
      assert.doesNotMatch(JSON.stringify(report), /"decision":"PASS"/);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('writes BLOCK instead of ignoring an unknown evidence surface', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'unknown-surface-report.json');
    writeJson(path.join(fixture.evidenceRoot, 'observations', 'staging.json'), {
      schemaVersion: 'requirements-contract-six-model-projection-parity-observation/v1',
      surface: 'staging',
      modelOrder: MODEL_ORDER,
      counts: ZERO_COUNTS,
      coverage: 1,
    });
    try {
      parseBlockedSummary(runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out));
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));

      assert.equal(report.decision, 'BLOCK');
      assert.deepStrictEqual(report.unknownSurfaces, ['staging']);
      assert.ok(report.blockingReasons.includes('unknown_surface:staging'));
      assertReportMatchesSchema(report, path.join(PACKAGE_ROOT, REPORT_SCHEMA_RELATIVE));
      assert.doesNotMatch(JSON.stringify(report), /"decision":"PASS"/);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('publishes BLOCK for malformed JSON on an unknown evidence surface', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'malformed-unknown-surface-report.json');
    fs.writeFileSync(
      path.join(fixture.evidenceRoot, 'observations', 'staging.json'),
      '{"surface":',
      'utf8'
    );
    try {
      const result = runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out);

      assert.equal(result.status, 2, `expected BLOCK exit\nSTDERR:\n${result.stderr}`);
      assert.equal(result.stderr, '');
      parseBlockedSummary(result);
      assert.equal(fs.existsSync(out), true);
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));
      assert.equal(report.decision, 'BLOCK');
      assert.deepStrictEqual(report.unknownSurfaces, ['staging']);
      assert.ok(report.blockingReasons.includes('unknown_surface:staging'));
      assert.ok(report.blockingReasons.includes('unknown_surface_json_invalid:staging'));
      assertReportMatchesSchema(report, path.join(PACKAGE_ROOT, REPORT_SCHEMA_RELATIVE));
      assert.doesNotMatch(JSON.stringify(report), /"decision":"PASS"/);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('blocks an unknown observation directory that uses a JSON filename', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'unknown-surface-directory-report.json');
    fs.mkdirSync(path.join(fixture.evidenceRoot, 'observations', 'staging.json'));
    try {
      parseBlockedSummary(runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out));
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));

      assert.deepStrictEqual(report.unknownSurfaces, ['staging']);
      assert.ok(report.blockingReasons.includes('unknown_surface:staging'));
      assert.ok(report.blockingReasons.includes('unknown_surface_not_file:staging'));
      assert.equal(
        report.blockingReasons.includes('unknown_surface_json_invalid:staging'),
        false
      );
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('blocks an unknown observation symlink to a directory as a non-file surface', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'unknown-surface-directory-symlink-report.json');
    const directoryTarget = path.join(fixture.evidenceRoot, 'unknown-surface-directory');
    fs.mkdirSync(directoryTarget);
    fs.symlinkSync(
      directoryTarget,
      path.join(fixture.evidenceRoot, 'observations', 'staging.json'),
      process.platform === 'win32' ? 'junction' : 'dir'
    );
    try {
      parseBlockedSummary(runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out));
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));

      assert.deepStrictEqual(report.unknownSurfaces, ['staging']);
      assert.ok(report.blockingReasons.includes('unknown_surface:staging'));
      assert.ok(report.blockingReasons.includes('unknown_surface_not_file:staging'));
      assert.equal(
        report.blockingReasons.includes('unknown_surface_json_invalid:staging'),
        false
      );
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('blocks a broken unknown observation symlink with a distinct reason', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'unknown-surface-broken-symlink-report.json');
    fs.symlinkSync(
      path.join(fixture.root, 'missing-staging-observation.json'),
      path.join(fixture.evidenceRoot, 'observations', 'staging.json'),
      'file'
    );
    try {
      parseBlockedSummary(runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out));
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));

      assert.deepStrictEqual(report.unknownSurfaces, ['staging']);
      assert.ok(report.blockingReasons.includes('unknown_surface:staging'));
      assert.ok(report.blockingReasons.includes('unknown_surface_broken_link:staging'));
      assert.equal(
        report.blockingReasons.includes('unknown_surface_json_invalid:staging'),
        false
      );
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('blocks an unknown observation file that impersonates a known surface', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'unknown-surface-impersonation-report.json');
    writeJson(path.join(fixture.evidenceRoot, 'observations', 'staging.json'), {
      schemaVersion: 'requirements-contract-six-model-projection-parity-observation/v1',
      surface: 'source',
      modelOrder: MODEL_ORDER,
      counts: ZERO_COUNTS,
      coverage: 1,
    });
    try {
      parseBlockedSummary(runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out));
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));

      assert.equal(report.decision, 'BLOCK');
      assert.deepStrictEqual(report.unknownSurfaces, ['staging']);
      assert.ok(report.blockingReasons.includes('unknown_surface:staging'));
      assert.ok(
        report.blockingReasons.includes('unknown_surface_identity_mismatch:staging:source')
      );
      assertReportMatchesSchema(report, path.join(PACKAGE_ROOT, REPORT_SCHEMA_RELATIVE));
      assert.doesNotMatch(JSON.stringify(report), /"decision":"PASS"/);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('blocks an unknown observation symlink that aliases a known surface', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'unknown-surface-symlink-report.json');
    fs.symlinkSync(
      observationPath(fixture.evidenceRoot, 'source'),
      path.join(fixture.evidenceRoot, 'observations', 'staging.json'),
      'file'
    );
    try {
      parseBlockedSummary(runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out));
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));

      assert.equal(report.decision, 'BLOCK');
      assert.deepStrictEqual(report.unknownSurfaces, ['staging']);
      assert.ok(report.blockingReasons.includes('unknown_surface:staging'));
      assert.ok(
        report.blockingReasons.includes('unknown_surface_identity_mismatch:staging:source')
      );
      assert.doesNotMatch(JSON.stringify(report), /"decision":"PASS"/);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('blocks an unknown observation symlink whose target escapes the evidence root', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'unknown-surface-external-symlink-report.json');
    const escapedObservation = path.join(fixture.root, 'escaped-staging-observation.json');
    writeJson(escapedObservation, {
      schemaVersion: 'requirements-contract-six-model-projection-parity-observation/v1',
      surface: 'staging',
      modelOrder: MODEL_ORDER,
      counts: ZERO_COUNTS,
      coverage: 1,
    });
    fs.symlinkSync(
      escapedObservation,
      path.join(fixture.evidenceRoot, 'observations', 'staging.json'),
      'file'
    );
    try {
      parseBlockedSummary(runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out));
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));

      assert.equal(report.decision, 'BLOCK');
      assert.deepStrictEqual(report.unknownSurfaces, ['staging']);
      assert.ok(report.blockingReasons.includes('unknown_surface:staging'));
      assert.ok(
        report.blockingReasons.includes('path_escape:unknown_surface:staging')
      );
      assert.doesNotMatch(JSON.stringify(report), /"decision":"PASS"/);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('blocks an observation with the wrong exact schema version', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'wrong-schema-report.json');
    mutateObservation(fixture.evidenceRoot, 'source', (observation) => {
      observation.schemaVersion = 'requirements-contract-six-model-projection-parity-observation/v0';
    });
    try {
      parseBlockedSummary(runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out));
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));

      assert.equal(report.decision, 'BLOCK');
      assert.ok(
        report.blockingReasons.includes('untrusted_observation:source:schema_invalid'),
        JSON.stringify(report.blockingReasons)
      );
      assert.doesNotMatch(JSON.stringify(report), /"decision":"PASS"/);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('blocks wrong producer and action identities', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'wrong-producer-report.json');
    mutateObservation(fixture.evidenceRoot, 'codex', (observation) => {
      observation.producer = 'caller-authored-producer';
      observation.action = 'caller-authored-action';
    });
    try {
      parseBlockedSummary(runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out));
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));

      assert.equal(report.decision, 'BLOCK');
      assert.ok(report.blockingReasons.includes('producer_identity_mismatch:codex'));
      assert.ok(report.blockingReasons.includes('action_identity_mismatch:codex'));
      assert.doesNotMatch(JSON.stringify(report), /"decision":"PASS"/);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('blocks stale observation evidence', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'stale-report.json');
    mutateObservation(fixture.evidenceRoot, 'cursor', (observation) => {
      observation.observedAt = '2000-01-01T00:00:00.000Z';
    });
    try {
      parseBlockedSummary(runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out));
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));

      assert.equal(report.decision, 'BLOCK');
      assert.ok(report.blockingReasons.includes('stale_observation:cursor'));
      assert.doesNotMatch(JSON.stringify(report), /"decision":"PASS"/);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('blocks cross-attempt observation replay', () => {
    const current = materializeEvidenceRoot({
      implementationAttemptId: 'IMP-CORR-160-162-CURRENT',
    });
    const stale = materializeEvidenceRoot({
      implementationAttemptId: 'IMP-CORR-160-162-STALE',
    });
    const out = path.join(current.root, 'replay-report.json');
    fs.copyFileSync(
      observationPath(stale.evidenceRoot, 'claude'),
      observationPath(current.evidenceRoot, 'claude')
    );
    try {
      parseBlockedSummary(runVerifier(PACKAGE_CLI, current.evidenceRoot, out));
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));

      assert.equal(report.decision, 'BLOCK');
      assert.ok(report.blockingReasons.includes('implementation_attempt_mismatch:claude'));
      assert.doesNotMatch(JSON.stringify(report), /"decision":"PASS"/);
    } finally {
      fs.rmSync(current.root, { recursive: true, force: true });
      fs.rmSync(stale.root, { recursive: true, force: true });
    }
  });

  it('blocks path escape references before reading escaped bytes', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'path-escape-report.json');
    mutateObservation(fixture.evidenceRoot, 'generated-dist', (observation) => {
      observation.artifactRef.path = '../escaped-runtime-artifact.js';
    });
    try {
      parseBlockedSummary(runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out));
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));

      assert.equal(report.decision, 'BLOCK');
      assert.ok(report.blockingReasons.includes('path_escape:generated-dist:artifact'));
      assert.doesNotMatch(JSON.stringify(report), /"decision":"PASS"/);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('blocks evidence files reached through a symlink outside the evidence root', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'symlink-escape-report.json');
    const surfaceRoot = path.join(fixture.evidenceRoot, 'surfaces', 'source');
    const escapedRoot = path.join(fixture.root, 'escaped-source-surface');
    fs.renameSync(surfaceRoot, escapedRoot);
    fs.symlinkSync(
      escapedRoot,
      surfaceRoot,
      process.platform === 'win32' ? 'junction' : 'dir'
    );
    try {
      parseBlockedSummary(runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out));
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));

      assert.equal(report.decision, 'BLOCK');
      assert.ok(report.blockingReasons.includes('path_escape:source:artifact'));
      assert.doesNotMatch(JSON.stringify(report), /"decision":"PASS"/);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('blocks a parity authority file symlink outside the evidence root', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'authority-symlink-escape-report.json');
    const authorityPath = path.join(fixture.evidenceRoot, 'parity-authority.json');
    const escapedAuthorityPath = path.join(fixture.root, 'escaped-parity-authority.json');
    fs.renameSync(authorityPath, escapedAuthorityPath);
    fs.symlinkSync(escapedAuthorityPath, authorityPath, 'file');
    try {
      parseBlockedSummary(runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out));
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));

      assert.equal(report.decision, 'BLOCK');
      assert.ok(report.blockingReasons.includes('path_escape:authority'));
      assert.doesNotMatch(JSON.stringify(report), /"decision":"PASS"/);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('blocks canonical observations reached through a junction outside the evidence root', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'observation-junction-escape-report.json');
    const observationRoot = path.join(fixture.evidenceRoot, 'observations');
    const escapedObservationRoot = path.join(fixture.root, 'escaped-observations');
    fs.renameSync(observationRoot, escapedObservationRoot);
    fs.symlinkSync(
      escapedObservationRoot,
      observationRoot,
      process.platform === 'win32' ? 'junction' : 'dir'
    );
    try {
      parseBlockedSummary(runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out));
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));

      assert.equal(report.decision, 'BLOCK');
      assert.ok(report.blockingReasons.includes('path_escape:source:observation'));
      assert.doesNotMatch(JSON.stringify(report), /"decision":"PASS"/);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('rejects producer artifact reads through a junction outside the evidence root', () => {
    const fixture = materializeEvidenceRoot();
    const surfaceRoot = path.join(fixture.evidenceRoot, 'surfaces', 'source');
    const escapedSurfaceRoot = path.join(fixture.root, 'escaped-producer-source-surface');
    fs.renameSync(surfaceRoot, escapedSurfaceRoot);
    fs.symlinkSync(
      escapedSurfaceRoot,
      surfaceRoot,
      process.platform === 'win32' ? 'junction' : 'dir'
    );
    try {
      assert.throws(
        () =>
          fixture.producer.produceRequirementsContractSixModelProjectionParityObservation({
            evidenceRoot: fixture.evidenceRoot,
            surface: 'source',
            observedAt: fixture.observedAt,
          }),
        /source artifact path escapes evidence root/u
      );
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('rejects a producer command-Receipt output junction before writing outside the evidence root', () => {
    const fixture = materializeEvidenceRoot();
    const outputRoot = path.join(fixture.evidenceRoot, 'command-receipts');
    const escapedOutputRoot = path.join(fixture.root, 'escaped-command-receipts');
    fs.rmSync(outputRoot, { recursive: true, force: true });
    fs.mkdirSync(escapedOutputRoot);
    fs.symlinkSync(
      escapedOutputRoot,
      outputRoot,
      process.platform === 'win32' ? 'junction' : 'dir'
    );
    const escapedTarget = path.join(escapedOutputRoot, 'source.json');
    try {
      assert.throws(
        () =>
          fixture.producer.produceRequirementsContractSixModelProjectionParityObservation({
            evidenceRoot: fixture.evidenceRoot,
            surface: 'source',
          }),
        /source command Receipt path escapes evidence root/u
      );
      assert.equal(
        fs.existsSync(escapedTarget),
        false,
        `producer wrote outside evidence root before rejecting: ${escapedTarget}`
      );
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('rejects a producer observation output junction before writing outside the evidence root', () => {
    const fixture = materializeEvidenceRoot();
    const outputRoot = path.join(fixture.evidenceRoot, 'observations');
    const escapedOutputRoot = path.join(fixture.root, 'escaped-observations-output');
    fs.rmSync(outputRoot, { recursive: true, force: true });
    fs.mkdirSync(escapedOutputRoot);
    fs.symlinkSync(
      escapedOutputRoot,
      outputRoot,
      process.platform === 'win32' ? 'junction' : 'dir'
    );
    const escapedTarget = path.join(escapedOutputRoot, 'source.json');
    try {
      assert.throws(
        () =>
          fixture.producer.produceRequirementsContractSixModelProjectionParityObservation({
            evidenceRoot: fixture.evidenceRoot,
            surface: 'source',
          }),
        /source observation path escapes evidence root/u
      );
      assert.equal(
        fs.existsSync(escapedTarget),
        false,
        `producer wrote outside evidence root before rejecting: ${escapedTarget}`
      );
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('blocks artifact hash and readback mismatch', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'artifact-mismatch-report.json');
    fs.appendFileSync(
      path.join(fixture.evidenceRoot, 'surfaces', 'packed-package', 'runtime-artifact.js'),
      'tampered\n',
      'utf8'
    );
    try {
      parseBlockedSummary(runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out));
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));

      assert.equal(report.decision, 'BLOCK');
      assert.ok(report.blockingReasons.includes('artifact_hash_mismatch:packed-package'));
      assert.doesNotMatch(JSON.stringify(report), /"decision":"PASS"/);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('blocks a command Receipt with a forged producer even when its ref hash is refreshed', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'forged-command-receipt-report.json');
    const observation = JSON.parse(
      fs.readFileSync(observationPath(fixture.evidenceRoot, 'root-host'), 'utf8')
    );
    const receiptPath = path.resolve(
      fixture.evidenceRoot,
      observation.commandReceiptRef.path
    );
    mutateJson(receiptPath, (receipt) => {
      receipt.producer = 'forged-command-receipt-producer';
    });
    refreshObservationCommandReceiptRef(fixture.evidenceRoot, 'root-host');
    try {
      parseBlockedSummary(runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out));
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));

      assert.equal(report.decision, 'BLOCK');
      assert.ok(report.blockingReasons.includes('command_receipt_producer_mismatch:root-host'));
      assert.doesNotMatch(JSON.stringify(report), /"decision":"PASS"/);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('blocks reader or writer inventory bypass and lowers inventory coverage', () => {
    const fixture = materializeEvidenceRoot();
    const out = path.join(fixture.root, 'inventory-bypass-report.json');
    fs.rmSync(
      path.join(fixture.evidenceRoot, 'surfaces', 'root-host', 'controlled-status-writer.js')
    );
    try {
      parseBlockedSummary(runVerifier(PACKAGE_CLI, fixture.evidenceRoot, out));
      const report = JSON.parse(fs.readFileSync(out, 'utf8'));

      assert.equal(report.decision, 'BLOCK');
      assert.ok(report.writerInventoryCoverage < 1);
      assert.ok(
        report.blockingReasons.some((reason) => reason.startsWith('writer_missing:root-host:')),
        JSON.stringify(report.blockingReasons)
      );
      assert.doesNotMatch(JSON.stringify(report), /"decision":"PASS"/);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('lets commander reject a missing required evidence input without invoking fallback', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmads-six-model-missing-input-'));
    const out = path.join(root, 'must-not-exist.json');
    try {
      const result = spawnSync(
        process.execPath,
        [PACKAGE_CLI, COMMAND, '--out', out, '--json'],
        {
          cwd: PACKAGE_ROOT,
          encoding: 'utf8',
          env: { ...process.env, RUST_BACKTRACE: '1' },
          timeout: 60_000,
        }
      );

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /required option '--evidence-root <path>' not specified/);
      assert.equal(fs.existsSync(out), false);
      assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /tsx|ts-node|src[\\/]main-agent/i);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
