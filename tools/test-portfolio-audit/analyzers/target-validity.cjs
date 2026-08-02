'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const ts = require('typescript');
const yaml = require('js-yaml');

const { expandPackageScript, parseCommandChain, parseNpmRun } = require('../routes.cjs');
const { SOURCE_BINDING_FIELDS } = require('./criticality.cjs');

const ANALYZER_ID = 'target-validity';
const ANALYZER_VERSION = '1';
const DIMENSION = 'targetValidity';
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs'];
const TARGET_EXTENSIONS = new Set([
  ...SOURCE_EXTENSIONS,
  '.csv',
  '.html',
  '.json',
  '.md',
  '.mdc',
  '.ps1',
  '.sh',
  '.toml',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
]);
const TARGET_BASENAMES = new Set(['.gitignore']);
const IGNORED_DIRECTORIES = new Set([
  '.artifacts',
  '.codex-tmp',
  '.git',
  '.tmp',
  '.worktrees',
  '_bmad-output',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'outputs',
]);
const GENERATED_HEADER_PATTERNS = [
  /^\s*\/\/\s*@generated\b/iu,
  /^\s*\/\*+\s*@generated\b/iu,
  /^\s*#\s*@generated\b/iu,
  /^\s*<!--\s*generated from:/iu,
  /^\s*(?:\/\/|\/\*+|#|<!--).*\bgenerated\b.*\bdo not edit\b/iu,
];
const FILE_PATH_SINKS = new Set([
  'accessSync',
  'copyFile',
  'copyFileSync',
  'cp',
  'cpSync',
  'existsSync',
  'fs.accessSync',
  'fs.copyFile',
  'fs.copyFileSync',
  'fs.cp',
  'fs.cpSync',
  'fs.existsSync',
  'fs.readFileSync',
  'fs.readdirSync',
  'fs.statSync',
  'readFileSync',
  'readdirSync',
  'statSync',
]);
const PROCESS_SINKS = new Set([
  'childProcess.execFileSync',
  'childProcess.spawnSync',
  'execFile',
  'execFileSync',
  'spawn',
  'spawnSync',
]);
const SHELL_COMMAND_SINKS = new Set([
  'childProcess.exec',
  'childProcess.execSync',
  'exec',
  'execSync',
]);
const CRITICAL_BINDING_FIELD_BY_KIND = new Map(
  SOURCE_BINDING_FIELDS.map(([fieldName, bindingKind]) => [bindingKind, fieldName])
);
const SUPPORTED_CRITICAL_RUNNERS = new Set(['node-test', 'root-vitest']);

function compareText(left, right) {
  return String(left).localeCompare(String(right), 'en');
}

function stableUnique(values) {
  return [...new Set(values.filter(Boolean).map(String))].sort(compareText);
}

function normalizePath(value) {
  return path.posix.normalize(String(value).replace(/\\/g, '/')).replace(/^\.\//, '');
}

function sourceRef(filePath, fragment) {
  return `source:${normalizePath(filePath)}#${fragment}`;
}

function isTargetFileName(name) {
  return TARGET_EXTENSIONS.has(path.extname(name).toLowerCase()) || TARGET_BASENAMES.has(name);
}

function listTargetFiles(repoRoot) {
  const files = [];

  function visit(directory) {
    const entries = fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => compareText(left.name, right.name));
    for (const entry of entries) {
      if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
      } else if (isTargetFileName(entry.name)) {
        files.push(normalizePath(path.relative(repoRoot, absolutePath)));
      }
    }
  }

  visit(repoRoot);
  return files.sort(compareText);
}

function scriptKind(filePath) {
  if (filePath.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (filePath.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (filePath.endsWith('.ts')) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

function hasGeneratedHeader(sourceText) {
  return sourceText
    .split(/\r?\n/u)
    .slice(0, 12)
    .some((line) => GENERATED_HEADER_PATTERNS.some((pattern) => pattern.test(line)));
}

function readFilePrefix(filePath, maximumBytes = 8192) {
  const descriptor = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.allocUnsafe(maximumBytes);
    const bytesRead = fs.readSync(descriptor, buffer, 0, maximumBytes, 0);
    return buffer.subarray(0, bytesRead).toString('utf8');
  } finally {
    fs.closeSync(descriptor);
  }
}

function parseNode(repoRoot, filePath) {
  const absolutePath = path.join(repoRoot, filePath);
  const isSource = SOURCE_EXTENSIONS.includes(path.extname(filePath).toLowerCase());
  const needsFullText =
    isSource ||
    /(?:^|\/)\.github\/workflows\/[^/]+\.ya?ml$/iu.test(filePath) ||
    /(?:registry|manifest)\.(?:json|ya?ml)$/iu.test(filePath);
  const sourceText = needsFullText
    ? fs.readFileSync(absolutePath, 'utf8')
    : readFilePrefix(absolutePath);
  const sourceFile = isSource
    ? ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, scriptKind(filePath))
    : undefined;
  return {
    path: filePath,
    sourceText,
    sourceFile,
    parseErrors: sourceFile ? sourceFile.parseDiagnostics.map((diagnostic) => diagnostic.code) : [],
    isTest:
      isSource &&
      (/(^|\/)(?:tests?|__tests__)\//u.test(filePath) ||
        /\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(filePath)),
    isGenerated: hasGeneratedHeader(sourceText),
  };
}

function resolveLocalTarget(fromPath, specifier, nodes) {
  if (typeof specifier !== 'string' || !specifier.startsWith('.')) return undefined;
  const base = normalizePath(path.posix.join(path.posix.dirname(fromPath), specifier));
  const candidates = SOURCE_EXTENSIONS.includes(path.posix.extname(base))
    ? [base]
    : [
        base,
        ...SOURCE_EXTENSIONS.map((extension) => `${base}${extension}`),
        ...SOURCE_EXTENSIONS.map((extension) => `${base}/index${extension}`),
      ];
  return candidates.find((candidate) => nodes.has(candidate));
}

function resolveGeneratedSourceTarget(fromPath, specifier, nodes) {
  if (typeof specifier !== 'string' || !specifier.startsWith('.')) return undefined;
  const generatedBase = normalizePath(path.posix.join(path.posix.dirname(fromPath), specifier));
  return generatedSourceCandidates(generatedBase).find((candidate) => nodes.has(candidate));
}

function generatedSourceCandidates(generatedBase) {
  if (!/(?:^|\/)dist(?:\/|$)/u.test(generatedBase)) return [];
  const sourceBase = generatedBase.replace(/(^|\/)dist(?=\/|$)/u, '$1src');
  const extension = path.posix.extname(sourceBase);
  const withoutRuntimeExtension = ['.js', '.cjs', '.mjs'].includes(extension)
    ? sourceBase.slice(0, -extension.length)
    : sourceBase;
  const candidates = [
    sourceBase,
    withoutRuntimeExtension,
    ...SOURCE_EXTENSIONS.map(
      (candidateExtension) => `${withoutRuntimeExtension}${candidateExtension}`
    ),
    ...SOURCE_EXTENSIONS.map(
      (candidateExtension) => `${withoutRuntimeExtension}/index${candidateExtension}`
    ),
  ];
  return stableUnique(candidates);
}

function literalModuleReference(astNode) {
  if (
    (ts.isImportDeclaration(astNode) || ts.isExportDeclaration(astNode)) &&
    astNode.moduleSpecifier &&
    ts.isStringLiteralLike(astNode.moduleSpecifier)
  ) {
    return {
      specifier: astNode.moduleSpecifier.text,
      fragment: ts.isExportDeclaration(astNode) ? 'export' : 'import',
    };
  }
  if (
    ts.isCallExpression(astNode) &&
    ts.isIdentifier(astNode.expression) &&
    astNode.expression.text === 'require' &&
    astNode.arguments.length === 1 &&
    ts.isStringLiteralLike(astNode.arguments[0])
  ) {
    return { specifier: astNode.arguments[0].text, fragment: 'require' };
  }
  if (
    ts.isCallExpression(astNode) &&
    astNode.expression.kind === ts.SyntaxKind.ImportKeyword &&
    astNode.arguments.length === 1 &&
    ts.isStringLiteralLike(astNode.arguments[0])
  ) {
    return { specifier: astNode.arguments[0].text, fragment: 'dynamic-import' };
  }
  return undefined;
}

function nodeReferencesTarget(node, targetPath, index) {
  if (!node?.sourceFile) return false;
  let referenced = false;
  function visit(astNode) {
    if (referenced) return;
    const reference = literalModuleReference(astNode);
    if (reference) {
      const resolved =
        resolveLocalTarget(node.path, reference.specifier, index.nodes) ||
        resolveGeneratedSourceTarget(node.path, reference.specifier, index.nodes);
      if (resolved === targetPath) {
        referenced = true;
        return;
      }
    }
    ts.forEachChild(astNode, visit);
  }
  visit(node.sourceFile);
  return referenced;
}

function addMapValue(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
  map.set(key, stableUnique(map.get(key)));
}

function addBindingMapValue(map, key, value) {
  const values = map.get(key) || [];
  const byKey = new Map(values.map((entry) => [`${entry.kind}\0${entry.evidenceRef}`, entry]));
  byKey.set(`${value.kind}\0${value.evidenceRef}`, value);
  map.set(
    key,
    [...byKey.values()].sort((left, right) =>
      compareText(`${left.kind}\0${left.evidenceRef}`, `${right.kind}\0${right.evidenceRef}`)
    )
  );
}

function addCriticalBindingIssue(index, issue) {
  const key = JSON.stringify(issue);
  if (!index.criticalBindingIssues.some((candidate) => JSON.stringify(candidate) === key)) {
    index.criticalBindingIssues.push(issue);
    index.criticalBindingIssues.sort((left, right) =>
      compareText(
        `${left.code}\0${left.packagePath || ''}\0${left.bindingId || ''}\0${
          left.scriptName || ''
        }\0${left.runnerId || ''}\0${left.testPath || ''}`,
        `${right.code}\0${right.packagePath || ''}\0${right.bindingId || ''}\0${
          right.scriptName || ''
        }\0${right.runnerId || ''}\0${right.testPath || ''}`
      )
    );
  }
}

function criticalBindingIssue(index, context, code, extra = {}) {
  addCriticalBindingIssue(index, {
    code,
    packagePath: context.packagePath,
    evidenceRef: context.evidenceRef,
    ...(context.bindingId ? { bindingId: context.bindingId } : {}),
    ...(context.scriptName ? { scriptName: context.scriptName } : {}),
    ...extra,
  });
}

function registerCriticalBindings({ repoRoot, packageJson, packagePath, auditConfig, index }) {
  if (!Object.prototype.hasOwnProperty.call(auditConfig, 'criticalBindings')) return;
  if (!Array.isArray(auditConfig.criticalBindings)) {
    criticalBindingIssue(
      index,
      {
        packagePath,
        evidenceRef: sourceRef(packagePath, 'testPortfolioAudit.criticalBindings'),
      },
      'CRITICAL_BINDINGS_INVALID'
    );
    return;
  }

  const bindingIds = new Set();
  for (const [bindingIndex, rawBinding] of auditConfig.criticalBindings.entries()) {
    const evidenceRef = sourceRef(
      packagePath,
      `testPortfolioAudit.criticalBindings[${bindingIndex}]`
    );
    if (!rawBinding || typeof rawBinding !== 'object' || Array.isArray(rawBinding)) {
      criticalBindingIssue(index, { packagePath, evidenceRef }, 'CRITICAL_BINDING_INVALID');
      continue;
    }

    const bindingId = typeof rawBinding.bindingId === 'string' ? rawBinding.bindingId.trim() : '';
    const scriptName =
      typeof rawBinding.scriptName === 'string' ? rawBinding.scriptName.trim() : '';
    const context = { packagePath, evidenceRef, bindingId, scriptName };
    let invalid = false;

    if (!bindingId) {
      criticalBindingIssue(index, context, 'CRITICAL_BINDING_ID_INVALID');
      invalid = true;
    } else if (bindingIds.has(bindingId)) {
      criticalBindingIssue(index, context, 'CRITICAL_BINDING_ID_DUPLICATE');
      invalid = true;
    } else {
      bindingIds.add(bindingId);
    }

    if (!Array.isArray(rawBinding.kinds) || rawBinding.kinds.length === 0) {
      criticalBindingIssue(index, context, 'CRITICAL_BINDING_KINDS_INVALID');
      invalid = true;
    }
    const kinds = Array.isArray(rawBinding.kinds)
      ? rawBinding.kinds
          .filter((kind) => typeof kind === 'string' && kind.trim() !== '')
          .map((kind) => kind.trim())
      : [];
    if (kinds.length !== new Set(kinds).size) {
      criticalBindingIssue(index, context, 'CRITICAL_BINDING_KIND_DUPLICATE');
      invalid = true;
    }
    for (const kind of stableUnique(kinds)) {
      if (!CRITICAL_BINDING_FIELD_BY_KIND.has(kind)) {
        criticalBindingIssue(index, context, 'CRITICAL_BINDING_KIND_UNSUPPORTED', {
          bindingKind: kind,
        });
        invalid = true;
      }
    }

    if (!scriptName) {
      criticalBindingIssue(index, context, 'CRITICAL_BINDING_SCRIPT_NAME_INVALID');
      invalid = true;
    } else if (typeof packageJson.scripts?.[scriptName] !== 'string') {
      criticalBindingIssue(index, context, 'CRITICAL_BINDING_SCRIPT_UNRESOLVED', {
        causeCode: 'PACKAGE_SCRIPT_UNKNOWN',
      });
      invalid = true;
    }
    if (invalid) continue;

    let expansion;
    try {
      expansion = expandPackageScript({ repoRoot, packagePath, scriptName });
    } catch (error) {
      criticalBindingIssue(index, context, 'CRITICAL_BINDING_SCRIPT_UNRESOLVED', {
        causeCode: error.code || 'PACKAGE_SCRIPT_EXPANSION_FAILED',
      });
      continue;
    }
    if (expansion.issues.length > 0) {
      for (const issue of expansion.issues) {
        criticalBindingIssue(index, context, 'CRITICAL_BINDING_SCRIPT_UNRESOLVED', {
          causeCode: issue.code,
        });
      }
      continue;
    }
    if (expansion.invocations.length === 0) {
      criticalBindingIssue(index, context, 'CRITICAL_BINDING_SCRIPT_UNRESOLVED', {
        causeCode: 'NO_TEST_INVOCATIONS',
      });
      continue;
    }

    const claims = [];
    for (const invocation of expansion.invocations) {
      if (!SUPPORTED_CRITICAL_RUNNERS.has(invocation.runnerId)) {
        criticalBindingIssue(index, context, 'CRITICAL_BINDING_RUNNER_UNSUPPORTED', {
          runnerId: invocation.runnerId,
        });
        invalid = true;
        continue;
      }
      if (
        !Array.isArray(invocation.explicitTestPaths) ||
        invocation.explicitTestPaths.length === 0
      ) {
        criticalBindingIssue(index, context, 'CRITICAL_BINDING_SCRIPT_NOT_EXPLICIT', {
          runnerId: invocation.runnerId,
        });
        invalid = true;
        continue;
      }
      for (const testPath of invocation.explicitTestPaths) {
        const normalizedTestPath = normalizePath(testPath);
        if (!index.nodes.get(normalizedTestPath)?.isTest) {
          criticalBindingIssue(index, context, 'CRITICAL_BINDING_TEST_UNRESOLVED', {
            runnerId: invocation.runnerId,
            testPath: normalizedTestPath,
          });
          invalid = true;
          continue;
        }
        for (const kind of stableUnique(kinds)) {
          claims.push({
            identityKey: `${invocation.runnerId}#${normalizedTestPath}`,
            fieldName: CRITICAL_BINDING_FIELD_BY_KIND.get(kind),
            binding: { kind, evidenceRef },
          });
        }
      }
    }
    if (invalid) continue;

    const claimKeys = new Set();
    for (const claim of claims) {
      const claimKey = `${claim.identityKey}\0${claim.binding.kind}`;
      if (claimKeys.has(claimKey) || index.criticalBindingClaims.has(claimKey)) {
        criticalBindingIssue(index, context, 'CRITICAL_BINDING_CLAIM_DUPLICATE', {
          runnerId: claim.identityKey.slice(0, claim.identityKey.indexOf('#')),
          testPath: claim.identityKey.slice(claim.identityKey.indexOf('#') + 1),
          bindingKind: claim.binding.kind,
        });
        invalid = true;
      }
      claimKeys.add(claimKey);
    }
    if (invalid) continue;

    for (const claim of claims) {
      const claimKey = `${claim.identityKey}\0${claim.binding.kind}`;
      index.criticalBindingClaims.set(claimKey, evidenceRef);
      addBindingMapValue(index[claim.fieldName], claim.identityKey, claim.binding);
    }
  }
}

function addUncertainty(collection, row) {
  const key = JSON.stringify(row);
  if (!collection.some((candidate) => JSON.stringify(candidate) === key)) {
    collection.push(row);
    collection.sort((left, right) =>
      compareText(
        `${left.targetPath}\0${left.issueCode}\0${left.evidenceRef}`,
        `${right.targetPath}\0${right.issueCode}\0${right.evidenceRef}`
      )
    );
  }
}

function collectConditionalExport(value) {
  if (typeof value === 'string') {
    return value.startsWith('./')
      ? { localTargets: [value], unresolved: false }
      : { localTargets: [], unresolved: true };
  }
  if (Array.isArray(value)) {
    const rows = value.map(collectConditionalExport);
    return {
      localTargets: stableUnique(rows.flatMap((row) => row.localTargets)),
      unresolved: rows.some((row) => row.unresolved),
    };
  }
  if (!value || typeof value !== 'object') {
    return { localTargets: [], unresolved: true };
  }

  const rows = Object.values(value).map(collectConditionalExport);
  const localTargets = stableUnique(rows.flatMap((row) => row.localTargets));
  return {
    localTargets,
    unresolved:
      rows.some((row) => row.unresolved) ||
      (Object.keys(value).length > 1 && localTargets.length > 1),
  };
}

function registerExports({
  packageJson,
  packagePath,
  packageDirectory,
  packageExports,
  unresolvedExports,
}) {
  const exportsField = packageJson.exports;
  if (exportsField === undefined) return;
  const entries =
    exportsField &&
    typeof exportsField === 'object' &&
    !Array.isArray(exportsField) &&
    Object.keys(exportsField).some((key) => key.startsWith('.'))
      ? Object.entries(exportsField)
      : [['.', exportsField]];

  for (const [exportKey, value] of entries.sort(([left], [right]) => compareText(left, right))) {
    const collected = collectConditionalExport(value);
    for (const relativeTarget of collected.localTargets) {
      const targetPath = normalizePath(path.posix.join(packageDirectory, relativeTarget));
      addMapValue(packageExports, targetPath, sourceRef(packagePath, `exports:${exportKey}`));
      if (collected.unresolved) {
        addMapValue(
          unresolvedExports,
          targetPath,
          sourceRef(packagePath, `exports:${exportKey}:unresolved`)
        );
      }
    }
  }
}

function registerBins({
  packageJson,
  packagePath,
  packageDirectory,
  packageBins,
  packageBinRecords,
}) {
  const binEntries =
    typeof packageJson.bin === 'string'
      ? [[packageJson.name || '.', packageJson.bin]]
      : Object.entries(packageJson.bin || {});
  for (const [binName, relativeTarget] of binEntries.sort(([left], [right]) =>
    compareText(left, right)
  )) {
    if (
      typeof relativeTarget !== 'string' ||
      path.isAbsolute(relativeTarget) ||
      /^[a-z][a-z0-9+.-]*:/iu.test(relativeTarget)
    ) {
      continue;
    }
    const targetPath = normalizePath(path.posix.join(packageDirectory, relativeTarget));
    if (
      targetPath === '..' ||
      targetPath.startsWith('../') ||
      (packageDirectory !== '.' &&
        targetPath !== packageDirectory &&
        !targetPath.startsWith(`${packageDirectory}/`))
    ) {
      continue;
    }
    const evidenceRef = sourceRef(packagePath, `bin:${binName}`);
    addMapValue(packageBins, targetPath, evidenceRef);
    packageBinRecords.push({
      binName,
      targetPath,
      packagePath,
      packageDirectory,
      evidenceRef,
    });
  }
}

function readPackageMetadata(repoRoot, packagePaths, criticalBindingPackagePaths, index) {
  const criticalAuthorityPackages = new Set(stableUnique(criticalBindingPackagePaths));
  for (const rawPackagePath of stableUnique(packagePaths)) {
    const packagePath = normalizePath(rawPackagePath);
    const absolutePath = path.join(repoRoot, packagePath);
    const packageJson = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    const packageDirectory = normalizePath(path.posix.dirname(packagePath));
    index.packageRecords.push({ packagePath, packageDirectory, packageJson });
    addMapValue(
      index.packageManifestBindings,
      packagePath,
      sourceRef(packagePath, 'package-manifest')
    );
    registerExports({
      packageJson,
      packagePath,
      packageDirectory,
      packageExports: index.packageExports,
      unresolvedExports: index.unresolvedExports,
    });
    registerBins({
      packageJson,
      packagePath,
      packageDirectory,
      packageBins: index.packageBins,
      packageBinRecords: index.packageBinRecords,
    });

    const auditConfig = packageJson.testPortfolioAudit || {};
    if (criticalAuthorityPackages.has(packagePath)) {
      registerCriticalBindings({
        repoRoot,
        packageJson,
        packagePath,
        auditConfig,
        index,
      });
    }
    for (const binding of auditConfig.protectedBindings || []) {
      if (typeof binding?.targetPath === 'string' && typeof binding?.evidenceRef === 'string') {
        index.protectedBindings.push({
          targetPath: normalizePath(path.posix.join(packageDirectory, binding.targetPath)),
          evidenceRef: binding.evidenceRef,
        });
      } else if (
        typeof binding?.targetPattern === 'string' &&
        typeof binding?.evidenceRef === 'string'
      ) {
        addUncertainty(index.protectionUncertainty, {
          targetPath: normalizePath(path.posix.join(packageDirectory, binding.targetPattern)),
          issueCode: 'TARGET_PROTECTION_BINDING_UNRESOLVED',
          evidenceRef: binding.evidenceRef,
        });
      }
    }
    for (const owner of auditConfig.generatorOwners || []) {
      if (typeof owner?.targetPath === 'string') {
        index.generatorOwners.add(
          normalizePath(path.posix.join(packageDirectory, owner.targetPath))
        );
      }
    }
    for (const [bindingIndex, binding] of (auditConfig.generatorBindings || []).entries()) {
      if (
        typeof binding?.ownerPath !== 'string' ||
        typeof binding?.outputPath !== 'string' ||
        typeof binding?.consumerPath !== 'string'
      ) {
        continue;
      }
      const ownerPath = normalizePath(path.posix.join(packageDirectory, binding.ownerPath));
      const outputPath = normalizePath(path.posix.join(packageDirectory, binding.outputPath));
      const consumerPath = normalizePath(path.posix.join(packageDirectory, binding.consumerPath));
      const evidenceRef = sourceRef(
        packagePath,
        `testPortfolioAudit.generatorBindings[${bindingIndex}]`
      );
      index.generatorOwners.add(outputPath);
      if (
        index.nodes.has(ownerPath) &&
        index.nodes.has(outputPath) &&
        index.nodes.has(consumerPath) &&
        nodeReferencesTarget(index.nodes.get(consumerPath), outputPath, index)
      ) {
        addMapValue(index.generatedBindings, outputPath, evidenceRef);
        index.generatedBindingRecords.push({
          ownerPath,
          outputPath,
          consumerPath,
          evidenceRef,
        });
      } else {
        addUncertainty(index.generatedUncertainty, {
          targetPath: outputPath,
          issueCode: 'TARGET_GENERATED_BINDING_UNRESOLVED',
          evidenceRef,
        });
      }
    }
  }
  index.packageRecords.sort((left, right) => compareText(left.packagePath, right.packagePath));
  index.packageBinRecords.sort((left, right) =>
    compareText(
      `${left.binName}\0${left.packageDirectory}\0${left.targetPath}`,
      `${right.binName}\0${right.packageDirectory}\0${right.targetPath}`
    )
  );
  index.generatedBindingRecords.sort((left, right) =>
    compareText(
      `${left.outputPath}\0${left.ownerPath}\0${left.consumerPath}`,
      `${right.outputPath}\0${right.ownerPath}\0${right.consumerPath}`
    )
  );
  index.protectedBindings.sort((left, right) => compareText(left.targetPath, right.targetPath));
}

function calleeName(expression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) {
    return `${calleeName(expression.expression)}.${expression.name.text}`;
  }
  return '';
}

function collectConstantInitializers(sourceFile) {
  const initializers = new Map();
  function visit(astNode) {
    if (ts.isVariableDeclaration(astNode) && ts.isIdentifier(astNode.name) && astNode.initializer) {
      initializers.set(astNode.name.text, astNode.initializer);
    }
    ts.forEachChild(astNode, visit);
  }
  visit(sourceFile);
  return initializers;
}

function expressionDependsOnIdentifier(expression, identifier, initializers, seen = new Set()) {
  let found = false;
  function visit(astNode) {
    if (found) return;
    if (ts.isIdentifier(astNode)) {
      if (astNode.text === identifier) {
        found = true;
        return;
      }
      if (!seen.has(astNode.text) && initializers.has(astNode.text)) {
        const nextSeen = new Set(seen);
        nextSeen.add(astNode.text);
        if (
          expressionDependsOnIdentifier(
            initializers.get(astNode.text),
            identifier,
            initializers,
            nextSeen
          )
        ) {
          found = true;
        }
      }
      return;
    }
    ts.forEachChild(astNode, visit);
  }
  visit(expression);
  return found;
}

function unwrapExpression(expression) {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function evaluateStaticValue(expression, context, seen = new Set()) {
  const current = unwrapExpression(expression);
  if (ts.isStringLiteralLike(current) || ts.isNumericLiteral(current)) {
    return current.text;
  }
  if (ts.isTemplateExpression(current)) {
    let value = current.head.text;
    for (const span of current.templateSpans) {
      const resolved = evaluateStaticValue(span.expression, context, seen);
      if (resolved === undefined) return undefined;
      value += `${resolved}${span.literal.text}`;
    }
    return value;
  }
  if (ts.isIdentifier(current)) {
    if (current.text === '__dirname') {
      return path.resolve(context.index.repoRoot, path.dirname(context.node.path));
    }
    if (current.text === '__filename') {
      return path.resolve(context.index.repoRoot, context.node.path);
    }
    if (seen.has(current.text)) return undefined;
    const initializer = context.initializers.get(current.text);
    if (!initializer) return undefined;
    const nextSeen = new Set(seen);
    nextSeen.add(current.text);
    return evaluateStaticValue(initializer, context, nextSeen);
  }
  if (ts.isPropertyAccessExpression(current)) {
    const text = current.getText(context.node.sourceFile);
    if (text === 'import.meta.dirname') {
      return path.resolve(context.index.repoRoot, path.dirname(context.node.path));
    }
    if (text === 'import.meta.url') {
      return path.resolve(context.index.repoRoot, context.node.path);
    }
    if (text === 'process.execPath') return process.execPath;
  }
  if (ts.isBinaryExpression(current) && current.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = evaluateStaticValue(current.left, context, seen);
    const right = evaluateStaticValue(current.right, context, seen);
    if (left === undefined || right === undefined) return undefined;
    return `${left}${right}`;
  }
  if (ts.isCallExpression(current)) {
    const name = calleeName(current.expression);
    if (name === 'process.cwd') {
      return path.resolve(context.index.repoRoot);
    }
    if (['join', 'path.join', 'resolve', 'path.resolve'].includes(name)) {
      const values = current.arguments.map((argument) =>
        evaluateStaticValue(argument, context, seen)
      );
      if (values.some((value) => value === undefined)) return undefined;
      const strings = values.map(String);
      if (name.endsWith('resolve')) {
        return path.isAbsolute(strings[0] || '')
          ? path.resolve(...strings)
          : path.resolve(context.index.repoRoot, context.node.packageDirectory || '.', ...strings);
      }
      return path.join(...strings);
    }
    if (['dirname', 'path.dirname'].includes(name) && current.arguments.length === 1) {
      const value = evaluateStaticValue(current.arguments[0], context, seen);
      return value === undefined ? undefined : path.dirname(String(value));
    }
    if (name === 'fileURLToPath' && current.arguments.length === 1) {
      const value = evaluateStaticValue(current.arguments[0], context, seen);
      if (value === undefined) return undefined;
      return String(value).startsWith('file:') ? fileURLToPath(String(value)) : value;
    }
  }
  if (ts.isNewExpression(current) && calleeName(current.expression) === 'URL') {
    const argumentsList = current.arguments || [];
    if (argumentsList.length !== 2) return undefined;
    const relative = evaluateStaticValue(argumentsList[0], context, seen);
    const base = evaluateStaticValue(argumentsList[1], context, seen);
    if (relative === undefined || base === undefined) return undefined;
    const basePath = String(base).startsWith('file:') ? fileURLToPath(String(base)) : String(base);
    return path.resolve(path.dirname(basePath), String(relative));
  }
  return undefined;
}

function arrayExpressions(expression, initializers, seen = new Set()) {
  const current = unwrapExpression(expression);
  if (ts.isIdentifier(current)) {
    if (seen.has(current.text)) return [];
    const initializer = initializers.get(current.text);
    if (!initializer) return [];
    const nextSeen = new Set(seen);
    nextSeen.add(current.text);
    return arrayExpressions(initializer, initializers, nextSeen);
  }
  if (!ts.isArrayLiteralExpression(current)) return [];
  const expressions = [];
  for (const element of current.elements) {
    if (ts.isSpreadElement(element)) {
      expressions.push(...arrayExpressions(element.expression, initializers, seen));
    } else {
      expressions.push(element);
    }
  }
  return expressions;
}

function objectPropertyExpressions(expression, initializers, seen = new Set()) {
  const current = unwrapExpression(expression);
  if (ts.isIdentifier(current)) {
    if (seen.has(current.text)) return [];
    const initializer = initializers.get(current.text);
    if (!initializer) return [];
    const nextSeen = new Set(seen);
    nextSeen.add(current.text);
    return objectPropertyExpressions(initializer, initializers, nextSeen);
  }
  if (!ts.isObjectLiteralExpression(current)) return [];
  return current.properties.flatMap((property) => {
    if (!ts.isPropertyAssignment(property)) return [];
    const propertyName =
      ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)
        ? property.name.text
        : undefined;
    return propertyName ? [{ propertyName, expression: property.initializer }] : [];
  });
}

function objectPropertyValueExpressions(expression, propertyName, context, seen = new Set()) {
  const current = unwrapExpression(expression);
  if (ts.isIdentifier(current)) {
    if (seen.has(current.text)) return [];
    const nextSeen = new Set(seen);
    nextSeen.add(current.text);
    const parameterValues = context.parameterBindings?.get(current.text);
    if (parameterValues) {
      return parameterValues.flatMap((value) =>
        objectPropertyValueExpressions(value, propertyName, context, nextSeen)
      );
    }
    const initializer = context.initializers.get(current.text);
    return initializer
      ? objectPropertyValueExpressions(initializer, propertyName, context, nextSeen)
      : [];
  }
  if (!ts.isObjectLiteralExpression(current)) return [];
  return current.properties.flatMap((property) => {
    if (ts.isPropertyAssignment(property)) {
      const name =
        ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)
          ? property.name.text
          : undefined;
      return name === propertyName ? [property.initializer] : [];
    }
    if (ts.isShorthandPropertyAssignment(property) && property.name.text === propertyName) {
      return [property.name];
    }
    return [];
  });
}

function iterableExpressions(expression, initializers) {
  const arrayValues = arrayExpressions(expression, initializers);
  if (arrayValues.length > 0) return arrayValues;
  const current = unwrapExpression(expression);
  if (
    !ts.isCallExpression(current) ||
    !ts.isPropertyAccessExpression(current.expression) ||
    !ts.isIdentifier(current.expression.expression) ||
    current.expression.expression.text !== 'Object' ||
    current.arguments.length !== 1
  ) {
    return [];
  }
  const properties = objectPropertyExpressions(current.arguments[0], initializers);
  if (current.expression.name.text === 'values') {
    return properties.map((property) => property.expression);
  }
  if (current.expression.name.text === 'keys') {
    return properties.map((property) => ts.factory.createStringLiteral(property.propertyName));
  }
  if (current.expression.name.text === 'entries') {
    return properties.map((property) =>
      ts.factory.createArrayLiteralExpression([
        ts.factory.createStringLiteral(property.propertyName),
        property.expression,
      ])
    );
  }
  return [];
}

function addIterationBinding(values, name, expressions) {
  if (!name || expressions.length === 0) return;
  if (!values.has(name)) values.set(name, []);
  values.get(name).push(...expressions);
}

function bindIterationDeclaration(values, declarationName, expressions) {
  if (ts.isIdentifier(declarationName)) {
    addIterationBinding(values, declarationName.text, expressions);
    return;
  }
  if (!ts.isArrayBindingPattern(declarationName)) return;
  declarationName.elements.forEach((element, elementIndex) => {
    if (!ts.isBindingElement(element) || !ts.isIdentifier(element.name)) return;
    const elementExpressions = expressions.flatMap((expression) => {
      const current = unwrapExpression(expression);
      return ts.isArrayLiteralExpression(current) && current.elements[elementIndex]
        ? [current.elements[elementIndex]]
        : [];
    });
    addIterationBinding(values, element.name.text, elementExpressions);
  });
}

function collectIterationExpressions(sourceFile, initializers) {
  const values = new Map();
  function visit(astNode) {
    if (
      ts.isForOfStatement(astNode) &&
      ts.isVariableDeclarationList(astNode.initializer) &&
      astNode.initializer.declarations.length === 1
    ) {
      bindIterationDeclaration(
        values,
        astNode.initializer.declarations[0].name,
        iterableExpressions(astNode.expression, initializers)
      );
    } else if (
      ts.isCallExpression(astNode) &&
      ts.isPropertyAccessExpression(astNode.expression) &&
      ['every', 'filter', 'flatMap', 'forEach', 'map', 'some'].includes(
        astNode.expression.name.text
      ) &&
      astNode.arguments.length > 0 &&
      (ts.isArrowFunction(astNode.arguments[0]) || ts.isFunctionExpression(astNode.arguments[0])) &&
      astNode.arguments[0].parameters.length > 0
    ) {
      bindIterationDeclaration(
        values,
        astNode.arguments[0].parameters[0].name,
        iterableExpressions(astNode.expression.expression, initializers)
      );
    } else if (
      ts.isCallExpression(astNode) &&
      ts.isCallExpression(astNode.expression) &&
      ts.isPropertyAccessExpression(astNode.expression.expression) &&
      astNode.expression.expression.name.text === 'each' &&
      astNode.expression.arguments.length > 0
    ) {
      const callback = astNode.arguments.find(
        (argument) => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)
      );
      if (callback && callback.parameters.length > 0) {
        bindIterationDeclaration(
          values,
          callback.parameters[0].name,
          iterableExpressions(astNode.expression.arguments[0], initializers)
        );
      }
    }
    ts.forEachChild(astNode, visit);
  }
  visit(sourceFile);
  return values;
}

function collectLoopPropertyExpressions(sourceFile, initializers) {
  const values = new Map();
  function visit(astNode) {
    if (
      ts.isForOfStatement(astNode) &&
      ts.isVariableDeclarationList(astNode.initializer) &&
      astNode.initializer.declarations.length === 1
    ) {
      const declaration = astNode.initializer.declarations[0];
      if (ts.isIdentifier(declaration.name)) {
        for (const element of arrayExpressions(astNode.expression, initializers)) {
          if (!ts.isObjectLiteralExpression(element)) continue;
          for (const property of element.properties) {
            if (!ts.isPropertyAssignment(property)) continue;
            const propertyName =
              ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)
                ? property.name.text
                : undefined;
            if (!propertyName) continue;
            const key = `${declaration.name.text}.${propertyName}`;
            if (!values.has(key)) values.set(key, []);
            values.get(key).push(property.initializer);
          }
        }
      }
    }
    ts.forEachChild(astNode, visit);
  }
  visit(sourceFile);
  return values;
}

function evaluateStaticValues(expression, context, seen = new Set()) {
  const current = unwrapExpression(expression);
  if (ts.isConditionalExpression(current)) {
    return stableUnique([
      ...evaluateStaticValues(current.whenTrue, context, seen),
      ...evaluateStaticValues(current.whenFalse, context, seen),
    ]);
  }
  if (ts.isBinaryExpression(current) && current.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
    const left = evaluateStaticValues(current.left, context, seen);
    return left.length > 0 ? left : evaluateStaticValues(current.right, context, seen);
  }
  if (ts.isIdentifier(current)) {
    if (seen.has(current.text)) return [];
    const nextSeen = new Set(seen);
    nextSeen.add(current.text);
    const parameterValues = context.parameterBindings?.get(current.text);
    if (parameterValues) {
      return stableUnique(
        parameterValues.flatMap((value) => evaluateStaticValues(value, context, nextSeen))
      );
    }
    const values = context.iterationExpressions.get(current.text);
    if (values) {
      return stableUnique(
        values.flatMap((value) => evaluateStaticValues(value, context, nextSeen))
      );
    }
    const initializer = context.initializers.get(current.text);
    if (initializer) return evaluateStaticValues(initializer, context, nextSeen);
  }
  if (ts.isPropertyAccessExpression(current) && ts.isIdentifier(current.expression)) {
    const propertyValues = objectPropertyValueExpressions(
      current.expression,
      current.name.text,
      context,
      seen
    );
    if (propertyValues.length > 0) {
      return stableUnique(
        propertyValues.flatMap((value) => evaluateStaticValues(value, context, seen))
      );
    }
    const values = context.loopPropertyExpressions.get(
      `${current.expression.text}.${current.name.text}`
    );
    if (values) {
      return stableUnique(
        values.map((value) => evaluateStaticValue(value, context)).filter(Boolean)
      );
    }
  }
  if (ts.isCallExpression(current)) {
    const name = calleeName(current.expression);
    if (['join', 'path.join', 'resolve', 'path.resolve'].includes(name)) {
      const valueLists = current.arguments.map((argument) =>
        evaluateStaticValues(argument, context, seen)
      );
      if (valueLists.some((values) => values.length === 0)) return [];
      let combinations = [[]];
      for (const values of valueLists) {
        combinations = combinations.flatMap((combination) =>
          values.map((value) => [...combination, String(value)])
        );
      }
      return stableUnique(
        combinations.map((values) => {
          if (name.endsWith('resolve')) {
            return path.isAbsolute(values[0] || '')
              ? path.resolve(...values)
              : path.resolve(
                  context.index.repoRoot,
                  context.node.packageDirectory || '.',
                  ...values
                );
          }
          return path.join(...values);
        })
      );
    }
  }
  if (ts.isElementAccessExpression(current) && ts.isIdentifier(current.expression)) {
    const properties = objectPropertyExpressions(current.expression, context.initializers);
    const requestedNames = evaluateStaticValues(current.argumentExpression, context, seen);
    return stableUnique(
      properties
        .filter((property) => requestedNames.includes(property.propertyName))
        .map((property) => evaluateStaticValue(property.expression, context))
        .filter(Boolean)
    );
  }
  const value = evaluateStaticValue(current, context, seen);
  return value === undefined ? [] : [value];
}

function evaluateCommandTexts(expression, context, seen = new Set()) {
  const current = unwrapExpression(expression);
  if (ts.isIdentifier(current)) {
    if (seen.has(current.text)) return [];
    const nextSeen = new Set(seen);
    nextSeen.add(current.text);
    const parameterValues = context.parameterBindings?.get(current.text);
    if (parameterValues) {
      return stableUnique(
        parameterValues.flatMap((value) => evaluateCommandTexts(value, context, nextSeen))
      );
    }
    const initializer = context.initializers.get(current.text);
    if (initializer) return evaluateCommandTexts(initializer, context, nextSeen);
  }
  if (ts.isNoSubstitutionTemplateLiteral(current) || ts.isStringLiteralLike(current)) {
    return [current.text];
  }
  if (ts.isTemplateExpression(current)) {
    let combinations = [current.head.text];
    current.templateSpans.forEach((span, spanIndex) => {
      const resolved = evaluateStaticValues(span.expression, context);
      const replacements =
        resolved.length > 0 ? resolved.map(String) : [`__BMAD_DYNAMIC_${spanIndex}__`];
      combinations = combinations
        .flatMap((prefix) =>
          replacements.map((replacement) => `${prefix}${replacement}${span.literal.text}`)
        )
        .slice(0, 64);
    });
    return stableUnique(combinations);
  }
  return stableUnique(evaluateStaticValues(current, context, seen));
}

function evaluateArgumentVectors(expression, context, seen = new Set()) {
  const current = unwrapExpression(expression);
  if (ts.isIdentifier(current)) {
    if (seen.has(current.text)) return [];
    const nextSeen = new Set(seen);
    nextSeen.add(current.text);
    const parameterValues = context.parameterBindings?.get(current.text);
    if (parameterValues) {
      return parameterValues.flatMap((value) => evaluateArgumentVectors(value, context, nextSeen));
    }
    const initializer = context.initializers.get(current.text);
    return initializer ? evaluateArgumentVectors(initializer, context, nextSeen) : [];
  }
  if (!ts.isArrayLiteralExpression(current)) return [];

  let vectors = [[]];
  current.elements.forEach((element, elementIndex) => {
    if (ts.isSpreadElement(element)) {
      const spreadVectors = evaluateArgumentVectors(element.expression, context, seen);
      if (spreadVectors.length === 0) {
        vectors = vectors.map((vector) => [...vector, `__BMAD_DYNAMIC_ARG_${elementIndex}__`]);
      } else {
        vectors = vectors.flatMap((vector) =>
          spreadVectors.map((spreadVector) => [...vector, ...spreadVector])
        );
      }
      return;
    }
    const values = evaluateStaticValues(element, context, seen);
    const replacements =
      values.length > 0 ? values.map(String) : [`__BMAD_DYNAMIC_ARG_${elementIndex}__`];
    vectors = vectors
      .flatMap((vector) => replacements.map((value) => [...vector, value]))
      .slice(0, 64);
  });
  return vectors;
}

function normalizeWorkingDirectory(value, context) {
  const fallback = context.node.packageDirectory || '.';
  if (value === undefined || value === null) return fallback;
  const absolutePath = path.isAbsolute(String(value))
    ? path.resolve(String(value))
    : path.resolve(context.index.repoRoot, String(value));
  const relativePath = normalizePath(path.relative(context.index.repoRoot, absolutePath));
  return relativePath === '..' || relativePath.startsWith('../') ? fallback : relativePath || '.';
}

function callWorkingDirectories(call, context, optionsIndex) {
  const optionsExpression = call.arguments[optionsIndex];
  if (!optionsExpression) return [context.node.packageDirectory || '.'];
  const cwdExpressions = objectPropertyValueExpressions(optionsExpression, 'cwd', context);
  const values = cwdExpressions.flatMap((expression) => evaluateStaticValues(expression, context));
  return values.length > 0
    ? stableUnique(values.map((value) => normalizeWorkingDirectory(value, context)))
    : [context.node.packageDirectory || '.'];
}

function processOptionsIndex(call) {
  if (call.arguments.length < 2) return -1;
  const second = unwrapExpression(call.arguments[1]);
  return ts.isObjectLiteralExpression(second) ? 1 : call.arguments.length > 2 ? 2 : -1;
}

function directPathExpressions(call, initializers) {
  const name = calleeName(call.expression);
  if (FILE_PATH_SINKS.has(name)) return call.arguments.length > 0 ? [call.arguments[0]] : [];
  if (
    call.expression.kind === ts.SyntaxKind.ImportKeyword ||
    (name === 'require' && call.arguments.length === 1)
  ) {
    return call.arguments.length > 0 ? [call.arguments[0]] : [];
  }
  if (!PROCESS_SINKS.has(name)) return [];
  const expressions = call.arguments.length > 0 ? [call.arguments[0]] : [];
  if (call.arguments.length > 1) {
    expressions.push(...arrayExpressions(call.arguments[1], initializers));
  }
  return expressions;
}

function directCommandExpressions(call) {
  const name = calleeName(call.expression);
  return SHELL_COMMAND_SINKS.has(name) && call.arguments.length > 0 ? [call.arguments[0]] : [];
}

function collectHelperPathParameters(sourceFile, initializers) {
  const helpers = new Map();

  function register(name, parameters, body) {
    if (!name || !body) return;
    const pathParameterIndexes = new Set();
    function visit(astNode) {
      if (ts.isCallExpression(astNode)) {
        for (const expression of directPathExpressions(astNode, initializers)) {
          parameters.forEach((parameter, index) => {
            if (
              ts.isIdentifier(parameter.name) &&
              expressionDependsOnIdentifier(expression, parameter.name.text, initializers)
            ) {
              pathParameterIndexes.add(index);
            }
          });
        }
      }
      ts.forEachChild(astNode, visit);
    }
    visit(body);
    if (pathParameterIndexes.size > 0) {
      helpers.set(
        name,
        [...pathParameterIndexes].sort((left, right) => left - right)
      );
    }
  }

  function visit(astNode) {
    if (ts.isFunctionDeclaration(astNode) && astNode.name) {
      register(astNode.name.text, astNode.parameters, astNode.body);
    } else if (
      ts.isVariableDeclaration(astNode) &&
      ts.isIdentifier(astNode.name) &&
      astNode.initializer &&
      (ts.isArrowFunction(astNode.initializer) || ts.isFunctionExpression(astNode.initializer))
    ) {
      register(astNode.name.text, astNode.initializer.parameters, astNode.initializer.body);
    }
    ts.forEachChild(astNode, visit);
  }

  visit(sourceFile);
  return helpers;
}

function collectHelperPathTemplates(sourceFile, initializers) {
  const helpers = new Map();

  function register(name, parameters, body) {
    if (!name || !body) return;
    const parameterNames = parameters.map((parameter) =>
      ts.isIdentifier(parameter.name) ? parameter.name.text : undefined
    );
    const templates = [];
    function visit(astNode) {
      if (ts.isCallExpression(astNode)) {
        for (const expression of directPathExpressions(astNode, initializers)) {
          if (
            parameterNames.some(
              (parameterName) =>
                parameterName &&
                expressionDependsOnIdentifier(expression, parameterName, initializers)
            )
          ) {
            templates.push({ expression, parameterNames });
          }
        }
      }
      ts.forEachChild(astNode, visit);
    }
    visit(body);
    if (templates.length > 0) helpers.set(name, templates);
  }

  function visit(astNode) {
    if (ts.isFunctionDeclaration(astNode) && astNode.name) {
      register(astNode.name.text, astNode.parameters, astNode.body);
    } else if (
      ts.isVariableDeclaration(astNode) &&
      ts.isIdentifier(astNode.name) &&
      astNode.initializer &&
      (ts.isArrowFunction(astNode.initializer) || ts.isFunctionExpression(astNode.initializer))
    ) {
      register(astNode.name.text, astNode.initializer.parameters, astNode.initializer.body);
    }
    ts.forEachChild(astNode, visit);
  }

  visit(sourceFile);
  return helpers;
}

function collectHelperCommandTemplates(sourceFile, initializers) {
  const helpers = new Map();

  function register(name, parameters, body) {
    if (!name || !body) return;
    const parameterNames = parameters.map((parameter) =>
      ts.isIdentifier(parameter.name) ? parameter.name.text : undefined
    );
    const templates = [];
    function visit(astNode) {
      if (ts.isCallExpression(astNode)) {
        for (const expression of directCommandExpressions(astNode)) {
          if (
            parameterNames.some(
              (parameterName) =>
                parameterName &&
                expressionDependsOnIdentifier(expression, parameterName, initializers)
            )
          ) {
            templates.push({ expression, parameterNames });
          }
        }
      }
      ts.forEachChild(astNode, visit);
    }
    visit(body);
    if (templates.length > 0) helpers.set(name, templates);
  }

  function visit(astNode) {
    if (ts.isFunctionDeclaration(astNode) && astNode.name) {
      register(astNode.name.text, astNode.parameters, astNode.body);
    } else if (
      ts.isVariableDeclaration(astNode) &&
      ts.isIdentifier(astNode.name) &&
      astNode.initializer &&
      (ts.isArrowFunction(astNode.initializer) || ts.isFunctionExpression(astNode.initializer))
    ) {
      register(astNode.name.text, astNode.initializer.parameters, astNode.initializer.body);
    }
    ts.forEachChild(astNode, visit);
  }

  visit(sourceFile);
  return helpers;
}

function collectHelperProcessTemplates(sourceFile) {
  const helpers = new Map();

  function register(name, parameters, body) {
    if (!name || !body) return;
    const parameterNames = parameters.map((parameter) =>
      ts.isIdentifier(parameter.name) ? parameter.name.text : undefined
    );
    const templates = [];
    function visit(astNode) {
      if (ts.isCallExpression(astNode) && PROCESS_SINKS.has(calleeName(astNode.expression))) {
        templates.push({ call: astNode, parameterNames });
      }
      ts.forEachChild(astNode, visit);
    }
    visit(body);
    if (templates.length > 0) helpers.set(name, templates);
  }

  function visit(astNode) {
    if (ts.isFunctionDeclaration(astNode) && astNode.name) {
      register(astNode.name.text, astNode.parameters, astNode.body);
    } else if (
      ts.isVariableDeclaration(astNode) &&
      ts.isIdentifier(astNode.name) &&
      astNode.initializer &&
      (ts.isArrowFunction(astNode.initializer) || ts.isFunctionExpression(astNode.initializer))
    ) {
      register(astNode.name.text, astNode.initializer.parameters, astNode.initializer.body);
    }
    ts.forEachChild(astNode, visit);
  }

  visit(sourceFile);
  return helpers;
}

function resolveTargetCandidate(value, node, index) {
  if (value === undefined || value === null) return undefined;
  let candidate = String(value);
  if (candidate.startsWith('file:')) candidate = fileURLToPath(candidate);
  if (candidate === process.execPath) return undefined;
  const bases = path.isAbsolute(candidate)
    ? [candidate]
    : [
        path.resolve(index.repoRoot, candidate),
        path.resolve(index.repoRoot, node.packageDirectory || '.', candidate),
      ];
  const matches = new Set();
  for (const absolutePath of bases) {
    const relativePath = normalizePath(path.relative(index.repoRoot, absolutePath));
    if (relativePath === '..' || relativePath.startsWith('../')) continue;
    const extension = path.posix.extname(relativePath);
    const candidates = extension
      ? [relativePath]
      : [
          relativePath,
          ...SOURCE_EXTENSIONS.map((sourceExtension) => `${relativePath}${sourceExtension}`),
          ...SOURCE_EXTENSIONS.map((sourceExtension) => `${relativePath}/index${sourceExtension}`),
        ];
    const sourceCandidates = candidates.flatMap((targetPath) =>
      generatedSourceCandidates(targetPath)
    );
    for (const targetPath of [...candidates, ...sourceCandidates]) {
      if (index.nodes.has(targetPath)) matches.add(targetPath);
    }
  }
  return matches.size === 1 ? [...matches][0] : undefined;
}

function packageOwnsDirectory(packageRecord, directoryPath) {
  const relativePath = normalizePath(
    path.posix.relative(packageRecord.packageDirectory || '.', directoryPath)
  );
  if (relativePath === '..' || relativePath.startsWith('../') || relativePath === 'package.json') {
    return false;
  }
  return (packageRecord.packageJson?.files || []).some((entry) => {
    if (typeof entry !== 'string') return false;
    const normalizedEntry = normalizePath(entry).replace(/\/+$/u, '');
    const wildcardIndex = normalizedEntry.search(/[*?[{]/u);
    const stablePrefix =
      wildcardIndex >= 0
        ? normalizedEntry.slice(0, wildcardIndex).replace(/\/+$/u, '')
        : normalizedEntry;
    return (
      stablePrefix !== '' &&
      (relativePath === stablePrefix || relativePath.startsWith(`${stablePrefix}/`))
    );
  });
}

function resolveDirectoryPackageTarget(value, node, index) {
  if (value === undefined || value === null) return undefined;
  let candidate = String(value);
  if (candidate.startsWith('file:')) candidate = fileURLToPath(candidate);
  const bases = path.isAbsolute(candidate)
    ? [candidate]
    : [
        path.resolve(index.repoRoot, candidate),
        path.resolve(index.repoRoot, node.packageDirectory || '.', candidate),
      ];
  const matches = new Set();
  for (const absolutePath of bases) {
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isDirectory()) continue;
    const directoryPath = normalizePath(path.relative(index.repoRoot, absolutePath));
    if (directoryPath === '..' || directoryPath.startsWith('../')) continue;
    const owners = index.packageRecords.filter((record) =>
      packageOwnsDirectory(record, directoryPath)
    );
    if (owners.length === 1) matches.add(owners[0].packagePath);
  }
  return matches.size === 1 ? [...matches][0] : undefined;
}

function collectStaticTestTargets(node, index) {
  if (!node.isTest || !node.sourceFile) return;
  const initializers = collectConstantInitializers(node.sourceFile);
  const commandTemplates = collectHelperCommandTemplates(node.sourceFile, initializers);
  const processTemplates = collectHelperProcessTemplates(node.sourceFile);
  const helpers = collectHelperPathParameters(node.sourceFile, initializers);
  const helperTemplates = collectHelperPathTemplates(node.sourceFile, initializers);
  const loopPropertyExpressions = collectLoopPropertyExpressions(node.sourceFile, initializers);
  const iterationExpressions = collectIterationExpressions(node.sourceFile, initializers);
  const context = {
    node,
    index,
    initializers,
    iterationExpressions,
    loopPropertyExpressions,
    parameterBindings: new Map(),
  };

  function visit(astNode) {
    if (ts.isCallExpression(astNode)) {
      if (PROCESS_SINKS.has(calleeName(astNode.expression))) {
        registerProcessInvocationTargets(index, node, astNode, context);
      }
      const expressions = [...directPathExpressions(astNode, initializers)];
      const helperIndexes = helpers.get(calleeName(astNode.expression)) || [];
      for (const argumentIndex of helperIndexes) {
        if (astNode.arguments[argumentIndex]) expressions.push(astNode.arguments[argumentIndex]);
      }
      for (const expression of expressions) {
        for (const value of evaluateStaticValues(expression, context)) {
          const targetPath =
            resolveTargetCandidate(value, node, index) ||
            resolveDirectoryPackageTarget(value, node, index);
          if (targetPath && targetPath !== node.path) {
            addMapValue(index.testTargets, node.path, targetPath);
          }
        }
      }
      for (const template of helperTemplates.get(calleeName(astNode.expression)) || []) {
        const parameterBindings = new Map();
        template.parameterNames.forEach((parameterName, parameterIndex) => {
          if (parameterName && astNode.arguments[parameterIndex]) {
            parameterBindings.set(
              parameterName,
              evaluateStaticValues(astNode.arguments[parameterIndex], context).map((value) =>
                ts.factory.createStringLiteral(String(value))
              )
            );
          }
        });
        const helperContext = { ...context, parameterBindings };
        for (const value of evaluateStaticValues(template.expression, helperContext)) {
          const targetPath =
            resolveTargetCandidate(value, node, index) ||
            resolveDirectoryPackageTarget(value, node, index);
          if (targetPath && targetPath !== node.path) {
            addMapValue(index.testTargets, node.path, targetPath);
          }
        }
      }
      const commandExpressions = [...directCommandExpressions(astNode)];
      for (const template of processTemplates.get(calleeName(astNode.expression)) || []) {
        const parameterBindings = new Map();
        template.parameterNames.forEach((parameterName, parameterIndex) => {
          if (parameterName && astNode.arguments[parameterIndex]) {
            parameterBindings.set(parameterName, [astNode.arguments[parameterIndex]]);
          }
        });
        registerProcessInvocationTargets(index, node, template.call, {
          ...context,
          parameterBindings,
        });
      }
      for (const template of commandTemplates.get(calleeName(astNode.expression)) || []) {
        const parameterBindings = new Map();
        template.parameterNames.forEach((parameterName, parameterIndex) => {
          if (parameterName && astNode.arguments[parameterIndex]) {
            parameterBindings.set(
              parameterName,
              evaluateCommandTexts(astNode.arguments[parameterIndex], context).map((value) =>
                ts.factory.createStringLiteral(String(value))
              )
            );
          }
        });
        const helperContext = { ...context, parameterBindings };
        for (const commandText of evaluateCommandTexts(template.expression, helperContext)) {
          registerTestCommandTargets(index, node, commandText);
        }
      }
      const commandDirectories =
        commandExpressions.length > 0
          ? callWorkingDirectories(astNode, context, 1)
          : [node.packageDirectory || '.'];
      for (const expression of commandExpressions) {
        for (const commandText of evaluateCommandTexts(expression, context)) {
          for (const packageDirectory of commandDirectories) {
            registerTestCommandTargets(index, node, commandText, packageDirectory);
          }
        }
      }
    }
    ts.forEachChild(astNode, visit);
  }

  visit(node.sourceFile);
}

function normalizeCommandName(value) {
  const baseName = path.basename(String(value).replace(/\\/g, '/')).toLowerCase();
  return baseName.replace(/\.(?:cmd|exe)$/u, '');
}

function packageRecordForDirectory(index, packageDirectory) {
  const directory = normalizePath(packageDirectory || '.');
  const targetPath = normalizePath(
    path.posix.join(directory === '.' ? '' : directory, 'package.json')
  );
  return containingPackageRecord(index, targetPath);
}

function resolveCommandTarget(packageDirectory, token, index) {
  if (typeof token !== 'string' || token.startsWith('-')) return undefined;
  if (!/[./\\]/u.test(token)) {
    const records = (index.packageBinRecords || []).filter((record) => record.binName === token);
    const directory = normalizePath(packageDirectory || '.');
    const reachable = records
      .filter(
        (record) =>
          record.packageDirectory === '.' ||
          directory === record.packageDirectory ||
          directory.startsWith(`${record.packageDirectory}/`)
      )
      .sort(
        (left, right) =>
          right.packageDirectory.length - left.packageDirectory.length ||
          compareText(left.targetPath, right.targetPath)
      );
    if (reachable.length > 0) {
      const maximumSpecificity = reachable[0].packageDirectory.length;
      const nearestTargets = stableUnique(
        reachable
          .filter((record) => record.packageDirectory.length === maximumSpecificity)
          .map((record) => record.targetPath)
      );
      return nearestTargets.length === 1 ? nearestTargets[0] : undefined;
    }
    const matches = stableUnique(records.map((record) => record.targetPath));
    return matches.length === 1 ? matches[0] : undefined;
  }
  const syntheticNode = { path: 'package.json', packageDirectory };
  return resolveTargetCandidate(token, syntheticNode, index);
}

function addTestTarget(index, node, targetPath) {
  if (targetPath && targetPath !== node.path) {
    addMapValue(index.testTargets, node.path, targetPath);
  }
}

function registerTestArgvTargets(index, node, argv, packageDirectory, state = { stack: [] }) {
  if (!Array.isArray(argv) || argv.length === 0) return;
  const normalizedArgv = [normalizeCommandName(argv[0]), ...argv.slice(1)];
  const packageRecord =
    packageRecordForDirectory(index, packageDirectory) || containingPackageRecord(index, node.path);
  const npmRun = parseNpmRun(
    normalizedArgv,
    index.repoRoot,
    packageRecord?.packagePath || node.packagePath || 'package.json'
  );
  if (npmRun) {
    const key = `${npmRun.packagePath}#${npmRun.scriptName}`;
    if (state.stack.includes(key)) return;
    const targetPackage = index.packageRecords.find(
      (record) => record.packagePath === npmRun.packagePath
    );
    const commandText = targetPackage?.packageJson?.scripts?.[npmRun.scriptName];
    if (typeof commandText !== 'string') return;
    let commands;
    try {
      commands = parseCommandChain(commandText);
    } catch {
      return;
    }
    for (const commandArgv of commands) {
      registerTestArgvTargets(index, node, commandArgv, targetPackage.packageDirectory, {
        stack: [...state.stack, key],
      });
    }
    return;
  }

  if (
    normalizedArgv[0] === 'npm' &&
    ['pack', 'publish'].includes(normalizedArgv[1]) &&
    packageRecord
  ) {
    addTestTarget(index, node, packageRecord.packagePath);
  }
  for (const token of commandTargetTokens(normalizedArgv)) {
    addTestTarget(index, node, resolveCommandTarget(packageDirectory, token, index));
  }
}

function registerTestCommandTargets(
  index,
  node,
  commandText,
  packageDirectory = node.packageDirectory || '.'
) {
  let commands;
  try {
    commands = parseCommandChain(commandText);
  } catch {
    return;
  }
  for (const argv of commands) {
    registerTestArgvTargets(index, node, argv, packageDirectory);
  }
}

function registerProcessInvocationTargets(index, node, call, context) {
  const executableValues = evaluateStaticValues(call.arguments[0], context);
  if (executableValues.length === 0) return;
  const second = call.arguments[1] ? unwrapExpression(call.arguments[1]) : undefined;
  const argumentVectors =
    second && !ts.isObjectLiteralExpression(second)
      ? evaluateArgumentVectors(call.arguments[1], context)
      : [[]];
  if (argumentVectors.length === 0) return;
  const optionsIndex = processOptionsIndex(call);
  const directories =
    optionsIndex >= 0
      ? callWorkingDirectories(call, context, optionsIndex)
      : [node.packageDirectory || '.'];
  const knownExecutables = new Set([
    'bash',
    'node',
    'npm',
    'npx',
    'powershell',
    'pwsh',
    'sh',
    'ts-node',
    'tsx',
    'vite-node',
  ]);

  for (const executable of executableValues) {
    const normalizedExecutable = normalizeCommandName(executable);
    const commandToken = knownExecutables.has(normalizedExecutable)
      ? normalizedExecutable
      : String(executable);
    for (const argv of argumentVectors) {
      for (const packageDirectory of directories) {
        registerTestArgvTargets(index, node, [commandToken, ...argv], packageDirectory);
      }
    }
  }
}

function commandTargetTokens(argv) {
  if (!Array.isArray(argv) || argv.length === 0) return [];
  const rawCommand = argv[0];
  let command = normalizeCommandName(rawCommand);
  let offset = 1;
  if (command === 'npx') {
    while (typeof argv[offset] === 'string' && argv[offset].startsWith('-')) {
      if (['--call', '--cache', '--package', '-c', '-p'].includes(argv[offset])) offset += 2;
      else offset += 1;
    }
    command = normalizeCommandName(argv[offset]);
    offset += 1;
  } else if (command === 'npm' && argv[1] === 'exec') {
    offset = argv[2] === '--' ? 3 : 2;
    command = normalizeCommandName(argv[offset]);
    offset += 1;
  }

  if (command === 'node') {
    while (typeof argv[offset] === 'string' && argv[offset].startsWith('-')) {
      if (['--loader', '--require', '-r'].includes(argv[offset])) offset += 2;
      else offset += 1;
    }
    return typeof argv[offset] === 'string' ? [argv[offset]] : [];
  }
  if (['tsx', 'ts-node', 'vite-node'].includes(command)) {
    while (typeof argv[offset] === 'string' && argv[offset].startsWith('-')) {
      if (['--project', '-P'].includes(argv[offset])) offset += 2;
      else offset += 1;
    }
    return typeof argv[offset] === 'string' ? [argv[offset]] : [];
  }
  if (['pwsh', 'powershell', 'powershell.exe', 'pwsh.exe'].includes(command)) {
    const fileIndex = argv.findIndex((token) => ['-File', '-f'].includes(token));
    return fileIndex >= 0 && typeof argv[fileIndex + 1] === 'string' ? [argv[fileIndex + 1]] : [];
  }
  if (['bash', 'sh'].includes(command)) {
    if (argv.includes('-c')) return [];
    while (typeof argv[offset] === 'string' && argv[offset].startsWith('-')) offset += 1;
    return typeof argv[offset] === 'string' ? [argv[offset]] : [];
  }
  return command ? [command === normalizeCommandName(rawCommand) ? rawCommand : command] : [];
}

function registerCommandBindings(index, input, state = { stack: [] }) {
  let commands;
  try {
    commands = parseCommandChain(input.commandText);
  } catch {
    return;
  }
  for (const argv of commands) {
    const npmRun = parseNpmRun(argv, index.repoRoot, input.packagePath);
    if (npmRun) {
      const key = `${npmRun.packagePath}#${npmRun.scriptName}`;
      if (state.stack.includes(key)) continue;
      const packageRecord = index.packageRecords.find(
        (record) => record.packagePath === npmRun.packagePath
      );
      const commandText = packageRecord?.packageJson?.scripts?.[npmRun.scriptName];
      if (typeof commandText !== 'string') continue;
      registerCommandBindings(
        index,
        {
          packagePath: packageRecord.packagePath,
          packageDirectory: packageRecord.packageDirectory,
          commandText,
          evidenceRef: sourceRef(packageRecord.packagePath, `scripts.${npmRun.scriptName}`),
        },
        { stack: [...state.stack, key] }
      );
      continue;
    }
    for (const token of commandTargetTokens(argv)) {
      const targetPath = resolveCommandTarget(input.packageDirectory, token, index);
      if (targetPath) addMapValue(index.scriptBindings, targetPath, input.evidenceRef);
    }
  }
}

function registerPackageScriptBindings(index) {
  for (const packageRecord of index.packageRecords) {
    for (const [scriptName, commandText] of Object.entries(
      packageRecord.packageJson?.scripts || {}
    ).sort(([left], [right]) => compareText(left, right))) {
      if (typeof commandText !== 'string') continue;
      registerCommandBindings(index, {
        packagePath: packageRecord.packagePath,
        packageDirectory: packageRecord.packageDirectory,
        commandText,
        evidenceRef: sourceRef(packageRecord.packagePath, `scripts.${scriptName}`),
      });
    }
  }
}

function containingPackageRecord(index, targetPath) {
  return index.packageRecords
    .filter(
      (record) =>
        record.packageDirectory === '.' || targetPath.startsWith(`${record.packageDirectory}/`)
    )
    .sort((left, right) => right.packageDirectory.length - left.packageDirectory.length)[0];
}

function registerWorkflowBindings(index) {
  const workflowNodes = [...index.nodes.values()]
    .filter((node) => /(?:^|\/)\.github\/workflows\/[^/]+\.ya?ml$/iu.test(node.path))
    .sort((left, right) => compareText(left.path, right.path));
  for (const node of workflowNodes) {
    addMapValue(index.workflowBindings, node.path, sourceRef(node.path, 'workflow-definition'));
    let workflow;
    try {
      workflow = yaml.load(node.sourceText);
    } catch {
      continue;
    }
    if (!workflow?.jobs || typeof workflow.jobs !== 'object') continue;
    for (const [jobId, job] of Object.entries(workflow.jobs).sort(([left], [right]) =>
      compareText(left, right)
    )) {
      if (!job || typeof job !== 'object') continue;
      const steps = Array.isArray(job.steps) ? job.steps : [];
      for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
        const step = steps[stepIndex];
        if (!step || typeof step.run !== 'string') continue;
        const workingDirectory =
          step['working-directory'] ?? job.defaults?.run?.['working-directory'] ?? '.';
        if (typeof workingDirectory !== 'string' || /\$\{\{/u.test(workingDirectory)) continue;
        const workflowPackage = containingPackageRecord(index, node.path);
        const packageBase = workflowPackage?.packageDirectory || '.';
        const packagePath = normalizePath(
          path.posix.join(
            packageBase === '.' ? '' : packageBase,
            workingDirectory === '.' ? '' : workingDirectory,
            'package.json'
          )
        );
        const packageRecord = index.packageRecords.find(
          (record) => record.packagePath === packagePath
        ) || {
          packagePath,
          packageDirectory: normalizePath(workingDirectory),
          packageJson: {},
        };
        const evidenceRef = sourceRef(node.path, `jobs.${jobId}.steps[${stepIndex}].run`);
        const before = new Map(
          [...index.scriptBindings].map(([targetPath, refs]) => [targetPath, [...refs]])
        );
        registerCommandBindings(index, {
          packagePath: packageRecord.packagePath,
          packageDirectory: packageRecord.packageDirectory,
          commandText: step.run,
          evidenceRef,
        });
        for (const [targetPath, refs] of index.scriptBindings) {
          const previous = before.get(targetPath) || [];
          if (refs.includes(evidenceRef) && !previous.includes(evidenceRef)) {
            addMapValue(index.workflowBindings, targetPath, evidenceRef);
          }
        }
      }
    }
  }
}

function registryPathRows(document) {
  const rows = [];
  const push = (value, fragment) => {
    if (typeof value === 'string') rows.push({ value, fragment });
  };
  if (
    [
      'requirements-contract-consumer-registry/v1',
      'requirements-contract-consumer-registry/v2',
    ].includes(document.schemaVersion)
  ) {
    push(document.owner?.path, 'owner.path');
    for (const [index, consumer] of (document.consumers || []).entries()) {
      push(consumer?.path, `consumers[${index}].path`);
    }
    for (const key of ['declaredPaths', 'discoveredPaths']) {
      for (const [index, value] of (document.discovery?.[key] || []).entries()) {
        push(value, `discovery.${key}[${index}]`);
      }
    }
  } else if (document.schemaVersion === 'requirements-contract-projection-registry/v1') {
    push(document.owner?.path, 'owner.path');
    for (const [index, projection] of (document.projections || []).entries()) {
      push(projection?.canonicalPath, `projections[${index}].canonicalPath`);
      for (const [surfaceIndex, value] of (projection?.surfacePaths || []).entries()) {
        push(value, `projections[${index}].surfacePaths[${surfaceIndex}]`);
      }
    }
  } else if (document.schemaVersion === 'requirements-contract-canonical-assets-manifest/v2') {
    push(document.owner?.path, 'owner.path');
    for (const [index, asset] of (document.assets || []).entries()) {
      push(asset?.path, `assets[${index}].path`);
    }
  } else if (
    document.schemaVersion === 'requirements-contract-package-runtime-action-binding-manifest/v2'
  ) {
    for (const [index, action] of (document.actions || []).entries()) {
      push(action?.sourceHandlerRef?.path, `actions[${index}].sourceHandlerRef.path`);
      for (const key of ['inputSchemaRefs', 'outputSchemaRefs', 'runtimeRefs']) {
        for (const [refIndex, reference] of (action?.[key] || []).entries()) {
          push(reference?.path, `actions[${index}].${key}[${refIndex}].path`);
        }
      }
    }
  } else if (
    document.registry_id === 'script-owner-model-registry' &&
    document.status === 'frozen'
  ) {
    for (const [index, script] of (document.scripts || []).entries()) {
      push(script?.path, `scripts[${index}].path`);
      push(script?.sourceRepoPath, `scripts[${index}].sourceRepoPath`);
    }
  }
  return rows;
}

function registryAuthorityRank(registryPath) {
  if (
    /(?:^|\/)\.(?:claude|codex|cursor)\//u.test(registryPath) ||
    /(?:^|\/)\.[^/]*(?:draft|corrupt)[^/]*\//iu.test(registryPath)
  ) {
    return undefined;
  }
  if (registryPath.startsWith('_bmad/shared/requirements-contract/')) return 0;
  if (/(?:^|\/)_bmad\/shared\/requirements-contract\//u.test(registryPath)) return 1;
  if (registryPath === '_bmad/_config/script-owner-model-registry.yaml') return 0;
  if (/(?:^|\/)_bmad\/_config\/script-owner-model-registry\.yaml$/u.test(registryPath)) {
    return 1;
  }
  return undefined;
}

function resolveRegistryTarget(value, registryNode, index) {
  const rootTarget = normalizePath(value);
  if (index.nodes.has(rootTarget)) return rootTarget;
  const packageRecord = containingPackageRecord(index, registryNode.path);
  const packageTarget = normalizePath(
    path.posix.join(packageRecord?.packageDirectory || '.', value)
  );
  return index.nodes.has(packageTarget) ? packageTarget : undefined;
}

function addRegistryBinding(index, targetPath, evidenceRef, rank) {
  const currentRank = index.registryBindingRanks.get(targetPath);
  if (currentRank === undefined || rank < currentRank) {
    index.registryBindingRanks.set(targetPath, rank);
    index.registryBindings.set(targetPath, [evidenceRef]);
    return;
  }
  if (rank === currentRank) addMapValue(index.registryBindings, targetPath, evidenceRef);
}

function registerRegistryBindings(index) {
  const registryNodes = [...index.nodes.values()]
    .filter((node) => /(?:registry|manifest)\.(?:json|ya?ml)$/iu.test(node.path))
    .sort((left, right) => compareText(left.path, right.path));
  for (const node of registryNodes) {
    const rank = registryAuthorityRank(node.path);
    if (rank === undefined) continue;
    let document;
    try {
      document = node.path.endsWith('.json')
        ? JSON.parse(node.sourceText)
        : yaml.load(node.sourceText);
    } catch {
      continue;
    }
    const rows = registryPathRows(document);
    if (rows.length === 0) continue;
    addRegistryBinding(index, node.path, sourceRef(node.path, 'schemaVersion'), rank);
    for (const row of rows) {
      const targetPath = resolveRegistryTarget(row.value, node, index);
      if (!index.nodes.has(targetPath) || /(?:^|\/)(?:tests?|__tests__)\//u.test(targetPath)) {
        continue;
      }
      addRegistryBinding(index, targetPath, sourceRef(node.path, row.fragment), rank);
    }
  }
}

function collectSourceFacts(node, index) {
  if (!node.sourceFile) return;
  const imports = [];

  function visit(astNode) {
    const reference = literalModuleReference(astNode);
    if (reference) imports.push(reference);

    if (
      ts.isCallExpression(astNode) &&
      astNode.expression.kind === ts.SyntaxKind.ImportKeyword &&
      (astNode.arguments.length !== 1 || !ts.isStringLiteralLike(astNode.arguments[0]))
    ) {
      addUncertainty(index.dynamicUncertainty, {
        targetPath: node.path,
        issueCode: 'TARGET_DYNAMIC_REGISTRATION_UNRESOLVED',
        evidenceRef: sourceRef(node.path, 'dynamic-import'),
      });
    }

    if (
      ts.isElementAccessExpression(astNode) &&
      ts.isIdentifier(astNode.expression) &&
      /registry|handlers|commands|plugins|strategies/iu.test(astNode.expression.text) &&
      astNode.argumentExpression &&
      !ts.isStringLiteralLike(astNode.argumentExpression) &&
      !ts.isNumericLiteral(astNode.argumentExpression)
    ) {
      addUncertainty(index.dynamicUncertainty, {
        targetPath: node.path,
        issueCode: 'TARGET_DYNAMIC_REGISTRATION_UNRESOLVED',
        evidenceRef: sourceRef(node.path, `registry-lookup:${astNode.expression.text}`),
      });
    }
    ts.forEachChild(astNode, visit);
  }

  visit(node.sourceFile);
  collectStaticTestTargets(node, index);
  for (const { specifier, fragment } of imports.sort((left, right) =>
    compareText(`${left.specifier}\0${left.fragment}`, `${right.specifier}\0${right.fragment}`)
  )) {
    const targetPath =
      resolveLocalTarget(node.path, specifier, index.nodes) ||
      resolveGeneratedSourceTarget(node.path, specifier, index.nodes);
    if (!targetPath) continue;
    const edge = {
      from: node.path,
      to: targetPath,
      evidenceRef: sourceRef(node.path, `${fragment}:${specifier}`),
    };
    if (node.isTest) {
      addMapValue(index.testTargets, node.path, targetPath);
    } else {
      index.productionEdges.push(edge);
    }
  }
}

function buildSourceIndex({
  repoRoot,
  packagePaths = ['package.json'],
  criticalBindingPackagePaths = packagePaths,
}) {
  const index = {
    repoRoot,
    nodes: new Map(),
    packageRecords: [],
    packageExports: new Map(),
    packageBins: new Map(),
    packageBinRecords: [],
    packageManifestBindings: new Map(),
    unresolvedExports: new Map(),
    productionEdges: [],
    dynamicUncertainty: [],
    protectedBindings: [],
    protectionUncertainty: [],
    generatorOwners: new Set(),
    generatedBindingRecords: [],
    generatedBindings: new Map(),
    generatedUncertainty: [],
    registryBindingRanks: new Map(),
    registryBindings: new Map(),
    scriptBindings: new Map(),
    testTargets: new Map(),
    workflowBindings: new Map(),
    criticalBindingIssues: [],
    criticalBindingClaims: new Map(),
    ...Object.fromEntries(SOURCE_BINDING_FIELDS.map(([fieldName]) => [fieldName, new Map()])),
  };

  for (const filePath of listTargetFiles(repoRoot)) {
    index.nodes.set(filePath, parseNode(repoRoot, filePath));
  }
  readPackageMetadata(repoRoot, packagePaths, criticalBindingPackagePaths, index);
  registerPackageScriptBindings(index);
  registerWorkflowBindings(index);
  registerRegistryBindings(index);
  for (const node of index.nodes.values()) {
    const packageRecord = index.packageRecords
      .filter(
        (record) =>
          record.packageDirectory === '.' || node.path.startsWith(`${record.packageDirectory}/`)
      )
      .sort((left, right) => right.packageDirectory.length - left.packageDirectory.length)[0];
    node.packagePath = packageRecord?.packagePath || 'package.json';
    node.packageDirectory = packageRecord?.packageDirectory || '.';
    collectSourceFacts(node, index);
    if (node.isGenerated && !index.generatorOwners.has(node.path)) {
      addUncertainty(index.generatedUncertainty, {
        targetPath: node.path,
        issueCode: 'TARGET_GENERATED_OWNER_UNRESOLVED',
        evidenceRef: sourceRef(node.path, 'generator-owner-unresolved'),
      });
    }
  }
  index.productionEdges.sort((left, right) =>
    compareText(`${left.from}\0${left.to}`, `${right.from}\0${right.to}`)
  );
  return index;
}

function finding(identityKey, targetRef, value, confidence, evidenceRefs, issueCodes) {
  return {
    identityKey,
    targetRef,
    value,
    confidence,
    evidenceRefs: stableUnique(evidenceRefs),
    issueCodes: stableUnique(issueCodes),
  };
}

function matchingUncertainty(rows, targetPath) {
  return rows.filter((row) => row.targetPath === targetPath);
}

function ambiguousFrom(identityKey, targetPath, rows) {
  return finding(
    identityKey,
    targetPath,
    'ambiguous',
    'low',
    rows.map((row) => row.evidenceRef),
    rows.map((row) => row.issueCode)
  );
}

function classifyTarget(identityKey, targetPath, sourceIndex) {
  const node = sourceIndex.nodes.get(targetPath);
  if (!node) {
    return finding(
      identityKey,
      targetPath,
      'ambiguous',
      'low',
      [sourceRef(targetPath, 'target-unresolved')],
      ['TARGET_REFERENCE_UNRESOLVED']
    );
  }

  const failClosedRows = [
    ...matchingUncertainty(sourceIndex.generatedUncertainty, targetPath),
    ...(sourceIndex.unresolvedExports.get(targetPath) || []).map((evidenceRef) => ({
      evidenceRef,
      issueCode: 'TARGET_PACKAGE_EXPORT_UNRESOLVED',
    })),
    ...matchingUncertainty(sourceIndex.protectionUncertainty, targetPath),
  ];
  if (failClosedRows.length > 0) {
    return ambiguousFrom(identityKey, targetPath, failClosedRows);
  }
  if (sourceIndex.packageExports.has(targetPath)) {
    return finding(
      identityKey,
      targetPath,
      'active',
      'high',
      sourceIndex.packageExports.get(targetPath),
      []
    );
  }
  if (sourceIndex.packageBins.has(targetPath)) {
    return finding(
      identityKey,
      targetPath,
      'active',
      'high',
      sourceIndex.packageBins.get(targetPath),
      []
    );
  }

  const protectedBindings = sourceIndex.protectedBindings.filter(
    (binding) => binding.targetPath === targetPath
  );
  if (protectedBindings.length > 0) {
    return finding(
      identityKey,
      targetPath,
      'active',
      'high',
      protectedBindings.map((binding) => binding.evidenceRef),
      []
    );
  }

  const authoritativeBindingRefs = stableUnique([
    ...(sourceIndex.generatedBindings.get(targetPath) || []),
    ...(sourceIndex.packageManifestBindings.get(targetPath) || []),
    ...(sourceIndex.registryBindings.get(targetPath) || []),
    ...(sourceIndex.scriptBindings.get(targetPath) || []),
    ...(sourceIndex.workflowBindings.get(targetPath) || []),
  ]);
  if (authoritativeBindingRefs.length > 0) {
    return finding(identityKey, targetPath, 'active', 'high', authoritativeBindingRefs, []);
  }

  const dynamicRows = matchingUncertainty(sourceIndex.dynamicUncertainty, targetPath);
  if (dynamicRows.length > 0) return ambiguousFrom(identityKey, targetPath, dynamicRows);

  const productionInbound = sourceIndex.productionEdges.filter((edge) => edge.to === targetPath);
  if (productionInbound.length > 0) {
    return finding(
      identityKey,
      targetPath,
      'active',
      'high',
      productionInbound.map((edge) => edge.evidenceRef),
      []
    );
  }

  return finding(
    identityKey,
    targetPath,
    'obsolete_candidate',
    'high',
    [
      sourceRef(targetPath, 'no-production-inbound'),
      sourceRef(node.packagePath, 'not-exported'),
      sourceRef(node.packagePath, 'not-bin'),
      sourceRef(targetPath, 'no-protection'),
    ],
    ['PRODUCT_TARGET_OBSOLETE_CANDIDATE']
  );
}

function unresolvedTestFinding(identityKey, testPath, issueCode) {
  return finding(
    identityKey,
    `unresolved:${testPath || identityKey}`,
    'ambiguous',
    'low',
    [sourceRef(testPath || identityKey, 'target-unresolved')],
    [issueCode]
  );
}

async function analyze({ inventory, sourceIndex }) {
  if (!sourceIndex || !(sourceIndex.nodes instanceof Map)) {
    return {
      analyzerId: ANALYZER_ID,
      analyzerVersion: ANALYZER_VERSION,
      dimension: DIMENSION,
      required: true,
      status: 'failed',
      findings: [],
      issues: ['TARGET_VALIDITY_INITIALIZATION_FAILED'],
    };
  }

  const findings = [];
  const tests = [...(inventory?.tests || [])].sort((left, right) =>
    compareText(left.identityKey, right.identityKey)
  );
  for (const test of tests) {
    const testPath = test.testPath ? normalizePath(test.testPath) : undefined;
    if (!testPath) {
      findings.push(
        unresolvedTestFinding(test.identityKey, test.identityKey, 'TARGET_TEST_PATH_MISSING')
      );
      continue;
    }
    const testNode = sourceIndex.nodes.get(testPath);
    if (!testNode || testNode.parseErrors.length > 0) {
      findings.push(unresolvedTestFinding(test.identityKey, testPath, 'TARGET_TEST_PARSE_ERROR'));
      continue;
    }
    const targets = sourceIndex.testTargets.get(testPath) || [];
    if (targets.length === 0) {
      findings.push(
        unresolvedTestFinding(test.identityKey, testPath, 'TARGET_REFERENCE_UNRESOLVED')
      );
      continue;
    }
    for (const targetPath of targets) {
      findings.push(classifyTarget(test.identityKey, targetPath, sourceIndex));
    }
  }

  return {
    analyzerId: ANALYZER_ID,
    analyzerVersion: ANALYZER_VERSION,
    dimension: DIMENSION,
    required: true,
    status: 'complete',
    findings: findings.sort((left, right) =>
      compareText(
        `${left.identityKey}\0${left.targetRef}`,
        `${right.identityKey}\0${right.targetRef}`
      )
    ),
    issues: [],
  };
}

module.exports = {
  ANALYZER_ID,
  ANALYZER_VERSION,
  DIMENSION,
  analyze,
  buildSourceIndex,
  classifyTarget,
  isTargetFileName,
  resolveGeneratedSourceTarget,
  resolveTargetCandidate,
};
