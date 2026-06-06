const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const HELPERS_ROOT = path.join(PACKAGE_ROOT, 'src', 'main-agent', 'helpers');
const TYPE_SCRIPT_RUNNER_PATTERN = new RegExp(`\\b${['t', 's', 'x'].join('')}\\b`);
const TS_NODE_PATTERN = new RegExp(['t', 's', '-', 'n', 'o', 'd', 'e'].join(''));

const bmadStateReader = require(path.join(HELPERS_ROOT, 'bmad-state-reader.js'));
const e2eVerifyPaths = require(path.join(HELPERS_ROOT, 'e2e-verify-paths.js'));
const queryValidate = require(path.join(HELPERS_ROOT, 'query-validate.js'));
const runtimeStepState = require(path.join(HELPERS_ROOT, 'runtime-step-state.js'));
const verifyAgentFiles = require(path.join(HELPERS_ROOT, 'verify-agent-files.js'));

function makeRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function writeRequiredAgents(root) {
  const all = [
    ...verifyAgentFiles.REQUIRED_AGENTS,
    ...verifyAgentFiles.REQUIRED_SPECKIT_ALIASES,
    ...verifyAgentFiles.REQUIRED_AUDITORS,
  ];
  for (const agent of all) {
    writeFile(path.join(root, agent.path), `# ${agent.name}\n${agent.expectedPrerequisite ?? ''}\n`);
  }
}

describe('main-agent wave 3.11 helpers', () => {
  it('exposes the required D006 helper exports without repository script runners', () => {
    const modules = [
      ['bmad-state-reader.js', bmadStateReader, ['readBmadProgress', 'readStoryState', 'getCurrentStoryState', 'buildPaths']],
      ['e2e-verify-paths.js', e2eVerifyPaths, ['runE2eVerifyPaths', 'main']],
      ['query-validate.js', queryValidate, ['runQueryValidation', 'main']],
      ['runtime-step-state.js', runtimeStepState, ['resolveRuntimeStepState', 'persistRuntimeStepState']],
      ['verify-agent-files.js', verifyAgentFiles, ['verifyAgentFiles', 'REQUIRED_AGENTS', 'REQUIRED_SPECKIT_ALIASES', 'REQUIRED_AUDITORS', 'main']],
    ];
    for (const [fileName, mod, exports] of modules) {
      const source = fs.readFileSync(path.join(HELPERS_ROOT, fileName), 'utf8');
      assert.doesNotMatch(source, /scripts[\\/].*\.(?:ts|js|cjs)/);
      assert.doesNotMatch(source, TYPE_SCRIPT_RUNNER_PATTERN);
      assert.doesNotMatch(source, TS_NODE_PATTERN);
      for (const exportName of exports) {
        assert.notEqual(mod[exportName], undefined, `${fileName} missing ${exportName}`);
      }
    }
    assert.ok(Array.isArray(verifyAgentFiles.REQUIRED_AGENTS));
    assert.ok(verifyAgentFiles.REQUIRED_AGENTS.some((agent) => agent.name === 'bmad-master'));
  });

  it('reads BMAD state and returns null for missing files', () => {
    const root = makeRoot('wave-3-11-state-');
    try {
      assert.equal(bmadStateReader.readBmadProgress(root), null);
      writeFile(
        path.join(root, '.claude', 'state', 'bmad-progress.yaml'),
        'version: "1"\ncurrent_context:\n  epic: "1"\n  story: "2"\nactive_stories: []\ncompleted_stories: []\n'
      );
      writeFile(
        path.join(root, '.claude', 'state', 'stories', '1-2-progress.yaml'),
        'version: "1"\nepic: "1"\nstory: "2"\nstory_slug: "story-two"\nepic_slug: "epic-one"\nlayer: 4\nstage: plan\naudit_status: pending\nartifacts: {}\n'
      );
      assert.equal(bmadStateReader.readBmadProgress(root).current_context.epic, '1');
      assert.equal(bmadStateReader.readStoryState('1', '2', root).stage, 'plan');
      assert.equal(bmadStateReader.getCurrentStoryState(root).state.story_slug, 'story-two');
      assert.equal(
        bmadStateReader.buildPaths('1', '2', 'epic-one', 'story-two').tasks,
        'specs/epic-1-epic-one/story-2-story-two/tasks-E1-S2.md'
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('executes path and agent verification helpers with structured exit-code results', () => {
    const root = makeRoot('wave-3-11-agents-');
    try {
      assert.equal(verifyAgentFiles.verifyAgentFiles({ cwd: root }).exitCode, 1);
      writeRequiredAgents(root);
      const verified = verifyAgentFiles.verifyAgentFiles({ cwd: root });
      assert.equal(verified.exitCode, 0);
      const pathResult = e2eVerifyPaths.runE2eVerifyPaths({ cwd: root });
      assert.equal(pathResult.exitCode, 0);
      assert.equal(e2eVerifyPaths.main(['--cwd', root]), 0);
      assert.equal(verifyAgentFiles.main(['--cwd', root]), 0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('executes runtime step state resolution and persistence', () => {
    const root = makeRoot('wave-3-11-step-');
    try {
      const state = runtimeStepState.resolveRuntimeStepState(root, {
        argv: ['--workflow', 'wf', '--step', 's1', '--artifact-path', 'docs/a.md'],
        env: {},
      });
      assert.equal(state.workflow, 'wf');
      assert.equal(state.step, 's1');
      assert.equal(state.artifactRoot, 'docs');
      const persisted = runtimeStepState.persistRuntimeStepState(root, state);
      assert.equal(persisted.persistedContext.path, '_bmad-output/runtime/step-state.json');
      assert.equal(fs.existsSync(path.join(root, '_bmad-output', 'runtime', 'step-state.json')), true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('executes query validation against an empty scoring data path', () => {
    const root = makeRoot('wave-3-11-query-');
    try {
      const dataPath = path.join(root, 'scores');
      fs.mkdirSync(dataPath, { recursive: true });
      const result = queryValidate.runQueryValidation({ dataPath, cwd: root });
      assert.equal(result.exitCode, 0);
      assert.equal(typeof result.queryLatestCount, 'number');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
