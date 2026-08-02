const fs = require('node:fs');
const path = require('node:path');
const {
  stableControlPlaneStringify,
  verifyReceiptSelfHash,
} = require(
  __filename.endsWith('.ts') ? './canonical-hash.ts' : './canonical-hash'
);
const {
  validateGoalContractSchema,
} = require(
  __filename.endsWith('.ts') ? './schema-registry.ts' : './schema-registry'
);

function failure(
  failureClass: string,
  details: Record<string, unknown> = {}
): Error {
  return Object.assign(new Error(failureClass), {
    failureClass,
    ...details,
  });
}

function normalizeRelativePath(relativePath: unknown): string {
  if (typeof relativePath !== 'string' || relativePath.length === 0) {
    throw failure('control_plane_receipt_path_invalid');
  }
  const normalized = relativePath.replace(/\\/gu, '/');
  if (
    path.posix.isAbsolute(normalized) ||
    /^[A-Za-z]:\//u.test(normalized) ||
    normalized.split('/').includes('..')
  ) {
    throw failure('control_plane_receipt_path_escape', {
      relativePath,
    });
  }
  return path.posix.normalize(normalized);
}

function canonicalReceiptBytes(receipt: unknown): Buffer {
  return Buffer.from(
    `${stableControlPlaneStringify(receipt)}\n`,
    'utf8'
  );
}

function validateReceipt(schemaName: string, receipt: unknown): void {
  validateGoalContractSchema(schemaName, receipt);
  if (!verifyReceiptSelfHash(receipt)) {
    throw failure('control_plane_receipt_hash_invalid');
  }
}

function readCommittedReceipt({
  targetPath,
  schemaName,
  expectedBytes,
}: {
  targetPath: string;
  schemaName: string;
  expectedBytes?: Buffer;
}) {
  let receipt;
  try {
    receipt = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  } catch {
    throw failure('control_plane_receipt_invalid', {
      targetPath,
    });
  }
  validateReceipt(schemaName, receipt);
  const bytes = canonicalReceiptBytes(receipt);
  if (
    !fs.readFileSync(targetPath).equals(bytes) ||
    (expectedBytes && !expectedBytes.equals(bytes))
  ) {
    throw failure('control_plane_receipt_collision', {
      targetPath,
    });
  }
  return receipt;
}

function commitCreateOnceReceipt({
  receiptRoot,
  relativePath,
  schemaName,
  receipt,
  recovery = false,
}: {
  receiptRoot: string;
  relativePath: string;
  schemaName: string;
  receipt: unknown;
  recovery?: boolean;
}) {
  if (typeof receiptRoot !== 'string' || receiptRoot.length === 0) {
    throw failure('control_plane_receipt_root_invalid');
  }
  const normalized = normalizeRelativePath(relativePath);
  const root = path.resolve(receiptRoot);
  const targetPath = path.resolve(root, ...normalized.split('/'));
  if (
    targetPath !== root &&
    !targetPath.startsWith(`${root}${path.sep}`)
  ) {
    throw failure('control_plane_receipt_path_escape', {
      relativePath,
    });
  }
  validateReceipt(schemaName, receipt);
  const expectedBytes = canonicalReceiptBytes(receipt);
  const tempPath = `${targetPath}.tmp`;

  if (fs.existsSync(tempPath)) {
    throw failure('control_plane_partial_receipt', {
      targetPath,
      tempPath,
    });
  }
  if (fs.existsSync(targetPath)) {
    const committed = readCommittedReceipt({
      targetPath,
      schemaName,
      expectedBytes,
    });
    if (!recovery) {
      throw failure('control_plane_duplicate_receipt', {
        targetPath,
      });
    }
    return Object.freeze({
      path: targetPath.replace(/\\/gu, '/'),
      receipt: Object.freeze(committed),
      recovered: true,
    });
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  let descriptor;
  try {
    descriptor = fs.openSync(tempPath, 'wx');
    fs.writeFileSync(descriptor, expectedBytes);
    fs.fsyncSync(descriptor);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
  if (fs.existsSync(targetPath)) {
    throw failure('control_plane_receipt_collision', {
      targetPath,
    });
  }
  fs.renameSync(tempPath, targetPath);
  const committed = readCommittedReceipt({
    targetPath,
    schemaName,
    expectedBytes,
  });
  return Object.freeze({
    path: targetPath.replace(/\\/gu, '/'),
    receipt: Object.freeze(committed),
    recovered: false,
  });
}

module.exports = {
  canonicalReceiptBytes,
  commitCreateOnceReceipt,
  normalizeRelativePath,
  readCommittedReceipt,
};
