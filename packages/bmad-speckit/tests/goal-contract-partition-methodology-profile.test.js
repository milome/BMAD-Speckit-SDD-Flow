const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  loadPartitionMethodologyProfile,
} = require('../src/utils/goal-contract/partition-methodology-profile.ts');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const ASSET_DIR = path.join('_bmad', 'shared', 'goal-contract');
const PROFILE_NAME = 'goal-contract-partition-methodology-profile.json';
const SCHEMA_NAME = 'goal-contract-partition-methodology-profile.schema.json';

function tempPackageRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'partition-methodology-'));
  fs.mkdirSync(path.join(root, ASSET_DIR), { recursive: true });
  fs.copyFileSync(
    path.join(REPO_ROOT, ASSET_DIR, PROFILE_NAME),
    path.join(root, ASSET_DIR, PROFILE_NAME)
  );
  fs.copyFileSync(
    path.join(REPO_ROOT, ASSET_DIR, SCHEMA_NAME),
    path.join(root, ASSET_DIR, SCHEMA_NAME)
  );
  return root;
}

function readProfile(root) {
  return JSON.parse(
    fs.readFileSync(path.join(root, ASSET_DIR, PROFILE_NAME), 'utf8')
  );
}

function writeProfile(root, profile) {
  fs.writeFileSync(
    path.join(root, ASSET_DIR, PROFILE_NAME),
    `${JSON.stringify(profile, null, 2)}\n`,
    'utf8'
  );
}

describe('goal-contract partition methodology profile', () => {
  it('loads the package-owned profile with separate semantic and artifact hashes', () => {
    const loaded = loadPartitionMethodologyProfile({ packageRoot: tempPackageRoot() });

    assert.equal(loaded.profile.schemaVersion, 'partition-methodology-profile/v1');
    assert.deepEqual(
      loaded.profile.rules.map((rule) => rule.ruleId),
      ['PM-001', 'PM-002', 'PM-003', 'PM-004', 'PM-005', 'PM-006', 'PM-007', 'PM-008']
    );
    assert.deepEqual(
      [...new Set(loaded.profile.rules.map((rule) => rule.classification))].sort(),
      ['adapted', 'adopted', 'project-extension']
    );
    assert.match(loaded.methodologyProfileHash, /^sha256:[0-9a-f]{64}$/u);
    assert.match(loaded.methodologyProfileArtifactHash, /^sha256:[0-9a-f]{64}$/u);
    assert.equal(
      loaded.methodologySourceBundleHash,
      'sha256:03f9e1601aec725d2b42faef1bd5ae2683080fe4e693e8d96a1c1b1c2763701a'
    );
  });

  it('keeps semantic identity stable across rule reordering', () => {
    const root = tempPackageRoot();
    const original = loadPartitionMethodologyProfile({ packageRoot: root });
    const profile = readProfile(root);
    profile.rules.reverse();
    writeProfile(root, profile);
    const reordered = loadPartitionMethodologyProfile({ packageRoot: root });

    assert.equal(reordered.methodologyProfileHash, original.methodologyProfileHash);
    assert.notEqual(reordered.methodologyProfileArtifactHash, original.methodologyProfileArtifactHash);
  });

  it('separates normative semantics from provenance-only artifact changes', () => {
    const semanticRoot = tempPackageRoot();
    const semanticOriginal = loadPartitionMethodologyProfile({ packageRoot: semanticRoot });
    const semanticProfile = readProfile(semanticRoot);
    semanticProfile.rules[0].normativeRule += ' Updated.';
    writeProfile(semanticRoot, semanticProfile);
    assert.notEqual(
      loadPartitionMethodologyProfile({ packageRoot: semanticRoot }).methodologyProfileHash,
      semanticOriginal.methodologyProfileHash
    );

    const provenanceRoot = tempPackageRoot();
    const provenanceOriginal = loadPartitionMethodologyProfile({ packageRoot: provenanceRoot });
    const provenanceProfile = readProfile(provenanceRoot);
    provenanceProfile.provenance.assets[0].sha256 = `sha256:${'f'.repeat(64)}`;
    writeProfile(provenanceRoot, provenanceProfile);
    const provenanceChanged = loadPartitionMethodologyProfile({ packageRoot: provenanceRoot });
    assert.equal(provenanceChanged.methodologyProfileHash, provenanceOriginal.methodologyProfileHash);
    assert.notEqual(
      provenanceChanged.methodologyProfileArtifactHash,
      provenanceOriginal.methodologyProfileArtifactHash
    );
  });

  it('fails closed for duplicate rule IDs, invalid schema, and missing assets', () => {
    const duplicateRoot = tempPackageRoot();
    const duplicate = readProfile(duplicateRoot);
    duplicate.rules[1].ruleId = duplicate.rules[0].ruleId;
    writeProfile(duplicateRoot, duplicate);
    assert.throws(
      () => loadPartitionMethodologyProfile({ packageRoot: duplicateRoot }),
      (error) => error.failureClass === 'methodology_profile_rule_id_duplicate'
    );

    const invalidRoot = tempPackageRoot();
    const invalid = readProfile(invalidRoot);
    delete invalid.rules[0].classification;
    writeProfile(invalidRoot, invalid);
    assert.throws(
      () => loadPartitionMethodologyProfile({ packageRoot: invalidRoot }),
      (error) => error.failureClass === 'methodology_profile_schema_invalid'
    );

    assert.throws(
      () => loadPartitionMethodologyProfile({ packageRoot: fs.mkdtempSync(path.join(os.tmpdir(), 'missing-methodology-')) }),
      (error) => error.failureClass === 'methodology_profile_missing'
    );
  });
});
