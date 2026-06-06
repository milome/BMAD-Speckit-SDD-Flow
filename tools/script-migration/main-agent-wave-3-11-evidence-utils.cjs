#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const WAVE_ID = 'main-agent-runtime-migration-wave-3.11';
const WAVE_DIR = `repo-governance/script-migrations/${WAVE_ID}`;
const SAFE_WRITE_PATH = `${WAVE_DIR}/safe-write-receipts.json`;
const REGISTRY_PATH = 'repo-governance/script-migration-registry.yaml';
const CLOSURE_AUDIT_PATH = 'repo-governance/script-migrations/consumer-reachable-closure-audit/audit-report.json';
const INSTALL_MATRIX_DIR = `${WAVE_DIR}/install-matrix`;

function repoPath(relativePath) {
  return path.join(ROOT, relativePath);
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function sha256Buffer(buffer) {
  return `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}`;
}

function sha256Text(text) {
  return sha256Buffer(Buffer.from(text, 'utf8'));
}

function sha256File(relativePath) {
  return sha256Buffer(fs.readFileSync(repoPath(relativePath)));
}

function canonicalize(value, omitTopLevelSealHash = false, depth = 0) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => canonicalize(item, false, depth + 1));
  const result = {};
  for (const key of Object.keys(value).sort()) {
    if (depth === 0 && omitTopLevelSealHash && key === 'sealHash') continue;
    result[key] = canonicalize(value[key], false, depth + 1);
  }
  return result;
}

function hashCanonical(value, omitTopLevelSealHash = false) {
  return sha256Text(JSON.stringify(canonicalize(value, omitTopLevelSealHash)));
}

function formatJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function nowIso() {
  return new Date().toISOString();
}

function stamp() {
  return new Date().toISOString().replace(/[-:.]/gu, '').replace('T', 'T').replace('Z', 'Z');
}

function expectedSafeWriteTopLevelKeys(targetPath) {
  const normalized = normalizePath(targetPath);
  if (normalized === REGISTRY_PATH) return [];
  if (normalized === CLOSURE_AUDIT_PATH) return ['generatedAt', 'entries'];
  if (normalized.endsWith('/preflight.json')) {
    return ['waveId', 'startedAt', 'completedAt', 'gitStatusShortHash', 'sourceInventoryHash', 'commands'];
  }
  if (normalized.endsWith('/source-inventory.json')) return ['waveId', 'generatedAt', 'entries'];
  if (normalized.endsWith('/no-migration-internal.json')) return ['waveId', 'generatedAt', 'entries'];
  if (normalized.endsWith('/root-script-regression-proof.json')) return ['waveId', 'generatedAt', 'sourceInventoryRef', 'entries'];
  if (normalized.endsWith('/classification-evidence.json')) {
    return ['waveId', 'generatedAt', 'refinesWaveId', 'auditReportPath', 'registryPath', 'entries'];
  }
  if (normalized.endsWith('/registry-evidence.json')) return ['waveId', 'validatedAt', 'entries'];
  if (normalized.startsWith(`${WAVE_DIR}/evidence-history/`) && normalized.endsWith('.evidence.json')) {
    return ['waveId', 'archivedAt', 'repairRoundId', 'blockedReason', 'blockedCommandId', 'evidence'];
  }
  if (normalized.endsWith('/evidence.json')) {
    return ['waveId', 'status', 'startedAt', 'completedAt', 'commandRows', 'acceptanceStatus', 'manualVerificationStatus'];
  }
  if (normalized.endsWith('/install-matrix.json')) {
    return [
      'schemaVersion',
      'waveId',
      'status',
      'startedAt',
      'completedAt',
      'packageCwd',
      'packageName',
      'packageVersion',
      'tarballPath',
      'tarballSha256',
      'scoringPackageSourceCwd',
      'scoringPackageName',
      'scoringWorkspaceVersion',
      'scoringWorkspaceDistHashes',
      'prepackPrepCommands',
      'cleanupCommands',
      'modes',
    ];
  }
  if (normalized.startsWith(`${INSTALL_MATRIX_DIR}/`) && normalized.endsWith('.json')) {
    return [
      'schemaVersion',
      'waveId',
      'mode',
      'status',
      'generatedAt',
      'consumerRoot',
      'probeRoot',
      'requireProbeRoot',
      'packageRoot',
      'rowIds',
      'commandRows',
      'rows',
      'assertions',
    ];
  }
  if (normalized.endsWith('/final-evidence-packet.json')) {
    return [
      'waveId',
      'status',
      'sealed',
      'generatedAt',
      'sealedAt',
      'sealHash',
      'acceptanceStatus',
      'manualVerificationStatus',
      'sealedEvidenceJsonHash',
      'installMatrixHash',
      'summaryHash',
      'finalEncodingCommandId',
      'expectedFinalAcceptanceCommandId',
      'expectedFinalValidatorCommandId',
      'residualRisks',
    ];
  }
  if (normalized === SAFE_WRITE_PATH) return ['waveId', 'generatedAt', 'receipts', 'selfVerification'];
  return [];
}

function buildRequiredChecks(targetPath, content) {
  const checks = [];
  let parsed = null;
  if (targetPath.endsWith('.json')) {
    parsed = JSON.parse(content);
    checks.push({ type: 'jsonParse', status: 'passed' });
  }
  if (parsed && parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
    for (const key of expectedSafeWriteTopLevelKeys(targetPath)) {
      checks.push({
        type: 'topLevelKey',
        key,
        status: Object.prototype.hasOwnProperty.call(parsed, key) ? 'passed' : 'failed',
      });
    }
  }
  return checks;
}

function safeWriteFile(targetPath, content, { operation = 'safe_write_large_doc' } = {}) {
  const normalizedTarget = normalizePath(targetPath);
  const fullTarget = path.resolve(ROOT, normalizedTarget);
  if (fullTarget !== ROOT && !fullTarget.startsWith(`${ROOT}${path.sep}`)) {
    throw new Error(`Refusing safe-write outside repository root: ${normalizedTarget}`);
  }
  const dir = path.dirname(fullTarget);
  fs.mkdirSync(dir, { recursive: true });
  const startedAt = nowIso();
  const marker = `${stamp()}.${process.pid}.${crypto.randomBytes(4).toString('hex')}`;
  const draftFull = path.join(dir, `.${path.basename(normalizedTarget)}.draft.${marker}`);
  const draftPath = rel(draftFull);
  const backupPath = fs.existsSync(fullTarget) ? `${normalizedTarget}.bak.${marker}` : null;
  fs.writeFileSync(draftFull, content, 'utf8');
  const draftSha256 = sha256Buffer(fs.readFileSync(draftFull));
  const requiredChecks = buildRequiredChecks(normalizedTarget, content);
  if (requiredChecks.some((check) => check.status !== 'passed')) {
    fs.unlinkSync(draftFull);
    throw new Error(`Safe-write required check failed for ${normalizedTarget}`);
  }
  if (backupPath) fs.copyFileSync(fullTarget, repoPath(backupPath));
  fs.renameSync(draftFull, fullTarget);
  const postWriteSha256 = sha256File(normalizedTarget);
  if (postWriteSha256 !== draftSha256) {
    throw new Error(`Safe-write post-write hash mismatch for ${normalizedTarget}`);
  }
  const completedAt = nowIso();
  return {
    targetPath: normalizedTarget,
    sha256: postWriteSha256,
    status: 'passed',
    artifactPath: normalizedTarget,
    operation,
    hashKind: 'promoted_file_bytes',
    draftPath,
    backupPath,
    requiredChecks,
    draftSha256,
    promotedSha256: draftSha256,
    postWriteSha256,
    byteLength: Buffer.byteLength(content, 'utf8'),
    startedAt,
    completedAt,
  };
}

function readJsonIfExists(relativePath) {
  const full = repoPath(relativePath);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function loadSafeWriteReceipts() {
  const artifact = readJsonIfExists(SAFE_WRITE_PATH);
  return Array.isArray(artifact?.receipts) ? artifact.receipts : [];
}

function saveSafeWriteReceipts(receipts, { generatedAt = nowIso() } = {}) {
  const filtered = receipts.filter((receipt) => {
    if (!receipt || typeof receipt !== 'object') return false;
    if (receipt.targetPath === SAFE_WRITE_PATH) return false;
    return fs.existsSync(repoPath(receipt.targetPath));
  });
  const payload = {
    waveId: WAVE_ID,
    generatedAt,
    receipts: filtered,
  };
  payload.selfVerification = {
    hashKind: 'canonical_json_without_selfVerification',
    payloadSha256: hashCanonical(payload),
    computedAt: nowIso(),
    status: 'passed',
  };
  const fullTarget = repoPath(SAFE_WRITE_PATH);
  fs.mkdirSync(path.dirname(fullTarget), { recursive: true });
  const marker = `${stamp()}.${process.pid}.${crypto.randomBytes(4).toString('hex')}`;
  const draftFull = path.join(path.dirname(fullTarget), `.${path.basename(SAFE_WRITE_PATH)}.draft.${marker}`);
  const backupFull = fs.existsSync(fullTarget) ? `${fullTarget}.bak.${marker}` : null;
  fs.writeFileSync(draftFull, formatJson(payload), 'utf8');
  if (backupFull) fs.copyFileSync(fullTarget, backupFull);
  fs.renameSync(draftFull, fullTarget);
  const postWriteSha256 = sha256Buffer(fs.readFileSync(fullTarget));
  if (postWriteSha256 !== sha256Buffer(Buffer.from(formatJson(payload), 'utf8'))) {
    throw new Error(`Safe-write receipt index post-write hash mismatch for ${SAFE_WRITE_PATH}`);
  }
  return payload;
}

function commandRow(command, args, { cwd = ROOT, commandText = null } = {}) {
  const startedAt = nowIso();
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', shell: false });
  const completedAt = nowIso();
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  return {
    command: commandText || [command, ...args].join(' '),
    cwd,
    exitCode: result.status === null ? 1 : result.status,
    stdoutHash: sha256Text(stdout),
    stderrHash: sha256Text(stderr),
    startedAt,
    completedAt,
    stdoutPreview: stdout.slice(0, 4000),
    stderrPreview: stderr.slice(0, 4000),
    status: result.status === 0 ? 'passed' : 'failed',
  };
}

module.exports = {
  CLOSURE_AUDIT_PATH,
  REGISTRY_PATH,
  ROOT,
  SAFE_WRITE_PATH,
  WAVE_DIR,
  WAVE_ID,
  commandRow,
  formatJson,
  hashCanonical,
  loadSafeWriteReceipts,
  normalizePath,
  nowIso,
  readJsonIfExists,
  rel,
  repoPath,
  safeWriteFile,
  saveSafeWriteReceipts,
  sha256File,
  sha256Text,
};
