const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const PACKAGE_CLI = path.join(PACKAGE_ROOT, 'bin', 'bmad-speckit.js');
const command = require(path.join(PACKAGE_ROOT, 'src', 'commands', 'eval-question-generate'));
const { loadManifest } = require(path.join(
  PROJECT_ROOT,
  'packages',
  'scoring',
  'dist',
  'eval-questions',
  'manifest-loader.js'
));

function makeRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

describe('eval-question-generate package command', () => {
  it('generates eval question files and a loadable manifest from --input', async () => {
    const root = makeRoot('eval-question-generate-');
    try {
      const input = path.join(root, 'coach-report.json');
      const outputDir = path.join(root, 'questions');
      writeJson(input, {
        weak_areas: ['spec', 'plan'],
        weakness_clusters: [
          {
            affected_stages: ['spec', 'plan'],
            keywords: ['acceptance', 'evidence'],
          },
        ],
      });
      const result = await command.evalQuestionGenerateCommand({
        input,
        outputDir,
        version: 'v1',
      });
      assert.equal(result.status, 'ok');
      assert.equal(result.manifestQuestionCount, 3);
      const manifest = loadManifest(outputDir);
      assert.equal(manifest.questions.length, 3);
      for (const question of manifest.questions) {
        assert.ok(question.id);
        assert.ok(question.title);
        assert.ok(question.path);
        assert.equal(fs.existsSync(path.join(outputDir, question.path)), true);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed for unresolved --run-id compatibility scope', async () => {
    const root = makeRoot('eval-question-run-id-');
    try {
      const dataPath = path.join(root, 'empty-scores');
      fs.mkdirSync(dataPath, { recursive: true });
      await assert.rejects(
        () =>
          command.evalQuestionGenerateCommand({
            runId: 'missing-run',
            dataPath,
            outputDir: path.join(root, 'questions'),
          }),
        (error) => {
          assert.equal(error.code, command.RUN_ID_UNRESOLVED);
          assert.match(error.message, /EVAL_QUESTION_RUN_ID_UNRESOLVED/);
          return true;
        }
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('treats --version after eval-question-generate as the question version option', () => {
    const root = makeRoot('eval-question-cli-version-');
    try {
      const input = path.join(root, 'coach-report.json');
      const outputDir = path.join(root, 'questions');
      writeJson(input, {
        weak_areas: ['spec'],
        weakness_clusters: [],
      });

      const result = spawnSync(
        process.execPath,
        [
          PACKAGE_CLI,
          'eval-question-generate',
          '--input',
          input,
          '--version',
          'v1',
          '--outputDir',
          outputDir,
        ],
        {
          cwd: PROJECT_ROOT,
          encoding: 'utf8',
        }
      );

      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.doesNotMatch(result.stdout.trim(), /^\d+\.\d+\.\d+$/);
      const manifest = loadManifest(outputDir);
      assert.equal(manifest.questions.length, 1);
      assert.equal(fs.existsSync(path.join(outputDir, manifest.questions[0].path)), true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
