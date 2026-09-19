const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const authority = require('../src/main-agent/source-authority/scripts/requirements-contract-packaged-semantic-authority.ts');
const {
  createRequirementsContractFileIntakeReceipt,
} = require('../src/main-agent/source-authority/scripts/requirements-contract-file-intake-receipt.ts');
const {
  createRequirementsContractIntentLineageLedger,
} = require('../src/main-agent/source-authority/scripts/requirements-contract-intent-lineage.ts');
const {
  sha256Text,
} = require('../src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver.ts');
const { packFromHermeticStaging } = require('./helpers/hermetic-npm-pack.js');

function tempPackage() {
  const packageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'packaged-semantic-authority-'));
  fs.mkdirSync(path.join(packageRoot, 'dist', 'main-agent', 'source-authority', 'scripts'), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(packageRoot, 'package.json'),
    JSON.stringify({ name: 'bmad-speckit', version: '9.9.9' }),
    'utf8'
  );
  return packageRoot;
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    timeout: options.timeout ?? 300_000,
  });
}

function runNpm(args, options) {
  if (process.platform === 'win32') {
    return run(
      process.env.ComSpec ?? 'cmd.exe',
      ['/d', '/s', '/c', 'call', 'npm.cmd', ...args],
      options
    );
  }
  return run('npm', args, options);
}

function fixtureInput(root) {
  const requirementSetId = 'REQ-PACKAGED-SEMANTIC-AUTHORITY';
  const sourcePath = 'fixture.md';
  const sourceContent = 'MUST-FR-001: Execute the packaged semantic pipeline.\n';
  const intakeReceipt = createRequirementsContractFileIntakeReceipt({
    requirementSetId,
    entrySource: 'source_prd_draft',
    requestedArtifactRole: 'requirement_source_prd',
    sourcePath,
    sourceContent,
    capturedAt: '2026-09-19T00:00:00.000Z',
  });
  const intentLineageLedger = createRequirementsContractIntentLineageLedger({
    intakeReceiptPath: 'authoring/intake/intake-receipt.json',
    intakeReceipt,
    classifications: [
      {
        spanId: intakeReceipt.excerpts[0].excerptId,
        disposition: 'source_root',
        classificationRule: 'fixture-source-root',
        sourceRootRefs: ['MUST-FR-001'],
      },
    ],
  });
  const sourceHash = sha256Text(sourceContent);
  const sourceSpan = { startLine: 1, endLine: 1 };
  const semanticBody = {
    id: 'MUST-FR-001',
    kind: 'functional',
    schemaVersion: 'requirement-contract-requirement/v2',
    text: 'Execute the packaged semantic pipeline.',
    source: {
      sourcePath,
      sourceSpan,
      sourceHash,
      sourceRequirementId: 'MUST-FR-001',
      headingPath: [],
    },
    semantics: {
      actor: null,
      trigger: null,
      preconditions: [],
      action: 'Execute the packaged semantic pipeline.',
      postconditions: [],
      invariants: [],
      thresholds: [],
    },
    authority: {
      authorityState: 'source_grounded',
      derivation: 'fixture',
      decisionReceiptRef: null,
    },
    applicability: { state: 'applicable', reasonCode: 'fixture' },
    unresolved: [],
    verification: {
      method: 'manual',
      oracleRef: null,
      commandRefs: [],
      expectedObservationRefs: [],
    },
    bindings: { targetRefs: [], artifactRefs: [], traceEdgeRefs: [] },
  };
  const authoringDir = path.join(root, 'authoring');
  const intakeDir = path.join(authoringDir, 'intake');
  const semanticResolutionDir = path.join(authoringDir, 'resolution', 'semantic');
  const proofDir = path.join(authoringDir, 'proofs');
  fs.mkdirSync(intakeDir, { recursive: true });
  fs.mkdirSync(semanticResolutionDir, { recursive: true });
  fs.mkdirSync(proofDir, { recursive: true });
  const intakeReceiptPath = path.join(intakeDir, 'intake-receipt.json');
  const intentLineageLedgerPath = path.join(intakeDir, 'intent-lineage-ledger.json');
  fs.writeFileSync(intakeReceiptPath, `${JSON.stringify(intakeReceipt, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    intentLineageLedgerPath,
    `${JSON.stringify(intentLineageLedger, null, 2)}\n`,
    'utf8'
  );
  fs.writeFileSync(path.join(root, sourcePath), sourceContent, 'utf8');
  return {
    projectRoot: root,
    recordId: 'REC-PACKAGED-SEMANTIC-AUTHORITY',
    requirementSetId,
    intakeReceiptPath,
    intakeReceipt,
    intentLineageLedgerPath,
    intentLineageLedger,
    sourceRootCandidates: [
      {
        sourceRootId: 'MUST-FR-001',
        rootClass: 'functional_requirement',
        nodeType: 'requirement',
        bodySchemaVersion: 'requirement-contract-requirement/v2',
        semanticBody,
        sourcePath,
        sourceContent,
        sourceSpan,
        proposedAuthorityClass: 'source_grounded',
      },
    ],
    semanticIrPath: path.join(authoringDir, 'semantic-ir.json'),
    semanticResolutionDir,
    interactionResolutionPath: path.join(authoringDir, 'interaction-resolution.json'),
    semanticConservationManifestPath: path.join(proofDir, 'semantic-conservation-manifest.json'),
  };
}

test('runtime resolves immutable source identity after source tree is removed', () => {
  const packageRoot = tempPackage();
  const sourcePath = path.join(packageRoot, 'build-src', 'pipeline.ts');
  const distPath = path.join(
    packageRoot,
    'dist',
    'main-agent',
    'source-authority',
    'scripts',
    'pipeline.js'
  );
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, 'export const pipeline = true;\n', 'utf8');
  fs.writeFileSync(distPath, 'module.exports = { pipeline: true };\n', 'utf8');

  const written = authority.writePackagedSemanticAuthorityArtifacts({
    packageRoot,
    packageVersion: '9.9.9',
    entries: [
      {
        moduleId: 'requirements-contract-production-semantic-pipeline',
        sourcePath: 'build-src/pipeline.ts',
        distPath: 'dist/main-agent/source-authority/scripts/pipeline.js',
      },
    ],
  });
  fs.rmSync(path.dirname(sourcePath), { recursive: true, force: true });

  const identity = authority.resolvePackagedSemanticModuleIdentity({
    packageRoot,
    moduleId: 'requirements-contract-production-semantic-pipeline',
    manifestPath: written.manifestPath,
    receiptPath: written.receiptPath,
  });

  assert.equal(identity.id, 'requirements-contract-production-semantic-pipeline');
  assert.match(identity.hash, /^sha256:[a-f0-9]{64}$/u);
  assert.equal(identity.sourcePath, 'build-src/pipeline.ts');
});

test('runtime rejects a changed dist module', () => {
  const packageRoot = tempPackage();
  const sourcePath = path.join(packageRoot, 'pipeline.ts');
  const distPath = path.join(
    packageRoot,
    'dist',
    'main-agent',
    'source-authority',
    'scripts',
    'pipeline.js'
  );
  fs.writeFileSync(sourcePath, 'export const pipeline = true;\n', 'utf8');
  fs.writeFileSync(distPath, 'module.exports = { pipeline: true };\n', 'utf8');
  const written = authority.writePackagedSemanticAuthorityArtifacts({
    packageRoot,
    packageVersion: '9.9.9',
    entries: [
      {
        moduleId: 'pipeline',
        sourcePath: 'pipeline.ts',
        distPath: 'dist/main-agent/source-authority/scripts/pipeline.js',
      },
    ],
  });
  fs.appendFileSync(distPath, 'module.exports.changed = true;\n', 'utf8');

  assert.throws(
    () =>
      authority.resolvePackagedSemanticModuleIdentity({
        packageRoot,
        moduleId: 'pipeline',
        manifestPath: written.manifestPath,
        receiptPath: written.receiptPath,
      }),
    /packaged_semantic_authority_dist_hash_mismatch/u
  );
});

test('runtime rejects missing packaged authority', () => {
  const packageRoot = tempPackage();
  assert.throws(
    () => authority.resolvePackagedSemanticModuleIdentity({ packageRoot, moduleId: 'pipeline' }),
    /packaged_semantic_authority_manifest_missing/u
  );
});

test(
  'hermetic tarball runs the semantic pipeline without a published source tree',
  { timeout: 900_000 },
  () => {
    const packageRoot = path.resolve(__dirname, '..');
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'packaged-semantic-tarball-'));
    const packRoot = path.join(tempRoot, 'pack');
    const consumerRoot = path.join(tempRoot, 'consumer');
    const npmCacheRoot = path.join(tempRoot, 'npm-cache');
    fs.mkdirSync(consumerRoot, { recursive: true });
    fs.writeFileSync(
      path.join(consumerRoot, 'package.json'),
      JSON.stringify({
        name: 'packaged-semantic-authority-consumer',
        version: '1.0.0',
        private: true,
      }),
      'utf8'
    );
    const npmEnv = {
      ...process.env,
      npm_config_cache: npmCacheRoot,
      npm_config_loglevel: 'error',
    };
    const pack = packFromHermeticStaging({
      packageRoot,
      packDestination: packRoot,
      runNpm,
      npmOptions: { env: npmEnv, timeout: 600_000 },
    });
    assert.equal(pack.status, 0, `${pack.stdout}\n${pack.stderr}`);
    const packRecord = JSON.parse(pack.stdout)[0];
    const tarballPath = path.join(packRoot, packRecord.filename);
    const install = runNpm(
      [
        'install',
        '--no-audit',
        '--no-fund',
        '--no-package-lock',
        '--no-save',
        '--install-links=false',
        tarballPath,
      ],
      { cwd: consumerRoot, env: npmEnv, timeout: 600_000 }
    );
    assert.equal(install.status, 0, `${install.stdout}\n${install.stderr}`);
    const installedRoot = path.join(consumerRoot, 'node_modules', 'bmad-speckit');
    assert.equal(fs.existsSync(path.join(installedRoot, 'src')), false);
    const installedPipelinePath = path.join(
      installedRoot,
      'dist',
      'main-agent',
      'source-authority',
      'scripts',
      'requirements-contract-production-semantic-pipeline.js'
    );
    const installedPipelineText = fs.readFileSync(installedPipelinePath, 'utf8');
    assert.doesNotMatch(installedPipelineText, /canonicalModulePath|Canonical source module/u);
    const pipeline = require(
      path.join(
        installedRoot,
        'dist',
        'main-agent',
        'source-authority',
        'scripts',
        'requirements-contract-production-semantic-pipeline.js'
      )
    );
    const fixture = fixtureInput(consumerRoot);
    const result = pipeline.runRequirementsContractProductionSemanticPipeline(fixture);
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(
          installedRoot,
          'dist',
          'main-agent',
          'requirements-contract-semantic-authority-manifest.json'
        ),
        'utf8'
      )
    );
    const receipt = JSON.parse(
      fs.readFileSync(
        path.join(
          installedRoot,
          'dist',
          'main-agent',
          'requirements-contract-semantic-authority-receipt.json'
        ),
        'utf8'
      )
    );
    assert.equal(manifest.schemaVersion, 'requirements-contract-packaged-semantic-authority/v1');
    assert.equal(
      receipt.schemaVersion,
      'requirements-contract-packaged-semantic-authority-receipt/v1'
    );
    assert.equal(receipt.packageVersion, require(path.join(installedRoot, 'package.json')).version);
    for (const entry of manifest.entries) {
      assert.match(entry.sourceHash, /^sha256:[a-f0-9]{64}$/u);
      assert.match(entry.distHash, /^sha256:[a-f0-9]{64}$/u);
      assert.equal(entry.packageVersion, receipt.packageVersion);
    }
    const expectedHash = manifest.entries.find(
      (entry) => entry.moduleId === 'requirements-contract-production-semantic-pipeline'
    ).sourceHash;
    assert.equal(result.semanticConservationManifest.canonicalRenderer.hash, expectedHash);
    assert.equal(result.semanticConservationManifest.parser.hash, expectedHash);
  }
);
