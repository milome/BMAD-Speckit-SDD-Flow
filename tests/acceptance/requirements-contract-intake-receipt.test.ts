import { describe, expect, it } from 'vitest';
import {
  createRequirementsContractIntakeReceipt,
  validateRequirementsContractIntakeReceipt,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-intake-receipt';

function fixture() {
  const messages = [
    {
      messageId: 'message-alpha',
      turnId: 'turn-alpha',
      actorIdentityClass: 'human_requester',
      content: 'Preserve the complete checkout requirement.',
    },
    {
      messageId: 'message-beta',
      turnId: 'turn-beta',
      actorIdentityClass: 'human_requester',
      content: 'Prefix: retry exactly three times. Suffix.',
    },
  ];
  const spanText = 'retry exactly three times';
  const spanStart = Buffer.byteLength('Prefix: ', 'utf8');
  return {
    input: {
      requirementSetId: 'fixture-requirement-set',
      sessionId: 'fixture-session',
      branch: 'fixture-branch',
      requestedArtifactRole: 'requirement_source_prd' as const,
      capturedAt: '2026-07-14T01:00:00.000Z',
      messages,
      excerpts: [
        {
          order: 1,
          excerptId: 'excerpt-alpha',
          turnId: messages[0].turnId,
          boundary: { kind: 'message' as const, messageId: messages[0].messageId },
        },
        {
          order: 2,
          excerptId: 'excerpt-beta',
          turnId: messages[1].turnId,
          boundary: {
            kind: 'span' as const,
            messageId: messages[1].messageId,
            startUtf8Byte: spanStart,
            endUtf8ByteExclusive: spanStart + Buffer.byteLength(spanText, 'utf8'),
          },
        },
      ],
    },
    expectedContents: [messages[0].content, spanText],
  };
}

describe('requirements contract intake receipt', () => {
  it('derives immutable excerpt content and hashes from ordered message boundaries', () => {
    const { input, expectedContents } = fixture();
    const receipt = createRequirementsContractIntakeReceipt(input);

    expect(receipt.excerpts.map((excerpt) => excerpt.content)).toEqual(expectedContents);
    expect(receipt.excerpts.map((excerpt) => excerpt.order)).toEqual(input.excerpts.map((row) => row.order));
    expect(validateRequirementsContractIntakeReceipt(receipt)).toBe(true);
    expect(createRequirementsContractIntakeReceipt(input)).toEqual(receipt);
  });

  it('rejects duplicate identities, duplicate order, and invalid UTF-8 span boundaries', () => {
    const { input } = fixture();
    expect(() =>
      createRequirementsContractIntakeReceipt({
        ...input,
        excerpts: input.excerpts.map((excerpt) => ({ ...excerpt, order: 1 })),
      })
    ).toThrow(/order/u);
    expect(() =>
      createRequirementsContractIntakeReceipt({
        ...input,
        excerpts: input.excerpts.map((excerpt) => ({
          ...excerpt,
          excerptId: input.excerpts[0].excerptId,
        })),
      })
    ).toThrow(/excerptId/u);
    expect(() =>
      createRequirementsContractIntakeReceipt({
        ...input,
        messages: [{ ...input.messages[0], content: '前缀' }],
        excerpts: [{
          ...input.excerpts[0],
          boundary: {
            kind: 'span',
            messageId: input.messages[0].messageId,
            startUtf8Byte: 1,
            endUtf8ByteExclusive: 2,
          },
        }],
      })
    ).toThrow(/UTF-8/u);
  });

  it('rejects forged receipt hashes and undeclared readback fields', () => {
    const receipt = createRequirementsContractIntakeReceipt(fixture().input);
    expect(validateRequirementsContractIntakeReceipt({
      ...receipt,
      receiptHash: receipt.sourceContentHash,
    })).toBe(false);
    expect(validateRequirementsContractIntakeReceipt({
      ...receipt,
      inferredAuthority: true,
    })).toBe(false);
  });
});
