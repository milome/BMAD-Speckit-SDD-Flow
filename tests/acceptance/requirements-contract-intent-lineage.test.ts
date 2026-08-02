import { describe, expect, it } from 'vitest';
import {
  createRequirementsContractIntakeReceipt,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-intake-receipt';
import {
  createRequirementsContractIntentLineageLedger,
  validateRequirementsContractIntentLineageLedger,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-intent-lineage';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

function fixture() {
  const messages = Array.from({ length: 5 }, (_item, index) => ({
    messageId: `message-${index + 1}`,
    turnId: `turn-${index + 1}`,
    actorIdentityClass: 'human_requester',
    content: `Material intent ${index + 1}`,
  }));
  const receipt = createRequirementsContractIntakeReceipt({
    requirementSetId: 'lineage-fixture-set',
    sessionId: 'lineage-fixture-session',
    branch: 'lineage-fixture-branch',
    requestedArtifactRole: 'requirement_source_prd',
    capturedAt: '2026-07-14T01:10:00.000Z',
    messages,
    excerpts: messages.map((message, index) => ({
      order: index + 1,
      excerptId: `span-${index + 1}`,
      turnId: message.turnId,
      boundary: { kind: 'message' as const, messageId: message.messageId },
    })),
  });
  const rootRef = 'source-root-fixture';
  const decisionHash = sha256Stable('lineage-decision');
  return {
    receipt,
    rootRef,
    classifications: [
      {
        spanId: receipt.excerpts[0].excerptId,
        disposition: 'source_root' as const,
        classificationRule: 'fixture/source-root/v1',
        sourceRootRefs: [rootRef],
      },
      {
        spanId: receipt.excerpts[1].excerptId,
        disposition: 'duplicate' as const,
        classificationRule: 'fixture/duplicate/v1',
        duplicateOfSourceRootRef: rootRef,
        decisionHash,
      },
      {
        spanId: receipt.excerpts[2].excerptId,
        disposition: 'superseded' as const,
        classificationRule: 'fixture/superseded/v1',
        supersededBySpanId: receipt.excerpts[3].excerptId,
        decisionHash,
      },
      {
        spanId: receipt.excerpts[3].excerptId,
        disposition: 'rejected' as const,
        classificationRule: 'fixture/rejected/v1',
        decisionReceiptRef: 'decision-receipt-fixture',
        decisionHash,
      },
      {
        spanId: receipt.excerpts[4].excerptId,
        disposition: 'excluded' as const,
        classificationRule: 'fixture/excluded/v1',
        exclusionRuleRef: 'fixture/non-requirement/v1',
        exclusionReason: 'transport-only text',
        decisionHash,
      },
    ],
  };
}

describe('requirements contract intent lineage', () => {
  it('classifies every material intake span exactly once without copying source hashes', () => {
    const { receipt, classifications } = fixture();
    const ledger = createRequirementsContractIntentLineageLedger({
      intakeReceiptPath: 'authoring/intake/intake-receipt.json',
      intakeReceipt: receipt,
      classifications,
    });

    expect(ledger.materialSpanIds).toEqual(receipt.excerpts.map((excerpt) => excerpt.excerptId));
    expect(ledger.classifications.map((row) => row.sourceHash)).toEqual(
      receipt.excerpts.map((excerpt) => excerpt.contentHash)
    );
    expect(validateRequirementsContractIntentLineageLedger(ledger)).toBe(true);
  });

  it('blocks unclassified, duplicate, unknown, and invalid related span classifications', () => {
    const { receipt, classifications } = fixture();
    const create = (rows: typeof classifications) =>
      createRequirementsContractIntentLineageLedger({
        intakeReceiptPath: 'authoring/intake/intake-receipt.json',
        intakeReceipt: receipt,
        classifications: rows,
      });

    expect(() => create(classifications.slice(1))).toThrow(/unclassified/u);
    expect(() => create([...classifications, classifications[0]])).toThrow(/exactly once/u);
    expect(() => create([{ ...classifications[0], spanId: 'unknown-span' }, ...classifications.slice(1)]))
      .toThrow(/unknown/u);
    expect(() => create(classifications.map((row, index) =>
      index === 2 ? { ...row, supersededBySpanId: row.spanId } : row
    ))).toThrow(/superseded/u);
  });
});
