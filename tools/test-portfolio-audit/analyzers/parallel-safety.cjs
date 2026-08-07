'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const ANALYZER_ID = 'parallel-safety';
const ANALYZER_VERSION = '1';
const DIMENSION = 'parallelSafety';
const FACT_NAMES = Object.freeze([
  'repositoryWrites',
  'processEnvMutations',
  'workingDirectoryMutations',
  'fixedTempPaths',
  'fixedPorts',
  'rootBuildPackInstall',
  'gitMutations',
  'backgroundProcesses',
  'orderDependencies',
]);
const HAZARD_RULES = Object.freeze([
  ['repositoryWrites', 'PARALLEL_REPO_GLOBAL_WRITE'],
  ['processEnvMutations', 'PARALLEL_PROCESS_ENV_MUTATION'],
  ['workingDirectoryMutations', 'PARALLEL_CWD_MUTATION'],
  ['fixedTempPaths', 'PARALLEL_FIXED_TEMP_PATH'],
  ['fixedPorts', 'PARALLEL_FIXED_PORT'],
  ['rootBuildPackInstall', 'PARALLEL_ROOT_BUILD_OR_PACK'],
  ['gitMutations', 'PARALLEL_GIT_MUTATION'],
  ['backgroundProcesses', 'PARALLEL_BACKGROUND_PROCESS'],
  ['orderDependencies', 'PARALLEL_ORDER_DEPENDENT'],
]);
const WRITE_CALLS = new Set([
  'appendFile',
  'appendFileSync',
  'chmod',
  'chmodSync',
  'copyFile',
  'copyFileSync',
  'cp',
  'cpSync',
  'link',
  'linkSync',
  'mkdir',
  'mkdirSync',
  'rename',
  'renameSync',
  'rm',
  'rmSync',
  'rmdir',
  'rmdirSync',
  'symlink',
  'symlinkSync',
  'truncate',
  'truncateSync',
  'unlink',
  'unlinkSync',
  'writeFile',
  'writeFileSync',
]);
const PROCESS_CALLS = new Set([
  'exec',
  'execFile',
  'execFileSync',
  'execSync',
  'fork',
  'spawn',
  'spawnSync',
]);
const BACKGROUND_CALLS = new Set(['exec', 'execFile', 'fork', 'spawn']);

function compareText(left, right) {
  return String(left).localeCompare(String(right), 'en');
}

function stableUnique(values) {
  return [...new Set(values.filter(Boolean).map(String))].sort(compareText);
}

function normalizePath(value) {
  return path.posix.normalize(String(value).replace(/\\/g, '/')).replace(/^\.\//, '');
}

function scriptKind(filePath) {
  if (filePath.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (filePath.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (filePath.endsWith('.js') || filePath.endsWith('.cjs') || filePath.endsWith('.mjs')) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
}

function callName(expression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return undefined;
}

function lineRef(sourceFile, testPath, node, factName) {
  const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
  return `source:${testPath}#${factName}:line:${line}`;
}

function createFacts() {
  return {
    repositoryWrites: [],
    processEnvMutations: [],
    workingDirectoryMutations: [],
    fixedTempPaths: [],
    fixedPorts: [],
    rootBuildPackInstall: [],
    gitMutations: [],
    backgroundProcesses: [],
    orderDependencies: [],
    parseErrors: [],
    refs: [],
  };
}

function addFact(facts, factName, evidenceRef) {
  facts[factName].push(evidenceRef);
  facts[factName] = stableUnique(facts[factName]);
  facts.refs = stableUnique([...facts.refs, evidenceRef]);
}

function isProcessEnvRoot(node) {
  return (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'process' &&
    node.name.text === 'env'
  );
}

function processEnvKey(node) {
  if (ts.isPropertyAccessExpression(node) && isProcessEnvRoot(node.expression)) {
    return node.name.text;
  }
  if (
    ts.isElementAccessExpression(node) &&
    isProcessEnvRoot(node.expression) &&
    node.argumentExpression &&
    ts.isStringLiteralLike(node.argumentExpression)
  ) {
    return node.argumentExpression.text;
  }
  return undefined;
}

function assignmentParts(node) {
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
    node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
  ) {
    return { left: node.left, right: node.right };
  }
  if (
    ts.isDeleteExpression(node) &&
    (ts.isPropertyAccessExpression(node.expression) ||
      ts.isElementAccessExpression(node.expression))
  ) {
    return { left: node.expression, right: undefined };
  }
  return undefined;
}

function walk(node, visitor) {
  visitor(node);
  ts.forEachChild(node, (child) => walk(child, visitor));
}

function callbackBody(call) {
  const callback = call.arguments.find(
    (argument) => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)
  );
  return callback?.body;
}

function collectSavedEnvVariables(node) {
  const saves = new Map();
  walk(node, (candidate) => {
    if (
      ts.isVariableDeclaration(candidate) &&
      ts.isIdentifier(candidate.name) &&
      candidate.initializer
    ) {
      const key = processEnvKey(candidate.initializer);
      if (key) saves.set(key, candidate.name.text);
      return;
    }
    const assignment = assignmentParts(candidate);
    if (
      assignment &&
      ts.isIdentifier(assignment.left) &&
      assignment.right &&
      processEnvKey(assignment.right)
    ) {
      saves.set(processEnvKey(assignment.right), assignment.left.text);
    }
  });
  return saves;
}

function collectEnvRestores(node) {
  const restores = new Map();
  walk(node, (candidate) => {
    const assignment = assignmentParts(candidate);
    const key = assignment && processEnvKey(assignment.left);
    if (key && assignment.right && ts.isIdentifier(assignment.right)) {
      restores.set(key, {
        variableName: assignment.right.text,
        position: candidate.getStart(),
      });
    }
  });
  return restores;
}

function collectEnvMutationPositions(node, key) {
  const positions = [];
  walk(node, (candidate) => {
    const assignment = assignmentParts(candidate);
    if (assignment && processEnvKey(assignment.left) === key) {
      positions.push(candidate.getStart());
    }
  });
  return positions;
}

function precedingStatements(node) {
  const parent = node.parent;
  if (!parent || (!ts.isBlock(parent) && !ts.isSourceFile(parent))) return [];
  const statements = [...parent.statements];
  const index = statements.indexOf(node);
  return index < 0 ? [] : statements.slice(0, index);
}

function collectProvenEnvRestorePositions(sourceFile) {
  const safePositions = new Set();

  walk(sourceFile, (node) => {
    if (!ts.isTryStatement(node) || !node.finallyBlock) return;
    const saves = new Map();
    for (const statement of precedingStatements(node)) {
      for (const [key, variableName] of collectSavedEnvVariables(statement)) {
        saves.set(key, variableName);
      }
    }
    const restores = collectEnvRestores(node.finallyBlock);
    for (const [key, restore] of restores) {
      if (saves.get(key) !== restore.variableName) continue;
      for (const position of collectEnvMutationPositions(node.tryBlock, key)) {
        safePositions.add(position);
      }
      safePositions.add(restore.position);
    }
  });

  const beforeEachSaves = new Map();
  const afterEachRestores = new Map();
  walk(sourceFile, (node) => {
    if (!ts.isCallExpression(node)) return;
    const name = callName(node.expression);
    const body = callbackBody(node);
    if (!body) return;
    if (name === 'beforeEach') {
      for (const [key, variableName] of collectSavedEnvVariables(body)) {
        beforeEachSaves.set(key, variableName);
      }
    }
    if (name === 'afterEach') {
      for (const [key, restore] of collectEnvRestores(body)) {
        afterEachRestores.set(key, restore);
      }
    }
  });
  for (const [key, variableName] of beforeEachSaves) {
    const restore = afterEachRestores.get(key);
    if (!restore || restore.variableName !== variableName) continue;
    for (const position of collectEnvMutationPositions(sourceFile, key)) {
      safePositions.add(position);
    }
  }

  return safePositions;
}

function expressionText(expression, sourceFile) {
  return expression ? expression.getText(sourceFile).replace(/\s+/gu, ' ') : '';
}

function containsCall(expression, expectedName) {
  let found = false;
  if (!expression) return false;
  walk(expression, (node) => {
    if (ts.isCallExpression(node) && callName(node.expression) === expectedName) found = true;
  });
  return found;
}

function pathExpressionKind(expression, sourceFile) {
  if (!expression) return 'unknown';
  if (containsCall(expression, 'tmpdir')) return 'fixed_temp';
  if (containsCall(expression, 'cwd')) return 'repository';
  if (ts.isStringLiteralLike(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    const value = normalizePath(expression.text);
    if (/^(?:[a-z]:)?\/?(?:tmp|temp)\//iu.test(value)) return 'fixed_temp';
    if (!path.isAbsolute(expression.text)) return 'repository';
  }
  const text = expressionText(expression, sourceFile);
  if (/process\.cwd\s*\(/u.test(text)) return 'repository';
  return 'unknown';
}

function isMkdtempPrefix(node) {
  return (
    ts.isCallExpression(node.parent) &&
    ['mkdtemp', 'mkdtempSync'].includes(callName(node.parent.expression))
  );
}

function collectCommandHints(sourceFile) {
  const hints = new Map();
  walk(sourceFile, (node) => {
    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || !node.initializer) {
      return;
    }
    const literals = [];
    walk(node.initializer, (candidate) => {
      if (ts.isStringLiteralLike(candidate)) literals.push(candidate.text);
    });
    if (literals.length > 0) hints.set(node.name.text, stableUnique(literals).join(' '));
  });
  return hints;
}

function collectProcessWrappers(sourceFile) {
  const wrappers = new Map();

  function recordWrapper(name, body) {
    if (!name || !body) return;
    const processCalls = new Set();
    walk(body, (candidate) => {
      if (!ts.isCallExpression(candidate)) return;
      const candidateName = callName(candidate.expression);
      if (PROCESS_CALLS.has(candidateName)) processCalls.add(candidateName);
    });
    if (processCalls.size === 0) return;
    wrappers.set(name, {
      background: [...processCalls].some((processCall) => BACKGROUND_CALLS.has(processCall)),
    });
  }

  walk(sourceFile, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      recordWrapper(node.name.text, node.body);
      return;
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      recordWrapper(node.name.text, node.initializer.body);
    }
  });

  return wrappers;
}

function commandText(call, sourceFile, commandHints) {
  const parts = call.arguments.map((argument) => expressionText(argument, sourceFile));
  for (const argument of call.arguments) {
    walk(argument, (node) => {
      if (ts.isIdentifier(node) && commandHints.has(node.text)) {
        parts.push(commandHints.get(node.text));
      }
    });
  }
  return parts.join(' ');
}

function isRootBuildPackInstall(command) {
  return (
    /\b(?:npm|pnpm|yarn|bun)\b[\s\S]*\b(?:build|pack|install|ci|prepare|prepublish)\b/iu.test(
      command
    ) ||
    /\b(?:build|pack|install|prepare|prepublish)[a-z0-9._-]*\.(?:cjs|mjs|js|ts)\b/iu.test(command)
  );
}

function isGitMutation(command) {
  return /\bgit\b[\s\S]*\b(?:add|am|apply|branch|checkout|cherry-pick|clean|commit|merge|mv|rebase|reset|restore|rm|stash|switch|tag|worktree)\b/iu.test(
    command
  );
}

function hasFixedPort(call) {
  if (callName(call.expression) !== 'listen') return false;
  const first = call.arguments[0];
  if (first && ts.isNumericLiteral(first)) return true;
  if (!first || !ts.isObjectLiteralExpression(first)) return false;
  return first.properties.some(
    (property) =>
      ts.isPropertyAssignment(property) &&
      property.name.getText().replace(/['"]/gu, '') === 'port' &&
      ts.isNumericLiteral(property.initializer)
  );
}

function collectIsolationFacts(sourceFile, testPath) {
  const facts = createFacts();
  const safeEnvPositions = collectProvenEnvRestorePositions(sourceFile);
  const commandHints = collectCommandHints(sourceFile);
  const processWrappers = collectProcessWrappers(sourceFile);

  walk(sourceFile, (node) => {
    const assignment = assignmentParts(node);
    if (
      assignment &&
      processEnvKey(assignment.left) &&
      !safeEnvPositions.has(node.getStart(sourceFile))
    ) {
      addFact(facts, 'processEnvMutations', lineRef(sourceFile, testPath, node, 'process-env'));
    }

    if (!ts.isCallExpression(node)) return;
    const name = callName(node.expression);
    if (name === 'chdir' && expressionText(node.expression, sourceFile).startsWith('process.')) {
      addFact(facts, 'workingDirectoryMutations', lineRef(sourceFile, testPath, node, 'cwd'));
    }
    if (WRITE_CALLS.has(name)) {
      const destinationKind = pathExpressionKind(node.arguments[0], sourceFile);
      if (destinationKind === 'repository') {
        addFact(facts, 'repositoryWrites', lineRef(sourceFile, testPath, node, 'repository-write'));
      }
    }
    if (name === 'join' && containsCall(node.arguments[0], 'tmpdir') && !isMkdtempPrefix(node)) {
      addFact(facts, 'fixedTempPaths', lineRef(sourceFile, testPath, node, 'fixed-temp'));
    }
    if (hasFixedPort(node)) {
      addFact(facts, 'fixedPorts', lineRef(sourceFile, testPath, node, 'fixed-port'));
    }
    const processWrapper = processWrappers.get(name);
    if (PROCESS_CALLS.has(name) || processWrapper) {
      const command = commandText(node, sourceFile, commandHints);
      if (isRootBuildPackInstall(command)) {
        addFact(
          facts,
          'rootBuildPackInstall',
          lineRef(sourceFile, testPath, node, 'root-build-pack-install')
        );
      }
      if (isGitMutation(command)) {
        addFact(facts, 'gitMutations', lineRef(sourceFile, testPath, node, 'git-mutation'));
      }
      if (BACKGROUND_CALLS.has(name) || processWrapper?.background) {
        addFact(
          facts,
          'backgroundProcesses',
          lineRef(sourceFile, testPath, node, 'background-process')
        );
      }
      if (/--runInBand|--sequence|--serial/u.test(command)) {
        addFact(facts, 'orderDependencies', lineRef(sourceFile, testPath, node, 'order-dependent'));
      }
    }
    const callExpressionText = expressionText(node.expression, sourceFile);
    if (/\.(?:sequential|serial)$/u.test(callExpressionText)) {
      addFact(facts, 'orderDependencies', lineRef(sourceFile, testPath, node, 'order-dependent'));
    }
  });

  for (const factName of FACT_NAMES) facts[factName] = stableUnique(facts[factName]);
  facts.refs = stableUnique(facts.refs);
  return facts;
}

function finding(identityKey, value, confidence, evidenceRefs, issueCodes, facts) {
  return {
    identityKey,
    value,
    confidence,
    evidenceRefs: stableUnique(evidenceRefs),
    issueCodes: stableUnique(issueCodes),
    isolationFacts: facts,
  };
}

function classifyStaticSafety(facts, identityKey) {
  if (facts.parseErrors.length > 0) {
    return finding(
      identityKey,
      'unknown',
      'low',
      facts.refs,
      ['PARALLEL_ANALYSIS_INCOMPLETE'],
      facts
    );
  }
  const issueCodes = HAZARD_RULES.filter(([factName]) => facts[factName].length > 0).map(
    ([, issueCode]) => issueCode
  );
  if (issueCodes.length > 0) {
    return finding(identityKey, 'unsafe', 'high', facts.refs, issueCodes, facts);
  }
  return finding(identityKey, 'safe_candidate', 'medium', facts.refs, [], facts);
}

async function analyzeTestFile({ repoRoot, testPath, identityKey = testPath }) {
  const normalizedPath = normalizePath(testPath || identityKey);
  const facts = createFacts();
  let sourceText;
  try {
    sourceText = fs.readFileSync(path.join(repoRoot, normalizedPath), 'utf8');
  } catch {
    const evidenceRef = `source:${normalizedPath}#read-error`;
    facts.parseErrors = [evidenceRef];
    facts.refs = [evidenceRef];
    return classifyStaticSafety(facts, identityKey);
  }
  const sourceFile = ts.createSourceFile(
    normalizedPath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(normalizedPath)
  );
  if (sourceFile.parseDiagnostics.length > 0) {
    facts.parseErrors = stableUnique(
      sourceFile.parseDiagnostics.map((diagnostic) => {
        const start = diagnostic.start || 0;
        const line = sourceFile.getLineAndCharacterOfPosition(start).line + 1;
        return `source:${normalizedPath}#parse-error:${diagnostic.code}:line:${line}`;
      })
    );
    facts.refs = [...facts.parseErrors];
    return classifyStaticSafety(facts, identityKey);
  }
  return classifyStaticSafety(collectIsolationFacts(sourceFile, normalizedPath), identityKey);
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
      issues: ['PARALLEL_SAFETY_INITIALIZATION_FAILED'],
    };
  }

  const findings = [];
  const tests = [...input.inventory.tests].sort((left, right) =>
    compareText(left.identityKey, right.identityKey)
  );
  for (const test of tests) {
    findings.push(
      await analyzeTestFile({
        repoRoot: input.repoRoot,
        testPath: test.testPath,
        identityKey: test.identityKey,
      })
    );
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
  HAZARD_RULES,
  analyze,
  analyzeTestFile,
  classifyStaticSafety,
  collectIsolationFacts,
};
