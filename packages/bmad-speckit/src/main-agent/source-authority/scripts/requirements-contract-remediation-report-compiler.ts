import {
  type RequirementsContractRemediationPublicationReceipt,
  validateRequirementsContractRemediationPublicationReceipt,
} from './requirements-contract-remediation-publisher';
import {
  isRecord,
  requireText,
  stableHash,
} from './requirements-contract-verification-evidence-normalizer';

export interface RequirementsContractRemediationReport {
  schemaVersion: 'requirements-contract-remediation-report/v1';
  campaignId: string;
  candidateId: string;
  postRemediationAttemptKey: string;
  publicationReceiptHash: string;
  markdownAuthorityIncluded: false;
  reportHash: string;
  decision: 'pass';
}

export class RequirementsContractRemediationReportCompilerError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'RequirementsContractRemediationReportCompilerError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new RequirementsContractRemediationReportCompilerError(code);
}

export function compileRequirementsContractRemediationReport(
  input: unknown
): RequirementsContractRemediationReport {
  if (!isRecord(input)) fail('remediation_report_input_invalid');
  const publicationReceipt = validateRequirementsContractRemediationPublicationReceipt(
    input.publicationReceipt,
    input.publicationReceipt
  ) as RequirementsContractRemediationPublicationReceipt;
  if (input.markdownAuthorityIncluded === true) fail('remediation_report_markdown_authority');
  if (requireText(input, 'format', 'remediation_report_format_invalid') !== 'machine-json') {
    fail('remediation_report_format_invalid');
  }
  const payload = {
    schemaVersion: 'requirements-contract-remediation-report/v1' as const,
    campaignId: publicationReceipt.campaignId,
    candidateId: publicationReceipt.candidateId,
    postRemediationAttemptKey: publicationReceipt.postRemediationAttemptKey,
    publicationReceiptHash: publicationReceipt.publicationReceiptHash,
    markdownAuthorityIncluded: false as const,
    decision: 'pass' as const,
  };
  return { ...payload, reportHash: stableHash(payload) };
}
