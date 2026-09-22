import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { afterEach, describe, expect, it } from 'vitest';
import { inventoryRequirementsRecordStorage, reserveRequirementsRecordStorage } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-record-storage';

const temporaryRoots: string[] = [];
const modulePath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-content-store.ts'
);

async function loadStore() {
  expect(existsSync(modulePath)).toBe(true);
  if (!existsSync(modulePath)) return null;
  return import(pathToFileURL(modulePath).href);
}

function createRecordRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-content-store-'));
  temporaryRoots.push(root);
  return root;
}

function objectFiles(root: string): string[] {
  const objects = path.join(root, 'authoring', 'objects', 'sha256');
  if (!existsSync(objects)) return [];
  return readdirSync(objects, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name));
}

describe('requirements contract content store', () => {
  afterEach(() => {
    for (const root of temporaryRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('consumes a storage reservation for new bytes and leaves duplicates free', async () => {
    const store = await loadStore();
    if (!store) return;
    const recordRoot = createRecordRoot();
    const bytes = Buffer.from('{"payload":"reserved"}', 'utf8');
    const inventory = inventoryRequirementsRecordStorage(recordRoot);
    const reservation = reserveRequirementsRecordStorage({
      recordRoot,
      operationId: 'OP-RESERVE',
      expectedInventoryHash: inventory.inventoryHash,
      requestedUniqueBytes: bytes.length,
      requestedMetadataBytes: 0,
    });
    store.publishRequirementsContentObject({
      recordRoot, role: 'reserved', mediaType: 'application/json', bytes, reservation,
    } as never);
    store.publishRequirementsContentObject({
      recordRoot, role: 'reserved-again', mediaType: 'application/json', bytes, reservation,
    } as never);
    const updated = JSON.parse(readFileSync(
      path.join(recordRoot, 'authoring', 'operations', 'OP-RESERVE', 'storage-reservation.json'),
      'utf8'
    ));
    expect(updated.consumedUniqueBytes).toBe(bytes.length);
  });

  it('stores identical raw bytes once across logical roles and media bindings', async () => {
    const store = await loadStore();
    if (!store) return;
    const recordRoot = createRecordRoot();
    const bytes = Buffer.from('第一行\r\nemoji: 😀\n', 'utf8');

    const source = store.publishRequirementsContentObject({
      recordRoot,
      role: 'source',
      mediaType: 'text/markdown; charset=utf-8',
      bytes,
    });
    const candidate = store.publishRequirementsContentObject({
      recordRoot,
      role: 'review_candidate',
      mediaType: 'application/octet-stream',
      bytes,
    });

    expect(candidate.contentHash).toBe(source.contentHash);
    expect(candidate.recordRelativePath).toBe(source.recordRelativePath);
    expect(objectFiles(recordRoot)).toHaveLength(1);
    expect(store.readRequirementsContentObject({ recordRoot, ref: source })).toEqual(bytes);
  });

  it('blocks tampering and paths outside the record root', async () => {
    const store = await loadStore();
    if (!store) return;
    const recordRoot = createRecordRoot();
    const ref = store.publishRequirementsContentObject({
      recordRoot,
      role: 'source',
      mediaType: 'text/plain; charset=utf-8',
      bytes: Buffer.from('authority bytes', 'utf8'),
    });
    writeFileSync(path.join(recordRoot, ...ref.recordRelativePath.split('/')), 'tampered bytes!', 'utf8');
    expect(() => store.readRequirementsContentObject({ recordRoot, ref }))
      .toThrow('requirements_content_object_hash_mismatch');
    expect(() => store.verifyRequirementsContentRef({
      recordRoot,
      ref: { ...ref, recordRelativePath: '../escape' },
    })).toThrow('requirements_content_object_path_invalid');
  });

  it('publishes an exact content-ref schema', async () => {
    const store = await loadStore();
    if (!store) return;
    const schemaPath = path.resolve(
      'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-content-ref.schema.json'
    );
    expect(existsSync(schemaPath)).toBe(true);
    if (!existsSync(schemaPath)) return;
    const validate = new Ajv2020({ strict: false }).compile(
      JSON.parse(readFileSync(schemaPath, 'utf8'))
    );
    const recordRoot = createRecordRoot();
    const ref = store.publishRequirementsContentObject({
      recordRoot,
      role: 'source',
      mediaType: 'text/plain; charset=utf-8',
      bytes: Buffer.from('schema bytes', 'utf8'),
    });
    expect(validate(ref), validate.errors?.map((error) => error.message).join(', ')).toBe(true);
    expect(validate({ ...ref, role: 'source' })).toBe(false);
    expect(validate({ ...ref, recordRelativePath: '../escape' })).toBe(false);
  });

  it('rejects an intermediate junction that escapes the record root', async () => {
    const store = await loadStore();
    if (!store) return;
    const recordRoot = createRecordRoot();
    const ref = store.publishRequirementsContentObject({
      recordRoot,
      role: 'source',
      mediaType: 'text/plain; charset=utf-8',
      bytes: Buffer.from('stable', 'utf8'),
    });
    const escaped = path.join(recordRoot, 'escaped');
    mkdirSync(escaped, { recursive: true });
    rmSync(path.join(recordRoot, 'authoring', 'objects', 'sha256'), { recursive: true, force: true });
    symlinkSync(escaped, path.join(recordRoot, 'authoring', 'objects', 'sha256'), 'junction');
    expect(() => store.readRequirementsContentObject({ recordRoot, ref }))
      .toThrow(/symlink|path/u);
  });
});
