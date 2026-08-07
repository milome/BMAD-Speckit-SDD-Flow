import { describe, expect, it } from 'vitest';
import {
  createMinimalConsumerRequirementDescriptor,
  createTempRoot,
  expectSourceHashUnchanged,
  installJudgeRuntimeConfig,
  removeTempRoot,
  runAuthoring,
  sha256File,
  writeMinimalConsumerRequirement,
} from './helpers/requirements-contract-authoring-fixture';

function createFixture(root: string, recordId: string) {
  installJudgeRuntimeConfig(root);
  const materialized = writeMinimalConsumerRequirement(
    root,
    `docs/requirements/${recordId.toLowerCase()}.md`,
    createMinimalConsumerRequirementDescriptor(recordId)
  );
  return {
    ...materialized,
    beforeHash: sha256File(materialized.sourcePath),
  };
}

describe('requirements contract readonly subagent providers', () => {
  it.each(['codex_subagent_readonly', 'claude_subagent_readonly'] as const)(
    'rejects the hard-cut %s provider before provider dispatch',
    (providerMode) => {
      const root = createTempRoot(`requirements-contract-${providerMode}-hard-cut-`);
      try {
        const recordId = `REQ-${providerMode.toUpperCase().replace(/_/gu, '-')}-HARD-CUT`;
        const fixture = createFixture(root, recordId);

        expect(() =>
          runAuthoring(root, fixture.sourcePath, recordId, {
            ...fixture.authoringOptions,
            criticalAuditorProviderMode: providerMode,
          })
        ).toThrow('critical_auditor_file_backed_provider_forbidden');
        expectSourceHashUnchanged(fixture.sourcePath, fixture.beforeHash);
      } finally {
        removeTempRoot(root);
      }
    }
  );

  it.each(['criticalAuditorResponseFile', 'criticalAuditorResponseDir'] as const)(
    'rejects the hard-cut %s handoff before reading caller-owned results',
    (field) => {
      const root = createTempRoot(`requirements-contract-${field}-hard-cut-`);
      try {
        const recordId = `REQ-${field.toUpperCase()}-HARD-CUT`;
        const fixture = createFixture(root, recordId);

        expect(() =>
          runAuthoring(root, fixture.sourcePath, recordId, {
            ...fixture.authoringOptions,
            [field]: 'caller-owned-critical-auditor-result.json',
          })
        ).toThrow('critical_auditor_file_backed_provider_forbidden');
        expectSourceHashUnchanged(fixture.sourcePath, fixture.beforeHash);
      } finally {
        removeTempRoot(root);
      }
    }
  );
});
