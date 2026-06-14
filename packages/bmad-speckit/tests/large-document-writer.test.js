const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const writer = require('../src/utils/large-document-writer');
const { writeChunk } = require('../src/utils/large-document-writer/chunk-store');

function makeTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'large-document-writer-'));
}

function markerChunk({ chunkId = '001', sectionId = 'scope', body = '## Scope\nBody text.\n' } = {}) {
  return [
    `<!-- large-document-writer chunkId=${chunkId} sectionId=${sectionId} begin -->`,
    body.trimEnd(),
    `<!-- large-document-writer chunkId=${chunkId} sectionId=${sectionId} end -->`,
    '',
  ].join('\n');
}

function assertSha256(value) {
  assert.match(value, /^sha256:[0-9a-f]{64}$/u);
}

describe('large-document-writer helper', () => {
  it('initializes a draft session without touching the final target', () => {
    const root = makeTempRoot();
    const targetPath = path.join(root, 'target.md');

    const session = writer.initSession({
      targetPath,
      mode: 'create',
      profile: 'markdown',
      chunkPlan: [{ chunkId: '001', sectionId: 'scope' }],
      requiredHeadings: ['## Scope'],
      minBytes: 10,
      minLines: 1,
    });

    assert.equal(fs.existsSync(targetPath), false);
    assert.equal(session.targetTouched, false);
    assert.ok(session.sessionDir.endsWith('.target.md.draft'));

    const manifest = JSON.parse(
      fs.readFileSync(path.join(session.sessionDir, 'manifest.json'), 'utf8')
    );
    assert.equal(manifest.schemaVersion, 'large-document-writer-session/v1');
    assert.equal(path.resolve(manifest.targetPath), targetPath);
    assert.deepEqual(manifest.chunkPlan, [{ chunkId: '001', sectionId: 'scope' }]);
  });

  it('rejects malformed chunk markers with CHUNK_MARKER_INVALID', () => {
    const root = makeTempRoot();
    const session = writer.initSession({
      targetPath: path.join(root, 'target.md'),
      mode: 'create',
      chunkPlan: [{ chunkId: '001', sectionId: 'scope' }],
    });

    assert.throws(
      () =>
        writer.addChunk({
          sessionDir: session.sessionDir,
          chunkId: '001',
          sectionId: 'scope',
          content: '<!-- large-document-writer chunkId=001 sectionId=scope begin -->\n## Scope\n',
        }),
      (error) =>
        error.code === 'CHUNK_MARKER_INVALID' &&
        error.details.expectedBeginMarker === '<!-- large-document-writer chunkId=001 sectionId=scope begin -->' &&
        error.details.expectedEndMarker === '<!-- large-document-writer chunkId=001 sectionId=scope end -->' &&
        /write-chunk/u.test(error.details.hint)
    );
  });

  it('writeChunk wraps raw content before accepting the chunk', () => {
    const root = makeTempRoot();
    const session = writer.initSession({
      targetPath: path.join(root, 'target.md'),
      mode: 'create',
      chunkPlan: [{ chunkId: '001', sectionId: 'scope' }],
    });

    const receipt = writeChunk({
      sessionDir: session.sessionDir,
      chunkId: '001',
      sectionId: 'scope',
      content: '## Scope\nRaw body.\n',
    });

    assert.equal(receipt.schemaVersion, 'large-document-writer-chunk-receipt/v1');
    assert.equal(receipt.wrapped, true);
    assert.equal(fs.readFileSync(path.join(session.sessionDir, 'chunks', '001.md'), 'utf8'), '## Scope\nRaw body.\n');
  });

  it('rejects unsafe chunk and section tokens before filesystem access', () => {
    const root = makeTempRoot();
    const session = writer.initSession({
      targetPath: path.join(root, 'target.md'),
      mode: 'create',
      chunkPlan: [{ chunkId: '../escape', sectionId: 'scope' }],
    });

    assert.throws(
      () =>
        writer.addChunk({
          sessionDir: session.sessionDir,
          chunkId: '../escape',
          sectionId: 'scope',
          content: markerChunk({ chunkId: '../escape', sectionId: 'scope' }),
        }),
      (error) => error.code === 'INVALID_TOKEN' && error.details.name === 'chunkId'
    );
    assert.equal(fs.existsSync(path.join(session.sessionDir, 'escape.md')), false);

    const sessionWithUnsafeSection = writer.initSession({
      targetPath: path.join(root, 'target-2.md'),
      mode: 'create',
      chunkPlan: [{ chunkId: '001', sectionId: '../scope' }],
    });

    assert.throws(
      () =>
        writer.addChunk({
          sessionDir: sessionWithUnsafeSection.sessionDir,
          chunkId: '001',
          sectionId: '../scope',
          content: markerChunk({ chunkId: '001', sectionId: '../scope' }),
        }),
      (error) => error.code === 'INVALID_TOKEN' && error.details.name === 'sectionId'
    );
  });

  it('validates initSession options before resolving paths', () => {
    assert.throws(
      () => writer.initSession(),
      (error) => error.code === 'INVALID_INIT_OPTIONS'
    );
    assert.throws(
      () => writer.initSession({}),
      (error) => error.code === 'INVALID_TARGET_PATH'
    );
    assert.throws(
      () => writer.initSession({ targetPath: '   ' }),
      (error) => error.code === 'INVALID_TARGET_PATH'
    );
    assert.throws(
      () => writer.initSession({ targetPath: 'target.md', sessionDir: '' }),
      (error) => error.code === 'INVALID_SESSION_DIR'
    );
  });

  it('assembles chunks in manifest order, strips markers, validates, and promotes create mode', () => {
    const root = makeTempRoot();
    const targetPath = path.join(root, 'target.md');
    const session = writer.initSession({
      targetPath,
      mode: 'create',
      profile: 'markdown',
      chunkPlan: [
        { chunkId: '001', sectionId: 'intro' },
        { chunkId: '002', sectionId: 'scope' },
      ],
      requiredHeadings: ['## Scope'],
      requiredFragments: ['Body text.'],
      minBytes: 20,
      minLines: 2,
    });

    writer.addChunk({
      sessionDir: session.sessionDir,
      chunkId: '002',
      sectionId: 'scope',
      content: markerChunk({ chunkId: '002', sectionId: 'scope', body: '## Scope\nBody text.\n' }),
    });
    writer.addChunk({
      sessionDir: session.sessionDir,
      chunkId: '001',
      sectionId: 'intro',
      content: markerChunk({ chunkId: '001', sectionId: 'intro', body: '# Title\nIntro.\n' }),
    });

    const status = writer.getSessionStatus({ sessionDir: session.sessionDir });
    assert.equal(status.targetTouched, false);
    assert.equal(status.lastCompleteChunkId, '002');
    assert.deepEqual(status.missingChunks, []);

    const assembled = writer.assembleSession({ sessionDir: session.sessionDir });
    assert.equal(fs.existsSync(targetPath), false);
    assert.equal(assembled.outputPath, path.join(session.sessionDir, 'assembled.md'));
    const assembledText = fs.readFileSync(assembled.outputPath, 'utf8');
    assert.equal(assembledText.includes('large-document-writer chunkId='), false);
    assert.ok(assembledText.indexOf('# Title') < assembledText.indexOf('## Scope'));

    const validation = writer.validateAssembly({ sessionDir: session.sessionDir });
    assert.equal(validation.ok, true);

    const promotion = writer.promoteAssembly({ sessionDir: session.sessionDir });
    assert.equal(fs.existsSync(targetPath), true);
    assertSha256(promotion.finalHash);
    assert.equal(promotion.backupPath, null);
    assert.equal(promotion.originalHash, null);
    assert.equal(promotion.backupHash, null);
  });

  it('returns null nextChunkId when a non-numeric chunk plan is complete', () => {
    const root = makeTempRoot();
    const session = writer.initSession({
      targetPath: path.join(root, 'target.md'),
      mode: 'create',
      chunkPlan: [{ chunkId: 'intro', sectionId: 'scope' }],
    });
    writer.addChunk({
      sessionDir: session.sessionDir,
      chunkId: 'intro',
      sectionId: 'scope',
      content: markerChunk({ chunkId: 'intro', sectionId: 'scope' }),
    });

    const status = writer.getSessionStatus({ sessionDir: session.sessionDir });

    assert.equal(status.lastCompleteChunkId, 'intro');
    assert.equal(status.nextChunkId, null);
  });

  it('fails closed for missing chunks, chunk hash drift, validation errors, and early cleanup', () => {
    const root = makeTempRoot();
    const session = writer.initSession({
      targetPath: path.join(root, 'target.md'),
      mode: 'create',
      profile: 'markdown',
      chunkPlan: [{ chunkId: '001', sectionId: 'scope' }],
      requiredHeadings: ['## Scope'],
      forbiddenFragments: ['FORBIDDEN'],
      allowPlaceholders: false,
      minBytes: 20,
      minLines: 2,
    });

    assert.throws(
      () => writer.assembleSession({ sessionDir: session.sessionDir }),
      (error) => error.code === 'ASSEMBLY_VALIDATION_FAILED'
    );
    assert.throws(
      () => writer.cleanupSession({ sessionDir: session.sessionDir, policy: 'delete' }),
      (error) => error.code === 'CLEANUP_BEFORE_PROMOTE'
    );

    const receipt = writer.addChunk({
      sessionDir: session.sessionDir,
      chunkId: '001',
      sectionId: 'scope',
      content: markerChunk({
        chunkId: '001',
        sectionId: 'scope',
        body: '## Scope\nFORBIDDEN {{placeholder}}\n',
      }),
    });
    assertSha256(receipt.chunkHash);
    fs.appendFileSync(path.join(session.sessionDir, 'chunks', '001.md'), 'drift\n', 'utf8');
    assert.throws(
      () => writer.assembleSession({ sessionDir: session.sessionDir }),
      (error) => error.code === 'CHUNK_HASH_MISMATCH'
    );
  });

  it('blocks promotion when assembled content changed after validation', () => {
    const root = makeTempRoot();
    const session = writer.initSession({
      targetPath: path.join(root, 'target.md'),
      mode: 'create',
      profile: 'markdown',
      chunkPlan: [{ chunkId: '001', sectionId: 'scope' }],
      requiredHeadings: ['## Scope'],
    });

    writer.addChunk({
      sessionDir: session.sessionDir,
      chunkId: '001',
      sectionId: 'scope',
      content: markerChunk({ body: '## Scope\nOriginal.\n' }),
    });
    writer.assembleSession({ sessionDir: session.sessionDir });
    writer.validateAssembly({ sessionDir: session.sessionDir });
    fs.appendFileSync(path.join(session.sessionDir, 'assembled.md'), 'Stale mutation.\n', 'utf8');

    assert.throws(
      () => writer.promoteAssembly({ sessionDir: session.sessionDir }),
      (error) =>
        error.code === 'ASSEMBLY_VALIDATION_FAILED' &&
        error.details.reason === 'stale_validation_receipt'
    );
    assert.equal(fs.existsSync(path.join(root, 'target.md')), false);
  });

  it('blocks cleanup with a structured error when promoted target is missing', () => {
    const root = makeTempRoot();
    const targetPath = path.join(root, 'target.md');
    const session = writer.initSession({
      targetPath,
      mode: 'create',
      profile: 'markdown',
      chunkPlan: [{ chunkId: '001', sectionId: 'scope' }],
      requiredHeadings: ['## Scope'],
    });

    writer.addChunk({
      sessionDir: session.sessionDir,
      chunkId: '001',
      sectionId: 'scope',
      content: markerChunk({ body: '## Scope\nBody.\n' }),
    });
    writer.assembleSession({ sessionDir: session.sessionDir });
    writer.validateAssembly({ sessionDir: session.sessionDir });
    writer.promoteAssembly({ sessionDir: session.sessionDir });
    fs.rmSync(targetPath, { force: true });

    assert.throws(
      () => writer.cleanupSession({ sessionDir: session.sessionDir, policy: 'keep' }),
      (error) => error.code === 'PROMOTED_TARGET_MISSING'
    );
  });

  it('safeWriteText and safeWriteJson write receipts with backup and final hash evidence', () => {
    const root = makeTempRoot();
    const textPath = path.join(root, 'safe.md');
    const createReceipt = writer.safeWriteText(textPath, '# First\n', { mode: 'create' });
    assertSha256(createReceipt.tempHash);
    assertSha256(createReceipt.finalHash);
    assert.equal(createReceipt.backupPath, null);

    const replaceReceipt = writer.safeWriteText(textPath, '# Second\n', { mode: 'replace' });
    assert.ok(replaceReceipt.backupPath);
    assert.equal(fs.existsSync(replaceReceipt.backupPath), true);
    assertSha256(replaceReceipt.originalHash);
    assertSha256(replaceReceipt.backupHash);
    assertSha256(replaceReceipt.finalHash);

    const jsonPath = path.join(root, 'safe.json');
    const jsonReceipt = writer.safeWriteJson(jsonPath, { b: 2, a: 1 }, { mode: 'create' });
    assert.deepEqual(JSON.parse(fs.readFileSync(jsonPath, 'utf8')), { a: 1, b: 2 });
    assertSha256(jsonReceipt.finalHash);
  });

  it('cleanup policies keep backups after replace promotion', () => {
    const root = makeTempRoot();
    const targetPath = path.join(root, 'target.md');
    fs.writeFileSync(targetPath, '# Old\n', 'utf8');
    const session = writer.initSession({
      targetPath,
      mode: 'replace',
      profile: 'markdown',
      chunkPlan: [{ chunkId: '001', sectionId: 'scope' }],
      requiredHeadings: ['## Scope'],
    });

    writer.addChunk({
      sessionDir: session.sessionDir,
      chunkId: '001',
      sectionId: 'scope',
      content: markerChunk({ body: '## Scope\nReplacement.\n' }),
    });
    writer.assembleSession({ sessionDir: session.sessionDir });
    writer.validateAssembly({ sessionDir: session.sessionDir });
    const promotion = writer.promoteAssembly({ sessionDir: session.sessionDir });
    assert.ok(promotion.backupPath);

    const cleanup = writer.cleanupSession({ sessionDir: session.sessionDir, policy: 'prune' });
    assert.equal(cleanup.policy, 'prune');
    assert.equal(fs.existsSync(promotion.backupPath), true);
    assert.equal(fs.existsSync(path.join(session.sessionDir, 'chunks')), false);
    assert.equal(fs.existsSync(path.join(session.sessionDir, 'promote-receipt.json')), true);
  });
});
