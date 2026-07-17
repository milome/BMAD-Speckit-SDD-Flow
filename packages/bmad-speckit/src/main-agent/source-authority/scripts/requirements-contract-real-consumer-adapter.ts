import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  fileHash,
  sha256,
  slash,
  writeGovernedJson,
} from './requirements-contract-governed-write';

type JsonRecord = Record<string, ReturnType<typeof JSON.parse>>;

export interface RequirementsContractRealConsumerAdapterInput {
  consumerRoot: string;
  installedPackageRoot: string;
  phaseRoot: string;
  transactionId: string;
  implementationAttemptId: string;
  phaseAuditAttemptId: string;
}

const PROBES = [
  ['STAGE-01', 'package.json'],
  ['STAGE-02', 'bin/bmad-speckit.js'],
  ['STAGE-03', 'dist/main-agent/index.js'],
  [
    'STAGE-04',
    'dist/main-agent/source-authority/scripts/requirements-contract-real-consumer-journey.js',
  ],
  [
    'STAGE-05',
    '_bmad/shared/requirements-contract/requirements-contract-package-runtime-action-binding-manifest.json',
  ],
  [
    'STAGE-06',
    'dist/main-agent/source-authority/scripts/requirements-contract-stage-registry.js',
  ],
  [
    'STAGE-07',
    'dist/main-agent/source-authority/scripts/requirements-contract-real-consumer-adapter.js',
  ],
  [
    'STAGE-08',
    'dist/main-agent/source-authority/scripts/requirements-contract-real-consumer-boundary-observer.js',
  ],
  [
    'STAGE-09',
    'dist/main-agent/source-authority/scripts/requirements-contract-evidence-verify.js',
  ],
  [
    'STAGE-10',
    'dist/main-agent/source-authority/scripts/requirements-contract-terminal-command-supervisor.js',
  ],
] as const;

const BOUNDARIES = {
  facade: {
    canonicalOwnerId: 'requirements-contract-read-facade',
    exactPath: 'dist/main-agent/index.js',
    stageId: 'STAGE-03',
  },
  registry: {
    canonicalOwnerId: 'requirements-contract-package-runtime-action-binding-manifest',
    exactPath:
      '_bmad/shared/requirements-contract/requirements-contract-package-runtime-action-binding-manifest.json',
    stageId: 'STAGE-05',
  },
  adapter: {
    canonicalOwnerId: 'requirements-contract-real-consumer-adapter',
    exactPath:
      'dist/main-agent/source-authority/scripts/requirements-contract-real-consumer-adapter.js',
    stageId: 'STAGE-07',
  },
  resolver: {
    canonicalOwnerId: 'requirements-contract-stage-registry',
    exactPath:
      'dist/main-agent/source-authority/scripts/requirements-contract-stage-registry.js',
    stageId: 'STAGE-06',
  },
  canonicalBoundary: {
    canonicalOwnerId: 'requirements-contract-real-consumer-journey',
    exactPath:
      'dist/main-agent/source-authority/scripts/requirements-contract-real-consumer-journey.js',
    stageId: 'STAGE-04',
  },
} as const;

function assertInstalledPackage(consumerRoot: string, installedRoot: string): number {
  const expectedParent = path.join(path.resolve(consumerRoot), 'node_modules');
  const real = fs.realpathSync(installedRoot);
  const relative = path.relative(expectedParent, real);
  if (
    relative.startsWith('..') ||
    path.isAbsolute(relative) ||
    fs.lstatSync(installedRoot).isSymbolicLink()
  ) {
    throw new Error('real_consumer_workspace_link_forbidden');
  }
  return 0;
}

function boundaryRecord(
  installedRoot: string,
  registryHash: string,
  receiptByStage: Map<string, JsonRecord>,
  input: RequirementsContractRealConsumerAdapterInput,
  spec: (typeof BOUNDARIES)[keyof typeof BOUNDARIES]
): JsonRecord {
  const target = path.join(installedRoot, spec.exactPath);
  const receipt = receiptByStage.get(spec.stageId);
  if (!receipt) throw new Error(`real_consumer_boundary_receipt_missing:${spec.stageId}`);
  return {
    canonicalOwnerId: spec.canonicalOwnerId,
    exactPath: slash(fs.realpathSync(target)),
    sha256: fileHash(target),
    registryId: 'requirements-contract-package-runtime-action-binding-manifest',
    registryVersion: 'v1',
    registryHash,
    consumerActionId: 'requirements-contract-real-consumer-journey',
    invocationReceiptPath: receipt.path,
    invocationReceiptHash: receipt.hash,
    transactionId: input.transactionId,
    implementationAttemptId: input.implementationAttemptId,
    phaseAuditAttemptId: input.phaseAuditAttemptId,
  };
}

export function runRequirementsContractRealConsumerAdapter(
  input: RequirementsContractRealConsumerAdapterInput
): JsonRecord {
  const consumerRoot = path.resolve(input.consumerRoot);
  const installedRoot = path.resolve(input.installedPackageRoot);
  const phaseRoot = path.resolve(input.phaseRoot);
  const workspaceLinkCount = assertInstalledPackage(consumerRoot, installedRoot);
  const receiptByStage = new Map<string, JsonRecord>();
  const stageObservations = PROBES.map(([stageId, relativePath]) => {
    const target = path.join(installedRoot, relativePath);
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      throw new Error(`real_consumer_installed_boundary_missing:${stageId}:${relativePath}`);
    }
    const receiptPath = path.join(
      phaseRoot,
      'consumer',
      'stages',
      `${stageId}.transition.receipt.json`
    );
    const receipt = {
      schemaVersion: 'requirements-contract-real-consumer-stage-transition-receipt/v1',
      stageId,
      observedPath: slash(fs.realpathSync(target)),
      observedHash: fileHash(target),
      transactionId: input.transactionId,
      implementationAttemptId: input.implementationAttemptId,
      phaseAuditAttemptId: input.phaseAuditAttemptId,
      decision: 'PASS',
    };
    writeGovernedJson(receiptPath, receipt);
    const receiptRef = { path: slash(receiptPath), hash: fileHash(receiptPath) };
    receiptByStage.set(stageId, receiptRef);
    return {
      stageId,
      eventRefs: [`${receipt.observedPath}#${receipt.observedHash}`],
      transitionReceiptRef: receiptRef.path,
      observedAt: new Date().toISOString(),
    };
  });
  const registryPath = path.join(installedRoot, BOUNDARIES.registry.exactPath);
  const registryHash = fileHash(registryPath);
  const formalBoundaryRefs = Object.fromEntries(
    Object.entries(BOUNDARIES).map(([role, spec]) => [
      role,
      [boundaryRecord(installedRoot, registryHash, receiptByStage, input, spec)],
    ])
  );
  return {
    stageObservations,
    formalBoundaryRefs,
    workspaceLinkCount,
    installedDependencyTreeHash: sha256(
      JSON.stringify(
        PROBES.map(([stageId, relativePath]) => ({
          stageId,
          path: relativePath,
          hash: fileHash(path.join(installedRoot, relativePath)),
        }))
      )
    ),
  };
}
