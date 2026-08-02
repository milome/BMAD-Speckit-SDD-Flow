import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  compileRequirementsContractReviewerParentProjection,
  validateRequirementsContractReviewerParentProjection,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-reviewer-parent-projection';

const hash = (character: string) => `sha256:${character.repeat(64)}`;

export function reviewerProjectionInput() {
  return {
    actorClass: 'bounded_code_reviewer' as const,
    reviewerProfileId: 'bmad_code_reviewer',
    campaignId: 'judge-review-campaign-001',
    scopeSnapshotPath: 'runtime/reviewer-scope-snapshot.json',
    scopeSnapshotHash: hash('a'),
    implementationByteManifestHash: hash('b'),
    evidenceManifestHash: hash('c'),
    allowedEvidenceRefs: ['EVD-002', 'EVD-001'],
    mandatoryCoverageUnits: ['coverage:security', 'coverage:correctness'],
    semanticPromptHash: hash('d'),
    promptTemplateHash: hash('e'),
    resultSchemaHash: hash('f'),
    policyHash: hash('1'),
    hostId: 'codex' as const,
    nativeAgentIdentity: 'code-reviewer' as const,
    componentByteHash: hash('2'),
    resolvedReviewerModelId: 'reviewer-model-current',
    resolvedReviewerProviderFamily: 'provider-family-a',
    readonlyMode: 'read-only',
    invocationOrdinal: 1 as const,
    reviewerAttemptKey: hash('3'),
    expectedReceiptIdentityHash: hash('4'),
    currentAuthority: {
      campaignId: 'judge-review-campaign-001',
      scopeSnapshotHash: hash('a'),
      implementationByteManifestHash: hash('b'),
      evidenceManifestHash: hash('c'),
      componentByteHash: hash('2'),
    },
  };
}

describe('requirements contract Reviewer parent projection', () => {
  it('compiles one deterministic parent-bound Reviewer projection', () => {
    const input = reviewerProjectionInput();
    const first = compileRequirementsContractReviewerParentProjection(input);
    const second = compileRequirementsContractReviewerParentProjection({
      ...input,
      allowedEvidenceRefs: [...input.allowedEvidenceRefs].reverse(),
      mandatoryCoverageUnits: [...input.mandatoryCoverageUnits].reverse(),
    });

    expect(second).toEqual(first);
    expect(first.actorClass).toBe('bounded_code_reviewer');
    expect(first.nativeAgentIdentity).toBe('code-reviewer');
    expect(first.invocationOrdinal).toBe(1);
    expect(
      validateRequirementsContractReviewerParentProjection(first, input.currentAuthority)
    ).toBe(first);
  });

  it.each([
    ['caller-findings', 'reviewer_projection_caller_findings_forbidden'],
    ['inferred-identity', 'reviewer_projection_identity_inference_forbidden'],
    ['peer-output', 'reviewer_projection_peer_output_forbidden'],
    ['fallback', 'reviewer_projection_fallback_forbidden'],
    ['ordinal', 'reviewer_projection_invocation_ordinal_invalid'],
    ['stale-scope', 'reviewer_projection_scope_stale'],
    ['cross-campaign', 'reviewer_projection_campaign_replay'],
    ['actor', 'reviewer_projection_actor_invalid'],
    ['caller-hash', 'reviewer_projection_expected_hash_forbidden'],
  ])('rejects %s before component dispatch', (kind, code) => {
    const input = reviewerProjectionInput() as Record<string, any>;
    if (kind === 'caller-findings') input.callerFindings = [];
    if (kind === 'inferred-identity') {
      input.inferredNativeAgentIdentity = 'code-reviewer';
    }
    if (kind === 'peer-output') input.peerFinalJudgeOutput = {};
    if (kind === 'fallback') input.fallbackCarrier = 'general-purpose';
    if (kind === 'ordinal') input.invocationOrdinal = 2;
    if (kind === 'stale-scope') input.scopeSnapshotHash = hash('0');
    if (kind === 'cross-campaign') input.campaignId = 'other-campaign';
    if (kind === 'actor') input.actorClass = 'final_acceptance_judge';
    if (kind === 'caller-hash') input.expectedProjectionHash = hash('0');

    expect(() => compileRequirementsContractReviewerParentProjection(input)).toThrow(code);
  });

  it('validates schema and rejects projection tampering', () => {
    const input = reviewerProjectionInput();
    const projection = compileRequirementsContractReviewerParentProjection(input);
    const schema = JSON.parse(
      readFileSync(
        path.resolve(
          'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-reviewer-parent-projection.schema.json'
        ),
        'utf8'
      )
    );

    expect(new Ajv2020({ strict: false }).compile(schema)(projection)).toBe(true);
    expect(() =>
      validateRequirementsContractReviewerParentProjection(
        { ...projection, readonlyMode: 'workspace-write' },
        input.currentAuthority
      )
    ).toThrow('reviewer_projection_hash_mismatch');
  });
});
