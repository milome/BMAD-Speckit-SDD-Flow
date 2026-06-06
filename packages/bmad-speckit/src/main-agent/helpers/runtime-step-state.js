const fs = require('node:fs');
const path = require('node:path');

function parseArg(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : null;
}

function resolveRuntimeStepState(projectRoot, options = {}) {
  const argv = options.argv ?? [];
  const env = options.env ?? process.env;
  const workflow = options.workflow ?? parseArg(argv, '--workflow') ?? env.BMAD_RUNTIME_WORKFLOW ?? 'unknown';
  const step = options.step ?? parseArg(argv, '--step') ?? env.BMAD_RUNTIME_STEP ?? 'unknown';
  const artifactPath = options.artifactPath ?? parseArg(argv, '--artifact-path') ?? env.BMAD_ARTIFACT_PATH ?? null;
  const state = {
    workflow,
    step,
    flow: options.flow ?? parseArg(argv, '--flow') ?? env.BMAD_RUNTIME_FLOW ?? null,
    stage: options.stage ?? parseArg(argv, '--stage') ?? env.BMAD_RUNTIME_STAGE ?? null,
    rerunGate: options.rerunGate ?? parseArg(argv, '--rerun-gate') ?? env.BMAD_RERUN_GATE ?? null,
    artifactPath,
    artifactRoot: artifactPath ? path.dirname(artifactPath).replace(/\\/g, '/') : null,
    branch: options.branch ?? env.GITHUB_HEAD_REF ?? env.BMAD_RUNTIME_BRANCH ?? null,
    epicId: options.epicId ?? parseArg(argv, '--epic') ?? env.BMAD_EPIC_ID ?? null,
    storyId: options.storyId ?? parseArg(argv, '--story') ?? env.BMAD_STORY_ID ?? null,
    route: options.route ?? null,
    frontmatter: options.frontmatter ?? null,
    registry: options.registry,
    runtimeContext: options.runtimeContext,
    activeContextPath: options.activeContextPath,
    projectContextPath: options.projectContextPath,
    contextScope: options.contextScope,
    persistedContext: options.persistedContext,
  };
  const hookInput = options.hookInput;
  if (hookInput && typeof hookInput === 'object') {
    state.hookInput = hookInput;
  }
  return state;
}

function persistRuntimeStepState(projectRoot, state) {
  const root = path.resolve(projectRoot || process.cwd());
  const filePath = path.join(root, '_bmad-output', 'runtime', 'step-state.json');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  return {
    ...state,
    persistedContext: {
      ...(state.persistedContext ?? {}),
      path: path.relative(root, filePath).replace(/\\/g, '/'),
    },
  };
}

module.exports = {
  resolveRuntimeStepState,
  persistRuntimeStepState,
};
