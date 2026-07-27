import { describe, expect, it } from 'vitest';
import { isDirectRequirementsContractCriticalAuditorJudgeAdapterCli } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-critical-auditor-judge-adapter';

describe('critical auditor judge adapter CLI entry guard', () => {
  it('runs only for the adapter entry and not for containing bundles', () => {
    for (const entry of [
      '/runtime/requirements-contract-critical-auditor-judge-adapter.ts',
      '/runtime/requirements-contract-critical-auditor-judge-adapter.js',
      'C:\\runtime\\requirements-contract-critical-auditor-judge-adapter.cjs',
    ]) {
      expect(
        isDirectRequirementsContractCriticalAuditorJudgeAdapterCli(entry)
      ).toBe(true);
    }

    for (const entry of [
      undefined,
      '/runtime/resolve-for-session.cjs',
      '/runtime/requirements-contract-critical-auditor-judge-adapter-wrapper.js',
    ]) {
      expect(
        isDirectRequirementsContractCriticalAuditorJudgeAdapterCli(entry)
      ).toBe(false);
    }
  });
});
