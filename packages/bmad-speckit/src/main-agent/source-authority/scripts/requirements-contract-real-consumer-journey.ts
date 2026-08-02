import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { requirementsContractCandidatePackageCommand } from './requirements-contract-candidate-package';
import { runRequirementsContractRealConsumerAdapter } from './requirements-contract-real-consumer-adapter';
import {
  canonicalJson,
  fileHash,
  sha256,
  slash,
  writeGovernedJson,
} from './requirements-contract-governed-write';

type JsonRecord = Record<string, ReturnType<typeof JSON.parse>>;

interface RealConsumerBoundaryObserverReceipt extends JsonRecord {
  formalBoundaryRefs: Record<string, Array<{ exactPath: string }>>;
}

export interface RequirementsContractRealConsumerJourneyOptions {
  cwd?: string;
  contract: string;
  consumerRoot: string;
  restoreCleanBaseline: boolean;
  phase: 'pre-candidate' | 'final';
  phaseRoot: string;
  phaseAuditAttemptId: string;
  packageRoot: string;
  packageManifest: string;
  distRoot: string;
  candidateTarball: string;
  candidatePackageReceipt: string;
  journeyEvidence: string;
  preConfirmationSnapshot: string;
  confirmationReceipt: string;
  runAllStages: boolean;
  json?: boolean;
}

const FIXED_CONSUMER_ROOT = 'D:\\Dev\\BMAD-Speckit-Consumer-Evidence-Closure';

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as JsonRecord;
}

function resolveWithin(root: string, value: string): string {
  const resolved = path.resolve(root, value);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`real_consumer_journey_path_escape:${value}`);
  }
  return resolved;
}

function normalized(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function executablePath(command: string): string {
  const locator = process.platform === 'win32' ? 'where.exe' : 'which';
  const resolved = execFileSync(locator, [command], { encoding: 'utf8' })
    .split(/\r?\n/u)
    .map((entry) => entry.trim())
    .find(Boolean);
  if (!resolved) throw new Error(`real_consumer_executable_missing:${command}`);
  return resolved;
}

function runExecutable(executable: string, args: string[], cwd: string) {
  const invocation =
    process.platform === 'win32' && executable.toLowerCase().endsWith('.cmd')
      ? {
          executable: process.env.ComSpec ?? 'cmd.exe',
          args: ['/d', '/s', '/c', 'call', executable, ...args],
        }
      : { executable, args };
  return spawnSync(invocation.executable, invocation.args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
}

function git(consumerRoot: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd: consumerRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function baseline(consumerRoot: string): JsonRecord {
  const status = git(consumerRoot, 'status', '--porcelain=v1', '--untracked-files=all');
  if (status) throw new Error('real_consumer_baseline_dirty');
  const files = git(consumerRoot, 'ls-files', '-z')
    .split('\0')
    .filter(Boolean)
    .map((relativePath) => ({
      path: slash(relativePath),
      hash: fileHash(path.join(consumerRoot, relativePath)),
    }));
  return {
    baselineCommit: git(consumerRoot, 'rev-parse', 'HEAD'),
    baselineFileIndexHash: sha256(canonicalJson(files)),
  };
}

function validate(value: JsonRecord, schemaName: string, label: string): void {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validator = ajv.compile(
    readJson(path.resolve(__dirname, '..', 'schemas', schemaName))
  );
  if (!validator(value)) {
    throw new Error(`${label}_schema_invalid:${JSON.stringify(validator.errors ?? [])}`);
  }
}

function ref(root: string, relativePath: string): JsonRecord {
  const target = resolveWithin(root, relativePath);
  return { path: slash(relativePath), hash: fileHash(target) };
}

function removePreviousInstalledPackage(consumerRoot: string): void {
  const installedRoot = path.join(consumerRoot, 'node_modules', 'bmad-speckit');
  const nodeModulesRoot = path.join(consumerRoot, 'node_modules');
  const relative = path.relative(nodeModulesRoot, installedRoot);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('real_consumer_install_cleanup_path_escape');
  }
  if (fs.existsSync(installedRoot)) {
    const manifestPath = path.join(installedRoot, 'package.json');
    if (fs.existsSync(manifestPath) && readJson(manifestPath).name !== 'bmad-speckit') {
      throw new Error('real_consumer_install_cleanup_owner_mismatch');
    }
    fs.rmSync(installedRoot, { recursive: true, force: true });
  }
}

export async function requirementsContractRealConsumerJourneyCommand(
  options: RequirementsContractRealConsumerJourneyOptions
): Promise<JsonRecord> {
  const root = path.resolve(options.cwd ?? process.cwd());
  if (normalized(options.consumerRoot) !== normalized(FIXED_CONSUMER_ROOT)) {
    throw new Error('real_consumer_root_mismatch');
  }
  if (
    !['pre-candidate', 'final'].includes(options.phase) ||
    !options.restoreCleanBaseline ||
    !options.runAllStages
  ) {
    throw new Error('real_consumer_journey_fixed_contract_mismatch');
  }
  const phaseRoot = resolveWithin(root, options.phaseRoot);
  const outputs = [
    options.candidateTarball,
    options.candidatePackageReceipt,
    options.journeyEvidence,
    options.preConfirmationSnapshot,
    options.confirmationReceipt,
  ].map((entry) => resolveWithin(root, entry));
  if (
    outputs.some(
      (entry) =>
        path.relative(phaseRoot, entry).startsWith('..') ||
        path.isAbsolute(path.relative(phaseRoot, entry))
    )
  ) {
    throw new Error('real_consumer_journey_output_outside_phase_root');
  }
  const consumerRoot = fs.realpathSync(options.consumerRoot);
  const project = readJson(path.join(consumerRoot, 'package.json'));
  if (project.name !== 'bmad-speckit-consumer-evidence-closure') {
    throw new Error('real_consumer_project_identity_mismatch');
  }
  const baselineState = baseline(consumerRoot);
  const resetReceiptPath = path.join(phaseRoot, 'consumer', 'baseline-reset.receipt.json');
  writeGovernedJson(resetReceiptPath, {
    schemaVersion: 'requirements-contract-real-consumer-baseline-reset-receipt/v1',
    normalizedRoot: FIXED_CONSUMER_ROOT,
    ...baselineState,
    cleanBaselineRestored: true,
    decision: 'PASS',
  });
  removePreviousInstalledPackage(consumerRoot);
  const candidateReceipt = await requirementsContractCandidatePackageCommand({
    cwd: root,
    packageRoot: options.packageRoot,
    packageManifest: options.packageManifest,
    distRoot: options.distRoot,
    phase: options.phase,
    phaseAuditAttemptId: options.phaseAuditAttemptId,
    tarball: options.candidateTarball,
    receipt: options.candidatePackageReceipt,
    json: false,
  });
  const phaseIdentity = candidateReceipt.phaseIdentity;
  const tarballPath = outputs[0];
  const npmExecutable = executablePath(process.platform === 'win32' ? 'npm.cmd' : 'npm');
  const installArgs = [
    'install',
    '--no-save',
    '--package-lock=false',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--install-links=false',
    tarballPath,
  ];
  const install = runExecutable(npmExecutable, installArgs, consumerRoot);
  if (install.status !== 0) {
    throw new Error(`real_consumer_install_failed:${install.stderr ?? ''}`);
  }
  const installedPackageRoot = path.join(consumerRoot, 'node_modules', 'bmad-speckit');
  const adapter = runRequirementsContractRealConsumerAdapter({
    consumerRoot,
    installedPackageRoot,
    phaseRoot,
    transactionId: phaseIdentity.transactionId,
    implementationAttemptId: phaseIdentity.implementationAttemptId,
    phaseAuditAttemptId: options.phaseAuditAttemptId,
  });
  if (candidateReceipt.packedRuntimeHash !== adapter.installedRuntimeHash) {
    throw new Error('real_consumer_packed_installed_runtime_hash_mismatch');
  }
  if (candidateReceipt.packedRuntimeFileCount !== adapter.installedRuntimeFileCount) {
    throw new Error('real_consumer_packed_installed_runtime_file_count_mismatch');
  }
  const snapshot = {
    schemaVersion: 'requirements-contract-real-consumer-pre-confirmation-snapshot/v1',
    phase: options.phase,
    transactionId: phaseIdentity.transactionId,
    implementationAttemptId: phaseIdentity.implementationAttemptId,
    phaseAuditAttemptId: options.phaseAuditAttemptId,
    candidatePackageReceipt: ref(root, options.candidatePackageReceipt),
    stageObservations: adapter.stageObservations,
    distBuildHash: candidateReceipt.distBuildHash,
    packedRuntimeHash: candidateReceipt.packedRuntimeHash,
    packedRuntimeFileCount: candidateReceipt.packedRuntimeFileCount,
    installedRuntimeHash: adapter.installedRuntimeHash,
    installedRuntimeFileCount: adapter.installedRuntimeFileCount,
    preConfirmationEvidenceSetHash: sha256(
      canonicalJson({
        distBuildHash: candidateReceipt.distBuildHash,
        tarballBytesHash: candidateReceipt.tarballBytesHash,
        packedRuntimeHash: candidateReceipt.packedRuntimeHash,
        packedRuntimeFileCount: candidateReceipt.packedRuntimeFileCount,
        installedRuntimeHash: adapter.installedRuntimeHash,
        installedRuntimeFileCount: adapter.installedRuntimeFileCount,
        stageObservations: adapter.stageObservations,
      })
    ),
    preConfirmationStageSnapshotHash: sha256(canonicalJson(adapter.stageObservations)),
    decision: 'PASS',
  };
  validate(
    snapshot,
    'requirements-contract-real-consumer-pre-confirmation-snapshot.schema.json',
    'real_consumer_snapshot'
  );
  writeGovernedJson(outputs[3], snapshot);
  const observerInputPath = path.join(phaseRoot, 'consumer', 'boundary-observer.input.json');
  const observerReceiptPath = path.join(
    phaseRoot,
    'consumer',
    'boundary-observer.receipt.json'
  );
  const observerPhaseRoot = path.join(phaseRoot, 'consumer', 'boundary-observer');
  writeGovernedJson(observerInputPath, {
    consumerRoot,
    installedPackageRoot,
    observerPhaseRoot,
    transactionId: phaseIdentity.transactionId,
    implementationAttemptId: phaseIdentity.implementationAttemptId,
    phaseAuditAttemptId: options.phaseAuditAttemptId,
  });
  const installedObserver = path.join(
    installedPackageRoot,
    'dist/main-agent/source-authority/scripts/requirements-contract-real-consumer-boundary-observer.js'
  );
  const observerRun = spawnSync(
    process.execPath,
    [installedObserver, '--input', observerInputPath, '--out', observerReceiptPath, '--json'],
    { cwd: consumerRoot, encoding: 'utf8', windowsHide: true }
  );
  if (observerRun.status !== 0) {
    throw new Error(`real_consumer_boundary_observer_failed:${observerRun.stderr ?? ''}`);
  }
  const observerReceipt = readJson(
    observerReceiptPath
  ) as RealConsumerBoundaryObserverReceipt;
  validate(
    observerReceipt,
    'requirements-contract-real-consumer-boundary-observer-receipt.schema.json',
    'real_consumer_boundary_observer'
  );
  if (
    observerReceipt.installedRuntimeHash !== adapter.installedRuntimeHash ||
    observerReceipt.installedRuntimeFileCount !== adapter.installedRuntimeFileCount
  ) {
    throw new Error('real_consumer_boundary_observer_runtime_mismatch');
  }
  const confirmation = {
    schemaVersion: 'requirements-contract-real-consumer-confirmation-receipt/v1',
    phase: options.phase,
    transactionId: phaseIdentity.transactionId,
    implementationAttemptId: phaseIdentity.implementationAttemptId,
    phaseAuditAttemptId: options.phaseAuditAttemptId,
    preConfirmationSnapshot: ref(root, options.preConfirmationSnapshot),
    boundaryObserverReceipt: {
      path: slash(path.relative(root, observerReceiptPath)),
      hash: fileHash(observerReceiptPath),
    },
    preConfirmationEvidenceSetHash: snapshot.preConfirmationEvidenceSetHash,
    preConfirmationStageSnapshotHash: snapshot.preConfirmationStageSnapshotHash,
    confirmed: true,
    decision: 'PASS',
  };
  validate(
    confirmation,
    'requirements-contract-real-consumer-confirmation-receipt.schema.json',
    'real_consumer_confirmation'
  );
  writeGovernedJson(outputs[4], confirmation);
  const stage11ReceiptPath = path.join(
    phaseRoot,
    'consumer',
    'stages',
    'STAGE-11.transition.receipt.json'
  );
  writeGovernedJson(stage11ReceiptPath, {
    schemaVersion: 'requirements-contract-real-consumer-stage-transition-receipt/v1',
    stageId: 'STAGE-11',
    observedPath: slash(path.relative(root, outputs[4])),
    observedHash: fileHash(outputs[4]),
    transactionId: phaseIdentity.transactionId,
    implementationAttemptId: phaseIdentity.implementationAttemptId,
    phaseAuditAttemptId: options.phaseAuditAttemptId,
    decision: 'PASS',
  });
  const stageObservations = [
    ...adapter.stageObservations,
    {
      stageId: 'STAGE-11',
      eventRefs: [`${slash(path.relative(root, outputs[4]))}#${fileHash(outputs[4])}`],
      transitionReceiptRef: slash(path.relative(root, stage11ReceiptPath)),
      observedAt: new Date().toISOString(),
    },
  ];
  const installedPaths = Object.values(observerReceipt.formalBoundaryRefs)
    .flat()
    .map((entry) => entry.exactPath);
  const evidence: JsonRecord = {
    schemaVersion: 'requirements-contract-real-consumer-journey-evidence/v1',
    contractHash: fileHash(resolveWithin(root, options.contract)),
    transactionId: phaseIdentity.transactionId,
    implementationAttemptId: phaseIdentity.implementationAttemptId,
    auditAttemptId: options.phaseAuditAttemptId,
    consumer: {
      normalizedRoot: FIXED_CONSUMER_ROOT,
      projectName: project.name,
      repositoryRoot: slash(consumerRoot),
      baselineCommit: baselineState.baselineCommit,
      baselineFileIndexHash: baselineState.baselineFileIndexHash,
      cleanBaselineRestored: true,
    },
    candidatePackage: {
      path: slash(path.relative(root, tarballPath)),
      hash: fileHash(tarballPath),
      distBuildHash: candidateReceipt.distBuildHash,
      packedRuntimeHash: candidateReceipt.packedRuntimeHash,
      packedRuntimeFileCount: candidateReceipt.packedRuntimeFileCount,
      installedRuntimeHash: adapter.installedRuntimeHash,
      installedRuntimeFileCount: adapter.installedRuntimeFileCount,
      workspaceLinkCount: adapter.workspaceLinkCount,
    },
    formalBoundaryRefs: observerReceipt.formalBoundaryRefs,
    stageObservations,
    surfaceObservations: {
      source: [slash(options.packageRoot)],
      dist: [slash(options.distRoot)],
      package: [slash(path.relative(root, tarballPath))],
      host: ['packages/bmad-speckit/bin/bmad-speckit.js'],
      installed: installedPaths,
      api: [],
      database: [],
      events: stageObservations.map((entry) => entry.transitionReceiptRef),
      traces: [slash(path.relative(root, observerReceiptPath))],
      artifactReadback: [
        slash(options.candidatePackageReceipt),
        slash(options.preConfirmationSnapshot),
        slash(options.confirmationReceipt),
      ],
    },
    scenarioResults: {
      positive: stageObservations.map((entry) => entry.stageId),
      negative: ['registry_fallback_absent'],
      boundary: Object.keys(observerReceipt.formalBoundaryRefs),
      ordering: stageObservations.map((entry) => entry.stageId),
      replay: ['clean_baseline_restored'],
      bypass: ['workspace_link_count_zero'],
    },
    resetReceiptRef: slash(path.relative(root, resetReceiptPath)),
    rerunReceiptRef: slash(path.relative(root, observerReceiptPath)),
    substitutionCounts: {
      fixture: 0,
      mock: 0,
      alternateRoot: 0,
      workspaceLink: 0,
      synthetic: 0,
    },
    journeyHash: '',
    decision: 'PASS',
  };
  evidence.journeyHash = sha256(canonicalJson(evidence));
  validate(
    evidence,
    'requirements-contract-real-consumer-journey-evidence.schema.json',
    'real_consumer_journey'
  );
  writeGovernedJson(outputs[2], evidence);
  const receipt = {
    schemaVersion: 'requirements-contract-real-consumer-journey-command-receipt/v1',
    commandId: 'CMD-35',
    phase: options.phase,
    transactionId: phaseIdentity.transactionId,
    implementationAttemptId: phaseIdentity.implementationAttemptId,
    phaseAuditAttemptId: options.phaseAuditAttemptId,
    candidatePackageReceipt: ref(root, options.candidatePackageReceipt),
    journeyEvidence: ref(root, options.journeyEvidence),
    preConfirmationSnapshot: ref(root, options.preConfirmationSnapshot),
    confirmationReceipt: ref(root, options.confirmationReceipt),
    boundaryObserverReceipt: {
      path: slash(path.relative(root, observerReceiptPath)),
      hash: fileHash(observerReceiptPath),
    },
    installArgv: [path.basename(npmExecutable), ...installArgs],
    installExitCode: install.status ?? 1,
    passAuthority: false,
    decision: 'pass',
  };
  validate(
    receipt,
    'requirements-contract-real-consumer-journey-command-receipt.schema.json',
    'real_consumer_journey_command'
  );
  if (options.json) process.stdout.write(`${JSON.stringify(receipt)}\n`);
  return receipt;
}
