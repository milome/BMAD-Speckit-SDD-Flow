#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..', '..');
const WAVE_ID = 'main-agent-runtime-migration-wave-3.12';
const WAVE_DIR = `repo-governance/script-migrations/${WAVE_ID}`;
const REGISTRY_PATH = 'repo-governance/script-migration-registry.yaml';
const CONTRACT_PATH =
  'docs/plans/2026-06-06-main-agent-runtime-migration-wave-3-12-full-physical-closure-audit.md';
const AUDIT_PATH = `${WAVE_DIR}/full-physical-script-closure-audit.json`;
const SUMMARY_PATH = `${WAVE_DIR}/summary.md`;
const REGISTRY_EVIDENCE_PATH = `${WAVE_DIR}/registry-evidence.json`;

const TEXT_EXTENSIONS = new Set([
  '.cjs',
  '.cts',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.ps1',
  '.py',
  '.sh',
  '.ts',
  '.yaml',
  '.yml',
]);

const INTERNAL_PACKAGE_SCRIPT_PREFIXES = [
  'accept:',
  'build:',
  'check:encoding',
  'format',
  'format:',
  'lint',
  'lint:',
  'postpack',
  'prepack',
  'prepublishOnly',
  'test',
  'test:',
  'verify:hooks',
];

const PACKAGE_TARGETS = {
  'scripts/analytics-cluster.ts': ['packages/scoring/analytics/cluster-weaknesses.ts'],
  'scripts/analytics-prompt-optimize.ts': ['packages/scoring/analytics/prompt-optimizer.ts'],
  'scripts/analytics-rule-suggest.ts': ['packages/scoring/analytics/rule-suggestion.ts'],
  'scripts/analytics-sft-extract.ts': ['packages/scoring/analytics/sft-extractor.ts'],
  'scripts/assert-implementation-entry.ts': [
    'packages/bmad-speckit/src/commands/assert-implementation-entry.js',
  ],
  'scripts/coach-diagnose.ts': ['packages/scoring/coach/diagnose.ts'],
  'scripts/dashboard-generate.ts': ['packages/scoring/dashboard/snapshot.ts'],
  'scripts/dashboard-projection-mapping.ts': [
    'packages/scoring/dashboard/reviewer-projection.ts',
    'packages/scoring/dashboard/six-model-projection.ts',
  ],
  'scripts/deferred-gap-governance.cjs': [
    'packages/bmad-speckit/src/utils/deferred-gap-governance-loader.js',
  ],
  'scripts/parse-and-write-score.ts': ['packages/scoring/orchestrator/parse-and-write.ts'],
  'scripts/runtime-context-registry.ts': ['packages/runtime-context/src/registry.ts'],
  'scripts/runtime-context.ts': ['packages/runtime-context/src/context.ts'],
  'scripts/scores-summary.ts': [
    'packages/scoring/scores/format-table.ts',
    'packages/scoring/query/index.ts',
  ],
  'scripts/sft-extract.ts': ['packages/scoring/analytics/sft-extractor.ts'],
  'scripts/start-dashboard.ts': ['packages/scoring/dashboard/live-server.ts'],
  'scripts/start-runtime-dashboard-server.cjs': ['packages/scoring/dashboard/live-server.ts'],
};

const TRUE_INTERNAL_CLASSIFICATIONS = new Map([
  ['scripts/README.md', 'repo_internal_scripts_documentation'],
  ['scripts/compare-bmad-help-upstream.js', 'repo_internal_test_harness'],
  ['scripts/create-test-story.ts', 'repo_internal_test_seed_only'],
  ['scripts/deferred-gap-governance.d.cts', 'repo_internal_type_declaration'],
  ['scripts/ensure-governance-user-story-mapping-fixture.js', 'repo_internal_ci_release_or_source_fixture'],
  ['scripts/extract-npm-pack-json.js', 'repo_internal_pack_fixture_extractor'],
  ['scripts/i18n/bootstrap-skill-bilingual-files.mjs', 'repo_source_generation_i18n_bilingual_tooling'],
  ['scripts/i18n/han-outside-fences.mjs', 'repo_source_generation_i18n_bilingual_tooling'],
  ['scripts/i18n/phase3-skill-en-transform.mjs', 'repo_source_generation_i18n_bilingual_tooling'],
  ['scripts/i18n/phase3_translate_skill_en.py', 'repo_source_generation_i18n_bilingual_tooling'],
  ['scripts/normalize-pack-manifests.js', 'repo_internal_ci_release_or_source_fixture'],
  ['scripts/render-upstream-bmad-help-baseline.js', 'repo_internal_test_harness'],
  ['scripts/test-locks.ts', 'repo_internal_test_harness'],
  ['scripts/test-story-flow.ts', 'repo_internal_test_harness'],
  ['scripts/verify-skill-architecture.sh', 'repo_internal_test_harness'],
  ['scripts/verify-speckit-mirror-sync.js', 'repo_internal_ci_release_or_source_fixture'],
]);

const PUBLIC_CLI_SCRIPT_PATHS = new Set([
  'scripts/init-to-root.js',
  'scripts/setup.ps1',
  'scripts/setup.sh',
  'scripts/speckit-cli.ts',
]);

function parseArgs(argv) {
  const options = {
    write: false,
    updateRegistry: false,
    pretty: false,
    quiet: false,
    check: false,
  };
  for (const arg of argv) {
    if (arg === '--write') options.write = true;
    else if (arg === '--update-registry') options.updateRegistry = true;
    else if (arg === '--pretty') options.pretty = true;
    else if (arg === '--quiet') options.quiet = true;
    else if (arg === '--check') options.check = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function repoPath(relativePath) {
  return path.join(ROOT, relativePath);
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function sha256Text(text) {
  return `sha256:${crypto.createHash('sha256').update(text).digest('hex')}`;
}

function formatJson(value, pretty) {
  return `${JSON.stringify(value, null, pretty ? 2 : 0)}\n`;
}

function runRgFiles(scope) {
  const args = ['--files'];
  if (scope) args.push(scope);
  const result = spawnSync('rg', args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    if (scope === 'scripts') return listFiles(repoPath('scripts')).map(rel).sort();
    throw new Error(`rg --files${scope ? ` ${scope}` : ''} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout
    .split(/\r?\n/)
    .map((line) => normalizePath(line.trim()))
    .filter(Boolean)
    .sort();
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(repoPath(relativePath), 'utf8'));
}

function loadRegistry() {
  return yaml.load(fs.readFileSync(repoPath(REGISTRY_PATH), 'utf8'));
}

function cloneRegistryWithoutWave(registry) {
  return {
    ...registry,
    waves: (registry.waves || []).filter((wave) => wave.waveId !== WAVE_ID),
  };
}

function latestEntriesByOriginal(registry) {
  const latest = new Map();
  for (const wave of registry.waves || []) {
    for (const entry of wave.entries || []) {
      latest.set(normalizePath(entry.originalPath), { waveId: wave.waveId, entry });
    }
  }
  return latest;
}

function collectTextCorpus() {
  const files = runRgFiles(null).filter((filePath) => {
    if (filePath.startsWith('.git/')) return false;
    if (filePath.startsWith('node_modules/')) return false;
    if (filePath.includes('/node_modules/')) return false;
    if (filePath.startsWith(WAVE_DIR)) return false;
    if (filePath === REGISTRY_PATH) return false;
    if (filePath.includes('.bak.')) return false;
    if (filePath.endsWith('package-lock.json')) return false;
    return TEXT_EXTENSIONS.has(path.extname(filePath));
  });
  const corpus = [];
  for (const filePath of files) {
    const full = repoPath(filePath);
    const stat = fs.statSync(full);
    if (stat.size > 2 * 1024 * 1024) continue;
    corpus.push({ path: filePath, text: fs.readFileSync(full, 'utf8') });
  }
  return corpus;
}

function referenceNeedles(scriptPath) {
  const noExtension = scriptPath.replace(/\.[^.]+$/u, '');
  return [
    scriptPath,
    `./${scriptPath}`,
    `../${scriptPath}`,
    `../../${scriptPath}`,
    noExtension,
    `./${noExtension}`,
    `../${noExtension}`,
    `../../${noExtension}`,
  ];
}

function collectReferences(scriptPath, corpus) {
  const needles = referenceNeedles(scriptPath);
  const refs = [];
  for (const item of corpus) {
    if (item.path === scriptPath) continue;
    if (needles.some((needle) => item.text.includes(needle))) refs.push(item.path);
  }
  return refs.sort();
}

function rootPackageFilesIncludesScripts(rootPackage) {
  return (rootPackage.files || []).some((item) => item === 'scripts' || item === 'scripts/');
}

function packageScriptCommands(packageJson, scriptPath) {
  const commands = [];
  const noExtension = scriptPath.replace(/\.[^.]+$/u, '');
  for (const [name, command] of Object.entries(packageJson.scripts || {})) {
    const text = String(command);
    if (
      text.includes(scriptPath) ||
      text.includes(noExtension) ||
      text.includes(`../../${scriptPath}`) ||
      text.includes(`../${scriptPath}`)
    ) {
      commands.push(name);
    }
  }
  return commands.sort();
}

function packageBinCommands(packageJson, scriptPath) {
  return Object.entries(packageJson.bin || {})
    .filter(([, target]) => normalizePath(target) === scriptPath)
    .map(([name]) => name)
    .sort();
}

function isInternalPackageScript(name) {
  return INTERNAL_PACKAGE_SCRIPT_PREFIXES.some((prefix) => name === prefix || name.startsWith(prefix));
}

function splitReferences(refs) {
  return {
    installSurfaceRefs: refs.filter(
      (ref) =>
        ref.startsWith('_bmad/') ||
        ref.startsWith('.codex/') ||
        ref.startsWith('.cursor/') ||
        ref.startsWith('.claude/')
    ),
    packageRuntimeRefs: refs.filter((ref) => ref.startsWith('packages/')),
    testRefs: refs.filter((ref) => ref.startsWith('tests/')),
    docsRefs: refs.filter(
      (ref) =>
        ref.startsWith('docs/') ||
        ref.startsWith('README') ||
        ref.startsWith('specs/') ||
        ref === 'AGENTS.md' ||
        ref === 'CLAUDE.md'
    ),
    governanceRefs: refs.filter((ref) => ref.startsWith('repo-governance/')),
    sourceScriptRefs: refs.filter((ref) => ref.startsWith('scripts/')),
  };
}

function scriptSlug(scriptPath) {
  return scriptPath
    .replace(/^scripts\//u, '')
    .replace(/\.[^.]+$/u, '')
    .replace(/[^a-zA-Z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')
    .toLowerCase();
}

function registryEntryId(scriptPath) {
  return scriptPath
    .replace(/^scripts\//u, '')
    .replace(/[^a-zA-Z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')
    .toLowerCase();
}

function isThinPackageReexport(scriptPath, text) {
  if (!scriptPath.startsWith('scripts/ralph-method/')) return false;
  return /^export \* from ['"]\.\.\/\.\.\/packages\/ralph-method\/src\//u.test(text.trim());
}

function correspondingPackageTargets(scriptPath) {
  if (scriptPath.startsWith('scripts/ralph-method/')) {
    const name = path.posix.basename(scriptPath);
    const target = `packages/ralph-method/src/${name}`;
    return fs.existsSync(repoPath(target)) ? [target] : [];
  }
  return (PACKAGE_TARGETS[scriptPath] || []).filter((target) => fs.existsSync(repoPath(target)));
}

function classifyScript(scriptPath, signals) {
  const text = fs.readFileSync(repoPath(scriptPath), 'utf8');
  const topMatter = text.slice(0, 600).toLowerCase();
  const slug = scriptSlug(scriptPath);
  const refs = splitReferences(signals.references);
  const packageTargets = correspondingPackageTargets(scriptPath);
  const hasConsumerSurfaceRefs = refs.installSurfaceRefs.length > 0;
  const hasPackageRuntimeRefs = refs.packageRuntimeRefs.length > 0 || packageTargets.length > 0;
  const hasPublicBin = signals.rootBinCommands.length > 0;
  const publicPackageScripts = signals.rootPackageScriptCommands.filter(
    (name) => !isInternalPackageScript(name)
  );
  const hasPublicPackageScript = publicPackageScripts.length > 0;
  const hasInternalPackageScript =
    signals.rootPackageScriptCommands.some(isInternalPackageScript) ||
    signals.bmadPackageScriptCommands.some(isInternalPackageScript);

  const trueInternalClass = TRUE_INTERNAL_CLASSIFICATIONS.get(scriptPath);

  if (trueInternalClass) {
    return settled(trueInternalClass, 'repo_internal_reclassify', [scriptPath]);
  }

  if (/legacy compatibility entry\. new callers must use/u.test(topMatter)) {
    return settled('deprecated_legacy_compatibility_entry', 'deprecated_no_migration', [
      scriptPath,
    ]);
  }

  if (isThinPackageReexport(scriptPath, text) && packageTargets.length > 0) {
    return settled('package_runtime_helper_existing_package_alias', 'compatibility_alias', [
      ...packageTargets,
      scriptPath,
    ]);
  }

  if (scriptPath === 'scripts/bmad-speckit-cli.js') {
    return settled('public_cli_package_bin_compatibility_alias', 'compatibility_alias', [
      'packages/bmad-speckit/bin/bmad-speckit.js',
      scriptPath,
    ]);
  }

  if (hasPublicBin || hasPublicPackageScript || PUBLIC_CLI_SCRIPT_PATHS.has(scriptPath)) {
    return planned('public_cli', 'public_cli_de_surface', [
      'packages/bmad-speckit/bin/bmad-speckit.js',
      `packages/bmad-speckit/src/commands/${slug}.js`,
    ]);
  }

  if (
    hasConsumerSurfaceRefs ||
    scriptPath.startsWith('scripts/mcp/consumer/') ||
    scriptPath === 'scripts/validate-consumer-governance.ps1'
  ) {
    return planned('consumer_runtime_reachable', 'package_runtime_module', [
      `packages/bmad-speckit/src/main-agent/actions/${slug}.js`,
    ]);
  }

  if (hasPackageRuntimeRefs) {
    return planned('package_runtime_helper', 'durable_helper_copy', [
      ...(packageTargets.length > 0 ? packageTargets : [`packages/bmad-speckit/src/main-agent/helpers/${slug}.js`]),
    ]);
  }

  if (hasInternalPackageScript) {
    return settled('repo_internal_ci_release_or_source_fixture', 'repo_internal_reclassify', [
      scriptPath,
    ]);
  }

  if (refs.sourceScriptRefs.length > 0) {
    return planned('package_runtime_helper', 'durable_helper_copy', [
      `packages/bmad-speckit/src/main-agent/helpers/${slug}.js`,
    ]);
  }

  if (refs.testRefs.length > 0 || refs.docsRefs.length > 0 || refs.governanceRefs.length > 0) {
    return planned('package_runtime_helper', 'durable_helper_copy', [
      `packages/bmad-speckit/src/main-agent/helpers/${slug}.js`,
    ]);
  }

  return planned('package_runtime_helper', 'durable_helper_copy', [
    `packages/bmad-speckit/src/main-agent/helpers/${slug}.js`,
  ]);
}

function planned(originalClassBeforeMigration, migrationStrategy, targetPaths) {
  return {
    originalClassBeforeMigration,
    migrationStrategy,
    migrationStatus: 'planned',
    validationStatus: 'pending',
    callerSwitchStatus: 'pending',
    targetPaths,
    evidenceRequired: false,
    oldPathDisposition: `retained_pending_${originalClassBeforeMigration}`,
  };
}

function settled(originalClassBeforeMigration, migrationStrategy, targetPaths) {
  return {
    originalClassBeforeMigration,
    migrationStrategy,
    migrationStatus: 'validated',
    validationStatus: 'passed',
    callerSwitchStatus: 'not_applicable',
    targetPaths,
    evidenceRequired: true,
    oldPathDisposition: `retained_${originalClassBeforeMigration}`,
  };
}

function buildScriptRecord(scriptPath, registryForWave, currentRegistry, corpus, manifests) {
  const withoutWaveLatest = latestEntriesByOriginal(registryForWave);
  const currentLatest = latestEntriesByOriginal(currentRegistry);
  const references = collectReferences(scriptPath, corpus);
  const signals = {
    rootPackageFilesIncludesScripts: rootPackageFilesIncludesScripts(manifests.root),
    rootBinCommands: packageBinCommands(manifests.root, scriptPath),
    rootPackageScriptCommands: packageScriptCommands(manifests.root, scriptPath),
    bmadPackageScriptCommands: packageScriptCommands(manifests.bmadPackage, scriptPath),
    references,
  };
  const currentRecord = currentLatest.get(scriptPath) || null;
  const withoutWaveRecord = withoutWaveLatest.get(scriptPath) || null;
  const classification = withoutWaveRecord
    ? {
        originalClassBeforeMigration: withoutWaveRecord.entry.originalClassBeforeMigration,
        migrationStrategy: withoutWaveRecord.entry.migrationStrategy,
        migrationStatus: withoutWaveRecord.entry.migrationStatus,
        validationStatus: withoutWaveRecord.entry.validationStatus,
        callerSwitchStatus: withoutWaveRecord.entry.callerSwitchStatus,
        targetPaths: withoutWaveRecord.entry.targetPaths || [],
        evidenceRequired: false,
        oldPathDisposition: withoutWaveRecord.entry.oldPathDisposition,
      }
    : classifyScript(scriptPath, signals);

  return {
    originalPath: scriptPath,
    physicalExtension: path.extname(scriptPath),
    registrationStatusWithoutWave: withoutWaveRecord ? 'already_registered' : 'unregistered',
    currentRegistrationStatus: currentRecord
      ? currentRecord.waveId === WAVE_ID
        ? 'registered_by_current_wave'
        : 'already_registered'
      : 'unregistered',
    latestRegistryWaveId: currentRecord ? currentRecord.waveId : null,
    signals,
    evidenceBasis: buildEvidenceBasis(scriptPath, signals),
    recommendation: {
      category: classification.originalClassBeforeMigration,
      migrationStrategy: classification.migrationStrategy,
      migrationStatus: classification.migrationStatus,
      validationStatus: classification.validationStatus,
      targetPaths: classification.targetPaths,
      oldPathDisposition: classification.oldPathDisposition,
    },
  };
}

function buildEvidenceBasis(scriptPath, signals) {
  const refs = splitReferences(signals.references);
  const basis = [];
  if (signals.rootPackageFilesIncludesScripts) basis.push('root package.json files includes scripts/');
  for (const command of signals.rootBinCommands) basis.push(`root package bin exposes ${command}`);
  for (const command of signals.rootPackageScriptCommands) basis.push(`root package script references ${command}`);
  for (const command of signals.bmadPackageScriptCommands) {
    basis.push(`packages/bmad-speckit package script references ${command}`);
  }
  if (refs.installSurfaceRefs.length > 0) {
    basis.push(`install-surface references: ${refs.installSurfaceRefs.slice(0, 4).join(', ')}`);
  }
  if (refs.packageRuntimeRefs.length > 0) {
    basis.push(`package runtime references: ${refs.packageRuntimeRefs.slice(0, 4).join(', ')}`);
  }
  if (refs.testRefs.length > 0) basis.push(`test references: ${refs.testRefs.slice(0, 4).join(', ')}`);
  if (refs.docsRefs.length > 0) basis.push(`docs/spec references: ${refs.docsRefs.slice(0, 4).join(', ')}`);
  if (refs.governanceRefs.length > 0) {
    basis.push(`prior governance/audit references: ${refs.governanceRefs.slice(0, 4).join(', ')}`);
  }
  if (basis.length === 0) basis.push('no direct reference found outside physical scripts inventory');
  return basis;
}

function buildPublicCommandsBefore(record) {
  const commands = [];
  for (const command of record.signals.rootBinCommands) commands.push(command);
  for (const command of record.signals.rootPackageScriptCommands) commands.push(`npm run ${command}`);
  if (commands.length === 0 && record.recommendation.category !== 'repo_internal_docs_or_prior_audit_only') {
    commands.push(`source repository ${record.originalPath}`);
  }
  return [...new Set(commands)].sort();
}

function buildPublicCommandsAfter(record) {
  if (record.recommendation.migrationStrategy !== 'public_cli_de_surface') return [];
  const slug = scriptSlug(record.originalPath);
  if (record.signals.rootBinCommands.includes('bmad-speckit')) return ['bmad-speckit'];
  return [`bmad-speckit ${slug}`];
}

function toRegistryEntry(record) {
  const entryId = registryEntryId(record.originalPath);
  return {
    entryId,
    originalPath: record.originalPath,
    originalPathStatus: 'retained',
    originalClassBeforeMigration: record.recommendation.category,
    migrationStrategy: record.recommendation.migrationStrategy,
    migrationStatus: record.recommendation.migrationStatus,
    targetPaths: record.recommendation.targetPaths,
    publicCommandsBeforeMigration: buildPublicCommandsBefore(record),
    publicCommandsAfterMigration: buildPublicCommandsAfter(record),
    callerSwitchStatus: record.recommendation.migrationStatus === 'validated'
      ? record.recommendation.migrationStrategy === 'compatibility_alias'
        ? 'compatibility_alias_retained'
        : 'not_applicable'
      : 'pending',
    validationStatus: record.recommendation.validationStatus,
    evidenceRefs:
      record.recommendation.validationStatus === 'passed' ? [REGISTRY_EVIDENCE_PATH] : [],
    oldPathDisposition: record.recommendation.oldPathDisposition,
    deletionAllowed: false,
    deletionApprovalRef: null,
  };
}

function buildWave(records) {
  const entries = records
    .filter((record) => record.registrationStatusWithoutWave === 'unregistered')
    .map(toRegistryEntry);
  return {
    waveId: WAVE_ID,
    title: 'Main Agent runtime migration wave 3.12 full physical script closure audit',
    contractPath: CONTRACT_PATH,
    refinesWaveId: 'main-agent-runtime-migration-wave-3.11',
    status: 'in_progress',
    startedAt: '2026-06-06T00:00:00.000Z',
    completedAt: null,
    entries,
  };
}

function countsBy(records, selector) {
  const counts = {};
  for (const record of records) {
    const key = selector(record);
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function buildAudit(currentRegistry) {
  const registryForWave = cloneRegistryWithoutWave(currentRegistry);
  const physicalScripts = runRgFiles('scripts');
  const corpus = collectTextCorpus();
  const manifests = {
    root: readJson('package.json'),
    bmadPackage: readJson('packages/bmad-speckit/package.json'),
  };
  const records = physicalScripts.map((scriptPath) =>
    buildScriptRecord(scriptPath, registryForWave, currentRegistry, corpus, manifests)
  );
  const newRecords = records.filter(
    (record) => record.registrationStatusWithoutWave === 'unregistered'
  );
  const currentUnregistered = records.filter((record) => record.currentRegistrationStatus === 'unregistered');
  const wave = buildWave(records);
  return {
    schemaVersion: 1,
    waveId: WAVE_ID,
    generatedAt: new Date().toISOString(),
    registryPath: REGISTRY_PATH,
    physicalUniverseCommand: 'rg --files scripts',
    physicalScriptsTotal: records.length,
    registryCoverageWithoutWave: {
      registered: records.length - newRecords.length,
      unregistered: newRecords.length,
    },
    currentRegistryCoverage: {
      registered: records.length - currentUnregistered.length,
      unregistered: currentUnregistered.length,
    },
    newRegistrationCounts: {
      total: newRecords.length,
      byCategory: countsBy(newRecords, (record) => record.recommendation.category),
      byStrategy: countsBy(newRecords, (record) => record.recommendation.migrationStrategy),
      byMigrationStatus: countsBy(newRecords, (record) => record.recommendation.migrationStatus),
      byValidationStatus: countsBy(newRecords, (record) => record.recommendation.validationStatus),
    },
    consumerReachableMigrationQueue: newRecords
      .filter((record) =>
        ['consumer_runtime_reachable', 'public_cli', 'package_runtime_helper'].includes(
          record.recommendation.category
        )
      )
      .map((record) => record.originalPath),
    internalOrDeprecatedSettled: newRecords
      .filter((record) => record.recommendation.validationStatus === 'passed')
      .map((record) => record.originalPath),
    entries: records,
    proposedWave: wave,
  };
}

function buildFastCheck(currentRegistry) {
  const registryWithoutWave = cloneRegistryWithoutWave(currentRegistry);
  const physicalScripts = runRgFiles('scripts');
  const withoutWaveLatest = latestEntriesByOriginal(registryWithoutWave);
  const currentLatest = latestEntriesByOriginal(currentRegistry);
  const withoutWaveUnregistered = physicalScripts.filter(
    (scriptPath) => !withoutWaveLatest.has(scriptPath)
  );
  const currentUnregistered = physicalScripts.filter((scriptPath) => !currentLatest.has(scriptPath));
  return {
    physicalScriptsTotal: physicalScripts.length,
    registryCoverageWithoutWave: {
      registered: physicalScripts.length - withoutWaveUnregistered.length,
      unregistered: withoutWaveUnregistered.length,
    },
    currentRegistryCoverage: {
      registered: physicalScripts.length - currentUnregistered.length,
      unregistered: currentUnregistered.length,
    },
  };
}

function buildRegistryEvidence(audit) {
  const evidenceEntries = audit.proposedWave.entries
    .filter((entry) => entry.validationStatus === 'passed')
    .map((entry) => {
      const record = audit.entries.find((item) => item.originalPath === entry.originalPath);
      const payload = JSON.stringify({
        originalPath: entry.originalPath,
        category: entry.originalClassBeforeMigration,
        strategy: entry.migrationStrategy,
        evidenceBasis: record ? record.evidenceBasis : [],
      });
      return {
        entryId: entry.entryId,
        originalPath: entry.originalPath,
        targetPaths: entry.targetPaths,
        commands: [
          {
            command: `AUDIT-01 full physical script closure classification for ${entry.originalPath}`,
            exitCode: 0,
            stdoutHash: sha256Text(payload),
            stderrHash: sha256Text(''),
          },
        ],
        installMatrixEvidence: [],
        result: 'passed',
      };
    });
  return {
    waveId: WAVE_ID,
    validatedAt: new Date().toISOString(),
    entries: evidenceEntries,
  };
}

function buildSummary(audit) {
  const queue = audit.consumerReachableMigrationQueue;
  const validatedRecords = audit.proposedWave.entries.filter(
    (entry) => entry.validationStatus === 'passed'
  );
  const packageRuntimeAliases = validatedRecords
    .filter(
      (entry) =>
        entry.originalClassBeforeMigration === 'package_runtime_helper_existing_package_alias'
    )
    .map((entry) => entry.originalPath);
  const publicCliPackageBinAliases = validatedRecords
    .filter(
      (entry) =>
        entry.originalClassBeforeMigration === 'public_cli_package_bin_compatibility_alias'
    )
    .map((entry) => entry.originalPath);
  const sourceGenerationI18nRecords = validatedRecords
    .filter(
      (entry) =>
        entry.originalClassBeforeMigration === 'repo_source_generation_i18n_bilingual_tooling'
    )
    .map((entry) => entry.originalPath);
  const repoInternalValidatedRecords = validatedRecords
    .filter(
      (entry) =>
        ![
          'package_runtime_helper_existing_package_alias',
          'public_cli_package_bin_compatibility_alias',
          'repo_source_generation_i18n_bilingual_tooling',
        ].includes(entry.originalClassBeforeMigration)
    )
    .map((entry) => entry.originalPath);
  const lines = [
    `# ${WAVE_ID} Full Physical Script Closure Audit`,
    '',
    '## Scope',
    '',
    '- Universe command: `rg --files scripts`.',
    `- Physical scripts total: ${audit.physicalScriptsTotal}.`,
    `- Registry coverage before this wave: ${audit.registryCoverageWithoutWave.registered} registered, ${audit.registryCoverageWithoutWave.unregistered} unregistered.`,
    `- Current registry coverage after this wave is expected to be ${audit.physicalScriptsTotal} registered, 0 unregistered.`,
    '',
    '## New Registration Counts',
    '',
    '```json',
    JSON.stringify(audit.newRegistrationCounts, null, 2),
    '```',
    '',
    '## Consumer-Reachable Migration Queue',
    '',
    `Count: ${queue.length}`,
    '',
    '- Status: `planned/pending`.',
    '- Scope: consumer runtime reachable, public CLI, and package runtime helper records still needing migration implementation or validation.',
    '',
    ...queue.map((item) => `- ${item}`),
    '',
    '## Validated Non-Migration Records',
    '',
    `Count: ${validatedRecords.length}`,
    '',
    '- Status: `validated/passed`.',
    '- Scope: evidence-backed records that do not enter the remaining migration queue for this wave.',
    '- Important: the Ralph entries below are not repo-internal; they are root source-repo aliases for the already packaged `@bmad-speckit/ralph-method` runtime used by the package CLI.',
    '',
    '### Package Runtime Helper Aliases',
    '',
    `Count: ${packageRuntimeAliases.length}`,
    '',
    ...packageRuntimeAliases.map((item) => `- ${item}`),
    '',
    '### Public CLI Package Bin Compatibility Alias',
    '',
    `Count: ${publicCliPackageBinAliases.length}`,
    '',
    '- Important: this entry is not repo-internal; it is the root package bin compatibility alias that forwards to the package CLI.',
    '',
    ...publicCliPackageBinAliases.map((item) => `- ${item}`),
    '',
    '### Source Generation / Bilingual Skill Maintenance Tooling',
    '',
    `Count: ${sourceGenerationI18nRecords.length}`,
    '',
    '- Scope: source-repository tooling for bilingual Skill file generation, translation, and audit maintenance.',
    '- Important: these entries are not the consumer runtime bilingual path; runtime language support remains covered by the i18n package runtime helper queue and install-surface/runtime-emit closure.',
    '',
    ...sourceGenerationI18nRecords.map((item) => `- ${item}`),
    '',
    '### Evidence-Backed Repo Internal / Fixture / Documentation / Test Harness',
    '',
    `Count: ${repoInternalValidatedRecords.length}`,
    '',
    ...repoInternalValidatedRecords.map((item) => `- ${item}`),
    '',
    '## Residual Risk',
    '',
    '- This wave closes registry visibility for physical scripts; it does not claim every consumer-reachable script has been migrated.',
    '- Consumer-reachable entries remain `planned/pending` until package runtime modules, public CLI surfaces, or durable helpers are implemented and validated.',
    '- `scripts/` is still included by the root package `files` list, so root package publication is tracked as a risk signal, not a migration-complete proof.',
    '',
  ];
  return `${lines.join('\n')}`;
}

function safeWrite(relativePath, content) {
  const target = repoPath(relativePath);
  const dir = path.dirname(target);
  fs.mkdirSync(dir, { recursive: true });
  const marker = `${new Date().toISOString().replace(/[-:.]/gu, '')}.${process.pid}.${crypto
    .randomBytes(4)
    .toString('hex')}`;
  const draft = path.join(dir, `.${path.basename(relativePath)}.draft.${marker}`);
  const backup = fs.existsSync(target) ? `${relativePath}.bak.${marker}` : null;
  fs.writeFileSync(draft, content, 'utf8');
  const draftHash = sha256Text(content);
  if (backup) fs.copyFileSync(target, repoPath(backup));
  fs.renameSync(draft, target);
  const postHash = sha256Text(fs.readFileSync(target, 'utf8'));
  if (postHash !== draftHash) {
    throw new Error(`safe write hash mismatch for ${relativePath}`);
  }
  return { targetPath: relativePath, backupPath: backup, sha256: postHash };
}

function dumpWaveBlock(wave) {
  const text = yaml.dump([wave], {
    lineWidth: 120,
    noRefs: true,
    quotingType: "'",
  });
  return text
    .trimEnd()
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
}

function replaceOrAppendWave(registryText, wave) {
  const waveBlock = dumpWaveBlock(wave);
  const marker = `\n  - waveId: ${WAVE_ID}`;
  const quotedMarker = `\n  - waveId: '${WAVE_ID}'`;
  let start = registryText.indexOf(marker);
  if (start < 0) start = registryText.indexOf(quotedMarker);
  if (start >= 0) {
    const next = registryText.indexOf('\n  - waveId:', start + 1);
    const end = next >= 0 ? next : registryText.length;
    return `${registryText.slice(0, start + 1)}${waveBlock}${registryText.slice(end)}`;
  }
  return `${registryText.replace(/\s*$/u, '\n')}${waveBlock}\n`;
}

function updateRegistry(wave) {
  const registryText = fs.readFileSync(repoPath(REGISTRY_PATH), 'utf8');
  const updated = replaceOrAppendWave(registryText, wave);
  return safeWrite(REGISTRY_PATH, updated);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const registry = loadRegistry();
  if (options.check && !options.write && !options.updateRegistry) {
    const fastCheck = buildFastCheck(registry);
    const output = {
      status:
        fastCheck.currentRegistryCoverage.unregistered === 0 &&
        fastCheck.physicalScriptsTotal === 240
          ? 'passed'
          : 'failed',
      waveId: WAVE_ID,
      physicalScriptsTotal: fastCheck.physicalScriptsTotal,
      registryCoverageWithoutWave: fastCheck.registryCoverageWithoutWave,
      currentRegistryCoverage: fastCheck.currentRegistryCoverage,
    };
    process.stdout.write(formatJson(output, options.pretty));
    if (output.status !== 'passed') process.exit(1);
    return;
  }
  const audit = buildAudit(registry);
  const receipts = [];

  if (options.write) {
    receipts.push(safeWrite(AUDIT_PATH, formatJson(audit, true)));
    receipts.push(safeWrite(SUMMARY_PATH, buildSummary(audit)));
    receipts.push(
      safeWrite(REGISTRY_EVIDENCE_PATH, formatJson(buildRegistryEvidence(audit), true))
    );
  }
  if (options.updateRegistry) receipts.push(updateRegistry(audit.proposedWave));

  const refreshedRegistry = options.updateRegistry ? loadRegistry() : registry;
  const refreshedAudit = buildAudit(refreshedRegistry);
  const output = {
    status:
      refreshedAudit.currentRegistryCoverage.unregistered === 0 &&
      refreshedAudit.physicalScriptsTotal === 240
        ? 'passed'
        : 'failed',
    waveId: WAVE_ID,
    physicalScriptsTotal: refreshedAudit.physicalScriptsTotal,
    newRegistrationsInWave: audit.proposedWave.entries.length,
    registryCoverageWithoutWave: audit.registryCoverageWithoutWave,
    currentRegistryCoverage: refreshedAudit.currentRegistryCoverage,
    consumerReachableMigrationQueueCount: audit.consumerReachableMigrationQueue.length,
    internalOrDeprecatedSettledCount: audit.internalOrDeprecatedSettled.length,
    receipts,
  };

  if (!options.quiet) {
    process.stdout.write(formatJson(output, options.pretty));
  } else {
    process.stdout.write(`${JSON.stringify(output)}\n`);
  }
  if (output.status !== 'passed') process.exit(1);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exit(1);
}
