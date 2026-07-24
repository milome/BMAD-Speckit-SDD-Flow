'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const ANALYZER_ID = 'target-validity';
const ANALYZER_VERSION = '1';
const DIMENSION = 'targetValidity';
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.cjs', '.mjs'];
const IGNORED_DIRECTORIES = new Set(['.git', 'coverage', 'dist', 'build', 'node_modules']);

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

function listSourceFiles(repoRoot) {
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
      } else if (SOURCE_EXTENSIONS.includes(path.extname(entry.name))) {
        files.push(normalizePath(path.relative(repoRoot, absolutePath)));
      }
    }
  }

  visit(repoRoot);
  return files.sort(compareText);
}

function scriptKind(filePath) {
  if (filePath.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (filePath.endsWith('.ts')) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

function parseNode(repoRoot, filePath) {
  const sourceText = fs.readFileSync(path.join(repoRoot, filePath), 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(filePath)
  );
  return {
    path: filePath,
    sourceText,
    sourceFile,
    parseErrors: sourceFile.parseDiagnostics.map((diagnostic) => diagnostic.code),
    isTest:
      /(^|\/)(?:tests?|__tests__)\//u.test(filePath) ||
      /\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(filePath),
    isGenerated: /@generated|generated file|do not edit/iu.test(sourceText),
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

function addMapValue(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
  map.set(key, stableUnique(map.get(key)));
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

function registerBins({ packageJson, packagePath, packageDirectory, packageBins }) {
  const binEntries =
    typeof packageJson.bin === 'string'
      ? [[packageJson.name || '.', packageJson.bin]]
      : Object.entries(packageJson.bin || {});
  for (const [binName, relativeTarget] of binEntries.sort(([left], [right]) =>
    compareText(left, right)
  )) {
    if (typeof relativeTarget !== 'string' || !relativeTarget.startsWith('./')) continue;
    addMapValue(
      packageBins,
      normalizePath(path.posix.join(packageDirectory, relativeTarget)),
      sourceRef(packagePath, `bin:${binName}`)
    );
  }
}

function readPackageMetadata(repoRoot, packagePaths, index) {
  for (const rawPackagePath of stableUnique(packagePaths)) {
    const packagePath = normalizePath(rawPackagePath);
    const absolutePath = path.join(repoRoot, packagePath);
    const packageJson = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    const packageDirectory = normalizePath(path.posix.dirname(packagePath));
    index.packageRecords.push({ packagePath, packageDirectory });
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
    });

    const auditConfig = packageJson.testPortfolioAudit || {};
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
  }
  index.packageRecords.sort((left, right) => compareText(left.packagePath, right.packagePath));
  index.protectedBindings.sort((left, right) => compareText(left.targetPath, right.targetPath));
}

function collectSourceFacts(node, index) {
  const imports = [];

  function visit(astNode) {
    let specifier;
    let fragment = 'import';
    if (
      (ts.isImportDeclaration(astNode) || ts.isExportDeclaration(astNode)) &&
      astNode.moduleSpecifier &&
      ts.isStringLiteralLike(astNode.moduleSpecifier)
    ) {
      specifier = astNode.moduleSpecifier.text;
      fragment = ts.isExportDeclaration(astNode) ? 'export' : 'import';
    } else if (
      ts.isCallExpression(astNode) &&
      ts.isIdentifier(astNode.expression) &&
      astNode.expression.text === 'require' &&
      astNode.arguments.length === 1 &&
      ts.isStringLiteralLike(astNode.arguments[0])
    ) {
      specifier = astNode.arguments[0].text;
      fragment = 'require';
    }

    if (specifier) imports.push({ specifier, fragment });

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
  for (const { specifier, fragment } of imports.sort((left, right) =>
    compareText(`${left.specifier}\0${left.fragment}`, `${right.specifier}\0${right.fragment}`)
  )) {
    const targetPath = resolveLocalTarget(node.path, specifier, index.nodes);
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

function buildSourceIndex({ repoRoot, packagePaths = ['package.json'] }) {
  const index = {
    repoRoot,
    nodes: new Map(),
    packageRecords: [],
    packageExports: new Map(),
    packageBins: new Map(),
    unresolvedExports: new Map(),
    productionEdges: [],
    dynamicUncertainty: [],
    protectedBindings: [],
    protectionUncertainty: [],
    generatorOwners: new Set(),
    generatedUncertainty: [],
    testTargets: new Map(),
  };

  for (const filePath of listSourceFiles(repoRoot)) {
    index.nodes.set(filePath, parseNode(repoRoot, filePath));
  }
  readPackageMetadata(repoRoot, packagePaths, index);
  for (const node of index.nodes.values()) {
    const packageRecord = index.packageRecords
      .filter(
        (record) =>
          record.packageDirectory === '.' || node.path.startsWith(`${record.packageDirectory}/`)
      )
      .sort((left, right) => right.packageDirectory.length - left.packageDirectory.length)[0];
    node.packagePath = packageRecord?.packagePath || 'package.json';
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
};
