import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  artifacts,
  cleanCriticalAuditorRound,
  createMinimalConsumerRequirementDescriptor,
  createStaleImplementationConfirmationDescriptor,
  createTempRoot,
  expectSourceHashUnchanged,
  issueCodes,
  readImplementationConfirmation,
  readJson,
  removeTempRoot,
  runAuthoring,
  sha256File,
  writeMinimalConsumerRequirement,
} from './helpers/requirements-contract-authoring-fixture';

describe('requirements contract existing source promotion', () => {
  it('keeps existing source unchanged until auditor convergence and authoring-draft promotion', () => {
    const root = createTempRoot('requirements-contract-existing-source-');
    try {
      const { sourcePath: source, authoringOptions } = writeMinimalConsumerRequirement(
        root,
        'docs/plans/existing-source.md',
        createMinimalConsumerRequirementDescriptor('REQ-EXISTING-SOURCE')
      );
      const beforeHash = sha256File(source);

      const blocked = runAuthoring(root, source, 'REQ-EXISTING-SOURCE', {
        ...authoringOptions,
      });
      const paths = artifacts(root, 'REQ-EXISTING-SOURCE', 'REQ-EXISTING-SOURCE-SET');

      expect(issueCodes(blocked)).toContain('critical_auditor_provider_mode_required');
      expect(existsSync(paths.draftSourcePreview)).toBe(true);
      expect(existsSync(paths.promotionReceipt)).toBe(false);
      expectSourceHashUnchanged(source, beforeHash);
      expect(readJson<Record<string, unknown>>(paths.authoringTransaction).substate).toBe(
        'critical_auditor_round_required'
      );

      runAuthoring(root, source, 'REQ-EXISTING-SOURCE', {
        ...authoringOptions,
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const receipt = readJson<Record<string, unknown>>(paths.promotionReceipt);
      const ledger = readJson<Record<string, unknown>>(paths.authoringTransaction);

      expect(existsSync(paths.promotionReceipt)).toBe(true);
      expect(receipt.promotionStage).toBe('authoring-draft');
      expect(receipt.targetHash).toBe(sha256File(source));
      expect(readImplementationConfirmation(source).preConfirmationDrilldown).toBeTruthy();
      expect(ledger).toMatchObject({
        schemaVersion: 'requirements-authoring-transaction/v1',
        lane: 'author-confirmation-ready-source',
        entryMode: 'existing_source',
        substate: 'promoted_not_confirmation_ready',
      });
    } finally {
      removeTempRoot(root);
    }
  });

  it('promotes an existing source that already has a stale implementationConfirmation block', () => {
    const root = createTempRoot('requirements-contract-existing-source-stale-block-');
    try {
      const descriptor = createMinimalConsumerRequirementDescriptor('REQ-EXISTING-SOURCE-STALE');
      const staleImplementationConfirmation = createStaleImplementationConfirmationDescriptor(
        'REQ-EXISTING-SOURCE-STALE-PREDECESSOR'
      );
      const { sourcePath: source, authoringOptions } = writeMinimalConsumerRequirement(
        root,
        'docs/plans/existing-source-with-stale-block.md',
        descriptor,
        { staleImplementationConfirmation }
      );
      const beforeRawHash = sha256File(source);

      const promoted = runAuthoring(root, source, 'REQ-EXISTING-SOURCE-STALE', {
        ...authoringOptions,
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const paths = artifacts(root, 'REQ-EXISTING-SOURCE-STALE', 'REQ-EXISTING-SOURCE-STALE-SET');
      expect(issueCodes(promoted)).toEqual([]);
      const receipt = readJson<Record<string, unknown>>(paths.promotionReceipt);
      const decision = readJson<Record<string, unknown>>(paths.sourceMutationDecision);
      const confirmation = readImplementationConfirmation(source);

      expect(existsSync(paths.promotionReceipt)).toBe(true);
      expect(receipt.promotionStage).toBe('authoring-draft');
      expect(receipt.targetHash).toBe(sha256File(source));
      expect(decision.sourceDocumentHashBefore).toBe(beforeRawHash);
      expect(decision.targetRawHashBefore).toBe(beforeRawHash);
      expect(decision.semanticSourceHashBefore).toMatch(/^sha256:[a-f0-9]{64}$/u);
      expect(decision.semanticSourceHashBefore).not.toBe(beforeRawHash);
      expect(confirmation.recordId).toBe('REQ-EXISTING-SOURCE-STALE');
    } finally {
      removeTempRoot(root);
    }
  });
});
