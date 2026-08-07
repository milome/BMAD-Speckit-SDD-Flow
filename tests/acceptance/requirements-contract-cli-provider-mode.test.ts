import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  artifacts,
  createTestAuthoringExecutionOptions,
  createTempRoot,
  expectSourceHashUnchanged,
  removeTempRoot,
  runAuthoring,
  sha256File,
  writeConsumerRequirement,
} from './helpers/requirements-contract-authoring-fixture';

describe('requirements contract provider mode', () => {
  it('defaults to main_session_inline and returns fail-closed continuation fields', () => {
    const root = createTempRoot('requirements-contract-provider-mode-');
    try {
      const source = writeConsumerRequirement(root);
      const beforeHash = sha256File(source);

      const result = runAuthoring(root, source, 'REQ-PROVIDER-MODE', {
        ...createTestAuthoringExecutionOptions('REQ-PROVIDER-MODE'),
      });

      expect(result.ok).toBe(false);
      expect(result.criticalAuditorProviderMode).toBe('main_session_inline');
      expect(result.blockingStage).toBe('critical_auditor_provider_mode_required');
      expect(result.nextRequiredAction).toBe('run_main_session_critical_auditor_round');
      expect(result.sourceMutationPerformed).toBe(false);
      expect(result.allowedArtifacts).toEqual(['advisory', 'staging']);
      expect(result.forbiddenArtifacts).toEqual([
        'promotion-receipt',
        'source-materialization-receipt',
        'source mutation',
      ]);
      expect(result.criticalAuditorContinuation).toMatchObject({
        providerMode: 'main_session_inline',
        roundIndex: 1,
        nextRequiredAction: 'run_main_session_critical_auditor_round',
      });
      expectSourceHashUnchanged(source, beforeHash);
      expect(existsSync(artifacts(root, 'REQ-PROVIDER-MODE').sourceMaterializationReceipt)).toBe(
        false
      );
    } finally {
      removeTempRoot(root);
    }
  });

  it('rejects invalid provider modes before source mutation', () => {
    const root = createTempRoot('requirements-contract-provider-mode-invalid-');
    try {
      const source = writeConsumerRequirement(root);
      const beforeHash = sha256File(source);

      expect(() =>
        runAuthoring(root, source, 'REQ-PROVIDER-MODE-INVALID', {
          criticalAuditorProviderMode: 'bad_mode',
        })
      ).toThrow(/critical_auditor_provider_mode_invalid/u);
      expectSourceHashUnchanged(source, beforeHash);
    } finally {
      removeTempRoot(root);
    }
  });
});
