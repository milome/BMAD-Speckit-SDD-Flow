const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');

const {
  AUDIT_SCHEMA_VERSION,
  canonicalJsonBytes,
  compareTestIdentity,
  normalizeRepoPath,
  sha256Bytes,
  stableUnique,
  validateCanonicalAudit,
} = require('./canonical.cjs');

const VITEST_RUNNER_ID = 'root-vitest';
const NODE_RUNNER_ID = 'bmad-speckit-node-test';
const SKIPPED_DIRECTORIES = new Set([
  '.artifacts',
  '.codex-tmp',
  '.git',
  '.worktrees',
  'dist',
  'node_modules',
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function collectFiles(root, predicate) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && SKIPPED_DIRECTORIES.has(entry.name)) continue;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
      } else if (entry.isFile() && predicate(absolutePath, entry.name)) {
        files.push(absolutePath);
      }
    }
  };
  visit(root);
  return files.sort();
}

function discoveryIssue(code, sourceRef, detail) {
  return { code, sourceRef, detail };
}

function runVitestList({ repoRoot, configPath, vitestBin, selectors = [] }) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'test-portfolio-vitest-list-'));
  const outputPath = path.join(tempRoot, 'files.json');
  const args = [vitestBin, 'list', ...selectors, '--filesOnly', `--json=${outputPath}`];
  if (fs.existsSync(path.join(repoRoot, configPath))) {
    args.push('--config', configPath);
  }

  try {
    const result = childProcess.spawnSync(process.execPath, args, {
      cwd: repoRoot,
      encoding: 'utf8',
      env: { ...process.env, CI: '1', NO_COLOR: '1' },
      maxBuffer: 16 * 1024 * 1024,
    });
    if (result.error || result.status !== 0 || !fs.existsSync(outputPath)) {
      return {
        files: [],
        issue: discoveryIssue(
          'VITEST_DISCOVERY_FAILED',
          `source:${configPath}`,
          String(result.error?.message || result.stderr || `exit ${result.status}`).trim()
        ),
      };
    }

    const rows = readJson(outputPath);
    if (!Array.isArray(rows)) {
      return {
        files: [],
        issue: discoveryIssue(
          'VITEST_DISCOVERY_OUTPUT_INVALID',
          `source:${configPath}`,
          'Vitest list JSON must be an array'
        ),
      };
    }

    return {
      files: rows
        .map((row) => row && row.file)
        .filter((file) => typeof file === 'string')
        .map((file) => normalizeRepoPath(repoRoot, file)),
      issue: null,
    };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function configuredVitestSelectors(repoRoot) {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return [];
  const scripts = readJson(packageJsonPath).scripts || {};
  return stableUnique(Object.values(scripts).flatMap(extractTestSelectors)).filter((testPath) =>
    fs.existsSync(path.join(repoRoot, testPath))
  );
}

function discoverVitestTests({ repoRoot, configPath = 'vitest.config.ts' }) {
  const vitestBin = path.join(repoRoot, 'node_modules', 'vitest', 'vitest.mjs');
  if (!fs.existsSync(vitestBin)) {
    return {
      tests: [],
      issues: [
        discoveryIssue(
          'VITEST_RUNNER_UNAVAILABLE',
          'source:package.json#devDependencies.vitest',
          'node_modules/vitest/vitest.mjs is unavailable'
        ),
      ],
    };
  }

  const defaultRun = runVitestList({ repoRoot, configPath, vitestBin });
  const selectors = configuredVitestSelectors(repoRoot);
  const selectedRun =
    selectors.length === 0
      ? { files: [], issue: null }
      : runVitestList({ repoRoot, configPath, vitestBin, selectors });
  const issues = [defaultRun.issue, selectedRun.issue].filter(Boolean);
  const defaultFiles = new Set(defaultRun.files);
  return {
    tests: stableUnique([...defaultRun.files, ...selectedRun.files]).map((testPath) => ({
      testPath,
      runnerId: VITEST_RUNNER_ID,
      defaultIncluded: defaultFiles.has(testPath),
      evidenceRefs: [
        `source:${configPath}`,
        ...(selectors.includes(testPath) ? ['source:package.json#scripts'] : []),
      ],
    })),
    issues,
  };
}

function discoverNodeTests({ repoRoot }) {
  const scriptPath = 'packages/bmad-speckit/scripts/run-node-tests.cjs';
  const testsRoot = path.join(repoRoot, 'packages', 'bmad-speckit', 'tests');
  if (!fs.existsSync(path.join(repoRoot, scriptPath))) {
    return {
      tests: [],
      issues: [
        discoveryIssue(
          'NODE_RUNNER_ADAPTER_UNAVAILABLE',
          `source:${scriptPath}`,
          'Configured Node runner script is unavailable'
        ),
      ],
    };
  }

  return {
    tests: collectFiles(testsRoot, (_absolutePath, name) => name.endsWith('.test.js')).map(
      (absolutePath) => ({
        testPath: normalizeRepoPath(repoRoot, absolutePath),
        runnerId: NODE_RUNNER_ID,
        evidenceRefs: [`source:${scriptPath}`],
      })
    ),
    issues: [],
  };
}

function extractTestSelectors(command) {
  return stableUnique(
    String(command).match(/[A-Za-z0-9_./\\-]+\.(?:test|spec)\.[cm]?[jt]sx?/g) || []
  ).map((value) => value.replace(/\\/g, '/').replace(/^\.\//, ''));
}

function splitCommand(command) {
  return String(command)
    .split(/&&|\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function target(runnerId, selectors = []) {
  return { runnerId, selectors: stableUnique(selectors) };
}

function resolveScriptTargets(scriptName, scripts, stack = []) {
  if (stack.includes(scriptName)) return [];
  const command = scripts[scriptName];
  if (typeof command !== 'string') return [];
  return resolveCommandTargets(command, scripts, [...stack, scriptName]);
}

function resolveCommandTargets(command, scripts, stack = []) {
  const targets = [];
  for (const segment of splitCommand(command)) {
    const npmRun = segment.match(/\bnpm\s+run\s+([A-Za-z0-9:_-]+)/);
    if (npmRun) {
      if (/--prefix\s+packages[\\/]bmad-speckit\b/.test(segment)) {
        if (npmRun[1] === 'test') targets.push(target(NODE_RUNNER_ID));
      } else {
        targets.push(...resolveScriptTargets(npmRun[1], scripts, stack));
      }
      continue;
    }

    if (/\b(?:npx\s+)?vitest\s+(?:run|list)\b/.test(segment)) {
      targets.push(target(VITEST_RUNNER_ID, extractTestSelectors(segment)));
    }
    if (/\btools[\\/]run-root-tests\.cjs\b/.test(segment)) {
      const selectors = extractTestSelectors(segment);
      targets.push(target(VITEST_RUNNER_ID, selectors), target(NODE_RUNNER_ID, selectors));
    }
    if (/\bpackages[\\/]bmad-speckit[\\/]scripts[\\/]run-node-tests\.cjs\b/.test(segment)) {
      targets.push(target(NODE_RUNNER_ID, extractTestSelectors(segment)));
    }
  }
  return targets;
}

function readWorkflowCommands(repoRoot) {
  const workflowRoot = path.join(repoRoot, '.github', 'workflows');
  const commands = [];
  for (const absolutePath of collectFiles(workflowRoot, (_file, name) => /\.ya?ml$/i.test(name))) {
    const workflowPath = normalizeRepoPath(repoRoot, absolutePath);
    const lines = fs.readFileSync(absolutePath, 'utf8').split(/\r?\n/);
    let inJobs = false;
    let jobId = null;
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (/^jobs:\s*$/.test(line)) {
        inJobs = true;
        continue;
      }
      if (!inJobs) continue;
      const jobMatch = line.match(/^\s{2}([A-Za-z0-9_-]+):\s*$/);
      if (jobMatch) {
        jobId = jobMatch[1];
        continue;
      }
      const runMatch = line.match(/^\s{8}run:\s+(.+?)\s*$/);
      if (!jobId || !runMatch || runMatch[1] === '|') continue;
      commands.push({
        workflowPath,
        jobId,
        line: index + 1,
        command: runMatch[1],
      });
    }
  }
  return commands;
}

function selectorMatches(testPath, selectors) {
  if (selectors.length === 0) return true;
  return selectors.some(
    (selector) =>
      testPath === selector ||
      testPath.endsWith(`/${selector}`) ||
      path.posix.basename(testPath) === path.posix.basename(selector)
  );
}

function attachWorkflowRoutes({ repoRoot, tests }) {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const scripts = fs.existsSync(packageJsonPath) ? readJson(packageJsonPath).scripts || {} : {};
  const routesByIdentity = new Map();

  for (const row of tests) {
    routesByIdentity.set(`${row.runnerId}\0${row.testPath}`, []);
  }

  for (const workflowCommand of readWorkflowCommands(repoRoot)) {
    const targets = resolveCommandTargets(workflowCommand.command, scripts);
    for (const routeTarget of targets) {
      for (const row of tests) {
        if (
          row.runnerId !== routeTarget.runnerId ||
          (routeTarget.runnerId === VITEST_RUNNER_ID &&
            routeTarget.selectors.length === 0 &&
            row.defaultIncluded === false) ||
          !selectorMatches(row.testPath, routeTarget.selectors)
        ) {
          continue;
        }
        const routeRef =
          `route:${workflowCommand.workflowPath}/${workflowCommand.jobId}` +
          `#L${workflowCommand.line}`;
        routesByIdentity.get(`${row.runnerId}\0${row.testPath}`).push(routeRef);
      }
    }
  }

  return tests.map((row) => ({
    ...row,
    routeRefs: stableUnique(routesByIdentity.get(`${row.runnerId}\0${row.testPath}`) || []),
  }));
}

function discoverConfiguredTests({ repoRoot }) {
  const vitest = discoverVitestTests({ repoRoot });
  const node = discoverNodeTests({ repoRoot });
  const tests = attachWorkflowRoutes({
    repoRoot,
    tests: [...vitest.tests, ...node.tests].sort(compareTestIdentity),
  });
  return {
    tests,
    issues: [...vitest.issues, ...node.issues],
  };
}

function sourceLineRef(testPath, source, pattern) {
  const match = pattern.exec(source);
  if (!match) return `source:${testPath}`;
  const line = source.slice(0, match.index).split(/\r?\n/).length;
  return `source:${testPath}#L${line}`;
}

function scriptKindFor(testPath) {
  if (/\.tsx$/i.test(testPath)) return ts.ScriptKind.TSX;
  if (/\.jsx$/i.test(testPath)) return ts.ScriptKind.JSX;
  if (/\.[cm]?js$/i.test(testPath)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function maskRange(buffer, start, end) {
  for (let index = start; index < end; index += 1) {
    if (buffer[index] !== '\r' && buffer[index] !== '\n') buffer[index] = ' ';
  }
}

function maskLiteralsAndComments(source, testPath) {
  const masked = source.split('');
  const commentPattern = /\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g;
  let match;
  while ((match = commentPattern.exec(source)) !== null) {
    maskRange(masked, match.index, match.index + match[0].length);
  }

  const sourceFile = ts.createSourceFile(
    testPath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(testPath)
  );
  const visit = (node) => {
    if (ts.isStringLiteralLike(node) || node.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral) {
      maskRange(masked, node.getStart(sourceFile), node.getEnd());
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return masked.join('');
}

function extractStaticLocalImports(source, testPath) {
  const sourceFile = ts.createSourceFile(
    testPath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(testPath)
  );
  const imports = [];
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier) &&
      node.moduleSpecifier.text.startsWith('.')
    ) {
      imports.push(node.moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return stableUnique(imports);
}

function resolveLocalImport(repoRoot, testPath, importPath) {
  const base = path.resolve(repoRoot, path.posix.dirname(testPath), importPath);
  const extension = path.extname(base);
  const hasSourceExtension = new Set([
    '.cjs',
    '.cts',
    '.js',
    '.json',
    '.jsx',
    '.mjs',
    '.mts',
    '.ts',
    '.tsx',
  ]).has(extension);
  const candidates = hasSourceExtension
    ? [
        base,
        ...(extension === '.js' || extension === '.mjs' || extension === '.cjs'
          ? [`${base.slice(0, -extension.length)}.ts`, `${base.slice(0, -extension.length)}.tsx`]
          : []),
      ]
    : [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.js`,
        `${base}.cjs`,
        `${base}.mjs`,
        path.join(base, 'index.ts'),
        path.join(base, 'index.js'),
      ];
  return candidates.some((candidate) => fs.existsSync(candidate));
}

function classifyTargetValidity({ repoRoot, testPath, source }) {
  const imports = extractStaticLocalImports(source, testPath);
  if (imports.length === 0) {
    return {
      value: 'ambiguous',
      confidence: 'low',
      evidenceRefs: [`source:${testPath}`],
      issueCodes: ['TARGET_REACHABILITY_UNPROVEN'],
    };
  }
  const missing = stableUnique(
    imports.filter((importPath) => !resolveLocalImport(repoRoot, testPath, importPath))
  );
  if (missing.length > 0) {
    return {
      value: 'obsolete_candidate',
      confidence: 'high',
      evidenceRefs: missing.map((importPath) => `source:${testPath}#missing:${importPath}`),
      issueCodes: ['TARGET_LOCAL_IMPORT_MISSING'],
    };
  }
  return {
    value: 'active',
    confidence: 'medium',
    evidenceRefs: [`source:${testPath}#local-imports-resolve`],
    issueCodes: [],
  };
}

function classifyOracle({ testPath, source }) {
  const executableSource = maskLiteralsAndComments(source, testPath);
  const assertionPattern =
    /\b(?:expect|assert(?:\.[A-Za-z0-9_]+)?|strictEqual|deepStrictEqual|doesNotThrow|rejects|throws)\s*\(/;
  const customHarness =
    /\bfailed\s*(?:\+\+|\+=\s*1)/.test(executableSource) &&
    /(?:\bprocess\.exit(?:Code)?\b|\bthrow\s+new\s+Error\s*\()/.test(executableSource);
  if (assertionPattern.test(executableSource) || customHarness) {
    return {
      value: 'effective',
      confidence: 'medium',
      evidenceRefs: [
        customHarness
          ? `source:${testPath}#custom-failure-harness`
          : sourceLineRef(testPath, executableSource, assertionPattern),
      ],
      issueCodes: [],
    };
  }
  if (/\b(?:it|test)\s*\(/.test(executableSource)) {
    return {
      value: 'ineffective_candidate',
      confidence: 'low',
      evidenceRefs: [`source:${testPath}`],
      issueCodes: ['ORACLE_DIRECT_ASSERTION_NOT_FOUND'],
    };
  }
  return {
    value: 'ambiguous',
    confidence: 'low',
    evidenceRefs: [`source:${testPath}`],
    issueCodes: ['ORACLE_TEST_DECLARATION_UNRESOLVED'],
  };
}

const PARALLEL_HAZARDS = [
  {
    code: 'PARALLEL_PROCESS_CWD_MUTATION',
    pattern: /\bprocess\.chdir\s*\(/,
  },
  {
    code: 'PARALLEL_PROCESS_ENV_MUTATION',
    pattern: /(?:\bprocess\.env(?:\.[A-Za-z0-9_]+|\[['"][^'"]+['"]\])\s*=|\bdelete\s+process\.env)/,
  },
  {
    code: 'PARALLEL_FIXED_PORT',
    pattern: /\b(?:listen|createServer)\s*\(\s*\d{2,5}\b/,
  },
  {
    code: 'PARALLEL_GIT_WORKTREE_MUTATION',
    pattern: /\b(?:execFileSync|spawnSync)\s*\(\s*['"]git['"]/,
  },
  {
    code: 'PARALLEL_REPO_PATH_MUTATION',
    pattern:
      /\b(?:writeFileSync|rmSync|renameSync|mkdirSync)\s*\(\s*['"](?:\.artifacts|docs|packages|src|tests)[\\/]/,
  },
];

function classifyParallelSafety({ testPath, source }) {
  const executableSource = maskLiteralsAndComments(source, testPath);
  const hazards = PARALLEL_HAZARDS.filter(({ pattern }) => pattern.test(executableSource));
  if (hazards.length > 0) {
    return {
      value: 'unsafe',
      confidence: 'medium',
      evidenceRefs: hazards.map(({ pattern }) =>
        sourceLineRef(testPath, executableSource, pattern)
      ),
      issueCodes: hazards.map(({ code }) => code),
    };
  }
  if (/\b(?:mkdtempSync|mkdtemp|tmpdir)\s*\(/.test(executableSource)) {
    return {
      value: 'safe_candidate',
      confidence: 'medium',
      evidenceRefs: [`source:${testPath}#disposable-temp-root`],
      issueCodes: [],
    };
  }
  return {
    value: 'unknown',
    confidence: 'low',
    evidenceRefs: [`source:${testPath}`],
    issueCodes: ['PARALLEL_ISOLATION_UNPROVEN'],
  };
}

function classifyCriticality({ testPath }) {
  const normalized = testPath.toLowerCase();
  const criticalPattern =
    /(?:^|[./_-])(?:release|install|package|consumer|security|schema|migration|persistence|e2e)(?:[./_-]|$)/;
  const specializedPattern = /(?:^|[./_-])(?:long-run|soak|playwright|chaos|platform)(?:[./_-]|$)/;
  if (criticalPattern.test(normalized)) {
    return {
      value: 'critical',
      confidence: 'medium',
      evidenceRefs: [`source:${testPath}#critical-surface-name`],
      issueCodes: [],
    };
  }
  if (specializedPattern.test(normalized)) {
    return {
      value: 'specialized',
      confidence: 'medium',
      evidenceRefs: [`source:${testPath}#specialized-surface-name`],
      issueCodes: [],
    };
  }
  return {
    value: 'standard',
    confidence: 'low',
    evidenceRefs: [`source:${testPath}`],
    issueCodes: [],
  };
}

function routeProfile(routeRef) {
  const marker = String(routeRef).indexOf('#');
  return marker === -1 ? String(routeRef) : String(routeRef).slice(0, marker);
}

function classifyExecutionMultiplicity(routeRefs) {
  const normalizedRoutes = stableUnique(routeRefs || []);
  const counts = new Map();
  for (const routeRef of normalizedRoutes) {
    const profile = routeProfile(routeRef);
    counts.set(profile, (counts.get(profile) || 0) + 1);
  }
  if ([...counts.values()].some((count) => count >= 2)) {
    return {
      value: 'duplicate',
      confidence: 'high',
      evidenceRefs: normalizedRoutes,
      issueCodes: ['EXECUTION_DUPLICATE_WITHIN_PROFILE'],
    };
  }
  if (normalizedRoutes.length > 0) {
    return {
      value: 'single',
      confidence: 'medium',
      evidenceRefs: normalizedRoutes,
      issueCodes: [],
    };
  }
  return {
    value: 'unknown',
    confidence: 'low',
    evidenceRefs: [],
    issueCodes: ['EXECUTION_ROUTE_UNMAPPED'],
  };
}

function analyzeTest({ repoRoot, discovered }) {
  const absolutePath = path.resolve(repoRoot, discovered.testPath);
  const source = fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf8') : '';
  const multiplicity = classifyExecutionMultiplicity(discovered.routeRefs);
  const targetValidity = classifyTargetValidity({
    repoRoot,
    testPath: discovered.testPath,
    source,
  });
  const oracle = classifyOracle({ testPath: discovered.testPath, source });
  const parallel = classifyParallelSafety({ testPath: discovered.testPath, source });
  const criticality = classifyCriticality({ testPath: discovered.testPath });
  const evidenceRefs = stableUnique([
    ...(discovered.evidenceRefs || []),
    ...multiplicity.evidenceRefs,
    ...targetValidity.evidenceRefs,
    ...oracle.evidenceRefs,
    ...parallel.evidenceRefs,
    ...criticality.evidenceRefs,
  ]);

  return {
    testPath: discovered.testPath,
    runnerId: discovered.runnerId,
    executionMultiplicity: multiplicity.value,
    targetValidity: targetValidity.value,
    oracleEffectiveness: oracle.value,
    parallelSafety: parallel.value,
    criticality: criticality.value,
    confidence: {
      executionMultiplicity: multiplicity.confidence,
      targetValidity: targetValidity.confidence,
      oracleEffectiveness: oracle.confidence,
      parallelSafety: parallel.confidence,
      criticality: criticality.confidence,
    },
    executionRouteRefs: stableUnique(discovered.routeRefs || []),
    evidenceRefs,
    issueCodes: stableUnique([
      ...multiplicity.issueCodes,
      ...targetValidity.issueCodes,
      ...oracle.issueCodes,
      ...parallel.issueCodes,
      ...criticality.issueCodes,
    ]),
  };
}

function summarizeTests(tests) {
  const dimensions = [
    'executionMultiplicity',
    'targetValidity',
    'oracleEffectiveness',
    'parallelSafety',
    'criticality',
  ];
  return Object.fromEntries(
    dimensions.map((dimension) => {
      const counts = {};
      for (const row of tests) counts[row[dimension]] = (counts[row[dimension]] || 0) + 1;
      return [dimension, Object.fromEntries(Object.entries(counts).sort())];
    })
  );
}

function buildPortfolioAudit({ repoRoot, discoveredTests, discoveryIssues = [] }) {
  const tests = discoveredTests
    .map((discovered) => analyzeTest({ repoRoot, discovered }))
    .sort(compareTestIdentity);
  const artifact = {
    schemaVersion: AUDIT_SCHEMA_VERSION,
    status: discoveryIssues.length === 0 ? 'COMPLETE' : 'INCOMPLETE',
    repository: {
      testCount: tests.length,
      runnerIds: stableUnique(tests.map((row) => row.runnerId)),
    },
    summary: summarizeTests(tests),
    issues: discoveryIssues,
    tests,
  };
  validateCanonicalAudit(artifact);
  return artifact;
}

function rowsFor(audit, field, value, limit = 50) {
  return audit.tests.filter((row) => row[field] === value).slice(0, limit);
}

function appendCandidateSection(lines, title, rows) {
  lines.push(`## ${title}`, '');
  if (rows.length === 0) {
    lines.push('None.', '');
    return;
  }
  lines.push('| Test | Runner | Confidence | Issues |', '| --- | --- | --- | --- |');
  for (const row of rows) {
    const dimension =
      title === 'Duplicate execution'
        ? 'executionMultiplicity'
        : title === 'Obsolete target candidates'
          ? 'targetValidity'
          : title === 'Ineffective oracle candidates'
            ? 'oracleEffectiveness'
            : title === 'Parallel unsafe'
              ? 'parallelSafety'
              : 'criticality';
    lines.push(
      `| \`${row.testPath}\` | \`${row.runnerId}\` | ${row.confidence[dimension]} | ` +
        `${row.issueCodes.join(', ') || 'none'} |`
    );
  }
  lines.push('');
}

function renderSummary(audit) {
  const lines = [
    '# Test Portfolio Audit Summary',
    '',
    `Status: **${audit.status}**`,
    '',
    `Discovered executable identities: **${audit.repository.testCount}**`,
    '',
    `Configured runners: ${audit.repository.runnerIds.map((value) => `\`${value}\``).join(', ')}`,
    '',
    '## Classification totals',
    '',
    '| Dimension | Value | Count |',
    '| --- | --- | ---: |',
  ];
  for (const [dimension, values] of Object.entries(audit.summary)) {
    for (const [value, count] of Object.entries(values)) {
      lines.push(`| ${dimension} | ${value} | ${count} |`);
    }
  }
  lines.push('');
  appendCandidateSection(
    lines,
    'Duplicate execution',
    rowsFor(audit, 'executionMultiplicity', 'duplicate')
  );
  appendCandidateSection(
    lines,
    'Obsolete target candidates',
    rowsFor(audit, 'targetValidity', 'obsolete_candidate')
  );
  appendCandidateSection(
    lines,
    'Ineffective oracle candidates',
    rowsFor(audit, 'oracleEffectiveness', 'ineffective_candidate')
  );
  appendCandidateSection(lines, 'Parallel unsafe', rowsFor(audit, 'parallelSafety', 'unsafe'));
  appendCandidateSection(lines, 'Critical tests', rowsFor(audit, 'criticality', 'critical'));
  lines.push(
    '## Interpretation',
    '',
    '- Candidate classifications are evidence-backed audit findings, not authorization to change tests or CI.',
    '- `unknown` and `ambiguous` are intentional fail-closed results where the minimum static slice lacks proof.',
    '- The canonical JSON contains every identity, evidence reference, issue code, and confidence value.',
    ''
  );
  return `${lines.join('\n')}\n`;
}

function atomicWrite(filePath, bytes) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tempPath, bytes);
  fs.renameSync(tempPath, filePath);
}

function writeAuditArtifacts({ audit, outputDir }) {
  const jsonPath = path.join(outputDir, 'test-portfolio-audit.json');
  const markdownPath = path.join(outputDir, 'test-portfolio-summary.md');
  atomicWrite(jsonPath, canonicalJsonBytes(audit));
  atomicWrite(markdownPath, Buffer.from(renderSummary(audit), 'utf8'));
  return {
    jsonPath,
    markdownPath,
    artifactSha256: sha256Bytes(canonicalJsonBytes(audit)),
  };
}

function runCurrentRepositoryAudit({
  repoRoot = process.cwd(),
  outputDir = path.join(repoRoot, '.artifacts', 'ci'),
} = {}) {
  const discovery = discoverConfiguredTests({ repoRoot });
  const audit = buildPortfolioAudit({
    repoRoot,
    discoveredTests: discovery.tests,
    discoveryIssues: discovery.issues,
  });
  const written = writeAuditArtifacts({ audit, outputDir });
  return { audit, ...written };
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--repo-root') options.repoRoot = path.resolve(argv[++index]);
    else if (argv[index] === '--output-dir') options.outputDir = path.resolve(argv[++index]);
    else throw new Error(`UNKNOWN_ARGUMENT:${argv[index]}`);
  }
  return options;
}

if (require.main === module) {
  try {
    const result = runCurrentRepositoryAudit(parseArguments(process.argv.slice(2)));
    process.stdout.write(
      `${JSON.stringify({
        status: result.audit.status,
        testCount: result.audit.repository.testCount,
        artifactSha256: result.artifactSha256,
        jsonPath: result.jsonPath,
        markdownPath: result.markdownPath,
      })}\n`
    );
    process.exitCode = result.audit.status === 'COMPLETE' ? 0 : 2;
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  buildPortfolioAudit,
  discoverConfiguredTests,
  renderSummary,
  runCurrentRepositoryAudit,
  writeAuditArtifacts,
};
