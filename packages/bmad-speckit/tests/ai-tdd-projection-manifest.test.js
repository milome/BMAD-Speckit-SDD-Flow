const { describe, it } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  REQUIRED_HEADERS,
  parseProjectionCsv,
  loadAiTddProjectionManifests,
} = require('../src/runtime/ai-tdd/projection-manifest');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');

function tempCsv(name, text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tdd-projection-'));
  const file = path.join(dir, name);
  fs.writeFileSync(file, text, 'utf8');
  return file;
}

function materializePackageMirror() {
  const result = spawnSync('node', ['scripts/prepublish-check.js'], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      BMAD_PREPUBLISH_SILENT: '1',
    },
    shell: process.platform === 'win32',
  });
  assert.strictEqual(
    result.status,
    0,
    `prepublish mirror materialization failed: ${result.stderr || result.stdout}`
  );
}

describe('AI-TDD projection manifest parser', () => {
  it('loads the four canonical manifests with required headers and no errors', () => {
    const manifests = loadAiTddProjectionManifests(PROJECT_ROOT);

    assert.deepEqual(manifests.diagnostics.errors, []);
    assert.equal(manifests.sixModelManifest.length, 6);
    assert.deepEqual(
      manifests.sixModelManifest.map((row) => row.modelId),
      [
        'requirement_confirmation',
        'architecture_confirmation',
        'implementation_readiness',
        'execution_closure',
        'audit_review',
        'delivery_confirmation',
      ]
    );
    assert.ok(
      manifests.actionMatrix.some(
        (row) =>
          row.displayRouteAlias === 'confirm_closeout_acceptance' &&
          row.terminalEvent === 'record_closed' &&
          row.runtimeNextAction !== 'record_closed'
      )
    );
  });

  it('materializes generated package mirror CSV assets byte-equivalent to canonical assets', () => {
    materializePackageMirror();

    for (const basename of [
      'ai-tdd-six-model-manifest.csv',
      'ai-tdd-six-model-action-matrix.csv',
      'ai-tdd-six-model-skill-routes.csv',
      'ai-tdd-reconfirmation-route-matrix.csv',
    ]) {
      const canonical = fs.readFileSync(path.join(PROJECT_ROOT, '_bmad', '_config', basename));
      const mirror = fs.readFileSync(
        path.join(PACKAGE_ROOT, '_bmad', '_config', basename)
      );
      assert.ok(canonical.equals(mirror), `${basename} mirror mismatch`);
    }
  });

  it('reports missing required headers with file, row, column, code, and message', () => {
    const file = tempCsv('ai-tdd-six-model-manifest.csv', 'modelId,sequence\nx,10\n');
    const parsed = parseProjectionCsv(file, 'sixModelManifest');

    assert.ok(parsed.errors.some((error) => error.code === 'missing_required_header'));
    for (const error of parsed.errors.filter((item) => item.code === 'missing_required_header')) {
      assert.ok(error.file);
      assert.equal(error.row, 1);
      assert.ok(error.column);
      assert.ok(error.code);
      assert.ok(error.message);
    }
  });

  it('rejects illegal enum, illegal boolean, invalid stable token, and absolute local path', () => {
    const header = REQUIRED_HEADERS.sixModelManifest.join(',');
    const file = tempCsv(
      'ai-tdd-six-model-manifest.csv',
      `${header}\nnot_a_model,10,Display,Question,Bad-Token,pass_condition,blocked_condition,field,C:/tmp/secret.txt,next_model,,maybe\n`
    );
    const parsed = parseProjectionCsv(file, 'sixModelManifest');
    const codes = parsed.errors.map((error) => error.code);

    assert.ok(codes.includes('illegal_enum'));
    assert.ok(codes.includes('illegal_boolean'));
    assert.ok(codes.includes('invalid_stable_token'));
    assert.ok(codes.includes('absolute_local_path'));
  });

  it('warns on unknown columns and unknown route tokens without failing otherwise valid rows', () => {
    const header = `${REQUIRED_HEADERS.actionMatrix.join(',')},extraColumn`;
    const file = tempCsv(
      'ai-tdd-six-model-action-matrix.csv',
      `${header}\nTEST_ACTION,requirement_confirmation,not_established,new_unknown_state,new_unknown_condition,,new_unknown_alias,requirement_confirmation,none,new_unknown_blocker,Prompt,false,false,false,,ignored\n`
    );
    const parsed = parseProjectionCsv(file, 'actionMatrix');

    assert.deepEqual(parsed.errors, []);
    assert.ok(parsed.warnings.some((warning) => warning.code === 'unknown_column'));
    assert.ok(parsed.warnings.some((warning) => warning.code === 'unknown_stable_token'));
  });

  it('prevents controlled ingest display rows from granting writer authority', () => {
    const header = REQUIRED_HEADERS.skillRoutes.join(',');
    const file = tempCsv(
      'ai-tdd-six-model-skill-routes.csv',
      `${header}\nBAD_ROUTE,delivery_confirmation,user_exact_closeout_phrase_and_hashes_match,requirements-contract-authoring,ingest-confirmation:confirm-closeout-acceptance,input,output,record_closed,confirm_closeout_acceptance,true,true,true,acceptance_request_missing_or_hash_mismatch,record_closed\n`
    );
    const parsed = parseProjectionCsv(file, 'skillRoutes');
    const codes = parsed.errors.map((error) => error.code);

    assert.ok(codes.includes('projection_control_write_forbidden'));
    assert.ok(codes.includes('controlled_ingest_projection_write_violation'));
    assert.ok(codes.includes('record_closed_primary_route_forbidden'));
  });
});
