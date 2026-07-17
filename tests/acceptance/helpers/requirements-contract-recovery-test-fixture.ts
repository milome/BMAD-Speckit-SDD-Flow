import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

type JsonRecord = Record<string, any>;

const SCHEMA_PATH = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-recovery-lineage-receipt.schema.json'
);
const FROZEN_CONSUMER_IDENTITY = JSON.parse(
  readFileSync(
    path.resolve(
      'tests/acceptance/fixtures/requirements-contract-recovery/consumer-baseline-authority.json'
    ),
    'utf8'
  )
) as JsonRecord;

function sha256(value: Buffer | string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

export function fileHash(filePath: string): string {
  return sha256(readFileSync(filePath));
}

function canonical(value: any): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function runGit(cwd: string, args: string[], env = process.env): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', env });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

export function gitTrackedFileIndex(root: string): {
  entries: Array<{ mode: string; blob: string; path: string }>;
  canonical: string;
  hash: string;
} {
  const entries = runGit(root, ['ls-files', '--stage'])
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+) ([a-f0-9]{40}) 0\t(.+)$/u);
      if (!match) throw new Error(`invalid Git tracked-file row: ${line}`);
      return {
        mode: match[1],
        blob: match[2],
        path: match[3].replace(/\\/gu, '/'),
      };
    });
  const canonicalIndex = entries
    .map((entry) => `${entry.mode} ${entry.blob} ${entry.path}`)
    .join('\n');
  return {
    entries,
    canonical: canonicalIndex,
    hash: sha256(canonicalIndex),
  };
}

function initializeReferenceConsumer(root: string, identity: JsonRecord): JsonRecord {
  mkdirSync(root, { recursive: true });
  writeJson(path.join(root, 'package.json'), {
    name: identity.projectName,
    version: '0.0.0',
    private: true,
  });
  writeJson(path.join(root, 'bmad-speckit-consumer-project.json'), {
    schemaVersion: identity.markerSchemaVersion,
    projectName: identity.projectName,
    bootstrapId: identity.bootstrapId,
  });
  runGit(root, ['init', '--initial-branch=main']);
  runGit(root, ['config', 'user.name', identity.gitUserName]);
  runGit(root, ['config', 'user.email', identity.gitUserEmail]);
  runGit(root, ['add', '--', 'package.json', 'bmad-speckit-consumer-project.json']);
  runGit(root, ['commit', '-m', identity.commitSubject], {
    ...process.env,
    GIT_AUTHOR_DATE: identity.commitTimestamp,
    GIT_COMMITTER_DATE: identity.commitTimestamp,
  });
  const fileIndex = gitTrackedFileIndex(root);
  const observed = {
    markerHash: fileHash(path.join(root, 'bmad-speckit-consumer-project.json')),
    packageHash: fileHash(path.join(root, 'package.json')),
    baselineCommit: runGit(root, ['rev-parse', 'HEAD']),
    baselineTree: runGit(root, ['rev-parse', 'HEAD^{tree}']),
    branch: runGit(root, ['branch', '--show-current']),
    remotes: runGit(root, ['remote']).split('\n').filter(Boolean),
    gitUserName: runGit(root, ['config', '--local', 'user.name']),
    gitUserEmail: runGit(root, ['config', '--local', 'user.email']),
    commitSubject: runGit(root, ['show', '-s', '--format=%s', 'HEAD']),
    authorTimestamp: runGit(root, ['show', '-s', '--format=%aI', 'HEAD']),
    committerTimestamp: runGit(root, ['show', '-s', '--format=%cI', 'HEAD']),
    trackedFiles: fileIndex.entries,
    trackedFileIndexCanonicalization:
      'mode + SP + gitBlob + SP + path, rows in git index order, LF separators, no trailing LF',
    baselineFileIndexHash: fileIndex.hash,
  };
  const expected = {
    markerHash: FROZEN_CONSUMER_IDENTITY.markerHash,
    packageHash: FROZEN_CONSUMER_IDENTITY.packageHash,
    baselineCommit: FROZEN_CONSUMER_IDENTITY.baselineCommit,
    baselineTree: FROZEN_CONSUMER_IDENTITY.baselineTree,
    branch: FROZEN_CONSUMER_IDENTITY.branch,
    remotes: FROZEN_CONSUMER_IDENTITY.remotes,
    gitUserName: FROZEN_CONSUMER_IDENTITY.gitUserName,
    gitUserEmail: FROZEN_CONSUMER_IDENTITY.gitUserEmail,
    commitSubject: FROZEN_CONSUMER_IDENTITY.commitSubject,
    authorTimestamp: FROZEN_CONSUMER_IDENTITY.authorTimestamp,
    committerTimestamp: FROZEN_CONSUMER_IDENTITY.committerTimestamp,
    trackedFiles: FROZEN_CONSUMER_IDENTITY.trackedFiles,
    trackedFileIndexCanonicalization:
      FROZEN_CONSUMER_IDENTITY.trackedFileIndexCanonicalization,
    baselineFileIndexHash: FROZEN_CONSUMER_IDENTITY.baselineFileIndexHash,
  };
  if (canonical(observed) !== canonical(expected)) {
    throw new Error(`reference Consumer differs from frozen literals: ${canonical(observed)}`);
  }
  return { ...identity, ...structuredClone(expected) };
}

function commandReceipt(
  fixture: RecoveryFixture,
  commandId: string,
  commandRunId: string,
  invocationSequence: number,
  receiptPath: string
): string {
  const stdoutPath = `${receiptPath}.stdout.log`;
  const stderrPath = `${receiptPath}.stderr.log`;
  const binding = fixture.schema['x-commandReceiptBindings']?.[commandId] as
    | JsonRecord
    | undefined;
  if (!binding) throw new Error(`missing fixture command binding: ${commandId}`);
  const executionPlan = Object.values(fixture.context.commandPlan).find(
    (candidate: any) =>
      candidate.commandId === commandId &&
      candidate.commandRunId === commandRunId &&
      candidate.invocationSequence === invocationSequence
  ) as JsonRecord | undefined;
  if (!executionPlan) throw new Error(`missing fixture execution plan: ${commandRunId}`);
  mkdirSync(path.dirname(receiptPath), { recursive: true });
  writeFileSync(stdoutPath, 'fixture command output\n', 'utf8');
  writeFileSync(stderrPath, '', 'utf8');
  const orderedChildren = executionPlan.orderedChildren.map(
    (child: JsonRecord, index: number) => {
      const childStdoutPath = `${receiptPath}.child-${index}.stdout.log`;
      const childStderrPath = `${receiptPath}.child-${index}.stderr.log`;
      writeFileSync(childStdoutPath, `fixture child ${index} output\n`, 'utf8');
      writeFileSync(childStderrPath, '', 'utf8');
      return {
        ...child,
        startedAt: '2026-07-13T00:00:00.100Z',
        endedAt: '2026-07-13T00:00:00.900Z',
        signal: null,
        stdoutPath: childStdoutPath,
        stdoutHash: fileHash(childStdoutPath),
        stderrPath: childStderrPath,
        stderrHash: fileHash(childStderrPath),
      };
    }
  );
  writeJson(receiptPath, {
    schemaVersion: 'requirements-contract-controlled-command-receipt/v1',
    commandRunId,
    invocationSequence,
    commandId,
    argv: [...executionPlan.argv],
    argvHash: executionPlan.argvHash,
    orderedChildren,
    cwd: executionPlan.cwd,
    executorIdentity: { ...executionPlan.executorIdentity },
    hostIdentity: { ...executionPlan.hostIdentity },
    transactionId: fixture.context.transactionId,
    implementationAttemptId: fixture.context.implementationAttemptId,
    architectureAuditAttemptId: fixture.context.architectureAuditAttemptId,
    activePhaseAuditAttemptId: fixture.context.architectureAuditAttemptId,
    contractHash: fixture.context.contractHash,
    inputSnapshotHash: fileHash(fixture.contextPath),
    startedAt: '2026-07-13T00:00:00.000Z',
    endedAt: '2026-07-13T00:00:01.000Z',
    exitCode: 0,
    signal: null,
    stdoutPath,
    stdoutHash: fileHash(stdoutPath),
    stderrPath,
    stderrHash: fileHash(stderrPath),
    acceptanceRefs: [...binding.acceptanceRefs],
    traceRefs: [...binding.traceRefs],
    publication: {
      writer: 'requirements-contract-recovery-test-fixture',
      targetPath: receiptPath,
      publishedAt: '2026-07-13T00:00:01.100Z',
      readbackAt: '2026-07-13T00:00:01.200Z',
      explicitUtf8: true,
      createOnly: true,
      readbackVerified: true,
    },
    decision: 'pass',
    passAuthorityScope: 'command_only',
  });
  return receiptPath;
}

export interface RecoveryFixture {
  root: string;
  cwd: string;
  contractPath: string;
  authorityPath: string;
  architectureAuthorityPath: string;
  contextPath: string;
  qualifiedRedPath: string;
  consumerRoot: string;
  provisionalPath: string;
  publicationPath: string;
  targetPath: string;
  transactionRoot: string;
  failureRoot: string;
  finalizationReceiptPath: string;
  context: JsonRecord;
  schema: JsonRecord;
  roles: JsonRecord;
  createCommandReceipt(role: string): string;
  cleanup(): void;
}

export function installConsumerGitIdentityDriftShim(
  fixture: RecoveryFixture,
  hookInvocationOrdinal: number,
  options: { createPublicationSentinel?: boolean } = {}
): {
  readState(): { matchCount: number; triggered: boolean };
  restore(): void;
} {
  const shimRoot = path.join(
    fixture.consumerRoot,
    '.git',
    `g00-fsmonitor-drift-${hookInvocationOrdinal}`
  );
  const countPath = path.join(shimRoot, 'count.txt');
  const triggeredPath = path.join(shimRoot, 'triggered.txt');
  const hookPath = path.join(shimRoot, 'hook.sh');
  mkdirSync(shimRoot, { recursive: true });
  if (options.createPublicationSentinel) {
    writeFileSync(
      path.join(shimRoot, 'create-publication-sentinel.cjs'),
      [
        "const fs = require('node:fs');",
        `fs.writeFileSync(${JSON.stringify(fixture.publicationPath)}, '{"sentinel":true}\\n', 'utf8');`,
        '',
      ].join('\n'),
      'utf8'
    );
  }
  writeFileSync(
    hookPath,
    [
      '#!/bin/sh',
      `count_path='.git/g00-fsmonitor-drift-${hookInvocationOrdinal}/count.txt'`,
      `triggered_path='.git/g00-fsmonitor-drift-${hookInvocationOrdinal}/triggered.txt'`,
      'count=0',
      'if test -f "$count_path"; then count=$(cat "$count_path"); fi',
      'count=$((count + 1))',
      'printf \'%s\' "$count" > "$count_path"',
      `if test "$count" -eq ${hookInvocationOrdinal}; then`,
      `  git config --local user.email 'toctou-${hookInvocationOrdinal}@bmad-speckit.local'`,
      ...(options.createPublicationSentinel
        ? [
            `  "${process.execPath.replace(/\\/gu, '/')}" '.git/g00-fsmonitor-drift-${hookInvocationOrdinal}/create-publication-sentinel.cjs'`,
          ]
        : []),
      '  printf \'triggered\\n\' > "$triggered_path"',
      'fi',
      'printf \'token-%s\\0\' "$count"',
    ].join('\n'),
    'utf8'
  );
  chmodSync(hookPath, 0o755);
  runGit(fixture.consumerRoot, [
    'config',
    'core.fsmonitor',
    hookPath.replace(/\\/gu, '/'),
  ]);
  return {
    readState: () => ({
      matchCount: existsSync(countPath) ? Number(readFileSync(countPath, 'utf8')) : 0,
      triggered: existsSync(triggeredPath),
    }),
    restore: () => {
      spawnSync('git', ['config', '--unset', 'core.fsmonitor'], {
        cwd: fixture.consumerRoot,
        encoding: 'utf8',
      });
    },
  };
}

export function createRecoveryFixture(
  options: { consumerExistsBefore?: boolean } = {}
): RecoveryFixture {
  const root = mkdtempSync(path.join(tmpdir(), 'requirements-contract-recovery-fixture-'));
  const cwd = path.join(root, 'repo');
  mkdirSync(cwd, { recursive: true });
  runGit(cwd, ['init', '--initial-branch=main']);
  runGit(cwd, ['config', 'user.name', 'Recovery Test']);
  runGit(cwd, ['config', 'user.email', 'recovery-test@bmad-speckit.local']);

  const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')) as JsonRecord;
  const roles = {
    ...schema['x-commandRoles'],
    finalizer: schema['x-finalizerCommandRole'],
  };
  const transactionRoots = schema['x-transactionRoots'];
  const finalizationReceiptTarget = schema['x-finalizationReceiptTarget'];
  const contractPath = path.join(root, 'contract.md');
  const authorityPath = path.join(root, 'authority.md');
  const architectureAuthorityPath = path.join(root, 'architecture-authority.md');
  writeFileSync(contractPath, 'fixture contract\n', 'utf8');
  writeFileSync(authorityPath, 'fixture authority\n', 'utf8');
  writeFileSync(architectureAuthorityPath, 'fixture architecture authority\n', 'utf8');

  const targetPath = path.join(
    cwd,
    'docs/plans/evidence/loop-engineering-remediation/recovery-lineage-receipt.json'
  );
  const candidatePath = path.join(cwd, 'candidate.txt');
  writeFileSync(candidatePath, 'before\n', 'utf8');
  writeJson(targetPath, {
    grandfatheredCandidateManifest: [
      {
        path: 'candidate.txt',
        predecessorExists: true,
        predecessorHash: fileHash(candidatePath),
        currentExists: true,
        currentHash: fileHash(candidatePath),
        changeClass: 'unchanged_predecessor_candidate',
        targetRefs: ['candidate.txt'],
        requirementRefs: ['fixture-requirement'],
        acceptanceRefs: ['fixture-acceptance'],
        traceRefs: ['fixture-trace'],
        qualifiedRedRefs: ['fixture-qualified-red'],
        verificationRefs: ['fixture-verification'],
      },
    ],
  });
  runGit(cwd, ['add', '--', 'candidate.txt', 'docs']);
  runGit(cwd, ['commit', '-m', 'test: initialize recovery fixture']);
  writeFileSync(candidatePath, 'after\n', 'utf8');

  const identityBase = {
    projectName: FROZEN_CONSUMER_IDENTITY.projectName,
    markerSchemaVersion: FROZEN_CONSUMER_IDENTITY.markerSchemaVersion,
    bootstrapId: FROZEN_CONSUMER_IDENTITY.bootstrapId,
    gitUserName: FROZEN_CONSUMER_IDENTITY.gitUserName,
    gitUserEmail: FROZEN_CONSUMER_IDENTITY.gitUserEmail,
    commitTimestamp: FROZEN_CONSUMER_IDENTITY.commitTimestamp,
    commitSubject: FROZEN_CONSUMER_IDENTITY.commitSubject,
  };
  const referenceConsumer = path.join(root, 'reference-consumer');
  const consumerIdentity = initializeReferenceConsumer(referenceConsumer, identityBase);
  rmSync(referenceConsumer, { recursive: true, force: true });
  const consumerRoot = path.join(root, 'consumer');
  if (options.consumerExistsBefore) {
    const materializedIdentity = initializeReferenceConsumer(consumerRoot, identityBase);
    if (
      materializedIdentity.baselineCommit !== consumerIdentity.baselineCommit ||
      materializedIdentity.baselineTree !== consumerIdentity.baselineTree ||
      materializedIdentity.baselineFileIndexHash !== consumerIdentity.baselineFileIndexHash
    ) {
      throw new Error('materialized Consumer identity differs from the frozen reference');
    }
  }

  const token = randomUUID();
  const transactionId = `TX-${token}`;
  const implementationAttemptId = `IMP-recovery-${token}`;
  const architectureAuditAttemptId = `AUDIT-ARCH-${token}`;
  const finalizationRunId = `FINALIZE-${token}`;
  const redQualificationRunId = `RED-${token}`;
  const attemptRoot = path.join(
    cwd,
    'docs/plans/evidence/loop-engineering-remediation/attempts',
    transactionId,
    implementationAttemptId
  );
  const commandRoot = path.join(
    cwd,
    'docs/plans/evidence/loop-engineering-remediation/command-runs',
    transactionId,
    implementationAttemptId,
    architectureAuditAttemptId
  );
  const qualifiedRoot = path.join(attemptRoot, 'qualified-red');
  const contextPath = path.join(attemptRoot, 'pre-edit-attempt-context-receipt.json');
  const predecessorManifestPath = path.join(
    qualifiedRoot,
    `${redQualificationRunId}.predecessor-file-set.json`
  );
  const nestedManifestPath = path.join(
    qualifiedRoot,
    `${redQualificationRunId}.nested-execution.json`
  );
  const overlayPath = path.join(attemptRoot, 'controlled-inputs', 'recovery-red.test.ts');
  writeJson(predecessorManifestPath, { files: [] });
  writeJson(nestedManifestPath, { argv: [] });
  mkdirSync(path.dirname(overlayPath), { recursive: true });
  writeFileSync(overlayPath, 'export {};\n', 'utf8');

  const commandExecutionPlan = (
    commandId: string,
    commandRunId: string,
    invocationSequence: number,
    compound: boolean
  ) => {
    const argv = [process.execPath, '--version', commandId];
    const orderedChildren = compound
      ? [0, 1].map((index) => {
          const childArgv = [process.execPath, '--version', commandId, String(index)];
          return {
            argv: childArgv,
            argvHash: sha256(canonical(childArgv)),
            cwd,
            exitCode: 0,
          };
        })
      : [];
    return {
      commandId,
      commandRunId,
      invocationSequence,
      receiptPath: path.join(commandRoot, `${commandRunId}.receipt.json`),
      argv,
      argvHash: sha256(canonical(argv)),
      orderedChildren,
      cwd,
      executorIdentity: {
        class: 'goal_controlled_executor',
        id: 'recovery-test-executor',
      },
      hostIdentity: {
        platform: process.platform,
        architecture: process.arch,
        nodeVersion: process.version,
      },
    };
  };
  const plan = {
    preEdit: commandExecutionPlan(
      roles.preEdit,
      `RUN-pre-${token}`,
      1,
      false
    ),
    bootstrap: commandExecutionPlan(
      roles.bootstrap,
      `RUN-bootstrap-${token}`,
      2,
      true
    ),
    postBootstrap: commandExecutionPlan(
      roles.postBootstrap,
      `RUN-post-${token}`,
      3,
      false
    ),
    finalizer: commandExecutionPlan(
      roles.finalizer,
      `RUN-finalizer-${token}`,
      1,
      false
    ),
  };
  const context: JsonRecord = {
    contractPath,
    contractHash: fileHash(contractPath),
    authorityBindings: {
      amend10: {
        path: authorityPath,
        hash: fileHash(authorityPath),
      },
      architectureWave: {
        path: architectureAuthorityPath,
        hash: fileHash(architectureAuthorityPath),
      },
    },
    passAuthority: false,
    transactionId,
    implementationAttemptId,
    architectureAuditAttemptId,
    preCandidateAuditAttemptId: `AUDIT-PRE-${token}`,
    finalAuditAttemptId: `AUDIT-FINAL-${token}`,
    finalizationRunId,
    redQualificationRunId,
    requirementSetId: 'recovery-test-requirements',
    predecessorContractHash: sha256('predecessor contract'),
    predecessorBaselineSnapshotHash: sha256('predecessor snapshot'),
    repositoryObservation: {
      gitStatusHash: sha256('fixture git status'),
    },
    frozenUniverseHash: sha256('fixture universe'),
    sourceHashBindings: {},
    semanticModelHashBindings: {},
    consumerObservation: {
      root: consumerRoot,
      normalizedRoot: consumerRoot,
      existsBefore: options.consumerExistsBefore === true,
      ...consumerIdentity,
      repositoryRoot: consumerRoot,
      clean: true,
      createIfAbsentAuthorized: true,
      partialCreationRecovery: 'not_required',
    },
    predecessorFileSetManifest: {
      path: path.relative(cwd, predecessorManifestPath),
      hash: fileHash(predecessorManifestPath),
    },
    nestedRedExecutionManifest: {
      path: path.relative(cwd, nestedManifestPath),
      hash: fileHash(nestedManifestPath),
    },
    redTestOverlay: {
      path: path.relative(cwd, overlayPath),
      hash: fileHash(overlayPath),
    },
    recoveryTarget: {
      path: path.relative(cwd, targetPath),
      existedBefore: true,
      preimageHash: fileHash(targetPath),
      readbackHash: fileHash(targetPath),
    },
    commandPlan: plan,
    createdAt: '2026-07-13T00:00:00.000Z',
  };
  writeJson(contextPath, context);

  const fixture = {
    root,
    cwd,
    contractPath,
    authorityPath,
    architectureAuthorityPath,
    contextPath,
    qualifiedRedPath: path.join(qualifiedRoot, `${redQualificationRunId}.receipt.json`),
    consumerRoot,
    provisionalPath: path.join(
      cwd,
      transactionRoots.transaction,
      transactionId,
      implementationAttemptId,
      finalizationRunId,
      'provisional/recovery-lineage-receipt.json'
    ),
    publicationPath: path.join(
      cwd,
      transactionRoots.transaction,
      transactionId,
      implementationAttemptId,
      finalizationRunId,
      'provisional/recovery-lineage-receipt.publication-receipt.json'
    ),
    targetPath,
    transactionRoot: path.join(cwd, transactionRoots.transaction),
    failureRoot: path.join(cwd, transactionRoots.failure),
    finalizationReceiptPath: path.join(cwd, finalizationReceiptTarget.path),
    context,
    schema,
    roles,
    createCommandReceipt(role: string): string {
      const entry = Object.values(plan).find(
        (candidate: any) => candidate.commandId === role
      ) as JsonRecord | undefined;
      if (!entry) throw new Error(`unknown fixture command role: ${role}`);
      return commandReceipt(
        fixture as RecoveryFixture,
        entry.commandId,
        entry.commandRunId,
        entry.invocationSequence,
        entry.receiptPath
      );
    },
    cleanup(): void {
      rmSync(root, { recursive: true, force: true });
    },
  } satisfies RecoveryFixture;

  fixture.createCommandReceipt(roles.preEdit);
  writeJson(fixture.qualifiedRedPath, {
    schemaVersion: 'requirements-contract-qualified-red-receipt/v1',
    decision: 'expected_red',
    passAuthority: false,
    transactionId,
    implementationAttemptId,
    architectureAuditAttemptId,
    redQualificationRunId,
    contractHash: context.contractHash,
    predecessorContractHash: context.predecessorContractHash,
    predecessorFileSetManifestPath: context.predecessorFileSetManifest.path,
    predecessorFileSetManifestHash: context.predecessorFileSetManifest.hash,
    nestedExecutionManifestPath: context.nestedRedExecutionManifest.path,
    nestedExecutionManifestHash: context.nestedRedExecutionManifest.hash,
    testOverlayPath: context.redTestOverlay.path,
    testOverlayHash: context.redTestOverlay.hash,
    targetAssertionReached: true,
    predecessorMismatchCount: 0,
    zeroPredecessorProductionFileDrift: true,
  });
  return fixture;
}
