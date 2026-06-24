#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const sourceRoot = path.join(packageRoot, 'src', 'main-agent');
const distRoot = path.join(packageRoot, 'dist', 'main-agent');
const packageSourceRoot = path.join(packageRoot, 'src');
const packageDistRoot = path.join(packageRoot, 'dist');
const packageBmadRoot = path.join(packageRoot, '_bmad');
const excludedRuntimeFiles = new Set([]);
const sourceAuthorityRoot = path.join(sourceRoot, 'source-authority');
const governanceUserStoryMappingFixtureModuleParts = [
  'scripts',
  'ensure-governance-user-story-mapping-fixture.js',
];
const { ensureGovernanceUserStoryMappingFixture } = require(path.join(
  repoRoot,
  ...governanceUserStoryMappingFixtureModuleParts
));
const packageRuntimeTypeScriptCompilerOptions = {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
  esModuleInterop: true,
  sourceMap: false,
  inlineSourceMap: false,
  inlineSources: false,
};
const sourceAuthorityTypeScriptCompilerOptions = {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
  esModuleInterop: true,
  sourceMap: false,
  inlineSourceMap: false,
  inlineSources: false,
};
const sourceAuthorityWorkspaceRuntimePackages = new Set([
  'ralph-method',
  'runtime-context',
  'scoring',
]);

function isTypeScriptFamilyFile(relativePath) {
  return /\.(?:ts|tsx|cts|mts)$/u.test(relativePath.replace(/\\/g, '/'));
}

function isTypeScriptDeclarationFile(relativePath) {
  return /\.d\.(?:ts|cts|mts)$/u.test(relativePath.replace(/\\/g, '/'));
}

function isTypeScriptRuntimeFile(relativePath) {
  return isTypeScriptFamilyFile(relativePath) && !isTypeScriptDeclarationFile(relativePath);
}

function sourceAuthorityTypeScriptRuntimeDistRelativePath(relativePath) {
  if (relativePath === 'source-authority/scripts/deferred-gap-governance-d-cts-source.ts') {
    return 'source-authority/scripts/deferred-gap-governance.d.cts.js';
  }
  if (/\.source\.(?:ts|tsx)$/u.test(relativePath)) {
    return relativePath.replace(/\.source\.(?:ts|tsx)$/u, '.js');
  }
  if (/\.(?:ts|tsx)$/u.test(relativePath)) return relativePath.replace(/\.(?:ts|tsx)$/u, '.js');
  if (/\.cts$/u.test(relativePath)) return relativePath.replace(/\.cts$/u, '.cjs');
  if (/\.mts$/u.test(relativePath)) return relativePath.replace(/\.mts$/u, '.mjs');
  throw new Error(`unsupported source-authority TypeScript runtime file: ${relativePath}`);
}

function hasAdjacentSourceAuthorityTypeScript(relativePath, base = sourceRoot) {
  if (!relativePath.startsWith('source-authority/') || !relativePath.endsWith('.js')) return false;
  const withoutExtension = relativePath.replace(/\.js$/u, '');
  return ['.ts', '.tsx'].some((extension) =>
    fs.existsSync(path.join(base, `${withoutExtension}${extension}`))
  );
}

function collectRuntimeFiles(dir = sourceRoot, base = sourceRoot) {
  const collected = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collected.push(...collectRuntimeFiles(fullPath, base));
      continue;
    }
    const relativePath = path.relative(base, fullPath).replace(/\\/g, '/');
    const isSourceAuthorityFile = relativePath.startsWith('source-authority/');
    const isSourceAuthorityDeclarationFile =
      isSourceAuthorityFile && isTypeScriptDeclarationFile(relativePath);
    const allowedRuntimeExtension = isSourceAuthorityFile
      ? /\.(?:cjs|mjs|py|ps1|sh|md)$/u
      : /\.cjs$/u;
    if (!entry.isFile() || (!allowedRuntimeExtension.test(entry.name) && !isSourceAuthorityDeclarationFile)) {
      continue;
    }
    if (excludedRuntimeFiles.has(relativePath)) continue;
    if (hasAdjacentSourceAuthorityTypeScript(relativePath, base)) continue;
    collected.push(relativePath);
  }
  return collected.sort();
}

function collectPackageTypeScriptFiles(dir = packageSourceRoot, base = packageSourceRoot) {
  if (!fs.existsSync(dir)) return [];
  const collected = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collected.push(...collectPackageTypeScriptFiles(fullPath, base));
      continue;
    }
    if (!entry.isFile() || !isTypeScriptRuntimeFile(entry.name)) continue;
    const relativePath = path.relative(base, fullPath).replace(/\\/g, '/');
    if (relativePath.startsWith('main-agent/source-authority/')) continue;
    collected.push(relativePath);
  }
  return collected.sort();
}

function assertWorkspaceRuntimeTargetExists(packageName, runtimeSubpath, request, relativePath) {
  const candidate = path.join(repoRoot, 'packages', packageName, 'dist', ...runtimeSubpath.split('/'));
  const candidates = [
    candidate,
    `${candidate}.js`,
    path.join(candidate, 'index.js'),
  ];
  if (candidates.some((runtimeTarget) => fs.existsSync(runtimeTarget))) return;
  throw new Error(
    [
      `source-authority runtime import has no built JS target: ${request}`,
      `source-authority file: ${relativePath}`,
      `expected package dist target under: packages/${packageName}/dist/${runtimeSubpath}`,
      `build the workspace package before build:main-agent-dist`,
    ].join('\n')
  );
}

function rewriteWorkspaceRuntimeRequest(request, relativePath) {
  const normalizedRequest = request.replace(/\\/g, '/');
  const match = normalizedRequest.match(/^((?:\.\.\/)+packages\/)([^/]+)(?:\/(.+))?$/u);
  if (!match) return request;
  const [, prefix, packageName, rawSubpath = ''] = match;
  if (!sourceAuthorityWorkspaceRuntimePackages.has(packageName)) return request;
  if (!rawSubpath) return request;

  let runtimeSubpath = rawSubpath;
  if (packageName === 'runtime-context' || packageName === 'ralph-method') {
    if (!runtimeSubpath.startsWith('src/')) return request;
    runtimeSubpath = runtimeSubpath.slice('src/'.length);
  }

  assertWorkspaceRuntimeTargetExists(packageName, runtimeSubpath, request, relativePath);
  return `${prefix}${packageName}/dist/${runtimeSubpath}`;
}

function rewriteSourceAuthorityRuntimeImports(text, relativePath) {
  return text
    .replace(/(require\(\s*['"])([^'"]+)(['"]\s*\))/gu, (match, start, request, end) => {
      const rewritten = rewriteWorkspaceRuntimeRequest(request, relativePath);
      return `${start}${rewritten}${end}`;
    })
    .replace(/(from\s+['"])([^'"]+)(['"])/gu, (match, start, request, end) => {
      const rewritten = rewriteWorkspaceRuntimeRequest(request, relativePath);
      return `${start}${rewritten}${end}`;
    });
}

function collectSourceAuthorityTypeScriptFiles(dir = sourceAuthorityRoot, base = sourceRoot) {
  if (!fs.existsSync(dir)) return [];
  const collected = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collected.push(...collectSourceAuthorityTypeScriptFiles(fullPath, base));
      continue;
    }
    if (!entry.isFile() || !isTypeScriptRuntimeFile(entry.name)) continue;
    collected.push(path.relative(base, fullPath).replace(/\\/g, '/'));
  }
  return collected.sort();
}

function collectSourceAuthorityTypeScriptDeclarationFiles(dir = sourceAuthorityRoot, base = sourceRoot) {
  if (!fs.existsSync(dir)) return [];
  const collected = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collected.push(...collectSourceAuthorityTypeScriptDeclarationFiles(fullPath, base));
      continue;
    }
    if (!entry.isFile() || !isTypeScriptDeclarationFile(entry.name)) continue;
    collected.push(path.relative(base, fullPath).replace(/\\/g, '/'));
  }
  return collected.sort();
}

const staticFiles = [];
const files = Array.from(new Set([...staticFiles, ...collectRuntimeFiles()]));
const packageRuntimeTypeScriptFiles = collectPackageTypeScriptFiles();
const sourceAuthorityTypeScriptFiles = collectSourceAuthorityTypeScriptFiles();
const sourceAuthorityTypeScriptDeclarationFiles = collectSourceAuthorityTypeScriptDeclarationFiles();
const packageFiles = [];
const runtimeAssetDirectories = [
  '_bmad/_schemas',
  '_bmad/runtime/hooks',
  '_bmad/shared/contract-execution-manifest',
  '_bmad/shared/critical-auditor-profile',
  '_bmad/core/agents/code-reviewer',
  '_bmad/core/skills/bmad-party-mode',
];
const sourceAuthorityAssetDirectories = [
  '.specify',
  '_bmad',
  'packages/bmad-speckit/bin',
  'packages/bmad-speckit/src',
  'packages/ralph-method',
  'packages/runtime-context',
  'packages/runtime-emit',
  'packages/schema',
  'packages/scoring',
  'tests/fixtures/goal-contract-release-gate',
  'templates/consumer-mcp',
];
const sourceAuthorityAssetFiles = [
  'package.json',
  'packages/bmad-speckit/package.json',
  '_bmad-output/runtime/requirement-records/index.json',
  '_bmad-output/runtime/requirement-records/REQ-CI-GOVERNANCE-MAPPING-FIXTURE/requirement-record.json',
];

function copyRuntimeFile(relativePath) {
  const source = path.join(sourceRoot, relativePath);
  const target = path.join(distRoot, relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`main-agent source file missing: ${relativePath}`);
  }
  let text = fs.readFileSync(source, 'utf8');
  if (/scripts[\\/]main-agent-orchestration\.ts/.test(text)) {
    throw new Error(`main-agent dist source references root orchestration script: ${relativePath}`);
  }
  if (/compiled[\\/]main-agent-orchestration\.cjs/.test(text)) {
    throw new Error(`covered main-agent source references compiled fallback: ${relativePath}`);
  }
  if (relativePath.startsWith('source-authority/')) {
    text = rewriteSourceAuthorityRuntimeImports(text, relativePath);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text, 'utf8');
}

if (fs.existsSync(packageDistRoot)) {
  fs.rmSync(packageDistRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

for (const file of files) copyRuntimeFile(file);

function packageRuntimeTypeScriptDistRelativePath(relativePath) {
  if (/\.(?:ts|tsx)$/u.test(relativePath)) return relativePath.replace(/\.(?:ts|tsx)$/u, '.js');
  if (/\.cts$/u.test(relativePath)) return relativePath.replace(/\.cts$/u, '.cjs');
  if (/\.mts$/u.test(relativePath)) return relativePath.replace(/\.mts$/u, '.mjs');
  throw new Error(`unsupported package runtime TypeScript runtime file: ${relativePath}`);
}

function compilePackageRuntimeTypeScriptFile(relativePath, targetRoot = packageDistRoot) {
  const source = path.join(packageSourceRoot, relativePath);
  const distRelativePath = packageRuntimeTypeScriptDistRelativePath(relativePath);
  const target = path.join(targetRoot, distRelativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`package runtime TypeScript source file missing: ${relativePath}`);
  }
  const adjacentJavaScriptSource = source.replace(/\.(?:ts|tsx)$/u, '.js');
  if (fs.existsSync(adjacentJavaScriptSource)) {
    throw new Error(`package runtime TypeScript source has forbidden source JS twin: ${relativePath}`);
  }
  const text = fs.readFileSync(source, 'utf8');
  const result = ts.transpileModule(text, {
    compilerOptions: packageRuntimeTypeScriptCompilerOptions,
    fileName: source,
    reportDiagnostics: true,
  });
  const diagnostics = result.diagnostics || [];
  const blockingDiagnostics = diagnostics.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
  if (blockingDiagnostics.length > 0) {
    const messages = blockingDiagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    throw new Error(`failed to compile package runtime TypeScript ${relativePath}: ${messages.join('; ')}`);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, result.outputText, 'utf8');
}

for (const file of packageRuntimeTypeScriptFiles) compilePackageRuntimeTypeScriptFile(file);

function compileSourceAuthorityTypeScriptFile(relativePath) {
  const source = path.join(sourceRoot, relativePath);
  const distRelativePath = sourceAuthorityTypeScriptRuntimeDistRelativePath(relativePath);
  const target = path.join(distRoot, distRelativePath);
  const text = fs.readFileSync(source, 'utf8');
  const result = ts.transpileModule(text, {
    compilerOptions: sourceAuthorityTypeScriptCompilerOptions,
    fileName: source,
    reportDiagnostics: true,
  });
  const diagnostics = result.diagnostics || [];
  const blockingDiagnostics = diagnostics.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
  if (blockingDiagnostics.length > 0) {
    const messages = blockingDiagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    throw new Error(`failed to compile source-authority TypeScript ${relativePath}: ${messages.join('; ')}`);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const rewrittenOutput = rewriteSourceAuthorityRuntimeImports(
    result.outputText,
    distRelativePath
  );
  fs.writeFileSync(target, rewrittenOutput, 'utf8');
}

function copyPackageFile(relativePath) {
  const source = path.join(packageSourceRoot, relativePath);
  const target = path.join(packageDistRoot, relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`package source file missing: ${relativePath}`);
  }
  const text = fs.readFileSync(source, 'utf8');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text, 'utf8');
}

for (const file of packageFiles) copyPackageFile(file);

function assertInsidePackageBmad(target) {
  const resolvedTarget = path.resolve(target);
  const resolvedBmadRoot = path.resolve(packageBmadRoot);
  if (resolvedTarget !== resolvedBmadRoot && !resolvedTarget.startsWith(`${resolvedBmadRoot}${path.sep}`)) {
    throw new Error(`refusing to modify path outside package _bmad: ${target}`);
  }
}

function copyDirectoryContents(source, target) {
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
    throw new Error(`runtime asset directory missing: ${path.relative(repoRoot, source).replace(/\\/g, '/')}`);
  }
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryContents(sourcePath, targetPath);
      continue;
    }
    if (!entry.isFile()) continue;
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  }
}

function copyRuntimeAssetDirectory(relativePath) {
  const source = path.join(repoRoot, relativePath);
  const target = path.join(packageRoot, relativePath);
  assertInsidePackageBmad(target);
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
  copyDirectoryContents(source, target);
}

for (const directory of runtimeAssetDirectories) copyRuntimeAssetDirectory(directory);
function sanitizeSourceAuthorityPackageJson(source) {
  const pkg = JSON.parse(fs.readFileSync(source, 'utf8'));
  delete pkg.scripts;
  delete pkg.bin;
  delete pkg.devDependencies;
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    if (!pkg[field]) continue;
    delete pkg[field].tsx;
    delete pkg[field]['ts-node'];
  }
  return `${JSON.stringify(scrubSourceAuthorityPackageJsonFallbackTokens(pkg), null, 2)}\n`;
}

function scrubSourceAuthorityPackageJsonFallbackTokens(value) {
  if (typeof value === 'string') {
    return value
      .replace(/\bts-node\b/giu, 'prebuilt JavaScript runtime')
      .replace(/\btsx\b/giu, 'prebuilt JavaScript runtime');
  }
  if (Array.isArray(value)) {
    return value.map((item) => scrubSourceAuthorityPackageJsonFallbackTokens(item));
  }
  if (value && typeof value === 'object') {
    const scrubbed = {};
    for (const [key, item] of Object.entries(value)) {
      if (/\b(?:tsx|ts-node)\b/iu.test(key)) continue;
      scrubbed[key] = scrubSourceAuthorityPackageJsonFallbackTokens(item);
    }
    return scrubbed;
  }
  return value;
}

function copySourceAuthorityDirectoryContents(source, target) {
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
    throw new Error(`runtime asset directory missing: ${path.relative(repoRoot, source).replace(/\\/g, '/')}`);
  }
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copySourceAuthorityDirectoryContents(sourcePath, targetPath);
      continue;
    }
    if (!entry.isFile()) continue;
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    if (entry.name === 'package.json') {
      fs.writeFileSync(targetPath, sanitizeSourceAuthorityPackageJson(sourcePath), 'utf8');
      continue;
    }
    fs.copyFileSync(sourcePath, targetPath);
  }
}

function copySourceAuthorityAssetDirectory(relativePath) {
  const source = path.join(repoRoot, relativePath);
  const target = path.join(distRoot, 'source-authority', relativePath);
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
  copySourceAuthorityDirectoryContents(source, target);
}

for (const directory of sourceAuthorityAssetDirectories) copySourceAuthorityAssetDirectory(directory);
ensureGovernanceUserStoryMappingFixture({ root: repoRoot, force: false, log: null });
function copySourceAuthorityAssetFile(relativePath) {
  const source = path.join(repoRoot, relativePath);
  const target = path.join(distRoot, 'source-authority', relativePath);
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
    throw new Error(`source-authority asset file missing: ${relativePath}`);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (path.basename(relativePath) === 'package.json') {
    fs.writeFileSync(target, sanitizeSourceAuthorityPackageJson(source), 'utf8');
    return;
  }
  fs.copyFileSync(source, target);
}

for (const file of sourceAuthorityAssetFiles) copySourceAuthorityAssetFile(file);
for (const file of packageRuntimeTypeScriptFiles) {
  compilePackageRuntimeTypeScriptFile(
    file,
    path.join(distRoot, 'source-authority', 'packages', 'bmad-speckit', 'src')
  );
}
for (const file of sourceAuthorityTypeScriptFiles) compileSourceAuthorityTypeScriptFile(file);
process.stdout.write(
  `built dist/main-agent files=${files.length} packageTsRuntime=${packageRuntimeTypeScriptFiles.length} sourceAuthorityTsRuntime=${sourceAuthorityTypeScriptFiles.length} sourceAuthorityTsDeclarations=${sourceAuthorityTypeScriptDeclarationFiles.length} package files=${packageFiles.length} runtime asset dirs=${runtimeAssetDirectories.length} sourceAuthority asset dirs=${sourceAuthorityAssetDirectories.length} sourceAuthority asset files=${sourceAuthorityAssetFiles.length}\n`
);
