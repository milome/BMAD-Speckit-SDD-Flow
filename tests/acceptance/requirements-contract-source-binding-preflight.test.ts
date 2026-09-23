import { describe, expect, it } from 'vitest';
import {
  createRequirementsContractSourceBindingRefreshReceipt,
  preflightRequirementsContractSourceBindingRefresh,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-source-binding-preflight';

const hash = (digit: string) => `sha256:${digit.repeat(64)}`;

describe('source binding refresh preflight', () => {
  it('classifies locator-only changes without invalidating semantic confirmation', () => {
    const result = preflightRequirementsContractSourceBindingRefresh({
      semanticRevisionId: 'semantic-revision-001',
      scopeSemanticHash: hash('1'),
      beforeSemanticAuthority: { requirementIds: ['MUST-001'] },
      afterSemanticAuthority: { requirementIds: ['MUST-001'] },
      beforeLocatorHash: hash('2'),
      afterLocatorHash: hash('3'),
    });

    expect(result).toMatchObject({
      decision: 'refresh_binding',
      rerunCp00: false,
      invalidateConfirmation: false,
      triggerGoalCompilation: false,
    });
  });

  it('classifies semantic changes as a recompile', () => {
    const result = preflightRequirementsContractSourceBindingRefresh({
      semanticRevisionId: 'semantic-revision-001',
      scopeSemanticHash: hash('1'),
      beforeSemanticAuthority: { requirementIds: ['MUST-001'] },
      afterSemanticAuthority: { requirementIds: ['MUST-002'] },
      beforeLocatorHash: hash('2'),
      afterLocatorHash: hash('2'),
    });

    expect(result).toMatchObject({
      decision: 'semantic_recompile',
      rerunCp00: true,
      invalidateConfirmation: true,
    });
  });

  it('rejects malformed receipt identities instead of constructing a compatibility receipt', () => {
    expect(() =>
      createRequirementsContractSourceBindingRefreshReceipt({
        semanticRevisionId: 'semantic-revision-001',
        scopeSemanticHash: 'not-a-hash',
        fromBindingRevisionId: 'binding-001',
        toBindingRevisionId: 'binding-002',
        fromSourceBindingHash: hash('1'),
        toSourceBindingHash: hash('2'),
        fromSnapshotSetHash: hash('3'),
        toSnapshotSetHash: hash('4'),
        fromSourceSpanRegistryHash: hash('5'),
        toSourceSpanRegistryHash: hash('6'),
        evidenceClaimRegistryHash: hash('7'),
      })
    ).toThrow('requirements_source_binding_refresh_hash_invalid');
  });
});
