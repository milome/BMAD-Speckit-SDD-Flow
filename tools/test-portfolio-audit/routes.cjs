const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const { normalizeRepoPath, sha256Bytes } = require('./canonical.cjs');

const KNOWN_WRAPPER = Object.freeze({
  path: 'tools/run-root-tests.cjs',
  sourceSha256: 'sha256:606dc9aced298e824225322eecca34f0e1054126cfcd46e7925a471397b635e8',
  delegatedScripts: ['test:governance-fixtures', 'test:vitest:default', 'test:bmad-speckit'],
});

function compareText(left, right) {
  return String(left).localeCompare(String(right), 'en');
}

function commandError() {
  const error = new Error('COMMAND_DYNAMIC_UNSUPPORTED');
  error.code = 'COMMAND_DYNAMIC_UNSUPPORTED';
  return error;
}

function parseCommandChain(commandText) {
  if (typeof commandText !== 'string') throw commandError();
  if (/\$\{\{|\$\(|`|[<>]/u.test(commandText)) throw commandError();

  const commands = [];
  let argv = [];
  let token = '';
  let quote = null;

  const flushToken = () => {
    if (token !== '') argv.push(token);
    token = '';
  };
  const flushCommand = () => {
    flushToken();
    if (argv.length > 0) commands.push(argv);
    argv = [];
  };

  for (let index = 0; index < commandText.length; index += 1) {
    const character = commandText[index];
    const next = commandText[index + 1];

    if (quote) {
      if (character === '\\' && (next === quote || next === '\\')) {
        token += next;
        index += 1;
      } else if (character === quote) {
        quote = null;
      } else {
        token += character;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (
      character === '\\' &&
      next !== undefined &&
      (/[\s"'\\;&|]/u.test(next) || next === '\r' || next === '\n')
    ) {
      token += next;
      index += 1;
      continue;
    }
    if (character === '\r' || character === '\n' || character === ';') {
      flushCommand();
      continue;
    }
    if ((character === '&' && next === '&') || (character === '|' && next === '|')) {
      flushCommand();
      index += 1;
      continue;
    }
    if (character === '&' || character === '|') throw commandError();
    if (/\s/u.test(character)) {
      flushToken();
      continue;
    }
    token += character;
  }

  if (quote) throw commandError();
  flushCommand();
  return commands;
}

function readPackageJson(repoRoot, packagePath) {
  const absolutePath = path.resolve(repoRoot, packagePath);
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

function normalizePackagePath(repoRoot, packagePath) {
  return normalizeRepoPath(repoRoot, packagePath || 'package.json');
}

function resolvePackagePath(repoRoot, currentPackagePath, prefix) {
  const currentDirectory = path.posix.dirname(currentPackagePath);
  return normalizeRepoPath(
    repoRoot,
    path.posix.join(currentDirectory === '.' ? '' : currentDirectory, prefix, 'package.json')
  );
}

function normalizeCommandTestPath(repoRoot, packagePath, testPath) {
  const packageDirectory = path.posix.dirname(packagePath);
  const relativePath = path.posix.join(
    packageDirectory === '.' ? '' : packageDirectory,
    String(testPath).replace(/\\/g, '/').replace(/^\.\//u, '')
  );
  return normalizeRepoPath(repoRoot, relativePath);
}

function isTestPath(value) {
  return /\.(?:test|spec)\.[cm]?[jt]sx?$/iu.test(String(value));
}

function explicitTestPaths(repoRoot, packagePath, values) {
  return [
    ...new Set(
      values
        .filter(isTestPath)
        .map((value) => normalizeCommandTestPath(repoRoot, packagePath, value))
    ),
  ].sort(compareText);
}

function issueKey(issue) {
  return [
    issue.code,
    issue.sourceRef || '',
    issue.testPath || '',
    issue.key || '',
    issue.detail || '',
  ].join('\0');
}

function sortIssues(issues) {
  const unique = new Map();
  for (const issue of issues) unique.set(JSON.stringify(issue), issue);
  return [...unique.values()].sort((left, right) => compareText(issueKey(left), issueKey(right)));
}

function sortInvocations(invocations) {
  return [...invocations].sort((left, right) =>
    compareText(
      left.invocationId || `${left.scriptRef}\0${left.runnerId}\0${left.explicitTestPaths}`,
      right.invocationId || `${right.scriptRef}\0${right.runnerId}\0${right.explicitTestPaths}`
    )
  );
}

function parseNpmRun(argv, repoRoot, packagePath) {
  if (argv[0] !== 'npm') return null;

  let scriptName = null;
  let prefix = null;
  if (argv[1] === 'run' && typeof argv[2] === 'string') {
    scriptName = argv[2];
    const prefixIndex = argv.findIndex((value, index) => index > 2 && value === '--prefix');
    if (prefixIndex !== -1) prefix = argv[prefixIndex + 1];
  } else if (argv[1] === '--prefix' && argv[3] === 'run' && typeof argv[4] === 'string') {
    prefix = argv[2];
    scriptName = argv[4];
  } else if (
    typeof argv[1] === 'string' &&
    argv[1].startsWith('--prefix=') &&
    argv[2] === 'run' &&
    typeof argv[3] === 'string'
  ) {
    prefix = argv[1].slice('--prefix='.length);
    scriptName = argv[3];
  }

  if (!scriptName) return null;
  return {
    scriptName,
    packagePath: prefix ? resolvePackagePath(repoRoot, packagePath, prefix) : packagePath,
  };
}

function vitestInvocation(argv, context) {
  const normalized = argv[0] === 'npx' ? argv.slice(1) : argv;
  if (normalized[0] !== 'vitest' || normalized[1] !== 'run') return null;
  return {
    kind: 'vitest',
    runnerId: 'root-vitest',
    packagePath: context.packagePath,
    recursionKey: context.recursionKey,
    scriptRef: context.scriptRef,
    sourceRef: context.sourceRef,
    explicitTestPaths: explicitTestPaths(
      context.repoRoot,
      context.packagePath,
      normalized.slice(2)
    ),
    argv,
  };
}

function nodeTestInvocation(argv, context) {
  if (argv[0] !== 'node' || argv[1] !== '--test') return null;
  return {
    kind: 'node-test',
    runnerId: 'node-test',
    packagePath: context.packagePath,
    recursionKey: context.recursionKey,
    scriptRef: context.scriptRef,
    sourceRef: context.sourceRef,
    explicitTestPaths: explicitTestPaths(context.repoRoot, context.packagePath, argv.slice(2)),
    argv,
  };
}

function looksTestLike(argv) {
  return argv.some(
    (value) =>
      isTestPath(value) ||
      /(?:^|[/:_-])tests?(?:[/:_.-]|$)/iu.test(value) ||
      /(?:vitest|jest|pytest|mocha|playwright|cypress)/iu.test(value)
  );
}

function mergeExpansion(target, addition, delegatedFrom) {
  for (const invocation of addition.invocations) {
    target.invocations.push(
      delegatedFrom && !invocation.delegatedFrom ? { ...invocation, delegatedFrom } : invocation
    );
  }
  target.issues.push(...addition.issues);
  if (addition.wrapperSourceSha256) {
    target.wrapperSourceSha256 = addition.wrapperSourceSha256;
  }
}

function expandKnownWrapper(argv, context, state) {
  if (argv[0] !== 'node' || typeof argv[1] !== 'string') return null;
  const wrapperPath = normalizeCommandTestPath(context.repoRoot, context.packagePath, argv[1]);
  if (wrapperPath !== KNOWN_WRAPPER.path) return null;

  const absolutePath = path.resolve(context.repoRoot, wrapperPath);
  const actualSha256 = fs.existsSync(absolutePath)
    ? sha256Bytes(fs.readFileSync(absolutePath))
    : null;
  if (actualSha256 !== KNOWN_WRAPPER.sourceSha256) {
    return {
      invocations: [],
      issues: [
        {
          code: 'KNOWN_WRAPPER_DRIFT',
          sourceRef: `source:${wrapperPath}`,
          expectedSha256: KNOWN_WRAPPER.sourceSha256,
          actualSha256,
        },
      ],
      wrapperSourceSha256: actualSha256,
    };
  }

  const result = {
    invocations: [],
    issues: [],
    wrapperSourceSha256: actualSha256,
  };
  const delegatedFrom = `source:${wrapperPath}`;
  for (const scriptName of KNOWN_WRAPPER.delegatedScripts) {
    mergeExpansion(
      result,
      expandPackageScript(
        {
          repoRoot: context.repoRoot,
          packagePath: context.packagePath,
          scriptName,
        },
        {
          stack: state.stack,
          delegatedFrom,
        }
      ),
      delegatedFrom
    );
  }
  return result;
}

function expandCommands(context, commands, state) {
  const result = { invocations: [], issues: [] };

  for (const argv of commands) {
    const npmRun = parseNpmRun(argv, context.repoRoot, context.packagePath);
    if (npmRun) {
      mergeExpansion(
        result,
        expandPackageScript(
          {
            repoRoot: context.repoRoot,
            packagePath: npmRun.packagePath,
            scriptName: npmRun.scriptName,
          },
          {
            stack: state.stack,
            delegatedFrom: state.delegatedFrom,
          }
        ),
        state.delegatedFrom
      );
      continue;
    }

    const vitest = vitestInvocation(argv, context);
    if (vitest) {
      result.invocations.push(
        state.delegatedFrom ? { ...vitest, delegatedFrom: state.delegatedFrom } : vitest
      );
      continue;
    }

    const nodeTest = nodeTestInvocation(argv, context);
    if (nodeTest) {
      result.invocations.push(
        state.delegatedFrom ? { ...nodeTest, delegatedFrom: state.delegatedFrom } : nodeTest
      );
      continue;
    }

    const wrapper = expandKnownWrapper(argv, context, state);
    if (wrapper) {
      mergeExpansion(result, wrapper, state.delegatedFrom);
      continue;
    }

    if (looksTestLike(argv)) {
      result.issues.push({
        code: 'UNKNOWN_TEST_LIKE_COMMAND',
        sourceRef: context.sourceRef,
        command: argv,
      });
    }
  }

  return result;
}

function expandPackageScript(input, state = {}) {
  const packagePath = normalizePackagePath(input.repoRoot, input.packagePath);
  const key = `${packagePath}#${input.scriptName}`;
  const stack = Array.isArray(state.stack) ? state.stack : [];
  if (stack.includes(key)) {
    return {
      invocations: [],
      issues: [{ code: 'PACKAGE_SCRIPT_CYCLE', key, cycle: [...stack, key] }],
    };
  }

  let packageJson;
  try {
    packageJson = readPackageJson(input.repoRoot, packagePath);
  } catch (error) {
    return {
      invocations: [],
      issues: [
        {
          code: 'PACKAGE_JSON_UNAVAILABLE',
          sourceRef: `source:${packagePath}`,
          detail: error.code || error.message,
        },
      ],
    };
  }

  const commandText = packageJson.scripts?.[input.scriptName];
  if (typeof commandText !== 'string') {
    return {
      invocations: [],
      issues: [{ code: 'PACKAGE_SCRIPT_UNKNOWN', key, sourceRef: `source:${packagePath}` }],
    };
  }

  const scriptRef = `${packagePath}#scripts.${input.scriptName}`;
  const sourceRef = `source:${scriptRef}`;
  let commands;
  try {
    commands = parseCommandChain(commandText);
  } catch (error) {
    return {
      invocations: [],
      issues: [{ code: error.code || 'COMMAND_DYNAMIC_UNSUPPORTED', sourceRef }],
    };
  }

  const result = expandCommands(
    {
      repoRoot: input.repoRoot,
      packagePath,
      recursionKey: key,
      scriptRef,
      sourceRef,
    },
    commands,
    {
      stack: [...stack, key],
      delegatedFrom: state.delegatedFrom,
    }
  );
  return {
    invocations: sortInvocations(result.invocations),
    issues: sortIssues(result.issues),
    ...(result.wrapperSourceSha256 ? { wrapperSourceSha256: result.wrapperSourceSha256 } : {}),
  };
}

function isDynamicScalar(value) {
  return typeof value === 'string' && /\$\{\{|\$\(|`/u.test(value);
}

function cartesianMatrix(matrix) {
  if (matrix === undefined) return { combinations: [{}], matrix: false, issue: null };
  if (!matrix || typeof matrix !== 'object' || Array.isArray(matrix)) {
    return { combinations: [], matrix: true, issue: 'WORKFLOW_MATRIX_DYNAMIC' };
  }

  const keys = Object.keys(matrix).sort(compareText);
  if (keys.some((key) => key === 'include' || key === 'exclude')) {
    return { combinations: [], matrix: true, issue: 'WORKFLOW_MATRIX_DYNAMIC' };
  }

  let combinations = [{}];
  for (const key of keys) {
    const values = matrix[key];
    if (
      !Array.isArray(values) ||
      values.length === 0 ||
      values.some(
        (value) => !['string', 'number', 'boolean'].includes(typeof value) || isDynamicScalar(value)
      )
    ) {
      return { combinations: [], matrix: true, issue: 'WORKFLOW_MATRIX_DYNAMIC' };
    }
    combinations = combinations.flatMap((combination) =>
      values.map((value) => ({ ...combination, [key]: String(value) }))
    );
  }
  return { combinations, matrix: keys.length > 0, issue: null };
}

function resolveEnvironment(runsOn, combination) {
  if (Array.isArray(runsOn)) {
    if (
      runsOn.length === 0 ||
      runsOn.some((value) => typeof value !== 'string' || isDynamicScalar(value))
    ) {
      return null;
    }
    return runsOn.join('+');
  }
  if (typeof runsOn !== 'string') return null;
  const matrixReference = runsOn.match(/^\$\{\{\s*matrix\.([A-Za-z0-9_-]+)\s*\}\}$/u);
  if (matrixReference) return combination[matrixReference[1]] || null;
  if (isDynamicScalar(runsOn)) return null;
  return runsOn;
}

function workflowEvents(workflow) {
  const configured = workflow.on ?? workflow.true;
  if (typeof configured === 'string') return [configured];
  if (Array.isArray(configured)) {
    return configured.filter((event) => typeof event === 'string').sort(compareText);
  }
  if (configured && typeof configured === 'object') {
    return Object.keys(configured).sort(compareText);
  }
  return [];
}

function purposeFor(event, isMatrix) {
  if (event === 'pull_request') return 'required_pr_validation';
  if (event === 'schedule' && isMatrix) return 'platform_validation';
  if (event === 'schedule') return 'nightly_validation';
  return `${String(event).replace(/[^A-Za-z0-9_-]+/gu, '_')}_validation`;
}

function listWorkflowPaths(repoRoot) {
  const workflowRoot = path.resolve(repoRoot, '.github', 'workflows');
  if (!fs.existsSync(workflowRoot)) return [];
  return fs
    .readdirSync(workflowRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.ya?ml$/iu.test(entry.name))
    .map((entry) => normalizeRepoPath(repoRoot, path.join(workflowRoot, entry.name)))
    .sort(compareText);
}

function workflowIssue(code, sourceRef, detail) {
  return {
    code,
    sourceRef,
    ...(detail ? { detail } : {}),
  };
}

function effectiveWorkingDirectory(job, step) {
  return step['working-directory'] ?? job.defaults?.run?.['working-directory'] ?? '.';
}

function directCommandExpansion({ repoRoot, packagePath, sourceRef, commandText }) {
  let commands;
  try {
    commands = parseCommandChain(commandText);
  } catch (error) {
    return {
      invocations: [],
      issues: [{ code: error.code || 'COMMAND_DYNAMIC_UNSUPPORTED', sourceRef }],
    };
  }

  const result = expandCommands(
    {
      repoRoot,
      packagePath,
      recursionKey: `${packagePath}#${sourceRef}`,
      scriptRef: sourceRef,
      sourceRef,
    },
    commands,
    { stack: [], delegatedFrom: null }
  );
  return {
    invocations: result.invocations,
    issues: result.issues,
  };
}

function buildExecutionRouteGraph({ repoRoot, inventory }) {
  const invocations = [];
  const issues = [];
  const sortedInventory = [...inventory].sort((left, right) =>
    compareText(`${left.runnerId}\0${left.testPath}`, `${right.runnerId}\0${right.testPath}`)
  );

  for (const workflowPath of listWorkflowPaths(repoRoot)) {
    const source = fs.readFileSync(path.resolve(repoRoot, workflowPath), 'utf8');
    let workflow;
    try {
      workflow = yaml.load(source);
    } catch (error) {
      issues.push(workflowIssue('WORKFLOW_YAML_INVALID', `source:${workflowPath}`, error.message));
      continue;
    }
    if (!workflow || typeof workflow !== 'object') {
      issues.push(workflowIssue('WORKFLOW_YAML_INVALID', `source:${workflowPath}`));
      continue;
    }

    const events = workflowEvents(workflow);
    const jobs = workflow.jobs;
    if (!jobs || typeof jobs !== 'object') continue;

    for (const jobId of Object.keys(jobs).sort(compareText)) {
      const job = jobs[jobId];
      if (!job || typeof job !== 'object') continue;
      const matrix = cartesianMatrix(job.strategy?.matrix);
      const jobSourceRef = `source:${workflowPath}#jobs.${jobId}`;
      if (matrix.issue) {
        issues.push(workflowIssue(matrix.issue, `${jobSourceRef}.strategy.matrix`));
        continue;
      }

      const steps = Array.isArray(job.steps) ? job.steps : [];
      for (const combination of matrix.combinations) {
        const environmentId = resolveEnvironment(job['runs-on'], combination);
        if (!environmentId) {
          issues.push(workflowIssue('WORKFLOW_RUNNER_DYNAMIC', `${jobSourceRef}.runs-on`));
          continue;
        }

        for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
          const step = steps[stepIndex];
          if (!step || typeof step !== 'object' || typeof step.run !== 'string') continue;
          const sourceRef = `${jobSourceRef}.steps[${stepIndex}].run`;
          const workingDirectory = effectiveWorkingDirectory(job, step);
          if (typeof workingDirectory !== 'string' || isDynamicScalar(workingDirectory)) {
            issues.push(
              workflowIssue(
                'WORKFLOW_WORKING_DIRECTORY_DYNAMIC',
                `${jobSourceRef}.steps[${stepIndex}].working-directory`
              )
            );
            continue;
          }

          let packagePath;
          try {
            packagePath = normalizeRepoPath(
              repoRoot,
              path.posix.join(
                workingDirectory === '.' ? '' : workingDirectory.replace(/\\/g, '/'),
                'package.json'
              )
            );
          } catch (error) {
            issues.push(
              workflowIssue(
                'WORKFLOW_WORKING_DIRECTORY_DYNAMIC',
                `${jobSourceRef}.steps[${stepIndex}].working-directory`,
                error.code || error.message
              )
            );
            continue;
          }

          const expansion = directCommandExpansion({
            repoRoot,
            packagePath,
            sourceRef,
            commandText: step.run,
          });
          issues.push(...expansion.issues);

          for (const event of events) {
            const purpose = purposeFor(event, matrix.matrix);
            const effectiveProfileId = `${purpose}:${workflowPath}:${jobId}:${environmentId}`;
            for (let leafIndex = 0; leafIndex < expansion.invocations.length; leafIndex += 1) {
              const leaf = expansion.invocations[leafIndex];
              const invocationId =
                `${workflowPath}#${event}/${jobId}/step-${stepIndex}/` +
                `${environmentId}/invocation-${leafIndex}:${leaf.scriptRef}`;
              invocations.push({
                ...leaf,
                invocationId,
                workflowPath,
                event,
                jobId,
                stepIndex,
                sourceRef,
                scriptSourceRef: leaf.sourceRef,
                purpose,
                effectiveProfileId,
                environmentId,
              });
            }
          }
        }
      }
    }
  }

  const sortedInvocations = sortInvocations(invocations);
  const routes = [];
  for (const invocation of sortedInvocations) {
    const runnerInventory = sortedInventory.filter(
      (identity) => identity.runnerId === invocation.runnerId
    );
    const explicit = invocation.explicitTestPaths;
    if (explicit.length > 0) {
      for (const testPath of explicit) {
        if (!runnerInventory.some((identity) => identity.testPath === testPath)) {
          issues.push({
            code: 'ROUTE_TEST_NOT_DISCOVERED',
            sourceRef: invocation.sourceRef,
            runnerId: invocation.runnerId,
            testPath,
          });
        }
      }
    }

    const matched = runnerInventory.filter(
      (identity) => explicit.length === 0 || explicit.includes(identity.testPath)
    );
    for (const identity of matched) {
      const identityKey = `${identity.runnerId}#${identity.testPath}`;
      routes.push({
        routeId: `route:${invocation.invocationId}/${identityKey}`,
        workflowPath: invocation.workflowPath,
        event: invocation.event,
        jobId: invocation.jobId,
        stepIndex: invocation.stepIndex,
        scriptRef: invocation.scriptRef,
        sourceRef: invocation.sourceRef,
        runnerId: identity.runnerId,
        testPath: identity.testPath,
        identityKey,
        effectiveProfileId: invocation.effectiveProfileId,
        environmentId: invocation.environmentId,
        purpose: invocation.purpose,
        selectionKind: explicit.length > 0 ? 'explicit' : 'inherited',
      });
    }
  }

  return {
    routes: routes.sort((left, right) => compareText(left.routeId, right.routeId)),
    invocations: sortedInvocations,
    issues: sortIssues(issues),
  };
}

function extractConfiguredCandidateRefs(routeGraph) {
  const refs = new Map();
  for (const invocation of routeGraph.invocations || []) {
    for (const testPath of invocation.explicitTestPaths || []) {
      const reference = { testPath, evidenceRef: invocation.sourceRef };
      refs.set(`${testPath}\0${invocation.sourceRef}`, reference);
    }
  }
  return [...refs.values()].sort(
    (left, right) =>
      compareText(left.testPath, right.testPath) || compareText(left.evidenceRef, right.evidenceRef)
  );
}

module.exports = {
  buildExecutionRouteGraph,
  expandPackageScript,
  extractConfiguredCandidateRefs,
  parseCommandChain,
  parseNpmRun,
};
