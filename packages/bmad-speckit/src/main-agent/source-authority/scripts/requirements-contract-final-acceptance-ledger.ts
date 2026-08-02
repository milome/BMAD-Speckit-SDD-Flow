import {
  isRecord,
  requireHash,
  requireNonEmptyUniqueStrings,
  requireText,
  stableHash,
  uniqueSorted,
} from './requirements-contract-verification-evidence-normalizer';

export interface RequirementsContractFinalAcceptanceLedger {
  schemaVersion: 'requirements-contract-final-acceptance-ledger/v1';
  campaignId: string;
  closureHashes: string[];
  reviewerGateHash: string;
  finalJudgeValidationHash: string;
  unresolvedIssueHashes: [];
  ledgerHeadHash: string;
  decision: 'pass';
}

export class RequirementsContractFinalAcceptanceLedgerError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'RequirementsContractFinalAcceptanceLedgerError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new RequirementsContractFinalAcceptanceLedgerError(code);
}

export function compileRequirementsContractFinalAcceptanceLedger(
  input: unknown
): RequirementsContractFinalAcceptanceLedger {
  if (!isRecord(input)) fail('final_acceptance_ledger_input_invalid');
  const unresolvedIssueHashes = Array.isArray(input.unresolvedIssueHashes)
    ? input.unresolvedIssueHashes
    : [];
  if (unresolvedIssueHashes.length > 0) fail('final_acceptance_ledger_unresolved');
  const closureHashes = requireNonEmptyUniqueStrings(
    input.closureHashes,
    'final_acceptance_ledger_closure_missing'
  );
  for (const hash of closureHashes) {
    requireHash({ hash }, 'hash', 'final_acceptance_ledger_closure_missing');
  }
  const payload = {
    schemaVersion: 'requirements-contract-final-acceptance-ledger/v1' as const,
    campaignId: requireText(input, 'campaignId', 'final_acceptance_ledger_campaign_invalid'),
    closureHashes: uniqueSorted(closureHashes),
    reviewerGateHash: requireHash(
      input,
      'reviewerGateHash',
      'final_acceptance_ledger_gate_missing'
    ),
    finalJudgeValidationHash: requireHash(
      input,
      'finalJudgeValidationHash',
      'final_acceptance_ledger_gate_missing'
    ),
    unresolvedIssueHashes: [] as [],
    decision: 'pass' as const,
  };
  return { ...payload, ledgerHeadHash: stableHash(payload) };
}
