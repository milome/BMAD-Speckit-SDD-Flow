import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  compileRequirementsContractReviewerOriginProjection,
  validateRequirementsContractReviewerOriginProjection,
  type ReviewerCampaignInput,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-reviewer-origin-projection';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const hash = (character: string) => `sha256:${character.repeat(64)}`;

function finding(id: string, fingerprint: string, file: string, line: number) {
  return {
    findingId: id,
    severity: 'high' as const,
    category: `rule:${id}`,
    requirementRefs: [`REQ-${id}`],
    coverageUnitRefs: [`coverage:${id}`],
    path: file,
    line,
    defectClaim: `defect:${id}`,
    concreteEvidence: `evidence:${id}`,
    reachableFailure: `failure:${id}`,
    recommendedRepair: `repair:${id}`,
    fingerprint,
  };
}

function projectionInput() {
  const findings = [
    finding('finding-b', hash('b'), 'src/b.ts', 20),
    finding('finding-a', hash('a'), 'src/a.ts', 10),
  ];
  const ledgerFindings = findings.map((item) => ({
    findingId: item.findingId,
    fingerprint: item.fingerprint,
    canonicalRule: item.category,
    canonicalLocation: { path: item.path, line: item.line },
  }));
  const ledgerPayload = {
    schemaVersion: 'reviewer-finding-source-ledger/v1' as const,
    actorClass: 'bounded_code_reviewer' as const,
    reviewerIdentity: 'bmad_code_reviewer' as const,
    campaignId: 'judge-review-campaign-001',
    campaignLineageKey: hash('c'),
    scopeSnapshotHash: hash('d'),
    reviewerAttemptKey: hash('e'),
    requestHash: hash('f'),
    responseHash: hash('1'),
    identityReceiptHash: hash('2'),
    coverageReceiptHash: hash('3'),
    findings: ledgerFindings,
  };
  const sourceLedger = {
    ...ledgerPayload,
    sourceLedgerHash: sha256Stable({
      ...ledgerPayload,
      findings: [...ledgerFindings].sort((left, right) =>
        left.findingId.localeCompare(right.findingId)
      ),
    }),
  };
  return {
    normalizedResult: {
      schemaVersion: 'reviewer-discovery-result/v2',
      actorClass: 'bounded_code_reviewer',
      reviewerIdentity: 'bmad_code_reviewer',
      profile: 'parent_goal_implementation_discovery',
      resultCode: 'findings_present',
      campaignId: sourceLedger.campaignId,
      attemptKey: sourceLedger.reviewerAttemptKey,
      scopeSnapshotHash: sourceLedger.scopeSnapshotHash,
      findings: [...findings].reverse(),
    },
    sourceLedger,
    currentAuthority: {
      campaignId: sourceLedger.campaignId,
      campaignLineageKey: sourceLedger.campaignLineageKey,
      scopeSnapshotHash: sourceLedger.scopeSnapshotHash,
      reviewerAttemptKey: sourceLedger.reviewerAttemptKey,
      sourceLedgerHash: sourceLedger.sourceLedgerHash,
      requestHash: sourceLedger.requestHash,
      responseHash: sourceLedger.responseHash,
      identityReceiptHash: sourceLedger.identityReceiptHash,
      coverageReceiptHash: sourceLedger.coverageReceiptHash,
    },
  };
}

describe('requirements contract Reviewer origin projection', () => {
  it('projects exactly one immutable origin per finding independent of input order', () => {
    const input = projectionInput();
    const first: ReviewerCampaignInput = compileRequirementsContractReviewerOriginProjection(input);
    const second = compileRequirementsContractReviewerOriginProjection({
      ...input,
      normalizedResult: {
        ...input.normalizedResult,
        findings: [...input.normalizedResult.findings].reverse(),
      },
      sourceLedger: {
        ...input.sourceLedger,
        findings: [...input.sourceLedger.findings].reverse(),
      },
    });

    expect(second).toEqual(first);
    expect(first.origins.map((origin) => origin.findingId)).toEqual(['finding-a', 'finding-b']);
    expect(new Set(first.origins.map((origin) => origin.originId)).size).toBe(2);
    expect(first.requestHash).toBe(input.sourceLedger.requestHash);
    expect(first.responseHash).toBe(input.sourceLedger.responseHash);
    expect(first.identityReceiptHash).toBe(input.sourceLedger.identityReceiptHash);
    expect(first.coverageReceiptHash).toBe(input.sourceLedger.coverageReceiptHash);
    expect(
      validateRequirementsContractReviewerOriginProjection(first, input.currentAuthority)
    ).toBe(first);
  });

  it.each([
    ['approval', true],
    ['score', 100],
    ['remediationDisposition', 'accepted'],
    ['writeAuthority', true],
    ['anotherReviewRequest', true],
    ['finalizationAuthority', true],
  ])('rejects forbidden Reviewer authority field %s', (field, value) => {
    const input = projectionInput() as Record<string, unknown>;
    const normalizedResult = input.normalizedResult as Record<string, unknown>;
    normalizedResult[field] = value;

    expect(() => compileRequirementsContractReviewerOriginProjection(input)).toThrow(
      'reviewer_origin_authority_field_forbidden'
    );
  });

  it.each([
    ['duplicate', 'reviewer_origin_duplicate'],
    ['unknown', 'reviewer_origin_unknown'],
    ['copied', 'reviewer_origin_copied_finding'],
    ['unbound-ledger-field', 'reviewer_origin_field_invalid'],
    ['message-order', 'reviewer_origin_message_order_identity_forbidden'],
    ['scope-replay', 'reviewer_origin_scope_replay'],
    ['ledger-stale', 'reviewer_origin_ledger_stale'],
    ['receipt-replay', 'reviewer_origin_receipt_replay'],
    ['campaign-replay', 'reviewer_origin_campaign_replay'],
  ])('fails closed for %s origin input', (kind, code) => {
    const input = projectionInput();
    if (kind === 'duplicate')
      input.normalizedResult.findings.push(input.normalizedResult.findings[0]);
    if (kind === 'unknown') {
      input.sourceLedger.findings.push({
        findingId: 'finding-c',
        fingerprint: hash('4'),
        canonicalRule: 'rule:finding-c',
        canonicalLocation: { path: 'src/c.ts', line: 30 },
      });
    }
    if (kind === 'copied') input.normalizedResult.findings[0].fingerprint = hash('5');
    if (kind === 'unbound-ledger-field') {
      (input.sourceLedger.findings[0] as Record<string, unknown>).mutableNote = 'tamper';
    }
    if (kind === 'message-order') {
      (input.normalizedResult.findings[0] as Record<string, unknown>).messageOrder = 1;
    }
    if (kind === 'scope-replay') input.normalizedResult.scopeSnapshotHash = hash('0');
    if (kind === 'ledger-stale') input.currentAuthority.sourceLedgerHash = hash('0');
    if (kind === 'receipt-replay') input.currentAuthority.identityReceiptHash = hash('0');
    if (kind === 'campaign-replay') input.normalizedResult.campaignId = 'other-campaign';

    expect(() => compileRequirementsContractReviewerOriginProjection(input)).toThrow(code);
  });

  it('validates the schema and rejects projected-origin tampering', () => {
    const input = projectionInput();
    const projection = compileRequirementsContractReviewerOriginProjection(input);
    const schema = JSON.parse(
      readFileSync(
        path.resolve(
          'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-reviewer-origin-projection.schema.json'
        ),
        'utf8'
      )
    );

    expect(new Ajv2020({ strict: false }).compile(schema)(projection)).toBe(true);
    expect(() =>
      validateRequirementsContractReviewerOriginProjection(
        {
          ...projection,
          origins: [{ ...projection.origins[0], requestHash: hash('0') }, projection.origins[1]],
        },
        input.currentAuthority
      )
    ).toThrow('reviewer_origin_hash_mismatch');
  });
});
