const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const BIN = path.join(__dirname, '..', 'bin', 'bmad-speckit.js');

function makeTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'large-doc-cli-'));
}

function runLargeDoc(args, options = {}) {
  const result = runLargeDocRaw(args, options);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function runLargeDocRaw(args, options = {}) {
  const result = spawnSync(process.execPath, [BIN, 'large-doc', ...args, '--json'], {
    cwd: options.cwd || path.join(__dirname, '..'),
    encoding: 'utf8',
  });
  return result;
}

function writeChunk(root, chunkId, sectionId, body) {
  const chunkPath = path.join(root, `${chunkId}.md`);
  fs.writeFileSync(
    chunkPath,
    [
      `<!-- large-document-writer chunkId=${chunkId} sectionId=${sectionId} begin -->`,
      body.trimEnd(),
      `<!-- large-document-writer chunkId=${chunkId} sectionId=${sectionId} end -->`,
      '',
    ].join('\n'),
    'utf8'
  );
  return chunkPath;
}

describe('bmad-speckit large-doc command', () => {
  it('dispatches init/status/add-chunk/assemble/validate/promote/cleanup with JSON receipts', () => {
    const root = makeTempRoot();
    const target = path.join(root, 'target.md');
    const init = runLargeDoc([
      'init',
      '--target',
      target,
      '--mode',
      'create',
      '--profile',
      'markdown',
      '--chunk',
      '001:scope',
      '--require-heading',
      '## Scope',
      '--min-bytes',
      '20',
      '--min-lines',
      '2',
    ]);
    assert.equal(init.schemaVersion, 'large-document-writer-session-init/v1');
    assert.equal(init.targetTouched, false);
    assert.ok(init.sessionDir);

    const chunkFile = writeChunk(root, '001', 'scope', '## Scope\nCLI body text.\n');
    const add = runLargeDoc([
      'add-chunk',
      '--session',
      init.sessionDir,
      '--chunk-id',
      '001',
      '--section-id',
      'scope',
      '--content-file',
      chunkFile,
    ]);
    assert.equal(add.schemaVersion, 'large-document-writer-chunk-receipt/v1');

    const status = runLargeDoc(['status', '--session', init.sessionDir]);
    assert.equal(status.schemaVersion, 'large-document-writer-status/v1');
    assert.equal(status.lastCompleteChunkId, '001');
    assert.equal(status.nextChunkId, null);

    const assemble = runLargeDoc(['assemble', '--session', init.sessionDir]);
    assert.equal(assemble.schemaVersion, 'large-document-writer-assembly-receipt/v1');

    const validate = runLargeDoc(['validate', '--session', init.sessionDir]);
    assert.equal(validate.schemaVersion, 'large-document-writer-validation-receipt/v1');
    assert.equal(validate.ok, true);

    const promote = runLargeDoc(['promote', '--session', init.sessionDir]);
    assert.equal(promote.schemaVersion, 'large-document-writer-promote-receipt/v1');
    assert.match(promote.finalHash, /^sha256:[0-9a-f]{64}$/u);

    const cleanup = runLargeDoc(['cleanup', '--session', init.sessionDir, '--policy', 'prune']);
    assert.equal(cleanup.schemaVersion, 'large-document-writer-cleanup-receipt/v1');
    assert.equal(cleanup.policy, 'prune');
  });

  it('reports corrupt chunks from status after interrupted chunk writes', () => {
    const root = makeTempRoot();
    const target = path.join(root, 'target.md');
    const init = runLargeDoc([
      'init',
      '--target',
      target,
      '--mode',
      'create',
      '--chunk',
      '001:scope',
    ]);
    const chunksDir = path.join(init.sessionDir, 'chunks');
    fs.mkdirSync(chunksDir, { recursive: true });
    fs.writeFileSync(path.join(chunksDir, '001.md'), '<!-- incomplete\n', 'utf8');

    const status = runLargeDoc(['status', '--session', init.sessionDir]);
    assert.deepEqual(status.corruptChunks, ['001']);
  });

  it('rejects malformed chunk plans and integer thresholds', () => {
    const root = makeTempRoot();
    const target = path.join(root, 'target.md');

    const malformedChunk = runLargeDocRaw([
      'init',
      '--target',
      target,
      '--mode',
      'create',
      '--chunk',
      '001',
    ]);
    assert.notEqual(malformedChunk.status, 0);
    assert.match(malformedChunk.stderr, /--chunk must be chunkId:sectionId/u);

    const extraChunkField = runLargeDocRaw([
      'init',
      '--target',
      target,
      '--mode',
      'create',
      '--chunk',
      '001:scope:extra',
    ]);
    assert.notEqual(extraChunkField.status, 0);
    assert.match(extraChunkField.stderr, /--chunk must be chunkId:sectionId/u);

    const badMinBytes = runLargeDocRaw([
      'init',
      '--target',
      target,
      '--mode',
      'create',
      '--chunk',
      '001:scope',
      '--min-bytes',
      '10x',
    ]);
    assert.notEqual(badMinBytes.status, 0);
    assert.match(badMinBytes.stderr, /--min-bytes must be a non-negative integer/u);

    const badMinLines = runLargeDocRaw([
      'init',
      '--target',
      target,
      '--mode',
      'create',
      '--chunk',
      '001:scope',
      '--min-lines',
      'abc',
    ]);
    assert.notEqual(badMinLines.status, 0);
    assert.match(badMinLines.stderr, /--min-lines must be a non-negative integer/u);
  });
});
