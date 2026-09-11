const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tar = require('tar');

const FIXTURE_ROOT = __dirname;
const ARCHIVE_PATH = path.join(FIXTURE_ROOT, 'canonical-source-plan-v1-full.fixture.tar.gz');
const MANIFEST_PATH = path.join(FIXTURE_ROOT, 'canonical-source-plan-v1-full.fixture-manifest.json');
const RECEIPT_PATH = path.join(FIXTURE_ROOT, 'canonical-source-plan-v1-full.fixture-receipt.json');
const LEGACY_SOURCE = path.join(FIXTURE_ROOT, 'real-source-plan-20260904.md');

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function hashValue(value) {
  return sha256(Buffer.from(JSON.stringify(canonicalize(value)), 'utf8'));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function verifyStaticReceipt() {
  const manifest = readJson(MANIFEST_PATH);
  if (manifest.manifestHash !== hashValue(Object.fromEntries(
    Object.entries(manifest).filter(([key]) => key !== 'manifestHash')
  ))) {
    throw new Error('canonical_full_fixture_manifest_hash_invalid');
  }
  const receipt = readJson(RECEIPT_PATH);
  if (receipt.receiptHash !== hashValue(Object.fromEntries(
    Object.entries(receipt).filter(([key]) => key !== 'receiptHash')
  ))) {
    throw new Error('canonical_full_fixture_receipt_hash_invalid');
  }
  if (receipt.manifestHash !== manifest.manifestHash ||
      receipt.archive.sha256 !== manifest.archive.sha256 ||
      receipt.archive.bytes !== manifest.archive.bytes) {
    throw new Error('canonical_full_fixture_receipt_manifest_mismatch');
  }
  const archiveBytes = fs.readFileSync(ARCHIVE_PATH);
  if (archiveBytes.length !== manifest.archive.bytes || sha256(archiveBytes) !== manifest.archive.sha256) {
    throw new Error('canonical_full_fixture_archive_hash_invalid');
  }
  const legacyBytes = fs.readFileSync(LEGACY_SOURCE);
  if (legacyBytes.length !== manifest.legacySource.bytes || sha256(legacyBytes) !== manifest.legacySource.sha256) {
    throw new Error('canonical_full_fixture_legacy_source_hash_invalid');
  }
  return { manifest, receipt };
}

function materializeFullFixture({ root = null, copyOracleHelpers = false } = {}) {
  const { manifest } = verifyStaticReceipt();
  const materializedRoot = root
    ? path.join(path.resolve(root), 'canonical-full-fixture')
    : fs.mkdtempSync(path.join(os.tmpdir(), 'canonical-full-fixture-'));
  fs.mkdirSync(materializedRoot, { recursive: true });
  tar.x({ file: ARCHIVE_PATH, cwd: materializedRoot, sync: true, strict: true });

  for (const entry of manifest.files) {
    const target = path.join(materializedRoot, entry.path);
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      throw new Error(`canonical_full_fixture_member_missing:${entry.path}`);
    }
    const bytes = fs.readFileSync(target);
    if (bytes.length !== entry.bytes || sha256(bytes) !== entry.sha256) {
      throw new Error(`canonical_full_fixture_member_hash_invalid:${entry.path}`);
    }
  }

  const materializedFixtureRoot = path.join(materializedRoot, 'packages/bmad-speckit/tests/fixtures/standalone-goal');
  fs.mkdirSync(materializedFixtureRoot, { recursive: true });
  fs.copyFileSync(LEGACY_SOURCE, path.join(materializedFixtureRoot, 'real-source-plan-20260904.md'));
  for (const relative of [
    '_bmad/shared/goal-contract/standalone-source-plan-profile.json',
    'docs/plans/BUGFIX-2026-09-07-goal-source-contract-normalization.md',
    'packages/bmad-speckit/tests/fixtures/standalone-goal/canonical-source-plan-v1-full.proof-generator.cjs',
  ]) {
    const source = path.join(FIXTURE_ROOT, '..', '..', '..', '..', '..', relative);
    const target = path.join(materializedRoot, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
  if (copyOracleHelpers) {
    for (const entry of manifest.files) {
      const name = path.basename(entry.path);
      if (!name.startsWith('real-source-plan-20260904.expected.') || !name.endsWith('.mjs')) continue;
      fs.copyFileSync(path.join(materializedRoot, entry.path), path.join(materializedFixtureRoot, name));
    }
  }

  const resolve = (relative) => path.join(materializedRoot, relative);
  return Object.freeze({
    root: materializedRoot,
    fixtureRoot: materializedFixtureRoot,
    legacySourcePath: resolve('packages/bmad-speckit/tests/fixtures/standalone-goal/real-source-plan-20260904.md'),
    canonicalSourcePath: resolve('packages/bmad-speckit/tests/fixtures/standalone-goal/canonical-source-plan-v1-full.md'),
    expectedGraphPath: resolve('packages/bmad-speckit/tests/fixtures/standalone-goal/canonical-source-plan-v1-full.expected-graph.json'),
    derivationManifestPath: resolve('packages/bmad-speckit/tests/fixtures/standalone-goal/canonical-source-plan-v1-full.derivation-manifest.json'),
    reviewPath: resolve('packages/bmad-speckit/tests/fixtures/standalone-goal/canonical-source-plan-v1-full.fixture-review.json'),
    integrityPath: resolve('packages/bmad-speckit/tests/fixtures/standalone-goal/canonical-source-plan-v1-full.integrity.json'),
    expectedOraclePath: resolve('packages/bmad-speckit/tests/fixtures/standalone-goal/real-source-plan-20260904.expected.json'),
    requirementsIntakePath: resolve('packages/bmad-speckit/tests/fixtures/standalone-goal/.canonical-source-plan-v1-full.confirmed-requirements.authoring-input/intake.json'),
    authorityBundlePath: resolve('packages/bmad-speckit/tests/fixtures/standalone-goal/.canonical-source-plan-v1-full.confirmed-requirements.authoring-input/authority-bundle.json'),
    oracleTestPath: resolve('packages/bmad-speckit/tests/fixtures/standalone-goal/real-source-plan-20260904.expected.oracle.test.mjs'),
  });
}

module.exports = {
  materializeFullFixture,
  verifyStaticReceipt,
};
