const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function sha256(bytes) {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJsonCreateOnly(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
}

function take(args, name) {
  const index = args.indexOf(name);
  if (index < 0 || args[index + 1] === undefined) {
    throw new Error(`${name} is required`);
  }
  return args[index + 1];
}

function copyPredecessor(root, detachedRoot, manifest) {
  fs.mkdirSync(detachedRoot, { recursive: true });
  for (const entry of manifest.files) {
    if (!entry.exists) continue;
    const sourcePath = path.isAbsolute(entry.sourcePath)
      ? entry.sourcePath
      : path.join(root, entry.sourcePath);
    const targetPath = path.join(detachedRoot, entry.path);
    const sourceBytes = fs.readFileSync(sourcePath);
    if (sha256(sourceBytes) !== entry.sha256) {
      throw new Error(`predecessor source hash mismatch: ${entry.path}`);
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, sourceBytes, { flag: 'wx' });
  }
}

function verifyPredecessor(detachedRoot, manifest) {
  const mismatches = [];
  for (const entry of manifest.files) {
    const targetPath = path.join(detachedRoot, entry.path);
    if (!entry.exists) {
      if (fs.existsSync(targetPath)) mismatches.push(`${entry.path}:unexpected`);
      continue;
    }
    if (!fs.existsSync(targetPath)) {
      mismatches.push(`${entry.path}:missing`);
      continue;
    }
    const observed = sha256(fs.readFileSync(targetPath));
    if (observed !== entry.sha256) mismatches.push(`${entry.path}:hash`);
  }
  return mismatches;
}

const args = process.argv.slice(2);
const root = process.cwd();
const contractPath = path.resolve(root, take(args, '--contract'));
const attemptContextPath = path.resolve(root, take(args, '--attempt-context'));
const predecessorContractHash = take(args, '--predecessor-contract-hash');
const predecessorManifestPath = path.resolve(
  root,
  take(args, '--predecessor-file-set-manifest')
);
const predecessorManifestHash = take(args, '--predecessor-file-set-hash');
const nestedManifestPath = path.resolve(root, take(args, '--nested-execution-manifest'));
const nestedManifestHash = take(args, '--nested-execution-manifest-hash');
const redQualificationRunId = take(args, '--red-qualification-run-id');
const overlayPath = path.resolve(root, take(args, '--test-overlay-path'));
const overlayHash = take(args, '--test-overlay-hash');
const assertionId = take(args, '--assertion-id');
const nestedReceiptPath = path.resolve(root, take(args, '--nested-receipt'));
const outputPath = path.resolve(root, take(args, '--out'));
const json = args.includes('--json');

const attemptContextBytes = fs.readFileSync(attemptContextPath);
const attemptContext = JSON.parse(attemptContextBytes.toString('utf8'));
const predecessorManifestBytes = fs.readFileSync(predecessorManifestPath);
const predecessorManifest = JSON.parse(predecessorManifestBytes.toString('utf8'));
const nestedManifestBytes = fs.readFileSync(nestedManifestPath);
const nestedManifest = JSON.parse(nestedManifestBytes.toString('utf8'));

if (sha256(fs.readFileSync(contractPath)) !== attemptContext.contractHash) {
  throw new Error('current contract hash mismatch');
}
if (attemptContext.predecessorContractHash !== predecessorContractHash) {
  throw new Error('predecessor contract hash mismatch');
}
if (sha256(predecessorManifestBytes) !== predecessorManifestHash) {
  throw new Error('predecessor manifest hash mismatch');
}
if (sha256(nestedManifestBytes) !== nestedManifestHash) {
  throw new Error('nested execution manifest hash mismatch');
}
if (sha256(fs.readFileSync(overlayPath)) !== overlayHash) {
  throw new Error('test overlay hash mismatch');
}
if (
  attemptContext.redQualificationRunId !== redQualificationRunId ||
  nestedManifest.redQualificationRunId !== redQualificationRunId
) {
  throw new Error('RED qualification identity mismatch');
}
if (
  nestedManifest.assertionId !== assertionId ||
  nestedManifest.testOverlayHash !== overlayHash
) {
  throw new Error('nested assertion or overlay binding mismatch');
}

const detachedRoot = path.resolve(nestedManifest.detachedCwd);
if (fs.existsSync(detachedRoot)) {
  throw new Error(`detached predecessor path already exists: ${detachedRoot}`);
}

copyPredecessor(root, detachedRoot, predecessorManifest);
const detachedOverlayPath = path.join(detachedRoot, path.relative(root, overlayPath));
fs.mkdirSync(path.dirname(detachedOverlayPath), { recursive: true });
fs.writeFileSync(detachedOverlayPath, fs.readFileSync(overlayPath), { flag: 'wx' });

const preRunMismatches = verifyPredecessor(detachedRoot, predecessorManifest);
if (preRunMismatches.length > 0) {
  throw new Error(`predecessor materialization mismatch: ${preRunMismatches[0]}`);
}

const environment = {};
for (const name of nestedManifest.environmentAllowlist) {
  if (process.env[name] !== undefined) environment[name] = process.env[name];
}
Object.assign(environment, nestedManifest.fixedEnvironment);

const startedAt = new Date().toISOString();
const [executablePath, ...childArgs] = nestedManifest.argv;
const result = spawnSync(executablePath, childArgs, {
  cwd: detachedRoot,
  env: environment,
  encoding: 'utf8',
  windowsHide: true,
});
const endedAt = new Date().toISOString();
const combinedOutput = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
const targetAssertionReached = combinedOutput.includes(assertionId);
const postRunMismatches = verifyPredecessor(detachedRoot, predecessorManifest);
const overlayReadbackHash = sha256(fs.readFileSync(detachedOverlayPath));

const nestedReceipt = {
  schemaVersion: 'requirements-contract-qualified-red-nested-command-receipt/v1',
  transactionId: attemptContext.transactionId,
  implementationAttemptId: attemptContext.implementationAttemptId,
  architectureAuditAttemptId: attemptContext.architectureAuditAttemptId,
  redQualificationRunId,
  contractHash: attemptContext.contractHash,
  predecessorContractHash,
  cwd: detachedRoot,
  argv: nestedManifest.argv,
  argvHash: nestedManifest.argvHash,
  startedAt,
  endedAt,
  exitCode: result.status ?? 1,
  signal: result.signal,
  stdoutHash: sha256(Buffer.from(result.stdout ?? '', 'utf8')),
  stderrHash: sha256(Buffer.from(result.stderr ?? '', 'utf8')),
  targetAssertionId: assertionId,
  targetAssertionReached,
  predecessorMismatchCount: postRunMismatches.length,
  overlayPath: path.relative(root, overlayPath).replaceAll('\\', '/'),
  overlayHash,
  overlayReadbackHash,
  decision:
    result.status !== 0 && targetAssertionReached && postRunMismatches.length === 0
      ? 'expected_red'
      : 'block',
  passAuthority: false,
};
writeJsonCreateOnly(nestedReceiptPath, nestedReceipt);
const nestedReceiptHash = sha256(fs.readFileSync(nestedReceiptPath));

const qualifiedRedReceipt = {
  schemaVersion: 'requirements-contract-qualified-red-receipt/v1',
  transactionId: attemptContext.transactionId,
  implementationAttemptId: attemptContext.implementationAttemptId,
  architectureAuditAttemptId: attemptContext.architectureAuditAttemptId,
  redQualificationRunId,
  contractPath: path.relative(root, contractPath).replaceAll('\\', '/'),
  contractHash: attemptContext.contractHash,
  predecessorContractHash,
  predecessorFileSetManifestPath: path
    .relative(root, predecessorManifestPath)
    .replaceAll('\\', '/'),
  predecessorFileSetManifestHash: predecessorManifestHash,
  predecessorFileEntrySetHash: predecessorManifest.fileEntrySetHash,
  predecessorFileCount: predecessorManifest.fileCount,
  predecessorMismatchCount: postRunMismatches.length,
  nestedExecutionManifestPath: path.relative(root, nestedManifestPath).replaceAll('\\', '/'),
  nestedExecutionManifestHash: nestedManifestHash,
  nestedCommandReceiptPath: path.relative(root, nestedReceiptPath).replaceAll('\\', '/'),
  nestedCommandReceiptHash: nestedReceiptHash,
  testOverlayPath: path.relative(root, overlayPath).replaceAll('\\', '/'),
  testOverlayHash: overlayHash,
  assertionId,
  targetAssertionReached,
  expectedFailurePhase: 'cli_action_resolution',
  nestedExitCode: result.status ?? 1,
  zeroPredecessorProductionFileDrift: postRunMismatches.length === 0,
  detachedCwd: detachedRoot,
  createdAt: new Date().toISOString(),
  decision:
    result.status !== 0 && targetAssertionReached && postRunMismatches.length === 0
      ? 'expected_red'
      : 'block',
  passAuthority: false,
};
writeJsonCreateOnly(outputPath, qualifiedRedReceipt);

if (json) {
  process.stdout.write(
    `${JSON.stringify(
      {
        decision: qualifiedRedReceipt.decision,
        targetAssertionReached,
        nestedExitCode: qualifiedRedReceipt.nestedExitCode,
        predecessorMismatchCount: qualifiedRedReceipt.predecessorMismatchCount,
        nestedReceiptPath: path.relative(root, nestedReceiptPath).replaceAll('\\', '/'),
        outputPath: path.relative(root, outputPath).replaceAll('\\', '/'),
        outputHash: sha256(fs.readFileSync(outputPath)),
      },
      null,
      2
    )}\n`
  );
}

if (qualifiedRedReceipt.decision !== 'expected_red') process.exitCode = 1;
