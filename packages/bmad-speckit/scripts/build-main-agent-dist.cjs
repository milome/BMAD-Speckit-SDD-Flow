#!/usr/bin/env node
'use strict';

const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const packageSourceRoot = path.join(packageRoot, 'src');
const sourceRoot = path.join(packageSourceRoot, 'main-agent');
const sourceAuthorityRoot = path.join(sourceRoot, 'source-authority');
const packageDistRoot = path.join(packageRoot, 'dist');
const distRoot = path.join(packageDistRoot, 'main-agent');
const repoBmadRoot = path.join(repoRoot, '_bmad');
const packageBmadRoot = path.join(packageRoot, '_bmad');
const runtimeManifestPath = path.join(distRoot, 'runtime-asset-manifest.json');
const runtimeBuildAuthorityReceiptPath = path.join(
  distRoot,
  'runtime-build-authority-receipt.json'
);
const runtimeManifestEntries = [];

const compilerOptions = {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
  esModuleInterop: true,
  sourceMap: false,
  inlineSourceMap: false,
  inlineSources: false,
};

const sourceAuthorityRuntimeRoots = [
  path.join(sourceAuthorityRoot, 'rules'),
  path.join(sourceAuthorityRoot, 'scripts'),
];
const packageBmadRequiredFiles = [
  '_schemas/requirement-record.schema.json',
  'runtime/hooks/deferred-gap-governance.cjs',
  'shared/contract-execution-manifest/build-contract-execution-manifest.js',
  'shared/critical-auditor-profile/load-critical-auditor-profile.js',
  'shared/goal-contract/goal-contract-profile.json',
  'shared/requirements-contract/markdown-source-parser.js',
  'skills/requirements-contract-authoring/SKILL.md',
  'skills/requirements-contract-authoring/scripts/pre_render_must_decomposition_gate.js',
  'core/agents/code-reviewer/base-prompt.md',
  'core/skills/bmad-party-mode/workflow.md',
];
const sourceAuthorityStaticRuntimeExtensions = new Set(['.cjs', '.mjs']);
const sourceAuthorityTypeOnlyFiles = new Set([
  'source-authority/scripts/governance-hook-types.ts',
  'source-authority/scripts/i18n/field-meta-types.ts',
]);
const forbiddenDistPrefixes = [
  'dist/_bmad/',
  'dist/main-agent/source-authority/_bmad/',
  'dist/main-agent/source-authority/_bmad-output/',
  'dist/main-agent/source-authority/.specify/',
  'dist/main-agent/source-authority/docs/',
  'dist/main-agent/source-authority/tests/',
  'dist/main-agent/source-authority/packages/',
];
const requirementsContractSurfaceRoots = [
  path.join(repoRoot, '_bmad', 'shared', 'requirements-contract'),
  path.join(repoRoot, '.codex', 'shared', 'requirements-contract'),
  path.join(repoRoot, '.cursor', 'shared', 'requirements-contract'),
  path.join(repoRoot, '.claude', 'shared', 'requirements-contract'),
  path.join(packageRoot, '_bmad', 'shared', 'requirements-contract'),
];

function portable(value) {
  return value.replace(/\\/g, '/');
}

function sha256File(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function filesEqual(left, right) {
  return fs.existsSync(left) && fs.existsSync(right) && sha256File(left) === sha256File(right);
}

function copyFile(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function repositoryBmadSourceFiles() {
  const result = spawnSync(
    'git',
    [
      'ls-files',
      '-z',
      '--cached',
      '--others',
      '--exclude-standard',
      '--',
      '_bmad',
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
    }
  );
  if (result.error || result.status !== 0) return null;
  const prefix = '_bmad/';
  const files = [
    ...new Set(
      (result.stdout ?? '')
        .split('\0')
        .map(portable)
        .filter((entry) => entry.startsWith(prefix))
        .map((entry) => entry.slice(prefix.length))
        .filter((entry) => {
          const source = path.join(repoBmadRoot, entry);
          return fs.existsSync(source) && fs.lstatSync(source).isFile();
        })
    ),
  ].sort();
  if (files.length === 0) {
    throw new Error('repository _bmad source set is empty');
  }
  return files;
}

function ensurePackageBmadOwner() {
  if (!fs.existsSync(repoBmadRoot) || !fs.statSync(repoBmadRoot).isDirectory()) {
    throw new Error(`repository _bmad owner missing: ${repoBmadRoot}`);
  }
  if (path.dirname(path.resolve(packageBmadRoot)) !== path.resolve(packageRoot)) {
    throw new Error(`refusing to replace package _bmad outside package root: ${packageBmadRoot}`);
  }
  removeTree(packageBmadRoot);
  const sourceFiles = repositoryBmadSourceFiles();
  if (sourceFiles === null) {
    fs.cpSync(repoBmadRoot, packageBmadRoot, { recursive: true, force: true });
  } else {
    fs.mkdirSync(packageBmadRoot, { recursive: true });
    for (const relativePath of sourceFiles) {
      const source = path.join(repoBmadRoot, relativePath);
      const target = path.join(packageBmadRoot, relativePath);
      copyFile(source, target);
      fs.chmodSync(target, fs.statSync(source).mode);
    }
  }
  for (const relativePath of packageBmadRequiredFiles) {
    const source = path.join(repoBmadRoot, relativePath);
    const target = path.join(packageBmadRoot, relativePath);
    if (!fs.existsSync(source)) {
      throw new Error(`required repository _bmad asset missing: ${portable(relativePath)}`);
    }
    if (!filesEqual(source, target)) {
      throw new Error(`package _bmad mirror mismatch: ${portable(relativePath)}`);
    }
  }
  if (!fs.statSync(packageBmadRoot).isDirectory()) {
    throw new Error(`package _bmad owner is not a directory: ${packageBmadRoot}`);
  }
}

function removeTree(target) {
  if (!fs.existsSync(target)) return;
  fs.rmSync(target, {
    recursive: true,
    force: true,
    maxRetries: 20,
    retryDelay: 100,
  });
}

function runSourceAuthorityTemplateLint() {
  const tsxCliPath = path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const lintScriptPath = path.join(
    sourceAuthorityRoot,
    'scripts',
    'lint-requirements-contract-source-template.ts'
  );
  const result = spawnSync(process.execPath, [tsxCliPath, lintScriptPath, '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 5 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      ['source-authority requirements contract source PRD template lint failed', result.stdout, result.stderr]
        .filter(Boolean)
        .join('\n')
    );
  }
}

function isTypeScriptRuntimeFile(relativePath) {
  return /\.(?:ts|tsx|cts|mts)$/u.test(relativePath) && !/\.d\.(?:ts|cts|mts)$/u.test(relativePath);
}

function collectFiles(root, predicate, base = root) {
  if (!fs.existsSync(root)) return [];
  const collected = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      collected.push(...collectFiles(fullPath, predicate, base));
      continue;
    }
    if (!entry.isFile()) continue;
    const relativePath = portable(path.relative(base, fullPath));
    if (predicate(relativePath, fullPath)) collected.push(relativePath);
  }
  return collected.sort();
}

function collectPackageTypeScriptFiles() {
  return collectFiles(
    packageSourceRoot,
    (relativePath) =>
      isTypeScriptRuntimeFile(relativePath) &&
      !relativePath.startsWith('main-agent/source-authority/'),
    packageSourceRoot
  );
}

function collectSourceAuthorityTypeScriptFiles() {
  return sourceAuthorityRuntimeRoots.flatMap((root) =>
    collectFiles(
      root,
      (relativePath) =>
        isTypeScriptRuntimeFile(relativePath) && !sourceAuthorityTypeOnlyFiles.has(relativePath),
      sourceRoot
    )
  ).sort();
}

function collectStaticRuntimeFiles() {
  const mainAgentStatic = collectFiles(
    sourceRoot,
    (relativePath) =>
      !relativePath.startsWith('source-authority/') &&
      sourceAuthorityStaticRuntimeExtensions.has(path.extname(relativePath)),
    sourceRoot
  );
  const sourceAuthorityStatic = sourceAuthorityRuntimeRoots.flatMap((root) =>
    collectFiles(
      root,
      (relativePath) => sourceAuthorityStaticRuntimeExtensions.has(path.extname(relativePath)),
      sourceRoot
    )
  );
  return [...new Set([...mainAgentStatic, ...sourceAuthorityStatic])].sort();
}

function packageRuntimeDistRelativePath(relativePath) {
  if (/\.(?:ts|tsx)$/u.test(relativePath)) return relativePath.replace(/\.(?:ts|tsx)$/u, '.js');
  if (/\.cts$/u.test(relativePath)) return relativePath.replace(/\.cts$/u, '.cjs');
  if (/\.mts$/u.test(relativePath)) return relativePath.replace(/\.mts$/u, '.mjs');
  throw new Error(`unsupported TypeScript runtime file: ${relativePath}`);
}

function sourceAuthorityDistRelativePath(relativePath) {
  if (relativePath === 'source-authority/scripts/deferred-gap-governance-d-cts-source.ts') {
    return 'source-authority/scripts/deferred-gap-governance.d.cts.js';
  }
  if (/\.source\.(?:ts|tsx)$/u.test(relativePath)) {
    return relativePath.replace(/\.source\.(?:ts|tsx)$/u, '.js');
  }
  return packageRuntimeDistRelativePath(relativePath);
}

function assertRuntimeTargetExists(target, request, relativePath) {
  const candidates = [target, `${target}.js`, `${target}.cjs`, path.join(target, 'index.js')];
  if (candidates.some((candidate) => fs.existsSync(candidate))) return;
  throw new Error(
    `runtime import target missing for ${request} in ${relativePath}: ${portable(target)}`
  );
}

function packageSpecifierForWorkspaceRequest(packageName, rawSubpath, request, relativePath) {
  let subpath = rawSubpath;
  if (packageName === 'runtime-context' || packageName === 'ralph-method') {
    if (!subpath.startsWith('src/')) return request;
    subpath = subpath.slice('src/'.length);
  }
  const target = path.join(repoRoot, 'packages', packageName, 'dist', ...subpath.split('/'));
  assertRuntimeTargetExists(target, request, relativePath);
  return `@bmad-speckit/${packageName}/${subpath}`.replace(/\/index$/u, '');
}

function rewriteWorkspaceRuntimeRequest(request, relativePath) {
  const normalized = portable(request);
  const match = normalized.match(/^(?:\.\.\/)+packages\/([^/]+)\/(.+)$/u);
  if (!match) return request;
  const [, packageName, rawSubpath] = match;

  if (packageName === 'bmad-speckit') {
    if (!rawSubpath.startsWith('src/')) return request;
    const sourceRelativePath = rawSubpath.slice('src/'.length).replace(/\.ts$/u, '');
    const target = path.join(packageDistRoot, sourceRelativePath);
    assertRuntimeTargetExists(target, request, relativePath);
    const currentFileDir = path.dirname(path.join(distRoot, relativePath));
    const rewritten = portable(path.relative(currentFileDir, target));
    return rewritten.startsWith('.') ? rewritten : `./${rewritten}`;
  }

  if (!['ralph-method', 'runtime-context', 'scoring'].includes(packageName)) return request;
  return packageSpecifierForWorkspaceRequest(packageName, rawSubpath, request, relativePath);
}

function rewriteRepoRootRuntimeAssetRequest(request, relativePath) {
  const normalized = portable(request);
  const match = normalized.match(/^(?:\.\.\/)+_bmad\/(.+)$/u);
  if (!match) return request;
  const target = path.join(packageBmadRoot, ...match[1].split('/'));
  assertRuntimeTargetExists(target, request, relativePath);
  const currentFileDir = path.dirname(path.join(distRoot, relativePath));
  const rewritten = portable(path.relative(currentFileDir, target));
  return rewritten.startsWith('.') ? rewritten : `./${rewritten}`;
}

function rewriteSourceAuthorityRuntimeImports(text, relativePath) {
  const rewrite = (request) =>
    rewriteRepoRootRuntimeAssetRequest(
      rewriteWorkspaceRuntimeRequest(request, relativePath),
      relativePath
    );
  return text
    .replace(/(require\(\s*['"])([^'"]+)(['"]\s*\))/gu, (_match, start, request, end) =>
      `${start}${rewrite(request)}${end}`
    )
    .replace(/(from\s+['"])([^'"]+)(['"])/gu, (_match, start, request, end) =>
      `${start}${rewrite(request)}${end}`
    );
}

function registerOutput({ source, target, purpose, consumer }) {
  runtimeManifestEntries.push({
    source: portable(path.relative(packageRoot, source)),
    target: portable(path.relative(packageRoot, target)),
    purpose,
    consumer,
  });
}

function compileTypeScriptFile({ source, target, relativePath, rewrite, purpose, consumer }) {
  const result = ts.transpileModule(fs.readFileSync(source, 'utf8'), {
    compilerOptions,
    fileName: source,
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics || []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error
  );
  if (errors.length > 0) {
    throw new Error(
      `failed to compile ${relativePath}: ${errors
        .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
        .join('; ')}`
    );
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, rewrite ? rewrite(result.outputText) : result.outputText, 'utf8');
  registerOutput({ source, target, purpose, consumer });
}

function copyStaticRuntimeFile(relativePath) {
  const source = path.join(sourceRoot, relativePath);
  const target = path.join(distRoot, relativePath);
  let text = fs.readFileSync(source, 'utf8');
  if (relativePath.startsWith('source-authority/')) {
    text = rewriteSourceAuthorityRuntimeImports(text, relativePath);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text, 'utf8');
  registerOutput({
    source,
    target,
    purpose: 'prebuilt-runtime-module',
    consumer: relativePath.startsWith('source-authority/')
      ? 'main-agent-source-authority'
      : 'main-agent-runtime',
  });
}

function sourceAuthorityAssetManifest() {
  const schemaRoot = path.join(sourceAuthorityRoot, 'schemas');
  const schemas = fs.readdirSync(schemaRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => ({
      source: path.join(schemaRoot, entry.name),
      target: path.join(distRoot, 'source-authority', 'schemas', entry.name),
      purpose: 'runtime-validation-schema',
      consumer: 'source-authority-validator',
    }));
  const templates = [
    'requirements-contract-source-prd-template.md',
    'requirements-contract-source-prd-template.schema.json',
  ].map((name) => ({
    source: path.join(sourceAuthorityRoot, 'templates', name),
    target: path.join(distRoot, 'source-authority', 'templates', name),
    purpose: 'requirements-contract-source-template',
    consumer: 'requirements-contract-template-lint',
  }));
  return [...schemas, ...templates].sort((left, right) =>
    portable(left.target).localeCompare(portable(right.target))
  );
}

function copyDeclaredAsset(asset) {
  if (!fs.existsSync(asset.source) || !fs.statSync(asset.source).isFile()) {
    throw new Error(`declared runtime asset missing: ${portable(asset.source)}`);
  }
  copyFile(asset.source, asset.target);
  registerOutput(asset);
}

function writeRequirementsContractProjection(fileName, value) {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  for (const surfaceRoot of requirementsContractSurfaceRoots) {
    const target = path.join(surfaceRoot, fileName);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, serialized, 'utf8');
  }
}

function refreshRequirementsContractConsumerRegistry() {
  const fileName = 'requirements-contract-consumer-registry.json';
  const consumerRegistryModule = require(path.join(
    distRoot,
    'source-authority',
    'rules',
    'requirements-contract-consumer-registry.js'
  ));
  writeRequirementsContractProjection(
    fileName,
    consumerRegistryModule.createRequirementsContractConsumerRegistry(repoRoot)
  );
}

function refreshRequirementsContractArtifactRoleRegistry() {
  const classifier = require(path.join(
    distRoot,
    'source-authority',
    'scripts',
    'requirements-contract-artifact-role-classifier.js'
  ));
  const ownerPath = path.resolve(
    repoRoot,
    classifier.REQUIREMENTS_CONTRACT_ARTIFACT_ROLE_REGISTRY_OWNER_PATH
  );
  writeRequirementsContractProjection(
    'requirements-contract-artifact-role-registry.json',
    classifier.createRequirementsContractArtifactRoleRegistryProjection(
      `sha256:${sha256File(ownerPath)}`
    )
  );
}

function publishRequirementsContractDerivedRegistries() {
  const judgeProviderRegistryModule = require(path.join(
    distRoot,
    'source-authority',
    'scripts',
    'requirements-contract-judge-provider-registry.js'
  ));
  writeRequirementsContractProjection(
    'requirements-contract-judge-provider-registry.json',
    judgeProviderRegistryModule.createRequirementsContractJudgeProviderRegistryProjection(repoRoot)
  );
  refreshRequirementsContractArtifactRoleRegistry();
  refreshRequirementsContractConsumerRegistry();
  const projectionRegistryModule = require(path.join(
    distRoot,
    'source-authority',
    'rules',
    'requirements-contract-projection-registry.js'
  ));
  projectionRegistryModule.synchronizeRequirementsContractProjectionSurfaces(repoRoot);
  writeRequirementsContractProjection(
    'requirements-contract-projection-registry.json',
    projectionRegistryModule.createRequirementsContractProjectionRegistry(repoRoot)
  );
  const canonicalAssetsModule = require(path.join(
    distRoot,
    'source-authority',
    'rules',
    'requirements-contract-canonical-assets-manifest.js'
  ));
  writeRequirementsContractProjection(
    'requirements-contract-canonical-assets-manifest.json',
    canonicalAssetsModule.createRequirementsContractCanonicalAssetsManifest(repoRoot)
  );
}

function filesBelow(root, base = root) {
  return collectFiles(root, () => true, base);
}

function assertNoForbiddenDistPaths() {
  const packageFiles = filesBelow(packageDistRoot).map((relativePath) => `dist/${relativePath}`);
  const hits = packageFiles.filter((relativePath) =>
    forbiddenDistPrefixes.some((prefix) => relativePath.startsWith(prefix))
  );
  if (hits.length > 0) {
    throw new Error(`forbidden dist paths emitted:\n${hits.slice(0, 50).join('\n')}`);
  }
  return hits.length;
}

function writeRuntimeManifest() {
  registerOutput({
    source: __filename,
    target: runtimeManifestPath,
    purpose: 'runtime-output-manifest',
    consumer: 'dist-build-verifier',
  });
  registerOutput({
    source: __filename,
    target: runtimeBuildAuthorityReceiptPath,
    purpose: 'runtime-build-authority-receipt',
    consumer: 'release-parity-verifier',
  });
  runtimeManifestEntries.sort((left, right) => left.target.localeCompare(right.target));
  const hashDomains = require(path.join(
    distRoot,
    'source-authority',
    'scripts',
    'requirements-contract-hash-domains.js'
  ));
  const entries = runtimeManifestEntries.map((entry) => {
    const sourcePath = path.resolve(packageRoot, entry.source);
    const targetPath = path.resolve(packageRoot, entry.target);
    const sourceBytesHash = hashDomains.sourceBytesHash(fs.readFileSync(sourcePath));
    const targetExists = fs.existsSync(targetPath) && fs.statSync(targetPath).isFile();
    return {
      ...entry,
      sourceBytesHash,
      ...(targetExists
        ? {
            targetBytesHash: hashDomains.sourceBytesHash(fs.readFileSync(targetPath)),
            materialization: 'runtime_file',
          }
        : {
            targetBytesHash: null,
            materialization: 'build_metadata',
          }),
    };
  });
  fs.mkdirSync(path.dirname(runtimeManifestPath), { recursive: true });
  fs.writeFileSync(
    runtimeManifestPath,
    `${JSON.stringify(
      {
        schemaVersion: 'bmad-speckit-main-agent-runtime-assets/v2',
        hashDomainRegistry: hashDomains.requirementsContractHashDomainRegistry(),
        entries,
      },
      null,
      2
    )}\n`,
    'utf8'
  );
}

function writeRuntimeBuildAuthorityReceipt() {
  const authority = require(path.join(
    distRoot,
    'source-authority',
    'scripts',
    'requirements-contract-runtime-build-authority.js'
  ));
  const receipt = authority.createRuntimeBuildAuthorityReceipt({
    packageRoot,
    runtimeAssetManifestPath: runtimeManifestPath,
    buildScriptPath: __filename,
    dependencyLockPath: path.join(repoRoot, 'package-lock.json'),
  });
  fs.writeFileSync(
    runtimeBuildAuthorityReceiptPath,
    `${JSON.stringify(receipt, null, 2)}\n`,
    'utf8'
  );
  return receipt;
}

function assertManifestOwnsDist() {
  const actual = filesBelow(packageDistRoot).map((relativePath) => `dist/${relativePath}`).sort();
  const declared = runtimeManifestEntries.map((entry) => entry.target).sort();
  const undeclared = actual.filter((relativePath) => !declared.includes(relativePath));
  const missing = declared.filter((relativePath) => !actual.includes(relativePath));
  if (undeclared.length > 0 || missing.length > 0) {
    throw new Error(
      `runtime manifest mismatch undeclared=${undeclared.length} missing=${missing.length}\n` +
        [...undeclared.slice(0, 25), ...missing.slice(0, 25)].join('\n')
    );
  }
}

function duplicateHashGroupCount() {
  const groups = new Map();
  for (const relativePath of filesBelow(packageDistRoot)) {
    const filePath = path.join(packageDistRoot, relativePath);
    const hash = sha256File(filePath);
    const files = groups.get(hash) || [];
    files.push(relativePath);
    groups.set(hash, files);
  }
  return [...groups.values()].filter((files) => files.length > 1).length;
}

ensurePackageBmadOwner();
runSourceAuthorityTemplateLint();
removeTree(packageDistRoot);

const packageTypeScriptFiles = collectPackageTypeScriptFiles();
const sourceAuthorityTypeScriptFiles = collectSourceAuthorityTypeScriptFiles();
const staticRuntimeFiles = collectStaticRuntimeFiles();
const declaredAssets = sourceAuthorityAssetManifest();

for (const relativePath of packageTypeScriptFiles) {
  const source = path.join(packageSourceRoot, relativePath);
  const target = path.join(packageDistRoot, packageRuntimeDistRelativePath(relativePath));
  compileTypeScriptFile({
    source,
    target,
    relativePath,
    purpose: 'package-runtime-compiled-module',
    consumer: 'bmad-speckit-cli',
  });
}

for (const relativePath of staticRuntimeFiles) copyStaticRuntimeFile(relativePath);

for (const relativePath of sourceAuthorityTypeScriptFiles) {
  const source = path.join(sourceRoot, relativePath);
  const distRelativePath = sourceAuthorityDistRelativePath(relativePath);
  const target = path.join(distRoot, distRelativePath);
  compileTypeScriptFile({
    source,
    target,
    relativePath,
    rewrite: (output) => rewriteSourceAuthorityRuntimeImports(output, distRelativePath),
    purpose: 'source-authority-compiled-module',
    consumer: 'main-agent-source-authority',
  });
}

for (const asset of declaredAssets) copyDeclaredAsset(asset);

const actionBindingManifestModule = require(path.join(
  distRoot,
  'source-authority',
  'scripts',
  'requirements-contract-package-runtime-action-binding-manifest.js'
));
actionBindingManifestModule.publishPackageRuntimeActionBindingManifest(repoRoot);
publishRequirementsContractDerivedRegistries();
const bundledRuntimeSync = require(path.join(
  distRoot,
  'source-authority',
  'scripts',
  'requirements-contract-bundled-runtime-sync.js'
)).syncBundledWorkspaceRuntime({
  repoRoot,
  packageRoot,
});

writeRuntimeManifest();
const buildAuthorityReceipt = writeRuntimeBuildAuthorityReceipt();
const forbiddenPathHits = assertNoForbiddenDistPaths();
assertManifestOwnsDist();
const outputFiles = filesBelow(packageDistRoot).length;
const duplicateHashGroups = duplicateHashGroupCount();

process.stdout.write(
  `built main-agent dist outputFiles=${outputFiles} manifestFiles=${runtimeManifestEntries.length} ` +
  `forbiddenPathHits=${forbiddenPathHits} duplicateHashGroups=${duplicateHashGroups} ` +
    `packageTs=${packageTypeScriptFiles.length} sourceAuthorityTs=${sourceAuthorityTypeScriptFiles.length} ` +
    `staticRuntime=${staticRuntimeFiles.length} declaredAssets=${declaredAssets.length} ` +
    `bundledRuntimePackages=${bundledRuntimeSync.packageCount} ` +
    `bundledRuntimeFiles=${bundledRuntimeSync.fileCount} ` +
    `distBuildHash=${buildAuthorityReceipt.distBuildHash}\n`
);
