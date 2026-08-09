'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const ANALYZER_ID = 'oracle-effectiveness';
const ANALYZER_VERSION = '1';
const DIMENSION = 'oracleEffectiveness';
const PROCESS_CALLS = new Set([
  'exec',
  'execFile',
  'execFileSync',
  'execSync',
  'fork',
  'spawn',
  'spawnSync',
]);
const SOURCE_READ_CALLS = new Set(['readFile', 'readFileSync']);
const NODE_ASSERT_MODULES = new Set(['node:assert', 'node:assert/strict']);

function compareText(left, right) {
  return String(left).localeCompare(String(right), 'en');
}

function stableUnique(values) {
  return [...new Set(values.filter(Boolean).map(String))].sort(compareText);
}

function normalizePath(value) {
  return path.posix.normalize(String(value).replace(/\\/g, '/')).replace(/^\.\//, '');
}

function callName(expression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return undefined;
}

function lineRef(sourceFile, testPath, node, label) {
  const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
  return `source:${testPath}#${label}:line:${line}`;
}

function finding({
  identityKey,
  value,
  confidence,
  evidenceRefs,
  issueCodes,
  evidenceRole,
  claimedRoles,
}) {
  return {
    identityKey,
    value,
    confidence,
    evidenceRefs: stableUnique(evidenceRefs),
    issueCodes: stableUnique(issueCodes),
    ...(evidenceRole ? { evidenceRole } : {}),
    ...(claimedRoles ? { claimedRoles: stableUnique(claimedRoles) } : {}),
  };
}

function parseTestFile(repoRoot, testPath) {
  const normalizedPath = normalizePath(testPath);
  try {
    const sourceText = fs.readFileSync(path.join(repoRoot, normalizedPath), 'utf8');
    const sourceFile = ts.createSourceFile(
      normalizedPath,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      normalizedPath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    return { normalizedPath, sourceText, sourceFile, readError: undefined };
  } catch (error) {
    return { normalizedPath, sourceText: '', sourceFile: undefined, readError: error };
  }
}

function collectVariables(sourceFile) {
  const variables = new Map();
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      variables.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return variables;
}

function expressionContainsCall(expression, names) {
  let found = false;
  function visit(node) {
    if (found) return;
    if (ts.isCallExpression(node) && names.has(callName(node.expression))) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(expression);
  return found;
}

function expressionUsesVariable(expression, variables) {
  let found = false;
  function visit(node) {
    if (found) return;
    if (ts.isIdentifier(node) && variables.has(node.text)) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(expression);
  return found;
}

function expressionUsesProperty(expression, names) {
  let found = false;
  function visit(node) {
    if (found) return;
    if (ts.isPropertyAccessExpression(node) && names.has(node.name.text)) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(expression);
  return found;
}

function expressionText(expression, sourceFile) {
  return expression.getText(sourceFile).replace(/\s+/gu, '');
}

function expressionProvenance(expression, sourceFile, variables, seen = new Set()) {
  if (ts.isIdentifier(expression) && variables.has(expression.text)) {
    if (seen.has(expression.text)) return `cycle:${expression.text}`;
    const nextSeen = new Set(seen);
    nextSeen.add(expression.text);
    return expressionProvenance(variables.get(expression.text), sourceFile, variables, nextSeen);
  }
  if (ts.isCallExpression(expression)) {
    return `call:${expressionText(expression.expression, sourceFile)}(${expression.arguments
      .map((argument) => expressionProvenance(argument, sourceFile, variables, seen))
      .join(',')})`;
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return `${expressionProvenance(
      expression.expression,
      sourceFile,
      variables,
      seen
    )}.${expression.name.text}`;
  }
  if (
    ts.isStringLiteralLike(expression) ||
    ts.isNumericLiteral(expression) ||
    expression.kind === ts.SyntaxKind.TrueKeyword ||
    expression.kind === ts.SyntaxKind.FalseKeyword ||
    expression.kind === ts.SyntaxKind.NullKeyword
  ) {
    return `literal:${expressionText(expression, sourceFile)}`;
  }
  return `expression:${expressionText(expression, sourceFile)}`;
}

function requiredModuleName(expression) {
  if (
    !ts.isCallExpression(expression) ||
    !ts.isIdentifier(expression.expression) ||
    expression.expression.text !== 'require' ||
    expression.arguments.length !== 1 ||
    !ts.isStringLiteralLike(expression.arguments[0])
  ) {
    return undefined;
  }
  return expression.arguments[0].text;
}

function collectNodeAssertBindings(sourceFile) {
  const bindings = new Set();
  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      if (NODE_ASSERT_MODULES.has(node.moduleSpecifier.text)) {
        const clause = node.importClause;
        if (clause?.name) bindings.add(clause.name.text);
        if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
          bindings.add(clause.namedBindings.name.text);
        }
        if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
          for (const element of clause.namedBindings.elements) {
            if ((element.propertyName || element.name).text === 'strict') {
              bindings.add(element.name.text);
            }
          }
        }
      }
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      (NODE_ASSERT_MODULES.has(requiredModuleName(node.initializer)) ||
        (ts.isPropertyAccessExpression(node.initializer) &&
          node.initializer.name.text === 'strict' &&
          NODE_ASSERT_MODULES.has(requiredModuleName(node.initializer.expression))))
    ) {
      bindings.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return bindings;
}

function matcherCall(node, nodeAssertBindings) {
  if (!ts.isCallExpression(node)) return undefined;
  const matcherNames = [];
  let expression = node.expression;
  while (ts.isPropertyAccessExpression(expression)) {
    matcherNames.unshift(expression.name.text);
    expression = expression.expression;
  }
  if (
    ts.isCallExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === 'expect' &&
    expression.arguments.length > 0
  ) {
    return {
      node,
      actual: expression.arguments[0],
      expected: node.arguments[0],
      matcherNames,
    };
  }
  if (
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    nodeAssertBindings.has(node.expression.expression.text) &&
    node.arguments.length > 0
  ) {
    return {
      node,
      actual: node.arguments[0],
      expected: node.arguments[1],
      matcherNames: [node.expression.name.text],
    };
  }
  return undefined;
}

function containsBareReturn(statement) {
  let found = false;
  function visit(node) {
    if (found) return;
    if (ts.isReturnStatement(node) && !node.expression) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(statement);
  return found;
}

function testDeclaration(node) {
  if (!ts.isCallExpression(node)) return undefined;
  const name =
    ts.isCallExpression(node.expression) &&
    ts.isPropertyAccessExpression(node.expression.expression) &&
    node.expression.expression.name.text === 'each'
      ? callName(node.expression.expression.expression)
      : callName(node.expression);
  if (!['it', 'test'].includes(name)) return undefined;
  const title = node.arguments[0];
  const callback = node.arguments.find(
    (argument, index) =>
      index > 0 && (ts.isArrowFunction(argument) || ts.isFunctionExpression(argument))
  );
  return {
    title: title && ts.isStringLiteralLike(title) ? title.text : '',
    titleNode: title,
    callback,
  };
}

function collectStableAssertionRefs(sourceFile, testPath, nodeAssertBindings) {
  const byNode = new Map();
  const records = [];
  const titleOccurrences = new Map();

  function visit(node) {
    const declaration = testDeclaration(node);
    if (!declaration?.callback) {
      ts.forEachChild(node, visit);
      return;
    }

    const title =
      declaration.title || declaration.titleNode?.getText(sourceFile).trim() || '<missing>';
    const occurrence = (titleOccurrences.get(title) || 0) + 1;
    titleOccurrences.set(title, occurrence);
    let assertionIndex = 0;

    function visitTestBody(current) {
      if (current !== declaration.callback.body && testDeclaration(current)) return;
      const assertion = matcherCall(current, nodeAssertBindings);
      if (assertion) {
        assertionIndex += 1;
        const lineEvidenceRef = lineRef(sourceFile, testPath, assertion.node, 'assertion');
        const stableEvidenceRef = `source:${testPath}#test:${encodeURIComponent(
          title
        )}:case:${occurrence}:assertion:${assertionIndex}`;
        byNode.set(assertion.node, stableEvidenceRef);
        records.push({ lineEvidenceRef, stableEvidenceRef });
      }
      ts.forEachChild(current, visitTestBody);
    }

    visitTestBody(declaration.callback.body);
  }

  visit(sourceFile);
  return { byNode, records };
}

function assertionEvidenceRefMapForFile({ repoRoot, testPath }) {
  const parsed = parseTestFile(repoRoot, testPath);
  if (parsed.readError) throw parsed.readError;
  return assertionEvidenceRefMapForSource({
    testPath: parsed.normalizedPath,
    sourceText: parsed.sourceText,
  });
}

function assertionEvidenceRefMapForSource({ testPath, sourceText }) {
  const normalizedPath = normalizePath(testPath);
  const sourceFile = ts.createSourceFile(
    normalizedPath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    normalizedPath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  if (sourceFile.parseDiagnostics.length > 0) {
    throw new Error('ORACLE_TEST_PARSE_ERROR');
  }
  return collectStableAssertionRefs(
    sourceFile,
    normalizedPath,
    collectNodeAssertBindings(sourceFile)
  ).records;
}

function collectHiddenSkipRefs(callbackBody, sourceFile, testPath) {
  const refs = [];
  function visit(node) {
    if (
      ts.isIfStatement(node) &&
      (containsBareReturn(node.thenStatement) ||
        (node.elseStatement && containsBareReturn(node.elseStatement)))
    ) {
      refs.push(lineRef(sourceFile, testPath, node, 'hidden-skip'));
    }
    ts.forEachChild(node, visit);
  }
  visit(callbackBody);
  return refs;
}

function collectClaims(testTitles, declaredRoles = []) {
  const roles = [...declaredRoles];
  const text = testTitles.join(' ');
  if (/\bbehaviou?ral?\b/iu.test(text)) roles.push('behavioral');
  if (/\bintegration\b/iu.test(text)) roles.push('integration');
  if (/\be2e\b|end[- ]to[- ]end/iu.test(text)) roles.push('process_e2e');
  return stableUnique(roles);
}

function collectOracleFacts(sourceFile, testPath, declaredRoles) {
  const variables = collectVariables(sourceFile);
  const nodeAssertBindings = collectNodeAssertBindings(sourceFile);
  const stableAssertionRefs = collectStableAssertionRefs(
    sourceFile,
    testPath,
    nodeAssertBindings
  ).byNode;
  const sourceVariables = new Set();
  const processVariables = new Set();
  const assertions = [];
  const refs = [];
  const testTitles = [];
  const hiddenSkipRefs = [];
  const processRefs = [];

  for (const [name, initializer] of variables) {
    if (expressionContainsCall(initializer, SOURCE_READ_CALLS)) sourceVariables.add(name);
    if (expressionContainsCall(initializer, PROCESS_CALLS)) processVariables.add(name);
  }

  function visit(node) {
    const declaration = testDeclaration(node);
    if (declaration) {
      testTitles.push(declaration.title);
      if (declaration.callback) {
        hiddenSkipRefs.push(
          ...collectHiddenSkipRefs(declaration.callback.body, sourceFile, testPath)
        );
      }
    }

    const assertion = matcherCall(node, nodeAssertBindings);
    if (assertion) {
      assertions.push(assertion);
      refs.push(lineRef(sourceFile, testPath, node, 'assertion'));
      refs.push(stableAssertionRefs.get(assertion.node));
    }
    if (ts.isCallExpression(node) && PROCESS_CALLS.has(callName(node.expression))) {
      processRefs.push(lineRef(sourceFile, testPath, node, 'process-boundary'));
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  const tautologyRefs = [];
  const selfGeneratedRefs = [];
  let sourceAssertionCount = 0;
  let processExitAssertionCount = 0;
  let processOutputAssertionCount = 0;
  let negativeAssertionCount = 0;
  let behavioralAssertionCount = 0;

  for (const assertion of assertions) {
    const matcher = assertion.matcherNames.at(-1) || '';
    const assertionRef = lineRef(sourceFile, testPath, assertion.node, 'assertion');
    const actualText = expressionText(assertion.actual, sourceFile);
    const expectedText = assertion.expected
      ? expressionText(assertion.expected, sourceFile)
      : undefined;
    if (
      assertion.expected &&
      actualText === expectedText &&
      /toBe|toEqual|toStrictEqual|toMatchObject/u.test(matcher)
    ) {
      tautologyRefs.push(assertionRef);
    } else if (
      assertion.expected &&
      ts.isIdentifier(assertion.expected) &&
      /expected|golden|baseline|hash/iu.test(assertion.expected.text) &&
      expressionProvenance(assertion.actual, sourceFile, variables) ===
        expressionProvenance(assertion.expected, sourceFile, variables)
    ) {
      selfGeneratedRefs.push(assertionRef);
    }

    const sourceAssertion =
      expressionContainsCall(assertion.actual, SOURCE_READ_CALLS) ||
      expressionUsesVariable(assertion.actual, sourceVariables);
    const processAssertion =
      expressionContainsCall(assertion.actual, PROCESS_CALLS) ||
      expressionUsesVariable(assertion.actual, processVariables);
    const exitAssertion =
      processAssertion &&
      expressionUsesProperty(assertion.actual, new Set(['code', 'exitCode', 'status']));
    const outputAssertion =
      processAssertion &&
      expressionUsesProperty(assertion.actual, new Set(['output', 'state', 'stderr', 'stdout']));
    const negativeAssertion =
      assertion.matcherNames.some((name) => /^(?:doesNot|not)/u.test(name)) ||
      /toThrow|toReject|rejects|toBeRejected/iu.test(assertion.matcherNames.join('.'));

    if (sourceAssertion) sourceAssertionCount += 1;
    if (exitAssertion) processExitAssertionCount += 1;
    if (outputAssertion) processOutputAssertionCount += 1;
    if (negativeAssertion) negativeAssertionCount += 1;
    if (!sourceAssertion && !exitAssertion) behavioralAssertionCount += 1;
  }

  return {
    refs: stableUnique([...refs, ...hiddenSkipRefs, ...processRefs]),
    tautologyRefs: stableUnique(tautologyRefs),
    selfGeneratedRefs: stableUnique(selfGeneratedRefs),
    hiddenSkipRefs: stableUnique(hiddenSkipRefs),
    assertions,
    sourceAssertionCount,
    processExitAssertionCount,
    processOutputAssertionCount,
    negativeAssertionCount,
    behavioralAssertionCount,
    hasProcessBoundary: processRefs.length > 0,
    claimedRoles: collectClaims(testTitles, declaredRoles),
  };
}

function parseFailureFinding(identityKey, testPath, issueCode) {
  return finding({
    identityKey,
    value: 'ambiguous',
    confidence: 'low',
    evidenceRefs: [`source:${testPath}#parse-unresolved`],
    issueCodes: [issueCode],
  });
}

async function analyzeTestFile({ repoRoot, testPath, identityKey = testPath, claimedRoles = [] }) {
  const parsed = parseTestFile(repoRoot, testPath);
  if (parsed.readError) {
    return parseFailureFinding(identityKey, parsed.normalizedPath, 'ORACLE_TEST_READ_ERROR');
  }
  if (parsed.sourceFile.parseDiagnostics.length > 0) {
    return parseFailureFinding(identityKey, parsed.normalizedPath, 'ORACLE_TEST_PARSE_ERROR');
  }

  const facts = collectOracleFacts(parsed.sourceFile, parsed.normalizedPath, claimedRoles);
  const ineffectiveIssues = [];
  if (facts.tautologyRefs.length > 0) ineffectiveIssues.push('ORACLE_TAUTOLOGY');
  if (facts.selfGeneratedRefs.length > 0) {
    ineffectiveIssues.push('ORACLE_SELF_GENERATED_EXPECTED');
  }
  if (facts.hiddenSkipRefs.length > 0) ineffectiveIssues.push('ORACLE_SKIP_AS_PASS');
  if (
    facts.hasProcessBoundary &&
    facts.processExitAssertionCount > 0 &&
    facts.processOutputAssertionCount === 0
  ) {
    ineffectiveIssues.push('ORACLE_EXIT_CODE_ONLY');
  }
  if (ineffectiveIssues.length > 0) {
    return finding({
      identityKey,
      value: 'ineffective_candidate',
      confidence: 'medium',
      evidenceRefs: facts.refs,
      issueCodes: ineffectiveIssues,
      claimedRoles: facts.claimedRoles,
    });
  }

  const sourceOnly =
    facts.sourceAssertionCount > 0 &&
    facts.sourceAssertionCount === facts.assertions.length &&
    facts.behavioralAssertionCount === 0;
  if (sourceOnly) {
    const overclaimed = facts.claimedRoles.some((role) =>
      ['behavioral', 'integration', 'process_e2e'].includes(role)
    );
    return finding({
      identityKey,
      value: 'effective',
      confidence: 'high',
      evidenceRefs: facts.refs,
      issueCodes: overclaimed ? ['ORACLE_ROLE_OVERCLAIM'] : [],
      evidenceRole: 'structural_contract',
      claimedRoles: stableUnique(['structural_contract', ...facts.claimedRoles]),
    });
  }
  if (facts.hasProcessBoundary && facts.processOutputAssertionCount > 0) {
    return finding({
      identityKey,
      value: 'effective',
      confidence: 'high',
      evidenceRefs: facts.refs,
      issueCodes: [],
      evidenceRole: 'process_boundary',
      claimedRoles: stableUnique(['behavioral', 'process_boundary', ...facts.claimedRoles]),
    });
  }
  if (facts.negativeAssertionCount > 0 || facts.behavioralAssertionCount > 0) {
    return finding({
      identityKey,
      value: 'effective',
      confidence: 'high',
      evidenceRefs: facts.refs,
      issueCodes: [],
      evidenceRole: 'behavioral',
      claimedRoles: stableUnique(['behavioral', ...facts.claimedRoles]),
    });
  }
  return finding({
    identityKey,
    value: 'ambiguous',
    confidence: 'low',
    evidenceRefs:
      facts.refs.length > 0
        ? facts.refs
        : [`source:${parsed.normalizedPath}#oracle-independence-unresolved`],
    issueCodes: ['ORACLE_INDEPENDENCE_UNPROVEN'],
    claimedRoles: facts.claimedRoles,
  });
}

async function analyze(input) {
  if (typeof input?.repoRoot !== 'string' || !Array.isArray(input?.inventory?.tests)) {
    return {
      analyzerId: ANALYZER_ID,
      analyzerVersion: ANALYZER_VERSION,
      dimension: DIMENSION,
      required: true,
      status: 'failed',
      findings: [],
      issues: ['ORACLE_EFFECTIVENESS_INITIALIZATION_FAILED'],
    };
  }

  const findings = [];
  const tests = [...input.inventory.tests].sort((left, right) =>
    compareText(left.identityKey, right.identityKey)
  );
  for (const test of tests) {
    const testPath = test.testPath;
    if (typeof testPath !== 'string' || testPath.trim() === '') {
      findings.push(
        parseFailureFinding(test.identityKey, test.identityKey, 'ORACLE_TEST_PATH_MISSING')
      );
      continue;
    }
    try {
      findings.push(
        await analyzeTestFile({
          repoRoot: input.repoRoot,
          testPath,
          identityKey: test.identityKey,
          claimedRoles: test.claimedRoles || [],
        })
      );
    } catch {
      findings.push(parseFailureFinding(test.identityKey, testPath, 'ORACLE_ANALYSIS_ERROR'));
    }
  }

  return {
    analyzerId: ANALYZER_ID,
    analyzerVersion: ANALYZER_VERSION,
    dimension: DIMENSION,
    required: true,
    status: 'complete',
    findings,
    issues: [],
  };
}

module.exports = {
  ANALYZER_ID,
  ANALYZER_VERSION,
  DIMENSION,
  analyze,
  analyzeTestFile,
  assertionEvidenceRefMapForFile,
  assertionEvidenceRefMapForSource,
};
