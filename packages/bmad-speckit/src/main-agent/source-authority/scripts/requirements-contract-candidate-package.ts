import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  distManifestHash,
  requirementsContractHashDomainRegistry,
  tarballBytesHash,
} from './requirements-contract-hash-domains';
import {
  createPackageRuntimeIndex,
  forbiddenPublishedSourceSnapshots,
  packageRuntimeHashFor,
} from './requirements-contract-package-runtime-index';
import { assertRuntimeBuildAuthorityCurrent } from './requirements-contract-runtime-build-authority';
import {
  canonicalJson,
  fileHash,
  sha256,
  slash,
  writeGovernedJson,
} from './requirements-contract-governed-write';

type JsonRecord = Record<string, ReturnType<typeof JSON.parse>>;

export interface RequirementsContractCandidatePackageOptions {
  cwd?: string;
  packageRoot: string;
  packageManifest: string;
  distRoot: string;
  phase: 'architecture' | 'pre-candidate' | 'final';
  phaseAuditAttemptId: string;
  tarball: string;
  receipt: string;
  json?: boolean;
}

function resolveWithin(root: string, value: string): string {
  const resolved = path.resolve(root, value);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`candidate_package_path_escape:${value}`);
  }
  return resolved;
}

function executablePath(command: string): string {
  const locator = process.platform === 'win32' ? 'where.exe' : 'which';
  const result = execFileSync(locator, [command], { encoding: 'utf8' })
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .find(Boolean);
  if (!result) throw new Error(`candidate_package_executable_missing:${command}`);
  return result;
}

function runExecutable(executable: string, args: string[], cwd?: string) {
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
    maxBuffer: 64 * 1024 * 1024,
  });
}

function fileManifest(root: string): JsonRecord[] {
  if (!fs.existsSync(root)) return [];
  const walk = (directory: string): JsonRecord[] =>
    fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) return walk(absolutePath);
      if (!entry.isFile()) return [];
      return [{
        path: slash(path.relative(root, absolutePath)),
        hash: fileHash(absolutePath),
        bytes: fs.statSync(absolutePath).size,
      }];
    });
  return walk(root).sort((left, right) => left.path.localeCompare(right.path));
}

function phaseIdentity(tarball: string, phase: string, auditAttemptId: string): JsonRecord {
  const segments = slash(tarball).split('/');
  const index = segments.lastIndexOf('audit-phases');
  if (index < 0 || segments.length < index + 5) {
    throw new Error('candidate_package_phase_path_invalid');
  }
  const identity = {
    transactionId: segments[index + 1],
    implementationAttemptId: segments[index + 2],
    phase: segments[index + 3],
    phaseAuditAttemptId: segments[index + 4],
  };
  if (identity.phase !== phase || identity.phaseAuditAttemptId !== auditAttemptId) {
    throw new Error('candidate_package_phase_identity_mismatch');
  }
  return identity;
}

function validateReceipt(receipt: JsonRecord): void {
  const schemaPath = path.resolve(
    __dirname,
    '..',
    'schemas',
    'requirements-contract-candidate-package-receipt.schema.json'
  );
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(
    JSON.parse(fs.readFileSync(schemaPath, 'utf8'))
  );
  if (!validate(receipt)) {
    throw new Error(`candidate_package_receipt_schema_invalid:${JSON.stringify(
      validate.errors ?? []
    )}`);
  }
}

export async function requirementsContractCandidatePackageCommand(
  options: RequirementsContractCandidatePackageOptions
): Promise<JsonRecord> {
  const root = path.resolve(options.cwd ?? process.cwd());
  const packageRoot = resolveWithin(root, options.packageRoot);
  const manifestPath = resolveWithin(root, options.packageManifest);
  const distRoot = resolveWithin(root, options.distRoot);
  const tarballPath = resolveWithin(root, options.tarball);
  const receiptPath = resolveWithin(root, options.receipt);
  if (manifestPath !== path.join(packageRoot, 'package.json')) {
    throw new Error('candidate_package_manifest_owner_mismatch');
  }
  if (!distRoot.startsWith(`${packageRoot}${path.sep}`)) {
    throw new Error('candidate_package_dist_owner_mismatch');
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as JsonRecord;
  if (manifest.name !== 'bmad-speckit') throw new Error('candidate_package_owner_invalid');
  const runtimeAssetManifestPath = path.join(
    distRoot,
    'main-agent',
    'runtime-asset-manifest.json'
  );
  const buildAuthorityReceiptPath = path.join(
    distRoot,
    'main-agent',
    'runtime-build-authority-receipt.json'
  );
  const buildAuthority = assertRuntimeBuildAuthorityCurrent({
    receipt: JSON.parse(fs.readFileSync(buildAuthorityReceiptPath, 'utf8')),
    packageRoot,
    runtimeAssetManifestPath,
    buildScriptPath: path.join(packageRoot, 'scripts', 'build-main-agent-dist.cjs'),
    dependencyLockPath: path.join(root, 'package-lock.json'),
  });
  if (process.version !== 'v22.22.1') throw new Error('candidate_package_node_version_mismatch');
  const npmExecutable = executablePath(process.platform === 'win32' ? 'npm.cmd' : 'npm');
  const npmVersionResult = runExecutable(npmExecutable, ['--version']);
  if (npmVersionResult.status !== 0) throw new Error('candidate_package_npm_version_probe_failed');
  const npmVersion = npmVersionResult.stdout.trim();
  if (npmVersion !== '10.9.4') throw new Error('candidate_package_npm_version_mismatch');
  const packArgs = ['pack', '--json', '--ignore-scripts'];
  const packResult = runExecutable(npmExecutable, packArgs, packageRoot);
  if (packResult.status !== 0) {
    throw new Error(`candidate_package_pack_failed:${packResult.stderr ?? ''}`);
  }
  const packOutput = JSON.parse(packResult.stdout) as JsonRecord[];
  if (!Array.isArray(packOutput) || packOutput.length !== 1) {
    throw new Error('candidate_package_pack_output_invalid');
  }
  const packed = packOutput[0];
  const originalPath = path.join(packageRoot, String(packed.filename));
  const originalHash = fileHash(originalPath);
  fs.mkdirSync(path.dirname(tarballPath), { recursive: true });
  if (fs.existsSync(tarballPath)) throw new Error('candidate_package_tarball_exists');
  fs.renameSync(originalPath, tarballPath);
  const canonicalHash = fileHash(tarballPath);
  if (canonicalHash !== originalHash) throw new Error('candidate_package_atomic_rename_drift');
  const packedEntries = (packed.files ?? [])
    .map((entry: JsonRecord) => `package/${slash(String(entry.path))}`)
    .sort();
  const forbiddenPackedSourceSnapshots = forbiddenPublishedSourceSnapshots(packedEntries);
  if (forbiddenPackedSourceSnapshots.length > 0) {
    throw new Error(
      `candidate_package_forbidden_source_snapshots:${forbiddenPackedSourceSnapshots.join(',')}`
    );
  }
  const sourceManifest = fileManifest(path.join(packageRoot, 'src'));
  const distManifest = fileManifest(distRoot);
  const extractRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'candidate-package-readback-'));
  let packedRuntimeHash = '';
  let packedRuntimeFileCount = 0;
  try {
    const tarExecutable = executablePath(process.platform === 'win32' ? 'tar.exe' : 'tar');
    const extract = runExecutable(
      tarExecutable,
      ['-xzf', tarballPath, '-C', extractRoot],
      root
    );
    if (extract.status !== 0) {
      throw new Error(`candidate_package_extract_failed:${extract.stderr ?? ''}`);
    }
    const extractedPackageRoot = path.join(extractRoot, 'package');
    packedRuntimeHash = packageRuntimeHashFor(extractedPackageRoot);
    packedRuntimeFileCount = createPackageRuntimeIndex(extractedPackageRoot).length;
  } finally {
    fs.rmSync(extractRoot, { recursive: true, force: true });
  }
  if (packedRuntimeHash !== buildAuthority.packageRuntimeHash) {
    throw new Error('candidate_package_packed_runtime_hash_mismatch');
  }
  const receipt = {
    schemaVersion: 'requirements-contract-candidate-package-receipt/v2',
    hashDomainRegistry: requirementsContractHashDomainRegistry(),
    packageManifestRef: { path: slash(path.relative(root, manifestPath)), hash: fileHash(manifestPath) },
    packageVersion: manifest.version,
    sourceManifestHash: sha256(canonicalJson(sourceManifest)),
    generatedDistManifestHash: distManifestHash(distManifest),
    runtimeAssetManifestRef: {
      path: slash(path.relative(root, runtimeAssetManifestPath)),
      hash: fileHash(runtimeAssetManifestPath),
    },
    buildAuthorityReceiptRef: {
      path: slash(path.relative(root, buildAuthorityReceiptPath)),
      hash: fileHash(buildAuthorityReceiptPath),
    },
    distBuildHash: buildAuthority.distBuildHash,
    nodeVersion: process.version,
    nodeExecutableRef: { path: slash(process.execPath), hash: fileHash(process.execPath) },
    npmVersion,
    npmExecutableRef: { path: slash(npmExecutable), hash: fileHash(npmExecutable) },
    packArgv: [path.basename(npmExecutable), ...packArgs],
    packCwd: slash(packageRoot),
    originalTarballRef: { path: slash(originalPath), hash: originalHash },
    canonicalTarballRef: { path: slash(tarballPath), hash: canonicalHash },
    packedEntries,
    packedEntrySetHash: sha256(canonicalJson(packedEntries)),
    forbiddenPackedSourceSnapshotCount: forbiddenPackedSourceSnapshots.length,
    packedRuntimeHash,
    packedRuntimeFileCount,
    phaseIdentity: phaseIdentity(tarballPath, options.phase, options.phaseAuditAttemptId),
    publicationHash: canonicalHash,
    tarballBytesHash: tarballBytesHash(fs.readFileSync(tarballPath)),
    readbackHash: fileHash(tarballPath),
    decision: 'pass',
  };
  validateReceipt(receipt);
  writeGovernedJson(receiptPath, receipt);
  if (options.json) process.stdout.write(`${JSON.stringify(receipt)}\n`);
  return receipt;
}
