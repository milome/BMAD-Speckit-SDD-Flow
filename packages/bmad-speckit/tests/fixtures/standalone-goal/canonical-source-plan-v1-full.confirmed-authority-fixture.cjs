const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tar = require('tar');

const REQUEST_ID = 'REQ-GOAL-SOURCE-NORMALIZATION-FULL-20260908-05';
const SEMANTIC_REVISION_ID =
  'SEMREV-0D5C8A146837319DFB3853D66228AAA41CA384E3698E534E55AD3AA0EB053153';
const SCOPE_SEMANTIC_HASH =
  'sha256:2ff9fb10cd4148882665a45db9bc6957a2d41c8ec3804940f0b39f1a1789e4f5';
const BINDING_REVISION_ID =
  'BINDREV-3B8F37598A3D57B79CD1496537657C94D9F7A0B9FE7D7928CFF36D64ED471018';
const REQUIREMENTS_EFFECTIVE_PASS_HASH =
  'sha256:152c66819a93445621dc1be0432cfda2e378482b2d3be38e14cebe31a4d6ccd4';
const TYPED_SOURCE_GRAPH_HASH =
  'sha256:99dd3e6a1750c446e5e6b30487548bbd64ab3b73675aae0a4b9e76eecfbdfe6b';

const projectRoot = process.env.CONFIRMED_AUTHORITY_FIXTURE_PROJECT_ROOT
  ? path.resolve(process.env.CONFIRMED_AUTHORITY_FIXTURE_PROJECT_ROOT)
  : path.resolve(__dirname, '../../../../..');
const fixtureRoot = __dirname;
const recordProjectRelative = path.posix.join(
  '_bmad-output/runtime/requirement-records',
  REQUEST_ID
);
const recordRoot = path.join(projectRoot, ...recordProjectRelative.split('/'));
const archivePath = path.join(
  fixtureRoot,
  'canonical-source-plan-v1-full.confirmed-authority.tar.gz'
);
const manifestPath = path.join(
  fixtureRoot,
  'canonical-source-plan-v1-full.confirmation-receipt.json'
);

function sha256(bytes) {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function recordPath(relativePath) {
  return path.join(recordRoot, ...relativePath.replace(/\\/gu, '/').split('/'));
}

function projectRelative(filePath) {
  const relative = path.relative(projectRoot, path.resolve(projectRoot, filePath));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`confirmed_fixture_path_escape:${filePath}`);
  }
  return relative.replace(/\\/gu, '/');
}

function collectAuthorityFiles() {
  const record = readJson(recordPath('record/requirement-record.json'));
  const authority = record.activeAuthority;
  if (
    record.schemaVersion !== 'requirements-contract-record/v3' ||
    record.recordId !== REQUEST_ID ||
    record.lifecycle !== 'user_confirmed' ||
    authority.activeSemanticRevisionId !== SEMANTIC_REVISION_ID ||
    authority.activeScopeSemanticHash !== SCOPE_SEMANTIC_HASH ||
    authority.activeBindingRevisionId !== BINDING_REVISION_ID ||
    typeof authority.activeBuildHash !== 'string' ||
    typeof authority.activeBuildManifestPath !== 'string' ||
    authority.activeBuildManifestPath.includes('/staging/') ||
    'activeSemanticIrPath' in authority ||
    'activeSourceBindingPath' in authority
  ) {
    throw new Error('confirmed_fixture_record_identity_mismatch');
  }

  const recordRelativePaths = new Set([
    'record/requirement-record.json',
    authority.activeBuildManifestPath,
    'quality/requirements-effective-pass-receipt.json',
    record.confirmationEventRef.path,
    record.currentPromotionEvidence.path,
  ]);
  const buildManifest = readJson(recordPath(authority.activeBuildManifestPath));
  if (
    buildManifest.schemaVersion !== 'requirements-contract-build-manifest/v2' ||
    buildManifest.buildHash !== authority.activeBuildHash
  ) {
    throw new Error('confirmed_fixture_build_identity_mismatch');
  }
  for (const entry of buildManifest.artifactEntries ?? []) {
    const contentPath = entry.contentRef?.recordRelativePath;
    if (!contentPath || contentPath.includes('/staging/')) {
      throw new Error('confirmed_fixture_content_ref_invalid');
    }
    recordRelativePaths.add(contentPath);
  }

  const promotion = readJson(recordPath(record.currentPromotionEvidence.path));
  if (
    promotion.schemaVersion !== 'requirements-contract-confirmation-promotion-receipt/v2' ||
    record.currentPromotionEvidence.path !== 'confirmation/final-promotion-receipt.json' ||
    record.finalPromotionEvidence?.path !== record.currentPromotionEvidence.path
  ) {
    throw new Error('confirmed_fixture_final_promotion_invalid');
  }
  const pagePaths = [projectRelative(promotion.targetPath)];

  const effectivePass = readJson(recordPath('quality/requirements-effective-pass-receipt.json'));
  const confirmationProjectionEntry = buildManifest.artifactEntries.find(
    (entry) => entry.role === 'confirmation_projection'
  );
  if (!confirmationProjectionEntry) {
    throw new Error('confirmed_fixture_confirmation_projection_missing');
  }
  const confirmationProjection = readJson(
    recordPath(confirmationProjectionEntry.contentRef.recordRelativePath)
  );
  const typedAuthority = confirmationProjection.typedSourceAuthority;
  const event = readJson(recordPath(record.confirmationEventRef.path));
  const expectedConfirmationText = [
    '确认以上需求范围进入下一阶段',
    `requestId=${REQUEST_ID}`,
    `semanticRevisionId=${SEMANTIC_REVISION_ID}`,
    `scopeSemanticHash=${SCOPE_SEMANTIC_HASH}`,
    `bindingRevisionId=${BINDING_REVISION_ID}`,
    `requirementsEffectivePassHash=${REQUIREMENTS_EFFECTIVE_PASS_HASH}`,
  ].join('\n');
  const targetMarkdown = fs.readFileSync(path.resolve(projectRoot, promotion.targetPath), 'utf8');
  if (
    effectivePass.requirementsEffectivePassHash !== REQUIREMENTS_EFFECTIVE_PASS_HASH ||
    effectivePass.buildManifestHash !== authority.activeBuildHash ||
    typedAuthority?.graphHash !== TYPED_SOURCE_GRAPH_HASH ||
    promotion.requirementsEffectivePassHash !== REQUIREMENTS_EFFECTIVE_PASS_HASH ||
    event.requirementsEffectivePassRef?.hash !== REQUIREMENTS_EFFECTIVE_PASS_HASH ||
    promotion.exactConfirmationText !== expectedConfirmationText ||
    event.exactConfirmationText !== expectedConfirmationText ||
    !targetMarkdown.includes(expectedConfirmationText)
  ) {
    throw new Error('confirmed_fixture_semantic_identity_mismatch');
  }

  return [
    ...[...recordRelativePaths].map((relativePath) =>
      path.posix.join(recordProjectRelative, relativePath.replace(/\\/gu, '/'))
    ),
    ...pagePaths,
  ].sort();
}

function fileReceipt(relativePath, root = projectRoot) {
  const bytes = fs.readFileSync(path.join(root, ...relativePath.split('/')));
  return { path: relativePath, bytes: bytes.length, sha256: sha256(bytes) };
}

function validateArchiveMemberPaths(memberPaths) {
  const normalized = memberPaths.map((memberPath) => {
    if (
      typeof memberPath !== 'string' ||
      memberPath.length === 0 ||
      memberPath.includes('\\') ||
      memberPath.startsWith('/') ||
      /^[A-Za-z]:/u.test(memberPath) ||
      memberPath.split('/').some((segment) => !segment || segment === '.' || segment === '..')
    ) {
      throw new Error(`confirmed_fixture_archive_member_unsafe:${memberPath}`);
    }
    return memberPath;
  });
  if (new Set(normalized).size !== normalized.length) {
    throw new Error('confirmed_fixture_archive_member_duplicate');
  }
  return normalized;
}

async function listArchiveMembers(targetArchivePath) {
  const members = [];
  await tar.t({
    file: targetArchivePath,
    strict: true,
    onentry(entry) {
      members.push({ path: entry.path, type: entry.type, bytes: entry.size });
    },
  });
  return members;
}

async function verifyArchiveReceipt({ manifest, archivePath: targetArchivePath }) {
  if (!Array.isArray(manifest.files)) {
    throw new Error('confirmed_fixture_receipt_files_invalid');
  }
  const receiptPaths = validateArchiveMemberPaths(manifest.files.map((entry) => entry.path));
  if (manifest.fileCount !== manifest.files.length) {
    throw new Error('confirmed_fixture_receipt_file_count_mismatch');
  }
  const receiptByteTotal = manifest.files.reduce((sum, entry) => sum + entry.bytes, 0);
  if (manifest.totalUncompressedBytes !== receiptByteTotal) {
    throw new Error('confirmed_fixture_receipt_byte_total_mismatch');
  }

  const archiveBytes = fs.readFileSync(targetArchivePath);
  if (
    archiveBytes.length !== manifest.archive.bytes ||
    sha256(archiveBytes) !== manifest.archive.sha256
  ) {
    throw new Error('confirmed_fixture_archive_hash_mismatch');
  }
  const members = await listArchiveMembers(targetArchivePath);
  if (members.some((entry) => entry.type !== 'File')) {
    throw new Error('confirmed_fixture_archive_member_type_invalid');
  }
  const memberPaths = validateArchiveMemberPaths(members.map((entry) => entry.path));
  if (
    memberPaths.length !== receiptPaths.length ||
    [...memberPaths].sort().some((entry, index) => entry !== [...receiptPaths].sort()[index])
  ) {
    throw new Error('confirmed_fixture_archive_member_set_mismatch');
  }
  if (members.reduce((sum, entry) => sum + entry.bytes, 0) !== manifest.totalUncompressedBytes) {
    throw new Error('confirmed_fixture_archive_member_byte_total_mismatch');
  }
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'confirmed-authority-fixture-'));
  try {
    await tar.x({ file: targetArchivePath, cwd: tempRoot, strict: true });
    for (const expected of manifest.files) {
      const actual = fileReceipt(expected.path, tempRoot);
      if (actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256) {
        throw new Error(`confirmed_fixture_file_hash_mismatch:${expected.path}`);
      }
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function build() {
  if (!fs.existsSync(recordRoot)) throw new Error('confirmed_fixture_authority_record_missing');
  const files = collectAuthorityFiles().map((relativePath) => fileReceipt(relativePath));
  await tar.c(
    {
      cwd: projectRoot,
      file: archivePath,
      gzip: true,
      portable: true,
      mtime: new Date(0),
      noMtime: false,
      strict: true,
    },
    files.map((entry) => entry.path)
  );
  const archiveBytes = fs.readFileSync(archivePath);
  const payload = {
    schemaVersion: 'canonical-source-plan-confirmed-authority-fixture-receipt/v1',
    reviewStatus: 'user_confirmed',
    confirmationLanguage: 'zh-CN',
    requestId: REQUEST_ID,
    semanticRevisionId: SEMANTIC_REVISION_ID,
    scopeSemanticHash: SCOPE_SEMANTIC_HASH,
    bindingRevisionId: BINDING_REVISION_ID,
    requirementsEffectivePassHash: REQUIREMENTS_EFFECTIVE_PASS_HASH,
    typedSourceGraphHash: TYPED_SOURCE_GRAPH_HASH,
    archive: {
      path: path.basename(archivePath),
      bytes: archiveBytes.length,
      sha256: sha256(archiveBytes),
    },
    fileCount: files.length,
    totalUncompressedBytes: files.reduce((sum, entry) => sum + entry.bytes, 0),
    files,
  };
  payload.receiptHash = sha256(
    Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  );
  fs.writeFileSync(manifestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await verifyArchiveReceipt({ manifest: payload, archivePath });
  process.stdout.write(
    `${JSON.stringify({ ok: true, archive: payload.archive, fileCount: files.length, totalUncompressedBytes: payload.totalUncompressedBytes, receiptHash: payload.receiptHash })}\n`
  );
}

async function verify() {
  const manifest = readJson(manifestPath);
  const { receiptHash, ...payload } = manifest;
  if (receiptHash !== sha256(Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, 'utf8'))) {
    throw new Error('confirmed_fixture_receipt_hash_mismatch');
  }
  await verifyArchiveReceipt({ manifest, archivePath });
  process.stdout.write(
    `${JSON.stringify({ ok: true, archive: manifest.archive, fileCount: manifest.fileCount, totalUncompressedBytes: manifest.totalUncompressedBytes, receiptHash })}\n`
  );
}

module.exports = {
  listArchiveMembers,
  validateArchiveMemberPaths,
  verifyArchiveReceipt,
};

if (require.main === module) {
  const mode = process.argv[2] ?? 'verify';
  Promise.resolve(mode === 'build' ? build() : mode === 'verify' ? verify() : Promise.reject(
    new Error(`confirmed_fixture_mode_invalid:${mode}`)
  )).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}
