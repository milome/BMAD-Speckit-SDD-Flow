const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it } = require('node:test');
const tar = require('tar');

const FIXTURE_SCRIPT = path.join(
  __dirname,
  'fixtures',
  'standalone-goal',
  'canonical-source-plan-v1-full.confirmed-authority-fixture.cjs'
);
const {
  validateArchiveMemberPaths,
  verifyArchiveReceipt,
} = require(FIXTURE_SCRIPT);

function sha256(bytes) {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

async function archiveFixture(entries = ['a.txt', 'nested/b.txt']) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'confirmed-archive-test-'));
  for (const entry of new Set(entries)) {
    const filePath = path.join(root, ...entry.split('/'));
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${entry}\n`, 'utf8');
  }
  const archivePath = path.join(root, 'fixture.tar.gz');
  await tar.c({ cwd: root, file: archivePath, gzip: true, portable: true }, entries);
  const files = [...new Set(entries)].map((entry) => {
    const bytes = fs.readFileSync(path.join(root, ...entry.split('/')));
    return { path: entry, bytes: bytes.length, sha256: sha256(bytes) };
  });
  const archiveBytes = fs.readFileSync(archivePath);
  return {
    archivePath,
    manifest: {
      archive: { bytes: archiveBytes.length, sha256: sha256(archiveBytes) },
      fileCount: files.length,
      totalUncompressedBytes: files.reduce((sum, entry) => sum + entry.bytes, 0),
      files,
    },
  };
}

describe('confirmed authority archive receipt verification', () => {
  it('accepts an exact safe member set', async () => {
    const value = await archiveFixture();
    await verifyArchiveReceipt(value);
  });

  it('rejects archive members omitted from the receipt', async () => {
    const value = await archiveFixture();
    value.manifest.files.pop();
    value.manifest.fileCount = value.manifest.files.length;
    value.manifest.totalUncompressedBytes = value.manifest.files.reduce((sum, entry) => sum + entry.bytes, 0);
    await assert.rejects(() => verifyArchiveReceipt(value), /confirmed_fixture_archive_member_set_mismatch/u);
  });

  it('rejects duplicate archive paths', async () => {
    const value = await archiveFixture(['a.txt', 'a.txt']);
    await assert.rejects(() => verifyArchiveReceipt(value), /confirmed_fixture_archive_member_duplicate/u);
  });

  it('rejects unsafe paths and receipt aggregate mismatches', async () => {
    assert.throws(() => validateArchiveMemberPaths(['../escape.txt']), /confirmed_fixture_archive_member_unsafe/u);
    const count = await archiveFixture();
    count.manifest.fileCount += 1;
    await assert.rejects(() => verifyArchiveReceipt(count), /confirmed_fixture_receipt_file_count_mismatch/u);
    const bytes = await archiveFixture();
    bytes.manifest.totalUncompressedBytes += 1;
    await assert.rejects(() => verifyArchiveReceipt(bytes), /confirmed_fixture_receipt_byte_total_mismatch/u);
  });
});
