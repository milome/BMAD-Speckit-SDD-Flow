import { describe, expect, it } from 'vitest';
import {
  collectProtectedTokens,
  assertProtectedTokensPreserved,
  type ProtectedTokenManifest,
} from '../../scripts/i18n/protected-token-check';

function createProtectedTokenManifest(): ProtectedTokenManifest {
  return {
    control: {
      protected_tokens: ['npx bmad-speckit score', '--triggerStage speckit_4_2'],
      placeholders: {
        report_path: 'path',
        trigger_stage: 'stage_key',
      },
    },
    anchors: {
      audit_scope: 'audit_scope',
      conclusion: 'conclusion',
    },
  };
}

describe('protected-token-check', () => {
  it('collects protected tokens from manifest control and anchors', () => {
    const tokens = collectProtectedTokens(createProtectedTokenManifest());

    expect(tokens).toContain('npx bmad-speckit score');
    expect(tokens).toContain('--triggerStage speckit_4_2');
    expect(tokens).toContain('audit_scope');
    expect(tokens).toContain('conclusion');
  });

  it('passes when all protected tokens are preserved byte-for-byte', () => {
    const tokens = collectProtectedTokens(createProtectedTokenManifest());
    const outputs = [
      'npx bmad-speckit score --triggerStage speckit_4_2 <!-- SECTION: audit_scope -->',
      'npx bmad-speckit score --triggerStage speckit_4_2 <!-- SECTION: conclusion -->',
    ];

    const result = assertProtectedTokensPreserved(tokens, outputs);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('fails when a protected token is missing', () => {
    const tokens = collectProtectedTokens(createProtectedTokenManifest());
    const outputs = ['npx bmad-speckit score --triggerStage translated_stage'];

    const result = assertProtectedTokensPreserved(tokens, outputs);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Protected token missing from output: --triggerStage speckit_4_2');
  });

  it('fails when anchor tokens are altered', () => {
    const tokens = collectProtectedTokens(createProtectedTokenManifest());
    const outputs = ['<!-- SECTION: 审计范围 -->'];

    const result = assertProtectedTokensPreserved(tokens, outputs);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Protected token missing from output: audit_scope');
    expect(result.errors).toContain('Protected token missing from output: conclusion');
  });
});
