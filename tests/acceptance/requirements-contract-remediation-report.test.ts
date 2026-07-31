import { describe, expect, it } from 'vitest';
import { compileRequirementsContractRemediationReport } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-remediation-report-compiler';
import { publishRequirementsContractRemediationCandidate } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-remediation-publisher';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const hash = (label: string) => sha256Stable({ label });

function receipt() {
  return publishRequirementsContractRemediationCandidate({
    campaignId: 'goal-campaign-001',
    candidateId: 'candidate-a',
    finalizationByteManifestHash: hash('finalization'),
    campaignRemediationReceiptHash: hash('campaign-remediation'),
    candidateFiles: [{ path: 'packages/bmad-speckit/src/a.ts', byteHash: hash('a') }],
    dirtyPreservation: {
      preservedPathHashes: [hash('user-dirty-a')],
      unrelatedDirtyChanged: false,
      userChangesOverwritten: false,
    },
    conflictDetected: false,
    replayOfPublishedAttempt: false,
    partialPromotionDetected: false,
    markdownAuthorityPublished: false,
  });
}

describe('requirements contract remediation report', () => {
  it('compiles a machine-readable publication report without Markdown authority', () => {
    const publicationReceipt = receipt();
    const report = compileRequirementsContractRemediationReport({
      publicationReceipt,
      format: 'machine-json',
      markdownAuthorityIncluded: false,
    });

    expect(report.campaignId).toBe(publicationReceipt.campaignId);
    expect(report.postRemediationAttemptKey).toBe(publicationReceipt.postRemediationAttemptKey);
    expect(report.markdownAuthorityIncluded).toBe(false);
    expect(report.decision).toBe('pass');
  });

  it('rejects Markdown authority and non-machine report formats', () => {
    expect(() =>
      compileRequirementsContractRemediationReport({
        publicationReceipt: receipt(),
        format: 'markdown',
        markdownAuthorityIncluded: false,
      })
    ).toThrow('remediation_report_format_invalid');

    expect(() =>
      compileRequirementsContractRemediationReport({
        publicationReceipt: receipt(),
        format: 'machine-json',
        markdownAuthorityIncluded: true,
      })
    ).toThrow('remediation_report_markdown_authority');
  });
});
