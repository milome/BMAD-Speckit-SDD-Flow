const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const PACKAGE_CLI = path.join(PACKAGE_ROOT, 'bin', 'bmad-speckit.js');

function makeRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

describe('check-score package command', () => {
  it('keeps check-score wired to the package command module', () => {
    const cli = fs.readFileSync(PACKAGE_CLI, 'utf8');
    assert.match(cli, /\.command\('check-score'\)/);
    assert.match(cli, /\.\.\/dist\/commands\/check-score/);
    const block = cli.slice(cli.indexOf(".command('check-score'"), cli.indexOf(".command('eval-question-generate'"));
    assert.doesNotMatch(block, /scripts[\\/]check-story-score-written\.ts/);
    assert.doesNotMatch(block, /\btsx\b/);
    assert.doesNotMatch(block, /\bts-node\b/);
  });

  it('finds matching scoring records from a fixture dataPath', () => {
    const root = makeRoot('check-score-command-');
    try {
      const dataPath = path.join(root, 'scores');
      writeJson(path.join(dataPath, 'record.json'), {
        run_id: 'check-score-e9-s1-story',
        scenario: 'real_dev',
        stage: 'story',
        phase_score: 82,
        phase_weight: 1,
        check_items: [{ item_id: 'fixture', passed: true, score_delta: 0 }],
        timestamp: '2026-06-05T00:00:00.000Z',
        iteration_count: 1,
        iteration_records: [],
        first_pass: true,
      });
      const result = spawnSync(
        process.execPath,
        [PACKAGE_CLI, 'check-score', '--epic', '9', '--story', '1', '--dataPath', dataPath],
        {
          cwd: PACKAGE_ROOT,
          encoding: 'utf8',
          shell: process.platform === 'win32',
        }
      );
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
      assert.match(result.stdout, /STORY_SCORE_WRITTEN:yes/);
      assert.match(result.stdout, /Found 1 record/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
