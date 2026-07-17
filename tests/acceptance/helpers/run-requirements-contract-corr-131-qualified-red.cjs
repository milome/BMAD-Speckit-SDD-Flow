const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const CONTRACT_RELATIVE_PATH =
  'docs/plans/2026-07-16-loop-engineering-evidence-closure-remediation-amend12-goal-execution-plan.md';
const LEDGER_RELATIVE_PATH =
  'docs/plans/.2026-07-11-loop-engineering-evidence-closure-remediation-amend10-audit-disposition.md';
const PRODUCER_RELATIVE_PATH =
  'tests/acceptance/helpers/run-requirements-contract-corr-131-qualified-red.cjs';

function sha256(bytes) {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function canonicalJsonBytes(value) {
  return Buffer.from(`${stableStringify(value)}\n`, 'utf8');
}

function parseOptions(argv, allowedNames) {
  const allowed = new Set(allowedNames);
  const values = new Map();
  let json = false;
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (name === '--json') {
      if (json) throw new Error('duplicate --json option');
      json = true;
      continue;
    }
    if (!name.startsWith('--') || !allowed.has(name)) {
      throw new Error(`unknown option or positional argument: ${name}`);
    }
    if (values.has(name)) throw new Error(`duplicate option: ${name}`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`${name} requires one value`);
    }
    values.set(name, value);
    index += 1;
  }
  for (const name of allowed) {
    if (!values.has(name)) throw new Error(`${name} is required`);
  }
  return {
    json,
    take(name) {
      return values.get(name);
    },
  };
}

function normalizeRelative(value) {
  return value.replaceAll('\\', '/');
}

function resolveExactRelative(root, supplied, expected, field) {
  if (normalizeRelative(supplied) !== expected) {
    throw new Error(`${field} must equal ${expected}`);
  }
  return path.join(root, ...expected.split('/'));
}

function resolveAttemptScopedPath(root, supplied, transactionId, implementationAttemptId, field) {
  const normalized = normalizeRelative(supplied);
  const requiredPrefix =
    `docs/plans/evidence/loop-engineering-remediation/corr-131/${transactionId}/` +
    `${implementationAttemptId}/`;
  if (
    path.isAbsolute(supplied) ||
    !normalized.startsWith(requiredPrefix) ||
    normalized.includes('/../') ||
    normalized.endsWith('/..')
  ) {
    throw new Error(`${field} is not current-attempt scoped`);
  }
  const resolved = path.resolve(root, supplied);
  const allowedRoot = path.resolve(root, requiredPrefix);
  if (resolved !== allowedRoot && !resolved.startsWith(`${allowedRoot}${path.sep}`)) {
    throw new Error(`${field} escapes the current attempt root`);
  }
  return resolved;
}

function readJson(filePath, field) {
  const bytes = fs.readFileSync(filePath);
  try {
    return { bytes, value: JSON.parse(bytes.toString('utf8')) };
  } catch (error) {
    throw new Error(`${field} is not valid JSON: ${error.message}`);
  }
}

function writeCreateOnlyDurable(filePath, bytes) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const descriptor = fs.openSync(filePath, 'wx', 0o600);
  try {
    let offset = 0;
    while (offset < bytes.length) {
      offset += fs.writeSync(descriptor, bytes, offset, bytes.length - offset, offset);
    }
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  const readback = fs.readFileSync(filePath);
  if (!readback.equals(bytes)) throw new Error(`create-only readback mismatch: ${filePath}`);
  return sha256(readback);
}

function writeJsonCreateOnly(filePath, value) {
  return writeCreateOnlyDurable(filePath, canonicalJsonBytes(value));
}

function exactMaximumCorrId(bytes) {
  const text = bytes.toString('utf8');
  const ids = [...text.matchAll(/^\| CORR-(\d{3,}) \|/gmu)].map((match) =>
    Number.parseInt(match[1], 10)
  );
  if (ids.length === 0) throw new Error('ledger contains no CORR rows');
  for (let index = 0; index < ids.length; index += 1) {
    if (ids[index] !== index + 1) {
      throw new Error(`ledger CORR sequence mismatch at index ${index}`);
    }
  }
  return ids.at(-1);
}

function parseCandidateRow(rowBytes, lifecycle) {
  const text = rowBytes.toString('utf8');
  if (!text.endsWith('\n') || text.endsWith('\r\n') || text.slice(0, -1).includes('\n')) {
    throw new Error('ledger row must be one LF-terminated line');
  }
  if (text.includes('\0') || /^#{1,6}\s/mu.test(text)) {
    throw new Error('ledger row contains a forbidden byte or heading');
  }
  const cells = text
    .slice(0, -1)
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
  if (cells.length !== 5 || cells.some((cell) => cell.length === 0)) {
    throw new Error('ledger row must contain exactly five non-empty cells');
  }
  if (cells[0] !== lifecycle.lifecycleId) {
    throw new Error('ledger row lifecycle ID mismatch');
  }
  for (const cell of cells.slice(1)) {
    if (!cell.includes('CORR-131') || !cell.includes(lifecycle.requiredStatus)) {
      throw new Error('ledger row lifecycle state binding is incomplete');
    }
  }
  if (
    lifecycle.expectedPredecessorLifecycleId !== 'none' &&
    !cells.slice(1).some((cell) => cell.includes(lifecycle.expectedPredecessorLifecycleId))
  ) {
    throw new Error('ledger row predecessor lifecycle binding is missing');
  }
  return cells;
}

function lifecycleDefinition(phase, lifecycleId, expectedPredecessorLifecycleId, expectedMaxId) {
  const definitions = {
    open: {
      lifecycleId: 'CORR-187',
      predecessor: 'none',
      expectedMaxId: 186,
      requiredStatus: 'OPEN (qualified_red)',
    },
    'root-cause': {
      lifecycleId: 'CORR-188',
      predecessor: 'CORR-187',
      expectedMaxId: 187,
      requiredStatus: 'ROOT_CAUSE_CONFIRMED',
    },
    close: {
      lifecycleId: 'CORR-189',
      predecessor: 'CORR-188',
      expectedMaxId: 188,
      requiredStatus: null,
    },
  };
  const definition = definitions[phase];
  if (!definition) throw new Error(`unsupported ledger lifecycle phase: ${phase}`);
  if (
    lifecycleId !== definition.lifecycleId ||
    expectedPredecessorLifecycleId !== definition.predecessor ||
    expectedMaxId !== definition.expectedMaxId
  ) {
    throw new Error('ledger lifecycle identity or predecessor mismatch');
  }
  const requiredStatus =
    phase === 'close' ? null : definition.requiredStatus;
  return {
    lifecyclePhase: phase,
    lifecycleId,
    expectedPredecessorLifecycleId,
    expectedMaxId,
    requiredStatus,
  };
}

function expectedAttemptContextRelativePath(transactionId, implementationAttemptId) {
  return (
    `docs/plans/evidence/loop-engineering-remediation/attempts/${transactionId}/` +
    `${implementationAttemptId}/pre-edit-attempt-context-receipt.json`
  );
}

function expectedLifecycleContextRelativePath(
  transactionId,
  implementationAttemptId,
  lifecyclePhase
) {
  return (
    `docs/plans/evidence/loop-engineering-remediation/corr-131/${transactionId}/` +
    `${implementationAttemptId}/ledger/contexts/${lifecyclePhase}.json`
  );
}

function expectedLedgerRowRelativePath(transactionId, implementationAttemptId, lifecycleId) {
  return (
    `docs/plans/evidence/loop-engineering-remediation/corr-131/${transactionId}/` +
    `${implementationAttemptId}/ledger/rows/${lifecycleId}.md`
  );
}

function expectedLedgerReceiptDirRelativePath(transactionId, implementationAttemptId) {
  return (
    `docs/plans/evidence/loop-engineering-remediation/corr-131/${transactionId}/` +
    `${implementationAttemptId}/ledger/receipts`
  );
}

function preparationManifestPath(receiptDir, lifecyclePhase) {
  return path.join(receiptDir, `${lifecyclePhase}.preparation.manifest.json`);
}

function validateContractAndAttemptContext(root, options) {
  const contractPath = resolveExactRelative(
    root,
    options.contract,
    CONTRACT_RELATIVE_PATH,
    '--contract'
  );
  const contractBytes = fs.readFileSync(contractPath);
  if (sha256(contractBytes) !== options.contractHash) {
    throw new Error('contract hash mismatch');
  }
  const attemptContextPath = path.resolve(root, options.attemptContext);
  const attemptContextRead = readJson(attemptContextPath, 'attempt context');
  const attemptContext = attemptContextRead.value;
  if (
    typeof attemptContext.transactionId !== 'string' ||
    typeof attemptContext.implementationAttemptId !== 'string' ||
    attemptContext.contractPath !== CONTRACT_RELATIVE_PATH ||
    attemptContext.contractHash !== options.contractHash
  ) {
    throw new Error('attempt context identity or contract binding mismatch');
  }
  const expectedAttemptPath = expectedAttemptContextRelativePath(
    attemptContext.transactionId,
    attemptContext.implementationAttemptId
  );
  if (
    normalizeRelative(path.relative(root, attemptContextPath)) !== expectedAttemptPath
  ) {
    throw new Error('attempt context path does not match the current attempt formula');
  }
  return {
    contractPath,
    contractBytes,
    attemptContextPath,
    attemptContextBytes: attemptContextRead.bytes,
    attemptContext,
    transactionId: attemptContext.transactionId,
    implementationAttemptId: attemptContext.implementationAttemptId,
  };
}

function validateLifecycleContext(input) {
  const context = input.context;
  if (
    context.schemaVersion !== 'corr-131-ledger-lifecycle-context/v1' ||
    context.contractPath !== CONTRACT_RELATIVE_PATH ||
    context.contractHash !== input.contractHash ||
    context.transactionId !== input.transactionId ||
    context.implementationAttemptId !== input.implementationAttemptId ||
    context.phase !== input.lifecycle.lifecyclePhase ||
    context.lifecycleId !== input.lifecycle.lifecycleId ||
    context.ledgerPath !== LEDGER_RELATIVE_PATH ||
    context.expectedPreimageHash !== input.expectedPreimageHash ||
    context.expectedMaximumId !== input.lifecycle.expectedMaxId ||
    context.expectedPredecessorLifecycleId !==
      input.lifecycle.expectedPredecessorLifecycleId ||
    typeof context.row !== 'string'
  ) {
    throw new Error('ledger lifecycle context binding mismatch');
  }
  const rowBytes = Buffer.from(context.row, 'utf8');
  const cells = parseCandidateRow(rowBytes, {
    ...input.lifecycle,
    requiredStatus: input.lifecycle.requiredStatus ?? 'CLOSED',
  });
  const status =
    input.lifecycle.lifecyclePhase === 'close'
      ? validateCloseStatus(cells)
      : input.lifecycle.requiredStatus;
  if (context.status !== status) {
    throw new Error('ledger lifecycle context status mismatch');
  }
  return { rowBytes, cells, status };
}

function prepareCorr131LedgerLifecycle(options) {
  const root = process.cwd();
  const authority = validateContractAndAttemptContext(root, options);
  const lifecycleContextPath = resolveAttemptScopedPath(
    root,
    options.lifecycleContext,
    authority.transactionId,
    authority.implementationAttemptId,
    '--lifecycle-context'
  );
  const expectedContextPath = expectedLifecycleContextRelativePath(
    authority.transactionId,
    authority.implementationAttemptId,
    options.lifecyclePhase
  );
  if (normalizeRelative(path.relative(root, lifecycleContextPath)) !== expectedContextPath) {
    throw new Error('ledger lifecycle context path mismatch');
  }
  const receiptDir = resolveAttemptScopedPath(
    root,
    options.receiptDir,
    authority.transactionId,
    authority.implementationAttemptId,
    '--receipt-dir'
  );
  const expectedReceiptDir = expectedLedgerReceiptDirRelativePath(
    authority.transactionId,
    authority.implementationAttemptId
  );
  if (normalizeRelative(path.relative(root, receiptDir)) !== expectedReceiptDir) {
    throw new Error('ledger receipt directory path mismatch');
  }
  const ledgerPath = resolveExactRelative(
    root,
    options.ledger,
    LEDGER_RELATIVE_PATH,
    '--ledger'
  );
  const lifecycleContextRead = readJson(lifecycleContextPath, 'ledger lifecycle context');
  const context = lifecycleContextRead.value;
  const expectedMaximumId = Number(context.expectedMaximumId);
  if (!Number.isSafeInteger(expectedMaximumId)) {
    throw new Error('ledger lifecycle context expected maximum ID is invalid');
  }
  const lifecycle = lifecycleDefinition(
    options.lifecyclePhase,
    context.lifecycleId,
    context.expectedPredecessorLifecycleId,
    expectedMaximumId
  );
  const validatedContext = validateLifecycleContext({
    context,
    contractHash: options.contractHash,
    transactionId: authority.transactionId,
    implementationAttemptId: authority.implementationAttemptId,
    lifecycle,
    expectedPreimageHash: context.expectedPreimageHash,
  });
  const ledgerBytes = fs.readFileSync(ledgerPath);
  if (
    sha256(ledgerBytes) !== context.expectedPreimageHash ||
    exactMaximumCorrId(ledgerBytes) !== lifecycle.expectedMaxId
  ) {
    throw new Error('ledger preparation preimage or maximum ID mismatch');
  }
  const rowRelativePath = expectedLedgerRowRelativePath(
    authority.transactionId,
    authority.implementationAttemptId,
    lifecycle.lifecycleId
  );
  const rowPath = path.resolve(root, rowRelativePath);
  const rowHash = writeCreateOnlyDurable(rowPath, validatedContext.rowBytes);
  const manifestPath = preparationManifestPath(receiptDir, lifecycle.lifecyclePhase);
  const manifest = {
    schemaVersion: 'corr-131-ledger-preparation-manifest/v1',
    contractPath: CONTRACT_RELATIVE_PATH,
    contractHash: options.contractHash,
    transactionId: authority.transactionId,
    implementationAttemptId: authority.implementationAttemptId,
    phase: lifecycle.lifecyclePhase,
    ledgerPath: LEDGER_RELATIVE_PATH,
    expectedPreimageHash: context.expectedPreimageHash,
    expectedMaximumId: lifecycle.expectedMaxId,
    expectedPredecessorLifecycleId: lifecycle.expectedPredecessorLifecycleId,
    lifecycleContextPath: expectedContextPath,
    lifecycleContextHash: sha256(lifecycleContextRead.bytes),
    rowPath: rowRelativePath,
    rowHash,
    receiptDir: expectedReceiptDir,
    producerPath: PRODUCER_RELATIVE_PATH,
    producerHash: sha256(fs.readFileSync(__filename)),
    preparedAt: new Date().toISOString(),
  };
  const manifestHash = writeJsonCreateOnly(manifestPath, manifest);
  return {
    rowPath: rowRelativePath,
    rowHash,
    preparationManifestPath: normalizeRelative(path.relative(root, manifestPath)),
    preparationManifestHash: manifestHash,
  };
}

function validatePreparationManifest(input) {
  const manifestPath = preparationManifestPath(
    input.receiptDir,
    input.lifecycle.lifecyclePhase
  );
  const manifestRead = readJson(manifestPath, 'ledger preparation manifest');
  const manifest = manifestRead.value;
  const expectedKeys = [
    'schemaVersion',
    'contractPath',
    'contractHash',
    'transactionId',
    'implementationAttemptId',
    'phase',
    'ledgerPath',
    'expectedPreimageHash',
    'expectedMaximumId',
    'expectedPredecessorLifecycleId',
    'lifecycleContextPath',
    'lifecycleContextHash',
    'rowPath',
    'rowHash',
    'receiptDir',
    'producerPath',
    'producerHash',
    'preparedAt',
  ];
  if (
    Object.keys(manifest).sort().join('\n') !== expectedKeys.sort().join('\n') ||
    manifest.schemaVersion !== 'corr-131-ledger-preparation-manifest/v1' ||
    manifest.contractPath !== CONTRACT_RELATIVE_PATH ||
    manifest.contractHash !== input.contractHash ||
    manifest.transactionId !== input.transactionId ||
    manifest.implementationAttemptId !== input.implementationAttemptId ||
    manifest.phase !== input.lifecycle.lifecyclePhase ||
    manifest.ledgerPath !== LEDGER_RELATIVE_PATH ||
    manifest.expectedPreimageHash !== input.expectedPreimageHash ||
    manifest.expectedMaximumId !== input.lifecycle.expectedMaxId ||
    manifest.expectedPredecessorLifecycleId !==
      input.lifecycle.expectedPredecessorLifecycleId ||
    manifest.rowPath !== input.rowRelativePath ||
    manifest.rowHash !== input.rowHash ||
    manifest.receiptDir !== input.receiptDirRelativePath ||
    manifest.producerPath !== PRODUCER_RELATIVE_PATH ||
    manifest.producerHash !== sha256(fs.readFileSync(__filename)) ||
    typeof manifest.preparedAt !== 'string' ||
    !Number.isFinite(Date.parse(manifest.preparedAt))
  ) {
    throw new Error('ledger preparation manifest binding mismatch');
  }
  const lifecycleContextPath = path.resolve(input.root, manifest.lifecycleContextPath);
  const lifecycleContextRead = readJson(
    lifecycleContextPath,
    'ledger preparation lifecycle context'
  );
  if (sha256(lifecycleContextRead.bytes) !== manifest.lifecycleContextHash) {
    throw new Error('ledger preparation lifecycle context hash mismatch');
  }
  validateLifecycleContext({
    context: lifecycleContextRead.value,
    contractHash: input.contractHash,
    transactionId: input.transactionId,
    implementationAttemptId: input.implementationAttemptId,
    lifecycle: input.lifecycle,
    expectedPreimageHash: input.expectedPreimageHash,
  });
  if (sha256(manifestRead.bytes) !== sha256(fs.readFileSync(manifestPath))) {
    throw new Error('ledger preparation manifest readback mismatch');
  }
}

function validateCloseStatus(cells) {
  const status = cells
    .slice(1)
    .every((cell) => cell.includes('CLOSED'))
    ? 'CLOSED'
    : cells.slice(1).every((cell) => cell.includes('STILL_BLOCKED'))
      ? 'STILL_BLOCKED'
      : null;
  if (!status) throw new Error('close row must consistently use CLOSED or STILL_BLOCKED');
  return status;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function normalizeFailureFramePath(repositoryRoot, framePath) {
  const withoutUrl = framePath.startsWith('file:///')
    ? decodeURIComponent(framePath.slice('file:///'.length))
    : framePath;
  const absolutePath = path.resolve(withoutUrl);
  const relativePath = normalizeRelative(path.relative(path.resolve(repositoryRoot), absolutePath));
  if (!relativePath || relativePath.startsWith('../') || path.isAbsolute(relativePath)) {
    throw new Error('assertion stack frame escapes the repository root');
  }
  return relativePath;
}

function validateCorr131VitestFailure(input) {
  const assertionEvent = input.assertionEvent;
  const assertionResults = (input.vitestResult?.testResults ?? []).flatMap(
    (testResult) => testResult.assertionResults ?? []
  );
  const matches = assertionResults.filter(
    (result) => result.status === 'failed' && result.fullName === assertionEvent?.testFullName
  );
  if (matches.length !== 1) {
    throw new Error('Vitest result must contain exactly one target failed assertion');
  }
  const failureMessages = matches[0].failureMessages;
  if (!Array.isArray(failureMessages) || failureMessages.length !== 1) {
    throw new Error('target failed assertion must contain exactly one failureMessages[0]');
  }
  const failureMessage = failureMessages[0];
  if (typeof failureMessage !== 'string') {
    throw new Error('failureMessages[0] must be a string');
  }
  const lines = failureMessage.split('\n');
  const firstLinePattern = new RegExp(
    `^AssertionError: ${escapeRegExp(input.assertionId)}: expected '([^'\\r\\n]*)' to be '([^'\\r\\n]*)' // Object\\.is equality$`,
    'u'
  );
  const firstLineMatch = firstLinePattern.exec(lines[0]);
  if (!firstLineMatch) {
    throw new Error('failureMessages[0] does not match the frozen Vitest assertion grammar');
  }
  const actual = firstLineMatch[1];
  const expected = firstLineMatch[2];
  const framePattern = /^\s+at (.+):(\d+):(\d+)$/u;
  let normalizedFailureFrame = null;
  for (const line of lines.slice(1)) {
    const frameMatch = framePattern.exec(line);
    if (!frameMatch) continue;
    const normalizedPath = normalizeFailureFramePath(input.repositoryRoot, frameMatch[1]);
    if (normalizedPath !== normalizeRelative(input.testPath)) continue;
    normalizedFailureFrame = `${normalizedPath}:${frameMatch[2]}:${frameMatch[3]}`;
    break;
  }
  if (!normalizedFailureFrame) {
    throw new Error('failureMessages[0] does not contain the target TEST-01 stack frame');
  }
  if (
    actual !== assertionEvent.actual ||
    expected !== assertionEvent.expected ||
    normalizedFailureFrame !== assertionEvent.assertionSite?.normalizedFailureFrame
  ) {
    throw new Error('Vitest failure does not equal the assertion event');
  }
  return { actual, expected, normalizedFailureFrame };
}

function readDescriptorBytes(descriptor, byteLength, position) {
  const bytes = Buffer.alloc(byteLength);
  let offset = 0;
  while (offset < byteLength) {
    const count = fs.readSync(descriptor, bytes, offset, byteLength - offset, position + offset);
    if (count === 0) break;
    offset += count;
  }
  if (offset !== byteLength) throw new Error('descriptor read ended before the expected length');
  return bytes;
}

function writeDescriptorBytes(descriptor, bytes, position) {
  let offset = 0;
  while (offset < bytes.length) {
    const count = fs.writeSync(descriptor, bytes, offset, bytes.length - offset, position + offset);
    if (count <= 0) throw new Error('descriptor write made no progress');
    offset += count;
  }
}

function receiptPaths(receiptDir, lifecycleId) {
  return {
    lock: path.join(receiptDir, `${lifecycleId}.lock.receipt.json`),
    append: path.join(receiptDir, `${lifecycleId}.append.receipt.json`),
    readback: path.join(receiptDir, `${lifecycleId}.readback.receipt.json`),
    release: path.join(receiptDir, `${lifecycleId}.lock-release.receipt.json`),
  };
}

function runCorr131LedgerAppendTransaction(options) {
  const root = process.cwd();
  const authority = validateContractAndAttemptContext(root, options);
  const transactionId = authority.transactionId;
  const implementationAttemptId = authority.implementationAttemptId;
  const ledgerPath = resolveExactRelative(
    root,
    options.ledger,
    LEDGER_RELATIVE_PATH,
    '--ledger'
  );
  const lockPath = `${ledgerPath}.lock`;
  const rowPath = resolveAttemptScopedPath(
    root,
    options.rowFile,
    transactionId,
    implementationAttemptId,
    '--row-file'
  );
  const receiptDir = resolveAttemptScopedPath(
    root,
    options.receiptDir,
    transactionId,
    implementationAttemptId,
    '--receipt-dir'
  );
  const receiptDirRelativePath = normalizeRelative(path.relative(root, receiptDir));
  if (
    receiptDirRelativePath !==
    expectedLedgerReceiptDirRelativePath(transactionId, implementationAttemptId)
  ) {
    throw new Error('ledger receipt directory path mismatch');
  }
  const expectedMaxId = Number.parseInt(options.expectedMaxId, 10);
  if (!Number.isSafeInteger(expectedMaxId) || String(expectedMaxId) !== options.expectedMaxId) {
    throw new Error('--expected-max-id must be a canonical decimal integer');
  }
  const lifecycle = lifecycleDefinition(
    options.lifecyclePhase,
    options.lifecycleId,
    options.expectedPredecessorLifecycleId,
    expectedMaxId
  );
  const rowBytes = fs.readFileSync(rowPath);
  if (sha256(rowBytes) !== options.rowHash) throw new Error('ledger row hash mismatch');
  const rowRelativePath = normalizeRelative(path.relative(root, rowPath));
  if (
    rowRelativePath !==
    expectedLedgerRowRelativePath(transactionId, implementationAttemptId, lifecycle.lifecycleId)
  ) {
    throw new Error('ledger row path mismatch');
  }
  const cells = parseCandidateRow(rowBytes, {
    ...lifecycle,
    requiredStatus: lifecycle.requiredStatus ?? 'CLOSED',
  });
  if (lifecycle.lifecyclePhase === 'close') validateCloseStatus(cells);
  validatePreparationManifest({
    root,
    contractHash: options.contractHash,
    transactionId,
    implementationAttemptId,
    lifecycle,
    expectedPreimageHash: options.expectedPreimageHash,
    rowRelativePath,
    rowHash: options.rowHash,
    receiptDir,
    receiptDirRelativePath,
  });

  fs.mkdirSync(receiptDir, { recursive: true });
  const paths = receiptPaths(receiptDir, lifecycle.lifecycleId);
  for (const receiptPath of Object.values(paths)) {
    if (fs.existsSync(receiptPath)) throw new Error(`receipt already exists: ${receiptPath}`);
  }
  const lockOwner = crypto.randomUUID();
  const lockValue = {
    schemaVersion: 'corr-131-ledger-lock/v1',
    transactionId,
    implementationAttemptId,
    lifecycleId: lifecycle.lifecycleId,
    expectedPredecessorLifecycleId: lifecycle.expectedPredecessorLifecycleId,
    ledgerPath: LEDGER_RELATIVE_PATH,
    expectedPreimageHash: options.expectedPreimageHash,
    expectedMaxId,
    lockOwner,
  };
  const lockBytes = canonicalJsonBytes(lockValue);
  writeCreateOnlyDurable(lockPath, lockBytes);
  const lockHash = sha256(fs.readFileSync(lockPath));
  if (lockHash !== sha256(lockBytes)) throw new Error('lock readback hash mismatch');

  let descriptor;
  try {
    descriptor = fs.openSync(ledgerPath, 'r+');
    const preimageLength = fs.fstatSync(descriptor).size;
    const preimage = readDescriptorBytes(descriptor, preimageLength, 0);
    const eofProbe = Buffer.alloc(1);
    if (fs.readSync(descriptor, eofProbe, 0, 1, preimageLength) !== 0) {
      throw new Error('ledger grew while reading the frozen preimage');
    }
    const preimageHash = sha256(preimage);
    if (preimageHash !== options.expectedPreimageHash) {
      throw new Error('ledger preimage hash mismatch');
    }
    const maximumCorrId = exactMaximumCorrId(preimage);
    if (maximumCorrId !== expectedMaxId) throw new Error('ledger maximum CORR ID mismatch');
    if (fs.statSync(lockPath).size !== lockBytes.length || sha256(fs.readFileSync(lockPath)) !== lockHash) {
      throw new Error('ledger lock changed before append');
    }

    const common = {
      contractPath: CONTRACT_RELATIVE_PATH,
      contractHash: options.contractHash,
      transactionId,
      implementationAttemptId,
      ledgerPath: LEDGER_RELATIVE_PATH,
      lockPath: `${LEDGER_RELATIVE_PATH}.lock`,
      lifecyclePhase: lifecycle.lifecyclePhase,
      lifecycleId: lifecycle.lifecycleId,
      expectedPredecessorLifecycleId: lifecycle.expectedPredecessorLifecycleId,
      expectedPreimageHash: options.expectedPreimageHash,
      expectedMaxId,
      rowPath: normalizeRelative(path.relative(root, rowPath)),
      rowHash: options.rowHash,
      preimageByteLength: preimageLength,
      postimageByteLength: preimageLength + rowBytes.length,
      postimageHash: null,
      maximumCorrId: expectedMaxId + 1,
      createdAt: new Date().toISOString(),
      credentialDataPresent: false,
    };
    const lockReceipt = {
      schemaVersion: 'corr-131-ledger-lock-receipt/v1',
      ...common,
      lockHash,
      lockOwner,
    };
    const lockReceiptHash = writeJsonCreateOnly(paths.lock, lockReceipt);

    writeDescriptorBytes(descriptor, rowBytes, preimageLength);
    fs.fsyncSync(descriptor);
    const observedPostimageLength = fs.fstatSync(descriptor).size;
    if (observedPostimageLength !== preimageLength + rowBytes.length) {
      throw new Error('ledger postimage length mismatch');
    }
    const postimage = readDescriptorBytes(descriptor, observedPostimageLength, 0);
    const postimageHash = sha256(postimage);
    if (
      !postimage.subarray(0, preimageLength).equals(preimage) ||
      !postimage.subarray(preimageLength).equals(rowBytes)
    ) {
      throw new Error('ledger prefix or suffix readback mismatch');
    }
    if (exactMaximumCorrId(postimage) !== expectedMaxId + 1) {
      throw new Error('ledger postimage maximum CORR ID mismatch');
    }
    common.postimageHash = postimageHash;

    const appendReceipt = {
      schemaVersion: 'corr-131-ledger-append-receipt/v1',
      ...common,
      writeOffset: preimageLength,
      writtenByteLength: rowBytes.length,
      prefixUnchanged: true,
      suffixExact: true,
      fsyncCompleted: true,
    };
    const appendReceiptHash = writeJsonCreateOnly(paths.append, appendReceipt);
    const readbackReceipt = {
      schemaVersion: 'corr-131-ledger-readback-receipt/v1',
      ...common,
      lockReceiptPath: normalizeRelative(path.relative(root, paths.lock)),
      lockReceiptHash,
      appendReceiptPath: normalizeRelative(path.relative(root, paths.append)),
      appendReceiptHash,
      readbackVerified: true,
    };
    const readbackReceiptHash = writeJsonCreateOnly(paths.readback, readbackReceipt);
    if (sha256(fs.readFileSync(lockPath)) !== lockHash) {
      throw new Error('ledger lock changed before release');
    }
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.unlinkSync(lockPath);
    if (fs.existsSync(lockPath)) throw new Error('ledger lock remains after owner removal');
    const releaseReceipt = {
      schemaVersion: 'corr-131-ledger-lock-release-receipt/v1',
      ...common,
      lockHash,
      lockOwner,
      readbackReceiptPath: normalizeRelative(path.relative(root, paths.readback)),
      readbackReceiptHash,
      removedByOwner: true,
      lockAbsentAfterRemoval: true,
    };
    const releaseReceiptHash = writeJsonCreateOnly(paths.release, releaseReceipt);
    return {
      decision: 'pass',
      lifecycleId: lifecycle.lifecycleId,
      preimageHash,
      postimageHash,
      receiptPaths: Object.fromEntries(
        Object.entries(paths).map(([key, value]) => [key, normalizeRelative(path.relative(root, value))])
      ),
      receiptHashes: {
        lock: lockReceiptHash,
        append: appendReceiptHash,
        readback: readbackReceiptHash,
        release: releaseReceiptHash,
      },
    };
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--prepare-ledger-lifecycle')) {
    const parsed = parseOptions(argv, [
      '--prepare-ledger-lifecycle',
      '--contract',
      '--contract-hash',
      '--attempt-context',
      '--ledger',
      '--lifecycle-context',
      '--receipt-dir',
    ]);
    const result = prepareCorr131LedgerLifecycle({
      lifecyclePhase: parsed.take('--prepare-ledger-lifecycle'),
      contract: parsed.take('--contract'),
      contractHash: parsed.take('--contract-hash'),
      attemptContext: parsed.take('--attempt-context'),
      ledger: parsed.take('--ledger'),
      lifecycleContext: parsed.take('--lifecycle-context'),
      receiptDir: parsed.take('--receipt-dir'),
    });
    if (parsed.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (!argv.includes('--ledger-lifecycle')) {
    throw new Error('CORR-131 Qualified RED mode is not implemented');
  }
  const parsed = parseOptions(argv, [
    '--ledger-lifecycle',
    '--contract',
    '--contract-hash',
    '--attempt-context',
    '--ledger',
    '--expected-preimage-hash',
    '--expected-max-id',
    '--expected-predecessor-lifecycle-id',
    '--lifecycle-id',
    '--row-file',
    '--row-hash',
    '--receipt-dir',
  ]);
  const result = runCorr131LedgerAppendTransaction({
    lifecyclePhase: parsed.take('--ledger-lifecycle'),
    contract: parsed.take('--contract'),
    contractHash: parsed.take('--contract-hash'),
    attemptContext: parsed.take('--attempt-context'),
    ledger: parsed.take('--ledger'),
    expectedPreimageHash: parsed.take('--expected-preimage-hash'),
    expectedMaxId: parsed.take('--expected-max-id'),
    expectedPredecessorLifecycleId: parsed.take('--expected-predecessor-lifecycle-id'),
    lifecycleId: parsed.take('--lifecycle-id'),
    rowFile: parsed.take('--row-file'),
    rowHash: parsed.take('--row-hash'),
    receiptDir: parsed.take('--receipt-dir'),
  });
  if (parsed.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  prepareCorr131LedgerLifecycle,
  runCorr131LedgerAppendTransaction,
  validateCorr131VitestFailure,
};
