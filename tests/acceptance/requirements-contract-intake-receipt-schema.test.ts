import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const HASH = `sha256:${'a'.repeat(64)}`;
const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-intake-receipt.schema.json'
);

function receipt() {
  return {
    schemaVersion: 'requirements-contract-intake-receipt/v1',
    requirementSetId: 'checkout-reliability',
    sessionId: 'session-2026-07-13-001',
    branch: 'main',
    entrySource: 'session_requirements',
    requestedArtifactRole: 'requirement_source_prd',
    sourceContentHash: HASH,
    excerpts: [
      {
        order: 2,
        excerptId: 'excerpt-user-001',
        turnId: 'turn-001',
        actorIdentityClass: 'user',
        content: 'Capture the frozen intake source without inferring its artifact role.',
        contentHash: HASH,
        boundary: {
          kind: 'message',
          messageId: 'message-001',
        },
      },
      {
        order: 9,
        excerptId: 'excerpt-user-002',
        turnId: 'turn-002',
        actorIdentityClass: 'user',
        content: 'This excerpt is an exact UTF-8 byte span.',
        contentHash: HASH,
        boundary: {
          kind: 'span',
          messageId: 'message-002',
          startUtf8Byte: 0,
          endUtf8ByteExclusive: 47,
        },
      },
    ],
    capturedAt: '2026-07-13T10:30:00.000Z',
    receiptHash: HASH,
  };
}

function validator() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(readFileSync(schemaPath, 'utf8')));
}

it('publishes the inactive Intake Receipt schema boundary', () => {
  expect(existsSync(schemaPath)).toBe(true);
});

describe.runIf(existsSync(schemaPath))('requirements-contract-intake-receipt/v1', () => {
  it('accepts ordered message and span excerpts without claiming continuity or hash recomputation', () => {
    const validate = validator();

    expect(validate(receipt()), JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects invalid entry sources, inferred artifact roles, and malformed SHA256 values', () => {
    const validate = validator();
    const invalidEntrySource = { ...receipt(), entrySource: 'filename_inference' };
    const invalidRole = { ...receipt(), requestedArtifactRole: 'implementation_plan' };
    const invalidSourceHash = { ...receipt(), sourceContentHash: 'sha256:ABC123' };
    const invalidExcerptHash = receipt();
    invalidExcerptHash.excerpts[0].contentHash = 'sha256:short';
    const invalidReceiptHash = { ...receipt(), receiptHash: 'sha256:not-a-hash' };

    expect(validate(invalidEntrySource)).toBe(false);
    expect(validate(invalidRole)).toBe(false);
    expect(validate(invalidSourceHash)).toBe(false);
    expect(validate(invalidExcerptHash)).toBe(false);
    expect(validate(invalidReceiptHash)).toBe(false);
  });

  it('rejects missing actor identity and ambiguous or incomplete boundaries', () => {
    const validate = validator();
    const missingActor = receipt() as Record<string, unknown>;
    delete (missingActor.excerpts as Array<Record<string, unknown>>)[0].actorIdentityClass;
    const ambiguousBoundary = receipt();
    ambiguousBoundary.excerpts[0].boundary = {
      kind: 'message',
      messageId: 'message-001',
      startUtf8Byte: 0,
    } as never;
    const incompleteSpan = receipt();
    incompleteSpan.excerpts[1].boundary = {
      kind: 'span',
      messageId: 'message-002',
      startUtf8Byte: 0,
    } as never;

    expect(validate(missingActor)).toBe(false);
    expect(validate(ambiguousBoundary)).toBe(false);
    expect(validate(incompleteSpan)).toBe(false);
  });

  it('rejects undeclared properties at the receipt, excerpt, and boundary levels', () => {
    const validate = validator();
    const extraReceipt = { ...receipt(), inferredFromFilename: true };
    const extraExcerpt = receipt();
    extraExcerpt.excerpts[0] = {
      ...extraExcerpt.excerpts[0],
      normalizedContent: 'not authorized',
    } as never;
    const extraBoundary = receipt();
    extraBoundary.excerpts[1].boundary = {
      ...extraBoundary.excerpts[1].boundary,
      endIsAfterStart: true,
    } as never;

    expect(validate(extraReceipt)).toBe(false);
    expect(validate(extraExcerpt)).toBe(false);
    expect(validate(extraBoundary)).toBe(false);
  });
});
