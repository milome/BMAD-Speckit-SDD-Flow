const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it } = require('node:test');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const LOADER_PATH = path.join(
  PACKAGE_ROOT,
  'dist',
  'main-agent',
  'source-authority',
  'scripts',
  'requirements-contract-judge-prompt-loader.js'
);
const PROMPT_RELATIVE_PATH =
  '_bmad/shared/requirements-contract/judge-prompts/requirements-contract-judge.prompt.md';
const SCHEMA_RELATIVE_PATH =
  'dist/main-agent/source-authority/schemas/requirements-contract-judge-response.schema.json';
const SRC_SCHEMA_RELATIVE_PATH =
  'src/main-agent/source-authority/schemas/requirements-contract-judge-response.schema.json';

function createPackageFixture({ schemaLocation }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'judge-prompt-loader-hermetic-'));
  fs.mkdirSync(path.join(root, path.dirname(PROMPT_RELATIVE_PATH)), { recursive: true });
  fs.copyFileSync(
    path.join(PACKAGE_ROOT, PROMPT_RELATIVE_PATH),
    path.join(root, PROMPT_RELATIVE_PATH)
  );
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'bmad-speckit', version: require('../package.json').version }),
    'utf8'
  );
  fs.mkdirSync(path.join(root, path.dirname(schemaLocation)), { recursive: true });
  fs.copyFileSync(
    path.join(PACKAGE_ROOT, SCHEMA_RELATIVE_PATH),
    path.join(root, schemaLocation)
  );
  return root;
}

describe('Requirements Judge prompt loader hermetic runtime', () => {
  it('requires the packaged dist schema and does not fall back to src', () => {
    const loader = require(LOADER_PATH);
    const root = createPackageFixture({ schemaLocation: SRC_SCHEMA_RELATIVE_PATH });
    try {
      assert.throws(
        () =>
          loader.loadRequirementsContractJudgePromptAsset({
            packageRoot: root,
            judgeRole: 'requirements_judge',
          }),
        /judge_prompt_loader_schema_missing/u
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('loads the packaged dist schema when source files are absent', () => {
    const loader = require(LOADER_PATH);
    const root = createPackageFixture({ schemaLocation: SCHEMA_RELATIVE_PATH });
    try {
      const asset = loader.loadRequirementsContractJudgePromptAsset({
        packageRoot: root,
        judgeRole: 'requirements_judge',
      });
      assert.equal(asset.schema.path, SCHEMA_RELATIVE_PATH);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
