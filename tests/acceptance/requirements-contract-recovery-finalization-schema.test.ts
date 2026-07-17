import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { expect, it } from 'vitest';

const SCHEMA_ROOT = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas'
);
const SCHEMA_FILES = [
  'requirements-contract-controlled-command-receipt.schema.json',
  'requirements-contract-recovery-finalization-receipt.schema.json',
  'requirements-contract-recovery-finalization-state-decision-receipt.schema.json',
  'requirements-contract-recovery-lineage-receipt.schema.json',
] as const;

function readSchema(name: (typeof SCHEMA_FILES)[number]): Record<string, any> {
  const schemaPath = path.join(SCHEMA_ROOT, name);
  expect(existsSync(schemaPath), `missing recovery schema: ${name}`).toBe(true);
  return JSON.parse(readFileSync(schemaPath, 'utf8')) as Record<string, any>;
}

it('publishes strict schemas for controlled commands and recovery finalization', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  for (const schemaName of SCHEMA_FILES) {
    expect(() => ajv.compile(readSchema(schemaName))).not.toThrow();
  }
});

it('owns command roles and provisional versus finalized lineage in the schema', () => {
  const schema = readSchema('requirements-contract-recovery-lineage-receipt.schema.json');
  const roles = schema['x-commandRoles'];
  const finalizedRoles = schema['x-finalizedCommandReceiptRoles'];
  const finalizerRole = schema['x-finalizerCommandRole'];
  const transactionRoots = schema['x-transactionRoots'];
  const finalizationReceiptTarget = schema['x-finalizationReceiptTarget'];

  expect(roles).toEqual(
    expect.objectContaining({
      preEdit: expect.any(String),
      bootstrap: expect.any(String),
      postBootstrap: expect.any(String),
    })
  );
  expect(finalizedRoles).toEqual(expect.arrayContaining(Object.values(roles)));
  expect(finalizerRole).toEqual(expect.any(String));
  expect(transactionRoots).toEqual({
    transaction: expect.any(String),
    failure: expect.any(String),
  });
  expect(finalizationReceiptTarget).toEqual({
    path: expect.any(String),
    schemaVersion: expect.any(String),
  });
  expect(schema.properties?.state?.enum).toEqual(['provisional', 'finalized']);

  const serialized = JSON.stringify(schema);
  for (const circularField of [
    'selfHash',
    'readbackHash',
    'finalizationReceiptHash',
    'externalFinalizerReceiptHash',
  ]) {
    expect(serialized).not.toContain(`"${circularField}"`);
  }
});
