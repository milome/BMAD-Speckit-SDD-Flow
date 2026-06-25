const fs = require('node:fs');
const path = require('node:path');
const { block } = require('./errors');
const { readManifest, sessionPaths, updateManifest } = require('./draft-session');
const { sha256Text, writeJsonReceipt } = require('./receipts');

function markerRegex(chunkId, sectionId) {
  const escapedChunk = chunkId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedSection = sectionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `^<!-- large-document-writer chunkId=${escapedChunk} sectionId=${escapedSection} begin -->\\r?\\n([\\s\\S]*?)\\r?\\n<!-- large-document-writer chunkId=${escapedChunk} sectionId=${escapedSection} end -->\\r?\\n?$`,
    'u'
  );
}

function beginMarker(chunkId, sectionId) {
  return `<!-- large-document-writer chunkId=${chunkId} sectionId=${sectionId} begin -->`;
}

function endMarker(chunkId, sectionId) {
  return `<!-- large-document-writer chunkId=${chunkId} sectionId=${sectionId} end -->`;
}

function markerFailureDetails(chunkId, sectionId) {
  return {
    chunkId,
    sectionId,
    expectedBeginMarker: beginMarker(chunkId, sectionId),
    expectedEndMarker: endMarker(chunkId, sectionId),
    hint: 'Use large-doc write-chunk with raw content to avoid hand-authoring markers.',
  };
}

function wrapChunkContent(content, chunkId, sectionId) {
  const body = String(content).replace(/\r\n/g, '\n').replace(/\s+$/u, '');
  return `${beginMarker(chunkId, sectionId)}\n${body}\n${endMarker(chunkId, sectionId)}\n`;
}

function assertSafeToken(name, value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._-]+$/u.test(value)) {
    block('INVALID_TOKEN', { name, value });
  }
}

function chunkPath(sessionDir, chunkId) {
  assertSafeToken('chunkId', chunkId);
  return path.join(sessionPaths(sessionDir).chunksDir, `${chunkId}.md`);
}

function chunkReceiptPath(sessionDir, chunkId) {
  assertSafeToken('chunkId', chunkId);
  return path.join(sessionPaths(sessionDir).receiptsDir, `${chunkId}.receipt.json`);
}

function stripChunkMarkers(content, chunkId, sectionId) {
  const match = String(content).match(markerRegex(chunkId, sectionId));
  if (!match) block('CHUNK_MARKER_INVALID', markerFailureDetails(chunkId, sectionId));
  return `${match[1].replace(/\r\n/g, '\n').replace(/\s+$/u, '')}\n`;
}

function addChunk({ sessionDir, chunkId, sectionId, content }) {
  assertSafeToken('chunkId', chunkId);
  assertSafeToken('sectionId', sectionId);
  const manifest = readManifest(sessionDir);
  const planEntry = manifest.chunkPlan.find((entry) => entry.chunkId === chunkId);
  if (!planEntry || planEntry.sectionId !== sectionId) {
    block('CHUNK_MARKER_INVALID', markerFailureDetails(chunkId, sectionId));
  }
  const body = stripChunkMarkers(content, chunkId, sectionId);
  const filePath = chunkPath(sessionDir, chunkId);
  if (fs.existsSync(filePath)) block('DUPLICATE_CHUNK', { chunkId });
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, body, 'utf8');
  const receipt = {
    schemaVersion: 'large-document-writer-chunk-receipt/v1',
    chunkId,
    sectionId,
    chunkPath: filePath,
    chunkHash: sha256Text(body),
    bytes: Buffer.byteLength(body, 'utf8'),
    acceptedAt: new Date().toISOString(),
  };
  writeJsonReceipt(chunkReceiptPath(sessionDir, chunkId), receipt);
  updateManifest(sessionDir, {});
  return receipt;
}

function writeChunk({ sessionDir, chunkId, sectionId, content }) {
  const receipt = addChunk({
    sessionDir,
    chunkId,
    sectionId,
    content: wrapChunkContent(content, chunkId, sectionId),
  });
  const wrappedReceipt = { ...receipt, wrapped: true };
  writeJsonReceipt(chunkReceiptPath(sessionDir, chunkId), wrappedReceipt);
  return wrappedReceipt;
}

function readChunkWithReceipt(sessionDir, entry) {
  assertSafeToken('chunkId', entry.chunkId);
  assertSafeToken('sectionId', entry.sectionId);
  const filePath = chunkPath(sessionDir, entry.chunkId);
  const receiptPath = chunkReceiptPath(sessionDir, entry.chunkId);
  if (!fs.existsSync(filePath) || !fs.existsSync(receiptPath)) {
    block('ASSEMBLY_VALIDATION_FAILED', { missingChunk: entry.chunkId });
  }
  const text = fs.readFileSync(filePath, 'utf8');
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  const actualHash = sha256Text(text);
  if (receipt.chunkHash !== actualHash) {
    block('CHUNK_HASH_MISMATCH', { chunkId: entry.chunkId, expected: receipt.chunkHash, actual: actualHash });
  }
  return { text, receipt };
}

function listChunkState(sessionDir) {
  const manifest = readManifest(sessionDir);
  const paths = sessionPaths(sessionDir);
  const missingChunks = [];
  const corruptChunks = [];
  const completedChunks = [];

  for (const entry of manifest.chunkPlan) {
    assertSafeToken('chunkId', entry.chunkId);
    assertSafeToken('sectionId', entry.sectionId);
    const filePath = chunkPath(sessionDir, entry.chunkId);
    const receiptPath = chunkReceiptPath(sessionDir, entry.chunkId);
    if (fs.existsSync(filePath) && !fs.existsSync(receiptPath)) {
      corruptChunks.push(entry.chunkId);
      continue;
    }
    if (!fs.existsSync(filePath) || !fs.existsSync(receiptPath)) {
      missingChunks.push(entry.chunkId);
      continue;
    }
    const text = fs.readFileSync(filePath, 'utf8');
    const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
    if (receipt.chunkHash !== sha256Text(text)) corruptChunks.push(entry.chunkId);
    else completedChunks.push(entry.chunkId);
  }

  const chunkFiles = fs.existsSync(paths.chunksDir)
    ? fs.readdirSync(paths.chunksDir).filter((name) => name.endsWith('.md'))
    : [];
  for (const name of chunkFiles) {
    const chunkId = path.basename(name, '.md');
    if (!manifest.chunkPlan.some((entry) => entry.chunkId === chunkId)) corruptChunks.push(chunkId);
  }

  return { completedChunks, corruptChunks, missingChunks };
}

module.exports = {
  addChunk,
  assertSafeToken,
  beginMarker,
  chunkPath,
  chunkReceiptPath,
  endMarker,
  listChunkState,
  readChunkWithReceipt,
  stripChunkMarkers,
  wrapChunkContent,
  writeChunk,
};
